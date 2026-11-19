-- Liste d'attente "Ajouter un sportsbook" (src/SportsbookWaitlist.js) : aucune connexion reelle
-- a un sportsbook n'existe encore (pas d'API officielle, pas de scraping) -- ce bouton permet
-- seulement a l'utilisateur d'enregistrer son interet pour qu'on le previenne quand l'integration
-- automatique d'un site sera disponible. `sportsbook` stocke l'id stable de src/sportsbooksConfig.js
-- (SPORTSBOOKS[].id, ex. 'bet365'/'betway'/'bet99'/'sportsinteraction'), pas le libelle affiche.
-- Idempotente, meme convention RLS que 20261111_watchlist_saved_picks.sql.

create table if not exists sportsbook_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sportsbook text not null,
  created_at timestamptz not null default now(),
  unique (user_id, sportsbook)
);

create index if not exists idx_sportsbook_waitlist_user on sportsbook_waitlist(user_id);

alter table sportsbook_waitlist enable row level security;

drop policy if exists "sportsbook_waitlist_select_own" on sportsbook_waitlist;
create policy "sportsbook_waitlist_select_own" on sportsbook_waitlist
  for select using (auth.uid() = user_id);

drop policy if exists "sportsbook_waitlist_insert_own" on sportsbook_waitlist;
create policy "sportsbook_waitlist_insert_own" on sportsbook_waitlist
  for insert with check (auth.uid() = user_id);

-- Pas de policy UPDATE/DELETE : une inscription a la liste d'attente n'a rien a modifier ni a
-- retirer (meme logique que watchlist_items pour les favoris -- append-only).
