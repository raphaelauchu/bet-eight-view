// Statuts à vérifier régulièrement auprès de l'AGCO, de l'AGLC et de Loto-Québec.
// Ne pas modifier sans validation juridique.
//
// Ce fichier est la source unique de vérité pour le comparateur de cotes LNH
// (src/LineShopping.js) : statut réglementaire par site et par province, et mapping vers la
// clé bookmaker de la source de cotes (The Odds API, voir src/cotes.js) quand elle existe.
// Un site dont oddsApiBookmakerKey est null n'est PAS fourni par la source de cotes actuelle :
// il doit toujours afficher "Cotes non disponibles", jamais une cote inventée ou scrapée.

export const STATUT = {
  REGULATED: 'regulated',
  GREY: 'grey',
  UNVERIFIED: 'unverified',
};

export const PROVINCES = ['quebec', 'ontario', 'alberta', 'autre'];

// id -> clé bookmaker telle que renvoyée par The Odds API (champ `bookmakers[].key` de
// GET /v4/sports/icehockey_nhl/odds). bet99 et sportsinteraction n'ont pas de clé : The Odds
// API ne couvre pas ces deux sites pour la LNH à ce jour (vérifié dans l'audit de la source,
// voir résumé de la tâche qui a introduit ce fichier).
export const SPORTSBOOKS = [
  {
    id: 'bet365',
    nom: 'bet365',
    oddsApiBookmakerKey: 'bet365',
    statutsParProvince: {
      ontario: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
      alberta: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
      quebec: { statut: STATUT.GREY, lastVerified: '2026-11-18' },
    },
  },
  {
    id: 'betway',
    nom: 'Betway',
    oddsApiBookmakerKey: 'betway',
    statutsParProvince: {
      ontario: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
      alberta: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
      quebec: { statut: STATUT.GREY, lastVerified: '2026-11-18' },
    },
  },
  {
    id: 'bet99',
    nom: 'BET99',
    oddsApiBookmakerKey: null,
    statutsParProvince: {
      ontario: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
      alberta: { statut: STATUT.UNVERIFIED, lastVerified: '2026-11-18' },
      quebec: { statut: STATUT.GREY, lastVerified: '2026-11-18' },
    },
  },
  {
    id: 'sportsinteraction',
    nom: 'Sports Interaction',
    oddsApiBookmakerKey: null,
    statutsParProvince: {
      ontario: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
      alberta: { statut: STATUT.UNVERIFIED, lastVerified: '2026-11-18' },
      quebec: { statut: STATUT.GREY, lastVerified: '2026-11-18' },
    },
  },
];

// Mise-o-jeu+ : affiché comme information au Québec seulement, jamais de cotes (la source
// actuelle ne le fournit pas) -- voir règle 3 de la tâche.
export const MISE_O_JEU = {
  id: 'miseojeu',
  nom: 'Mise-o-jeu+',
  oddsApiBookmakerKey: null,
  statutsParProvince: {
    quebec: { statut: STATUT.REGULATED, lastVerified: '2026-11-18' },
  },
};

// Sites à afficher pour une province donnée : "unverified" est toujours masqué (statut non
// confirmé, on ne prend pas position), "autre" n'affiche jamais aucun site.
export function getSportsbooksPourProvince(province) {
  if (!province || province === 'autre') return [];
  return SPORTSBOOKS
    .map(sb => ({ ...sb, statutInfo: sb.statutsParProvince[province] || null }))
    .filter(sb => sb.statutInfo && sb.statutInfo.statut !== STATUT.UNVERIFIED);
}

// Clé i18n (src/i18n.js) pour l'étiquette de statut affichée à côté du nom du site.
export function getStatutLabelKey(statut, province) {
  if (statut === STATUT.REGULATED) {
    if (province === 'ontario') return 'sportsbook_statut_regule_on';
    if (province === 'alberta') return 'sportsbook_statut_regule_ab';
    if (province === 'quebec') return 'sportsbook_statut_regule_qc';
    return null;
  }
  if (statut === STATUT.GREY) return 'sportsbook_statut_gris_qc';
  return null;
}
