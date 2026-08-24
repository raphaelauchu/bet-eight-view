// Edge Function: echange un code d'autorisation OAuth Microsoft contre un
// access_token / refresh_token, puis les stocke dans user_email_connections
// (provider='outlook') pour l'utilisateur Supabase authentifie qui appelle la fonction.
//
// Secrets requis (Supabase Edge Functions > Secrets): OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, storeProviderTokens } from '../_shared/emailConnections.ts';

const SCOPE = 'Mail.Read offline_access';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return jsonResponse({ error: 'code et redirect_uri requis' }, 400);
    }

    const auth = await getAuthenticatedUser(req);
    if (auth.error) return jsonResponse({ error: auth.error }, 401);

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('OUTLOOK_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('OUTLOOK_CLIENT_SECRET') ?? '',
        redirect_uri,
        grant_type: 'authorization_code',
        scope: SCOPE,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return jsonResponse({ error: tokenData.error_description || tokenData.error || 'Échange de token Microsoft échoué' }, 400);
    }

    await storeProviderTokens(auth.user.id, 'outlook', tokenData.access_token, tokenData.refresh_token);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
