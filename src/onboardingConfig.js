// ===================== Interrupteur de l'onboarding (nouveaux utilisateurs) =====================
// Meme mecanisme que les autres drapeaux du projet (src/bankrollConfig.js, src/pricingConfig.js,
// src/brandAssetsConfig.js) : repasser a `false` retire entierement l'onboarding de l'interface
// (voir App.js, le seul endroit qui lit ce drapeau) sans rien supprimer -- le code/les donnees
// restent en place, prets a etre reactives.
export const ONBOARDING_ENABLED = true;
