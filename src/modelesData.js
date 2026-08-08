// Modeles de paris : donnees et logique mockees en attendant les vrais calculs/API.
// Chaque modele expose { id, type, nom, description, explication, roi, historique }.
// Les fonctions filtrerMatchsPourModele() et genererRecommandation() simulent respectivement
// le filtrage des matchs qui "qualifient" pour un modele et la recommandation finale, de facon
// deterministe (meme resultat pour un couple modele/match donne). A remplacer par de vrais
// calculs plus tard sans toucher a l'UI qui consomme ces fonctions.

// Hash deterministe d'une chaine -> entier positif (FNV-1a + finalisation type murmur3), utilise pour
// simuler des "resultats de calcul" stables (memes matchs/scores affiches a chaque rendu, pas aleatoire).
// L'etape de finalisation est necessaire : un simple rolling hash ne "melange" pas assez les bits pour
// des entrees tres proches (ex: des gameId consecutifs comme 2026010001/2026010002), ce qui produirait
// le meme classement de matchs pour tous les modeles.
function hashDeterministe(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}

// Genere un historique hebdomadaire de ROI cumulatif (pour le mini-graphique) se terminant sur roiFinal.
function genererHistoriqueROI(roiFinal, semaines, graine) {
  const pts = [];
  let valeur = 0;
  for (let i = 0; i < semaines; i++) {
    const bruit = Math.sin((i + 1) * (graine + 1) * 12.9898) * 43758.5453;
    const variation = (bruit - Math.floor(bruit) - 0.5) * (Math.abs(roiFinal) * 0.6 + 3);
    valeur += variation + (roiFinal - valeur) / (semaines - i);
    pts.push({ semaine: `S${i + 1}`, roi: parseFloat(valeur.toFixed(1)) });
  }
  pts[pts.length - 1].roi = roiFinal;
  return pts;
}

const MODELES_EQUIPE_BRUT = [
  {
    id: 'fatigue-b2b',
    nom: 'Fatigue Back-to-Back',
    description: '2e match en 2 soirs contre une équipe favorite aux cotes.',
    explication: "Ce modèle identifie les équipes jouant leur 2e match en 2 soirs contre une équipe favorite au niveau des cotes, où la fatigue historique tend à créer une valeur sur l'outsider.",
    roi: 18.4,
  },
  {
    id: 'favori-court-terme',
    nom: 'Favori Court Terme',
    description: 'Grand favori aux cotes face à un adversaire en méforme récente.',
    explication: "Ce modèle cible les matchs où le favori implicite des cotes affronte un adversaire en méforme sur ses 10 derniers matchs, une combinaison historiquement rentable sur le marché moneyline.",
    roi: 12.1,
  },
  {
    id: 'forme-l10',
    nom: 'Forme Récente L10',
    description: 'Écart marqué de forme sur les 10 derniers matchs entre les deux équipes.',
    explication: "Ce modèle compare le momentum des deux équipes sur leurs 10 derniers matchs et cible les écarts de forme pas encore pleinement reflétés dans les cotes du marché.",
    roi: 9.7,
  },
  {
    id: 'domicile-dominant',
    nom: 'Domicile Dominant',
    description: 'Fort avantage à domicile face à un visiteur en longue série de déplacements.',
    explication: "Ce modèle repère les équipes avec un net avantage statistique à domicile qui affrontent un visiteur en fin de longue série de matchs sur la route, un contexte propice à la fatigue du voyage.",
    roi: -4.2,
  },
  {
    id: 'defense-vs-cote',
    nom: 'Défense vs Cote',
    description: 'Cote favorite face à une défense adverse statistiquement solide.',
    explication: "Ce modèle compare la cote implicite du favori à la solidité défensive réelle de l'outsider (buts contre par match), cherchant les cas où le marché sous-estime la défense adverse.",
    roi: 6.3,
  },
];

const MODELES_JOUEUR_BRUT = [
  {
    id: 'historique-vs-gardien',
    nom: 'Historique vs Gardien',
    description: 'Historique de performance élevé contre le gardien adverse du soir.',
    explication: "Ce modèle analyse les confrontations passées d'un joueur contre le gardien partant adverse et cible les cas où un historique offensif fort tend à se répéter face au même gardien.",
    roi: 21.6,
  },
  {
    id: 'surperformance-recente',
    nom: 'Surperformance Récente',
    description: 'Production nettement au-dessus de la moyenne saison sur les 5 derniers matchs.',
    explication: "Ce modèle cible les joueurs en forme dont la production des 5 derniers matchs dépasse significativement leur moyenne saison, un signal de momentum offensif à court terme.",
    roi: 14.9,
  },
  {
    id: 'usage-accru',
    nom: 'Usage Accru',
    description: "Temps de glace ou rôle élargi suite à une blessure ailleurs dans l'alignement.",
    explication: "Ce modèle cible les joueurs dont le rôle ou le temps de glace a augmenté récemment en raison d'une blessure ou d'un changement de trio, créant une opportunité de production accrue.",
    roi: 11.4,
  },
  {
    id: 'domicile-prod',
    nom: 'Production à Domicile',
    description: 'Écart marqué de production entre matchs à domicile et à l’étranger.',
    explication: "Ce modèle repère les joueurs dont la production offensive est nettement supérieure à domicile, et cible leurs matchs joués devant leurs partisans.",
    roi: 8.1,
  },
  {
    id: 'pp-adverse-faible',
    nom: 'Avantage Powerplay Adverse',
    description: "Joueur de 1re unité d'avantage numérique face à un désavantage numérique adverse faible.",
    explication: "Ce modèle identifie les joueurs de première unité d'avantage numérique qui affrontent une équipe avec un désavantage numérique statistiquement faible, favorisant les points en PP.",
    roi: -2.8,
  },
];

function enrichirModele(brut, type, index) {
  const graine = hashDeterministe(brut.id);
  return {
    ...brut,
    type,
    historique: genererHistoriqueROI(brut.roi, 10, index),
    // Placeholder du "critere d'application" reel du modele (ex: fonction sur boxscore/roster/cotes).
    // Sert uniquement a documenter l'intention ; le filtrage effectif est mocke dans filtrerMatchsPourModele().
    critereApplication: `mock:${brut.id}`,
    _graine: graine,
  };
}

const MODELES_EQUIPE = MODELES_EQUIPE_BRUT.map((m, i) => enrichirModele(m, 'equipe', i));
const MODELES_JOUEUR = MODELES_JOUEUR_BRUT.map((m, i) => enrichirModele(m, 'joueur', i));

// Renvoie les modeles disponibles pour un type ('equipe' | 'joueur'), tries par ROI decroissant.
export function getModeles(type) {
  const source = type === 'equipe' ? MODELES_EQUIPE : MODELES_JOUEUR;
  return [...source].sort((a, b) => b.roi - a.roi);
}

export function getModeleParId(id) {
  return [...MODELES_EQUIPE, ...MODELES_JOUEUR].find(m => m.id === id) || null;
}

// Simule le filtrage des matchs "eligibles" a un modele (les vrais criteres n'existent pas encore) :
// selectionne de facon deterministe 1 a 3 matchs parmi ceux du jour, le premier etant le "meilleur".
export function filtrerMatchsPourModele(modele, matchs) {
  if (!matchs || matchs.length === 0) return [];
  const scores = matchs
    .map(match => ({ match, score: hashDeterministe(`${modele.id}-${match.id}`) }))
    .sort((a, b) => b.score - a.score);
  const nbQualifies = Math.min(matchs.length, Math.max(1, Math.min(3, Math.ceil(matchs.length * 0.35))));
  return scores.slice(0, nbQualifies).map(s => s.match);
}

// Simule la recommandation finale du modele pour un match donne : equipe/cote de confiance mockees.
// Pour les modeles "joueur", le joueur recommande est resolu separement (a partir d'un roster reel).
export function genererRecommandation(modele, match) {
  const graine = hashDeterministe(`${modele.id}-${match.id}-pick`);
  const confiance = 55 + (graine % 31); // 55-85%, cf. specification
  if (modele.type === 'equipe') {
    const equipes = [match.awayTeam, match.homeTeam].filter(Boolean);
    const pick = equipes[graine % equipes.length] || equipes[0];
    return {
      confiance,
      abbrev: pick?.abbrev,
      nom: pick?.commonName?.default || pick?.abbrev,
      domicile: pick?.abbrev === match.homeTeam?.abbrev,
    };
  }
  return {
    confiance,
    // graine utilisee par l'appelant pour choisir un joueur de facon deterministe dans le roster reel.
    graine,
    equipeCibleAbbrev: (graine % 2 === 0 ? match.awayTeam : match.homeTeam)?.abbrev,
  };
}

// ROI mocke specifique a un matchup donne (pour l'instant simule autour du ROI global du modele, en
// attendant un vrai calcul par match). Deterministe : meme match + meme modele -> meme ROI affiche.
export function genererROISpecifique(modele, match) {
  const graine = hashDeterministe(`${modele.id}-${match.id}-roi`);
  const amplitude = Math.abs(modele.roi) * 0.6 + 5;
  const delta = ((graine % 201) - 100) / 100 * amplitude;
  return parseFloat((modele.roi + delta).toFixed(1));
}
