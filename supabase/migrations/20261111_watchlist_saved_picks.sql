-- Espace de travail "Analyse" unifie (fusion Analyse equipe/joueur, style TradingView) :
-- liste de suivi (favoris) et paris a faire (saved picks). Idempotente (create table if not
-- exists, drop policy if exists avant chaque create policy) : rejouable sans effet si deja
-- appliquee. Meme convention RLS que 20260824_2_rls_bets_bankroll.sql (4 policies simples
-- auth.uid() = user_id, pas de fonction SECURITY DEFINER -- inutile ici, chaque ligne
-- n'appartient qu'a un seul utilisateur, pas de notion de "membre d'un groupe" comme pour
-- les pools).

-- ===================== Liste de suivi (favoris : joueurs et equipes) =====================

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  ref_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

create index if not exists idx_watchlist_items_user on watchlist_items(user_id);

alter table watchlist_items enable row level security;

drop policy if exists "watchlist_items_select_own" on watchlist_items;
create policy "watchlist_items_select_own" on watchlist_items
  for select using (auth.uid() = user_id);

drop policy if exists "watchlist_items_insert_own" on watchlist_items;
create policy "watchlist_items_insert_own" on watchlist_items
  for insert with check (auth.uid() = user_id);

-- Pas de policy UPDATE : un favori n'a rien a modifier (kind/ref_id identifient la ligne,
-- created_at n'est jamais change) -- on retire un favori (DELETE) plutot que de le modifier.
drop policy if exists "watchlist_items_delete_own" on watchlist_items;
create policy "watchlist_items_delete_own" on watchlist_items
  for delete using (auth.uid() = user_id);

-- ===================== Paris a faire (saved picks) =====================

create table if not exists saved_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  ref_id text not null,
  label text not null,
  market text,
  line numeric,
  odds numeric,
  planned_stake numeric,
  note text,
  status text not null default 'saved' check (status in ('saved', 'placed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_picks_user_status on saved_picks(user_id, status);

alter table saved_picks enable row level security;

drop policy if exists "saved_picks_select_own" on saved_picks;
create policy "saved_picks_select_own" on saved_picks
  for select using (auth.uid() = user_id);

drop policy if exists "saved_picks_insert_own" on saved_picks;
create policy "saved_picks_insert_own" on saved_picks
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_picks_update_own" on saved_picks;
create policy "saved_picks_update_own" on saved_picks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_picks_delete_own" on saved_picks;
create policy "saved_picks_delete_own" on saved_picks
  for delete using (auth.uid() = user_id);
