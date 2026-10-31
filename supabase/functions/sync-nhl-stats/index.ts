// Edge Function: synchronise les matchs NHL termines (calendrier + boxscore) vers les
// tables partagees nhl_games / nhl_player_game_stats / nhl_team_game_results, pour que
// tous les pools voient les memes chiffres (Phase 3 - moteur de pointage).
//
// Deux appelants : le GitHub Action planifie (voir .github/workflows/sync-nhl-stats.yml,
// authentifie avec "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" -- cette cle n'est
// JAMAIS dans le code client ni le repo, seulement comme secret Supabase et comme secret du
// repo GitHub) et le bouton "Recalculer" du commissaire dans l'UI (authentifie avec le jeton
// normal de l'utilisateur, voir Deno.serve plus bas pour le detail des deux chemins).
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

async function syncDate(supabase: any, dateStr: string, summary: { gamesSynced: number; errors: string[] }) {
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
    }
  }
}

// Deux appelants possibles :
// 1) Le GitHub Action planifie, qui porte "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
//    (secret du repo GitHub, jamais dans le code) : plage par defaut, tous les pools.
// 2) Le bouton "Recalculer" du commissaire dans l'UI, qui porte le jeton Supabase normal de
//    l'utilisateur connecte + { pool_id } dans le corps : on verifie que l'utilisateur est
//    bien commissaire de ce pool (RPC is_pool_commissioner, avec SON jeton, donc soumise a
//    RLS) avant de lancer la synchro, limitee a la fenetre de pointage du pool.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const providedToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const isServiceCaller = providedToken === serviceKey;

  let body: { from?: string; to?: string; pool_id?: string } = {};
  try { body = await req.json(); } catch { /* corps vide = plage par defaut */ }

  let fromDate = body.from;
  let toDate = body.to;

  if (!isServiceCaller) {
    if (!body.pool_id) return jsonResponse({ error: 'pool_id_required' }, 400);

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
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const todayEt = easternDateStr(new Date());
    toDate = toDate || todayEt;

    if (!fromDate) {
      // Par defaut (appel cron sans plage explicite) : hier + aujourd'hui, en remontant
      // jusqu'a la derniere date deja synchronisee si une execution a ete manquee.
      const yesterdayEt = addDaysStr(todayEt, -1);
      const { data: lastGame } = await supabase
        .from('nhl_games').select('game_date').order('game_date', { ascending: false }).limit(1).maybeSingle();
      fromDate = (lastGame?.game_date && lastGame.game_date < yesterdayEt) ? lastGame.game_date : yesterdayEt;
    }

    const summary = { gamesSynced: 0, errors: [] as string[] };
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
