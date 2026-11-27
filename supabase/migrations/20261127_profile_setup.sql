-- ===================== Porte d'entree "Complete ton profil" (src/ProfileSetup.js) =====================
-- Nouvelle etape obligatoire APRES l'authentification (Google OU courriel) et AVANT l'onboarding
-- (voir 20261126_2_onboarding.sql) -- corrige le trou ou un nouveau compte Google arrivait
-- directement dans l'app sans jamais remplir profil/onboarding (ceux-ci n'apparaissaient qu'a la
-- reconnexion). Stocke sur `profiles` (deja soumise a RLS -- policies "select/insert/update own
-- profile" existantes, creees hors de ce dossier via le dashboard Supabase, voir
-- 20261118_profiles_add_province.sql/20261119_2_profiles_is_admin.sql) : aucune nouvelle policy
-- RLS necessaire, un utilisateur ne peut deja lire/ecrire que sa propre ligne. Idempotente
-- (add column if not exists partout).
--
-- first_name/last_name/username existent deja (voir migrations ci-dessus, utilises par
-- src/App.js:ProfilePage) -- `add column if not exists` ici est un no-op pour ces trois,
-- seulement defensif si ce fichier est applique sur une base qui ne les aurait pas encore.
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists username text;

-- `country`/`region` : PAS la meme chose que la colonne `province` existante (voir
-- 20261118_profiles_add_province.sql) -- celle-ci reste reservee au comparateur de cotes LNH
-- (src/sportsbooksConfig.js:PROVINCES, domaine volontairement restreint a
-- 'quebec'|'ontario'|'alberta'|'autre', logique propre a ce module). Reutiliser `province` ici
-- aurait change silencieusement le comportement de ce comparateur pour tout utilisateur d'une
-- province hors Quebec/Ontario/Alberta -- `region` est donc une colonne neuve, dediee au profil et
-- au calcul de l'age minimum (voir src/profileConfig.js), avec son propre domaine de valeurs plus
-- fin (codes a 2 lettres : provinces/territoires canadiens ou etats americains ; `country` =
-- 'CA'|'US').
alter table profiles add column if not exists country text;
alter table profiles add column if not exists region text;
alter table profiles add column if not exists birth_date date;
alter table profiles add column if not exists profile_completed_at timestamptz;

-- Comptes EXISTANTS (crees avant cette migration) : gardent profile_completed_at a NULL --
-- JAMAIS retroactivement marques completes (contrairement a onboarding_completed en son temps,
-- voir 20261126_2_onboarding.sql) -- ils completeront leur profil une seule fois a leur prochaine
-- connexion, demande explicite de la tache.

-- Contrainte de forme (3-20 caracteres, lettres/chiffres/underscore/point) -- verifiee aussi cote
-- client (src/ProfileSetup.js) et par la RPC is_username_available ci-dessous, mais jamais
-- seulement cote client : un utilisateur pourrait contourner l'UI et ecrire directement via l'API
-- authentifiee (policy RLS "update own profile" existante autorise deja a modifier sa propre
-- ligne). NULL autorise (compte pas encore complete).
alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username is null or (char_length(username) between 3 and 20 and username ~ '^[a-zA-Z0-9_.]+$'));

-- Unicite insensible a la casse ('Alex' et 'alex' entrent en conflit) -- NULL exclu explicitement
-- (plusieurs comptes pas encore completes peuvent tous avoir username NULL sans se bloquer
-- mutuellement ; Postgres traiterait deja NULL comme distinct de lui-meme dans un index unique
-- standard, le where ci-dessous le rend seulement explicite).
create unique index if not exists idx_profiles_username_lower
  on profiles (lower(username))
  where username is not null;

-- ===================== Disponibilite d'un nom d'utilisateur (RPC) =====================
-- security definer : necessaire pour verifier l'EXISTENCE d'un username appartenant a un AUTRE
-- utilisateur (la policy RLS "select own profile" existante n'autoriserait pas cette lecture
-- autrement) -- ne retourne QUE un booleen, aucune autre colonne d'un autre profil n'est jamais
-- exposee. Mots reserves inclus directement ici (pas seulement cote client, src/profileConfig.js)
-- pour qu'ils restent bloques meme si l'UI est contournee.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_username is not null
    and char_length(p_username) between 3 and 20
    and p_username ~ '^[a-zA-Z0-9_.]+$'
    and lower(p_username) not in (
      'admin', 'administrator', 'betrics', 'support', 'help', 'root', 'moderator', 'mod',
      'staff', 'official', 'system', 'security', 'null', 'undefined', 'contact', 'info'
    )
    and not exists (
      select 1 from profiles where lower(username) = lower(p_username)
    );
$$;

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to authenticated;
