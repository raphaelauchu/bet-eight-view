-- Systeme de email parsing et verification automatique des bets via API NHL

CREATE TABLE user_email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  gmail_token TEXT,
  gmail_refresh_token TEXT,
  bookmakers TEXT[],
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bets_auto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  bookmaker VARCHAR(50),
  type_bet VARCHAR(50),
  joueur_nom VARCHAR(100),
  equipe VARCHAR(10),
  adversaire VARCHAR(10),
  game_id BIGINT,
  stat_type VARCHAR(50),
  ligne DECIMAL(10,2),
  mise DECIMAL(10,2),
  cote DECIMAL(10,2),
  gain_potentiel DECIMAL(10,2),
  statut VARCHAR(20) DEFAULT 'pending',
  resultat DECIMAL(10,2),
  email_raw TEXT,
  game_date DATE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_parsing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  bookmaker VARCHAR(50),
  email_subject TEXT,
  email_received_at TIMESTAMP,
  parsed_success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les lookups frequents (par utilisateur, par match, par statut de verification)
CREATE INDEX idx_user_email_connections_user_id ON user_email_connections(user_id);
CREATE INDEX idx_bets_auto_user_id ON bets_auto(user_id);
CREATE INDEX idx_bets_auto_game_id ON bets_auto(game_id);
CREATE INDEX idx_bets_auto_statut ON bets_auto(statut);
CREATE INDEX idx_email_parsing_logs_user_id ON email_parsing_logs(user_id);
