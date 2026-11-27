// ===================== Fonctions pures : section "Fonctions" de l'accueil =====================
// Utilisees par src/LandingPlayerPropCard.js et src/LandingOddsCard.js (voir
// src/LandingFeaturesV2.js pour l'orchestration des 3 blocs -- le bloc Bankroll, lui, reutilise
// directement src/bankrollCalc.js, aucune fonction dediee necessaire ici). Aucun composant/JSX :
// testable independamment de React, voir landingFeaturesCalc.test.js.

// ===================== Carte "Fiches joueur" =====================

// `games` : [{ value, date, opponent, home }], ordre chronologique (le plus ancien en premier).
// `filter` : 'last5' | 'last10' | 'home' | 'away' | tout autre valeur -> liste complete (aucun
// filtre actif, etat par defaut de la carte).
export function filterPlayerGames(games, filter) {
  const list = games || [];
  if (filter === 'home') return list.filter(g => g.home);
  if (filter === 'away') return list.filter(g => !g.home);
  if (filter === 'last5') return list.slice(-5);
  if (filter === 'last10') return list.slice(-10);
  return list;
}

// Taux de reussite ("hit rate") + moyenne d'une liste de matchs DEJA filtree, pour une ligne
// donnee -- une valeur EGALE a la ligne compte comme un succes (convention standard "plus de",
// ex. ligne 2.5 ou exactement 3 -> reussi). Liste vide -> zeros (jamais de division par 0).
export function computeHitStats(games, line) {
  const list = games || [];
  if (list.length === 0) return { hits: 0, total: 0, rate: 0, average: 0 };
  const hits = list.filter(g => g.value >= line).length;
  const average = list.reduce((a, g) => a + g.value, 0) / list.length;
  return { hits, total: list.length, rate: Math.round((hits / list.length) * 100), average };
}

// ===================== Carte "Comparateur de cotes" =====================
// Cotes decimales (europeennes) partout : une cote de 2.00 implique une probabilite de 50%.

export function impliedProbability(decimalOdds) {
  return decimalOdds > 0 ? 1 / decimalOdds : 0;
}

// Marge d'UN livre a partir de ses deux cotes (Plus/Moins) : somme des probabilites implicites
// moins 1 -- la "vig" de ce livre precis, toujours > 0 pour un marche reel, proche de 0 pour un
// marche tres serre (ex. cote 1.95/1.95 -> marge ~2.6%).
export function bookMargin(overOdds, underOdds) {
  return impliedProbability(overOdds) + impliedProbability(underOdds) - 1;
}

// Meilleure cote disponible pour un cote donne (`side`: 'over'|'under') parmi une liste de livres
// [{ name, over, under }]. null si aucun livre ne cote ce cote.
export function bestBookForSide(books, side) {
  const list = (books || []).filter(b => b && b[side] > 0);
  if (list.length === 0) return null;
  return list.reduce((best, b) => (b[side] > best[side] ? b : best));
}

// Probabilite "equitable" (sans marge) d'un cote : moyenne, sur tous les livres qui cotent les
// DEUX cotes, de leur probabilite implicite de ce cote une fois leur propre marge retiree (chaque
// paire Plus/Moins individuellement ramenee a 100%, puis moyenne entre livres). Retourne null en
// dessous de `minBooks` livres valides (3 par defaut) -- jamais de probabilite/EV affichee sur un
// echantillon trop mince.
export function fairProbability(books, side, minBooks = 3) {
  const valides = (books || []).filter(b => b && b.over > 0 && b.under > 0);
  if (valides.length < minBooks) return null;
  const probs = valides.map(b => {
    const pOver = impliedProbability(b.over);
    const pUnder = impliedProbability(b.under);
    const pOverDevig = pOver / (pOver + pUnder);
    return side === 'over' ? pOverDevig : 1 - pOverDevig;
  });
  return probs.reduce((a, p) => a + p, 0) / probs.length;
}

// EV (ex. 0.028 = +2.8%) de la MEILLEURE cote disponible pour `side`, a partir de la probabilite
// equitable ci-dessus : EV = probabilite equitable x meilleure cote - 1. null si fairProbability
// est elle-meme null (moins de `minBooks` livres) ou si aucune cote n'existe pour ce cote.
export function computeEV(books, side, minBooks = 3) {
  const fair = fairProbability(books, side, minBooks);
  const best = bestBookForSide(books, side);
  if (fair === null || !best) return null;
  return fair * best[side] - 1;
}
