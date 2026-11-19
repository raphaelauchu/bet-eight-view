-- Cache serveur pour les cotes LNH (The Odds API), consomme par l'Edge Function
-- supabase/functions/nhl-odds-cache/index.ts. Sans ce cache, chaque montage de composant cote
-- client (BlocCotesSportsbook, MatchupPanel, ComparateurCotesLNH dans src/Analyses.js /
-- src/LineShopping.js) declenchait un appel direct a The Odds API -- risque de depasser le
-- quota de la source. Une seule ligne par combinaison de parametres de requete (cache_key),
-- ecrasee a chaque refresh reussi par le client service_role de l'Edge Function.
-- Idempotente (create table if not exists, drop policy if exists avant chaque create policy).

create table if not exists odds_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table odds_cache enable row level security;

-- Lecture seule pour les clients authentifies (l'Edge Function lit/ecrit via service_role, qui
-- contourne RLS) -- utile seulement si un appel direct depuis le client venait a lire la table.
drop policy if exists "odds_cache_select_authenticated" on odds_cache;
create policy "odds_cache_select_authenticated" on odds_cache
  for select to authenticated using (true);
