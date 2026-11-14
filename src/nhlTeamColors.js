// Palette de couleurs officielles par equipe LNH (couleurs de marque publiques, memes
// equipes que LOGOS_NHL dans Analyses.js). Utilisee pour le degrade du bandeau d'equipe de
// la Vue vestiaire (src/PoolLockerRoom.js) -- jamais pour imiter l'identite visuelle d'un
// jeu video, seulement les couleurs reelles de l'equipe LNH choisie par le participant.
export const NHL_TEAM_COLORS = {
  ANA: { primary: '#F47A38', secondary: '#111111' },
  BOS: { primary: '#FFB81C', secondary: '#000000' },
  BUF: { primary: '#002654', secondary: '#FCB514' },
  CGY: { primary: '#C8102E', secondary: '#F1BE48' },
  CAR: { primary: '#CC0000', secondary: '#000000' },
  CHI: { primary: '#CF0A2C', secondary: '#000000' },
  COL: { primary: '#6F263D', secondary: '#236192' },
  CBJ: { primary: '#002654', secondary: '#CE1126' },
  DAL: { primary: '#006847', secondary: '#111111' },
  DET: { primary: '#CE1126', secondary: '#111111' },
  EDM: { primary: '#041E42', secondary: '#FF4C00' },
  FLA: { primary: '#C8102E', secondary: '#041E42' },
  LAK: { primary: '#111111', secondary: '#A2AAAD' },
  MIN: { primary: '#154734', secondary: '#A6192E' },
  MTL: { primary: '#AF1E2D', secondary: '#192168' },
  NSH: { primary: '#FFB81C', secondary: '#041E42' },
  NJD: { primary: '#CE1126', secondary: '#111111' },
  NYI: { primary: '#00539B', secondary: '#F47D30' },
  NYR: { primary: '#0038A8', secondary: '#CE1126' },
  OTT: { primary: '#C52032', secondary: '#111111' },
  PHI: { primary: '#F74902', secondary: '#111111' },
  PIT: { primary: '#FCB514', secondary: '#111111' },
  SJS: { primary: '#006D75', secondary: '#111111' },
  SEA: { primary: '#001628', secondary: '#99D9D9' },
  STL: { primary: '#002F87', secondary: '#FCB514' },
  TBL: { primary: '#002868', secondary: '#FFFFFF' },
  TOR: { primary: '#00205B', secondary: '#FFFFFF' },
  UTA: { primary: '#71AFE5', secondary: '#111111' },
  VAN: { primary: '#00205B', secondary: '#00843D' },
  VGK: { primary: '#B4975A', secondary: '#333F42' },
  WSH: { primary: '#C8102E', secondary: '#041E42' },
  WPG: { primary: '#041E42', secondary: '#AC162C' },
};

// Repli neutre Betrics (sombre + orange) : utilise quand le participant n'a pas de pick
// d'equipe LNH (pool fantasy sans choix d'equipe, ou pool classique avec teamPicks: 0).
export const BETRICS_NEUTRAL_COLORS = { primary: '#111111', secondary: '#f97316' };

// Degrade CSS pret a l'emploi pour un abbrev d'equipe (ou le repli neutre si absent/inconnu).
export function teamGradient(abbrev) {
  const c = NHL_TEAM_COLORS[abbrev] || BETRICS_NEUTRAL_COLORS;
  return `linear-gradient(135deg, ${c.primary} 0%, ${c.secondary} 100%)`;
}

export function teamColors(abbrev) {
  return NHL_TEAM_COLORS[abbrev] || BETRICS_NEUTRAL_COLORS;
}
