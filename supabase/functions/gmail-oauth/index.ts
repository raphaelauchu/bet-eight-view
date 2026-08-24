// Edge Function: echange un code d'autorisation OAuth Google contre un
// access_token / refresh_token, puis les stocke dans user_email_connections
// pour l'utilisateur Supabase authentifie qui appelle la fonction.
//
// Secrets requis (Supabase Edge Functions > Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Fournis automatiquement par le runtime Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return jsonResponse({ error: 'code et redirect_uri requis' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Non authentifié' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identifie l'utilisateur a partir du JWT Supabase envoye par le client
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Utilisateur invalide' }, 401);
    }

    // Echange le code contre les tokens Google
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
      return jsonResponse({ error: tokenData.error_description || tokenData.error || 'Échange de token Google échoué' }, 400);
    }

    // Ecrit les tokens avec la service role (contourne RLS, fonction cote serveur)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: existing } = await supabaseAdmin
      .from('user_email_connections')
      .select('id, gmail_refresh_token')
      .eq('user_id', user.id)
      .single();

    // Google ne renvoie le refresh_token qu'au premier consentement (prompt=consent) :
    // on garde l'ancien si Google n'en renvoie pas un nouveau.
    const update = {
      user_id: user.id,
      gmail_token: tokenData.access_token,
      gmail_refresh_token: tokenData.refresh_token || existing?.gmail_refresh_token || null,
      actif: true,
    };

    if (existing?.id) {
      await supabaseAdmin.from('user_email_connections').update(update).eq('id', existing.id);
    } else {
      await supabaseAdmin.from('user_email_connections').insert(update);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
