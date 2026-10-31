-- Phase 4A : echanges et agents libres (ballotage).
--
-- Principe central : pool_picks reste le journal IMMUABLE du draft (jamais modifie par un
-- echange ou un ajout/abandon). La propriete COURANTE (et son historique) vit entierement
-- dans pool_roster_periods, desormais enrichie des memes champs descriptifs que pool_picks
-- (player_name/pos_group/nhl_team/salary) pour que le classement et les fiches de
-- participant puissent se construire SANS jamais relire pool_picks -- ce qui est
-- indispensable pour les agents libres ajoutes en cours de saison, qui n'ont pas de ligne
-- dans pool_picks (ils n'ont jamais ete repeches).
--
-- pool_scored_events (20261104) attribue deja les points en fonction de prp.from_at/to_at :
-- aucune modification n'est necessaire a cette fonction pour que "les points restent a
-- l'ancien proprietaire pour sa periode" -- il suffit que l'execution d'un echange ferme/ouvre
-- les periodes au bon moment (voir execute_trade plus bas). C'est deja exactement le
-- comportement implemente depuis la Phase 3.

-- ===================== pool_roster_periods : enrichissement =====================

alter table pool_roster_periods add column if not exists player_name text;
alter table pool_roster_periods add column if not exists pos_group text check (pos_group in ('F', 'D', 'G', 'TEAM'));
alter table pool_roster_periods add column if not exists nhl_team text;
alter table pool_roster_periods add column if not exists salary numeric;
alter table pool_roster_periods add column if not exists closed_reason text check (closed_reason in ('trade', 'drop'));

-- Backfill des periodes deja creees par le draft (avant cette migration), qui n'avaient pas
-- ces colonnes : on les retrouve via pool_picks (encore valide a ce moment, puisqu'aucune
-- periode anterieure a cette migration n'a pu provenir d'un echange/ajout).
update pool_roster_periods prp
set player_name = pp.player_name, pos_group = pp.position, nhl_team = pp.nhl_team, salary = pp.salary
from pool_picks pp
where pp.pool_id = prp.pool_id and pp.kind = prp.kind and pp.player_id = prp.player_id
  and prp.player_name is null;

create index if not exists idx_pool_roster_periods_open on pool_roster_periods(pool_id, kind, player_id) where to_at is null;

-- advance_draft_pick (20261104) : copie desormais aussi les champs descriptifs dans les
-- periodes semees a la fin du draft. Signature et type de retour inchanges (returns void) :
-- create or replace suffit, aucun drop necessaire.
create or replace function public.advance_draft_pick(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_next_pick int;
  v_seconds int;
  v_scoring_start timestamptz;
begin
  select * into v_pool from pools where id = p_pool_id;
  v_next_pick := coalesce((v_pool.draft_state->>'current_pick')::int, 0) + 1;
  if v_next_pick > coalesce((v_pool.draft_state->>'total_picks')::int, 0) then
    v_scoring_start := coalesce(v_pool.scoring_start_at, now());
    update pools set status = 'active',
      scoring_start_at = v_scoring_start,
      draft_state = draft_state || jsonb_build_object('current_pick', v_next_pick, 'pick_deadline', null)
    where id = p_pool_id;

    insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, nhl_team, salary, from_at, to_at)
    select pp.pool_id, pp.member_id, pp.kind, pp.player_id, pp.player_name, pp.position, pp.nhl_team, pp.salary, v_scoring_start, null
    from pool_picks pp
    where pp.pool_id = p_pool_id
      and not exists (
        select 1 from pool_roster_periods prp
        where prp.pool_id = pp.pool_id and prp.member_id = pp.member_id
          and prp.kind = pp.kind and prp.player_id = pp.player_id
      );
  else
    v_seconds := coalesce((v_pool.rules->'draft'->>'secondsPerPick')::int, 60);
    update pools set
      draft_state = draft_state || jsonb_build_object('current_pick', v_next_pick, 'pick_deadline', to_jsonb(now() + (v_seconds || ' seconds')::interval))
    where id = p_pool_id;
  end if;
end;
$$;

revoke execute on function public.advance_draft_pick(uuid) from public;

-- ===================== Tables : echanges =====================

create table if not exists pool_trades (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  proposer_member_id uuid not null references pool_members(id) on delete cascade,
  recipient_member_id uuid not null references pool_members(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'pending_commissioner', 'accepted', 'declined', 'cancelled', 'rejected')),
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  reviewed_by uuid,
  executed_at timestamptz
);

create index if not exists idx_pool_trades_pool on pool_trades(pool_id);
create index if not exists idx_pool_trades_recipient on pool_trades(recipient_member_id, status);
create index if not exists idx_pool_trades_proposer on pool_trades(proposer_member_id, status);

alter table pool_trades enable row level security;
drop policy if exists "pool_trades_select_same_pool" on pool_trades;
create policy "pool_trades_select_same_pool" on pool_trades
  for select using (is_pool_member(pool_id));

create table if not exists pool_trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references pool_trades(id) on delete cascade,
  from_member_id uuid not null references pool_members(id) on delete cascade,
  to_member_id uuid not null references pool_members(id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  player_id text not null,
  player_name text not null,
  position text not null check (position in ('F', 'D', 'G', 'TEAM')),
  nhl_team text,
  salary numeric
);

create index if not exists idx_pool_trade_items_trade on pool_trade_items(trade_id);

alter table pool_trade_items enable row level security;
drop policy if exists "pool_trade_items_select_same_pool" on pool_trade_items;
create policy "pool_trade_items_select_same_pool" on pool_trade_items
  for select using (is_pool_member((select t.pool_id from pool_trades t where t.id = trade_id)));

-- ===================== Table : journal des transactions =====================

create table if not exists pool_transactions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  member_id uuid not null references pool_members(id) on delete cascade,
  type text not null check (type in ('trade', 'add', 'drop')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_transactions_pool on pool_transactions(pool_id, created_at desc);
create index if not exists idx_pool_transactions_member on pool_transactions(member_id);

alter table pool_transactions enable row level security;
drop policy if exists "pool_transactions_select_same_pool" on pool_transactions;
create policy "pool_transactions_select_same_pool" on pool_transactions
  for select using (is_pool_member(pool_id));

-- ===================== Tables : ballotage =====================

create table if not exists pool_waiver_claims (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  member_id uuid not null references pool_members(id) on delete cascade,
  add_player_id text not null,
  add_kind text not null check (add_kind in ('player', 'team')),
  add_player_name text not null,
  add_position text not null check (add_position in ('F', 'D', 'G', 'TEAM')),
  add_nhl_team text,
  add_salary numeric,
  drop_player_id text,
  drop_kind text default 'player' check (drop_kind in ('player', 'team')),
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'cancelled')),
  created_at timestamptz not null default now(),
  process_at timestamptz not null default now()
);

create index if not exists idx_pool_waiver_claims_pending on pool_waiver_claims(pool_id, add_kind, add_player_id, status);
create index if not exists idx_pool_waiver_claims_member on pool_waiver_claims(member_id);

alter table pool_waiver_claims enable row level security;
drop policy if exists "pool_waiver_claims_select_same_pool" on pool_waiver_claims;
create policy "pool_waiver_claims_select_same_pool" on pool_waiver_claims
  for select using (is_pool_member(pool_id));

create table if not exists pool_dropped_players (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  player_id text not null,
  dropped_by_member_id uuid not null references pool_members(id) on delete cascade,
  dropped_at timestamptz not null default now(),
  available_at timestamptz not null default now()
);

create index if not exists idx_pool_dropped_players_lookup on pool_dropped_players(pool_id, kind, player_id);
create index if not exists idx_pool_dropped_players_member on pool_dropped_players(dropped_by_member_id);

alter table pool_dropped_players enable row level security;
drop policy if exists "pool_dropped_players_select_same_pool" on pool_dropped_players;
create policy "pool_dropped_players_select_same_pool" on pool_dropped_players
  for select using (is_pool_member(pool_id));

-- ===================== Temps reel =====================

alter table pool_trades replica identity full;
alter table pool_transactions replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pool_trades') then
    alter publication supabase_realtime add table pool_trades;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pool_transactions') then
    alter publication supabase_realtime add table pool_transactions;
  end if;
end $$;

-- ===================== Helpers internes (pas de grant a authenticated) =====================

create or replace function public.pool_item_owner(p_pool_id uuid, p_kind text, p_player_id text)
returns uuid
language sql
stable
set search_path = public
as $$
  select member_id from pool_roster_periods
  where pool_id = p_pool_id and kind = p_kind and player_id = p_player_id and to_at is null
  limit 1;
$$;

revoke execute on function public.pool_item_owner(uuid, text, text) from public;

create or replace function public.pool_member_salary_total(p_pool_id uuid, p_member_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(salary), 0) from pool_roster_periods
  where pool_id = p_pool_id and member_id = p_member_id and to_at is null;
$$;

revoke execute on function public.pool_member_salary_total(uuid, uuid) from public;

create or replace function public.pool_member_active_count(p_pool_id uuid, p_member_id uuid, p_pos_group text)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int from pool_roster_periods
  where pool_id = p_pool_id and member_id = p_member_id and pos_group = p_pos_group and to_at is null;
$$;

revoke execute on function public.pool_member_active_count(uuid, uuid, text) from public;

-- Classement interne (rang par total de points), SANS la verification is_pool_member de
-- get_pool_standings : appelee depuis process_waivers, execute en contexte service_role sans
-- auth.uid() -- la verification d'appartenance reste de toute facon inutile ici puisque cette
-- fonction n'est jamais exposee au client (aucun grant a authenticated).
create or replace function public.pool_standings_rank_internal(p_pool_id uuid)
returns table (member_id uuid, rnk int)
language sql
stable
set search_path = public
as $$
  select pm.id, rank() over (order by coalesce(sum(ev.points), 0) desc)::int
  from pool_members pm
  left join pool_scored_events(p_pool_id) ev on ev.member_id = pm.id
  where pm.pool_id = p_pool_id
  group by pm.id;
$$;

revoke execute on function public.pool_standings_rank_internal(uuid) from public;

-- Validation complete d'un echange (ownership courante, equilibre par poste, limite par
-- saison, interdiction de reprise, plafond salarial) : renvoie le PREMIER code d'erreur
-- rencontre (ou null si valide). Les codes renvoyes sont EXACTEMENT ceux produits par
-- validateTrade() cote JS (src/poolRules.js) pour que l'apercu d'interface et la validation
-- serveur affichent toujours le meme message, que l'appel vienne de propose_trade (premiere
-- validation) ou d'execute_trade (revalidation au moment d'executer, car les rosters/plafonds
-- peuvent avoir change entre la proposition et l'acceptation).
-- p_gives / p_receives : jsonb array de {"kind","player_id","position","salary"}.
create or replace function public.pool_trade_check(
  p_pool_id uuid, p_proposer_member_id uuid, p_recipient_member_id uuid, p_gives jsonb, p_receives jsonb
)
returns text
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_rules jsonb;
  v_cap_enabled boolean;
  v_cap_amount numeric;
  v_balance boolean;
  v_max_per_season int;
  v_no_reacquire boolean;
  v_item jsonb;
  v_counts_a jsonb := '{}'::jsonb;
  v_counts_b jsonb := '{}'::jsonb;
  v_pos text;
  v_count_a int;
  v_count_b int;
  v_keys text[];
  v_k text;
  v_trades_a int;
  v_trades_b int;
  v_salary_a numeric;
  v_salary_b numeric;
begin
  select rules into v_rules from pools where id = p_pool_id;
  v_cap_enabled := coalesce((v_rules->'salaryCap'->>'enabled')::boolean, false);
  v_cap_amount := coalesce((v_rules->'salaryCap'->>'amount')::numeric, 0);
  v_balance := coalesce((v_rules->'trades'->>'balanceByPosition')::boolean, true);
  v_max_per_season := (v_rules->'trades'->>'maxPerSeason')::int;
  v_no_reacquire := coalesce((v_rules->'trades'->>'noReacquire')::boolean, true);

  for v_item in select * from jsonb_array_elements(p_gives) loop
    if not exists (
      select 1 from pool_roster_periods prp
      where prp.pool_id = p_pool_id and prp.member_id = p_proposer_member_id
        and prp.kind = v_item->>'kind' and prp.player_id = v_item->>'player_id' and prp.to_at is null
    ) then
      return 'pool_trade_error_invalid_ownership';
    end if;
  end loop;
  for v_item in select * from jsonb_array_elements(p_receives) loop
    if not exists (
      select 1 from pool_roster_periods prp
      where prp.pool_id = p_pool_id and prp.member_id = p_recipient_member_id
        and prp.kind = v_item->>'kind' and prp.player_id = v_item->>'player_id' and prp.to_at is null
    ) then
      return 'pool_trade_error_invalid_ownership';
    end if;
  end loop;

  if v_balance then
    for v_item in select * from jsonb_array_elements(p_gives) loop
      v_pos := v_item->>'position';
      v_counts_a := jsonb_set(v_counts_a, array[v_pos], to_jsonb(coalesce((v_counts_a->>v_pos)::int, 0) + 1));
    end loop;
    for v_item in select * from jsonb_array_elements(p_receives) loop
      v_pos := v_item->>'position';
      v_counts_b := jsonb_set(v_counts_b, array[v_pos], to_jsonb(coalesce((v_counts_b->>v_pos)::int, 0) + 1));
    end loop;
    select array_agg(distinct k) into v_keys
    from (
      select jsonb_object_keys(v_counts_a) as k
      union
      select jsonb_object_keys(v_counts_b) as k
    ) u;
    if v_keys is not null then
      foreach v_k in array v_keys loop
        v_count_a := coalesce((v_counts_a->>v_k)::int, 0);
        v_count_b := coalesce((v_counts_b->>v_k)::int, 0);
        if v_count_a <> v_count_b then
          return 'pool_trade_error_position_imbalance';
        end if;
      end loop;
    end if;
  end if;

  if v_max_per_season is not null then
    select count(*) into v_trades_a from pool_trades t
    where t.pool_id = p_pool_id and t.status = 'accepted'
      and (t.proposer_member_id = p_proposer_member_id or t.recipient_member_id = p_proposer_member_id);
    select count(*) into v_trades_b from pool_trades t
    where t.pool_id = p_pool_id and t.status = 'accepted'
      and (t.proposer_member_id = p_recipient_member_id or t.recipient_member_id = p_recipient_member_id);
    if v_trades_a + 1 > v_max_per_season then return 'pool_trade_error_max_per_season_a'; end if;
    if v_trades_b + 1 > v_max_per_season then return 'pool_trade_error_max_per_season_b'; end if;
  end if;

  if v_no_reacquire then
    for v_item in select * from jsonb_array_elements(p_receives) loop
      if exists (
        select 1 from pool_trade_items ti join pool_trades t on t.id = ti.trade_id
        where t.pool_id = p_pool_id and t.status = 'accepted' and ti.from_member_id = p_proposer_member_id
          and ti.kind = v_item->>'kind' and ti.player_id = v_item->>'player_id'
      ) then
        return 'pool_trade_error_no_reacquire_a';
      end if;
    end loop;
    for v_item in select * from jsonb_array_elements(p_gives) loop
      if exists (
        select 1 from pool_trade_items ti join pool_trades t on t.id = ti.trade_id
        where t.pool_id = p_pool_id and t.status = 'accepted' and ti.from_member_id = p_recipient_member_id
          and ti.kind = v_item->>'kind' and ti.player_id = v_item->>'player_id'
      ) then
        return 'pool_trade_error_no_reacquire_b';
      end if;
    end loop;
  end if;

  if v_cap_enabled then
    select coalesce(sum((v->>'salary')::numeric), 0) into v_salary_a from jsonb_array_elements(p_gives) v;
    select coalesce(sum((v->>'salary')::numeric), 0) into v_salary_b from jsonb_array_elements(p_receives) v;
    if pool_member_salary_total(p_pool_id, p_proposer_member_id) - v_salary_a + v_salary_b > v_cap_amount then
      return 'pool_trade_error_salary_cap_a';
    end if;
    if pool_member_salary_total(p_pool_id, p_recipient_member_id) - v_salary_b + v_salary_a > v_cap_amount then
      return 'pool_trade_error_salary_cap_b';
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.pool_trade_check(uuid, uuid, uuid, jsonb, jsonb) from public;

-- ===================== RPC interne : execution d'un echange =====================
-- tradeDayPoints = 'nobody' (seule valeur supportee, cf. poolRules.js) : la periode de
-- l'ancien proprietaire se ferme au DEBUT du jour de l'echange (fuseau America/Toronto) et
-- celle du nouveau proprietaire s'ouvre au debut du jour SUIVANT -- les matchs du jour meme
-- ne comptent pour personne. pool_scored_events (inchangee) applique cette fenetre
-- automatiquement via from_at/to_at, sans aucune modification de sa part.

create or replace function public.execute_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_trade pool_trades%rowtype;
  v_gives jsonb;
  v_receives jsonb;
  v_today date;
  v_close_at timestamptz;
  v_open_at timestamptz;
  v_item record;
  v_err text;
  v_n int;
begin
  select * into v_trade from pool_trades where id = p_trade_id;
  if v_trade.id is null then raise exception 'trade_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('kind', ti.kind, 'player_id', ti.player_id, 'position', ti.position, 'salary', ti.salary)), '[]'::jsonb)
    into v_gives from pool_trade_items ti where ti.trade_id = p_trade_id and ti.from_member_id = v_trade.proposer_member_id;
  select coalesce(jsonb_agg(jsonb_build_object('kind', ti.kind, 'player_id', ti.player_id, 'position', ti.position, 'salary', ti.salary)), '[]'::jsonb)
    into v_receives from pool_trade_items ti where ti.trade_id = p_trade_id and ti.from_member_id = v_trade.recipient_member_id;

  v_err := pool_trade_check(v_trade.pool_id, v_trade.proposer_member_id, v_trade.recipient_member_id, v_gives, v_receives);
  if v_err is not null then raise exception '%', v_err; end if;

  v_today := (now() at time zone 'America/Toronto')::date;
  v_close_at := v_today::timestamp at time zone 'America/Toronto';
  v_open_at := (v_today + 1)::timestamp at time zone 'America/Toronto';

  for v_item in select * from pool_trade_items ti where ti.trade_id = p_trade_id loop
    update pool_roster_periods set to_at = v_close_at, closed_reason = 'trade'
    where pool_id = v_trade.pool_id and member_id = v_item.from_member_id
      and kind = v_item.kind and player_id = v_item.player_id and to_at is null;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'pool_trade_error_invalid_ownership'; end if;

    insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, nhl_team, salary, from_at, to_at)
    values (v_trade.pool_id, v_item.to_member_id, v_item.kind, v_item.player_id, v_item.player_name, v_item.position, v_item.nhl_team, v_item.salary, v_open_at, null);
  end loop;

  insert into pool_transactions (pool_id, member_id, type, details)
  values
    (v_trade.pool_id, v_trade.proposer_member_id, 'trade', jsonb_build_object('trade_id', p_trade_id, 'gives', v_gives, 'receives', v_receives)),
    (v_trade.pool_id, v_trade.recipient_member_id, 'trade', jsonb_build_object('trade_id', p_trade_id, 'gives', v_receives, 'receives', v_gives));

  update pool_trades set status = 'accepted', executed_at = now() where id = p_trade_id;
end;
$$;

revoke execute on function public.execute_trade(uuid) from public;

-- ===================== RPC : proposer un echange =====================

create or replace function public.propose_trade(p_pool_id uuid, p_to_member_id uuid, p_gives jsonb, p_receives jsonb, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_proposer_id uuid;
  v_item jsonb;
  v_resolved_gives jsonb := '[]'::jsonb;
  v_resolved_receives jsonb := '[]'::jsonb;
  v_err text;
  v_trade_id uuid;
  v_prp record;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'active' then raise exception 'pool_not_active'; end if;
  if not coalesce((v_pool.rules->'trades'->>'enabled')::boolean, false) then raise exception 'pool_trade_error_disabled'; end if;

  select id into v_proposer_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_proposer_id is null then raise exception 'not_a_member'; end if;
  if p_to_member_id = v_proposer_id then raise exception 'pool_trade_error_self'; end if;
  if not exists (select 1 from pool_members where id = p_to_member_id and pool_id = p_pool_id) then
    raise exception 'member_not_in_pool';
  end if;

  if jsonb_array_length(coalesce(p_gives, '[]'::jsonb)) = 0 or jsonb_array_length(coalesce(p_receives, '[]'::jsonb)) = 0 then
    raise exception 'pool_trade_error_empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_gives) loop
    select * into v_prp from pool_roster_periods
    where pool_id = p_pool_id and member_id = v_proposer_id
      and kind = v_item->>'kind' and player_id = v_item->>'player_id' and to_at is null;
    if v_prp.id is null then raise exception 'pool_trade_error_invalid_ownership'; end if;
    v_resolved_gives := v_resolved_gives || jsonb_build_object(
      'kind', v_prp.kind, 'player_id', v_prp.player_id, 'player_name', v_prp.player_name,
      'position', v_prp.pos_group, 'nhl_team', v_prp.nhl_team, 'salary', v_prp.salary
    );
  end loop;

  for v_item in select * from jsonb_array_elements(p_receives) loop
    select * into v_prp from pool_roster_periods
    where pool_id = p_pool_id and member_id = p_to_member_id
      and kind = v_item->>'kind' and player_id = v_item->>'player_id' and to_at is null;
    if v_prp.id is null then raise exception 'pool_trade_error_invalid_ownership'; end if;
    v_resolved_receives := v_resolved_receives || jsonb_build_object(
      'kind', v_prp.kind, 'player_id', v_prp.player_id, 'player_name', v_prp.player_name,
      'position', v_prp.pos_group, 'nhl_team', v_prp.nhl_team, 'salary', v_prp.salary
    );
  end loop;

  v_err := pool_trade_check(p_pool_id, v_proposer_id, p_to_member_id, v_resolved_gives, v_resolved_receives);
  if v_err is not null then raise exception '%', v_err; end if;

  insert into pool_trades (pool_id, proposer_member_id, recipient_member_id, status, message)
  values (p_pool_id, v_proposer_id, p_to_member_id, 'pending', p_message)
  returning id into v_trade_id;

  insert into pool_trade_items (trade_id, from_member_id, to_member_id, kind, player_id, player_name, position, nhl_team, salary)
  select v_trade_id, v_proposer_id, p_to_member_id, x->>'kind', x->>'player_id', x->>'player_name', x->>'position', x->>'nhl_team', (x->>'salary')::numeric
  from jsonb_array_elements(v_resolved_gives) x;

  insert into pool_trade_items (trade_id, from_member_id, to_member_id, kind, player_id, player_name, position, nhl_team, salary)
  select v_trade_id, p_to_member_id, v_proposer_id, x->>'kind', x->>'player_id', x->>'player_name', x->>'position', x->>'nhl_team', (x->>'salary')::numeric
  from jsonb_array_elements(v_resolved_receives) x;

  return v_trade_id;
end;
$$;

revoke execute on function public.propose_trade(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function public.propose_trade(uuid, uuid, jsonb, jsonb, text) to authenticated;

-- ===================== RPC : repondre a un echange (destinataire) =====================

create or replace function public.respond_trade(p_trade_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_trade pool_trades%rowtype;
  v_member_id uuid;
  v_approval text;
begin
  select * into v_trade from pool_trades where id = p_trade_id;
  if v_trade.id is null then raise exception 'trade_not_found'; end if;

  select id into v_member_id from pool_members where pool_id = v_trade.pool_id and user_id = auth.uid();
  if v_member_id is null or v_member_id <> v_trade.recipient_member_id then raise exception 'not_recipient'; end if;
  if v_trade.status <> 'pending' then raise exception 'pool_trade_error_not_pending'; end if;

  if not p_accept then
    update pool_trades set status = 'declined', responded_at = now() where id = p_trade_id;
    return;
  end if;

  select rules->'trades'->>'approval' into v_approval from pools where id = v_trade.pool_id;

  if v_approval = 'commissioner' then
    update pool_trades set status = 'pending_commissioner', responded_at = now() where id = p_trade_id;
  else
    update pool_trades set responded_at = now() where id = p_trade_id;
    perform execute_trade(p_trade_id);
  end if;
end;
$$;

revoke execute on function public.respond_trade(uuid, boolean) from public;
grant execute on function public.respond_trade(uuid, boolean) to authenticated;

-- ===================== RPC : revue du commissaire =====================

create or replace function public.review_trade(p_trade_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_trade pool_trades%rowtype;
begin
  select * into v_trade from pool_trades where id = p_trade_id;
  if v_trade.id is null then raise exception 'trade_not_found'; end if;
  if not is_pool_commissioner(v_trade.pool_id) then raise exception 'not_commissioner'; end if;
  if v_trade.status <> 'pending_commissioner' then raise exception 'pool_trade_error_not_pending_commissioner'; end if;

  if p_approve then
    update pool_trades set reviewed_by = auth.uid() where id = p_trade_id;
    perform execute_trade(p_trade_id);
  else
    update pool_trades set status = 'rejected', reviewed_by = auth.uid() where id = p_trade_id;
  end if;
end;
$$;

revoke execute on function public.review_trade(uuid, boolean) from public;
grant execute on function public.review_trade(uuid, boolean) to authenticated;

-- ===================== RPC : annuler un echange (proposeur) =====================

create or replace function public.cancel_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_trade pool_trades%rowtype;
  v_member_id uuid;
begin
  select * into v_trade from pool_trades where id = p_trade_id;
  if v_trade.id is null then raise exception 'trade_not_found'; end if;

  select id into v_member_id from pool_members where pool_id = v_trade.pool_id and user_id = auth.uid();
  if v_member_id is null or v_member_id <> v_trade.proposer_member_id then raise exception 'not_proposer'; end if;
  if v_trade.status not in ('pending', 'pending_commissioner') then raise exception 'pool_trade_error_not_cancellable'; end if;

  update pool_trades set status = 'cancelled' where id = p_trade_id;
end;
$$;

revoke execute on function public.cancel_trade(uuid) from public;
grant execute on function public.cancel_trade(uuid) to authenticated;

-- ===================== RPC : ajouter un agent libre (avec abandon optionnel) =====================
-- p_drop_kind existe en plus des colonnes litteralement demandees (defaut 'player') pour ne
-- jamais bloquer l'abandon d'un choix d'equipe NHL via ce chemin ; omis, le comportement
-- reste identique a une demande qui ne connaitrait que des joueurs.

create or replace function public.add_free_agent(
  p_pool_id uuid, p_kind text, p_player_id text, p_player_name text, p_position text, p_nhl_team text, p_salary numeric,
  p_drop_player_id text default null, p_drop_kind text default 'player'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_member_id uuid;
  v_waivers jsonb;
  v_claim_order text;
  v_wait_days int;
  v_no_reacquire_dropped boolean;
  v_max_adds int;
  v_adds_used int;
  v_quota int;
  v_active_count int;
  v_cap_enabled boolean;
  v_cap_amount numeric;
  v_salary_total numeric;
  v_drop_salary numeric := 0;
  v_dropped_available_at timestamptz;
  v_needs_claim boolean := false;
  v_claim_id uuid;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'active' then raise exception 'pool_not_active'; end if;

  v_waivers := v_pool.rules->'waivers';
  if not coalesce((v_waivers->>'enabled')::boolean, false) then raise exception 'pool_waiver_error_disabled'; end if;
  v_claim_order := coalesce(v_waivers->>'claimOrder', 'first_come');
  v_wait_days := coalesce((v_waivers->>'waiverDays')::int, 0);
  v_no_reacquire_dropped := coalesce((v_waivers->>'noReacquireDropped')::boolean, false);
  v_max_adds := (v_waivers->>'maxAddsPerSeason')::int;

  select id into v_member_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_member_id is null then raise exception 'not_a_member'; end if;

  if v_no_reacquire_dropped and exists (
    select 1 from pool_dropped_players
    where pool_id = p_pool_id and kind = p_kind and player_id = p_player_id and dropped_by_member_id = v_member_id
  ) then
    raise exception 'pool_waiver_error_no_reacquire_dropped';
  end if;

  if v_max_adds is not null then
    select count(*) into v_adds_used from pool_transactions
    where pool_id = p_pool_id and member_id = v_member_id and type = 'add';
    if v_adds_used + 1 > v_max_adds then raise exception 'pool_waiver_error_max_adds'; end if;
  end if;

  if pool_item_owner(p_pool_id, p_kind, p_player_id) is not null then
    raise exception 'pool_draft_error_already_taken';
  end if;

  if coalesce(v_pool.rules->>'poolType', 'classic') = 'classic' then
    v_quota := pool_roster_quota(v_pool.rules, p_position);
    v_active_count := pool_member_active_count(p_pool_id, v_member_id, p_position);
    if v_active_count >= v_quota and p_drop_player_id is null then
      raise exception 'pool_waiver_error_drop_required';
    end if;
  end if;

  if p_drop_player_id is not null then
    if not exists (
      select 1 from pool_roster_periods
      where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id and to_at is null
    ) then
      raise exception 'pool_trade_error_invalid_ownership';
    end if;
    if coalesce(v_pool.rules->>'poolType', 'classic') = 'classic' then
      if not exists (
        select 1 from pool_roster_periods
        where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id
          and pos_group = p_position and to_at is null
      ) then
        raise exception 'pool_waiver_error_position_mismatch';
      end if;
    end if;
    select salary into v_drop_salary from pool_roster_periods
    where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id and to_at is null;
  end if;

  v_cap_enabled := coalesce((v_pool.rules->'salaryCap'->>'enabled')::boolean, false);
  if v_cap_enabled then
    v_cap_amount := coalesce((v_pool.rules->'salaryCap'->>'amount')::numeric, 0);
    v_salary_total := pool_member_salary_total(p_pool_id, v_member_id);
    if v_salary_total - coalesce(v_drop_salary, 0) + coalesce(p_salary, 0) > v_cap_amount then
      raise exception 'pool_trade_error_salary_cap_a';
    end if;
  end if;

  select max(available_at) into v_dropped_available_at
  from pool_dropped_players where pool_id = p_pool_id and kind = p_kind and player_id = p_player_id;
  v_needs_claim := (v_claim_order = 'reverse_standings') or (v_dropped_available_at is not null and v_dropped_available_at > now());

  if v_needs_claim then
    insert into pool_waiver_claims (
      pool_id, member_id, add_player_id, add_kind, add_player_name, add_position, add_nhl_team, add_salary,
      drop_player_id, drop_kind, status, process_at
    )
    values (
      p_pool_id, v_member_id, p_player_id, p_kind, p_player_name, p_position, p_nhl_team, p_salary,
      p_drop_player_id, p_drop_kind, 'pending', greatest(now(), coalesce(v_dropped_available_at, now()))
    )
    returning id into v_claim_id;
    return jsonb_build_object('claimed', true, 'claim_id', v_claim_id);
  end if;

  if p_drop_player_id is not null then
    update pool_roster_periods set to_at = now(), closed_reason = 'drop'
    where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id and to_at is null;
    insert into pool_dropped_players (pool_id, kind, player_id, dropped_by_member_id, available_at)
    values (p_pool_id, p_drop_kind, p_drop_player_id, v_member_id, now() + (v_wait_days || ' days')::interval);
    insert into pool_transactions (pool_id, member_id, type, details)
    values (p_pool_id, v_member_id, 'drop', jsonb_build_object('kind', p_drop_kind, 'player_id', p_drop_player_id));
  end if;

  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, nhl_team, salary, from_at, to_at)
  values (p_pool_id, v_member_id, p_kind, p_player_id, p_player_name, p_position, p_nhl_team, p_salary, now(), null);

  insert into pool_transactions (pool_id, member_id, type, details)
  values (p_pool_id, v_member_id, 'add', jsonb_build_object('kind', p_kind, 'player_id', p_player_id, 'player_name', p_player_name));

  return jsonb_build_object('claimed', false);
end;
$$;

revoke execute on function public.add_free_agent(uuid, text, text, text, text, text, numeric, text, text) from public;
grant execute on function public.add_free_agent(uuid, text, text, text, text, text, numeric, text, text) to authenticated;

-- ===================== RPC : abandonner un joueur =====================

create or replace function public.drop_player(p_pool_id uuid, p_kind text, p_player_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_member_id uuid;
  v_wait_days int;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'active' then raise exception 'pool_not_active'; end if;
  if not coalesce((v_pool.rules->'waivers'->>'enabled')::boolean, false) then raise exception 'pool_waiver_error_disabled'; end if;

  select id into v_member_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_member_id is null then raise exception 'not_a_member'; end if;

  if not exists (
    select 1 from pool_roster_periods
    where pool_id = p_pool_id and member_id = v_member_id and kind = p_kind and player_id = p_player_id and to_at is null
  ) then
    raise exception 'pool_trade_error_invalid_ownership';
  end if;

  v_wait_days := coalesce((v_pool.rules->'waivers'->>'waiverDays')::int, 0);

  update pool_roster_periods set to_at = now(), closed_reason = 'drop'
  where pool_id = p_pool_id and member_id = v_member_id and kind = p_kind and player_id = p_player_id and to_at is null;

  insert into pool_dropped_players (pool_id, kind, player_id, dropped_by_member_id, available_at)
  values (p_pool_id, p_kind, p_player_id, v_member_id, now() + (v_wait_days || ' days')::interval);

  insert into pool_transactions (pool_id, member_id, type, details)
  values (p_pool_id, v_member_id, 'drop', jsonb_build_object('kind', p_kind, 'player_id', p_player_id));
end;
$$;

revoke execute on function public.drop_player(uuid, text, text) from public;
grant execute on function public.drop_player(uuid, text, text) to authenticated;

-- ===================== Traitement des reclamations de ballotage =====================
-- Interne (pas de grant a authenticated) : traite un pool. Les reclamants sont ordonnes par
-- inverse du classement si waivers.claimOrder='reverse_standings' (le moins bien classe
-- gagne la priorite), sinon par ordre d'arrivee (premier arrive, premier servi). Le premier
-- reclamant qui passe encore TOUTES les validations (ownership, quota, plafond) au moment du
-- traitement gagne ; les autres reclamations sur le meme joueur sont perdues.

create or replace function public.process_waivers(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_claim_order text;
  v_cap_enabled boolean;
  v_cap_amount numeric;
  v_player record;
  v_claim record;
  v_won boolean;
  v_drop_salary numeric;
  v_quota int;
  v_active_count int;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null or v_pool.status <> 'active' then return; end if;

  v_claim_order := coalesce(v_pool.rules->'waivers'->>'claimOrder', 'first_come');
  v_cap_enabled := coalesce((v_pool.rules->'salaryCap'->>'enabled')::boolean, false);
  v_cap_amount := coalesce((v_pool.rules->'salaryCap'->>'amount')::numeric, 0);

  for v_player in
    select distinct wc.add_kind, wc.add_player_id
    from pool_waiver_claims wc
    where wc.pool_id = p_pool_id and wc.status = 'pending' and wc.process_at <= now()
  loop
    v_won := false;
    for v_claim in
      select wc.* from pool_waiver_claims wc
      left join pool_standings_rank_internal(p_pool_id) rk on rk.member_id = wc.member_id
      where wc.pool_id = p_pool_id and wc.status = 'pending'
        and wc.add_kind = v_player.add_kind and wc.add_player_id = v_player.add_player_id
      order by
        case when v_claim_order = 'reverse_standings' then coalesce(rk.rnk, 999999) else 0 end desc,
        wc.created_at asc
    loop
      if v_won then
        update pool_waiver_claims set status = 'lost' where id = v_claim.id;
        continue;
      end if;

      if pool_item_owner(p_pool_id, v_claim.add_kind, v_claim.add_player_id) is not null then
        update pool_waiver_claims set status = 'lost' where id = v_claim.id;
        continue;
      end if;

      v_drop_salary := null;
      if v_claim.drop_player_id is not null then
        if not exists (
          select 1 from pool_roster_periods
          where pool_id = p_pool_id and member_id = v_claim.member_id and kind = coalesce(v_claim.drop_kind, 'player')
            and player_id = v_claim.drop_player_id and to_at is null
        ) then
          update pool_waiver_claims set status = 'lost' where id = v_claim.id;
          continue;
        end if;
        select salary into v_drop_salary from pool_roster_periods
        where pool_id = p_pool_id and member_id = v_claim.member_id and kind = coalesce(v_claim.drop_kind, 'player')
          and player_id = v_claim.drop_player_id and to_at is null;
      end if;

      if coalesce(v_pool.rules->>'poolType', 'classic') = 'classic' then
        v_quota := pool_roster_quota(v_pool.rules, v_claim.add_position);
        v_active_count := pool_member_active_count(p_pool_id, v_claim.member_id, v_claim.add_position);
        if v_active_count >= v_quota and v_claim.drop_player_id is null then
          update pool_waiver_claims set status = 'lost' where id = v_claim.id;
          continue;
        end if;
      end if;

      if v_cap_enabled and (pool_member_salary_total(p_pool_id, v_claim.member_id) - coalesce(v_drop_salary, 0) + coalesce(v_claim.add_salary, 0)) > v_cap_amount then
        update pool_waiver_claims set status = 'lost' where id = v_claim.id;
        continue;
      end if;

      if v_claim.drop_player_id is not null then
        update pool_roster_periods set to_at = now(), closed_reason = 'drop'
        where pool_id = p_pool_id and member_id = v_claim.member_id and kind = coalesce(v_claim.drop_kind, 'player')
          and player_id = v_claim.drop_player_id and to_at is null;
        insert into pool_dropped_players (pool_id, kind, player_id, dropped_by_member_id, available_at)
        values (
          p_pool_id, coalesce(v_claim.drop_kind, 'player'), v_claim.drop_player_id, v_claim.member_id,
          now() + coalesce((v_pool.rules->'waivers'->>'waiverDays')::int, 0) * interval '1 day'
        );
        insert into pool_transactions (pool_id, member_id, type, details)
        values (p_pool_id, v_claim.member_id, 'drop', jsonb_build_object('kind', coalesce(v_claim.drop_kind, 'player'), 'player_id', v_claim.drop_player_id));
      end if;

      insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, nhl_team, salary, from_at, to_at)
      values (p_pool_id, v_claim.member_id, v_claim.add_kind, v_claim.add_player_id, v_claim.add_player_name, v_claim.add_position, v_claim.add_nhl_team, v_claim.add_salary, now(), null);

      insert into pool_transactions (pool_id, member_id, type, details)
      values (p_pool_id, v_claim.member_id, 'add', jsonb_build_object('kind', v_claim.add_kind, 'player_id', v_claim.add_player_id, 'player_name', v_claim.add_player_name, 'via_waiver', true));

      update pool_waiver_claims set status = 'won' where id = v_claim.id;
      v_won := true;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.process_waivers(uuid) from public;

-- Appelee par le mode planifie de l'Edge Function sync-nhl-stats (cle service_role) : aucun
-- grant a authenticated/anon, seulement a service_role.
create or replace function public.process_all_pools_waivers()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool record;
begin
  for v_pool in select id from pools where status = 'active' loop
    perform process_waivers(v_pool.id);
  end loop;
end;
$$;

revoke execute on function public.process_all_pools_waivers() from public;
grant execute on function public.process_all_pools_waivers() to service_role;

-- ===================== RPC : compteurs de transactions =====================

create or replace function public.get_transaction_counters(p_pool_id uuid, p_member_id uuid)
returns table (trades_used int, trades_max int, adds_used int, adds_max int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_rules jsonb;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  select rules into v_rules from pools where id = p_pool_id;

  return query
  select
    (select count(*)::int from pool_trades t where t.pool_id = p_pool_id and t.status = 'accepted' and (t.proposer_member_id = p_member_id or t.recipient_member_id = p_member_id)) as trades_used,
    (v_rules->'trades'->>'maxPerSeason')::int as trades_max,
    (select count(*)::int from pool_transactions tx where tx.pool_id = p_pool_id and tx.member_id = p_member_id and tx.type = 'add') as adds_used,
    (v_rules->'waivers'->>'maxAddsPerSeason')::int as adds_max;
end;
$$;

revoke execute on function public.get_transaction_counters(uuid, uuid) from public;
grant execute on function public.get_transaction_counters(uuid, uuid) to authenticated;

-- ===================== get_pool_top_scorers_today : ownership via periodes =====================
-- Signature et colonnes de sortie inchangees par rapport a 20261107 : seul le FROM change
-- (pool_picks.member_id -- l'ancien proprietaire si le joueur a ete echange -- devient la
-- periode OUVERTE actuelle). create or replace suffit, pas de drop necessaire.

create or replace function public.get_pool_top_scorers_today(p_pool_id uuid, p_limit int default 10)
returns table (
  ref_id text,
  label text,
  team_abbrev text,
  pos_group text,
  stats jsonb,
  points numeric,
  member_id uuid,
  display_name text,
  team_name text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_today date;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  v_today := (now() at time zone 'America/New_York')::date;

  return query
  with events_today as (
    select * from pool_scored_events(p_pool_id) ev
    where ev.kind = 'player' and (ev.start_time_utc at time zone 'America/New_York')::date = v_today
  ),
  agg as (
    select
      et.ref_id as ref_id,
      sum(et.points) as points,
      (select jsonb_object_agg(x.k, x.total) from (
        select kv.key as k, sum((kv.value)::numeric) as total
        from events_today ee, jsonb_each_text(ee.stats) kv
        where ee.ref_id = et.ref_id
        group by kv.key
      ) x) as stats
    from events_today et
    group by et.ref_id
  )
  select
    pr.player_id as ref_id,
    pr.player_name as label,
    pr.nhl_team as team_abbrev,
    pr.pos_group as pos_group,
    ag.stats as stats,
    ag.points as points,
    pm.id as member_id,
    pm.display_name as display_name,
    pm.team_name as team_name
  from agg ag
  join pool_roster_periods pr on pr.pool_id = p_pool_id and pr.kind = 'player' and pr.player_id = ag.ref_id and pr.to_at is null
  join pool_members pm on pm.id = pr.member_id
  order by ag.points desc, pr.player_name
  limit p_limit;
end;
$$;

revoke execute on function public.get_pool_top_scorers_today(uuid, int) from public;
grant execute on function public.get_pool_top_scorers_today(uuid, int) to authenticated;

-- ===================== get_member_breakdown : roster via periodes (actif/inactif) =====================
-- Changement de type de retour (ajoute is_active, closed_reason) par rapport a 20261107 :
-- drop explicite requis avant le create or replace (cf. l'incident 42P13 corrige dans
-- 20261107_pool_standings_redesign.sql -- meme discipline applique ici).
-- Le FROM change fondamentalement : au lieu de partir de pool_picks (qui ne connait que les
-- joueurs REPECHES), on part de pool_roster_periods regroupees par (kind, player_id) pour CE
-- membre -- couvre aussi bien les echanges (periode fermee = inactif, points conserves) que
-- les agents libres ajoutes en cours de saison (jamais dans pool_picks). pool_picks n'est
-- plus utilisee que pour recuperer pick_no quand il existe (LEFT JOIN, null pour un agent
-- libre jamais repeche).

drop function if exists public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz);

create or replace function public.get_member_breakdown(p_pool_id uuid, p_member_id uuid, p_from timestamptz default null, p_to timestamptz default null)
returns table (
  kind text,
  ref_id text,
  label text,
  pos_group text,
  team_abbrev text,
  pick_no int,
  salary numeric,
  games_played int,
  stats jsonb,
  points_by_category jsonb,
  total_points numeric,
  is_hot boolean,
  is_cold boolean,
  opponent_abbrev text,
  is_active boolean,
  closed_reason text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_today date;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  if not exists (select 1 from pool_members pm where pm.id = p_member_id and pm.pool_id = p_pool_id) then
    raise exception 'member_not_in_pool';
  end if;
  v_today := (now() at time zone 'America/New_York')::date;

  return query
  with events_all as (
    select * from pool_scored_events(p_pool_id) sev where sev.member_id = p_member_id
  ),
  events_window as (
    select * from events_all ea
    where (p_from is null or ea.start_time_utc >= p_from)
      and (p_to is null or ea.start_time_utc < p_to)
  ),
  agg_window as (
    select
      ew.ref_id as ref_id,
      ew.kind as kind,
      (select jsonb_object_agg(x.k, x.total) from (
        select kv.key as k, sum((kv.value)::numeric) as total
        from events_window ee, jsonb_each_text(ee.stats) kv
        where ee.ref_id = ew.ref_id and ee.kind = ew.kind
        group by kv.key
      ) x) as stats,
      (select jsonb_object_agg(x.k, x.total) from (
        select kv.key as k, sum((kv.value)::numeric) as total
        from events_window ee, jsonb_each_text(ee.points_by_category) kv
        where ee.ref_id = ew.ref_id and ee.kind = ew.kind
        group by kv.key
      ) x) as points_by_category,
      count(*)::int as games_played,
      sum(ew.points) as total_points
    from events_window ew
    group by ew.ref_id, ew.kind
  ),
  roster as (
    select
      prp.kind as kind,
      prp.player_id as ref_id,
      (array_agg(prp.player_name order by prp.from_at desc))[1] as label,
      (array_agg(prp.pos_group order by prp.from_at desc))[1] as pos_group,
      (array_agg(prp.nhl_team order by prp.from_at desc))[1] as team_abbrev,
      (array_agg(prp.salary order by prp.from_at desc))[1] as salary,
      bool_or(prp.to_at is null) as is_active,
      (array_agg(prp.closed_reason order by prp.from_at desc) filter (where prp.to_at is not null))[1] as closed_reason
    from pool_roster_periods prp
    where prp.pool_id = p_pool_id and prp.member_id = p_member_id
    group by prp.kind, prp.player_id
  ),
  trend as (
    select
      r.kind as kind, r.ref_id as ref_id,
      l5.last5_count as last5_count, l5.last5_positive as last5_positive
    from roster r
    cross join lateral (
      select
        count(*) as last5_count,
        count(*) filter (where sub.pts > 0) as last5_positive
      from (
        select ea.points as pts from events_all ea where ea.ref_id = r.ref_id and ea.kind = r.kind
        order by ea.start_time_utc desc limit 5
      ) sub
    ) l5
  ),
  pick_meta as (
    select pp.kind as kind, pp.player_id as ref_id, pp.pick_no as pick_no
    from pool_picks pp where pp.pool_id = p_pool_id
  )
  select
    r.kind, r.ref_id, r.label, r.pos_group, r.team_abbrev,
    pk.pick_no,
    r.salary,
    coalesce(aw.games_played, 0) as games_played,
    coalesce(aw.stats, '{}'::jsonb) as stats,
    coalesce(aw.points_by_category, '{}'::jsonb) as points_by_category,
    coalesce(aw.total_points, 0) as total_points,
    (coalesce(tr.last5_count, 0) >= 5 and coalesce(tr.last5_positive, 0) >= 4) as is_hot,
    (coalesce(tr.last5_count, 0) >= 5 and coalesce(tr.last5_positive, 0) = 0) as is_cold,
    (
      select case when gm.home_abbrev = r.team_abbrev then gm.away_abbrev
                  when gm.away_abbrev = r.team_abbrev then gm.home_abbrev end
      from nhl_games gm
      where gm.game_date = v_today and (gm.home_abbrev = r.team_abbrev or gm.away_abbrev = r.team_abbrev)
      limit 1
    ) as opponent_abbrev,
    r.is_active,
    r.closed_reason
  from roster r
  left join agg_window aw on aw.ref_id = r.ref_id and aw.kind = r.kind
  left join trend tr on tr.ref_id = r.ref_id and tr.kind = r.kind
  left join pick_meta pk on pk.ref_id = r.ref_id and pk.kind = r.kind
  order by r.is_active desc, coalesce(aw.total_points, 0) desc, pk.pick_no asc nulls last;
end;
$$;

revoke execute on function public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz) to authenticated;
