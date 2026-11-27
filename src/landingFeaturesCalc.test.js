import {
  filterPlayerGames, computeHitStats, impliedProbability, bookMargin,
  bestBookForSide, fairProbability, computeEV,
} from './landingFeaturesCalc';

// ===================== Carte "Fiches joueur" =====================

const GAMES = [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ value: n % 5, date: `j${n}`, home: i % 2 === 0 }));
// valeurs : [1,2,3,4,0,1,2,3] (n%5), home alternant true/false a partir de l'indice 0.

test('filterPlayerGames : last5/last10/home/away/aucun filtre', () => {
  expect(filterPlayerGames(GAMES, 'last5').length).toBe(5);
  expect(filterPlayerGames(GAMES, 'last5')).toEqual(GAMES.slice(-5));
  expect(filterPlayerGames(GAMES, 'last10')).toEqual(GAMES); // moins de 10 matchs -> liste complete
  expect(filterPlayerGames(GAMES, 'home').every(g => g.home)).toBe(true);
  expect(filterPlayerGames(GAMES, 'away').every(g => !g.home)).toBe(true);
  expect(filterPlayerGames(GAMES, 'home').length + filterPlayerGames(GAMES, 'away').length).toBe(GAMES.length);
  expect(filterPlayerGames(GAMES, 'aucun-filtre-connu')).toEqual(GAMES);
  expect(filterPlayerGames(null, 'last5')).toEqual([]);
});

test('computeHitStats : compte les matchs >= ligne, moyenne correcte, egalite a la ligne = succes', () => {
  const games = [{ value: 1 }, { value: 2 }, { value: 2 }, { value: 3 }];
  const stats = computeHitStats(games, 2);
  expect(stats.hits).toBe(3); // 2,2,3 >= 2
  expect(stats.total).toBe(4);
  expect(stats.rate).toBe(75);
  expect(stats.average).toBe(2); // (1+2+2+3)/4
});

test('computeHitStats : liste vide -> zeros, jamais de division par 0', () => {
  expect(computeHitStats([], 2.5)).toEqual({ hits: 0, total: 0, rate: 0, average: 0 });
  expect(computeHitStats(null, 2.5)).toEqual({ hits: 0, total: 0, rate: 0, average: 0 });
});

test('computeHitStats : jeu de donnees reel de la carte (18 matchs, ligne 2.5) -> 83% (15/18)', () => {
  const values = [3, 4, 2, 5, 3, 4, 1, 3, 5, 4, 3, 6, 4, 3, 5, 2, 4, 3];
  const stats = computeHitStats(values.map(value => ({ value })), 2.5);
  expect(stats.total).toBe(18);
  expect(stats.hits).toBe(15);
  expect(stats.rate).toBe(83);
});

// ===================== Carte "Comparateur de cotes" =====================

test('impliedProbability : 1/cote, 0 si cote invalide', () => {
  expect(impliedProbability(2)).toBe(0.5);
  expect(impliedProbability(4)).toBe(0.25);
  expect(impliedProbability(0)).toBe(0);
  expect(impliedProbability(-1)).toBe(0);
});

test('bookMargin : marge nulle sans vig, positive avec vig', () => {
  expect(bookMargin(2, 2)).toBeCloseTo(0, 10);
  expect(bookMargin(1.91, 1.91)).toBeCloseTo(1 / 1.91 + 1 / 1.91 - 1, 10);
  expect(bookMargin(1.91, 1.91)).toBeGreaterThan(0);
});

const BOOKS_3 = [
  { name: 'Book A', over: 2, under: 2 },
  { name: 'Book B', over: 1.8, under: 2.3 },
  { name: 'Book C', over: 2.1, under: 1.9 },
];

test('bestBookForSide : la cote la plus elevee pour le cote demande, null si aucun livre', () => {
  expect(bestBookForSide(BOOKS_3, 'over').name).toBe('Book C');
  expect(bestBookForSide(BOOKS_3, 'under').name).toBe('Book B');
  expect(bestBookForSide([], 'over')).toBeNull();
  expect(bestBookForSide(null, 'over')).toBeNull();
});

test('fairProbability : null en dessous de 3 livres (jamais d\'EV sur un echantillon trop mince)', () => {
  expect(fairProbability(BOOKS_3.slice(0, 2), 'over')).toBeNull();
  expect(fairProbability(BOOKS_3.slice(0, 2), 'over', 3)).toBeNull();
  expect(fairProbability([], 'over')).toBeNull();
});

test('fairProbability : avec 3 livres a cotes symetriques (2.00/2.00), probabilite equitable = 50%', () => {
  const books = [
    { name: 'A', over: 2, under: 2 },
    { name: 'B', over: 2, under: 2 },
    { name: 'C', over: 2, under: 2 },
  ];
  expect(fairProbability(books, 'over')).toBeCloseTo(0.5, 10);
  expect(fairProbability(books, 'under')).toBeCloseTo(0.5, 10);
});

test('fairProbability : over + under d\'un meme jeu de livres sont complementaires (somme = 1)', () => {
  expect(fairProbability(BOOKS_3, 'over') + fairProbability(BOOKS_3, 'under')).toBeCloseTo(1, 10);
});

test('computeEV : probabilite equitable x meilleure cote - 1, null en dessous du seuil de livres', () => {
  const books = [
    { name: 'A', over: 2, under: 2 },
    { name: 'B', over: 2, under: 2 },
    { name: 'C', over: 2.1, under: 2 }, // meilleure cote "over" du groupe
  ];
  // probabilite equitable "over" : A et B -> 0.5, C -> (1/2.1)/((1/2.1)+(1/2)) = 20/41 ~ 0.487805
  const fair = (0.5 + 0.5 + (1 / 2.1) / (1 / 2.1 + 1 / 2)) / 3;
  expect(computeEV(books, 'over')).toBeCloseTo(fair * 2.1 - 1, 10);
  expect(computeEV(books.slice(0, 2), 'over')).toBeNull();
  expect(computeEV([], 'over')).toBeNull();
});

test('computeEV : jeu de donnees reel de la carte (5 livres) -> EV positif cote "Plus", negatif cote "Moins"', () => {
  const books = [
    { name: 'Book A', over: 1.8, under: 2.05 },
    { name: 'Book B', over: 1.75, under: 2.1 },
    { name: 'Book C', over: 1.95, under: 1.95 },
    { name: 'Book D', over: 1.85, under: 2.0 },
    { name: 'Book E', over: 1.78, under: 2.08 },
  ];
  const evOver = computeEV(books, 'over');
  const evUnder = computeEV(books, 'under');
  expect(evOver).toBeGreaterThan(0);
  expect(evOver).toBeCloseTo(0.0281, 3);
  expect(evUnder).toBeLessThan(0);
});
