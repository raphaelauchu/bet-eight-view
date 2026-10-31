-- Phase 3 : moteur de pointage et classement.
--
-- 1) Tables NHL partagees par tous les pools (remplies par l'Edge Function sync-nhl-stats,
--    qui utilise la cle service_role -- jamais exposee au client). Lecture ouverte aux
--    utilisateurs connectes ; aucune policy d'ecriture n'est ajoutee pour authenticated/anon,
--    donc seule la cle service_role (qui contourne RLS) peut ecrire.
-- 2) pool_roster_periods : qui "possedait" un joueur/une equipe NHL a quel moment. Alimente
--    a la fin du draft (voir advance_draft_pick plus bas) ; base pour les echanges (Phase 4),
--    qui fermeront une periode et en ouvriront une autre.
-- 3) RPC de calcul : get_pool_standings, get_member_breakdown, get_pool_daily_points.
--    Le client ne calcule jamais les points lui-meme.

-- ===================== Donnees NHL partagees =====================

create table if not exists nhl_games (
  game_id bigint primary key,
  game_date date not null,
  start_time_utc timestamptz not null,
  season text not null,
  state text not null check (state in ('FUT', 'LIVE', 'FINAL', 'OFF')),
  home_abbrev text not null,
  away_abbrev text not null,
  home_score int,
  away_score int,
  last_period_type text check (last_period_type in ('REG', 'OT', 'SO')),
  winner_abbrev text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_nhl_games_date on nhl_games(game_date);
create index if not exists idx_nhl_games_season_state on nhl_games(season, state);

create table if not exists nhl_player_game_stats (
  game_id bigint not null references nhl_games(game_id) on delete cascade,
  player_id bigint not null,
  player_name text not null,
  position text not null check (position in ('F', 'D', 'G')),
  team_abbrev text not null,
  goals int not null default 0,
  assists int not null default 0,
  points int not null default 0,
  power_play_points int not null default 0,
  short_handed_points int not null default 0,
  shots_on_goal int not null default 0,
  hits int not null default 0,
  blocked_shots int not null default 0,
  pim int not null default 0,
  plus_minus int not null default 0,
  game_winning_goals int not null default 0,
  decision text check (decision in ('W', 'L', 'OTL')),
  shutout boolean not null default false,
  saves int not null default 0,
  goals_against int not null default 0,
  goalie_goals int not null default 0,
  goalie_assists int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create index if not exists idx_nhl_player_game_stats_player on nhl_player_game_stats(player_id);

create table if not exists nhl_team_game_results (
  game_id bigint not null references nhl_games(game_id) on delete cascade,
  team_abbrev text not null,
  result text not null check (result in ('W', 'OTL', 'SOL', 'L')),
  updated_at timestamptz not null default now(),
  primary key (game_id, team_abbrev)
);

create index if not exists idx_nhl_team_game_results_team on nhl_team_game_results(team_abbrev);

alter table nhl_games enable row level security;
alter table nhl_player_game_stats enable row level security;
alter table nhl_team_game_results enable row level security;

drop policy if exists "nhl_games_select_authenticated" on nhl_games;
create policy "nhl_games_select_authenticated" on nhl_games
  for select to authenticated using (true);

drop policy if exists "nhl_player_game_stats_select_authenticated" on nhl_player_game_stats;
create policy "nhl_player_game_stats_select_authenticated" on nhl_player_game_stats
  for select to authenticated using (true);

drop policy if exists "nhl_team_game_results_select_authenticated" on nhl_team_game_results;
create policy "nhl_team_game_results_select_authenticated" on nhl_team_game_results
  for select to authenticated using (true);

-- ===================== Periodes d'appartenance =====================
-- Une ligne par choix de draft (ou futur echange) : de from_at (inclus) a to_at (exclu,
-- null = toujours actif). Un match ne compte pour un participant que si son start_time_utc
-- tombe dans une de ses periodes pour ce joueur/cette equipe.

create table if not exists pool_roster_periods (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  member_id uuid not null references pool_members(id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  player_id text not null,
  from_at timestamptz not null,
  to_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_roster_periods_lookup on pool_roster_periods(pool_id, kind, player_id, from_at);
create index if not exists idx_pool_roster_periods_member on pool_roster_periods(member_id);

alter table pool_roster_periods enable row level security;

drop policy if exists "pool_roster_periods_select_same_pool" on pool_roster_periods;
create policy "pool_roster_periods_select_same_pool" on pool_roster_periods
  for select using (is_pool_member(pool_id));

-- ===================== Debut du pointage =====================

alter table pools add column if not exists scoring_start_at timestamptz;

-- ===================== advance_draft_pick : seme les periodes a la fin du draft =====================
-- Remplace la version de 20261102_pool_draft_engine.sql : quand le dernier pick est fait et
-- que le statut passe a 'active', on fixe scoring_start_at (si pas deja fixe) et on cree une
-- periode ouverte (to_at = null) par choix de draft, a partir de ce moment.

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

    insert into pool_roster_periods (pool_id, member_id, kind, player_id, from_at, to_at)
    select p.pool_id, p.member_id, p.kind, p.player_id, v_scoring_start, null
    from pool_picks p
    where p.pool_id = p_pool_id
      and not exists (
        select 1 from pool_roster_periods prp
        where prp.pool_id = p.pool_id and prp.member_id = p.member_id
          and prp.kind = p.kind and prp.player_id = p.player_id
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

-- ===================== RPC : le commissaire ajuste le debut du pointage =====================
-- Deplace aussi les periodes ouvertes creees a la fin du draft (to_at is null et from_at =
-- l'ancienne valeur) pour qu'elles repartent du nouveau from_at. Reste simple : pas de
-- verrouillage apres le premier match synchronise, le commissaire est de bonne foi.

create or replace function public.set_scoring_start(p_pool_id uuid, p_scoring_start_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_old timestamptz;
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  select * into v_pool from pools where id = p_pool_id and status = 'active';
  if v_pool.id is null then raise exception 'pool_not_active'; end if;
  if p_scoring_start_at is null then raise exception 'invalid_date'; end if;

  v_old := v_pool.scoring_start_at;

  update pools set scoring_start_at = p_scoring_start_at where id = p_pool_id;

  update pool_roster_periods set from_at = p_scoring_start_at
  where pool_id = p_pool_id and to_at is null and from_at = v_old;
end;
$$;

revoke execute on function public.set_scoring_start(uuid, timestamptz) from public;
grant execute on function public.set_scoring_start(uuid, timestamptz) to authenticated;

-- ===================== Helper interne : evenements de pointage pour un pool =====================
-- Une ligne par (match termine, joueur ou equipe possede par un membre au moment du match).
-- Usage interne uniquement : les RPC publiques ci-dessous font le controle d'acces et
-- agregent ce resultat. Pas de grant a authenticated (meme logique que advance_draft_pick).

-- "position" est un mot-clef SQL (lie a la fonction standard POSITION(x IN y)) : invalide
-- comme nom de colonne dans un RETURNS TABLE / parametre de fonction, meme si Postgres
-- l'autorise comme nom de colonne dans un CREATE TABLE ordinaire (d'ou nhl_player_game_stats
-- plus haut, inchangee). On utilise pos_group pour la sortie de cette fonction.
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
  points numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rules jsonb;
begin
  select rules into v_rules from pools where id = p_pool_id;

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
      end as points_by_category
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
      ) as points_by_category
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
    coalesce((select sum(v::numeric) from jsonb_each_text(e.points_by_category) kv(k, v)), 0) as points
  from all_events e;
end;
$$;

revoke execute on function public.pool_scored_events(uuid) from public;

-- ===================== RPC : classement du pool =====================

drop function if exists public.get_pool_standings(uuid);

create or replace function public.get_pool_standings(p_pool_id uuid)
returns table (
  member_id uuid,
  display_name text,
  team_name text,
  total_points numeric,
  today_points numeric,
  last7_points numeric,
  player_count int,
  rank int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  v_today := (now() at time zone 'America/New_York')::date;

  return query
  with events as (
    select * from pool_scored_events(p_pool_id)
  ),
  totals as (
    select
      m.id as member_id,
      m.display_name,
      m.team_name,
      coalesce(sum(e.points), 0) as total_points,
      coalesce(sum(e.points) filter (where (e.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points,
      coalesce(sum(e.points) filter (where (e.start_time_utc at time zone 'America/New_York')::date >= v_today - 6), 0) as last7_points,
      count(distinct e.ref_id) filter (where e.kind = 'player') as player_count
    from pool_members m
    left join events e on e.member_id = m.id
    where m.pool_id = p_pool_id
    group by m.id, m.display_name, m.team_name
  )
  select t.member_id, t.display_name, t.team_name, t.total_points, t.today_points, t.last7_points,
    t.player_count::int, rank() over (order by t.total_points desc)::int as rank
  from totals t
  order by t.total_points desc, t.display_name;
end;
$$;

revoke execute on function public.get_pool_standings(uuid) from public;
grant execute on function public.get_pool_standings(uuid) to authenticated;

-- ===================== RPC : detail d'un membre (joueur par joueur + equipe NHL) =====================

drop function if exists public.get_member_breakdown(uuid, uuid);

create or replace function public.get_member_breakdown(p_pool_id uuid, p_member_id uuid)
returns table (
  kind text,
  ref_id text,
  label text,
  pos_group text,
  games_played int,
  stats jsonb,
  points_by_category jsonb,
  total_points numeric,
  today_points numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;
  if not exists (select 1 from pool_members where id = p_member_id and pool_id = p_pool_id) then
    raise exception 'member_not_in_pool';
  end if;
  v_today := (now() at time zone 'America/New_York')::date;

  return query
  with events as (
    select * from pool_scored_events(p_pool_id) where member_id = p_member_id
  )
  select
    e.kind, e.ref_id, min(e.label) as label, min(e.pos_group) as pos_group,
    count(*)::int as games_played,
    (select jsonb_object_agg(x.k, x.total) from (
      select kv.key as k, sum((kv.value)::numeric) as total
      from events ee, jsonb_each_text(ee.stats) kv
      where ee.ref_id = e.ref_id and ee.kind = e.kind
      group by kv.key
    ) x) as stats,
    (select jsonb_object_agg(x.k, x.total) from (
      select kv.key as k, sum((kv.value)::numeric) as total
      from events ee, jsonb_each_text(ee.points_by_category) kv
      where ee.ref_id = e.ref_id and ee.kind = e.kind
      group by kv.key
    ) x) as points_by_category,
    sum(e.points) as total_points,
    coalesce(sum(e.points) filter (where (e.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points
  from events e
  group by e.kind, e.ref_id
  order by total_points desc;
end;
$$;

revoke execute on function public.get_member_breakdown(uuid, uuid) from public;
grant execute on function public.get_member_breakdown(uuid, uuid) to authenticated;

-- ===================== RPC : points par jour (graphique d'evolution) =====================

drop function if exists public.get_pool_daily_points(uuid);

create or replace function public.get_pool_daily_points(p_pool_id uuid)
returns table (
  member_id uuid,
  display_name text,
  day date,
  points numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;

  return query
  with events as (
    select * from pool_scored_events(p_pool_id)
  )
  select
    m.id as member_id,
    m.display_name,
    (e.start_time_utc at time zone 'America/New_York')::date as day,
    sum(e.points) as points
  from events e
  join pool_members m on m.id = e.member_id
  group by m.id, m.display_name, (e.start_time_utc at time zone 'America/New_York')::date
  order by day, m.display_name;
end;
$$;

revoke execute on function public.get_pool_daily_points(uuid) from public;
grant execute on function public.get_pool_daily_points(uuid) to authenticated;
