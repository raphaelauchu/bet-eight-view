// ===================== Interrupteur d'actifs visuels LNH =====================
// Tant qu'aucune licence (LNH / NHLPA) n'existe, TOUTES les photos de joueurs et tous les
// logos d'equipe sont remplaces par des elements neutres dessines par Betrics (voir
// src/BrandAssets.js). L'ancien code qui pointait vers assets.nhle.com reste en place partout,
// simplement gele derriere cet interrupteur -- le repasser a `true` le jour ou une licence
// existe suffit a restaurer les vraies photos/logos, sans rien reecrire.
export const USE_LICENSED_NHL_ASSETS = false;

// ===================== Interrupteur visuels LNH -- Pool UNIQUEMENT =====================
// Independant de USE_LICENSED_NHL_ASSETS ci-dessus (qui reste `false` et continue de geler
// photos/logos partout ailleurs dans l'app -- Accueil, Analyses, Paris, Bankroll, Recherche,
// partage de stats). NHL_VISUALS_ENABLED controle UNIQUEMENT l'onglet Pool (src/poolVisuals.js) :
// liste des joueurs, selection, classement, cartes de joueurs, equipes -- voir ce fichier pour
// les composants (PoolPlayerPhoto/PoolTeamLogo), qui chargent les URLs publiques assets.nhle.com
// a la volee (jamais copiees dans le depot) avec repli propre (initiales/abreviation) si
// l'image echoue ou si ce drapeau est a `false`.
export const NHL_VISUALS_ENABLED = true;

// ===================== Interrupteur casque/masque vs icone de profil vide =====================
// Casque (PlayerHelmet) et masque de gardien (GoalieMask) ont ete abandonnes au profit d'une
// icone de profil generique (silhouette, voir BlankProfileIcon dans src/BrandAssets.js), la
// meme pour attaquants/defenseurs/gardiens. Le code des casques/masques (PlayerHelmetSvg/
// GoalieMaskSvg) reste en place, simplement gele derriere cet interrupteur -- le repasser a
// `true` restaure leur affichage partout sans rien reecrire.
export const USE_PLAYER_HELMET_ICONS = false;
