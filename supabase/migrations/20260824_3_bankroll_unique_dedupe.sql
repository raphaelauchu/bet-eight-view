-- Bug bankroll qui ne s'actualise jamais : la table `bankroll` n'avait pas de
-- contrainte UNIQUE sur user_id. Le code (Dashboard.js chargerDonnees + le
-- .upsert() de BankrollPage/App.js) inserait une nouvelle ligne a chaque
-- chargement de page des que .single() echouait (ce qui arrive des qu'il y a
-- plus d'une ligne pour le meme user_id), et .upsert({user_id, montant}) sans
-- onConflict genere aussi une nouvelle ligne (id) a chaque appel au lieu de
-- mettre a jour l'existante. Resultat en prod : 108 lignes dupliquees pour un
-- seul utilisateur, la derniere ecriture reelle (905) etant noyee sous des
-- lignes de reset a 1000 creees par le bug.
--
-- Applique manuellement en prod le 2026-08-24 via `supabase db query --linked`
-- (dedupe : conservation de la ligne dont le montant correspond a la derniere
-- vraie mise a jour, ordre de repli sur updated_at le plus recent) :
--
-- DELETE FROM bankroll WHERE id IN (
--   SELECT id FROM (
--     SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY (montant <> 905), updated_at DESC) AS rn
--     FROM bankroll
--   ) t WHERE t.rn > 1
-- );
--
-- Cette migration documente le fix et l'applique sur tout futur environnement
-- (staging/local) ou la table bankroll contiendrait deja des doublons.

DELETE FROM bankroll WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
    FROM bankroll
  ) t WHERE t.rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bankroll_user_id_key'
  ) THEN
    ALTER TABLE bankroll ADD CONSTRAINT bankroll_user_id_key UNIQUE (user_id);
  END IF;
END $$;
