-- Contre-offres pour les echanges entre participants (ecran "Echanges" refait, cote client
-- src/PoolTrades.js). Audit prealable : pool_trades/pool_trade_items (20261108) supportent deja
-- plusieurs joueurs par offre (aucune limite au nombre de lignes pool_trade_items -- la limite
-- de 3 par cote est une contrainte d'interface, pas une contrainte de schema) ; en revanche
-- aucune colonne ne relie une offre a l'offre qu'elle contre, et le statut ('pending',
-- 'pending_commissioner', 'accepted', 'declined', 'cancelled', 'rejected') n'a pas de valeur
-- pour "contre-offerte". Cette migration ajoute les deux, de façon idempotente, et une RPC
-- dediee qui reutilise propose_trade (et donc TOUTES ses validations -- pool_trade_check,
-- proprietes, equilibre de poste, plafond salarial, maxPerSeason, noReacquire -- rien n'est
-- affaibli ni duplique) pour creer la contre-offre, puis marque l'originale "countered".
--
-- Rejouable sans effet si deja appliquee (add column if not exists, recreation du check
-- constraint via DROP IF EXISTS + ADD, create or replace function). Aucune offre existante
-- n'est modifiee : la nouvelle colonne est nullable et les anciens statuts restent valides
-- (le check constraint ajoute des valeurs, n'en retire aucune).

alter table pool_trades add column if not exists counter_of_trade_id uuid references pool_trades(id) on delete set null;

create index if not exists idx_pool_trades_counter_of on pool_trades(counter_of_trade_id);

-- Elargit le statut autorise : 'countered' (l'offre d'origine, une fois contre-offerte) et
-- 'expired' (reserve pour un futur mecanisme d'expiration -- aucun n'existe encore, cette
-- migration ne fabrique aucune logique d'expiration, seulement la valeur pour que l'UI puisse
-- l'afficher le jour ou un tel mecanisme sera ajoute). Le nom de contrainte auto-genere par
-- Postgres pour un check inline sur une seule colonne est toujours "<table>_<colonne>_check" ;
-- DROP IF EXISTS le cible explicitement, sans dependre de pg_constraint.
alter table pool_trades drop constraint if exists pool_trades_status_check;
alter table pool_trades add constraint pool_trades_status_check
  check (status in ('pending', 'pending_commissioner', 'accepted', 'declined', 'cancelled', 'rejected', 'countered', 'expired'));

-- ===================== RPC : contre-offre =====================
-- Seul le destinataire d'une offre encore 'pending' peut la contrer. p_gives/p_receives sont
-- DEJA du point de vue du contre-offrant (ce qu'il cede / ce qu'il recoit), comme pour
-- propose_trade -- le nouveau proposer_member_id de l'offre creee est donc le destinataire
-- original, et son recipient_member_id est le proposeur original (roles inverses).
create or replace function public.propose_counter_trade(
  p_original_trade_id uuid, p_gives jsonb, p_receives jsonb, p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_original pool_trades%rowtype;
  v_member_id uuid;
  v_new_trade_id uuid;
begin
  select * into v_original from pool_trades where id = p_original_trade_id;
  if v_original.id is null then raise exception 'trade_not_found'; end if;

  select id into v_member_id from pool_members where pool_id = v_original.pool_id and user_id = auth.uid();
  if v_member_id is null or v_member_id <> v_original.recipient_member_id then raise exception 'not_recipient'; end if;
  if v_original.status <> 'pending' then raise exception 'pool_trade_error_not_pending'; end if;

  -- propose_trade revalide tout (proprietaire courant, equilibre de poste, plafond, maxPerSeason,
  -- noReacquire...) a partir de auth.uid() -- qui est bien le destinataire original ici, devenu
  -- le proposeur de la contre-offre.
  v_new_trade_id := propose_trade(v_original.pool_id, v_original.proposer_member_id, p_gives, p_receives, p_message);

  update pool_trades set counter_of_trade_id = p_original_trade_id where id = v_new_trade_id;
  update pool_trades set status = 'countered', responded_at = now() where id = p_original_trade_id;

  return v_new_trade_id;
end;
$$;

revoke execute on function public.propose_counter_trade(uuid, jsonb, jsonb, text) from public;
grant execute on function public.propose_counter_trade(uuid, jsonb, jsonb, text) to authenticated;
