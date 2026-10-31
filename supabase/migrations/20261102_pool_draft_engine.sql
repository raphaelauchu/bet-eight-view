-- Phase 2 : moteur de draft en direct, persistant et redemarrable.
--
-- Principes :
-- - Un pool cree reste en status='setup' indefiniment ; rien ne demarre automatiquement.
-- - start_draft (commissaire uniquement) fige l'ordre et passe le pool en 'draft'.
-- - Tout l'etat du draft (pick courant, echeance, pause, total de choix) vit dans
--   pools.draft_state (jsonb), modifie UNIQUEMENT par les RPC ci-dessous (aucune policy
--   UPDATE directe n'est ajoutee : SECURITY DEFINER bypass RLS, comme pour les fonctions
--   deja en place dans les migrations precedentes).
-- - pool_picks est l'historique immuable des choix ; lecture ouverte aux membres du pool,
--   ecriture uniquement via RPC.
--
-- Simplification volontaire (Phase 4 "gestion d'equipe" affinera) : en mode fantasy, les
-- postes F et D partagent un seul quota combine (C+LW+RW+D+UTIL+banc+IR) parce que
-- UTIL/banc acceptent n'importe quel patineur ; on ne resout pas l'eligibilite fine par
-- poste au moment du draft.

alter table pools add column if not exists draft_state jsonb not null default '{}'::jsonb;

create table if not exists pool_picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  member_id uuid not null references pool_members(id) on delete cascade,
  round int,
  pick_no int,
  kind text not null check (kind in ('player', 'team')),
  player_id text not null,
  player_name text not null,
  position text not null check (position in ('F', 'D', 'G', 'TEAM')),
  nhl_team text,
  salary numeric,
  is_manual boolean not null default false,
  picked_at timestamptz not null default now(),
  unique (pool_id, pick_no),
  unique (pool_id, kind, player_id)
);

create index if not exists idx_pool_picks_pool_id on pool_picks(pool_id);
create index if not exists idx_pool_picks_member_id on pool_picks(member_id);

alter table pool_picks enable row level security;

drop policy if exists "pool_picks_select_same_pool" on pool_picks;
create policy "pool_picks_select_same_pool" on pool_picks
  for select using (is_pool_member(pool_id));

-- ===================== Temps reel =====================

alter table pool_picks replica identity full;
alter table pools replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pool_picks') then
    alter publication supabase_realtime add table pool_picks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pools') then
    alter publication supabase_realtime add table pools;
  end if;
end $$;

-- ===================== Helpers purs (lecture de rules jsonb, pas d'acces aux donnees) =====================

create or replace function public.pool_total_roster_slots(p_rules jsonb)
returns int
language plpgsql
immutable
as $$
declare
  v_pool_type text := coalesce(p_rules->>'poolType', 'classic');
  v_roster jsonb := coalesce(p_rules->'roster', '{}'::jsonb);
begin
  if v_pool_type = 'classic' then
    return coalesce((v_roster->>'forwards')::int, 0) + coalesce((v_roster->>'defense')::int, 0) + coalesce((v_roster->>'goalies')::int, 0);
  else
    return coalesce((v_roster->>'C')::int, 0) + coalesce((v_roster->>'LW')::int, 0) + coalesce((v_roster->>'RW')::int, 0)
         + coalesce((v_roster->>'D')::int, 0) + coalesce((v_roster->>'G')::int, 0) + coalesce((v_roster->>'UTIL')::int, 0)
         + coalesce((v_roster->>'bench')::int, 0) + coalesce((v_roster->>'ir')::int, 0);
  end if;
end;
$$;

create or replace function public.pool_picks_per_member(p_rules jsonb)
returns int
language plpgsql
immutable
as $$
declare
  v_team_counts boolean := coalesce((p_rules->'draft'->>'teamPickCountsAsRound')::boolean, false);
  v_team_picks int := coalesce((p_rules->'roster'->>'teamPicks')::int, 0);
begin
  return pool_total_roster_slots(p_rules) + (case when v_team_counts then v_team_picks else 0 end);
end;
$$;

-- Quota du poste p_position ('F'|'D'|'G'|'TEAM') pour un participant, selon rules.roster.
create or replace function public.pool_roster_quota(p_rules jsonb, p_position text)
returns int
language plpgsql
immutable
as $$
declare
  v_pool_type text := coalesce(p_rules->>'poolType', 'classic');
  v_roster jsonb := coalesce(p_rules->'roster', '{}'::jsonb);
begin
  if p_position = 'TEAM' then
    return coalesce((v_roster->>'teamPicks')::int, 0);
  end if;
  if v_pool_type = 'classic' then
    if p_position = 'F' then return coalesce((v_roster->>'forwards')::int, 0); end if;
    if p_position = 'D' then return coalesce((v_roster->>'defense')::int, 0); end if;
    if p_position = 'G' then return coalesce((v_roster->>'goalies')::int, 0); end if;
  else
    if p_position in ('F', 'D') then
      return coalesce((v_roster->>'C')::int, 0) + coalesce((v_roster->>'LW')::int, 0) + coalesce((v_roster->>'RW')::int, 0)
           + coalesce((v_roster->>'D')::int, 0) + coalesce((v_roster->>'UTIL')::int, 0)
           + coalesce((v_roster->>'bench')::int, 0) + coalesce((v_roster->>'ir')::int, 0);
    end if;
    if p_position = 'G' then return coalesce((v_roster->>'G')::int, 0); end if;
  end if;
  return 0;
end;
$$;

-- Determine le membre "sur l'horloge" pour le pick p_current_pick (1-indexe), selon l'ordre
-- fige p_order (jsonb array de uuid-texte) et le type de draft ('snake'|'linear'). Replique
-- cote client (JS) pour l'affichage ; ici, c'est la version qui fait autorite.
create or replace function public.pool_current_member_id(p_order jsonb, p_current_pick int, p_draft_type text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_members uuid[];
  v_n int;
  v_idx0 int;
  v_round0 int;
  v_pos int;
begin
  select array_agg(x)::uuid[] into v_members from jsonb_array_elements_text(coalesce(p_order, '[]'::jsonb)) x;
  v_n := coalesce(array_length(v_members, 1), 0);
  if v_n = 0 or p_current_pick is null or p_current_pick < 1 then
    return null;
  end if;
  v_idx0 := p_current_pick - 1;
  v_round0 := v_idx0 / v_n;
  v_pos := v_idx0 % v_n;
  if p_draft_type = 'snake' and v_round0 % 2 = 1 then
    return v_members[v_n - v_pos];
  else
    return v_members[v_pos + 1];
  end if;
end;
$$;

revoke execute on function public.pool_total_roster_slots(jsonb) from public;
revoke execute on function public.pool_picks_per_member(jsonb) from public;
revoke execute on function public.pool_roster_quota(jsonb, text) from public;
revoke execute on function public.pool_current_member_id(jsonb, int, text) from public;
grant execute on function public.pool_total_roster_slots(jsonb) to authenticated;
grant execute on function public.pool_picks_per_member(jsonb) to authenticated;
grant execute on function public.pool_roster_quota(jsonb, text) to authenticated;
grant execute on function public.pool_current_member_id(jsonb, int, text) to authenticated;

-- Avance draft_state au pick suivant, ou termine le draft (status='active') si c'etait le
-- dernier. Usage interne uniquement (appele depuis make_pick / auto_pick / commissioner_pick,
-- toutes SECURITY DEFINER proprietaires du meme role) : jamais expose directement.
create or replace function public.advance_draft_pick(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_next_pick int;
  v_seconds int;
begin
  select * into v_pool from pools where id = p_pool_id;
  v_next_pick := coalesce((v_pool.draft_state->>'current_pick')::int, 0) + 1;
  if v_next_pick > coalesce((v_pool.draft_state->>'total_picks')::int, 0) then
    update pools set status = 'active',
      draft_state = draft_state || jsonb_build_object('current_pick', v_next_pick, 'pick_deadline', null)
    where id = p_pool_id;
  else
    v_seconds := coalesce((v_pool.rules->'draft'->>'secondsPerPick')::int, 60);
    update pools set
      draft_state = draft_state || jsonb_build_object('current_pick', v_next_pick, 'pick_deadline', to_jsonb(now() + (v_seconds || ' seconds')::interval))
    where id = p_pool_id;
  end if;
end;
$$;

revoke execute on function public.advance_draft_pick(uuid) from public;

-- ===================== RPC : demarrer le draft =====================

create or replace function public.start_draft(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_member_count int;
  v_manual_count int;
  v_distinct_positions int;
  v_order uuid[];
  v_picks_per_member int;
  v_total_picks int;
  v_seconds int;
  i int;
begin
  if not is_pool_commissioner(p_pool_id) then
    raise exception 'not_commissioner';
  end if;

  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then
    raise exception 'pool_not_found';
  end if;
  if v_pool.status <> 'setup' then
    raise exception 'draft_already_started';
  end if;

  select count(*) into v_member_count from pool_members where pool_id = p_pool_id;
  if v_member_count < 2 then
    raise exception 'not_enough_members';
  end if;

  if coalesce(v_pool.rules->'draft'->>'orderMode', 'random') = 'manual' then
    select count(*) into v_manual_count from pool_members where pool_id = p_pool_id and draft_position is not null;
    select count(distinct draft_position) into v_distinct_positions from pool_members where pool_id = p_pool_id and draft_position is not null;
    if v_manual_count <> v_member_count or v_distinct_positions <> v_member_count then
      raise exception 'incomplete_manual_order';
    end if;
    select array_agg(id order by draft_position) into v_order from pool_members where pool_id = p_pool_id;
  else
    select array_agg(id order by random()) into v_order from pool_members where pool_id = p_pool_id;
    for i in 1..array_length(v_order, 1) loop
      update pool_members set draft_position = i where id = v_order[i];
    end loop;
  end if;

  v_picks_per_member := pool_picks_per_member(v_pool.rules);
  if v_picks_per_member <= 0 then
    raise exception 'empty_roster';
  end if;
  v_total_picks := v_picks_per_member * v_member_count;
  v_seconds := coalesce((v_pool.rules->'draft'->>'secondsPerPick')::int, 60);

  update pools set
    status = 'draft',
    draft_state = jsonb_build_object(
      'order', to_jsonb(v_order),
      'current_pick', 1,
      'pick_deadline', to_jsonb(now() + (v_seconds || ' seconds')::interval),
      'paused', false,
      'total_picks', v_total_picks,
      'picks_per_member', v_picks_per_member
    )
  where id = p_pool_id;
end;
$$;

revoke execute on function public.start_draft(uuid) from public;
grant execute on function public.start_draft(uuid) to authenticated;

-- ===================== RPC : choisir (son propre tour) =====================

create or replace function public.make_pick(
  p_pool_id uuid, p_kind text, p_player_id text, p_player_name text,
  p_position text, p_nhl_team text, p_salary numeric, p_is_manual boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_caller_member_id uuid;
  v_current_member_id uuid;
  v_is_free_team_pick boolean;
  v_quota int;
  v_used int;
  v_salary_used numeric;
  v_cap numeric;
  v_round int;
  v_member_count int;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'draft' then raise exception 'draft_not_active'; end if;
  if coalesce((v_pool.draft_state->>'paused')::boolean, false) then raise exception 'draft_paused'; end if;

  select id into v_caller_member_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_caller_member_id is null then raise exception 'not_a_member'; end if;

  v_is_free_team_pick := (p_kind = 'team' and not coalesce((v_pool.rules->'draft'->>'teamPickCountsAsRound')::boolean, false));

  if v_is_free_team_pick then
    v_current_member_id := v_caller_member_id;
  else
    v_current_member_id := pool_current_member_id(v_pool.draft_state->'order', (v_pool.draft_state->>'current_pick')::int, v_pool.rules->'draft'->>'type');
    if v_current_member_id is null or v_caller_member_id <> v_current_member_id then
      raise exception 'not_your_turn';
    end if;
  end if;

  if exists (select 1 from pool_picks where pool_id = p_pool_id and kind = p_kind and player_id = p_player_id) then
    raise exception 'already_taken';
  end if;

  v_quota := pool_roster_quota(v_pool.rules, p_position);
  if coalesce(v_pool.rules->>'poolType', 'classic') = 'fantasy' and p_position in ('F', 'D') then
    select count(*) into v_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id and position in ('F', 'D');
  else
    select count(*) into v_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id and position = p_position;
  end if;
  if v_used >= v_quota then
    raise exception 'position_quota_reached';
  end if;

  if coalesce((v_pool.rules->'salaryCap'->>'enabled')::boolean, false) and p_salary is not null then
    v_cap := coalesce((v_pool.rules->'salaryCap'->>'amount')::numeric, 0);
    select coalesce(sum(salary), 0) into v_salary_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id;
    if v_salary_used + p_salary > v_cap then
      raise exception 'salary_cap_exceeded';
    end if;
  end if;

  select count(*) into v_member_count from pool_members where pool_id = p_pool_id;
  v_round := ceil(coalesce((v_pool.draft_state->>'current_pick')::int, 1)::numeric / v_member_count);

  insert into pool_picks (pool_id, member_id, round, pick_no, kind, player_id, player_name, position, nhl_team, salary, is_manual)
  values (
    p_pool_id, v_current_member_id, v_round,
    case when v_is_free_team_pick then null else (v_pool.draft_state->>'current_pick')::int end,
    p_kind, p_player_id, p_player_name, p_position, p_nhl_team, p_salary, coalesce(p_is_manual, false)
  );

  if not v_is_free_team_pick then
    perform advance_draft_pick(p_pool_id);
  end if;
end;
$$;

revoke execute on function public.make_pick(uuid, text, text, text, text, text, numeric, boolean) from public;
grant execute on function public.make_pick(uuid, text, text, text, text, text, numeric, boolean) to authenticated;

-- ===================== RPC : choix automatique a l'expiration du minuteur =====================
-- Appelable par n'importe quel membre (pas seulement celui sur l'horloge) une fois
-- pick_deadline depasse. Le "meilleur joueur disponible" est calcule cote client (aucune
-- table de statistiques NHL n'est stockee en base - les donnees viennent de l'API NHL en
-- direct, comme PoolDraft.js) ; cette RPC se contente de revalider et d'enregistrer le
-- choix pour le membre reellement sur l'horloge (jamais pour l'appelant), de facon
-- idempotente (si deja avance, l'echeance n'est plus depassee et la fonction echoue
-- proprement sans double-ecriture).
create or replace function public.auto_pick(
  p_pool_id uuid, p_kind text, p_player_id text, p_player_name text,
  p_position text, p_nhl_team text, p_salary numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_caller_member_id uuid;
  v_current_member_id uuid;
  v_quota int;
  v_used int;
  v_salary_used numeric;
  v_cap numeric;
  v_round int;
  v_member_count int;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'draft' then raise exception 'draft_not_active'; end if;
  if coalesce((v_pool.draft_state->>'paused')::boolean, false) then raise exception 'draft_paused'; end if;
  if v_pool.draft_state->>'pick_deadline' is null or (v_pool.draft_state->>'pick_deadline')::timestamptz > now() then
    raise exception 'not_expired';
  end if;

  select id into v_caller_member_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_caller_member_id is null then raise exception 'not_a_member'; end if;

  v_current_member_id := pool_current_member_id(v_pool.draft_state->'order', (v_pool.draft_state->>'current_pick')::int, v_pool.rules->'draft'->>'type');
  if v_current_member_id is null then raise exception 'draft_not_active'; end if;

  if exists (select 1 from pool_picks where pool_id = p_pool_id and kind = p_kind and player_id = p_player_id) then
    raise exception 'already_taken';
  end if;

  v_quota := pool_roster_quota(v_pool.rules, p_position);
  if coalesce(v_pool.rules->>'poolType', 'classic') = 'fantasy' and p_position in ('F', 'D') then
    select count(*) into v_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id and position in ('F', 'D');
  else
    select count(*) into v_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id and position = p_position;
  end if;
  if v_used >= v_quota then
    raise exception 'position_quota_reached';
  end if;

  if coalesce((v_pool.rules->'salaryCap'->>'enabled')::boolean, false) and p_salary is not null then
    v_cap := coalesce((v_pool.rules->'salaryCap'->>'amount')::numeric, 0);
    select coalesce(sum(salary), 0) into v_salary_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id;
    if v_salary_used + p_salary > v_cap then
      raise exception 'salary_cap_exceeded';
    end if;
  end if;

  select count(*) into v_member_count from pool_members where pool_id = p_pool_id;
  v_round := ceil(coalesce((v_pool.draft_state->>'current_pick')::int, 1)::numeric / v_member_count);

  insert into pool_picks (pool_id, member_id, round, pick_no, kind, player_id, player_name, position, nhl_team, salary, is_manual)
  values (p_pool_id, v_current_member_id, v_round, (v_pool.draft_state->>'current_pick')::int, p_kind, p_player_id, p_player_name, p_position, p_nhl_team, p_salary, false);

  perform advance_draft_pick(p_pool_id);
end;
$$;

revoke execute on function public.auto_pick(uuid, text, text, text, text, text, numeric) from public;
grant execute on function public.auto_pick(uuid, text, text, text, text, text, numeric) to authenticated;

-- ===================== RPC : le commissaire choisit pour un membre absent =====================

create or replace function public.commissioner_pick(
  p_pool_id uuid, p_member_id uuid, p_kind text, p_player_id text, p_player_name text,
  p_position text, p_nhl_team text, p_salary numeric, p_is_manual boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_current_member_id uuid;
  v_is_free_team_pick boolean;
  v_quota int;
  v_used int;
  v_salary_used numeric;
  v_cap numeric;
  v_round int;
  v_member_count int;
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'draft' then raise exception 'draft_not_active'; end if;
  if coalesce((v_pool.draft_state->>'paused')::boolean, false) then raise exception 'draft_paused'; end if;

  v_is_free_team_pick := (p_kind = 'team' and not coalesce((v_pool.rules->'draft'->>'teamPickCountsAsRound')::boolean, false));

  if v_is_free_team_pick then
    v_current_member_id := p_member_id;
  else
    v_current_member_id := pool_current_member_id(v_pool.draft_state->'order', (v_pool.draft_state->>'current_pick')::int, v_pool.rules->'draft'->>'type');
    if v_current_member_id is null or p_member_id <> v_current_member_id then
      raise exception 'not_your_turn';
    end if;
  end if;

  if exists (select 1 from pool_picks where pool_id = p_pool_id and kind = p_kind and player_id = p_player_id) then
    raise exception 'already_taken';
  end if;

  v_quota := pool_roster_quota(v_pool.rules, p_position);
  if coalesce(v_pool.rules->>'poolType', 'classic') = 'fantasy' and p_position in ('F', 'D') then
    select count(*) into v_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id and position in ('F', 'D');
  else
    select count(*) into v_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id and position = p_position;
  end if;
  if v_used >= v_quota then raise exception 'position_quota_reached'; end if;

  if coalesce((v_pool.rules->'salaryCap'->>'enabled')::boolean, false) and p_salary is not null then
    v_cap := coalesce((v_pool.rules->'salaryCap'->>'amount')::numeric, 0);
    select coalesce(sum(salary), 0) into v_salary_used from pool_picks where pool_id = p_pool_id and member_id = v_current_member_id;
    if v_salary_used + p_salary > v_cap then raise exception 'salary_cap_exceeded'; end if;
  end if;

  select count(*) into v_member_count from pool_members where pool_id = p_pool_id;
  v_round := ceil(coalesce((v_pool.draft_state->>'current_pick')::int, 1)::numeric / v_member_count);

  insert into pool_picks (pool_id, member_id, round, pick_no, kind, player_id, player_name, position, nhl_team, salary, is_manual)
  values (
    p_pool_id, v_current_member_id, v_round,
    case when v_is_free_team_pick then null else (v_pool.draft_state->>'current_pick')::int end,
    p_kind, p_player_id, p_player_name, p_position, p_nhl_team, p_salary, coalesce(p_is_manual, false)
  );

  if not v_is_free_team_pick then
    perform advance_draft_pick(p_pool_id);
  end if;
end;
$$;

revoke execute on function public.commissioner_pick(uuid, uuid, text, text, text, text, text, numeric, boolean) from public;
grant execute on function public.commissioner_pick(uuid, uuid, text, text, text, text, text, numeric, boolean) to authenticated;

-- ===================== RPC : annuler le dernier choix =====================
-- Ne s'applique qu'aux choix de la sequence principale (pick_no non nul) ; un choix
-- d'equipe NHL "libre" (teamPickCountsAsRound=false) n'est pas annulable par cette fonction.

create or replace function public.undo_last_pick(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_last_pick_no int;
  v_deleted_count int;
  v_seconds int;
  v_was_active boolean;
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status not in ('draft', 'active') then raise exception 'draft_not_active'; end if;

  v_was_active := (v_pool.status = 'active');
  v_last_pick_no := case when v_was_active
    then coalesce((v_pool.draft_state->>'total_picks')::int, 0)
    else coalesce((v_pool.draft_state->>'current_pick')::int, 1) - 1
  end;

  if v_last_pick_no < 1 then raise exception 'nothing_to_undo'; end if;

  delete from pool_picks where pool_id = p_pool_id and pick_no = v_last_pick_no;
  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then raise exception 'nothing_to_undo'; end if;

  v_seconds := coalesce((v_pool.rules->'draft'->>'secondsPerPick')::int, 60);
  update pools set
    status = 'draft',
    draft_state = draft_state || jsonb_build_object('current_pick', v_last_pick_no, 'pick_deadline', to_jsonb(now() + (v_seconds || ' seconds')::interval))
  where id = p_pool_id;
end;
$$;

revoke execute on function public.undo_last_pick(uuid) from public;
grant execute on function public.undo_last_pick(uuid) to authenticated;

-- ===================== RPC : pause / reprise =====================

create or replace function public.pause_draft(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;
  update pools set draft_state = draft_state || jsonb_build_object('paused', true)
  where id = p_pool_id and status = 'draft';
  if not found then raise exception 'draft_not_active'; end if;
end;
$$;

-- A la reprise, l'echeance du pick courant est recalculee a now() + secondsPerPick.
create or replace function public.resume_draft(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_seconds int;
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;
  select * into v_pool from pools where id = p_pool_id and status = 'draft';
  if v_pool.id is null then raise exception 'draft_not_active'; end if;
  v_seconds := coalesce((v_pool.rules->'draft'->>'secondsPerPick')::int, 60);
  update pools set draft_state = draft_state || jsonb_build_object('paused', false, 'pick_deadline', to_jsonb(now() + (v_seconds || ' seconds')::interval))
  where id = p_pool_id;
end;
$$;

revoke execute on function public.pause_draft(uuid) from public;
revoke execute on function public.resume_draft(uuid) from public;
grant execute on function public.pause_draft(uuid) to authenticated;
grant execute on function public.resume_draft(uuid) to authenticated;

-- ===================== Correction : join_pool_by_code doit refuser hors 'setup' =====================
-- L'ancienne version ne bloquait que les pools 'finished'. Un pool en 'draft'/'active' ne
-- doit plus accepter de nouveaux membres. Signature inchangee (text, text, text) : simple
-- remplacement du corps, pas de drop necessaire.

create or replace function public.join_pool_by_code(p_invite_code text, p_team_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_member_count int;
  v_team_name text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_team_name := nullif(trim(coalesce(p_team_name, '')), '');
  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');

  select * into v_pool from pools where invite_code = upper(trim(coalesce(p_invite_code, '')));
  if v_pool.id is null then
    raise exception 'invalid_code';
  end if;

  if v_pool.status <> 'setup' then
    raise exception 'pool_closed';
  end if;

  if exists (select 1 from pool_members where pool_id = v_pool.id and user_id = auth.uid()) then
    raise exception 'already_member';
  end if;

  select count(*) into v_member_count from pool_members where pool_id = v_pool.id;
  if v_member_count >= v_pool.max_members then
    raise exception 'pool_full';
  end if;

  insert into pool_members (pool_id, user_id, team_name, display_name, role)
  values (v_pool.id, auth.uid(), v_team_name, v_display_name, 'member');

  return v_pool.id;
end;
$$;

revoke execute on function public.join_pool_by_code(text, text, text) from public;
grant execute on function public.join_pool_by_code(text, text, text) to authenticated;
