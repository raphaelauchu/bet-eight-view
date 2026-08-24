-- Corrige 3 bugs rapportes sur le Dashboard :
-- 1) Suppression d'un bet actif (bets_auto) sans effet
-- 2) Suppression dans l'historique sans effet
-- 3) La bankroll ne s'actualise pas au marquage Gagne/Perdu
--
-- Cause racine probable : la table `bets_auto` a ete creee (migration
-- 20260823_email_parsing_bets_auto.sql) sans jamais activer Row Level
-- Security ni definir de policies. Les tables `paris` et `bankroll` ont ete
-- creees hors migration (dashboard Supabase) et ne sont donc pas garanties
-- d'avoir les bonnes policies ni toutes les colonnes utilisees par le code
-- (`bankroll.updated_at` notamment). Selon la configuration exacte du
-- projet, cela se traduit soit par des ecritures silencieusement refusees
-- par RLS, soit par une erreur "column does not exist" — dans les deux cas
-- l'ancien code de src/Dashboard.js n'inspectait jamais `error`, donc rien
-- ne remontait a l'utilisateur (voir le fix cote client dans le meme commit).

-- 1) S'assurer que bankroll a les colonnes attendues par le code
ALTER TABLE bankroll ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE bankroll ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2) bets_auto : activer RLS + policies (jamais fait depuis la creation de la table)
ALTER TABLE bets_auto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bets_auto_select_own" ON bets_auto;
CREATE POLICY "bets_auto_select_own" ON bets_auto
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bets_auto_insert_own" ON bets_auto;
CREATE POLICY "bets_auto_insert_own" ON bets_auto
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bets_auto_update_own" ON bets_auto;
CREATE POLICY "bets_auto_update_own" ON bets_auto
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bets_auto_delete_own" ON bets_auto;
CREATE POLICY "bets_auto_delete_own" ON bets_auto
  FOR DELETE USING (auth.uid() = user_id);

-- 3) bankroll : activer RLS + policies (table hors migrations, on securise par prudence)
ALTER TABLE bankroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankroll_select_own" ON bankroll;
CREATE POLICY "bankroll_select_own" ON bankroll
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_insert_own" ON bankroll;
CREATE POLICY "bankroll_insert_own" ON bankroll
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_update_own" ON bankroll;
CREATE POLICY "bankroll_update_own" ON bankroll
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_delete_own" ON bankroll;
CREATE POLICY "bankroll_delete_own" ON bankroll
  FOR DELETE USING (auth.uid() = user_id);

-- 4) paris (legacy mais toujours utilisee par la fiche detaillee) : idem
ALTER TABLE paris ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paris_select_own" ON paris;
CREATE POLICY "paris_select_own" ON paris
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "paris_insert_own" ON paris;
CREATE POLICY "paris_insert_own" ON paris
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "paris_update_own" ON paris;
CREATE POLICY "paris_update_own" ON paris
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "paris_delete_own" ON paris;
CREATE POLICY "paris_delete_own" ON paris
  FOR DELETE USING (auth.uid() = user_id);
