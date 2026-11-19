import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceInsights } from './PerformanceInsights';
import { writeHideAmounts } from './Home';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const MAINTENANT = new Date().toISOString();

function mockDonnees({ bankroll = 1000, transactions = [], paris = [], betsAuto = [] } = {}) {
  supabase.from.mockImplementation((table) => {
    if (table === 'bankroll') return mockQuery({ data: { montant: bankroll }, error: null });
    if (table === 'transactions') return mockQuery({ data: transactions, error: null });
    if (table === 'paris') return mockQuery({ data: paris, error: null });
    if (table === 'bets_auto') return mockQuery({ data: betsAuto, error: null });
    return mockQuery({ data: [], error: null });
  });
}

const BETS_AUTO_EXEMPLE = [
  { id: 'a1', statut: 'gagne', resultat: 50, mise: 100, cote: 1.5, verified_at: MAINTENANT, type_bet: 'Moneyline', bookmaker: 'bet365' },
  { id: 'a2', statut: 'perdu', resultat: -80, mise: 80, cote: 2.0, verified_at: MAINTENANT, type_bet: 'Total', bookmaker: 'Bet99' },
  { id: 'a3', statut: 'pending', resultat: null, mise: 50, cote: 3.0, created_at: MAINTENANT, type_bet: 'Prop joueur', bookmaker: 'bet365' },
];
const TRANSACTIONS_EXEMPLE = [
  { type: 'deposit', montant: 500 }, { type: 'deposit', montant: 600 }, { type: 'withdrawal', montant: 100 },
];

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  writeHideAmounts(false);
});

test('affiche le titre, la bankroll et les 3 stats globales (depots nets / rendement total / profit non realise)', async () => {
  mockDonnees({ bankroll: 1000, transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  await waitFor(() => expect(screen.getAllByText('$1000.00').length).toBeGreaterThan(0));
  expect(screen.getByText('CAD')).toBeInTheDocument();
  expect(screen.getByText('Dépôts nets')).toBeInTheDocument();
  expect(screen.getAllByText('$1000.00').length).toBe(2); // bankroll + depots nets (500+600-100)
  // "Rendement total" (depuis toujours) ET "Profit realise (Depuis le debut)" valent tous deux -30 (meme fenetre)
  expect(screen.getAllByText('-$30.00').length).toBe(2);
  expect(screen.getByText('$100.00')).toBeInTheDocument(); // profit non realise = 50*3-50
});

test('calculs ROI / taux de reussite / cote moyenne sur la periode "Depuis le debut"', async () => {
  mockDonnees({ bankroll: 1000, transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  await waitFor(() => expect(screen.getByText('ROI')).toBeInTheDocument());
  // profit realise = -30, mise reglee totale = 180 -> ROI = -16.7%
  expect(screen.getByText('-16.7%')).toBeInTheDocument();
  // rendement total periode (realise -30 + potentiel actifs 100) = 70 ; depots nets = 1000 -> 7.0%
  expect(screen.getByText('+7.0%')).toBeInTheDocument();
  // 1 gagne / 1 perdu sur 2 regles = 50%, record 1-1
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText('1-1')).toBeInTheDocument();
  // 3 mises placees (2 reglees + 1 active), montant total 230$
  expect(screen.getByText('3 · $230.00')).toBeInTheDocument();
  // cote moyenne (1.5+2.0+3.0)/3 = 2.17
  expect(screen.getByText('2.17')).toBeInTheDocument();
});

test('changer la periode recalcule les cartes (suffixe + valeurs)', async () => {
  const hier = new Date(Date.now() - 20 * 86400000).toISOString(); // il y a 20 jours : hors fenetre "Dernier jour"/"Derniere semaine"
  mockDonnees({
    bankroll: 1000,
    transactions: TRANSACTIONS_EXEMPLE,
    betsAuto: [
      { id: 'a1', statut: 'gagne', resultat: 50, mise: 100, cote: 1.5, verified_at: MAINTENANT, type_bet: 'Moneyline', bookmaker: 'bet365' },
      { id: 'a2', statut: 'perdu', resultat: -80, mise: 80, cote: 2.0, verified_at: hier, type_bet: 'Total', bookmaker: 'Bet99' },
    ],
  });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Rendement total (Depuis le début)')).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText('Aperçu'), { target: { value: '1d' } });
  await waitFor(() => expect(screen.getByText('Rendement total (Dernier jour)')).toBeInTheDocument());
  // Seul le pari d'aujourd'hui (gagne +50) compte sur "Dernier jour"
  expect(screen.getByText('Profit réalisé (Dernier jour)')).toBeInTheDocument();
  expect(screen.getAllByText('+$50.00').length).toBeGreaterThan(0);
});

test('mode masque (choix fait a l\'accueil) : tous les montants deviennent des points, pas de $ visible', async () => {
  writeHideAmounts(true);
  mockDonnees({ bankroll: 1000, transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);

  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  expect(screen.queryByText(/\$1000\.00/)).not.toBeInTheDocument();
  expect(screen.queryByText('-$30.00')).not.toBeInTheDocument();
  expect(screen.getAllByLabelText('Montant masqué').length).toBeGreaterThan(0);
});

test('etat vide discret quand aucun pari', async () => {
  mockDonnees({ bankroll: 0, transactions: [], paris: [], betsAuto: [] });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  expect(screen.getByText('Aucun pari traité pour cette période')).toBeInTheDocument();
});

test('le lien "Voir le tableau" ouvre une modale avec les colonnes attendues et un bouton export CSV', async () => {
  mockDonnees({ bankroll: 1000, transactions: TRANSACTIONS_EXEMPLE, betsAuto: BETS_AUTO_EXEMPLE });
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={noop} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Voir le tableau des données de performance →')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Voir le tableau des données de performance →'));
  expect(screen.getByText('Sportsbook')).toBeInTheDocument();
  expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
});

test('bouton Retour appelle onBack', async () => {
  mockDonnees({ bankroll: 0, transactions: [], paris: [], betsAuto: [] });
  const onBack = jest.fn();
  render(<PerformanceInsights utilisateur={{ id: 'u1' }} lang="fr" onBack={onBack} initialPeriod="all" />);
  await waitFor(() => expect(screen.getByText('Aperçu de la performance')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Retour'));
  expect(onBack).toHaveBeenCalledTimes(1);
});
