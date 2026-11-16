// Edge Function: echange un code d'autorisation OAuth Google contre un
// access_token / refresh_token, puis les stocke dans user_email_connections
// (provider='gmail') pour l'utilisateur Supabase authentifie qui appelle la fonction.
//
// Secrets requis (Supabase Edge Functions > Secrets): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, storeProviderTokens } from '../_shared/emailConnections.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return jsonResponse(req, { error: 'code et redirect_uri requis' }, 400);
    }

    const auth = await getAuthenticatedUser(req);
    if (auth.error) return jsonResponse(req, { error: auth.error }, 401);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return jsonResponse(req, { error: tokenData.error_description || tokenData.error || 'Échange de token Google échoué' }, 400);
    }

    await storeProviderTokens(auth.user.id, 'gmail', tokenData.access_token, tokenData.refresh_token);

    return jsonResponse(req, { success: true });
  } catch (err) {
    return jsonResponse(req, { error: String(err) }, 500);
  }
});
