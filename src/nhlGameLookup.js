import { supabase } from './supabase';

// Cherche le game_id NHL correspondant, via la Edge Function nhl-game-lookup
// (evite les soucis CORS d'un appel direct a l'API NHL depuis le navigateur).
// Retourne null si non trouve ou en cas d'erreur — le lookup est une amelioration
// best-effort, pas une dependance bloquante pour l'import d'un bet.
export async function trouverGameId({ equipe, adversaire, dateMatch }) {
  if (!dateMatch || (!equipe && !adversaire)) return null;
  try {
    const { data, error } = await supabase.functions.invoke('nhl-game-lookup', {
      body: { equipe, adversaire, date_match: dateMatch },
    });
    if (error || data?.error) return null;
    return data.game_id ?? null;
  } catch {
    return null;
  }
}
