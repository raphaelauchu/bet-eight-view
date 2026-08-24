// Helpers partages par les Edge Functions d'echange OAuth email (gmail-oauth, outlook-oauth).
// Fournis automatiquement par le runtime Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export { getAuthenticatedUser } from './auth.ts';

export async function storeProviderTokens(
  userId: string,
  provider: 'gmail' | 'outlook',
  accessToken: string,
  refreshToken: string | null | undefined,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: existing } = await supabaseAdmin
    .from('user_email_connections')
    .select('id, refresh_token')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  // Certains providers (Google, Microsoft) ne renvoient le refresh_token qu'au premier
  // consentement : on garde l'ancien si le nouveau n'est pas fourni.
  const update = {
    user_id: userId,
    provider,
    access_token: accessToken,
    refresh_token: refreshToken || existing?.refresh_token || null,
    actif: true,
  };

  if (existing?.id) {
    await supabaseAdmin.from('user_email_connections').update(update).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('user_email_connections').insert(update);
  }
}
