// ===================== Interrupteurs de l'ecran de connexion/inscription (src/Auth.js) =====================
// Meme mecanisme que les autres drapeaux du projet (src/onboardingConfig.js,
// src/bankrollConfig.js, src/landingConfig.js) : un bouton dont le drapeau est a `false` n'est
// jamais affiche (ni sa logique montee) -- repasser a `true` le reaffiche tel quel, rien a
// supprimer. AUTH_APPLE_ENABLED est reserve pour plus tard : aucun bouton ni aucune logique Apple
// n'existe encore dans src/Auth.js, ce drapeau ne fait rien pour le moment.
export const AUTH_GOOGLE_ENABLED = true;
export const AUTH_EMAIL_ENABLED = true;
export const AUTH_APPLE_ENABLED = false;
