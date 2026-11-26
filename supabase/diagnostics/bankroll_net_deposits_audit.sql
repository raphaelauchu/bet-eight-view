-- ============================================================================================
-- AUDIT BANKROLL -- transactions et paris par compte -- lecture seule, aucun secret, aucune
-- ecriture.
--
-- A coller dans le SQL Editor de Supabase. Remplacez '<USER_ID>' PARTOUT ou il apparait (une
-- fois par section) par votre UUID (visible via SECTION 0 ci-dessous si vous ne l'avez pas).
--
-- Contexte (voir src/PerformanceInsights.js) : avant le correctif du 2026-11-26, cette page
-- lisait par erreur deux anciennes tables (`bankroll`/colonne `montant`, `transactions`) issues
-- d'avant la refonte multi-comptes du 2026-11-21 -- plus jamais alimentees depuis, d'ou un
-- solde ("924$") sans rapport avec vos vrais comptes et un "Net deposits" toujours a 0$ (la
-- table `transactions` interrogee etait vide/inexistante). La page lit desormais
-- bankroll_accounts/bankroll_transactions, comme l'accueil et la page de compte. Ce fichier
-- sert a verifier concretement vos donnees reelles dans ces tables.
--
-- Ce fichier ne contient QUE des SELECT. Vous pouvez executer tout le fichier d'un coup
-- (Supabase affiche le resultat de chaque section) ou une section a la fois.
-- ============================================================================================


-- =========================================================================================
-- SECTION 0 -- Trouver votre UUID si vous ne l'avez pas sous la main.
-- =========================================================================================
select id as user_id, email
from auth.users
order by created_at desc;


-- =========================================================================================
-- SECTION 1 -- Vos comptes bankroll (bankroll_accounts) : kind, archive ou non.
-- =========================================================================================
select id as account_id, name, kind, archived_at, created_at
from bankroll_accounts
where user_id = '<USER_ID>'
order by created_at;


-- =========================================================================================
-- SECTION 2 -- Transactions (bankroll_transactions) par compte, avec depots/retraits/net
-- cumules -- c'est cette somme (type='deposit' moins type='withdrawal') qui doit egaler le
-- "Net deposits" affiche dans l'app. Si cette section est vide alors que vous avez bien fait
-- un depot, le probleme n'est PAS cote app (la requete source est la meme que celle-ci).
-- =========================================================================================
select
  t.account_id,
  a.name as account_name,
  a.archived_at,
  t.type,
  t.amount,
  t.occurred_on,
  t.note,
  t.created_at
from bankroll_transactions t
join bankroll_accounts a on a.id = t.account_id
where t.user_id = '<USER_ID>'
order by a.name, t.occurred_on;

-- Net deposits agrege par compte (deposits - withdrawals) -- compare directement a la carte
-- "Net deposits" de Performance insights / "Depots nets" de la page de compte.
select
  a.id as account_id,
  a.name as account_name,
  a.archived_at,
  coalesce(sum(case when t.type = 'deposit' then t.amount else 0 end), 0) as total_deposits,
  coalesce(sum(case when t.type = 'withdrawal' then t.amount else 0 end), 0) as total_withdrawals,
  coalesce(sum(case when t.type = 'deposit' then t.amount when t.type = 'withdrawal' then -t.amount else 0 end), 0) as net_deposits
from bankroll_accounts a
left join bankroll_transactions t on t.account_id = a.id
where a.user_id = '<USER_ID>'
group by a.id, a.name, a.archived_at
order by a.name;


-- =========================================================================================
-- SECTION 3 -- Paris (table `paris`, entrees manuelles) par compte : mise/cote/profit/statut.
-- =========================================================================================
select
  p.account_id,
  a.name as account_name,
  p.id,
  p.match,
  p.bookmaker,
  p.mise,
  p.cote,
  p.statut,
  p.profit,
  p.date_pari
from paris p
left join bankroll_accounts a on a.id = p.account_id
where p.user_id = '<USER_ID>'
order by p.date_pari desc;


-- =========================================================================================
-- SECTION 4 -- Paris importes (table `bets_auto`) par compte : mise/cote/resultat/statut.
-- =========================================================================================
select
  b.account_id,
  a.name as account_name,
  b.id,
  b.bookmaker,
  b.type_bet,
  b.mise,
  b.cote,
  b.statut,
  b.resultat,
  b.game_date,
  b.verified_at,
  b.created_at
from bets_auto b
left join bankroll_accounts a on a.id = b.account_id
where b.user_id = '<USER_ID>'
order by coalesce(b.verified_at, b.created_at) desc;

-- Mises/retours/profit agreges par compte, paris DECIDES uniquement (gagne/perdu, pas annule)
-- -- compare directement au solde/ROI affiches dans l'app pour ce compte (paris + bets_auto
-- combines).
select
  account_id,
  account_name,
  sum(mise) as total_mises,
  sum(case when statut in ('gagne') then mise * cote when statut in ('annule') then mise else 0 end) as total_retours,
  sum(case when statut = 'gagne' then mise * cote - mise when statut = 'perdu' then -mise else 0 end) as profit,
  count(*) filter (where statut = 'gagne') as gagnes,
  count(*) filter (where statut = 'perdu') as perdus,
  count(*) filter (where statut in ('actif', 'pending')) as en_cours
from (
  select account_id, a.name as account_name, mise, cote, statut, 'paris' as source
  from paris p left join bankroll_accounts a on a.id = p.account_id
  where p.user_id = '<USER_ID>'
  union all
  select account_id, a.name as account_name, mise, cote, case when statut = 'pending' then 'actif' else statut end as statut, 'bets_auto' as source
  from bets_auto b left join bankroll_accounts a on a.id = b.account_id
  where b.user_id = '<USER_ID>'
) tous_les_paris
group by account_id, account_name
order by account_name;


-- =========================================================================================
-- SECTION 5 (optionnelle) -- Anciennes tables pre-refonte (`bankroll`/`transactions`), source
-- probable du "924$" sans rapport. Si ces tables n'existent plus dans votre projet, cette
-- section renverra une erreur "relation does not exist" -- c'est normal, ignorez-la : cela
-- confirme simplement qu'elles ont deja ete nettoyees.
-- =========================================================================================
select * from bankroll where user_id = '<USER_ID>';
select * from transactions where user_id = '<USER_ID>';
