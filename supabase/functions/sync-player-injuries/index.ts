// Edge Function : synchronise la table partagee player_injuries (badge "croix rouge" de la
// Vue vestiaire des pools, voir src/PoolLockerRoom.js) a partir de l'endpoint public ESPN
// "site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries" (gratuit, sans cle -- non
// documente officiellement par ESPN, mais stable et largement utilise par la communaute ;
// aucune source NHL officielle equivalente n'existe a ce jour -- voir l'audit dans le resume
// de la tache qui a introduit ce fichier).
//
// ESPN n'utilise pas les ids joueur NHL (api-web.nhle.com) : chaque blessure est donc
// rapprochee du roster NHL officiel par NOM NORMALISE + EQUIPE (le roster NHL est la source
// d'autorite pour le player_id). Si aucune correspondance exacte n'est trouvee pour un nom,
// la ligne est ignoree -- JAMAIS de blessure ecrite pour une correspondance incertaine (voir
// consigne "ne jamais fabriquer une blessure").
//
// Authentification : meme convention que sync-nhl-stats -- en-tete "x-sync-secret" compare a
// temps constant a la variable d'environnement SYNC_CRON_SECRET de la fonction (verify_jwt
// desactive pour cette fonction dans supabase/config.toml). Ecritures via le client
// service_role (contourne RLS, en lecture seule pour les clients normaux -- voir migration
// 20261112_player_injuries.sql).

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ESPN_INJURIES_URL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';
const NHL_BASE = 'https://api-web.nhle.com/v1';

// Nom d'equipe ESPN (displayName) -> abbreviation NHL officielle (memes 32 equipes que
// LOGOS_NHL dans src/Analyses.js). Table de reference statique, pas une donnee de blessure.
const ESPN_TEAM_NAME_TO_ABBREV: Record<string, string> = {
  'Anaheim Ducks': 'ANA', 'Boston Bruins': 'BOS', 'Buffalo Sabres': 'BUF',
  'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR', 'Chicago Blackhawks': 'CHI',
  'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ', 'Dallas Stars': 'DAL',
  'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM', 'Florida Panthers': 'FLA',
  'Los Angeles Kings': 'LAK', 'Minnesota Wild': 'MIN', 'Montreal Canadiens': 'MTL',
  'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJD', 'New York Islanders': 'NYI',
  'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT', 'Philadelphia Flyers': 'PHI',
  'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJS', 'Seattle Kraken': 'SEA',
  'St. Louis Blues': 'STL', 'Tampa Bay Lightning': 'TBL', 'Toronto Maple Leafs': 'TOR',
  'Utah Mammoth': 'UTA', 'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK',
  'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG',
};

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

// Normalise un nom pour comparaison robuste aux variations de ponctuation entre fournisseurs
// (ex. "A.J. Greer" cote ESPN vs "AJ Greer" cote NHL) : minuscules, accents retires, tout
// caractere non alphanumerique supprime.
function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

type RosterEntry = { id: string; name: string };

async function fetchNhlRosterNames(abbrev: string): Promise<RosterEntry[]> {
  try {
    const data = await fetchJson(`${NHL_BASE}/roster/${abbrev}/current`);
    const groups = [...(data.forwards || []), ...(data.defensemen || []), ...(data.goalies || [])];
    return groups.map((p: any) => ({
      id: String(p.id),
      name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
    }));
  } catch {
    return []; // equipe injoignable cette fois-ci : ses blessures seront simplement ignorees, jamais devinees
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('SYNC_CRON_SECRET');
  const providedSecret = req.headers.get('x-sync-secret') || '';

  if (!cronSecret || !providedSecret || !timingSafeEqual(providedSecret, cronSecret)) {
    return jsonResponse(req, { error: 'unauthorized' }, 401);
  }
  if (!serviceKey) return jsonResponse(req, { error: 'service_role_key_unavailable' }, 500);

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const espnData = await fetchJson(ESPN_INJURIES_URL);
    const teams: any[] = espnData.injuries || [];

    const rosterCache = new Map<string, RosterEntry[]>();
    const matched: { player_id: string; player_name: string; team_abbrev: string; status: string; description: string | null }[] = [];
    let unmatchedCount = 0;

    for (const team of teams) {
      const abbrev = ESPN_TEAM_NAME_TO_ABBREV[team.displayName];
      if (!abbrev) continue; // equipe ESPN non reconnue : jamais de correspondance au hasard

      if (!rosterCache.has(abbrev)) rosterCache.set(abbrev, await fetchNhlRosterNames(abbrev));
      const roster = rosterCache.get(abbrev) || [];

      for (const injury of team.injuries || []) {
        const athlete = injury.athlete;
        const fullName = athlete?.displayName || `${athlete?.firstName || ''} ${athlete?.lastName || ''}`.trim();
        if (!fullName) continue;
        const normalized = normalizeName(fullName);
        const found = roster.find((r) => normalizeName(r.name) === normalized);
        if (!found) { unmatchedCount++; continue; } // pas de correspondance certaine : on ignore, jamais de supposition

        matched.push({
          player_id: found.id,
          player_name: fullName,
          team_abbrev: abbrev,
          status: injury.status || 'Injured',
          description: injury.shortComment || injury.longComment || null,
        });
      }
    }

    // Rafraichissement complet : une blessure resolue (plus listee par ESPN) doit disparaitre,
    // jamais rester affichee indefiniment par defaut de mise a jour.
    const { error: delErr } = await supabase.from('player_injuries').delete().neq('player_id', '');
    if (delErr) throw new Error(`delete: ${delErr.message}`);

    if (matched.length > 0) {
      const rows = matched.map((m) => ({ ...m, updated_at: new Date().toISOString() }));
      const { error: insErr } = await supabase.from('player_injuries').upsert(rows, { onConflict: 'player_id' });
      if (insErr) throw new Error(`upsert: ${insErr.message}`);
    }

    return jsonResponse(req, { success: true, teamsProcessed: teams.length, matched: matched.length, unmatched: unmatchedCount });
  } catch (err) {
    return jsonResponse(req, { error: String((err as Error)?.message || err) }, 500);
  }
});
