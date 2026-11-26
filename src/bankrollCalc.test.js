import {
  normalizeBet, normalizeAllBets, betsForAccount, settledBets, pendingBets, decidedBets, refDateForBet,
  computeNetDeposits, computeAccountBalance, computeAtRisk, computeAvailable,
  computeTotalReturn, computeTotalStaked, computeTotalStakedAll, computeSettledReturns,
  computeROI, computeWinRate, computeAverageOdds, canPlaceBet,
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

describe('courbe de profit', () => {
  const bets = [
    { status: 'won', profit: 50, stake: 100, datePlaced: '2026-01-04', dateSettlement: '2026-01-05' },
    { status: 'lost', profit: -20, stake: 50, datePlaced: '2026-01-09', dateSettlement: '2026-01-10' },
  ];

  // mode='value' : coherent avec computeAccountBalance -- la mise sort au moment du pari
  // (evenement -mise) et revient au reglement (evenement +mise+profit). Sequence chronologique
  // attendue : -100 (mise bet1), +150 (retour bet1 : 100+50), -50 (mise bet2), +30 (retour bet2 :
  // 50-20) -- cumul : -100, 50, 0, 30. La valeur FINALE (30) reste le meme profit net qu'avant
  // (50-20=30), seule la trajectoire intermediaire differe (creuse pendant qu'un pari est en cours).
  test('mode value = la mise sort au placement, revient au reglement (coherent avec le solde)', () => {
    const now = new Date('2026-02-01');
    const { values } = computeBankrollSeries(bets, 'all', 'value', now);
    expect(values).toEqual([-100, 50, 0, 30]);
  });

  test('mode value : un pari encore en cours ne montre qu\'une baisse (sa mise), jamais un profit anticipe', () => {
    const now = new Date('2026-02-01');
    const enCours = [{ status: 'pending', profit: null, stake: 40, datePlaced: '2026-01-15' }];
    const { values } = computeBankrollSeries(enCours, 'all', 'value', now);
    expect(values).toEqual([-40]);
  });

  test('mode return = rendement cumulatif (%), paris regles uniquement, inchange par la mise en cours', () => {
    const now = new Date('2026-02-01');
    const { values } = computeBankrollSeries(bets, 'all', 'return', now);
    expect(values[0]).toBeCloseTo(50, 5); // 50/100*100
    expect(values[1]).toBeCloseTo((30 / 150) * 100, 5);
  });

  test('un depot/retrait n\'apparait jamais dans la courbe (seulement les paris)', () => {
    const now = new Date('2026-02-01');
    const serieAvant = computeBankrollSeries(bets, 'all', 'value', now);
    // Aucune fonction de ce fichier ne prend de transactions en parametre pour la courbe --
    // ajouter des transactions au compte ne peut donc pas modifier la serie.
    expect(serieAvant.values).toEqual([-100, 50, 0, 30]);
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
