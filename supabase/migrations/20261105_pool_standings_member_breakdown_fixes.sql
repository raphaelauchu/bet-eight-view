-- Corrections du classement (Phase 3) :
--
-- 1) get_pool_standings retournait deja tous les membres (LEFT JOIN depuis pool_members,
--    coalesce a 0) -- ca n'etait pas le bug. On ajoute juste salary_used (somme des salaires
--    de pool_picks) pour que le client puisse afficher la masse salariale par ligne sans
--    requete supplementaire.
-- 2) get_member_breakdown, lui, partait de pool_scored_events (donc d'un INNER JOIN sur les
--    matchs deja joues) : un joueur du roster qui n'a encore joue aucun match n'apparaissait
--    jamais. Reecrite pour partir de pool_picks (le roster reel) et faire un LEFT JOIN sur
--    l'agregat des evenements -- un pick sans aucun match sort maintenant avec 0 partout.
--    Ajoute pick_no, salary et team_abbrev (utiles pour trier "par ordre de repechage" et
--    afficher le salaire / l'equipe NHL cote client sans redemander pool_picks) ; pos_group
--    vient desormais de pool_picks.position ('F'/'D'/'G'/'TEAM'), toujours renseigne, plutot
--    que de nhl_player_game_stats.position (absent tant qu'aucun match n'est joue, et qui ne
--    connait pas 'TEAM').

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
  salary_used numeric,
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
  salary_by_member as (
    select member_id, sum(coalesce(salary, 0)) as salary_used
    from pool_picks
    where pool_id = p_pool_id
    group by member_id
  ),
  totals as (
    select
      m.id as member_id,
      m.display_name,
      m.team_name,
      coalesce(sum(e.points), 0) as total_points,
      coalesce(sum(e.points) filter (where (e.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points,
      coalesce(sum(e.points) filter (where (e.start_time_utc at time zone 'America/New_York')::date >= v_today - 6), 0) as last7_points,
      count(distinct e.ref_id) filter (where e.kind = 'player') as player_count,
      coalesce(sb.salary_used, 0) as salary_used
    from pool_members m
    left join events e on e.member_id = m.id
    left join salary_by_member sb on sb.member_id = m.id
    where m.pool_id = p_pool_id
    group by m.id, m.display_name, m.team_name, sb.salary_used
  )
  select t.member_id, t.display_name, t.team_name, t.total_points, t.today_points, t.last7_points,
    t.player_count::int, t.salary_used, rank() over (order by t.total_points desc)::int as rank
  from totals t
  order by t.total_points desc, t.display_name;
end;
$$;

revoke execute on function public.get_pool_standings(uuid) from public;
grant execute on function public.get_pool_standings(uuid) to authenticated;

-- ===================== RPC : detail d'un membre, reecrite a partir du roster =====================

drop function if exists public.get_member_breakdown(uuid, uuid);

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
  ),
  agg_events as (
    select
      e.ref_id,
      e.kind,
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
      count(*)::int as games_played,
      sum(e.points) as total_points,
      coalesce(sum(e.points) filter (where (e.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points
    from events e
    group by e.ref_id, e.kind
  )
  select
    p.kind,
    p.player_id as ref_id,
    p.player_name as label,
    p.position as pos_group,
    p.nhl_team as team_abbrev,
    p.pick_no,
    p.salary,
    coalesce(a.games_played, 0) as games_played,
    coalesce(a.stats, '{}'::jsonb) as stats,
    coalesce(a.points_by_category, '{}'::jsonb) as points_by_category,
    coalesce(a.total_points, 0) as total_points,
    coalesce(a.today_points, 0) as today_points
  from pool_picks p
  left join agg_events a on a.ref_id = p.player_id and a.kind = p.kind
  where p.pool_id = p_pool_id and p.member_id = p_member_id
  order by coalesce(a.total_points, 0) desc, p.pick_no asc nulls last;
end;
$$;

revoke execute on function public.get_member_breakdown(uuid, uuid) from public;
grant execute on function public.get_member_breakdown(uuid, uuid) to authenticated;
