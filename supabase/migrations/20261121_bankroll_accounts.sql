-- Comptes de bankroll multiples (src/Bankroll.js) : chaque utilisateur peut avoir plusieurs
-- "comptes" (un par sportsbook manuel, ou un compte generique "Autre") au lieu d'une seule
-- bankroll globale. Tout reste MANUEL -- ces comptes ne sont jamais connectes a un vrai
-- sportsbook, ils servent seulement a regrouper depots/retraits/paris. Idempotente (rejouable
-- sans effet si deja appliquee).
--
-- AUCUN compte "Principal"/"Fonds non assignes" n'est cree automatiquement : la bankroll
-- globale affichee (src/bankrollCalc.js:computeGlobalBankroll) est strictement la somme des
-- comptes reels de l'utilisateur. Un pari sans compte (account_id NULL) reste possible --
-- paris importes avant la creation d'un premier compte, ou un bookmaker non reconnu -- mais ne
-- compte alors dans AUCUN total : voir la migration 20261122_remove_principal_account.sql, qui
-- supprime retroactivement les comptes "Principal" crees par une version anterieure de ce
-- fichier (sans reassignation : leurs paris redeviennent simplement sans compte).

-- ===================== 1) Tables =====================

create table if not exists bankroll_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'other' check (kind in ('bet365', 'betway', 'bet99', 'sports_interaction', 'other')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_bankroll_accounts_user on bankroll_accounts(user_id);

create table if not exists bankroll_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references bankroll_accounts(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount numeric not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bankroll_transactions_account on bankroll_transactions(account_id);
create index if not exists idx_bankroll_transactions_user on bankroll_transactions(user_id);

-- bets.account_id : les DEUX tables de paris de l'app (paris = historique manuel, bets_auto =
-- import actif) peuvent chacune pointer vers un compte. on delete set null (jamais de perte de
-- pari si un compte est supprime, voir policy de suppression cote client qui detache d'abord).
alter table paris add column if not exists account_id uuid references bankroll_accounts(id) on delete set null;
alter table bets_auto add column if not exists account_id uuid references bankroll_accounts(id) on delete set null;

create index if not exists idx_paris_account on paris(account_id);
create index if not exists idx_bets_auto_account on bets_auto(account_id);

-- ===================== 2) RLS =====================

alter table bankroll_accounts enable row level security;

drop policy if exists "bankroll_accounts_select_own" on bankroll_accounts;
create policy "bankroll_accounts_select_own" on bankroll_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "bankroll_accounts_insert_own" on bankroll_accounts;
create policy "bankroll_accounts_insert_own" on bankroll_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "bankroll_accounts_update_own" on bankroll_accounts;
create policy "bankroll_accounts_update_own" on bankroll_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bankroll_accounts_delete_own" on bankroll_accounts;
create policy "bankroll_accounts_delete_own" on bankroll_accounts
  for delete using (auth.uid() = user_id);

alter table bankroll_transactions enable row level security;

drop policy if exists "bankroll_transactions_select_own" on bankroll_transactions;
create policy "bankroll_transactions_select_own" on bankroll_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "bankroll_transactions_insert_own" on bankroll_transactions;
create policy "bankroll_transactions_insert_own" on bankroll_transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "bankroll_transactions_delete_own" on bankroll_transactions;
create policy "bankroll_transactions_delete_own" on bankroll_transactions
  for delete using (auth.uid() = user_id);

-- Pas de policy UPDATE sur bankroll_transactions : une transaction se supprime et se recree,
-- elle ne se modifie pas (meme logique que watchlist_items/sportsbook_waitlist).

-- ===================== 3) Trigger : un retrait ne peut jamais depasser le solde disponible =====

-- Verification cote base (en plus de la validation cote client dans src/Bankroll.js) : calcule
-- le solde du compte (depots - retraits + profit realise des paris regles du compte, memes
-- deux tables que partout ailleurs dans l'app) juste avant d'inserer un retrait, et rejette si
-- le retrait depasserait ce solde. Desactive quand auth.uid() est NULL (migration/SQL editor,
-- meme pattern que prevent_self_admin_write) pour ne jamais bloquer la migration des donnees
-- existantes (section 4) ni une correction manuelle faite par un administrateur.
create or replace function check_withdrawal_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  solde numeric;
begin
  if NEW.type <> 'withdrawal' or auth.uid() is null then
    return NEW;
  end if;

  select
    coalesce(sum(case when t.type = 'deposit' then t.amount when t.type = 'withdrawal' then -t.amount else 0 end), 0)
    + coalesce((select sum(p.profit) from paris p where p.account_id = NEW.account_id and p.statut <> 'actif'), 0)
    + coalesce((select sum(b.resultat) from bets_auto b where b.account_id = NEW.account_id and b.statut <> 'pending'), 0)
  into solde
  from bankroll_transactions t
  where t.account_id = NEW.account_id;

  if NEW.amount > solde then
    raise exception 'Retrait refuse : montant (%) superieur au solde disponible (%) du compte', NEW.amount, solde;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_withdrawal_balance on bankroll_transactions;
create trigger trg_check_withdrawal_balance
  before insert on bankroll_transactions
  for each row
  execute function check_withdrawal_balance();

-- ===================== 4) Migration des donnees existantes (idempotente) =====================
-- AUCUNE creation de compte "Principal"/generique : seulement des comptes par sportsbook
-- RECONNU, et seulement si au moins un pari existant porte ce bookmaker exact. Un utilisateur
-- sans paris sur un sportsbook reconnu n'obtient donc aucun compte automatique -- il devra en
-- creer un lui-meme (voir src/Bankroll.js, "+ Ajouter un compte"). Ses paris existants restent
-- avec account_id NULL (ne comptent dans aucun total tant qu'ils ne sont pas rattaches a la main).

-- 4a) Comptes par sportsbook reconnu : un compte par (utilisateur, sportsbook) ayant au moins un
-- pari avec ce bookmaker exact -- seulement si ce compte n'existe pas deja pour cet utilisateur
-- (re-execution sans effet). Le nom affiche reprend le libelle exact utilise dans l'app
-- (src/bookmakers.js) ; `kind` est la valeur stable utilisee par l'UI (src/Bankroll.js).
with bookmaker_vers_kind (bookmaker, kind) as (
  values ('Bet365', 'bet365'), ('Betway', 'betway'), ('Bet99', 'bet99'), ('Sports Interaction', 'sports_interaction')
),
paris_sportsbooks as (
  select user_id, bookmaker from paris where bookmaker is not null and account_id is null
  union
  select user_id, bookmaker from bets_auto where bookmaker is not null and account_id is null
)
insert into bankroll_accounts (user_id, name, kind)
select distinct ps.user_id, bk.bookmaker, bk.kind
from paris_sportsbooks ps
join bookmaker_vers_kind bk on bk.bookmaker = ps.bookmaker
where not exists (
  select 1 from bankroll_accounts a where a.user_id = ps.user_id and a.kind = bk.kind
);

-- 4b) Rattache les paris/bets_auto existants (account_id encore NULL) au compte sportsbook
-- correspondant cree en 4a -- jamais de repli sur un compte generique : sans correspondance, le
-- pari reste sans compte (account_id NULL).
with bookmaker_vers_kind (bookmaker, kind) as (
  values ('Bet365', 'bet365'), ('Betway', 'betway'), ('Bet99', 'bet99'), ('Sports Interaction', 'sports_interaction')
)
update paris p
set account_id = (select a.id from bookmaker_vers_kind bk join bankroll_accounts a on a.user_id = p.user_id and a.kind = bk.kind where bk.bookmaker = p.bookmaker)
where p.account_id is null and p.user_id is not null and p.bookmaker is not null;

with bookmaker_vers_kind (bookmaker, kind) as (
  values ('Bet365', 'bet365'), ('Betway', 'betway'), ('Bet99', 'bet99'), ('Sports Interaction', 'sports_interaction')
)
update bets_auto b
set account_id = (select a.id from bookmaker_vers_kind bk join bankroll_accounts a on a.user_id = b.user_id and a.kind = bk.kind where bk.bookmaker = b.bookmaker)
where b.account_id is null and b.user_id is not null and b.bookmaker is not null;
