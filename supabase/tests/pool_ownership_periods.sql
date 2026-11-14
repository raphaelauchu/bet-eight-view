-- Verification du moteur de points des pools face aux changements de proprietaire
-- (echanges, lib2rations, reclamations au ballottage) -- scenarios demandes le 2026-11-14.
--
-- !! Ce script N'EST PAS un outil de production. Il cree des donnees fictives (auth.users,
-- pools, matchs NHL factices) et ne doit JAMAIS etre execute contre la base Supabase reelle.
-- Il est concu pour un cluster Postgres 16 JETABLE qui reproduit le schema des migrations.
--
-- Reproduction (depuis la racine du repo) :
--   /opt/homebrew/bin/initdb -D /tmp/pgtest_bev/data --locale=C -U postgres
--   mkdir -p /tmp/pgtest_bev/sock
--   /opt/homebrew/bin/pg_ctl -D /tmp/pgtest_bev/data -o "-k /tmp/pgtest_bev/sock -p 5544 -c listen_addresses=''" -l /tmp/pgtest_bev/log.txt start
--   /opt/homebrew/bin/psql -h /tmp/pgtest_bev/sock -p 5544 -U postgres -d postgres -c "create database pooltest;"
--   /opt/homebrew/bin/psql -h /tmp/pgtest_bev/sock -p 5544 -U postgres -d pooltest <<'SQL'
--     create role authenticated; create role anon; create role service_role;
--     create extension if not exists pgcrypto;
--     create publication supabase_realtime;
--     create schema auth;
--     create table auth.users (id uuid primary key default gen_random_uuid(), email text);
--     create function auth.uid() returns uuid language sql stable as $f$ select current_setting('app.current_user_id', true)::uuid $f$;
--     create function auth.role() returns text language sql stable as $f$ select coalesce(current_setting('app.current_role', true), 'authenticated') $f$;
--   SQL
--   for f in supabase/migrations/202610{30,31}*.sql supabase/migrations/202611{02,04,08,09,10,14}*.sql; do
--     /opt/homebrew/bin/psql -h /tmp/pgtest_bev/sock -p 5544 -U postgres -d pooltest -v ON_ERROR_STOP=1 -f "$f" || echo "FAILED: $f";
--   done
--   /opt/homebrew/bin/psql -h /tmp/pgtest_bev/sock -p 5544 -U postgres -d pooltest -v ON_ERROR_STOP=1 -f supabase/tests/pool_ownership_periods.sql
--
-- Chaque scenario est un bloc DO qui RAISE EXCEPTION 'FAIL scenario N: ...' en cas d'echec, ou
-- RAISE NOTICE 'PASS scenario N: ...' sinon. Avec ON_ERROR_STOP=1, le script s'arrete au premier
-- echec (visible dans le code de sortie de psql et dans la sortie).

\set ON_ERROR_STOP on

-- ===================== Setup : utilisateurs, pool classique, pool fantasy =====================

create temporary table t_ids (k text primary key, v uuid);

do $$
declare
  v_user_x uuid; v_user_y uuid; v_user_z uuid; v_user_x2 uuid; v_user_y2 uuid;
  v_pool1 uuid; v_pool2 uuid;
  v_mx uuid; v_my uuid; v_mz uuid; v_mx2 uuid; v_my2 uuid;
begin
  insert into auth.users (email) values ('x@test.local') returning id into v_user_x;
  insert into auth.users (email) values ('y@test.local') returning id into v_user_y;
  insert into auth.users (email) values ('z@test.local') returning id into v_user_z;
  insert into auth.users (email) values ('x2@test.local') returning id into v_user_x2;
  insert into auth.users (email) values ('y2@test.local') returning id into v_user_y2;

  insert into pools (owner_id, name, season, status, rules) values (
    v_user_x, 'Test Classique', '2026', 'active',
    '{"poolType":"classic","scoring":{"forward":{"goals":2,"assists":1}},
      "roster":{"forwards":50,"defense":50,"goalies":50,"teamPicks":0},
      "trades":{"enabled":true,"noReacquire":false,"balanceByPosition":true},
      "waivers":{"enabled":true,"claimOrder":"first_come","waiverDays":0,"noReacquireDropped":false}}'::jsonb
  ) returning id into v_pool1;

  insert into pools (owner_id, name, season, status, rules) values (
    v_user_x2, 'Test Fantasy', '2026', 'active',
    '{"poolType":"fantasy","lineup":"fixed","scoring":{"forward":{"goals":2,"assists":1}},
      "roster":{"forwards":50,"defense":50,"goalies":50,"teamPicks":0},
      "trades":{"enabled":true,"noReacquire":false,"balanceByPosition":true},
      "waivers":{"enabled":true,"claimOrder":"first_come","waiverDays":0,"noReacquireDropped":false}}'::jsonb
  ) returning id into v_pool2;

  insert into pool_members (pool_id, user_id, team_name, role) values (v_pool1, v_user_x, 'Team X', 'commissioner') returning id into v_mx;
  insert into pool_members (pool_id, user_id, team_name, role) values (v_pool1, v_user_y, 'Team Y', 'member') returning id into v_my;
  insert into pool_members (pool_id, user_id, team_name, role) values (v_pool1, v_user_z, 'Team Z', 'member') returning id into v_mz;
  insert into pool_members (pool_id, user_id, team_name, role) values (v_pool2, v_user_x2, 'Team X2', 'commissioner') returning id into v_mx2;
  insert into pool_members (pool_id, user_id, team_name, role) values (v_pool2, v_user_y2, 'Team Y2', 'member') returning id into v_my2;

  insert into t_ids values
    ('user_x', v_user_x), ('user_y', v_user_y), ('user_z', v_user_z), ('user_x2', v_user_x2), ('user_y2', v_user_y2),
    ('pool1', v_pool1), ('pool2', v_pool2),
    ('mx', v_mx), ('my', v_my), ('mz', v_mz), ('mx2', v_mx2), ('my2', v_my2);
end $$;

-- ===================== Scenarios 1 + 4 + 9 : echange avec jour d'echange exclu, puis
-- apparition chez l'ancien proprietaire dans les "anciens joueurs" =====================
-- Joueur P1 (X) echange contre un joueur bidon D1 (Y), pour satisfaire l'equilibre par poste
-- de pool_trade_check. 3 matchs : la veille (X), le jour meme (personne), le lendemain (Y).

do $$
declare
  v_pool uuid; v_mx uuid; v_my uuid; v_user_x uuid; v_user_y uuid;
  v_trade_id uuid;
  v_before timestamptz; v_tradeday timestamptz; v_after timestamptz;
  v_x_points numeric; v_y_points numeric;
  v_x_active boolean; v_x_closed_reason text;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_mx from t_ids where k = 'mx';
  select v into v_my from t_ids where k = 'my';
  select v into v_user_x from t_ids where k = 'user_x';
  select v into v_user_y from t_ids where k = 'user_y';

  v_before := (((now() at time zone 'America/Toronto')::date - 1) + time '19:00')::timestamp at time zone 'America/Toronto';
  v_tradeday := (((now() at time zone 'America/Toronto')::date) + time '19:00')::timestamp at time zone 'America/Toronto';
  v_after := (((now() at time zone 'America/Toronto')::date + 1) + time '19:00')::timestamp at time zone 'America/Toronto';

  -- Propriete initiale (equivalent d'un draft deja fait) : P1 chez X, D1 chez Y.
  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
  values
    (v_pool, v_mx, 'player', '910001', 'Joueur P1', 'F', 'C', 'MTL', 0, (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null),
    (v_pool, v_my, 'player', '910002', 'Joueur D1', 'F', 'C', 'TOR', 0, (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null);

  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910101, v_before::date, v_before, '2026', 'FINAL', 'MTL', 'TOR'),
    (910102, v_tradeday::date, v_tradeday, '2026', 'FINAL', 'MTL', 'TOR'),
    (910103, v_after::date, v_after, '2026', 'FINAL', 'MTL', 'TOR');

  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910101, 910001, 'Joueur P1', 'F', 'MTL', 1, 0), -- 2 pts, avant l'echange : doit aller a X
    (910102, 910001, 'Joueur P1', 'F', 'MTL', 1, 0), -- 2 pts, jour de l'echange : ne doit aller a personne
    (910103, 910001, 'Joueur P1', 'F', 'MTL', 1, 0); -- 2 pts, lendemain : doit aller a Y

  -- Echange reel via les RPC (propose_trade -> respond_trade -> execute_trade), pour tester
  -- le VRAI calcul des bornes minuit-Toronto, pas une reconstruction manuelle des periodes.
  perform set_config('app.current_user_id', v_user_x::text, false);
  select propose_trade(v_pool, v_my,
    '[{"kind":"player","player_id":"910001"}]'::jsonb,
    '[{"kind":"player","player_id":"910002"}]'::jsonb
  ) into v_trade_id;

  perform set_config('app.current_user_id', v_user_y::text, false);
  perform respond_trade(v_trade_id, true);

  select coalesce(sum(points) filter (where ref_id = '910001'), 0) into v_x_points
  from pool_scored_events(v_pool) where member_id = v_mx and counted;
  select coalesce(sum(points) filter (where ref_id = '910001'), 0) into v_y_points
  from pool_scored_events(v_pool) where member_id = v_my and counted;

  if v_x_points <> 2 then
    raise exception 'FAIL scenario 1/4: X devrait garder 2 pts (match avant l''echange), obtenu %', v_x_points;
  end if;
  if v_y_points <> 2 then
    raise exception 'FAIL scenario 1/4: Y devrait recevoir 2 pts (match du lendemain), obtenu %', v_y_points;
  end if;

  -- Scenario 9 : chez X (ancien proprietaire), P1 doit apparaitre comme inactif, avec
  -- closed_reason='trade', et total_points = seulement SA periode (2 pts, pas 4).
  select total_points, not is_active, closed_reason into v_x_points, v_x_active, v_x_closed_reason
  from get_member_breakdown(v_pool, v_mx) where ref_id = '910001' and kind = 'player';

  if v_x_points <> 2 or v_x_active is not true or v_x_closed_reason <> 'trade' then
    raise exception 'FAIL scenario 9: breakdown X attendu (2 pts, inactif, trade), obtenu (%, inactif=%, reason=%)', v_x_points, v_x_active, v_x_closed_reason;
  end if;

  raise notice 'PASS scenario 1 (echange: avant=X, apres=Y)';
  raise notice 'PASS scenario 4 (jour de l''echange ne compte pour personne)';
  raise notice 'PASS scenario 9 (ancien proprietaire voit uniquement sa periode)';
end $$;

-- ===================== Scenarios 2 + 3 : liberation puis reclamation =====================
-- P2 chez X marque, puis est libere (to_at = now() exact, pas d'alignement minuit). Pendant
-- qu'il est agent libre, un match ne doit compter pour personne. Z le reclame : seuls les
-- matchs APRES sa reclamation lui sont attribues ; X ne recoit plus rien.

-- IMPORTANT : now() est fige a la valeur de DEBUT DE TRANSACTION en PL/pgSQL. Pour que
-- drop_player (to_at = now()) et add_free_agent (from_at = now()) produisent des bornes
-- reellement distinctes et ordonnees (comme en production, ou les actions sont separees dans
-- le temps), chaque etape doit etre un statement top-level separe (sa propre transaction), avec
-- un petit pg_sleep entre les etapes qui s'enchainent trop vite pour l'horloge systeme.

do $$
declare
  v_pool uuid; v_mx uuid; v_before_drop timestamptz;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_mx from t_ids where k = 'mx';

  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
  values (v_pool, v_mx, 'player', '910003', 'Joueur P2', 'F', 'LW', 'BOS', 0, (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null);

  v_before_drop := now() - interval '2 hours';
  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910104, v_before_drop::date, v_before_drop, '2026', 'FINAL', 'BOS', 'MTL');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910104, 910003, 'Joueur P2', 'F', 'BOS', 1, 0); -- 2 pts pour X, avant la liberation
end $$;

select pg_sleep(0.1);

-- Liberation par X (now() exact, sans alignement minuit).
do $$
declare v_pool uuid; v_user_x uuid;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_user_x from t_ids where k = 'user_x';
  perform set_config('app.current_user_id', v_user_x::text, false);
  perform drop_player(v_pool, 'player', '910003');
end $$;

select pg_sleep(0.1);

-- Match joue pendant que le joueur est agent libre : ne doit compter pour personne.
do $$
declare v_free_agent_ts timestamptz := now();
begin
  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910105, v_free_agent_ts::date, v_free_agent_ts, '2026', 'FINAL', 'BOS', 'MTL');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910105, 910003, 'Joueur P2', 'F', 'BOS', 1, 0);
end $$;

select pg_sleep(0.1);

-- Reclamation par Z (waivers en mode first_come, waiverDays=0 : ajout immediat).
do $$
declare v_pool uuid; v_user_z uuid;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_user_z from t_ids where k = 'user_z';
  perform set_config('app.current_user_id', v_user_z::text, false);
  perform add_free_agent(v_pool, 'player', '910003', 'Joueur P2', 'F', 'BOS', 0, null, 'player', 'LW');
end $$;

select pg_sleep(0.1);

do $$
declare v_after_claim timestamptz := now();
begin
  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910106, v_after_claim::date, v_after_claim, '2026', 'FINAL', 'BOS', 'MTL');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910106, 910003, 'Joueur P2', 'F', 'BOS', 1, 0); -- apres la reclamation : Z
end $$;

do $$
declare
  v_pool uuid; v_mx uuid; v_mz uuid;
  v_x_points numeric; v_z_points numeric; v_nobody_count int;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_mx from t_ids where k = 'mx';
  select v into v_mz from t_ids where k = 'mz';

  select coalesce(sum(points) filter (where member_id = v_mx), 0) into v_x_points
  from pool_scored_events(v_pool) where ref_id = '910003' and counted;
  select coalesce(sum(points) filter (where member_id = v_mz), 0) into v_z_points
  from pool_scored_events(v_pool) where ref_id = '910003' and counted;
  select count(*) into v_nobody_count from pool_scored_events(v_pool)
  where ref_id = '910003' and game_id = 910105; -- doit etre absent de toute ligne membre

  if v_x_points <> 2 then
    raise exception 'FAIL scenario 2: X devrait garder 2 pts (avant liberation), obtenu %', v_x_points;
  end if;
  if v_z_points <> 2 then
    raise exception 'FAIL scenario 3: Z devrait recevoir 2 pts (apres reclamation), obtenu %', v_z_points;
  end if;
  if v_nobody_count <> 0 then
    raise exception 'FAIL scenario 2/3: le match pendant l''agence libre ne devrait appartenir a aucun membre, trouve % ligne(s)', v_nobody_count;
  end if;

  raise notice 'PASS scenario 2 (liberation: X garde ses points passes, rien ensuite)';
  raise notice 'PASS scenario 3 (reclamation: Z compte seulement a partir de son ajout)';
end $$;

-- ===================== Scenario 6 : aller-retour X -> Y -> X, sans doublon =====================

do $$
declare
  v_pool uuid; v_mx uuid; v_my uuid;
  v_t0 timestamptz; v_t1 timestamptz; v_t2 timestamptz;
  v_g1 timestamptz; v_g2 timestamptz; v_g3 timestamptz;
  v_x_points numeric; v_y_points numeric; v_row_count int;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_mx from t_ids where k = 'mx';
  select v into v_my from t_ids where k = 'my';

  v_t0 := now() - interval '30 days';
  v_t1 := now() - interval '20 days';
  v_t2 := now() - interval '10 days';
  v_g1 := now() - interval '25 days';
  v_g2 := now() - interval '15 days';
  v_g3 := now() - interval '5 days';

  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at, closed_reason)
  values
    (v_pool, v_mx, 'player', '910007', 'Joueur P3', 'F', 'RW', 'OTT', 0, v_t0, v_t1, 'trade'),
    (v_pool, v_my, 'player', '910007', 'Joueur P3', 'F', 'RW', 'OTT', 0, v_t1, v_t2, 'trade'),
    (v_pool, v_mx, 'player', '910007', 'Joueur P3', 'F', 'RW', 'OTT', 0, v_t2, null, null);

  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910107, v_g1::date, v_g1, '2026', 'FINAL', 'OTT', 'MTL'),
    (910108, v_g2::date, v_g2, '2026', 'FINAL', 'OTT', 'MTL'),
    (910109, v_g3::date, v_g3, '2026', 'FINAL', 'OTT', 'MTL');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910107, 910007, 'Joueur P3', 'F', 'OTT', 1, 0), -- periode 1 (X) : 2 pts
    (910108, 910007, 'Joueur P3', 'F', 'OTT', 1, 0), -- periode 2 (Y) : 2 pts
    (910109, 910007, 'Joueur P3', 'F', 'OTT', 1, 0); -- periode 3 (X) : 2 pts

  select count(*) into v_row_count from pool_scored_events(v_pool) where ref_id = '910007';
  select coalesce(sum(points) filter (where member_id = v_mx), 0) into v_x_points from pool_scored_events(v_pool) where ref_id = '910007';
  select coalesce(sum(points) filter (where member_id = v_my), 0) into v_y_points from pool_scored_events(v_pool) where ref_id = '910007';

  if v_row_count <> 3 then
    raise exception 'FAIL scenario 6: 3 evenements attendus (aucun doublon/perte), obtenu %', v_row_count;
  end if;
  if v_x_points <> 4 then -- periode 1 + periode 3
    raise exception 'FAIL scenario 6: X devrait avoir 4 pts (periodes 1+3), obtenu %', v_x_points;
  end if;
  if v_y_points <> 2 then
    raise exception 'FAIL scenario 6: Y devrait avoir 2 pts (periode 2 seulement), obtenu %', v_y_points;
  end if;

  raise notice 'PASS scenario 6 (aller-retour X->Y->X : chaque periode comptee une seule fois)';
end $$;

-- ===================== Scenario 5 : bornes minuit-Toronto autour du changement d'heure =====================
-- Le 1er novembre 2026 (premier dimanche de novembre), l'heure d'ete se termine a 2h locale.
-- On verifie que les bornes minuit-Toronto utilisees par execute_trade (meme formule) restent
-- correctes avant/pendant/apres cette journee de 25h, et qu'un match juste avant/apres minuit
-- est attribue au bon proprietaire.

do $$
declare
  v_pool uuid; v_mx uuid; v_my uuid;
  v_close_oct31 timestamptz; v_open_nov1 timestamptz; v_close_nov1 timestamptz; v_open_nov2 timestamptz;
  v_g_before timestamptz; v_g_dst_day timestamptz; v_g_after timestamptz;
  v_x_points numeric; v_y_points numeric; v_z_points numeric;
begin
  select v into v_pool from t_ids where k = 'pool1';
  select v into v_mx from t_ids where k = 'mx';
  select v into v_my from t_ids where k = 'my';

  -- Meme formule que execute_trade : v_close_at := v_today::timestamp at time zone 'America/Toronto'.
  v_close_oct31 := (date '2026-10-31')::timestamp at time zone 'America/Toronto'; -- encore EDT (UTC-4)
  v_open_nov1   := (date '2026-11-01')::timestamp at time zone 'America/Toronto'; -- jour du changement d'heure
  v_close_nov1  := (date '2026-11-01')::timestamp at time zone 'America/Toronto';
  v_open_nov2   := (date '2026-11-02')::timestamp at time zone 'America/Toronto'; -- EST (UTC-5)

  if v_close_oct31 <> timestamptz '2026-10-31 04:00:00+00' then
    raise exception 'FAIL scenario 5: minuit Toronto 31 oct 2026 attendu 04:00 UTC (EDT), obtenu %', v_close_oct31;
  end if;
  if v_open_nov2 <> timestamptz '2026-11-02 05:00:00+00' then
    raise exception 'FAIL scenario 5: minuit Toronto 2 nov 2026 attendu 05:00 UTC (EST), obtenu %', v_open_nov2;
  end if;
  if v_open_nov1 >= v_open_nov2 - interval '23 hours' or v_open_nov1 = v_close_oct31 then
    raise exception 'FAIL scenario 5: la journee du changement d''heure doit durer 25h, bornes incoherentes (% -> %)', v_open_nov1, v_open_nov2;
  end if;

  -- Periode X : ... -> minuit 31 oct (ferme la veille du changement d'heure).
  -- Periode Y : minuit 1 nov -> minuit 2 nov (le jour du changement d'heure, 25h, chez Y).
  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at, closed_reason)
  values
    (v_pool, v_mx, 'player', '910008', 'Joueur DST', 'F', 'D', 'VAN', 0, (date '2026-10-01')::timestamp at time zone 'America/Toronto', v_close_oct31, 'trade'),
    (v_pool, v_my, 'player', '910008', 'Joueur DST', 'F', 'D', 'VAN', 0, v_open_nov1, v_open_nov2, 'trade');

  v_g_before := timestamptz '2026-10-31 03:59:00+00'; -- 23h59 Toronto le 30 oct (EDT) : encore X
  v_g_dst_day := timestamptz '2026-11-01 12:00:00+00'; -- en pleine journee du 1er nov : Y
  v_g_after := timestamptz '2026-11-02 05:01:00+00'; -- 1 min apres minuit Toronto le 2 nov (EST) : personne (periode Y fermee)

  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910110, v_g_before::date, v_g_before, '2026', 'FINAL', 'VAN', 'SEA'),
    (910111, v_g_dst_day::date, v_g_dst_day, '2026', 'FINAL', 'VAN', 'SEA'),
    (910112, v_g_after::date, v_g_after, '2026', 'FINAL', 'VAN', 'SEA');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910110, 910008, 'Joueur DST', 'F', 'VAN', 1, 0),
    (910111, 910008, 'Joueur DST', 'F', 'VAN', 1, 0),
    (910112, 910008, 'Joueur DST', 'F', 'VAN', 1, 0);

  select coalesce(sum(points) filter (where member_id = v_mx), 0) into v_x_points from pool_scored_events(v_pool) where ref_id = '910008' and game_id = 910110;
  select coalesce(sum(points) filter (where member_id = v_my), 0) into v_y_points from pool_scored_events(v_pool) where ref_id = '910008' and game_id = 910111;
  select count(*) into v_z_points from pool_scored_events(v_pool) where ref_id = '910008' and game_id = 910112; -- reutilise la variable comme compteur

  if v_x_points <> 2 then
    raise exception 'FAIL scenario 5: match juste avant le changement d''heure attendu chez X (2 pts), obtenu %', v_x_points;
  end if;
  if v_y_points <> 2 then
    raise exception 'FAIL scenario 5: match pendant la journee de 25h attendu chez Y (2 pts), obtenu %', v_y_points;
  end if;
  if v_z_points <> 0 then
    raise exception 'FAIL scenario 5: match juste apres la fermeture de la periode Y ne devrait appartenir a personne, trouve % ligne(s)', v_z_points;
  end if;

  raise notice 'PASS scenario 5 (bornes minuit-Toronto correctes autour du changement d''heure)';
end $$;

-- ===================== Scenario 7 : joueur sur le banc / IR, et echange pendant qu'il est benche =====================

do $$
declare
  v_pool uuid; v_mx2 uuid; v_my2 uuid; v_user_x2 uuid; v_user_y2 uuid;
  v_trade_id uuid;
  v_g_bench_before timestamptz; v_g_bench_after timestamptz; v_g_ir timestamptz;
  v_counted numeric; v_bench numeric; v_ir_counted numeric;
begin
  select v into v_pool from t_ids where k = 'pool2';
  select v into v_mx2 from t_ids where k = 'mx2';
  select v into v_my2 from t_ids where k = 'my2';
  select v into v_user_x2 from t_ids where k = 'user_x2';
  select v into v_user_y2 from t_ids where k = 'user_y2';

  -- P4 chez X2, sur le banc ; D2 chez Y2, egalement sur le banc (pour que l'echange ne libere
  -- aucun poste actif cote Y2 et que P4 reste au banc apres l'echange).
  insert into pool_roster_periods (pool_id, member_id, kind, player_id, player_name, pos_group, detailed_position, nhl_team, salary, from_at, to_at)
  values
    (v_pool, v_mx2, 'player', '910020', 'Joueur P4 (banc)', 'F', 'C', 'CGY', 0, (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null),
    (v_pool, v_my2, 'player', '910021', 'Joueur D2 (banc)', 'F', 'C', 'EDM', 0, (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null),
    (v_pool, v_mx2, 'player', '910022', 'Joueur P5 (IR)', 'F', 'C', 'CGY', 0, (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null);

  insert into pool_lineup_periods (pool_id, member_id, kind, player_id, slot, from_at, to_at)
  values
    (v_pool, v_mx2, 'player', '910020', 'BN', (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null),
    (v_pool, v_my2, 'player', '910021', 'BN', (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null),
    (v_pool, v_mx2, 'player', '910022', 'IR', (((now() at time zone 'America/Toronto')::date - 30)::timestamp at time zone 'America/Toronto'), null);

  v_g_bench_before := now() - interval '10 days';
  v_g_ir := now() - interval '10 days';
  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910113, v_g_bench_before::date, v_g_bench_before, '2026', 'FINAL', 'CGY', 'EDM');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910113, 910020, 'Joueur P4 (banc)', 'F', 'CGY', 1, 0),
    (910113, 910022, 'Joueur P5 (IR)', 'F', 'CGY', 1, 0);

  select coalesce(sum(points) filter (where counted), 0), coalesce(sum(points) filter (where not counted), 0)
  into v_counted, v_bench
  from pool_scored_events(v_pool) where ref_id = '910020' and game_id = 910113;

  select coalesce(sum(points) filter (where counted), 0) into v_ir_counted
  from pool_scored_events(v_pool) where ref_id = '910022' and game_id = 910113;

  if v_counted <> 0 or v_bench <> 2 then
    raise exception 'FAIL scenario 7: joueur au banc ne devrait rien compter (counted=0, bench=2), obtenu counted=%, bench=%', v_counted, v_bench;
  end if;
  if v_ir_counted <> 0 then
    raise exception 'FAIL scenario 7: joueur a l''IR ne devrait rien compter, obtenu %', v_ir_counted;
  end if;

  -- Echange de P4 (toujours au banc) de X2 vers Y2, avec D2 (banc) en retour.
  perform set_config('app.current_user_id', v_user_x2::text, false);
  select propose_trade(v_pool, v_my2,
    '[{"kind":"player","player_id":"910020"}]'::jsonb,
    '[{"kind":"player","player_id":"910021"}]'::jsonb
  ) into v_trade_id;
  perform set_config('app.current_user_id', v_user_y2::text, false);
  perform respond_trade(v_trade_id, true);

  v_g_bench_after := now() + interval '1 day';
  insert into nhl_games (game_id, game_date, start_time_utc, season, state, home_abbrev, away_abbrev) values
    (910114, v_g_bench_after::date, v_g_bench_after, '2026', 'FINAL', 'CGY', 'EDM');
  insert into nhl_player_game_stats (game_id, player_id, player_name, position, team_abbrev, goals, assists) values
    (910114, 910020, 'Joueur P4 (banc)', 'F', 'CGY', 1, 0);

  select coalesce(sum(points) filter (where counted), 0), coalesce(sum(points) filter (where not counted), 0)
  into v_counted, v_bench
  from pool_scored_events(v_pool) where ref_id = '910020' and game_id = 910114 and member_id = v_my2;

  if v_counted <> 0 or v_bench <> 2 then
    raise exception 'FAIL scenario 7: apres l''echange, P4 toujours au banc chez Y2 ne devrait rien compter, obtenu counted=%, bench=%', v_counted, v_bench;
  end if;

  raise notice 'PASS scenario 7 (banc/IR exclus, y compris apres un echange pendant qu''il est benche)';
end $$;

-- ===================== Scenario 8 : les totaux du classement = somme du detail par joueur =====================

do $$
declare
  v_pool uuid; v_mx uuid; v_my uuid; v_mz uuid;
  v_member record;
  v_standing_total numeric;
  v_breakdown_total numeric;
begin
  select v into v_pool from t_ids where k = 'pool1';
  perform set_config('app.current_user_id', (select v::text from t_ids where k = 'user_x'), false);

  for v_member in select id, 'mx' as label from pool_members where id in (select v from t_ids where k = 'mx')
    union all select id, 'my' from pool_members where id in (select v from t_ids where k = 'my')
    union all select id, 'mz' from pool_members where id in (select v from t_ids where k = 'mz')
  loop
    select coalesce(total_points, 0) into v_standing_total from get_pool_standings(v_pool) where member_id = v_member.id;
    select coalesce(sum(total_points), 0) into v_breakdown_total from get_member_breakdown(v_pool, v_member.id);

    if v_standing_total <> v_breakdown_total then
      raise exception 'FAIL scenario 8: membre % -- classement=% mais somme du detail=%', v_member.label, v_standing_total, v_breakdown_total;
    end if;
  end loop;

  raise notice 'PASS scenario 8 (classement = somme exacte du detail par membre, pour X/Y/Z)';
end $$;

do $$ begin raise notice 'TOUS LES SCENARIOS (1 a 9) ONT REUSSI.'; end $$;
