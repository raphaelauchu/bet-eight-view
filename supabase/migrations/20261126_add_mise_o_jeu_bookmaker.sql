-- Ajoute Mise-o-jeu+ (Loto-Quebec) comme sportsbook reconnu pour les comptes bankroll
-- (src/AddAccountBody.js, kind 'mise_o_jeu') -- cette migration elargit seulement la contrainte
-- CHECK existante, aucune donnee n'est modifiee. Idempotente (DROP IF EXISTS + ADD, meme pattern
-- que 20261114_trade_counter_offers.sql) : rejouable sans effet si deja appliquee. Le nom de
-- contrainte auto-genere par Postgres pour un check inline sur une seule colonne est toujours
-- "<table>_<colonne>_check" (voir 20261121_bankroll_accounts.sql, jamais renomme depuis).
--
-- Mise-o-jeu+ n'a aucune cote en direct dans le comparateur (The Odds API ne le couvre pas, voir
-- src/sportsbooksConfig.js) -- cette migration ne touche ni SPORTSBOOKS ni le comparateur, ses
-- cotes restent exclusivement saisies manuellement dans Add Bet.
alter table bankroll_accounts drop constraint if exists bankroll_accounts_kind_check;
alter table bankroll_accounts add constraint bankroll_accounts_kind_check
  check (kind in ('bet365', 'betway', 'bet99', 'sports_interaction', 'mise_o_jeu', 'other'));
