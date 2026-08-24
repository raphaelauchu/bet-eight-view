-- Ajoute le support multi-providers (Gmail + Outlook) a user_email_connections.
-- Suppose que la table existe deja (voir 20260823_email_parsing_bets_auto.sql)
-- avec les colonnes gmail_token / gmail_refresh_token d'origine.

ALTER TABLE user_email_connections RENAME COLUMN gmail_token TO access_token;
ALTER TABLE user_email_connections RENAME COLUMN gmail_refresh_token TO refresh_token;

ALTER TABLE user_email_connections ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'gmail';

-- Une ligne par utilisateur et par provider (gmail, outlook, ...)
ALTER TABLE user_email_connections
  ADD CONSTRAINT user_email_connections_user_provider_unique UNIQUE (user_id, provider);
