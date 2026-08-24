// Edge Function: cherche le game_id NHL correspondant a deux equipes + une date,
// via l'API NHL schedule (appelee cote serveur, pas de contrainte CORS ici).
//
// Aucun secret requis. Reutilise l'auth partagee pour n'exposer ce lookup
// qu'aux utilisateurs Supabase authentifies de l'app.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const DIACRITICS_REGEX = new RegExp('[̀-ͯ]', 'g');

function normaliser(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .trim();
}

function equipeCorrespond(nomRecherche: string | null | undefined, team: any) {
  if (!nomRecherche || !team) return false;
  const n = normaliser(nomRecherche);
  if (!n) return false;
  const candidats = [team.abbrev, team.commonName?.default, team.teamName?.default, team.placeName?.default, team.name?.default]
    .filter(Boolean)
    .map((c: string) => normaliser(c));
  return candidats.some((c) => c.includes(n) || n.includes(c));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { equipe, adversaire, date_match } = await req.json();
    if (!date_match || (!equipe && !adversaire)) {
      return jsonResponse({ error: 'date_match et au moins une équipe sont requis' }, 400);
    }

    const auth = await getAuthenticatedUser(req);
    if (auth.error) return jsonResponse({ error: auth.error }, 401);

    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date_match}`);
    if (!res.ok) {
      return jsonResponse({ error: 'Échec de la requête NHL schedule' }, 502);
    }
    const data = await res.json();
    const games = data.gameWeek?.[0]?.games || [];

    // Priorite au match qui correspond aux deux equipes, sinon a une seule
    const matchComplet = games.find((g: any) =>
      (equipeCorrespond(equipe, g.awayTeam) || equipeCorrespond(equipe, g.homeTeam)) &&
      (!adversaire || equipeCorrespond(adversaire, g.awayTeam) || equipeCorrespond(adversaire, g.homeTeam))
    );
    const match = matchComplet || games.find((g: any) =>
      equipeCorrespond(equipe, g.awayTeam) || equipeCorrespond(equipe, g.homeTeam) ||
      equipeCorrespond(adversaire, g.awayTeam) || equipeCorrespond(adversaire, g.homeTeam)
    );

    return jsonResponse({ success: true, game_id: match?.id ?? null });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
