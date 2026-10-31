-- Phase 4B : alignement des pools fantasy (actifs / banc / reserve blesses).
--
-- Principe central : meme pattern de periodes que pool_roster_periods (Phase 3) et
-- pool_trade_items/pool_waiver_claims (Phase 4A), applique maintenant au POSTE
-- D'ALIGNEMENT (slot) plutot qu'a la propriete. pool_lineup_periods ne concerne QUE les
-- pools fantasy et QUE les joueurs (kind='player') -- l'equipe NHL (kind='team') n'a jamais
-- de ligne ici et compte toujours, comme demande.
--
-- pool_scored_events (Phase 3) est modifiee pour ajouter une colonne "counted" : vrai si le
-- match tombe dans une periode d'alignement ACTIVE (C/LW/RW/D/G/UTIL) -- toujours vrai pour
-- un pool classique ou pour une equipe NHL, peu importe le pool. Rien ne change pour les
-- pools classiques : aucune ligne pool_lineup_periods n'y est jamais creee, et "counted" y
-- est toujours vrai.
--
-- Decision de conception (le poste detaille C/LW/RW/D/G n'a jamais ete stocke avant cette
-- phase -- pool_picks.position et nhl_player_game_stats.position ne connaissent que le
-- regroupement 'F'/'D'/'G') : plutot que de tenter un acces reseau a l'API NHL depuis une
-- migration SQL (pas sa place), le retro-remplissage des positions detaillees existantes se
-- fait via backfill_detailed_positions(), appelee paresseusement par le client au premier
-- chargement de l'onglet Alignement, avec les donnees NHL deja chargees dans la salle de
-- draft (useNhlPlayers -- memes donnees, aucun nouvel appel reseau). Tant qu'un joueur n'a
-- pas encore ete retro-rempli, pool_eligible_slots() retombe sur le regroupement grossier
-- (D/G sans ambiguite ; un attaquant inconnu reste admissible a UTIL uniquement, jamais a
-- C/LW/RW specifiquement, jusqu'au retro-remplissage).

-- ===================== Poste detaille : nouvelles colonnes =====================

alter table pool_picks add column if not exists detailed_position text check (detailed_position in ('C', 'LW', 'RW', 'D', 'G'));
alter table pool_roster_periods add column if not exists detailed_position text check (detailed_position in ('C', 'LW', 'RW', 'D', 'G'));
alter table pool_trade_items add column if not exists detailed_position text check (detailed_position in ('C', 'LW', 'RW', 'D', 'G'));
alter table pool_waiver_claims add column if not exists add_detailed_position text check (add_detailed_position in ('C', 'LW', 'RW', 'D', 'G'));

-- ===================== RPC : retro-remplissage paresseux (declenche par le client) =====================
-- p_assignments : jsonb array de {"player_id": text, "detailed_position": 'C'|'LW'|'RW'|'D'|'G'}.
-- Ne touche jamais une ligne qui a deja une detailed_position (jamais d'ecrasement).

create or replace function public.backfill_detailed_positions(p_pool_id uuid, p_assignments jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_item jsonb;
  v_pos text;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    v_pos := v_item->>'detailed_position';
    if v_pos in ('C', 'LW', 'RW', 'D', 'G') then
      update pool_picks set detailed_position = v_pos
      where pool_id = p_pool_id and kind = 'player' and player_id = v_item->>'player_id' and detailed_position is null;
      update pool_roster_periods set detailed_position = v_pos
      where pool_id = p_pool_id and kind = 'player' and player_id = v_item->>'player_id' and detailed_position is null;
    end if;
  end loop;
end;
$$;

revoke execute on function public.backfill_detailed_positions(uuid, jsonb) from public;
grant execute on function public.backfill_detailed_positions(uuid, jsonb) to authenticated;

-- ===================== Table : periodes d'alignement =====================

create table if not exists pool_lineup_periods (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  member_id uuid not null references pool_members(id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  player_id text not null,
  slot text not null check (slot in ('C', 'LW', 'RW', 'D', 'G', 'UTIL', 'BN', 'IR')),
  from_at timestamptz not null,
  to_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_lineup_periods_lookup on pool_lineup_periods(pool_id, member_id, kind, player_id, from_at);
create index if not exists idx_pool_lineup_periods_open on pool_lineup_periods(pool_id, member_id, kind, player_id) where to_at is null;

alter table pool_lineup_periods enable row level security;
drop policy if exists "pool_lineup_periods_select_same_pool" on pool_lineup_periods;
create policy "pool_lineup_periods_select_same_pool" on pool_lineup_periods
  for select using (is_pool_member(pool_id));

-- ===================== Helpers internes =====================

create or replace function public.pool_is_fantasy(p_pool_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(rules->>'poolType', 'classic') = 'fantasy' from pools where id = p_pool_id;
$$;

revoke execute on function public.pool_is_fantasy(uuid) from public;

-- Postes admissibles selon le poste detaille (prioritaire) ou, a defaut (pas encore
-- retro-rempli), selon le regroupement grossier -- voir note de conception en tete de
-- fichier. UTIL = patineur seulement (jamais un gardien) ; IR accepte tout le monde (aucune
-- source de donnees de blessure fiable n'est synchronisee actuellement, cf. items reportes).
create or replace function public.pool_eligible_slots(p_pos_group text, p_detailed_position text)
returns text[]
language sql
immutable
as $$
  select case
    when p_detailed_position = 'C' then array['C', 'UTIL', 'BN', 'IR']
    when p_detailed_position = 'LW' then array['LW', 'UTIL', 'BN', 'IR']
    when p_detailed_position = 'RW' then array['RW', 'UTIL', 'BN', 'IR']
    when p_detailed_position = 'D' then array['D', 'UTIL', 'BN', 'IR']
    when p_detailed_position = 'G' then array['G', 'BN', 'IR']
    when p_pos_group = 'G' then array['G', 'BN', 'IR']
    when p_pos_group = 'D' then array['D', 'UTIL', 'BN', 'IR']
    when p_pos_group = 'F' then array['UTIL', 'BN', 'IR']
    else array['BN', 'IR']
  end;
$$;

-- "Maintenant" en mode daily (les changements sont immediats), le prochain lundi 00:00
-- America/Toronto strictement futur en mode weekly (si aujourd'hui est lundi, la semaine en
-- cours est deja verrouillee : la cible devient lundi PROCHAIN, +7 jours). Leve une erreur en
-- mode fixed : aucun appel direct (set_lineup/auto_fill_lineup) n'y est jamais autorise.
create or replace function public.pool_lineup_target_time(p_pool_id uuid)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_mode text;
  v_today date;
  v_days_until_monday int;
begin
  select coalesce(rules->>'lineup', 'fixed') into v_mode from pools where id = p_pool_id;
  if v_mode = 'daily' then
    return now();
  elsif v_mode = 'weekly' then
    v_today := (now() at time zone 'America/Toronto')::date;
    v_days_until_monday := (8 - extract(isodow from v_today)::int) % 7;
    if v_days_until_monday = 0 then v_days_until_monday := 7; end if;
    return (v_today + v_days_until_monday)::timestamp at time zone 'America/Toronto';
  else
    raise exception 'pool_lineup_error_fixed_locked';
  end if;
end;
$$;

revoke execute on function public.pool_lineup_target_time(uuid) from public;

-- Vrai si le joueur a un match AUJOURD'HUI (heure de l'Est) deja commence -- seul cas de
-- verrou en mode daily ("verrouillage par match, pas pour toute la journee" : un joueur sans
-- match aujourd'hui, ou dont le match n'a pas encore commence, reste modifiable).
create or replace function public.pool_player_locked_today(p_nhl_team text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from nhl_games gm
    where gm.game_date = (now() at time zone 'America/Toronto')::date
      and (gm.home_abbrev = p_nhl_team or gm.away_abbrev = p_nhl_team)
      and gm.start_time_utc <= now()
  );
$$;

revoke execute on function public.pool_player_locked_today(text) from public;

-- Ferme (si besoin) la periode d'alignement ouverte d'un joueur et en ouvre une nouvelle a
-- p_at. Gere aussi bien le cas "premiere soumission" (periode ouverte anterieure a p_at,
-- fermee normalement) que les resoumissions AVANT que p_at soit atteint (mode weekly : la
-- periode "en attente" ouverte a p_at est remplacee plutot que dupliquee).
create or replace function public.apply_lineup_slot(p_pool_id uuid, p_member_id uuid, p_kind text, p_player_id text, p_slot text, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update pool_lineup_periods set to_at = p_at
  where pool_id = p_pool_id and member_id = p_member_id and kind = p_kind and player_id = p_player_id
    and to_at is null and from_at < p_at;

  delete from pool_lineup_periods
  where pool_id = p_pool_id and member_id = p_member_id and kind = p_kind and player_id = p_player_id
    and to_at is null and from_at = p_at;

  insert into pool_lineup_periods (pool_id, member_id, kind, player_id, slot, from_at, to_at)
  values (p_pool_id, p_member_id, p_kind, p_player_id, p_slot, p_at, null);
end;
$$;

revoke execute on function public.apply_lineup_slot(uuid, uuid, text, text, text, timestamptz) from public;

-- Assigne un alignement initial aux joueurs d'un membre qui n'en ont pas encore (idempotent :
-- ignore tout joueur ayant deja une periode d'alignement ouverte). Priorite par ordre de
-- repechage (pick_no croissant), puis meilleur poste admissible disponible, puis banc.
-- Jamais IR (une mise en reserve blesses est toujours une action deliberee).
create or replace function public.seed_initial_lineup(p_pool_id uuid, p_member_id uuid, p_at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_roster jsonb;
  v_rec record;
  v_used_c int := 0; v_used_lw int := 0; v_used_rw int := 0; v_used_d int := 0; v_used_g int := 0; v_used_util int := 0;
  v_quota_c int; v_quota_lw int; v_quota_rw int; v_quota_d int; v_quota_g int; v_quota_util int;
  v_slot text;
begin
  select coalesce(rules->'roster', '{}'::jsonb) into v_roster from pools where id = p_pool_id;
  v_quota_c := coalesce((v_roster->>'C')::int, 0);
  v_quota_lw := coalesce((v_roster->>'LW')::int, 0);
  v_quota_rw := coalesce((v_roster->>'RW')::int, 0);
  v_quota_d := coalesce((v_roster->>'D')::int, 0);
  v_quota_g := coalesce((v_roster->>'G')::int, 0);
  v_quota_util := coalesce((v_roster->>'UTIL')::int, 0);

  select
    count(*) filter (where lp.slot = 'C'), count(*) filter (where lp.slot = 'LW'), count(*) filter (where lp.slot = 'RW'),
    count(*) filter (where lp.slot = 'D'), count(*) filter (where lp.slot = 'G'), count(*) filter (where lp.slot = 'UTIL')
  into v_used_c, v_used_lw, v_used_rw, v_used_d, v_used_g, v_used_util
  from pool_lineup_periods lp
  where lp.pool_id = p_pool_id and lp.member_id = p_member_id and lp.to_at is null;

  for v_rec in
    select prp.kind, prp.player_id, prp.pos_group, prp.detailed_position, pp.pick_no
    from pool_roster_periods prp
    left join pool_picks pp on pp.pool_id = prp.pool_id and pp.kind = prp.kind and pp.player_id = prp.player_id
    where prp.pool_id = p_pool_id and prp.member_id = p_member_id and prp.kind = 'player' and prp.to_at is null
      and not exists (
        select 1 from pool_lineup_periods lp
        where lp.pool_id = prp.pool_id and lp.member_id = prp.member_id and lp.kind = prp.kind and lp.player_id = prp.player_id and lp.to_at is null
      )
    order by pp.pick_no asc nulls last
  loop
    v_slot := null;
    if v_rec.detailed_position = 'C' and v_used_c < v_quota_c then v_slot := 'C'; v_used_c := v_used_c + 1;
    elsif v_rec.detailed_position = 'LW' and v_used_lw < v_quota_lw then v_slot := 'LW'; v_used_lw := v_used_lw + 1;
    elsif v_rec.detailed_position = 'RW' and v_used_rw < v_quota_rw then v_slot := 'RW'; v_used_rw := v_used_rw + 1;
    elsif v_rec.detailed_position = 'D' and v_used_d < v_quota_d then v_slot := 'D'; v_used_d := v_used_d + 1;
    elsif v_rec.detailed_position = 'G' and v_used_g < v_quota_g then v_slot := 'G'; v_used_g := v_used_g + 1;
    elsif v_rec.pos_group = 'D' and v_used_d < v_quota_d then v_slot := 'D'; v_used_d := v_used_d + 1;
    elsif v_rec.pos_group = 'G' and v_used_g < v_quota_g then v_slot := 'G'; v_used_g := v_used_g + 1;
    end if;

    if v_slot is null and v_rec.pos_group <> 'G' and v_used_util < v_quota_util then
      v_slot := 'UTIL'; v_used_util := v_used_util + 1;
    end if;

    if v_slot is null then v_slot := 'BN'; end if;

    insert into pool_lineup_periods (pool_id, member_id, kind, player_id, slot, from_at, to_at)
    values (p_pool_id, p_member_id, v_rec.kind, v_rec.player_id, v_slot, p_at, null);
  end loop;
end;
$$;

revoke execute on function public.seed_initial_lineup(uuid, uuid, timestamptz) from public;

-- ===================== advance_draft_pick : seme aussi l'alignement initial (fantasy) =====================
-- Signature et type de retour inchanges (returns void) par rapport a 20261104/20261108 :
-- create or replace suffit.

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
  v_member record;
begin
  select * into v_pool from pools where id = p_pool_id;
  v_next_pick := coalesce((v_pool.draft_state->>'current_pick')::int, 0) + 1;
  if v_next_pick > coalesce((v_pool.draft_state->>'total_picks')::int, 0) then
    v_scoring_start := coalesce(v_pool.scoring_start_at, now());
    update pools set status = 'active',
      scoring_start_at = v_scoring_start,
      draft_state = draft_state || jsonb_build_object('current_pick', v_next_pick, 'pick_deadline', null)
    where id = p_pool_id;

    insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
    select pp.pool_id, pp.member_id, pp.kind, pp.player_id, pp.player_name, pp.position, pp.detailed_position, pp.nhl_team, pp.salary, v_scoring_start, null
    from pool_picks pp
    where pp.pool_id = p_pool_id
      and not exists (
        select 1 from pool_roster_periods prp
        where prp.pool_id = pp.pool_id and prp.member_id = pp.member_id
          and prp.kind = pp.kind and prp.player_id = pp.player_id
      );

    if pool_is_fantasy(p_pool_id) then
      for v_member in select distinct member_id from pool_picks where pool_id = p_pool_id loop
        perform seed_initial_lineup(p_pool_id, v_member.member_id, v_scoring_start);
      end loop;
    end if;
  else
    v_seconds := coalesce((v_pool.rules->'draft'->>'secondsPerPick')::int, 60);
    update pools set
      draft_state = draft_state || jsonb_build_object('current_pick', v_next_pick, 'pick_deadline', to_jsonb(now() + (v_seconds || ' seconds')::interval))
    where id = p_pool_id;
  end if;
end;
$$;

revoke execute on function public.advance_draft_pick(uuid) from public;

-- ===================== make_pick / auto_pick / commissioner_pick : capturent le poste detaille =====================
-- Contrairement a une premiere intuition, Postgres NE traite PAS l'ajout d'un parametre
-- (meme avec une valeur par defaut) comme un remplacement : verifie empiriquement lors des
-- tests locaux, "create or replace" cree alors une SECONDE fonction en surcharge et laisse
-- l'ancienne signature pleinement vivante (et son GRANT EXECUTE anterieur toujours actif) --
-- exactement le meme piege que pour un changement de type de retour. Il faut donc DROP
-- explicitement chaque ancienne signature avant de creer la nouvelle.

drop function if exists public.make_pick(uuid, text, text, text, text, text, numeric, boolean);

create or replace function public.make_pick(
  p_pool_id uuid, p_kind text, p_player_id text, p_player_name text,
  p_position text, p_nhl_team text, p_salary numeric, p_is_manual boolean,
  p_detailed_position text default null
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

  insert into pool_picks (pool_id, member_id, round, pick_no, kind, player_id, player_name, position, detailed_position, nhl_team, salary, is_manual)
  values (
    p_pool_id, v_current_member_id, v_round,
    case when v_is_free_team_pick then null else (v_pool.draft_state->>'current_pick')::int end,
    p_kind, p_player_id, p_player_name, p_position, p_detailed_position, p_nhl_team, p_salary, coalesce(p_is_manual, false)
  );

  if not v_is_free_team_pick then
    perform advance_draft_pick(p_pool_id);
  end if;
end;
$$;

revoke execute on function public.make_pick(uuid, text, text, text, text, text, numeric, boolean, text) from public;
grant execute on function public.make_pick(uuid, text, text, text, text, text, numeric, boolean, text) to authenticated;

drop function if exists public.auto_pick(uuid, text, text, text, text, text, numeric);

create or replace function public.auto_pick(
  p_pool_id uuid, p_kind text, p_player_id text, p_player_name text,
  p_position text, p_nhl_team text, p_salary numeric,
  p_detailed_position text default null
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

  insert into pool_picks (pool_id, member_id, round, pick_no, kind, player_id, player_name, position, detailed_position, nhl_team, salary, is_manual)
  values (p_pool_id, v_current_member_id, v_round, (v_pool.draft_state->>'current_pick')::int, p_kind, p_player_id, p_player_name, p_position, p_detailed_position, p_nhl_team, p_salary, false);

  perform advance_draft_pick(p_pool_id);
end;
$$;

revoke execute on function public.auto_pick(uuid, text, text, text, text, text, numeric, text) from public;
grant execute on function public.auto_pick(uuid, text, text, text, text, text, numeric, text) to authenticated;

drop function if exists public.commissioner_pick(uuid, uuid, text, text, text, text, text, numeric, boolean);

create or replace function public.commissioner_pick(
  p_pool_id uuid, p_member_id uuid, p_kind text, p_player_id text, p_player_name text,
  p_position text, p_nhl_team text, p_salary numeric, p_is_manual boolean,
  p_detailed_position text default null
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

  insert into pool_picks (pool_id, member_id, round, pick_no, kind, player_id, player_name, position, detailed_position, nhl_team, salary, is_manual)
  values (
    p_pool_id, v_current_member_id, v_round,
    case when v_is_free_team_pick then null else (v_pool.draft_state->>'current_pick')::int end,
    p_kind, p_player_id, p_player_name, p_position, p_detailed_position, p_nhl_team, p_salary, coalesce(p_is_manual, false)
  );

  if not v_is_free_team_pick then
    perform advance_draft_pick(p_pool_id);
  end if;
end;
$$;

revoke execute on function public.commissioner_pick(uuid, uuid, text, text, text, text, text, numeric, boolean, text) from public;
grant execute on function public.commissioner_pick(uuid, uuid, text, text, text, text, text, numeric, boolean, text) to authenticated;

-- ===================== execute_trade : libere/alimente l'alignement (fantasy) =====================
-- Signature et retour inchanges : create or replace suffit.
-- "un joueur echange libere son poste" : la periode d'alignement de l'ancien proprietaire se
-- ferme avec le roster. Le nouveau proprietaire recoit le joueur au banc, SAUF en mode fixed
-- ou le joueur va directement au poste qui vient d'etre libere chez l'ancien proprietaire si
-- il y est admissible (seule facon d'utiliser ce poste en mode fixed, qui ne permet aucun
-- reamenagement manuel).

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
  v_is_fantasy boolean;
  v_lineup_mode text;
  v_freed_by_member jsonb := '{}'::jsonb;
  v_freed_list jsonb;
  v_new_slot text;
  v_pos int;
  v_i int;
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

  v_is_fantasy := pool_is_fantasy(v_trade.pool_id);
  select coalesce(rules->>'lineup', 'fixed') into v_lineup_mode from pools where id = v_trade.pool_id;

  -- Premiere passe : ferme les periodes (roster + alignement) de chaque cedant. Un poste
  -- qui se libere EST celui du membre qui cede le joueur (from_member_id), pas celui du
  -- joueur lui-meme chez son ancien proprietaire -- on l'accumule par membre cedant pour
  -- que la deuxieme passe puisse l'offrir a CE QUE CE MEME MEMBRE RECOIT en echange (et non
  -- a l'autre cote de l'echange).
  for v_item in select * from pool_trade_items ti where ti.trade_id = p_trade_id loop
    update pool_roster_periods set to_at = v_close_at, closed_reason = 'trade'
    where pool_id = v_trade.pool_id and member_id = v_item.from_member_id
      and kind = v_item.kind and player_id = v_item.player_id and to_at is null;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'pool_trade_error_invalid_ownership'; end if;

    if v_is_fantasy and v_item.kind = 'player' then
      select slot into v_new_slot from pool_lineup_periods
      where pool_id = v_trade.pool_id and member_id = v_item.from_member_id and kind = v_item.kind and player_id = v_item.player_id and to_at is null;

      update pool_lineup_periods set to_at = v_close_at
      where pool_id = v_trade.pool_id and member_id = v_item.from_member_id and kind = v_item.kind and player_id = v_item.player_id and to_at is null;

      if v_new_slot is not null then
        v_freed_list := coalesce(v_freed_by_member->(v_item.from_member_id::text), '[]'::jsonb);
        v_freed_by_member := jsonb_set(v_freed_by_member, array[v_item.from_member_id::text], v_freed_list || to_jsonb(v_new_slot));
      end if;
    end if;
  end loop;

  -- Deuxieme passe : ouvre les periodes du cote receveur. En mode fixed, consomme le
  -- PREMIER poste libere encore disponible pour CE membre qui soit admissible au nouveau
  -- joueur (retire de la liste pour ne pas etre reutilise par un 2e joueur recu dans le
  -- meme echange) ; sinon banc.
  for v_item in select * from pool_trade_items ti where ti.trade_id = p_trade_id loop
    insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
    values (v_trade.pool_id, v_item.to_member_id, v_item.kind, v_item.player_id, v_item.player_name, v_item.position, v_item.detailed_position, v_item.nhl_team, v_item.salary, v_open_at, null);

    if v_is_fantasy and v_item.kind = 'player' then
      v_new_slot := 'BN';
      if v_lineup_mode = 'fixed' then
        v_freed_list := coalesce(v_freed_by_member->(v_item.to_member_id::text), '[]'::jsonb);
        v_pos := null;
        for v_i in 0..coalesce(jsonb_array_length(v_freed_list), 1) - 1 loop
          if (v_freed_list->v_i)#>>'{}' = any(pool_eligible_slots(v_item.position, v_item.detailed_position)) then
            v_pos := v_i;
            exit;
          end if;
        end loop;
        if v_pos is not null then
          v_new_slot := (v_freed_list->v_pos)#>>'{}';
          v_freed_list := v_freed_list - v_pos;
          v_freed_by_member := jsonb_set(v_freed_by_member, array[v_item.to_member_id::text], v_freed_list);
        end if;
      end if;

      insert into pool_lineup_periods (pool_id, member_id, kind, player_id, slot, from_at, to_at)
      values (v_trade.pool_id, v_item.to_member_id, v_item.kind, v_item.player_id, v_new_slot, v_open_at, null);
    end if;
  end loop;

  insert into pool_transactions (pool_id, member_id, type, details)
  values
    (v_trade.pool_id, v_trade.proposer_member_id, 'trade', jsonb_build_object('trade_id', p_trade_id, 'gives', v_gives, 'receives', v_receives)),
    (v_trade.pool_id, v_trade.recipient_member_id, 'trade', jsonb_build_object('trade_id', p_trade_id, 'gives', v_receives, 'receives', v_gives));

  update pool_trades set status = 'accepted', executed_at = now() where id = p_trade_id;
end;
$$;

revoke execute on function public.execute_trade(uuid) from public;

-- propose_trade : capture aussi le poste detaille de chaque item (depuis pool_roster_periods,
-- jamais depuis le client) pour que execute_trade puisse decider du poste libere/admissible.

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
      'position', v_prp.pos_group, 'detailed_position', v_prp.detailed_position, 'nhl_team', v_prp.nhl_team, 'salary', v_prp.salary
    );
  end loop;

  for v_item in select * from jsonb_array_elements(p_receives) loop
    select * into v_prp from pool_roster_periods
    where pool_id = p_pool_id and member_id = p_to_member_id
      and kind = v_item->>'kind' and player_id = v_item->>'player_id' and to_at is null;
    if v_prp.id is null then raise exception 'pool_trade_error_invalid_ownership'; end if;
    v_resolved_receives := v_resolved_receives || jsonb_build_object(
      'kind', v_prp.kind, 'player_id', v_prp.player_id, 'player_name', v_prp.player_name,
      'position', v_prp.pos_group, 'detailed_position', v_prp.detailed_position, 'nhl_team', v_prp.nhl_team, 'salary', v_prp.salary
    );
  end loop;

  v_err := pool_trade_check(p_pool_id, v_proposer_id, p_to_member_id, v_resolved_gives, v_resolved_receives);
  if v_err is not null then raise exception '%', v_err; end if;

  insert into pool_trades (pool_id, proposer_member_id, recipient_member_id, status, message)
  values (p_pool_id, v_proposer_id, p_to_member_id, 'pending', p_message)
  returning id into v_trade_id;

  insert into pool_trade_items (trade_id, from_member_id, to_member_id, kind, player_id, player_name, position, detailed_position, nhl_team, salary)
  select v_trade_id, v_proposer_id, p_to_member_id, x->>'kind', x->>'player_id', x->>'player_name', x->>'position', x->>'detailed_position', x->>'nhl_team', (x->>'salary')::numeric
  from jsonb_array_elements(v_resolved_gives) x;

  insert into pool_trade_items (trade_id, from_member_id, to_member_id, kind, player_id, player_name, position, detailed_position, nhl_team, salary)
  select v_trade_id, p_to_member_id, v_proposer_id, x->>'kind', x->>'player_id', x->>'player_name', x->>'position', x->>'detailed_position', x->>'nhl_team', (x->>'salary')::numeric
  from jsonb_array_elements(v_resolved_receives) x;

  return v_trade_id;
end;
$$;

revoke execute on function public.propose_trade(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function public.propose_trade(uuid, uuid, jsonb, jsonb, text) to authenticated;

-- ===================== add_free_agent / drop_player / process_waivers : idem pour le ballotage =====================
-- Ajoute p_detailed_position en fin de liste -- comme pour make_pick/auto_pick/
-- commissioner_pick plus haut, l'ancienne signature a 9 arguments doit etre explicitement
-- supprimee (sinon elle reste vivante en surcharge, cf. commentaire plus haut).

drop function if exists public.add_free_agent(uuid, text, text, text, text, text, numeric, text, text);

create or replace function public.add_free_agent(
  p_pool_id uuid, p_kind text, p_player_id text, p_player_name text, p_position text, p_nhl_team text, p_salary numeric,
  p_drop_player_id text default null, p_drop_kind text default 'player', p_detailed_position text default null
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
  v_is_fantasy boolean;
  v_lineup_mode text;
  v_freed_slot text;
  v_new_slot text;
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

  v_is_fantasy := pool_is_fantasy(p_pool_id);
  v_freed_slot := null;

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
    if v_is_fantasy and p_drop_kind = 'player' then
      select slot into v_freed_slot from pool_lineup_periods
      where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id and to_at is null;
    end if;
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
      pool_id, member_id, add_player_id, add_kind, add_player_name, add_position, add_detailed_position, add_nhl_team, add_salary,
      drop_player_id, drop_kind, status, process_at
    )
    values (
      p_pool_id, v_member_id, p_player_id, p_kind, p_player_name, p_position, p_detailed_position, p_nhl_team, p_salary,
      p_drop_player_id, p_drop_kind, 'pending', greatest(now(), coalesce(v_dropped_available_at, now()))
    )
    returning id into v_claim_id;
    return jsonb_build_object('claimed', true, 'claim_id', v_claim_id);
  end if;

  if p_drop_player_id is not null then
    update pool_roster_periods set to_at = now(), closed_reason = 'drop'
    where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id and to_at is null;
    if v_is_fantasy and p_drop_kind = 'player' then
      update pool_lineup_periods set to_at = now()
      where pool_id = p_pool_id and member_id = v_member_id and kind = p_drop_kind and player_id = p_drop_player_id and to_at is null;
    end if;
    insert into pool_dropped_players (pool_id, kind, player_id, dropped_by_member_id, available_at)
    values (p_pool_id, p_drop_kind, p_drop_player_id, v_member_id, now() + (v_wait_days || ' days')::interval);
    insert into pool_transactions (pool_id, member_id, type, details)
    values (p_pool_id, v_member_id, 'drop', jsonb_build_object('kind', p_drop_kind, 'player_id', p_drop_player_id));
  end if;

  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
  values (p_pool_id, v_member_id, p_kind, p_player_id, p_player_name, p_position, p_detailed_position, p_nhl_team, p_salary, now(), null);

  if v_is_fantasy and p_kind = 'player' then
    v_new_slot := 'BN';
    select coalesce(rules->>'lineup', 'fixed') into v_lineup_mode from pools where id = p_pool_id;
    if v_lineup_mode = 'fixed' and v_freed_slot is not null and v_freed_slot = any(pool_eligible_slots(p_position, p_detailed_position)) then
      v_new_slot := v_freed_slot;
    end if;
    insert into pool_lineup_periods (pool_id, member_id, kind, player_id, slot, from_at, to_at)
    values (p_pool_id, v_member_id, p_kind, p_player_id, v_new_slot, now(), null);
  end if;

  insert into pool_transactions (pool_id, member_id, type, details)
  values (p_pool_id, v_member_id, 'add', jsonb_build_object('kind', p_kind, 'player_id', p_player_id, 'player_name', p_player_name));

  return jsonb_build_object('claimed', false);
end;
$$;

revoke execute on function public.add_free_agent(uuid, text, text, text, text, text, numeric, text, text, text) from public;
grant execute on function public.add_free_agent(uuid, text, text, text, text, text, numeric, text, text, text) to authenticated;

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

  if pool_is_fantasy(p_pool_id) and p_kind = 'player' then
    update pool_lineup_periods set to_at = now()
    where pool_id = p_pool_id and member_id = v_member_id and kind = p_kind and player_id = p_player_id and to_at is null;
  end if;

  insert into pool_dropped_players (pool_id, kind, player_id, dropped_by_member_id, available_at)
  values (p_pool_id, p_kind, p_player_id, v_member_id, now() + (v_wait_days || ' days')::interval);

  insert into pool_transactions (pool_id, member_id, type, details)
  values (p_pool_id, v_member_id, 'drop', jsonb_build_object('kind', p_kind, 'player_id', p_player_id));
end;
$$;

revoke execute on function public.drop_player(uuid, text, text) from public;
grant execute on function public.drop_player(uuid, text, text) to authenticated;

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
  v_is_fantasy boolean;
  v_lineup_mode text;
  v_freed_slot text;
  v_new_slot text;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null or v_pool.status <> 'active' then return; end if;

  v_claim_order := coalesce(v_pool.rules->'waivers'->>'claimOrder', 'first_come');
  v_cap_enabled := coalesce((v_pool.rules->'salaryCap'->>'enabled')::boolean, false);
  v_cap_amount := coalesce((v_pool.rules->'salaryCap'->>'amount')::numeric, 0);
  v_is_fantasy := pool_is_fantasy(p_pool_id);
  v_lineup_mode := coalesce(v_pool.rules->>'lineup', 'fixed');

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
      v_freed_slot := null;
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
        if v_is_fantasy and coalesce(v_claim.drop_kind, 'player') = 'player' then
          select slot into v_freed_slot from pool_lineup_periods
          where pool_id = p_pool_id and member_id = v_claim.member_id and kind = coalesce(v_claim.drop_kind, 'player')
            and player_id = v_claim.drop_player_id and to_at is null;
        end if;
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
        if v_is_fantasy and coalesce(v_claim.drop_kind, 'player') = 'player' then
          update pool_lineup_periods set to_at = now()
          where pool_id = p_pool_id and member_id = v_claim.member_id and kind = coalesce(v_claim.drop_kind, 'player')
            and player_id = v_claim.drop_player_id and to_at is null;
        end if;
        insert into pool_dropped_players (pool_id, kind, player_id, dropped_by_member_id, available_at)
        values (
          p_pool_id, coalesce(v_claim.drop_kind, 'player'), v_claim.drop_player_id, v_claim.member_id,
          now() + coalesce((v_pool.rules->'waivers'->>'waiverDays')::int, 0) * interval '1 day'
        );
        insert into pool_transactions (pool_id, member_id, type, details)
        values (p_pool_id, v_claim.member_id, 'drop', jsonb_build_object('kind', coalesce(v_claim.drop_kind, 'player'), 'player_id', v_claim.drop_player_id));
      end if;

      insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
      values (p_pool_id, v_claim.member_id, v_claim.add_kind, v_claim.add_player_id, v_claim.add_player_name, v_claim.add_position, v_claim.add_detailed_position, v_claim.add_nhl_team, v_claim.add_salary, now(), null);

      if v_is_fantasy and v_claim.add_kind = 'player' then
        v_new_slot := 'BN';
        if v_lineup_mode = 'fixed' and v_freed_slot is not null and v_freed_slot = any(pool_eligible_slots(v_claim.add_position, v_claim.add_detailed_position)) then
          v_new_slot := v_freed_slot;
        end if;
        insert into pool_lineup_periods (pool_id, member_id, kind, player_id, slot, from_at, to_at)
        values (p_pool_id, v_claim.member_id, v_claim.add_kind, v_claim.add_player_id, v_new_slot, now(), null);
      end if;

      insert into pool_transactions (pool_id, member_id, type, details)
      values (p_pool_id, v_claim.member_id, 'add', jsonb_build_object('kind', v_claim.add_kind, 'player_id', v_claim.add_player_id, 'player_name', v_claim.add_player_name, 'via_waiver', true));

      update pool_waiver_claims set status = 'won' where id = v_claim.id;
      v_won := true;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.process_waivers(uuid) from public;

-- ===================== RPC : lire l'alignement a une date =====================

drop function if exists public.get_lineup(uuid, uuid, timestamptz);

create or replace function public.get_lineup(p_pool_id uuid, p_member_id uuid, p_at timestamptz default now())
returns table (
  kind text, ref_id text, label text, pos_group text, detailed_position text, team_abbrev text,
  slot text, is_locked boolean, next_game_at timestamptz, next_game_opponent text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  if not pool_is_fantasy(p_pool_id) then raise exception 'pool_lineup_error_not_fantasy'; end if;
  if not exists (select 1 from pool_members pm where pm.id = p_member_id and pm.pool_id = p_pool_id) then
    raise exception 'member_not_in_pool';
  end if;

  return query
  select
    prp.kind, prp.player_id as ref_id, prp.player_name as label, prp.pos_group, prp.detailed_position, prp.nhl_team as team_abbrev,
    coalesce(lp.slot, 'BN') as slot,
    pool_player_locked_today(prp.nhl_team) as is_locked,
    (
      select gm.start_time_utc from nhl_games gm
      where (gm.home_abbrev = prp.nhl_team or gm.away_abbrev = prp.nhl_team) and gm.start_time_utc >= now()
      order by gm.start_time_utc asc limit 1
    ) as next_game_at,
    (
      select case when gm.home_abbrev = prp.nhl_team then gm.away_abbrev else gm.home_abbrev end
      from nhl_games gm
      where (gm.home_abbrev = prp.nhl_team or gm.away_abbrev = prp.nhl_team) and gm.start_time_utc >= now()
      order by gm.start_time_utc asc limit 1
    ) as next_game_opponent
  from pool_roster_periods prp
  left join pool_lineup_periods lp on lp.pool_id = prp.pool_id and lp.member_id = prp.member_id and lp.kind = prp.kind and lp.player_id = prp.player_id
    and lp.from_at <= p_at and (lp.to_at is null or p_at < lp.to_at)
  where prp.pool_id = p_pool_id and prp.member_id = p_member_id and prp.kind = 'player'
    and prp.from_at <= p_at and (prp.to_at is null or p_at < prp.to_at)
  order by
    case coalesce(lp.slot, 'BN')
      when 'C' then 1 when 'LW' then 2 when 'RW' then 3 when 'D' then 4 when 'G' then 5
      when 'UTIL' then 6 when 'BN' then 7 when 'IR' then 8 else 9
    end,
    prp.player_name;
end;
$$;

revoke execute on function public.get_lineup(uuid, uuid, timestamptz) from public;
grant execute on function public.get_lineup(uuid, uuid, timestamptz) to authenticated;

-- ===================== RPC : modifier l'alignement =====================
-- p_assignments : jsonb array de {"kind":"player","player_id":"123","slot":"C"} -- doit
-- couvrir tout changement souhaite en un seul appel (les quotas de places sont verifies sur
-- l'ensemble du lot, pas cumulativement avec l'etat deja en place pour les postes modifies).

create or replace function public.set_lineup(p_pool_id uuid, p_member_id uuid, p_assignments jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_caller_id uuid;
  v_mode text;
  v_effective_at timestamptz;
  v_roster jsonb;
  v_item jsonb;
  v_slot text;
  v_prp record;
  v_current_slot text;
  v_eligible text[];
  v_counts jsonb := '{}'::jsonb;
  v_quota int;
  v_key text;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'active' then raise exception 'pool_not_active'; end if;
  if coalesce(v_pool.rules->>'poolType', 'classic') <> 'fantasy' then raise exception 'pool_lineup_error_not_fantasy'; end if;

  select id into v_caller_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_caller_id is null then raise exception 'not_a_member'; end if;
  if v_caller_id <> p_member_id and not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  v_mode := coalesce(v_pool.rules->>'lineup', 'fixed');
  if v_mode = 'fixed' then raise exception 'pool_lineup_error_fixed_locked'; end if;
  v_effective_at := pool_lineup_target_time(p_pool_id);
  v_roster := coalesce(v_pool.rules->'roster', '{}'::jsonb);

  for v_item in select * from jsonb_array_elements(p_assignments) loop
    v_slot := v_item->>'slot';
    if v_slot not in ('C', 'LW', 'RW', 'D', 'G', 'UTIL', 'BN', 'IR') then raise exception 'pool_lineup_error_invalid_slot'; end if;

    select prp.* into v_prp
    from pool_roster_periods prp
    where prp.pool_id = p_pool_id and prp.member_id = p_member_id
      and prp.kind = (v_item->>'kind') and prp.player_id = (v_item->>'player_id') and prp.to_at is null;
    if v_prp.id is null then raise exception 'pool_trade_error_invalid_ownership'; end if;

    select lp.slot into v_current_slot from pool_lineup_periods lp
    where lp.pool_id = p_pool_id and lp.member_id = p_member_id and lp.kind = v_prp.kind and lp.player_id = v_prp.player_id
      and lp.from_at <= now() and (lp.to_at is null or now() < lp.to_at);

    v_eligible := pool_eligible_slots(v_prp.pos_group, v_prp.detailed_position);
    if not (v_slot = any(v_eligible)) then raise exception 'pool_lineup_error_not_eligible'; end if;

    if v_mode = 'daily' and v_current_slot is distinct from v_slot and pool_player_locked_today(v_prp.nhl_team) then
      raise exception 'pool_lineup_error_player_locked';
    end if;

    v_counts := jsonb_set(v_counts, array[v_slot], to_jsonb(coalesce((v_counts->>v_slot)::int, 0) + 1));
  end loop;

  for v_key in select jsonb_object_keys(v_counts) loop
    if v_key in ('C', 'LW', 'RW', 'D', 'G', 'UTIL') then
      v_quota := coalesce((v_roster->>v_key)::int, 0);
      if (v_counts->>v_key)::int > v_quota then
        raise exception 'pool_lineup_error_slot_full';
      end if;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_assignments) loop
    perform apply_lineup_slot(p_pool_id, p_member_id, v_item->>'kind', v_item->>'player_id', v_item->>'slot', v_effective_at);
  end loop;
end;
$$;

revoke execute on function public.set_lineup(uuid, uuid, jsonb) from public;
grant execute on function public.set_lineup(uuid, uuid, jsonb) to authenticated;

-- ===================== RPC : remplissage automatique =====================
-- Classe les joueurs par forme recente (is_hot) puis points deja marques (proxy serveur de
-- "valeur IA + forme recente" -- la valeur IA elle-meme depend des statistiques saisonnieres
-- en direct de l'API NHL, disponibles cote client, pas ici) ; ne touche jamais un joueur
-- verrouille aujourd'hui en mode daily.

create or replace function public.auto_fill_lineup(p_pool_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pool pools%rowtype;
  v_caller_id uuid;
  v_mode text;
  v_effective_at timestamptz;
  v_roster jsonb;
  v_rec record;
  v_used_c int := 0; v_used_lw int := 0; v_used_rw int := 0; v_used_d int := 0; v_used_g int := 0; v_used_util int := 0;
  v_quota_c int; v_quota_lw int; v_quota_rw int; v_quota_d int; v_quota_g int; v_quota_util int;
  v_slot text;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'active' then raise exception 'pool_not_active'; end if;
  if coalesce(v_pool.rules->>'poolType', 'classic') <> 'fantasy' then raise exception 'pool_lineup_error_not_fantasy'; end if;

  select id into v_caller_id from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if v_caller_id is null then raise exception 'not_a_member'; end if;
  if v_caller_id <> p_member_id and not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  v_mode := coalesce(v_pool.rules->>'lineup', 'fixed');
  if v_mode = 'fixed' then raise exception 'pool_lineup_error_fixed_locked'; end if;
  v_effective_at := pool_lineup_target_time(p_pool_id);

  v_roster := coalesce(v_pool.rules->'roster', '{}'::jsonb);
  v_quota_c := coalesce((v_roster->>'C')::int, 0);
  v_quota_lw := coalesce((v_roster->>'LW')::int, 0);
  v_quota_rw := coalesce((v_roster->>'RW')::int, 0);
  v_quota_d := coalesce((v_roster->>'D')::int, 0);
  v_quota_g := coalesce((v_roster->>'G')::int, 0);
  v_quota_util := coalesce((v_roster->>'UTIL')::int, 0);

  for v_rec in
    select
      mb.kind, mb.ref_id, mb.pos_group, mb.team_abbrev, mb.is_hot, mb.total_points,
      prp.detailed_position,
      mb.current_slot as current_slot
    from get_member_breakdown(p_pool_id, p_member_id) mb
    join pool_roster_periods prp on prp.pool_id = p_pool_id and prp.member_id = p_member_id and prp.kind = mb.kind and prp.player_id = mb.ref_id and prp.to_at is null
    where mb.kind = 'player'
    order by mb.is_hot desc, mb.total_points desc
  loop
    if v_mode = 'daily' and v_rec.current_slot is not null and pool_player_locked_today(v_rec.team_abbrev) then
      continue;
    end if;

    v_slot := null;
    if v_rec.detailed_position = 'C' and v_used_c < v_quota_c then v_slot := 'C'; v_used_c := v_used_c + 1;
    elsif v_rec.detailed_position = 'LW' and v_used_lw < v_quota_lw then v_slot := 'LW'; v_used_lw := v_used_lw + 1;
    elsif v_rec.detailed_position = 'RW' and v_used_rw < v_quota_rw then v_slot := 'RW'; v_used_rw := v_used_rw + 1;
    elsif v_rec.detailed_position = 'D' and v_used_d < v_quota_d then v_slot := 'D'; v_used_d := v_used_d + 1;
    elsif v_rec.detailed_position = 'G' and v_used_g < v_quota_g then v_slot := 'G'; v_used_g := v_used_g + 1;
    elsif v_rec.pos_group = 'D' and v_used_d < v_quota_d then v_slot := 'D'; v_used_d := v_used_d + 1;
    elsif v_rec.pos_group = 'G' and v_used_g < v_quota_g then v_slot := 'G'; v_used_g := v_used_g + 1;
    end if;

    if v_slot is null and v_rec.pos_group <> 'G' and v_used_util < v_quota_util then
      v_slot := 'UTIL'; v_used_util := v_used_util + 1;
    end if;

    if v_slot is null then v_slot := 'BN'; end if;

    if v_slot is distinct from v_rec.current_slot then
      perform apply_lineup_slot(p_pool_id, p_member_id, v_rec.kind, v_rec.ref_id, v_slot, v_effective_at);
    end if;
  end loop;
end;
$$;

revoke execute on function public.auto_fill_lineup(uuid, uuid) from public;
grant execute on function public.auto_fill_lineup(uuid, uuid) to authenticated;

-- ===================== pool_scored_events : ajoute "counted" (actif vs banc/IR) =====================
-- Type de retour change (nouvelle colonne) : drop requis. Pour un pool CLASSIQUE ou pour une
-- equipe NHL (kind='team'), counted est toujours vrai -- rien ne change dans ces cas.

drop function if exists public.pool_scored_events(uuid);

create or replace function public.pool_scored_events(p_pool_id uuid)
returns table (
  member_id uuid,
  kind text,
  ref_id text,
  label text,
  pos_group text,
  game_id bigint,
  start_time_utc timestamptz,
  stats jsonb,
  points_by_category jsonb,
  points numeric,
  counted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rules jsonb;
  v_is_fantasy boolean;
begin
  select rules into v_rules from pools where id = p_pool_id;
  v_is_fantasy := coalesce(v_rules->>'poolType', 'classic') = 'fantasy';

  return query
  with fwd as (select coalesce(v_rules->'scoring'->'forward', '{}'::jsonb) as sc),
  def as (select coalesce(v_rules->'scoring'->'defense', '{}'::jsonb) as sc),
  goalie as (select coalesce(v_rules->'scoring'->'goalie', '{}'::jsonb) as sc),
  team as (select coalesce(v_rules->'scoring'->'team', '{}'::jsonb) as sc),
  player_events as (
    select
      prp.member_id,
      'player'::text as kind,
      prp.player_id as ref_id,
      s.player_name as label,
      s.position as pos_group,
      s.game_id,
      g.start_time_utc,
      case
        when s.position = 'G' then jsonb_build_object(
          'goals', s.goalie_goals, 'assists', s.goalie_assists,
          'wins', case when s.decision = 'W' then 1 else 0 end,
          'shutouts', case when s.shutout then 1 else 0 end,
          'saves', s.saves, 'goalsAgainst', s.goals_against,
          'otLosses', case when s.decision = 'OTL' then 1 else 0 end
        )
        else jsonb_build_object(
          'goals', s.goals, 'assists', s.assists, 'powerPlayPoints', s.power_play_points,
          'shortHandedPoints', s.short_handed_points, 'shotsOnGoal', s.shots_on_goal,
          'hits', s.hits, 'blockedShots', s.blocked_shots, 'pim', s.pim,
          'plusMinus', s.plus_minus, 'gameWinningGoals', s.game_winning_goals
        )
      end as stats,
      case
        when s.position = 'G' then jsonb_build_object(
          'goals', s.goalie_goals * coalesce((goalie.sc->>'goals')::numeric, 0),
          'assists', s.goalie_assists * coalesce((goalie.sc->>'assists')::numeric, 0),
          'wins', (case when s.decision = 'W' then 1 else 0 end) * coalesce((goalie.sc->>'wins')::numeric, 0),
          'shutouts', (case when s.shutout then 1 else 0 end) * coalesce((goalie.sc->>'shutouts')::numeric, 0),
          'saves', s.saves * coalesce((goalie.sc->>'saves')::numeric, 0),
          'goalsAgainst', s.goals_against * coalesce((goalie.sc->>'goalsAgainst')::numeric, 0),
          'otLosses', (case when s.decision = 'OTL' then 1 else 0 end) * coalesce((goalie.sc->>'otLosses')::numeric, 0)
        )
        when s.position = 'D' then jsonb_build_object(
          'goals', s.goals * coalesce((def.sc->>'goals')::numeric, 0),
          'assists', s.assists * coalesce((def.sc->>'assists')::numeric, 0),
          'powerPlayPoints', s.power_play_points * coalesce((def.sc->>'powerPlayPoints')::numeric, 0),
          'shortHandedPoints', s.short_handed_points * coalesce((def.sc->>'shortHandedPoints')::numeric, 0),
          'shotsOnGoal', s.shots_on_goal * coalesce((def.sc->>'shotsOnGoal')::numeric, 0),
          'hits', s.hits * coalesce((def.sc->>'hits')::numeric, 0),
          'blockedShots', s.blocked_shots * coalesce((def.sc->>'blockedShots')::numeric, 0),
          'pim', s.pim * coalesce((def.sc->>'pim')::numeric, 0),
          'plusMinus', s.plus_minus * coalesce((def.sc->>'plusMinus')::numeric, 0),
          'gameWinningGoals', s.game_winning_goals * coalesce((def.sc->>'gameWinningGoals')::numeric, 0)
        )
        else jsonb_build_object(
          'goals', s.goals * coalesce((fwd.sc->>'goals')::numeric, 0),
          'assists', s.assists * coalesce((fwd.sc->>'assists')::numeric, 0),
          'powerPlayPoints', s.power_play_points * coalesce((fwd.sc->>'powerPlayPoints')::numeric, 0),
          'shortHandedPoints', s.short_handed_points * coalesce((fwd.sc->>'shortHandedPoints')::numeric, 0),
          'shotsOnGoal', s.shots_on_goal * coalesce((fwd.sc->>'shotsOnGoal')::numeric, 0),
          'hits', s.hits * coalesce((fwd.sc->>'hits')::numeric, 0),
          'blockedShots', s.blocked_shots * coalesce((fwd.sc->>'blockedShots')::numeric, 0),
          'pim', s.pim * coalesce((fwd.sc->>'pim')::numeric, 0),
          'plusMinus', s.plus_minus * coalesce((fwd.sc->>'plusMinus')::numeric, 0),
          'gameWinningGoals', s.game_winning_goals * coalesce((fwd.sc->>'gameWinningGoals')::numeric, 0)
        )
      end as points_by_category,
      (
        not v_is_fantasy
        or exists (
          select 1 from pool_lineup_periods lp
          where lp.pool_id = prp.pool_id and lp.member_id = prp.member_id and lp.kind = 'player' and lp.player_id = prp.player_id
            and lp.slot in ('C', 'LW', 'RW', 'D', 'G', 'UTIL')
            and g.start_time_utc >= lp.from_at and (lp.to_at is null or g.start_time_utc < lp.to_at)
        )
      ) as counted
    from pool_roster_periods prp
    join nhl_player_game_stats s on s.player_id::text = prp.player_id and prp.kind = 'player'
    join nhl_games g on g.game_id = s.game_id
    cross join fwd cross join def cross join goalie
    where prp.pool_id = p_pool_id
      and g.state in ('FINAL', 'OFF')
      and g.start_time_utc >= prp.from_at
      and (prp.to_at is null or g.start_time_utc < prp.to_at)
  ),
  team_events as (
    select
      prp.member_id,
      'team'::text as kind,
      prp.player_id as ref_id,
      prp.player_id as label,
      'TEAM'::text as pos_group,
      r.game_id,
      g.start_time_utc,
      jsonb_build_object(
        'wins', case when r.result = 'W' then 1 else 0 end,
        'overtimeLosses', case when r.result = 'OTL' then 1 else 0 end,
        'shootoutLosses', case when r.result = 'SOL' then 1 else 0 end
      ) as stats,
      jsonb_build_object(
        'wins', (case when r.result = 'W' then 1 else 0 end) * coalesce((team.sc->>'wins')::numeric, 0),
        'overtimeLosses', (case when r.result = 'OTL' then 1 else 0 end) * coalesce((team.sc->>'overtimeLosses')::numeric, 0),
        'shootoutLosses', (case when r.result = 'SOL' then 1 else 0 end) * coalesce((team.sc->>'shootoutLosses')::numeric, 0)
      ) as points_by_category,
      true as counted
    from pool_roster_periods prp
    join nhl_team_game_results r on r.team_abbrev = prp.player_id and prp.kind = 'team'
    join nhl_games g on g.game_id = r.game_id
    cross join team
    where prp.pool_id = p_pool_id
      and g.state in ('FINAL', 'OFF')
      and g.start_time_utc >= prp.from_at
      and (prp.to_at is null or g.start_time_utc < prp.to_at)
  ),
  all_events as (
    select * from player_events union all select * from team_events
  )
  select
    e.member_id, e.kind, e.ref_id, e.label, e.pos_group, e.game_id, e.start_time_utc,
    e.stats, e.points_by_category,
    coalesce((select sum(v::numeric) from jsonb_each_text(e.points_by_category) kv(k, v)), 0) as points,
    e.counted
  from all_events e;
end;
$$;

revoke execute on function public.pool_scored_events(uuid) from public;

-- ===================== get_pool_standings : seuls les points "counted" comptent =====================
-- Colonnes de sortie inchangees (today_points/total_points/etc. restent des numeric) :
-- create or replace suffit, seules les sommations internes changent (filter where counted).

create or replace function public.get_pool_standings(p_pool_id uuid)
returns table (
  member_id uuid,
  display_name text,
  team_name text,
  today_games_played int,
  today_points numeric,
  today_avg numeric,
  total_games_played int,
  total_points numeric,
  total_avg numeric,
  total_diff numeric,
  yesterday_points numeric,
  rank int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_today date;
  v_yesterday date;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  v_today := (now() at time zone 'America/New_York')::date;
  v_yesterday := v_today - 1;

  return query
  with events as (
    select * from pool_scored_events(p_pool_id)
  ),
  totals as (
    select
      pm.id as member_id,
      pm.display_name as display_name,
      pm.team_name as team_name,
      count(ev.game_id) filter (where (ev.start_time_utc at time zone 'America/New_York')::date = v_today) as today_games_played,
      coalesce(sum(ev.points) filter (where ev.counted and (ev.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points,
      count(ev.game_id) as total_games_played,
      coalesce(sum(ev.points) filter (where ev.counted), 0) as total_points,
      coalesce(sum(ev.points) filter (where ev.counted and (ev.start_time_utc at time zone 'America/New_York')::date = v_yesterday), 0) as yesterday_points
    from pool_members pm
    left join events ev on ev.member_id = pm.id
    where pm.pool_id = p_pool_id
    group by pm.id, pm.display_name, pm.team_name
  ),
  ranked as (
    select
      tt.member_id as member_id,
      tt.display_name as display_name,
      tt.team_name as team_name,
      tt.today_games_played as today_games_played,
      tt.today_points as today_points,
      tt.total_games_played as total_games_played,
      tt.total_points as total_points,
      tt.yesterday_points as yesterday_points,
      rank() over (order by tt.total_points desc) as rnk,
      max(tt.total_points) over () as leader_points
    from totals tt
  )
  select
    rk.member_id,
    rk.display_name,
    rk.team_name,
    rk.today_games_played::int,
    rk.today_points,
    case when rk.today_games_played > 0 then round(rk.today_points / rk.today_games_played, 1) else 0 end as today_avg,
    rk.total_games_played::int,
    rk.total_points,
    case when rk.total_games_played > 0 then round(rk.total_points / rk.total_games_played, 1) else 0 end as total_avg,
    (rk.leader_points - rk.total_points) as total_diff,
    rk.yesterday_points,
    rk.rnk::int as rank
  from ranked rk
  order by rk.total_points desc, rk.display_name;
end;
$$;

revoke execute on function public.get_pool_standings(uuid) from public;
grant execute on function public.get_pool_standings(uuid) to authenticated;

-- ===================== get_pool_top_scorers_today : idem, seuls les points comptes =====================

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
    where ev.kind = 'player' and ev.counted and (ev.start_time_utc at time zone 'America/New_York')::date = v_today
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

-- ===================== get_member_breakdown : poste d'alignement + points sur le banc =====================
-- Type de retour change (current_slot, bench_points) : drop requis.

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
  closed_reason text,
  current_slot text,
  bench_points numeric
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
      coalesce(sum(ew.points) filter (where ew.counted), 0) as total_points,
      coalesce(sum(ew.points) filter (where not ew.counted), 0) as bench_points
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
  ),
  -- "to_at is null" seul ne suffit pas : une periode future deja creee (mode weekly, pas
  -- encore entree en vigueur) a aussi to_at null tant qu'elle n'est pas fermee a son tour.
  -- Il faut borner explicitement par from_at <= now() <= to_at (comme get_lineup) pour que
  -- current_slot refere bien a l'instant present, pas a la derniere periode creee.
  slot_now as (
    select lp.kind as kind, lp.player_id as ref_id, lp.slot as slot
    from pool_lineup_periods lp
    where lp.pool_id = p_pool_id and lp.member_id = p_member_id
      and lp.from_at <= now() and (lp.to_at is null or now() < lp.to_at)
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
    r.closed_reason,
    coalesce(sn.slot, case when r.kind = 'team' then 'TEAM' else null end) as current_slot,
    coalesce(aw.bench_points, 0) as bench_points
  from roster r
  left join agg_window aw on aw.ref_id = r.ref_id and aw.kind = r.kind
  left join trend tr on tr.ref_id = r.ref_id and tr.kind = r.kind
  left join pick_meta pk on pk.ref_id = r.ref_id and pk.kind = r.kind
  left join slot_now sn on sn.ref_id = r.ref_id and sn.kind = r.kind
  order by r.is_active desc, coalesce(aw.total_points, 0) desc, pk.pick_no asc nulls last;
end;
$$;

revoke execute on function public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz) to authenticated;

-- ===================== Retro-remplissage ponctuel : pools fantasy deja actifs =====================
-- Seme un alignement initial pour tout membre d'un pool fantasy deja 'active' qui n'a encore
-- aucune periode d'alignement (pools crees/draftes avant cette migration). Idempotent
-- (seed_initial_lineup ignore deja tout joueur ayant une periode ouverte).

do $$
declare
  v_member record;
begin
  for v_member in
    select pm.pool_id, pm.id as member_id
    from pool_members pm
    join pools p on p.id = pm.pool_id
    where p.status = 'active' and coalesce(p.rules->>'poolType', 'classic') = 'fantasy'
      and exists (select 1 from pool_roster_periods prp where prp.pool_id = pm.pool_id and prp.member_id = pm.id and prp.kind = 'player' and prp.to_at is null)
  loop
    perform seed_initial_lineup(v_member.pool_id, v_member.member_id, now());
  end loop;
end $$;
