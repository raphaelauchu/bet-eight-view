// Edge Function: envoie un screenshot de bookmaker a l'API Anthropic (vision)
// et retourne les infos de pari extraites en JSON.
//
// Secret requis (Supabase Edge Functions > Secrets): ANTHROPIC_API_KEY

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const PROMPT = "Analyse ce screenshot d'un bookmaker et extrait ces informations en JSON : bookmaker, joueur_ou_equipe, type_bet, stat_pariee, ligne, mise, cote, gain_potentiel. Si une information n'est pas visible, mets null. Réponds uniquement avec le JSON, sans texte autour.";

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
