// ===================== Interrupteur de l'onboarding (nouveaux utilisateurs) =====================
// Meme mecanisme que les autres drapeaux du projet (src/bankrollConfig.js, src/pricingConfig.js,
// src/brandAssetsConfig.js) : repasser a `false` retire entierement l'onboarding de l'interface
// (voir App.js, le seul endroit qui lit ce drapeau) sans rien supprimer -- le code/les donnees
// restent en place, prets a etre reactives.
export const ONBOARDING_ENABLED = true;

// ===================== Interrupteur du carrousel de 3 diapos d'introduction =====================
// Retire pour le moment (demande explicite, le 26 nov 2026 : "peu professionnel" avec des cartes
// de demonstration dessinees a la main plutot que de vraies captures de l'app). Le code du
// carrousel (src/Onboarding.js, OnboardingCarousel + les 3 cartes de demo) reste en place, non
// supprime -- repasser ce drapeau a `true` le reaffiche tel quel, idealement avec de vraies
// captures d'ecran une fois disponibles (beta). Drapeau INDEPENDANT d'ONBOARDING_ENABLED
// ci-dessus : quand il est a `false`, l'onboarding saute directement aux 5 etapes.
export const ONBOARDING_INTRO_SLIDES_ENABLED = false;
