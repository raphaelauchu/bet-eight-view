// Edge Function : proxy + cache serveur pour les cotes LNH de The Odds API.
//
// Avant cette fonction, src/cotes.js appelait api.the-odds-api.com directement depuis le
// navigateur a chaque montage de composant (cle API exposee cote client, aucune mutualisation
// des appels entre composants/utilisateurs). Cette fonction deplace l'appel cote serveur (cle
// ODDS_API_KEY jamais envoyee au client) et met le resultat en cache CACHE_TTL_MS dans la table
// partagee odds_cache (voir migration 20261118_2_odds_cache.sql), pour respecter le quota de
// la source quel que soit le nombre d'utilisateurs/composants qui demandent les cotes en meme
// temps.
//
// Authentification : verify_jwt par defaut (voir supabase/config.toml, pas d'override pour
// cette fonction) + getAuthenticatedUser, meme convention que nhl-game-lookup -- les cotes ne
// sont consommees que depuis l'app authentifiee (src/Analyses.js).

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'icehockey_nhl_h2h_spreads_totals_v1';
const ODDS_API_URL =
  'https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?regions=us,eu&markets=h2h,spreads,totals&bookmakers=bet365,betway,draftkings,fanduel';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) return jsonResponse(req, { error: auth.error }, 401);

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceKey || !supabaseUrl) {
      return jsonResponse(req, { error: 'service_role_key_unavailable' }, 500);
    }
    const supabaseService = createClient(supabaseUrl, serviceKey);

    const { data: cached } = await supabaseService
      .from('odds_cache')
      .select('payload, fetched_at')
      .eq('cache_key', CACHE_KEY)
      .maybeSingle();

    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
      return jsonResponse(req, { data: cached.payload, fetchedAt: cached.fetched_at, fromCache: true });
    }

    const apiKey = Deno.env.get('ODDS_API_KEY');
    if (!apiKey) return jsonResponse(req, { error: 'odds_api_key_unavailable' }, 500);

    const res = await fetch(`${ODDS_API_URL}&apiKey=${apiKey}`);
    if (!res.ok) {
      // Echec de la source (quota depasse, panne...) : on retourne le cache existant si
      // disponible plutot qu'une erreur seche, sinon un tableau vide (jamais de cote inventee).
      if (cached) return jsonResponse(req, { data: cached.payload, fetchedAt: cached.fetched_at, fromCache: true, stale: true });
      return jsonResponse(req, { data: [], fetchedAt: new Date().toISOString(), error: 'odds_api_unavailable' });
    }
    const data = await res.json();
    const fetchedAt = new Date().toISOString();

    await supabaseService.from('odds_cache').upsert({ cache_key: CACHE_KEY, payload: data, fetched_at: fetchedAt });

    return jsonResponse(req, { data, fetchedAt, fromCache: false });
  } catch (err) {
    return jsonResponse(req, { error: String(err) }, 500);
  }
});
