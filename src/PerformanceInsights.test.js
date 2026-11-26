import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceInsights } from './PerformanceInsights';
import { writeHideAmounts } from './Home';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
const { supabase } = require('./supabase');

// Bankroll multi-comptes (bankroll_accounts/bankroll_transactions), PAS les anciennes tables
// bankroll/transactions -- voir le commentaire de tete de src/PerformanceInsights.js pour le bug
// que ce choix de tables corrige (924$ sans rapport + Net deposits toujours a 0$).
function mockDonnees({ accounts = [], transactions = [], paris = [], betsAuto = [] } = {}) {
  supabase.from.mockImplementation((table) => {
    if (table === 'bankroll_accounts') return mockQuery({ data: accounts, error: null });
    if (table === 'bankroll_transactions') return mockQuery({ data: transactions, error: null });
    if (table === 'paris') return mockQuery({ data: paris, error: null });
    if (table === 'bets_auto') return mockQuery({ data: betsAuto, error: null });
    return mockQuery({ data: [], error: null });
  });
}

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const MAINTENANT = new Date().toISOString();

const ACCOUNT = { id: 'acc1', user_id: 'u1', name: 'BET99', kind: 'bet99', archived_at: null };
const TRANSACTIONS_EXEMPLE = [
  { id: 'tx1', account_id: 'acc1', type: 'deposit', amount: 50, occurred_on: '2026-11-20' },
];
// Jeu de donnees de reference de la refonte bankroll/performance (2026-11-26) : depot 50$ sur
// BET99, puis 4 paris -- 30$@2.25 perdu, 39$@2.9 perdu, 30$@2.3 gagne, 20$@2.0 perdu. Attendu :
// solde 0$, mises 119$, retours 69$, profit -50$, ROI -42.0%, taux de reussite 25% (1-3), net
// deposits 50$.
const BETS_AUTO_EXEMPLE = [
  { id: 'a1', account_id: 'acc1', statut: 'perdu', mise: 30, cote: 2.25, resultat: -30, verified_at: MAINTENANT, type_bet: 'Moneyline', bookmaker: 'BET99' },
  { id: 'a2', account_id: 'acc1', statut: 'perdu', mise: 39, cote: 2.9, resultat: -39, verified_at: MAINTENANT, type_bet: 'Total', bookmaker: 'BET99' },
  { id: 'a3', account_id: 'acc1', statut: 'gagne', mise: 30, cote: 2.3, resultat: 39, verified_at: MAINTENANT, type_bet: 'Moneyline', bookmaker: 'BET99' },
  { id: 'a4', account_id: 'acc1', statut: 'perdu', mise: 20, cote: 2.0, resultat: -20, verified_at: MAINTENANT, type_bet: 'Prop joueur', bookmaker: 'BET99' },
];

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  writeHideAmounts(false);
});

test('solde (bankroll globale) et depots nets corrects -- plus de 924$ sans rapport, Net deposits = depots - retraits du compte', async () => {
  mockDonnees({ accounts: [ACCOUNT], transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  // Depots nets ne peut valoir 50 qu'une fois les transactions chargees (0 par defaut avant) --
  // attendre directement cette valeur, pas "$0.00" qui est deja vrai avant meme le chargement.
  await waitFor(() => expect(screen.getByText('$50.00')).toBeInTheDocument());
  expect(screen.getByText('CAD')).toBeInTheDocument();
  expect(screen.getByText('Dépôts nets')).toBeInTheDocument();
  // Solde = depots nets (50) - mises (119) + retours (69) = 0 -- meme fonction que l'accueil
  // (computeGlobalBankroll), jamais une colonne bankroll.montant separee (ex-bug : 924$).
  expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
});

test('Rendement total / profit non realise (depuis toujours)', async () => {
  mockDonnees({ accounts: [ACCOUNT], transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  // Profit des 4 paris decides : -30-39+39-20 = -50 (affiche a la fois "depuis toujours" et
  // "periode" puisque la periode par defaut est "Depuis le debut") -- attendre la vraie valeur
  // chargee, pas le libelle (toujours present) ni "+$0.00" (vrai avant meme le chargement).
  await waitFor(() => expect(screen.getAllByText('-$50.00').length).toBeGreaterThanOrEqual(1));
  expect(screen.getByText('Rendement total')).toBeInTheDocument();
  expect(screen.getByText('Profit non réalisé')).toBeInTheDocument();
  expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0); // aucun pari en cours
});

test('ROI / taux de reussite / mises sur "Depuis le debut" -- ROI = profit/mises, jamais retours/mises', async () => {
  mockDonnees({ accounts: [ACCOUNT], transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  await waitFor(() => expect(screen.getByText('ROI')).toBeInTheDocument());
  // profit (-50) / mises (119) = -42.0% -- jamais +58.0% (retours 69 / mises 119, le bug corrige).
  expect(screen.getByText('-42.0%')).toBeInTheDocument();
  expect(screen.queryByText('+58.0%')).not.toBeInTheDocument();
  // 1 gagne / 3 perdus sur 4 regles = 25%, record 1-3
  expect(screen.getByText('25%')).toBeInTheDocument();
  expect(screen.getByText('1-3')).toBeInTheDocument();
  // 4 mises placees (toutes reglees), montant total 119$
  expect(screen.getByText('4 · $119.00')).toBeInTheDocument();
  // cote moyenne (2.25+2.9+2.3+2.0)/4 = 2.3625 -> 2.36
  expect(screen.getByText('2.36')).toBeInTheDocument();
  // "Rendement total (periode)" = profit (-50) + potentiel actifs (0) = -50
  expect(screen.getByText('Profit réalisé (Depuis le début)')).toBeInTheDocument();
  expect(screen.getAllByText('-$50.00').length).toBeGreaterThanOrEqual(2); // rendement total (depuis toujours) + profit realise (periode)
});

test('changer la periode recalcule les cartes (suffixe + valeurs), base de date = reglement', async () => {
  const hier = new Date(Date.now() - 20 * 86400000).toISOString(); // il y a 20 jours : hors "Dernier jour"
  mockDonnees({
    accounts: [ACCOUNT],
    transactions: TRANSACTIONS_EXEMPLE,
    betsAuto: [
      { id: 'a1', account_id: 'acc1', statut: 'gagne', resultat: 50, mise: 100, cote: 1.5, verified_at: MAINTENANT, type_bet: 'Moneyline', bookmaker: 'bet365' },
      { id: 'a2', account_id: 'acc1', statut: 'perdu', resultat: -80, mise: 80, cote: 2.0, verified_at: hier, type_bet: 'Total', bookmaker: 'Bet99' },
    ],
  });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Rendement total (Depuis le début)')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('Aperçu'));
  fireEvent.click(screen.getByText('Dernier jour'));
  await waitFor(() => expect(screen.getByText('Rendement total (Dernier jour)')).toBeInTheDocument());
  // Seul le pari d'aujourd'hui (gagne +50, regle "aujourd'hui") compte sur "Dernier jour" -- le
  // pari d'il y a 20 jours est exclu par sa date de REGLEMENT, peu importe qu'il ait pu etre place
  // plus recemment (ici il n'y a qu'une seule date par pari bets_auto, mais la regle est documentee
  // dans computePeriodStats).
  expect(screen.getByText('Profit réalisé (Dernier jour)')).toBeInTheDocument();
  expect(screen.getAllByText('+$50.00').length).toBeGreaterThan(0);
});

test('mode masque (choix fait a l\'accueil) : tous les montants deviennent des points, pas de $ visible', async () => {
  writeHideAmounts(true);
  mockDonnees({ accounts: [ACCOUNT], transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  expect(screen.queryByText(/\$50\.00/)).not.toBeInTheDocument();
  expect(screen.queryByText('-$50.00')).not.toBeInTheDocument();
  expect(screen.getAllByLabelText('Montant masqué').length).toBeGreaterThan(0);
});

test('etat vide discret quand aucun pari', async () => {
  mockDonnees({ accounts: [], transactions: [], paris: [], betsAuto: [] });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  expect(screen.getByText('Aucun pari traité pour cette période')).toBeInTheDocument();
  expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
});

test('compte archive : exclu de la bankroll/des depots nets/des stats (meme regle que l\'accueil)', async () => {
  const compteArchive = { ...ACCOUNT, id: 'acc-archive', archived_at: '2026-01-01T00:00:00Z' };
  mockDonnees({
    accounts: [compteArchive],
    transactions: [{ id: 'tx2', account_id: 'acc-archive', type: 'deposit', amount: 999, occurred_on: '2026-01-01' }],
    betsAuto: [{ id: 'a9', account_id: 'acc-archive', statut: 'gagne', resultat: 500, mise: 100, cote: 6, verified_at: MAINTENANT, type_bet: 'Moneyline', bookmaker: 'bet365' }],
  });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  expect(screen.queryByText('$999.00')).not.toBeInTheDocument();
});

test('le lien "Voir le tableau" ouvre une modale avec les colonnes attendues et un bouton export CSV', async () => {
  mockDonnees({ accounts: [ACCOUNT], transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Voir le tableau des données de performance →')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Voir le tableau des données de performance →'));
  expect(screen.getByText('Sportsbook')).toBeInTheDocument();
  expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
});

test('bouton Partager mes stats ouvre la feuille de partage', async () => {
  mockDonnees({ accounts: [ACCOUNT], transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  expect(screen.getByText('Partager')).toBeInTheDocument();
});

test('bouton Retour appelle onBack', async () => {
  mockDonnees({ accounts: [], transactions: [], paris: [], betsAuto: [] });
  const onBack = jest.fn();
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={onBack} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Retour'));
  expect(onBack).toHaveBeenCalledTimes(1);
});
