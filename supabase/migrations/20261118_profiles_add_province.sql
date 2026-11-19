-- Ajoute la province de l'utilisateur, confirmee manuellement dans son profil (pas de
-- geolocalisation IP comme seule source -- voir src/App.js ProfilePage). Utilisee par le
-- comparateur de cotes LNH (src/LineShopping.js) pour determiner quels sites afficher et
-- quel statut reglementaire leur appliquer (src/sportsbooksConfig.js).
-- Idempotente (add column if not exists). La table profiles existe deja hors de ce dossier
-- de migrations (creee via le dashboard Supabase) -- aucune modification de RLS ici.

alter table profiles add column if not exists province text;
