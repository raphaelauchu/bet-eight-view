// ===================== Interrupteur du bloc "Mes Bookmakers" (import par courriel) ===============
// Meme mecanisme que les autres drapeaux du projet (src/onboardingConfig.js, src/authConfig.js,
// src/profileConfig.js) : repasser EMAIL_IMPORT_ENABLED a `true` reaffiche entierement le bloc
// (connexion Gmail/Outlook, parsing automatique, liste des bookmakers a suivre -- voir
// src/App.js:ProfilePage, seul endroit qui lit ce drapeau) sans rien reecrire -- aucune fonction
// Edge, migration ou table n'est supprimee par ce drapeau (voir supabase/functions/outlook-oauth,
// supabase/migrations/20260823_email_parsing_bets_auto.sql, toujours en place).
export const EMAIL_IMPORT_ENABLED = false;
