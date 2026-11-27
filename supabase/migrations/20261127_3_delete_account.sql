-- ===================== Suppression de compte (Loi 25, droit a l'effacement) =====================
-- RPC public.delete_my_account() -- bouton "Supprimer mon compte" (src/ProfileSettings.js /
-- src/DeleteAccountModal.js). security definer : necessaire pour supprimer des lignes dans des
-- tables dont aucune policy RLS DELETE n'existe cote client (profiles, bets_auto,
-- user_email_connections...) et pour supprimer la ligne auth.users elle-meme, jamais accessible
-- au role authenticated. `auth.uid()` reste la SEULE source de l'identite a supprimer -- cette
-- fonction ne prend AUCUN parametre d'id, impossible de l'appeler pour supprimer un autre compte.
--
-- ===================== Audit des tables contenant des donnees utilisateur =====================
-- (supabase/migrations/*.sql, cles etrangeres et regles ON DELETE -- voir aussi
-- src/*.js:supabase.from(...) pour la liste complete des tables reellement utilisees)
--
-- DEJA "on delete cascade" depuis auth.users(id) -- rien a faire ici, la derniere ligne de cette
-- fonction (delete from auth.users) les supprime automatiquement :
--   bankroll_accounts, bankroll_transactions (20261121_bankroll_accounts.sql)
--   watchlist_items, saved_picks (20261111_watchlist_saved_picks.sql)
--   sportsbook_waitlist (20261119_sportsbook_waitlist.sql)
--   pool_members (20261030_pools_foundation.sql) -- et tout ce qui en depend via member_id
--     "on delete cascade" (pool_picks, pool_roster_periods, pool_lineup_periods, pool_trades,
--     pool_trade_items, pool_transactions, pool_waiver_claims, pool_dropped_players) ou via
--     pool_id une fois le pool lui-meme supprime (voir le traitement special des pools ci-dessous)
--   pools.owner_id "on delete cascade" -- MAIS traite explicitement plus bas (transfert de
--     propriete) plutot que de laisser la cascade detruire les donnees des AUTRES membres
--
-- SANS cascade (colonne `user_id uuid references auth.users(id)` SANS "on delete cascade", voir
-- 20260823_email_parsing_bets_auto.sql) -- supprimees EXPLICITEMENT ci-dessous, sinon le DELETE
-- FROM auth.users final echouerait (violation de cle etrangere) :
--   user_email_connections, bets_auto, email_parsing_logs
--
-- Tables creees HORS de ce dossier de migrations (dashboard Supabase, meme cas que `profiles` --
-- voir le commentaire de 20261119_2_profiles_is_admin.sql) : leur regle ON DELETE exacte n'est
-- pas verifiable depuis les fichiers SQL versionnes ici -- supprimees explicitement par precaution
-- (une suppression sur une ligne deja absente/dejà cascadee ne fait rien, sans danger) :
--   profiles, paris
--
-- PAS de donnees utilisateur (donnees de reference publiques/partagees, aucune colonne
-- user_id/owner_id/created_by) -- volontairement non touchees : odds_cache, player_injuries,
-- nhl_games, nhl_player_game_stats, nhl_team_game_results.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pool record;
  v_new_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- ===================== Pools dont l'utilisateur est le createur =====================
  -- Transfert de propriete au membre le plus ancien (pool_members.joined_at le plus petit) s'il
  -- en existe un autre -- jamais detruire les donnees des AUTRES membres (picks, alignements,
  -- echanges, transactions...) juste parce que le createur supprime son compte. Aucun autre
  -- membre : rien a preserver, le pool est supprime (cascade vers pool_members/picks/etc, tous
  -- deja "on delete cascade" depuis pools/pool_members). is_pool_commissioner() (voir
  -- 20261030_pools_foundation.sql) verifie pool_members.role = 'commissioner', PAS pools.owner_id
  -- -- les deux colonnes doivent donc etre mises a jour ENSEMBLE pour que le nouveau proprietaire
  -- ait reellement les droits de commissaire, pas seulement la mention owner_id.
  for v_pool in select id from pools where owner_id = v_uid loop
    select user_id into v_new_owner
    from pool_members
    where pool_id = v_pool.id and user_id <> v_uid
    order by joined_at asc
    limit 1;

    if v_new_owner is not null then
      update pools set owner_id = v_new_owner where id = v_pool.id;
      update pool_members set role = 'commissioner' where pool_id = v_pool.id and user_id = v_new_owner;
    else
      delete from pools where id = v_pool.id;
    end if;
  end loop;

  -- ===================== Tables sans cascade (voir l'audit plus haut) =====================
  delete from email_parsing_logs where user_id = v_uid;
  delete from bets_auto where user_id = v_uid;
  delete from user_email_connections where user_id = v_uid;

  -- ===================== Tables creees hors migrations, cascade non verifiable =====================
  delete from paris where user_id = v_uid;
  delete from profiles where id = v_uid;

  -- Tout le reste (bankroll_accounts/bankroll_transactions, watchlist_items, saved_picks,
  -- sportsbook_waitlist, pool_members restants et ce qui en depend) est supprime automatiquement
  -- par la cascade verifiee depuis auth.users.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ===================== Filet de securite cote base de donnees : age minimum absolu =====================
-- La verification d'age de src/ProfileSetup.js (18 a 21 ans selon la region, voir
-- src/profileConfig.js) reste contournable cote client (requete API directe) -- cette contrainte
-- impose un PLANCHER absolu de 18 ans quelle que soit la region, en dernier recours. Idempotente
-- (nom de contrainte explicite, drop if exists avant de la recreer).
alter table profiles drop constraint if exists profiles_birth_date_min_age;
alter table profiles add constraint profiles_birth_date_min_age
  check (birth_date is null or birth_date <= (current_date - interval '18 years')::date);
