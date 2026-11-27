// ===================== Interrupteur de la refonte de la landing (header + hero) =====================
// Meme mecanisme que les autres drapeaux du projet (src/onboardingConfig.js,
// src/bankrollConfig.js, src/pricingConfig.js) : repasser a `false` restaure instantanement
// l'ancien header (src/Navbar.js) et l'ancien hero (HomeHero dans src/Landing.js) -- aucun code
// n'est supprime, voir src/PublicSite.js (bascule header) et src/Landing.js (bascule hero), les
// deux seuls endroits qui lisent ce drapeau. Porte UNIQUEMENT sur le header + le premier ecran de
// l'accueil public (route "accueil") -- les autres pages publiques (Pool, Tarifs, outils, guide)
// et le reste du contenu de l'accueil (blocs alternes, FAQ, CTA finale) restent inchanges, peu
// importe ce drapeau.
export const LANDING_V2_ENABLED = true;

// ===================== Carte "Comparateur de cotes" de la section Fonctions (src/LandingOddsCard.js) ====
// Apercu de la valeur attendue (EV) -- calcul de DEMONSTRATION uniquement (voir
// src/landingFeaturesCalc.js:fairProbability/computeEV), jamais branche sur une vraie source de
// cotes ici. `false` retire entierement la pastille "+EV", le pourcentage, l'etiquette "Bientot"
// et le paragraphe d'explication -- la carte revient a la version "probabilite implicite + marge
// du marche" seulement, sans aucune mention d'EV.
export const LANDING_EV_PREVIEW_ENABLED = true;
