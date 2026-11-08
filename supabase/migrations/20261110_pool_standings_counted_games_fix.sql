-- Corrige le Classement des pools (BOGUE "points incorrects" signale par un commissaire :
-- total irrealiste pour la duree ecoulee, et PJ/MOY qui ne concordent pas avec le total).
--
-- Reproduit sur Postgres 16 local avec un pool fantasy de 3 participants (joueurs/gardiens
-- realistes, bareme avec des valeurs negatives, un echange ET un ajout/abandon historiques,
-- des joueurs au banc) : le TOTAL DE POINTS retourne par get_pool_standings concorde a
-- l'exact avec (a) un recalcul independant ecrit a partir de zero (sommes de
-- nhl_player_game_stats / nhl_team_game_results multipliees par le bareme du bon poste, pour
-- les matchs termines dans la periode de propriete ET d'alignement actif) et (b) la somme des
-- lignes de get_member_breakdown pour le meme membre. Le moteur de points lui-meme
-- (pool_scored_events) est donc correct : pas de doublon, pas de bareme croise, pas de signe
-- inverse, pas de double jointure dans le code actuel.
--
-- Deux problemes reels ont ete trouves en comparant get_pool_standings a ce recalcul :
--
-- 1) today_games_played et total_games_played comptent TOUS les evenements (y compris ceux
--    au banc/IR, counted = false), alors que today_points/total_points filtrent deja
--    correctement sur "counted" (ajoute en 20261109 pour les pools fantasy). Resultat : pour
--    un pool fantasy avec des joueurs au banc, le "PJ" affiche est trop eleve et "MOY"
--    (total_points / total_games_played) est artificiellement trop bas -- verifie dans le
--    scenario de test (ex. 79 PJ retournes contre 66 matchs reellement comptes pour un
--    participant avec un attaquant de banc). Corrige en filtrant ces deux comptes par
--    "counted", comme le fait deja la somme des points. get_pool_daily_points (non branchee
--    cote client actuellement, mais meme famille de bug et meme moteur pool_scored_events)
--    additionnait aussi les points sans filtrer sur "counted" ; corrigee par la meme occasion
--    pour qu'elle reste une source fiable si elle est un jour utilisee.
--
-- 2) Rien n'empechait STRUCTURELLEMENT qu'un joueur/une equipe ait deux periodes DE PROPRIETE
--    ouvertes simultanement (pool_roster_periods, to_at is null) -- par ex. pour deux membres
--    differents en meme temps, suite a une correction manuelle en base ou un etat incoherent
--    herite d'avant la Phase 4A (20261108). pool_scored_events JOINT pool_roster_periods aux
--    statistiques (pas un EXISTS) : verifie empiriquement, une telle duplication fait compter
--    DEUX FOIS les statistiques du joueur (une fois par periode ouverte), ce qui peut
--    facilement produire un total très negatif pour un gardien avec un bareme de buts-accordes
--    negatif. Aucun chemin de code actuel (echange, ajout/abandon, ballotage) ne peut creer
--    cette situation (chaque fermeture de periode est verifiee par un row_count = 1 avant
--    d'ouvrir la nouvelle), mais rien ne l'empechait non plus en cas d'intervention manuelle
--    en base ou de futur bug. Ajoute une contrainte UNIQUE partielle qui rend cet etat
--    impossible desormais (migration idempotente : si des doublons existent deja en
--    production, cette migration echouera a la creation de l'index -- voir
--    supabase/diagnostics/pool_points_audit.sql pour les detecter et les corriger avant de la
--    rejouer).

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
      count(ev.game_id) filter (where ev.counted and (ev.start_time_utc at time zone 'America/New_York')::date = v_today) as today_games_played,
      coalesce(sum(ev.points) filter (where ev.counted and (ev.start_time_utc at time zone 'America/New_York')::date = v_today), 0) as today_points,
      count(ev.game_id) filter (where ev.counted) as total_games_played,
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

-- ===================== get_pool_daily_points : meme correction (filtre "counted") =====================

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
    coalesce(sum(ev.points) filter (where ev.counted), 0) as points
  from events ev
  join pool_members pm on pm.id = ev.member_id
  group by pm.id, pm.display_name, (ev.start_time_utc at time zone 'America/New_York')::date
  order by (ev.start_time_utc at time zone 'America/New_York')::date, pm.display_name;
end;
$$;

revoke execute on function public.get_pool_daily_points(uuid) from public;
grant execute on function public.get_pool_daily_points(uuid) to authenticated;

-- ===================== Garde-fou : un seul proprietaire ouvert a la fois =====================

create unique index if not exists idx_pool_roster_periods_one_open_owner
  on pool_roster_periods (pool_id, kind, player_id)
  where to_at is null;
