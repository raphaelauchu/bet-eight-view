-- Empeche d'enregistrer un pari (bets_auto, la seule table de paris activement alimentee -- voir
-- 20261121_bankroll_accounts.sql) dont la mise depasse le disponible ACTUEL du compte vise.
-- Verification cote base en plus de la validation cote app (src/BetImportFlow.js,
-- src/bankrollCalc.js:canPlaceBet) -- memes composants que le disponible calcule en JS :
-- depots - retraits - TOUTES les mises deja engagees (paris + bets_auto, en cours ou regles) +
-- montant retourne par les paris DEJA regles (gagnant : mise*cote, perdant : 0). Desactive quand
-- auth.uid() est NULL (migration/SQL editor, meme pattern que check_withdrawal_balance) pour ne
-- jamais bloquer une correction manuelle faite par un administrateur ou une migration future.
create or replace function check_bet_stake_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  disponible numeric;
begin
  if NEW.account_id is null or auth.uid() is null then
    return NEW;
  end if;

  select
    coalesce((select sum(case when t.type = 'deposit' then t.amount when t.type = 'withdrawal' then -t.amount else 0 end) from bankroll_transactions t where t.account_id = NEW.account_id), 0)
    - coalesce((select sum(b.mise) from bets_auto b where b.account_id = NEW.account_id), 0)
    + coalesce((select sum(case when b.statut = 'gagne' then b.mise * b.cote when b.statut = 'perdu' then 0 else b.mise end) from bets_auto b where b.account_id = NEW.account_id and b.statut <> 'pending'), 0)
    - coalesce((select sum(p.mise) from paris p where p.account_id = NEW.account_id), 0)
    + coalesce((select sum(case when p.statut = 'gagne' then p.mise * p.cote when p.statut = 'perdu' then 0 else p.mise end) from paris p where p.account_id = NEW.account_id and p.statut <> 'actif'), 0)
  into disponible;

  if NEW.mise > disponible then
    raise exception 'Mise refusee : montant (%) superieur au disponible (%) du compte', NEW.mise, disponible;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_bet_stake_balance on bets_auto;
create trigger trg_check_bet_stake_balance
  before insert on bets_auto
  for each row
  execute function check_bet_stake_balance();
