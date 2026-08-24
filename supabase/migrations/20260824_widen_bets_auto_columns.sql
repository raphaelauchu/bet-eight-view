-- Elargit les colonnes de bets_auto qui debordaient avec des valeurs completes
-- extraites par l'IA (ex: "Montreal Canadiens" au lieu d'un code a 3 lettres).

ALTER TABLE bets_auto ALTER COLUMN bookmaker TYPE VARCHAR(50);
ALTER TABLE bets_auto ALTER COLUMN type_bet TYPE VARCHAR(50);
ALTER TABLE bets_auto ALTER COLUMN stat_type TYPE VARCHAR(100);
ALTER TABLE bets_auto ALTER COLUMN equipe TYPE VARCHAR(100);
ALTER TABLE bets_auto ALTER COLUMN adversaire TYPE VARCHAR(100);
