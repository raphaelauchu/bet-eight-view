// Edge Function: envoie un screenshot de bookmaker a l'API Anthropic (vision)
// et retourne les infos de pari extraites en JSON.
//
// Secret requis (Supabase Edge Functions > Secrets): ANTHROPIC_API_KEY

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const PROMPT = `Analyse ce screenshot d'un pari sportif (bookmaker) et extrait les informations suivantes en JSON strict, sans texte autour :

{
  "bookmaker": string ou null,
  "type_bet": "moneyline" | "total" | "prop" | "spread" | "parlay" ou null,
  "joueur_ou_equipe": string ou null,
  "equipe": string ou null,
  "adversaire": string ou null,
  "stat_pariee": string ou null,
  "ligne": number ou null,
  "over_under": "over" | "under" ou null,
  "mise": number ou null,
  "cote": number ou null,
  "gain_potentiel": number ou null,
  "date_match": "YYYY-MM-DD" ou null,
  "game_id": string ou null
}

Règles de détection par type de pari :
- Moneyline : le pari est sur une équipe qui gagne le match (ex: "Canadiens gagnent"). Mets type_bet="moneyline", remplis equipe (l'équipe pariée, celle qui est favorisée à gagner selon le pari) et adversaire (l'autre équipe).
- Prop joueur : le pari porte sur un joueur individuel (ex: "Lane Hutson +1.5 tirs", "Mark Stone à marquer un but"). Mets type_bet="prop", remplis joueur_ou_equipe avec le nom du joueur, stat_pariee (ex: tirs, buts, points, passes), ligne, et over_under si applicable.
- Total : le pari porte sur le nombre total de buts du match (over/under). Mets type_bet="total", remplis ligne et over_under.
- Si les deux équipes du match sont visibles (même si le pari n'est pas un moneyline), remplis toujours equipe et adversaire avec leurs noms.
- Si une date de match est visible, convertis-la en format YYYY-MM-DD dans date_match.
- Si un identifiant de match (game ID) est visible dans le screenshot, mets-le dans game_id.
- Si une information n'est pas visible ou ne s'applique pas, mets null.

Réponds uniquement avec l'objet JSON rempli, rien d'autre.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_base64, media_type } = await req.json();
    if (!image_base64 || !media_type) {
      return jsonResponse({ error: 'image_base64 et media_type requis' }, 400);
    }

    const auth = await getAuthenticatedUser(req);
    if (auth.error) return jsonResponse({ error: auth.error }, 401);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY n'est pas configurée sur cette fonction" }, 500);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ error: data.error?.message || 'Erreur API Claude' }, 400);
    }

    const texte = data.content?.[0]?.text || '';
    const jsonMatch = texte.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonResponse({ error: "Impossible d'extraire les informations de ce screenshot" }, 400);
    }

    const extrait = JSON.parse(jsonMatch[0]);
    return jsonResponse({ success: true, data: extrait });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
