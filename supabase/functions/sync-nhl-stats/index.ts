// Edge Function: synchronise les matchs NHL termines (calendrier + boxscore) vers les
// tables partagees nhl_games / nhl_player_game_stats / nhl_team_game_results, pour que
// tous les pools voient les memes chiffres (Phase 3 - moteur de pointage).
//
// Deux appelants, authentifies dans le code (verify_jwt est desactive pour cette fonction
// dans supabase/config.toml -- la passerelle ne filtre donc plus rien, tout le controle
// d'acces vit ici) :
// - Le GitHub Action planifie (voir .github/workflows/sync-nhl-stats.yml), identifie par un
//   secret dedie dans l'en-tete "x-sync-secret", compare a temps constant a la variable
//   d'environnement SYNC_CRON_SECRET de la fonction. Ni ce secret ni la cle service_role ne
//   sont JAMAIS dans le code client ni le repo -- seulement comme secrets Supabase (fonction)
//   et GitHub (repo).
// - Le bouton "Recalculer" du commissaire dans l'UI, identifie par son jeton Supabase normal
//   (valide ici via auth.getUser(), puisque la passerelle ne le fait plus) + { pool_id } dans
//   le corps, puis verifie commissaire du pool via is_pool_commissioner.
// Dans les deux cas, les ecritures utilisent le client service_role interne de la fonction
// (fourni automatiquement par Supabase) pour contourner RLS -- jamais le Bearer de l'appelant.
// Corps JSON optionnel : { start_date?, end_date?, pool_id? } (dates au format YYYY-MM-DD) ;
// pool_id present => mode commissaire, absent => mode planifie.
//
// PPP (power play points), SHP (short handed points) et les buts gagnants (GWG) ne sont pas
// dans le boxscore NHL : on les derive du detail but-par-but fourni par /v1/score/{date}
// (chaque but a deja "strength" ['ev'|'pp'|'sh'] et le score courant home/away a ce moment),
// ce qui evite d'avoir a parser le play-by-play brut (situationCode) pour ces categories.
// Le but gagnant est determine selon la regle officielle : le premier but de l'equipe
// gagnante qui porte son total a (score final de l'equipe perdante + 1) -- apres quoi elle
// n'est plus jamais rejointe, par definition du score final.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NHL_BASE = 'https://api-web.nhle.com/v1';

async function fetchWithRetry(url: string, attempts = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// Etats NHL bruts (FUT/PRE/LIVE/CRIT/FINAL/OFF/PPD...) ramenes aux 4 valeurs stockees.
function mapState(gameState: string | undefined): 'FUT' | 'LIVE' | 'FINAL' | 'OFF' {
  if (gameState === 'LIVE' || gameState === 'CRIT') return 'LIVE';
  if (gameState === 'FINAL') return 'FINAL';
  if (gameState === 'OFF') return 'OFF';
  return 'FUT'; // FUT, PRE, PPD (reporte), et tout code inconnu : pas encore joue / pas termine
}

// Decision de gardien NHL brute : 'W' | 'L' | 'O' (le code 'O' couvre a la fois une defaite
// en prolongation ET en tirs de barrage -- l'API NHL ne distingue pas les deux a ce niveau).
function mapDecision(raw: string | null | undefined): 'W' | 'L' | 'OTL' | null {
  if (raw === 'O') return 'OTL';
  if (raw === 'W' || raw === 'L') return raw;
  return null;
}

function easternDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function bump(map: Map<number, number>, id: number | undefined | null) {
  if (id == null) return;
  map.set(id, (map.get(id) || 0) + 1);
}

// Comparaison a temps constant (pas de court-circuit sur la premiere difference) pour ne pas
// laisser fuiter d'information sur le secret via le temps de reponse.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

type SyncSummary = { gamesSynced: number; playerStatRowsSynced: number; teamResultRowsSynced: number; errors: string[] };

async function syncDate(supabase: any, dateStr: string, summary: SyncSummary) {
  const scoreData = await fetchWithRetry(`${NHL_BASE}/score/${dateStr}`);
  const games = scoreData.games || [];

  for (const g of games) {
    const state = mapState(g.gameState);
    const homeAbbrev = g.homeTeam?.abbrev;
    const awayAbbrev = g.awayTeam?.abbrev;
    const homeScore = g.homeTeam?.score ?? null;
    const awayScore = g.awayTeam?.score ?? null;
    const lastPeriodType = g.gameOutcome?.lastPeriodType ?? null;

    const gameRow: Record<string, unknown> = {
      game_id: g.id,
      game_date: dateStr,
      start_time_utc: g.startTimeUTC,
      season: String(g.season),
      state,
      home_abbrev: homeAbbrev,
      away_abbrev: awayAbbrev,
      home_score: homeScore,
      away_score: awayScore,
      last_period_type: lastPeriodType,
      winner_abbrev: (state === 'FINAL' || state === 'OFF') && homeScore != null && awayScore != null
        ? (homeScore > awayScore ? homeAbbrev : awayAbbrev)
        : null,
      updated_at: new Date().toISOString(),
    };

    const { error: gameErr } = await supabase.from('nhl_games').upsert(gameRow, { onConflict: 'game_id' });
    if (gameErr) { summary.errors.push(`match ${g.id} (${dateStr}): ${gameErr.message}`); continue; }

    if (state !== 'FINAL' && state !== 'OFF') continue; // seuls les matchs termines comptent

    summary.gamesSynced++;

    // --- resultat equipe NHL (W / defaite en prolongation / defaite en tirs de barrage / L) ---
    const homeWon = (homeScore ?? 0) > (awayScore ?? 0);
    const loserResult = lastPeriodType === 'SO' ? 'SOL' : lastPeriodType === 'OT' ? 'OTL' : 'L';
    const teamRows = [
      { game_id: g.id, team_abbrev: homeAbbrev, result: homeWon ? 'W' : loserResult, updated_at: new Date().toISOString() },
      { game_id: g.id, team_abbrev: awayAbbrev, result: homeWon ? loserResult : 'W', updated_at: new Date().toISOString() },
    ];
    const { error: teamErr } = await supabase.from('nhl_team_game_results').upsert(teamRows, { onConflict: 'game_id,team_abbrev' });
    if (teamErr) summary.errors.push(`resultats equipes ${g.id}: ${teamErr.message}`);
    else summary.teamResultRowsSynced += teamRows.length;

    // --- boxscore (stats individuelles) ---
    let box: any;
    try {
      box = await fetchWithRetry(`${NHL_BASE}/gamecenter/${g.id}/boxscore`);
    } catch (e) {
      summary.errors.push(`boxscore ${g.id}: ${(e as Error)?.message || e}`);
      continue;
    }

    const positionById = new Map<number, 'F' | 'D' | 'G'>();
    for (const side of ['awayTeam', 'homeTeam'] as const) {
      const groups = box.playerByGameStats?.[side] || {};
      for (const sk of groups.forwards || []) positionById.set(sk.playerId, 'F');
      for (const sk of groups.defense || []) positionById.set(sk.playerId, 'D');
      for (const gl of groups.goalies || []) positionById.set(gl.playerId, 'G');
    }

    // PPP / SHP / GWG / buts-passes de gardien : derives du detail but-par-but du jour
    // (score/{date}), pas du boxscore qui ne les contient pas.
    const goals: any[] = g.goals || [];
    const ppp = new Map<number, number>();
    const shp = new Map<number, number>();
    const goalieGoals = new Map<number, number>();
    const goalieAssists = new Map<number, number>();
    for (const goal of goals) {
      const scorerId = goal.playerId as number | undefined;
      const assisterIds = (goal.assists || []).map((a: any) => a.playerId as number);
      if (goal.strength === 'pp') { bump(ppp, scorerId); assisterIds.forEach((id: number) => bump(ppp, id)); }
      else if (goal.strength === 'sh') { bump(shp, scorerId); assisterIds.forEach((id: number) => bump(shp, id)); }
      if (scorerId != null && positionById.get(scorerId) === 'G') bump(goalieGoals, scorerId);
      assisterIds.forEach((id: number) => { if (positionById.get(id) === 'G') bump(goalieAssists, id); });
    }

    let gwgPlayerId: number | null = null;
    if (homeScore != null && awayScore != null && homeScore !== awayScore) {
      const winnerIsHome = homeScore > awayScore;
      const loserFinal = winnerIsHome ? awayScore : homeScore;
      for (const goal of goals) {
        const scoringIsHome = goal.teamAbbrev === homeAbbrev;
        if (scoringIsHome !== winnerIsHome) continue;
        const runningScore = winnerIsHome ? goal.homeScore : goal.awayScore;
        if (runningScore === loserFinal + 1) { gwgPlayerId = goal.playerId; break; }
      }
    }

    const playerRows: Record<string, unknown>[] = [];
    for (const side of ['awayTeam', 'homeTeam'] as const) {
      const teamAbbrev = side === 'homeTeam' ? homeAbbrev : awayAbbrev;
      const groups = box.playerByGameStats?.[side] || {};

      for (const sk of [...(groups.forwards || []), ...(groups.defense || [])]) {
        playerRows.push({
          game_id: g.id,
          player_id: sk.playerId,
          player_name: sk.name?.default || '',
          position: sk.position === 'D' ? 'D' : 'F',
          team_abbrev: teamAbbrev,
          goals: sk.goals || 0,
          assists: sk.assists || 0,
          points: sk.points || 0,
          power_play_points: ppp.get(sk.playerId) || 0,
          short_handed_points: shp.get(sk.playerId) || 0,
          shots_on_goal: sk.sog || 0,
          hits: sk.hits || 0,
          blocked_shots: sk.blockedShots || 0,
          pim: sk.pim || 0,
          plus_minus: sk.plusMinus || 0,
          game_winning_goals: gwgPlayerId === sk.playerId ? 1 : 0,
          decision: null,
          shutout: false,
          saves: 0,
          goals_against: 0,
          goalie_goals: 0,
          goalie_assists: 0,
          updated_at: new Date().toISOString(),
        });
      }

      for (const gl of groups.goalies || []) {
        const decision = mapDecision(gl.decision ?? null);
        const goalsAgainst = gl.goalsAgainst ?? 0;
        playerRows.push({
          game_id: g.id,
          player_id: gl.playerId,
          player_name: gl.name?.default || '',
          position: 'G',
          team_abbrev: teamAbbrev,
          goals: 0,
          assists: 0,
          points: 0,
          power_play_points: 0,
          short_handed_points: 0,
          shots_on_goal: 0,
          hits: 0,
          blocked_shots: 0,
          pim: gl.pim || 0,
          plus_minus: 0,
          game_winning_goals: 0,
          decision,
          shutout: decision === 'W' && goalsAgainst === 0,
          saves: gl.saves || 0,
          goals_against: goalsAgainst,
          goalie_goals: goalieGoals.get(gl.playerId) || 0,
          goalie_assists: goalieAssists.get(gl.playerId) || 0,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (playerRows.length > 0) {
      const { error: playersErr } = await supabase.from('nhl_player_game_stats').upsert(playerRows, { onConflict: 'game_id,player_id' });
      if (playersErr) summary.errors.push(`stats joueurs ${g.id}: ${playersErr.message}`);
      else summary.playerStatRowsSynced += playerRows.length;
    }
  }
}

// Rattrapage maximal (en jours) quand la derniere date synchronisee dans nhl_games est
// ancienne (ex. premiere execution, ou cron reste silencieux un moment) : evite de relancer
// des mois de synchro d'un seul coup.
const MAX_CATCHUP_DAYS = 14;

// Deux modes, distingues par la presence de pool_id dans le corps. verify_jwt est desactive
// pour cette fonction (supabase/config.toml) : la passerelle ne verifie plus rien, tout le
// controle d'acces se fait explicitement ci-dessous.
//
// a) Mode planifie (sans pool_id) : exige l'en-tete "x-sync-secret" EXACTEMENT egal a la
//    variable d'environnement SYNC_CRON_SECRET de la fonction (secret dedie, distinct de la
//    cle service_role -- ni l'un ni l'autre ne sont dans le code ni le repo, seulement comme
//    secrets Supabase/GitHub). Refuse (401) si le secret cote fonction est absent/vide ou si
//    l'en-tete ne correspond pas. Synchronise globalement hier + aujourd'hui, avec rattrapage
//    jusqu'a la derniere date synchronisee (plafonne a MAX_CATCHUP_DAYS).
// b) Mode commissaire (avec pool_id) : jeton Supabase de l'utilisateur connecte, valide ici
//    via auth.getUser() (voir _shared/auth.ts) ; on verifie ensuite qu'il est bien
//    commissaire de ce pool (RPC is_pool_commissioner, soumise a RLS via SON jeton) avant de
//    lancer la synchro, limitee a la fenetre de pointage du pool.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('SYNC_CRON_SECRET');
  const providedSecret = req.headers.get('x-sync-secret') || '';

  let body: { start_date?: string; end_date?: string; pool_id?: string } = {};
  try { body = await req.json(); } catch { /* corps vide = plage par defaut, mode planifie uniquement */ }

  let fromDate = body.start_date;
  let toDate = body.end_date;

  if (body.pool_id) {
    // --- Mode commissaire ---
    const auth = await getAuthenticatedUser(req);
    if (auth.error) return jsonResponse({ error: auth.error }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: isCommish, error: commishErr } = await userClient.rpc('is_pool_commissioner', { p_pool_id: body.pool_id });
    if (commishErr || !isCommish) return jsonResponse({ error: 'not_commissioner' }, 403);

    const { data: poolRow, error: poolErr } = await userClient.from('pools').select('scoring_start_at').eq('id', body.pool_id).single();
    if (poolErr || !poolRow?.scoring_start_at) return jsonResponse({ error: 'pool_not_active' }, 400);
    fromDate = easternDateStr(new Date(poolRow.scoring_start_at));
  } else {
    // --- Mode planifie : x-sync-secret doit correspondre EXACTEMENT a SYNC_CRON_SECRET ---
    if (!cronSecret || !providedSecret || !timingSafeEqual(providedSecret, cronSecret)) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  // Les ecritures (upsert) exigent toujours la cle service_role pour contourner RLS, meme en
  // mode commissaire -- si elle est absente cote fonction, c'est une mauvaise configuration
  // Supabase (secret reserve non fourni), pas une question d'autorisation de l'appelant.
  if (!serviceKey) return jsonResponse({ error: 'service_role_key_unavailable' }, 500);

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const todayEt = easternDateStr(new Date());
    toDate = toDate || todayEt;

    if (!fromDate) {
      // Par defaut (mode planifie sans plage explicite) : hier + aujourd'hui, en remontant
      // jusqu'a la derniere date deja synchronisee si une execution a ete manquee, plafonne a
      // MAX_CATCHUP_DAYS pour ne jamais relancer un historique demesure d'un coup.
      const yesterdayEt = addDaysStr(todayEt, -1);
      const maxLookbackDate = addDaysStr(todayEt, -MAX_CATCHUP_DAYS);
      const { data: lastGame } = await supabase
        .from('nhl_games').select('game_date').order('game_date', { ascending: false }).limit(1).maybeSingle();
      const candidate = (lastGame?.game_date && lastGame.game_date < yesterdayEt) ? lastGame.game_date : yesterdayEt;
      fromDate = candidate < maxLookbackDate ? maxLookbackDate : candidate;
    }

    const summary: SyncSummary = { gamesSynced: 0, playerStatRowsSynced: 0, teamResultRowsSynced: 0, errors: [] };
    const datesSynced: string[] = [];
    for (let d = fromDate; d <= toDate; d = addDaysStr(d, 1)) {
      await syncDate(supabase, d, summary);
      datesSynced.push(d);
    }

    return jsonResponse({ success: true, datesSynced, ...summary });
  } catch (err) {
    return jsonResponse({ error: String((err as Error)?.message || err) }, 500);
  }
});
