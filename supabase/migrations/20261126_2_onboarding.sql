-- Onboarding des nouveaux utilisateurs (carrousel + 5 etapes, src/Onboarding.js). Stocke sur
-- `profiles` (table deja soumise a RLS -- policies "select/insert/update own profile" existantes,
-- voir 20261118_profiles_add_province.sql/20261119_2_profiles_is_admin.sql, creees hors de ce
-- dossier de migrations via le dashboard Supabase) plutot que dans une nouvelle table : aucune
-- nouvelle policy RLS a ecrire, un utilisateur ne peut deja lire/ecrire que sa propre ligne.
-- Idempotente (add column if not exists).
--
-- onboarding_completed : `false` par defaut pour une NOUVELLE ligne (nouvel utilisateur, cree via
-- l'upsert de src/Auth.js a l'inscription) -- c'est ce qui declenche l'affichage de l'onboarding.
-- onboarding_answers : reponses des 5 etapes (bookmakers choisis, objectifs, experience, source de
-- decouverte, etc.), format libre en JSON -- voir src/Onboarding.js pour la forme exacte.
-- onboarding_completed_at : horodatage de fin, null tant que non complete.
alter table profiles add column if not exists onboarding_completed boolean not null default false;
alter table profiles add column if not exists onboarding_answers jsonb;
alter table profiles add column if not exists onboarding_completed_at timestamptz;

-- Les utilisateurs EXISTANTS (crees avant ce correctif) ne doivent jamais voir l'onboarding --
-- marques completes retroactivement ici. Les lignes crees APRES cette migration (nouveaux
-- utilisateurs) gardent le defaut `false` ci-dessus et verront l'onboarding a leur premiere
-- connexion.
update profiles set onboarding_completed = true where onboarding_completed = false;
