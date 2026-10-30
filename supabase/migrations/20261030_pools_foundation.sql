-- Phase 1 : fondation du systeme de pools de hockey personnalisables.
-- Cree les tables `pools` / `pool_members`, les fonctions utilitaires
-- is_pool_member / is_pool_commissioner (evitent la recursion RLS quand une policy
-- sur pool_members a besoin de verifier l'appartenance via pool_members lui-meme),
-- et la RPC join_pool_by_code utilisee pour rejoindre un pool via code d'invitation
-- (c'est la SEULE voie pour qu'un utilisateur rejoigne un pool dont il n'est pas
-- proprietaire : aucune policy INSERT directe ne le permet sur pool_members).

create extension if not exists pgcrypto;

-- Genere un code d'invitation unique, lisible (sans caracteres ambigus 0/O/1/I).
create or replace function public.generate_pool_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..7 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from pools where invite_code = code);
  end loop;
  return code;
end;
$$;

create table if not exists pools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  season text not null,
  status text not null default 'setup' check (status in ('setup', 'draft', 'active', 'finished')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  invite_code text not null unique default generate_pool_invite_code(),
  max_members int not null default 12 check (max_members between 2 and 30),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null,
  role text not null default 'member' check (role in ('commissioner', 'member')),
  draft_position int,
  joined_at timestamptz not null default now(),
  unique (pool_id, user_id)
);

create index if not exists idx_pools_owner_id on pools(owner_id);
create index if not exists idx_pool_members_pool_id on pool_members(pool_id);
create index if not exists idx_pool_members_user_id on pool_members(user_id);

-- ===================== Helpers RLS (security definer : court-circuitent RLS pour
-- eviter la recursion quand une policy pool_members doit lire pool_members) =====================

create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from pool_members
    where pool_id = p_pool_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_pool_commissioner(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from pool_members
    where pool_id = p_pool_id and user_id = auth.uid() and role = 'commissioner'
  );
$$;

revoke execute on function public.is_pool_member(uuid) from public;
revoke execute on function public.is_pool_commissioner(uuid) from public;
grant execute on function public.is_pool_member(uuid) to authenticated;
grant execute on function public.is_pool_commissioner(uuid) to authenticated;

-- ===================== RLS : pools =====================

alter table pools enable row level security;

drop policy if exists "pools_select_member_or_owner" on pools;
create policy "pools_select_member_or_owner" on pools
  for select using (owner_id = auth.uid() or is_pool_member(id));

drop policy if exists "pools_insert_own" on pools;
create policy "pools_insert_own" on pools
  for insert with check (owner_id = auth.uid());

-- Seul le commissaire modifie les regles, et seulement tant que le pool est en setup.
drop policy if exists "pools_update_commissioner_setup_only" on pools;
create policy "pools_update_commissioner_setup_only" on pools
  for update
  using (status = 'setup' and is_pool_commissioner(id))
  with check (is_pool_commissioner(id));

-- ===================== RLS : pool_members =====================

alter table pool_members enable row level security;

drop policy if exists "pool_members_select_same_pool" on pool_members;
create policy "pool_members_select_same_pool" on pool_members
  for select using (is_pool_member(pool_id));

-- Insertion directe limitee a : le proprietaire qui cree sa propre ligne de
-- commissaire au moment de la creation du pool. Tout autre ajout (rejoindre un pool
-- existant) doit passer par join_pool_by_code ci-dessous.
drop policy if exists "pool_members_insert_owner_commissioner" on pool_members;
create policy "pool_members_insert_owner_commissioner" on pool_members
  for insert
  with check (
    user_id = auth.uid()
    and role = 'commissioner'
    and exists (select 1 from pools where id = pool_id and owner_id = auth.uid())
  );

-- ===================== RPC : rejoindre un pool via code d'invitation =====================

create or replace function public.join_pool_by_code(p_invite_code text, p_team_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_member_count int;
  v_team_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_team_name := trim(coalesce(p_team_name, ''));
  if v_team_name = '' then
    raise exception 'invalid_team_name';
  end if;

  select * into v_pool from pools where invite_code = upper(trim(coalesce(p_invite_code, '')));
  if v_pool.id is null then
    raise exception 'invalid_code';
  end if;

  if v_pool.status = 'finished' then
    raise exception 'pool_closed';
  end if;

  if exists (select 1 from pool_members where pool_id = v_pool.id and user_id = auth.uid()) then
    raise exception 'already_member';
  end if;

  select count(*) into v_member_count from pool_members where pool_id = v_pool.id;
  if v_member_count >= v_pool.max_members then
    raise exception 'pool_full';
  end if;

  insert into pool_members (pool_id, user_id, team_name, role)
  values (v_pool.id, auth.uid(), v_team_name, 'member');

  return v_pool.id;
end;
$$;

revoke execute on function public.join_pool_by_code(text, text) from public;
grant execute on function public.join_pool_by_code(text, text) to authenticated;
