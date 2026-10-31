-- Refonte du classement et de la page d'equipe (panorama + statistiques par participant).
--
-- 1) get_pool_standings : nouvelles colonnes pour le panorama (PJ/TOT/MOY "aujourd'hui" et
--    "cumulatif", ecart avec le premier, points d'hier). Remplace l'ancienne forme
--    (today_points/last7_points/salary_used/player_count), qui ne correspond plus a l'UI.
-- 2) get_member_breakdown : signature changee (ajoute p_from/p_to, timestamptz, defaut null
--    = non borne = "Total") pour servir le selecteur de periode Aujourd'hui/Jour/Mois/Total.
--    Ajoute is_hot/is_cold (tendance sur les 5 derniers matchs, seuils documentes plus bas)
--    et opponent_abbrev (adversaire du jour si l'equipe NHL du joueur/de l'equipe joue
--    aujourd'hui). Retire today_points (redondant avec le selecteur de periode).
-- 3) get_pool_top_scorers_today : nouvelle RPC pour le bloc "Pointeurs du jour" du panorama.
--
-- Comme pour la derniere correction (colonnes ambigues, Postgres 42702) : chaque fonction
-- commence par "#variable_conflict use_column" et toutes les colonnes sont qualifiees par
-- l'alias de leur table, pour qu'aucune reference non qualifiee ne puisse entrer en conflit
-- avec une colonne de sortie du RETURNS TABLE.

-- ===================== RPC : panorama du classement =====================

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
      coalesce(sum(ev.points) filter (where (ev.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points,
      count(ev.game_id) as total_games_played,
      coalesce(sum(ev.points), 0) as total_points,
      coalesce(sum(ev.points) filter (where (ev.start_time_utc at time zone 'America/New_York')::date = v_yesterday), 0) as yesterday_points
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

-- ===================== RPC : pointeurs du jour (tout le pool) =====================

drop function if exists public.get_pool_top_scorers_today(uuid);

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
    pp.player_id as ref_id,
    pp.player_name as label,
    pp.nhl_team as team_abbrev,
    pp.position as pos_group,
    ag.stats as stats,
    ag.points as points,
    pm.id as member_id,
    pm.display_name as display_name,
    pm.team_name as team_name
  from agg ag
  join pool_picks pp on pp.pool_id = p_pool_id and pp.kind = 'player' and pp.player_id = ag.ref_id
  join pool_members pm on pm.id = pp.member_id
  order by ag.points desc, pp.player_name
  limit p_limit;
end;
$$;

revoke execute on function public.get_pool_top_scorers_today(uuid, int) from public;
grant execute on function public.get_pool_top_scorers_today(uuid, int) to authenticated;

-- ===================== RPC : detail d'un participant (periode + tendance + adversaire) =====================
-- Signature changee (ajoute p_from/p_to) : la 2-arguments doit etre supprimee explicitement,
-- "create or replace" ne remplace pas une fonction de signature differente (il en creerait
-- une seconde en surcharge, ambigue avec des appels a 2 arguments).

drop function if exists public.get_member_breakdown(uuid, uuid);

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
  opponent_abbrev text
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
  -- Tendance : "en feu" = au moins 4 de ses 5 derniers matchs (tous temps, dans ce pool) avec
  -- des points > 0 ; "en panne" = 0 point sur ses 5 derniers matchs. Il faut au moins 5
  -- matchs joues au total pour afficher un verdict (sinon ni flamme ni flocon -- echantillon
  -- insuffisant). Seuils arbitraires mais documentes : a ajuster si trop/pas assez de badges
  -- apparaissent en pratique.
  trend as (
    select
      pp.player_id as ref_id,
      pp.kind as kind,
      l5.last5_count as last5_count,
      l5.last5_positive as last5_positive
    from pool_picks pp
    cross join lateral (
      select
        count(*) as last5_count,
        count(*) filter (where sub.pts > 0) as last5_positive
      from (
        select ea.points as pts
        from events_all ea
        where ea.ref_id = pp.player_id and ea.kind = pp.kind
        order by ea.start_time_utc desc
        limit 5
      ) sub
    ) l5
    where pp.pool_id = p_pool_id and pp.member_id = p_member_id
  )
  select
    pp.kind as kind,
    pp.player_id as ref_id,
    pp.player_name as label,
    pp.position as pos_group,
    pp.nhl_team as team_abbrev,
    pp.pick_no as pick_no,
    pp.salary as salary,
    coalesce(aw.games_played, 0) as games_played,
    coalesce(aw.stats, '{}'::jsonb) as stats,
    coalesce(aw.points_by_category, '{}'::jsonb) as points_by_category,
    coalesce(aw.total_points, 0) as total_points,
    (coalesce(tr.last5_count, 0) >= 5 and coalesce(tr.last5_positive, 0) >= 4) as is_hot,
    (coalesce(tr.last5_count, 0) >= 5 and coalesce(tr.last5_positive, 0) = 0) as is_cold,
    (
      select case when gm.home_abbrev = pp.nhl_team then gm.away_abbrev
                  when gm.away_abbrev = pp.nhl_team then gm.home_abbrev end
      from nhl_games gm
      where gm.game_date = v_today and (gm.home_abbrev = pp.nhl_team or gm.away_abbrev = pp.nhl_team)
      limit 1
    ) as opponent_abbrev
  from pool_picks pp
  left join agg_window aw on aw.ref_id = pp.player_id and aw.kind = pp.kind
  left join trend tr on tr.ref_id = pp.player_id and tr.kind = pp.kind
  where pp.pool_id = p_pool_id and pp.member_id = p_member_id
  order by coalesce(aw.total_points, 0) desc, pp.pick_no asc nulls last;
end;
$$;

revoke execute on function public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_member_breakdown(uuid, uuid, timestamptz, timestamptz) to authenticated;
