-- Statuts de blessure NHL, pour le badge "croix rouge" de la Vue vestiaire des pools
-- (src/PoolLockerRoom.js). Table globale (pas liee a un pool precis : une blessure concerne
-- un joueur NHL, pas un participant) alimentee uniquement par l'Edge Function
-- sync-player-injuries (voir supabase/functions/sync-player-injuries), jamais par le client :
-- source = endpoint public ESPN "site.api.espn.com/.../nhl/injuries" (gratuit, sans cle),
-- rapproche au roster NHL officiel (api-web.nhle.com) par nom exact + equipe pour obtenir le
-- player_id NHL -- une ligne n'est ecrite QUE si ce rapprochement est certain (jamais de
-- blessure inventee ni de correspondance approximative).
-- Idempotente (create table if not exists, drop policy if exists avant chaque create policy).

create table if not exists player_injuries (
  player_id text primary key,
  player_name text not null,
  team_abbrev text,
  status text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table player_injuries enable row level security;

-- Lecture seule pour tout utilisateur authentifie (meme principe que nhl_games/
-- nhl_player_game_stats : donnee partagee en lecture entre tous les pools). Aucune policy
-- insert/update/delete : seul le client service_role de l'Edge Function (qui contourne RLS)
-- peut ecrire.
drop policy if exists "player_injuries_select_authenticated" on player_injuries;
create policy "player_injuries_select_authenticated" on player_injuries
  for select to authenticated using (true);
