-- Corrige "column reference ... is ambiguous" (Postgres 42702) dans les RPC du classement.
--
-- Cause : avec RETURNS TABLE(...), chaque colonne de sortie devient une variable PL/pgSQL
-- implicite dans tout le corps de la fonction (pas seulement dans le SELECT final). Le
-- reglage par defaut de plpgsql (variable_conflict = error) leve une erreur chaque fois
-- qu'une reference de colonne NON QUALIFIEE, dans N'IMPORTE QUELLE sous-requete/CTE du corps,
-- porte le meme nom qu'une de ces colonnes de sortie :
-- - get_pool_standings a 'member_id' en sortie, et la CTE salary_by_member faisait
--   "select member_id, ... from pool_picks ... group by member_id" sans alias de table :
--   ambigu entre pool_picks.member_id et la variable de sortie member_id.
-- - get_pool_daily_points a 'day' en sortie, et le ORDER BY final utilisait l'alias "day" du
--   SELECT -- ambigu entre cet alias et la variable de sortie day.
-- - get_member_breakdown n'avait pas de reference non qualifiee identifiee, mais elle appelle
--   pool_scored_events (meme famille de probleme potentiel) : corrigee par precaution avec
--   la meme ceinture-et-bretelles.
--
-- Correction a deux niveaux, comme demande : (1) "#variable_conflict use_column" en tete de
-- chaque corps, qui fait gagner la colonne/l'alias SQL sur la variable PL/pgSQL en cas de
-- conflit (au lieu de lever une erreur) ; (2) qualification explicite de toutes les colonnes
-- avec l'alias de leur table (ou remplacement de l'alias de sortie par l'expression complete
-- dans le ORDER BY), pour ne pas reposer uniquement sur le pragma.
--
-- Signatures inchangees par rapport a 20261104_pool_scoring_engine.sql et
-- 20261105_pool_standings_member_breakdown_fixes.sql : create or replace suffit, pas besoin
-- de drop function.

create or replace function public.get_pool_standings(p_pool_id uuid)
returns table (
  member_id uuid,
  display_name text,
  team_name text,
  total_points numeric,
  today_points numeric,
  last7_points numeric,
  player_count int,
  salary_used numeric,
  rank int
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
  with events as (
    select * from pool_scored_events(p_pool_id)
  ),
  salary_by_member as (
    select pp.member_id as member_id, sum(coalesce(pp.salary, 0)) as salary_used
    from pool_picks pp
    where pp.pool_id = p_pool_id
    group by pp.member_id
  ),
  totals as (
    select
      pm.id as member_id,
      pm.display_name as display_name,
      pm.team_name as team_name,
      coalesce(sum(ev.points), 0) as total_points,
      coalesce(sum(ev.points) filter (where (ev.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points,
      coalesce(sum(ev.points) filter (where (ev.start_time_utc at time zone 'America/New_York')::date >= v_today - 6), 0) as last7_points,
      count(distinct ev.ref_id) filter (where ev.kind = 'player') as player_count,
      coalesce(sbm.salary_used, 0) as salary_used
    from pool_members pm
    left join events ev on ev.member_id = pm.id
    left join salary_by_member sbm on sbm.member_id = pm.id
    where pm.pool_id = p_pool_id
    group by pm.id, pm.display_name, pm.team_name, sbm.salary_used
  )
  select tt.member_id, tt.display_name, tt.team_name, tt.total_points, tt.today_points, tt.last7_points,
    tt.player_count::int, tt.salary_used, rank() over (order by tt.total_points desc)::int as rank
  from totals tt
  order by tt.total_points desc, tt.display_name;
end;
$$;

revoke execute on function public.get_pool_standings(uuid) from public;
grant execute on function public.get_pool_standings(uuid) to authenticated;

-- ===================== RPC : detail d'un membre =====================

create or replace function public.get_member_breakdown(p_pool_id uuid, p_member_id uuid)
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
  today_points numeric
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
  with events as (
    select * from pool_scored_events(p_pool_id) sev where sev.member_id = p_member_id
  ),
  agg_events as (
    select
      ev.ref_id as ref_id,
      ev.kind as kind,
      (select jsonb_object_agg(x.k, x.total) from (
        select kv.key as k, sum((kv.value)::numeric) as total
        from events ee, jsonb_each_text(ee.stats) kv
        where ee.ref_id = ev.ref_id and ee.kind = ev.kind
        group by kv.key
      ) x) as stats,
      (select jsonb_object_agg(x.k, x.total) from (
        select kv.key as k, sum((kv.value)::numeric) as total
        from events ee, jsonb_each_text(ee.points_by_category) kv
        where ee.ref_id = ev.ref_id and ee.kind = ev.kind
        group by kv.key
      ) x) as points_by_category,
      count(*)::int as games_played,
      sum(ev.points) as total_points,
      coalesce(sum(ev.points) filter (where (ev.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points
    from events ev
    group by ev.ref_id, ev.kind
  )
  select
    pp.kind as kind,
    pp.player_id as ref_id,
    pp.player_name as label,
    pp.position as pos_group,
    pp.nhl_team as team_abbrev,
    pp.pick_no as pick_no,
    pp.salary as salary,
    coalesce(ae.games_played, 0) as games_played,
    coalesce(ae.stats, '{}'::jsonb) as stats,
    coalesce(ae.points_by_category, '{}'::jsonb) as points_by_category,
    coalesce(ae.total_points, 0) as total_points,
    coalesce(ae.today_points, 0) as today_points
  from pool_picks pp
  left join agg_events ae on ae.ref_id = pp.player_id and ae.kind = pp.kind
  where pp.pool_id = p_pool_id and pp.member_id = p_member_id
  order by coalesce(ae.total_points, 0) desc, pp.pick_no asc nulls last;
end;
$$;

revoke execute on function public.get_member_breakdown(uuid, uuid) from public;
grant execute on function public.get_member_breakdown(uuid, uuid) to authenticated;

-- ===================== RPC : points par jour (graphique d'evolution) =====================

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
#variable_conflict use_column
begin
  if not is_pool_member(p_pool_id) then raise exception 'not_a_member'; end if;

  return query
  with events as (
    select * from pool_scored_events(p_pool_id)
  )
  select
    pm.id as member_id,
    pm.display_name as display_name,
    (ev.start_time_utc at time zone 'America/New_York')::date as day,
    sum(ev.points) as points
  from events ev
  join pool_members pm on pm.id = ev.member_id
  group by pm.id, pm.display_name, (ev.start_time_utc at time zone 'America/New_York')::date
  order by (ev.start_time_utc at time zone 'America/New_York')::date, pm.display_name;
end;
$$;

revoke execute on function public.get_pool_daily_points(uuid) from public;
grant execute on function public.get_pool_daily_points(uuid) to authenticated;
