import {
  normalizeBet, normalizeAllBets, betsForAccount, settledBets, pendingBets, decidedBets, refDateForBet,
  computeNetDeposits, computeAccountBalance, computeAtRisk, computeAvailable,
  computeTotalReturn, computeTotalStaked, computeTotalStakedAll, computeSettledReturns,
  computeROI, computeWinRate, computeAverageOdds, canPlaceBet,
  computeBestDay, computeGlobalBankroll, computeBalanceHistory, computeBankrollSeries, computeVariation,
  computePeriodStats, computeUnrealizedProfit, signColor,
  formatCompactAmount, buildMonthCalendar, betsForDay, bookmakerDepuisKind,
} from './bankrollCalc';

describe('normalizeBet', () => {
  test('paris actif -> pending, pas de profit', () => {
    const b = normalizeBet({ id: 1, statut: 'actif', mise: 50, cote: 2, date_pari: '2026-11-01', account_id: 'a1' }, 'paris');
    expect(b).toMatchObject({ status: 'pending', stake: 50, odds: 2, profit: null, accountId: 'a1' });
  });

  test('paris gagne -> won avec profit', () => {
    const b = normalizeBet({ id: 1, statut: 'gagne', mise: 50, cote: 2, profit: 50, date_pari: '2026-11-01' }, 'paris');
    expect(b.status).toBe('won');
    expect(b.profit).toBe(50);
  });

  test('bets_auto pending utilise game_date/created_at pour datePlaced', () => {
    const b = normalizeBet({ id: 1, statut: 'pending', mise: 20, cote: 1.8, game_date: '2026-11-05', created_at: '2026-11-04' }, 'bets_auto');
    expect(b.status).toBe('pending');
    expect(b.datePlaced).toBe('2026-11-05');
    expect(b.profit).toBeNull();
  });

  test('bets_auto perdu utilise verified_at pour dateSettlement et resultat pour profit', () => {
    const b = normalizeBet({ id: 1, statut: 'perdu', mise: 20, cote: 1.8, resultat: -20, verified_at: '2026-11-06' }, 'bets_auto');
    expect(b.status).toBe('lost');
    expect(b.dateSettlement).toBe('2026-11-06');
    expect(b.profit).toBe(-20);
  });

  test('bets_auto : title inclut la ligne statistique (meme libelle que l\'accueil, pas juste le nom du joueur)', () => {
    const b = normalizeBet({ id: 1, statut: 'pending', mise: 20, cote: 1.8, joueur_nom: 'Alexandre Texier', stat_type: 'Goals', ligne: 1 }, 'bets_auto');
    expect(b.title).toBe('Alexandre Texier — Goals 1');
    expect(b.selection).toBe('Alexandre Texier'); // conserve pour compatibilite, mais pas pour l'affichage
  });

  test('bets_auto : title retombe sur equipe vs adversaire sans joueur', () => {
    const b = normalizeBet({ id: 1, statut: 'pending', mise: 20, cote: 1.8, equipe: 'MTL', adversaire: 'TOR' }, 'bets_auto');
    expect(b.title).toBe('MTL vs TOR');
  });

  test('paris (manuel) : title = le texte libre du match', () => {
    const b = normalizeBet({ id: 1, statut: 'actif', mise: 20, cote: 1.8, match: 'MTL Canadiens vs PHI Flyers' }, 'paris');
    expect(b.title).toBe('MTL Canadiens vs PHI Flyers');
  });

  test('bookmaker est conserve (paris et bets_auto)', () => {
    expect(normalizeBet({ id: 1, statut: 'actif', mise: 10, cote: 2, bookmaker: 'Betway' }, 'paris').bookmaker).toBe('Betway');
    expect(normalizeBet({ id: 1, statut: 'pending', mise: 10, cote: 2, bookmaker: 'Bet365' }, 'bets_auto').bookmaker).toBe('Bet365');
  });
});

describe('solde / en jeu / disponible', () => {
  const transactions = [
    { type: 'deposit', amount: 1000 },
    { type: 'withdrawal', amount: 100 },
  ];
  const bets = [
    { status: 'won', profit: 50, stake: 100 },
    { status: 'lost', profit: -30, stake: 30 },
    { status: 'pending', profit: null, stake: 40 },
  ];

  test('computeNetDeposits', () => {
    expect(computeNetDeposits(transactions)).toBe(900);
  });

  test('computeAccountBalance = depots nets - TOUTES les mises + montant retourne par les paris regles', () => {
    // 900 (net depose) - (100+30+40) (toutes les mises, en cours comprises) + (150+0) (retourne :
    // gagnant 100*cote implicite via stake+profit=150, perdant 0) = 900 - 170 + 150 = 880
    expect(computeAccountBalance(transactions, bets)).toBe(880);
  });

  test('computeAtRisk = somme des mises en attente (purement informatif, deja retire du solde)', () => {
    expect(computeAtRisk(bets)).toBe(40);
  });

  test('computeAvailable = le solde directement (ne re-soustrait plus "en jeu")', () => {
    const balance = computeAccountBalance(transactions, bets);
    expect(computeAvailable(balance)).toBe(balance);
  });

  test('un depot/retrait ne change jamais le ROI, seulement le solde', () => {
    const roiAvant = computeROI(bets);
    const balanceAvant = computeAccountBalance(transactions, bets);
    const transactionsApresDepot = [...transactions, { type: 'deposit', amount: 500 }];
    expect(computeROI(bets)).toBe(roiAvant); // ROI inchange (ne depend pas des transactions)
    expect(computeAccountBalance(transactionsApresDepot, bets)).toBe(balanceAvant + 500); // solde +500
  });
});

// Exemple explicite de la nouvelle regle du solde (demande utilisateur) : depot 50$, un seul
// pari de 50$ -- en cours, puis regle gagnant/perdant/push.
describe('nouvelle regle du solde : exemple depot 50$ + mise 50$', () => {
  const transactions = [{ type: 'deposit', amount: 50 }];

  test('pari en cours (50$ a la cote 2.0) -> solde 0$, en jeu 50$', () => {
    const bets = [{ status: 'pending', profit: null, stake: 50, odds: 2 }];
    expect(computeAccountBalance(transactions, bets)).toBe(0);
    expect(computeAtRisk(bets)).toBe(50);
  });

  test('pari gagnant a la cote 2.0 -> solde 100$ (mise+profit = 50+50 revient)', () => {
    const bets = [{ status: 'won', profit: 50, stake: 50, odds: 2 }];
    expect(computeAccountBalance(transactions, bets)).toBe(100);
    expect(computeAtRisk(bets)).toBe(0);
  });

  test('pari perdant -> solde 0$ (rien ne revient)', () => {
    const bets = [{ status: 'lost', profit: -50, stake: 50, odds: 2 }];
    expect(computeAccountBalance(transactions, bets)).toBe(0);
  });

  test('push/annule (profit 0) -> solde 50$ (mise remboursee)', () => {
    const bets = [{ status: 'push', profit: 0, stake: 50, odds: 2 }];
    expect(computeAccountBalance(transactions, bets)).toBe(50);
  });
});

describe('computeTotalStakedAll / computeSettledReturns', () => {
  const bets = [
    { status: 'won', profit: 50, stake: 50 }, // retourne 100
    { status: 'lost', profit: -20, stake: 20 }, // retourne 0
    { status: 'pending', profit: null, stake: 999 }, // compte dans le total mise, pas dans le retourne
  ];

  test('computeTotalStakedAll inclut les paris en cours (contrairement a computeTotalStaked)', () => {
    expect(computeTotalStakedAll(bets)).toBe(50 + 20 + 999);
    expect(computeTotalStaked(bets)).toBe(50 + 20); // regles seulement, inchange
  });

  test('computeSettledReturns = mise+profit des paris regles (montant retourne, pas le profit net)', () => {
    expect(computeSettledReturns(bets)).toBe(100 + 0);
  });
});

describe('canPlaceBet', () => {
  const transactions = [{ type: 'deposit', amount: 50 }];

  test('mise egale au disponible -> autorise', () => {
    expect(canPlaceBet(transactions, [], 50)).toBe(true);
  });

  test('mise superieure au disponible -> refuse', () => {
    expect(canPlaceBet(transactions, [], 50.01)).toBe(false);
  });

  test('tient compte des paris deja places (le nouveau pari n\'est PAS dans `existingBets`)', () => {
    const existingBets = [{ status: 'pending', profit: null, stake: 50 }]; // deja tout engage
    expect(canPlaceBet(transactions, existingBets, 1)).toBe(false);
  });
});

describe('ROI / stats', () => {
  const bets = [
    { status: 'won', profit: 100, stake: 100, odds: 2 },
    { status: 'lost', profit: -50, stake: 50, odds: 1.5 },
    { status: 'pending', profit: null, stake: 999, odds: 3 },
  ];

  test('computeTotalReturn ignore les paris en attente', () => {
    expect(computeTotalReturn(bets)).toBe(50);
  });

  test('computeTotalStaked ignore les paris en attente', () => {
    expect(computeTotalStaked(bets)).toBe(150);
  });

  test('computeROI = profit / mise totale (paris regles seulement)', () => {
    expect(computeROI(bets)).toBeCloseTo((50 / 150) * 100, 5);
  });

  test('computeROI = 0 si aucun pari regle', () => {
    expect(computeROI([{ status: 'pending', profit: null, stake: 10 }])).toBe(0);
  });

  test('computeWinRate', () => {
    expect(computeWinRate(bets)).toBe(50); // 1 gagne sur 2 regles
  });

  test('computeAverageOdds (paris regles seulement)', () => {
    expect(computeAverageOdds(bets)).toBeCloseTo(1.75, 5);
  });

  test('computeBestDay retourne le jour au profit le plus eleve', () => {
    const b = [
      { status: 'won', profit: 10, dateSettlement: '2026-11-01' },
      { status: 'won', profit: 90, dateSettlement: '2026-11-02' },
      { status: 'lost', profit: -5, dateSettlement: '2026-11-02' },
    ];
    expect(computeBestDay(b)).toEqual({ day: '2026-11-02', profit: 85 });
  });

  test('computeBestDay retourne null sans aucun pari regle', () => {
    expect(computeBestDay([{ status: 'pending', profit: null }])).toBeNull();
  });
});

describe('bankroll globale', () => {
  test('somme des soldes des comptes non archives seulement', () => {
    const accounts = [
      { archivedAt: null, transactions: [{ type: 'deposit', amount: 100 }], bets: [] },
      { archivedAt: null, transactions: [{ type: 'deposit', amount: 50 }], bets: [{ status: 'won', profit: 10, stake: 10 }] },
      { archivedAt: '2026-11-01', transactions: [{ type: 'deposit', amount: 99999 }], bets: [] }, // archive : exclu
    ];
    expect(computeGlobalBankroll(accounts)).toBe(160);
  });
});

describe('computeBalanceHistory / courbe de profit', () => {
  const bets = [
    { status: 'won', profit: 50, stake: 100, datePlaced: '2026-01-04', dateSettlement: '2026-01-05' },
    { status: 'lost', profit: -20, stake: 50, datePlaced: '2026-01-09', dateSettlement: '2026-01-10' },
  ];

  test('computeBalanceHistory : depot/retrait a leur date + mise retiree au placement + retour au reglement, solde ABSOLU', () => {
    const transactions = [{ type: 'deposit', amount: 200, occurred_on: '2026-01-01' }];
    const history = computeBalanceHistory(transactions, bets);
    // 200 (depot), -100 (mise bet1), +150 (retour bet1 : 100+50), -50 (mise bet2), +30 (retour bet2 : 50-20)
    expect(history.map(p => p.value)).toEqual([200, 100, 250, 200, 230]);
    // Le dernier point egale EXACTEMENT le solde du compte (meme formule que computeAccountBalance).
    expect(history[history.length - 1].value).toBe(computeAccountBalance(transactions, bets));
  });

  test('computeBalanceHistory : un retrait est bien une baisse', () => {
    const transactions = [
      { type: 'deposit', amount: 100, occurred_on: '2026-01-01' },
      { type: 'withdrawal', amount: 40, occurred_on: '2026-01-02' },
    ];
    const history = computeBalanceHistory(transactions, []);
    expect(history.map(p => p.value)).toEqual([100, 60]);
  });

  // mode='value' : coherent avec computeAccountBalance -- depot/retrait a leur date, mise
  // retiree au placement, retour ajoute au reglement -- voir computeBalanceHistory ci-dessus.
  // Le dernier point de la periode 'all' egale TOUJOURS exactement le solde reel du compte.
  test('mode value = solde absolu reconstruit (depots/retraits + paris), dernier point = solde reel', () => {
    const now = new Date('2026-02-01');
    const transactions = [{ type: 'deposit', amount: 200, occurred_on: '2026-01-01' }];
    const { values, finalValue } = computeBankrollSeries(transactions, bets, 'all', 'value', now);
    expect(values).toEqual([200, 100, 250, 200, 230]);
    expect(finalValue).toBe(computeAccountBalance(transactions, bets));
  });

  test('mode value : un pari encore en cours ne montre qu\'une baisse (sa mise), jamais un profit anticipe', () => {
    const now = new Date('2026-02-01');
    const enCours = [{ status: 'pending', profit: null, stake: 40, datePlaced: '2026-01-15' }];
    const { values } = computeBankrollSeries([], enCours, 'all', 'value', now);
    expect(values).toEqual([-40]);
  });

  // mode='return' : profit CUMULE en $ (pas un pourcentage) des paris regles uniquement, jamais
  // affecte par un depot/retrait ni par une mise en cours -- le dernier point sur 'all' egale
  // exactement computeTotalReturn(bets) (meme paris, meme somme).
  test('mode return = profit cumule en $ des paris regles, dernier point sur "all" = Total return', () => {
    const now = new Date('2026-02-01');
    const transactions = [{ type: 'deposit', amount: 500, occurred_on: '2026-01-01' }];
    const { values, finalValue } = computeBankrollSeries(transactions, bets, 'all', 'return', now);
    expect(values).toEqual([50, 30]); // cumul : 50, puis 50-20=30
    expect(finalValue).toBe(computeTotalReturn(bets));
  });

  test('computeVariation = dernier - premier point', () => {
    expect(computeVariation([{ value: 10 }, { value: 25 }, { value: 40 }])).toBe(30);
  });

  test('computeVariation = 0 avec moins de 2 points', () => {
    expect(computeVariation([{ value: 10 }])).toBe(0);
  });
});

describe('computePeriodStats', () => {
  // Donnees de test de la refonte bankroll/performance (2026-11-26) : depot 50$ sur BET99, puis
  // 4 paris -- 30$@2.25 perdu, 39$@2.9 perdu, 30$@2.3 gagne, 20$ perdu. Tous places ET regles
  // "maintenant" (meme instant), donc meme resultat quelle que soit la periode testee ('all').
  // Attendu : mises 119$, retours 69$ (30*2.3 du seul gagnant), profit -50$, ROI -42.0%, taux de
  // reussite 25% (1-3).
  const maintenant = new Date('2026-11-26T12:00:00Z');
  const bets = [
    { status: 'lost', stake: 30, odds: 2.25, profit: -30, datePlaced: maintenant.toISOString(), dateSettlement: maintenant.toISOString() },
    { status: 'lost', stake: 39, odds: 2.9, profit: -39, datePlaced: maintenant.toISOString(), dateSettlement: maintenant.toISOString() },
    { status: 'won', stake: 30, odds: 2.3, profit: 39, datePlaced: maintenant.toISOString(), dateSettlement: maintenant.toISOString() },
    { status: 'lost', stake: 20, odds: 2, profit: -20, datePlaced: maintenant.toISOString(), dateSettlement: maintenant.toISOString() },
  ];

  test('profit/mises/retours/ROI/taux de reussite exacts sur le jeu de donnees de reference', () => {
    const stats = computePeriodStats(bets, 'all', maintenant);
    expect(stats.staked).toBe(119);
    expect(stats.returns).toBe(69);
    expect(stats.profit).toBe(-50);
    expect(stats.roi).toBeCloseTo(-42.016806722689076, 5);
    expect(stats.roi.toFixed(1)).toBe('-42.0');
    expect(stats.winRate).toBe(25);
    expect(stats.wonCount).toBe(1);
    expect(stats.lostCount).toBe(3);
    expect(stats.activeCount).toBe(0);
  });

  test('ROI = profit / mises, jamais retours / mises', () => {
    const stats = computePeriodStats(bets, 'all', maintenant);
    // retours/mises donnerait +58.0% (le bug corrige) -- le vrai ROI est negatif.
    expect(69 / 119 * 100).toBeCloseTo(57.98, 1); // confirme le chiffre du bug, pour memoire
    expect(stats.roi).toBeLessThan(0);
  });

  test('base de date : un pari decide est filtre par sa date de REGLEMENT, pas de placement', () => {
    const placeHorsPeriode = [{ status: 'won', stake: 10, odds: 2, profit: 10, datePlaced: '2020-01-01', dateSettlement: maintenant.toISOString() }];
    const stats = computePeriodStats(placeHorsPeriode, '1d', maintenant);
    expect(stats.decidedCount).toBe(1); // compte bien : regle "aujourd'hui", peu importe quand il a ete place
  });

  test('un pari en cours est filtre par sa date de PLACEMENT (il n\'a pas de date de reglement)', () => {
    const enCours = [{ status: 'pending', stake: 10, odds: 2, profit: null, datePlaced: maintenant.toISOString() }];
    const stats = computePeriodStats(enCours, 'all', maintenant);
    expect(stats.activeCount).toBe(1);
  });

  test('un pari annule n\'est ni gagne ni perdu, exclu du ROI/taux de reussite', () => {
    const avecAnnule = [...bets, { status: 'cancelled', stake: 100, odds: 2, profit: 0, datePlaced: maintenant.toISOString(), dateSettlement: maintenant.toISOString() }];
    const stats = computePeriodStats(avecAnnule, 'all', maintenant);
    expect(stats.decidedCount).toBe(4); // toujours 4, pas 5
    expect(stats.staked).toBe(119); // la mise annulee (100$) n'entre pas dans le ROI
  });

  test('aucun pari decide -> roi/winRate a 0, pas une division par zero', () => {
    const stats = computePeriodStats([], 'all', maintenant);
    expect(stats.roi).toBe(0);
    expect(stats.winRate).toBe(0);
  });
});

describe('computeUnrealizedProfit', () => {
  test('mise x cote - mise, uniquement pour les paris en cours', () => {
    const bets = [
      { status: 'pending', stake: 50, odds: 3 }, // 150-50=100
      { status: 'won', stake: 50, odds: 3, profit: 100 }, // deja regle : ignore
    ];
    expect(computeUnrealizedProfit(bets)).toBe(100);
  });

  test('aucun pari en cours -> 0', () => {
    expect(computeUnrealizedProfit([{ status: 'won', stake: 10, odds: 2, profit: 10 }])).toBe(0);
  });
});

describe('signColor', () => {
  test('positif -> vert, negatif -> rouge, zero -> neutre (defaut blanc)', () => {
    expect(signColor(50)).toBe('#22c55e');
    expect(signColor(-42)).toBe('#ef4444');
    expect(signColor(0)).toBe('var(--c-white)');
  });

  test('neutre personnalise', () => {
    expect(signColor(0, 'var(--c-666)')).toBe('var(--c-666)');
  });

  test('NaN/null/undefined -> neutre (jamais vert ni rouge sur une valeur absente)', () => {
    expect(signColor(NaN)).toBe('var(--c-white)');
    expect(signColor(null)).toBe('var(--c-white)');
    expect(signColor(undefined)).toBe('var(--c-white)');
  });
});

describe('formatCompactAmount', () => {
  test('sous 1000 : $ entier', () => { expect(formatCompactAmount(876)).toBe('$876'); });
  test('1000-9999 : k avec une decimale', () => { expect(formatCompactAmount(1800)).toBe('1.8k'); });
  test('10000+ : k sans decimale', () => { expect(formatCompactAmount(23000)).toBe('23k'); });
  test('negatif : signe moins, pas de +', () => { expect(formatCompactAmount(-1800)).toBe('-1.8k'); });
});

describe('calendrier mensuel', () => {
  const bets = [
    { status: 'won', profit: 100, dateSettlement: '2026-11-05', datePlaced: '2026-11-05' },
    { status: 'lost', profit: -40, dateSettlement: '2026-11-05', datePlaced: '2026-11-05' }, // meme jour, s'additionne
    { status: 'won', profit: 25, dateSettlement: '2026-11-12', datePlaced: '2026-11-12' },
    { status: 'pending', profit: null, dateSettlement: null, datePlaced: '2026-11-20' },
  ];

  test('grille de 7 colonnes par semaine, mois complet couvert', () => {
    const { weeks } = buildMonthCalendar(bets, 2026, 10); // novembre = index 10
    weeks.forEach(w => expect(w.length).toBe(7));
    const totalCells = weeks.flat().filter(Boolean).length;
    expect(totalCells).toBe(30); // novembre 2026 a 30 jours
  });

  test('profit agrege par jour (plusieurs paris regles le meme jour)', () => {
    const { weeks } = buildMonthCalendar(bets, 2026, 10);
    const jour5 = weeks.flat().find(c => c && c.dayNum === 5);
    expect(jour5.profit).toBe(60);
    expect(jour5.hasSettled).toBe(true);
    expect(jour5.hasPending).toBe(false);
  });

  test('jour avec paris en attente seulement : hasPending=true, hasSettled=false', () => {
    const { weeks } = buildMonthCalendar(bets, 2026, 10);
    const jour20 = weeks.flat().find(c => c && c.dayNum === 20);
    expect(jour20.hasPending).toBe(true);
    expect(jour20.hasSettled).toBe(false);
    expect(jour20.profit).toBe(0);
  });

  test('jour sans aucun pari : present dans la grille, neutre', () => {
    const { weeks } = buildMonthCalendar(bets, 2026, 10);
    const jour1 = weeks.flat().find(c => c && c.dayNum === 1);
    expect(jour1.hasPending).toBe(false);
    expect(jour1.hasSettled).toBe(false);
  });

  test('profit du mois = somme des profits realises du mois uniquement', () => {
    const { monthProfit } = buildMonthCalendar(bets, 2026, 10);
    expect(monthProfit).toBe(85); // 60 + 25, le pending ne compte pas
  });

  test('betsForDay retourne les paris (regles ou en attente) d\'un jour donne', () => {
    const jour5 = betsForDay(bets, '2026-11-05');
    expect(jour5).toHaveLength(2);
    const jour20 = betsForDay(bets, '2026-11-20');
    expect(jour20).toHaveLength(1);
  });
});

describe('mapping sportsbook <-> kind de compte', () => {
  test('bookmakerDepuisKind retrouve le libelle exact utilise dans les formulaires', () => {
    expect(bookmakerDepuisKind('bet365')).toBe('Bet365');
    expect(bookmakerDepuisKind('sports_interaction')).toBe('Sports Interaction');
    expect(bookmakerDepuisKind('mise_o_jeu')).toBe('Mise-o-jeu+');
  });
  test('kind inconnu -> null', () => {
    expect(bookmakerDepuisKind('other')).toBeNull();
  });
});

describe('normalizeAllBets / betsForAccount / settledBets / pendingBets', () => {
  test('fusionne paris et bets_auto, filtre par compte et par statut', () => {
    const paris = [{ id: 1, statut: 'gagne', mise: 10, cote: 2, profit: 10, date_pari: '2026-11-01', account_id: 'a1' }];
    const betsAuto = [{ id: 2, statut: 'pending', mise: 5, cote: 2, created_at: '2026-11-02', account_id: 'a2' }];
    const all = normalizeAllBets(paris, betsAuto);
    expect(all).toHaveLength(2);
    expect(betsForAccount(all, 'a1')).toHaveLength(1);
    expect(settledBets(all)).toHaveLength(1);
    expect(pendingBets(all)).toHaveLength(1);
  });
});

// ===================== Statut 'annule' (push/void) : mise remboursee, jamais une defaite =====================

describe("normalizeBet : statut 'annule' -> cancelled, profit force a 0", () => {
  test('paris annule', () => {
    const b = normalizeBet({ id: 1, statut: 'annule', mise: 50, cote: 2, date_pari: '2026-11-01' }, 'paris');
    expect(b.status).toBe('cancelled');
    expect(b.profit).toBe(0);
  });
  test('bets_auto annule', () => {
    const b = normalizeBet({ id: 1, statut: 'annule', mise: 20, cote: 1.8, resultat: 0, verified_at: '2026-11-06' }, 'bets_auto');
    expect(b.status).toBe('cancelled');
    expect(b.profit).toBe(0);
  });
});

describe('decidedBets : exclut les paris en cours ET les paris annules', () => {
  const bets = [
    { status: 'pending', stake: 10, profit: null },
    { status: 'won', stake: 50, odds: 2, profit: 50 },
    { status: 'lost', stake: 20, odds: 1.8, profit: -20 },
    { status: 'cancelled', stake: 30, odds: 1.5, profit: 0 },
  ];

  test('decidedBets ne garde que won/lost', () => {
    expect(decidedBets(bets)).toHaveLength(2);
  });

  test("computeTotalStaked/computeTotalReturn ignorent le pari annule (pas de denominateur gonfle)", () => {
    expect(computeTotalStaked(bets)).toBe(70); // 50 + 20, PAS +30 (annule)
    expect(computeTotalReturn(bets)).toBe(30); // 50 - 20
  });

  test('computeROI : le pari annule ne dilue jamais le ROI', () => {
    expect(computeROI(bets)).toBeCloseTo((30 / 70) * 100, 5);
  });

  test('computeWinRate : le pari annule ne compte jamais comme une defaite', () => {
    expect(computeWinRate(bets)).toBe(50); // 1 gagne sur 2 DECIDES (pas sur 3 regles)
  });

  test('computeAverageOdds : cote moyenne des paris decides uniquement', () => {
    expect(computeAverageOdds(bets)).toBeCloseTo((2 + 1.8) / 2, 5);
  });
});

describe("Solde : un pari annule rembourse integralement la mise (exemple chiffre de l'enonce)", () => {
  test('depot 50$ + mise 50$ -> en cours 0$, annule 50$ (comme push/perdant remboursee)', () => {
    const transactions = [{ type: 'deposit', amount: 50 }];
    const betEnCours = [{ status: 'pending', stake: 50, profit: null }];
    expect(computeAccountBalance(transactions, betEnCours)).toBe(0);

    const betAnnule = [{ status: 'cancelled', stake: 50, profit: 0 }];
    expect(computeAccountBalance(transactions, betAnnule)).toBe(50);
  });
});

describe('refDateForBet', () => {
  test('en cours -> date de mise ; decide -> date de reglement', () => {
    expect(refDateForBet({ status: 'pending', datePlaced: '2026-11-01', dateSettlement: '2026-11-03' })).toBe('2026-11-01');
    expect(refDateForBet({ status: 'won', datePlaced: '2026-11-01', dateSettlement: '2026-11-03' })).toBe('2026-11-03');
    expect(refDateForBet({ status: 'cancelled', datePlaced: '2026-11-01', dateSettlement: '2026-11-03' })).toBe('2026-11-03');
  });
});

// ===================== Scenario de bout en bout : jeu de donnees de reference =====================
// Depot 50$ sur BET99, puis 4 paris (places et regles le meme jour) : 30$@2.25 perdu,
// 39$@2.9 perdu, 30$@2.3 gagne, 20$@2.0 perdu. Reproduit a partir de lignes brutes bets_auto (pas
// d'objets deja normalises) pour exercer tout le pipeline normalizeAllBets -> betsForAccount ->
// le reste de ce fichier, comme le ferait un vrai compte. Attendu (enonce de la refonte
// bankroll/performance, 2026-11-26) : solde 0$, mises 119$, retours 69$, profit -50$, ROI -42.0%,
// taux de reussite 25% (1-3), net deposits 50$.
describe('scenario de reference bout en bout (depot 50$ BET99 + 4 paris)', () => {
  const JOUR = '2026-11-25';
  const transactions = [{ account_id: 'acc1', type: 'deposit', amount: 50, occurred_on: JOUR }];
  const betsAutoBrut = [
    { id: 'a1', account_id: 'acc1', statut: 'perdu', mise: 30, cote: 2.25, resultat: -30, verified_at: JOUR, game_date: JOUR },
    { id: 'a2', account_id: 'acc1', statut: 'perdu', mise: 39, cote: 2.9, resultat: -39, verified_at: JOUR, game_date: JOUR },
    { id: 'a3', account_id: 'acc1', statut: 'gagne', mise: 30, cote: 2.3, resultat: 39, verified_at: JOUR, game_date: JOUR },
    { id: 'a4', account_id: 'acc1', statut: 'perdu', mise: 20, cote: 2.0, resultat: -20, verified_at: JOUR, game_date: JOUR },
  ];
  const now = new Date('2026-11-26T12:00:00Z');
  const tousLesBets = normalizeAllBets([], betsAutoBrut);
  const bets = betsForAccount(tousLesBets, 'acc1');

  test('solde = 0$ (depots nets 50 - mises 119 + retours 69)', () => {
    expect(computeAccountBalance(transactions, bets)).toBe(0);
  });

  test('mises (paris decides) = 119$', () => {
    expect(computeTotalStaked(bets)).toBe(119);
    expect(computeTotalStakedAll(bets)).toBe(119); // aucun pari en cours ici
  });

  test('retours (montant rendu par les paris regles) = 69$', () => {
    expect(computeSettledReturns(bets)).toBe(69);
  });

  test('profit = -50$', () => {
    expect(computeTotalReturn(bets)).toBe(-50);
  });

  test('ROI = -42.0% (profit/mises, jamais retours/mises qui donnerait +58.0%)', () => {
    expect(computeROI(bets)).toBeCloseTo(-42.016806722689076, 5);
    expect(computeROI(bets).toFixed(1)).toBe('-42.0');
  });

  test('taux de reussite = 25% (1 gagne sur 4 regles)', () => {
    expect(computeWinRate(bets)).toBe(25);
  });

  test('net deposits = 50$', () => {
    expect(computeNetDeposits(transactions)).toBe(50);
  });

  test('dernier point du graphique mode Valeur = solde reel (0$)', () => {
    const { finalValue } = computeBankrollSeries(transactions, bets, 'all', 'value', now);
    expect(finalValue).toBe(0);
    expect(finalValue).toBe(computeAccountBalance(transactions, bets));
  });

  test('dernier point du graphique mode Rendement (sur "all") = Total return (-50$)', () => {
    const { finalValue } = computeBankrollSeries(transactions, bets, 'all', 'return', now);
    expect(finalValue).toBe(-50);
    expect(finalValue).toBe(computeTotalReturn(bets));
  });

  test('couleurs : ROI negatif -> rouge, solde a 0 -> neutre (jamais vert ni rouge sur un solde nul)', () => {
    expect(signColor(computeROI(bets))).toBe('#ef4444');
    expect(signColor(computeAccountBalance(transactions, bets))).toBe('var(--c-white)');
  });

  test('computePeriodStats("all") expose exactement les memes chiffres que les fonctions individuelles', () => {
    const stats = computePeriodStats(bets, 'all', now);
    expect(stats).toMatchObject({ staked: 119, returns: 69, profit: -50, winRate: 25, wonCount: 1, lostCount: 3, activeCount: 0 });
    expect(stats.roi.toFixed(1)).toBe('-42.0');
  });
});
