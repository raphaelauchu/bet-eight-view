-- Comptes de bankroll multiples (src/Bankroll.js) : chaque utilisateur peut avoir plusieurs
-- "comptes" (un par sportsbook manuel, ou un compte generique "Autre") au lieu d'une seule
-- bankroll globale. Tout reste MANUEL -- ces comptes ne sont jamais connectes a un vrai
-- sportsbook, ils servent seulement a regrouper depots/retraits/paris. Idempotente (rejouable
-- sans effet si deja appliquee) et PRESERVE EXACTEMENT le total actuel de la bankroll de chaque
-- utilisateur -- voir la section 4 (migration des donnees existantes) pour le detail du calcul.

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

-- 4a) Un compte "Principal" (kind 'other') pour chaque utilisateur ayant deja une ligne
-- bankroll, des paris ou des bets_auto -- seulement si cet utilisateur n'a encore AUCUN compte
-- (garantit qu'une 2e execution de cette migration ne cree rien de plus).
insert into bankroll_accounts (user_id, name, kind)
select distinct u.user_id, 'Principal', 'other'
from (
  select user_id from bankroll
  union
  select user_id from paris where user_id is not null
  union
  select user_id from bets_auto where user_id is not null
) u
where not exists (select 1 from bankroll_accounts a where a.user_id = u.user_id);

-- 4b) Comptes par sportsbook reconnu : un compte par (utilisateur, sportsbook) ayant au moins un
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

-- 4c) Depot initial dans "Principal" = bankroll.montant ACTUEL moins la totalite du profit
-- deja realise sur TOUS les paris de l'utilisateur (peu importe le compte auquel ils seront
-- rattaches juste apres) -- c'est le "net deja depose" reel, independant des resultats de paris.
-- Necessaire pour que la somme des soldes de comptes (depots - retraits + profit par compte)
-- redonne EXACTEMENT bankroll.montant une fois les paris repartis entre plusieurs comptes a
-- l'etape 4d (sinon le profit deja inclus dans bankroll.montant serait compte deux fois).
-- Seulement si le compte Principal n'a encore AUCUNE transaction (idempotent).
do $$
declare
  r record;
  profit_total numeric;
  net_depose numeric;
  compte_principal uuid;
begin
  for r in select b.user_id, b.montant from bankroll b loop
    select id into compte_principal from bankroll_accounts where user_id = r.user_id and name = 'Principal' and kind = 'other' limit 1;
    if compte_principal is null then
      continue;
    end if;
    if exists (select 1 from bankroll_transactions where account_id = compte_principal) then
      continue;
    end if;

    select
      coalesce((select sum(profit) from paris where user_id = r.user_id and statut <> 'actif'), 0)
      + coalesce((select sum(resultat) from bets_auto where user_id = r.user_id and statut <> 'pending'), 0)
    into profit_total;

    net_depose := coalesce(r.montant, 0) - profit_total;

    if net_depose > 0 then
      insert into bankroll_transactions (user_id, account_id, type, amount, occurred_on, note)
      values (r.user_id, compte_principal, 'deposit', net_depose, current_date, 'Solde migre automatiquement');
    elsif net_depose < 0 then
      insert into bankroll_transactions (user_id, account_id, type, amount, occurred_on, note)
      values (r.user_id, compte_principal, 'withdrawal', abs(net_depose), current_date, 'Solde migre automatiquement');
    end if;
    -- net_depose = 0 : rien a inserer, le compte demarre a 0 et accumule uniquement le profit.
  end loop;
end $$;

-- 4d) Rattache les paris/bets_auto existants (account_id encore NULL) au compte sportsbook
-- correspondant si un a ete cree en 4b, sinon au compte "Principal" de l'utilisateur.
with bookmaker_vers_kind (bookmaker, kind) as (
  values ('Bet365', 'bet365'), ('Betway', 'betway'), ('Bet99', 'bet99'), ('Sports Interaction', 'sports_interaction')
)
update paris p
set account_id = coalesce(
  (select a.id from bookmaker_vers_kind bk join bankroll_accounts a on a.user_id = p.user_id and a.kind = bk.kind where bk.bookmaker = p.bookmaker),
  (select a.id from bankroll_accounts a where a.user_id = p.user_id and a.name = 'Principal' and a.kind = 'other')
)
where p.account_id is null and p.user_id is not null;

with bookmaker_vers_kind (bookmaker, kind) as (
  values ('Bet365', 'bet365'), ('Betway', 'betway'), ('Bet99', 'bet99'), ('Sports Interaction', 'sports_interaction')
)
update bets_auto b
set account_id = coalesce(
  (select a.id from bookmaker_vers_kind bk join bankroll_accounts a on a.user_id = b.user_id and a.kind = bk.kind where bk.bookmaker = b.bookmaker),
  (select a.id from bankroll_accounts a where a.user_id = b.user_id and a.name = 'Principal' and a.kind = 'other')
)
where b.account_id is null and b.user_id is not null;
