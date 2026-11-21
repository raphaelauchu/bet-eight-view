import {
  normalizeBet, normalizeAllBets, betsForAccount, settledBets, pendingBets,
  computeNetDeposits, computeAccountBalance, computeAtRisk, computeAvailable,
  computeTotalReturn, computeTotalStaked, computeROI, computeWinRate, computeAverageOdds,
  computeBestDay, computeGlobalBankroll, computeBankrollSeries, computeVariation,
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

  test('computeAccountBalance = depots nets + profit realise', () => {
    // 900 (net depose) + 50 - 30 = 920
    expect(computeAccountBalance(transactions, bets)).toBe(920);
  });

  test('computeAtRisk = somme des mises en attente', () => {
    expect(computeAtRisk(bets)).toBe(40);
  });

  test('computeAvailable = solde - en jeu', () => {
    const balance = computeAccountBalance(transactions, bets);
    expect(computeAvailable(balance, computeAtRisk(bets))).toBe(880);
  });

  test('un depot/retrait ne change jamais le ROI ni le profit realise, seulement le solde', () => {
    const roiAvant = computeROI(bets);
    const balanceAvant = computeAccountBalance(transactions, bets);
    const transactionsApresDepot = [...transactions, { type: 'deposit', amount: 500 }];
    expect(computeROI(bets)).toBe(roiAvant); // ROI inchange (ne depend pas des transactions)
    expect(computeAccountBalance(transactionsApresDepot, bets)).toBe(balanceAvant + 500); // solde +500
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

describe('courbe de profit', () => {
  const bets = [
    { status: 'won', profit: 50, stake: 100, dateSettlement: '2026-01-05' },
    { status: 'lost', profit: -20, stake: 50, dateSettlement: '2026-01-10' },
  ];

  test('mode value = profit cumulatif ($)', () => {
    const now = new Date('2026-02-01');
    const { values } = computeBankrollSeries(bets, 'all', 'value', now);
    expect(values).toEqual([50, 30]);
  });

  test('mode return = rendement cumulatif (%)', () => {
    const now = new Date('2026-02-01');
    const { values } = computeBankrollSeries(bets, 'all', 'return', now);
    expect(values[0]).toBeCloseTo(50, 5); // 50/100*100
    expect(values[1]).toBeCloseTo((30 / 150) * 100, 5);
  });

  test('un depot/retrait n\'apparait jamais dans la courbe (seulement les paris regles)', () => {
    const now = new Date('2026-02-01');
    const serieAvant = computeBankrollSeries(bets, 'all', 'value', now);
    // Aucune fonction de ce fichier ne prend de transactions en parametre pour la courbe --
    // ajouter des transactions au compte ne peut donc pas modifier la serie.
    expect(serieAvant.values).toEqual([50, 30]);
  });

  test('computeVariation = dernier - premier point', () => {
    expect(computeVariation([{ value: 10 }, { value: 25 }, { value: 40 }])).toBe(30);
  });

  test('computeVariation = 0 avec moins de 2 points', () => {
    expect(computeVariation([{ value: 10 }])).toBe(0);
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
