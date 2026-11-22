import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { getT } from './i18n';
import { BetsPage, dayKeyForBet, groupBetsByDay, dayGroupLabel } from './Bets';

jest.mock('./useIsMobile', () => ({ useIsMobile: jest.fn(() => false) }));
jest.mock('./imageUtils', () => ({ fichierVersJpegBase64: jest.fn() }));
jest.mock('./nhlGameLookup', () => ({ trouverGameId: jest.fn() }));
jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() }, functions: { invoke: jest.fn() } },
}));

const { useIsMobile } = require('./useIsMobile');
const { supabase } = require('./supabase');

const t = getT('fr');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, is: () => q,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    insert: () => q, update: () => q, delete: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const ACCOUNTS = [
  { id: 'acc1', user_id: 'u1', name: 'Betway', kind: 'betway', created_at: '2026-01-01', archived_at: null },
  { id: 'acc2', user_id: 'u1', name: 'Épargne', kind: 'other', created_at: '2026-01-02', archived_at: null },
];
const TRANSACTIONS = [
  { id: 'tx1', account_id: 'acc1', type: 'deposit', amount: 500, occurred_on: '2026-01-01' },
];

let PARIS = [];
let BETS_AUTO = [];

function setupSupabase() {
  supabase.from.mockImplementation((table) => {
    if (table === 'bankroll_accounts') return mockQuery({ data: ACCOUNTS, error: null });
    if (table === 'bankroll_transactions') return mockQuery({ data: TRANSACTIONS, error: null });
    if (table === 'paris') return mockQuery({ data: PARIS, error: null });
    if (table === 'bets_auto') return mockQuery({ data: BETS_AUTO, error: null });
    return mockQuery({ data: [], error: null });
  });
}

beforeEach(() => {
  useIsMobile.mockReturnValue(false);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  PARIS = [];
  BETS_AUTO = [];
  setupSupabase();
});

// ===================== Regroupement par jour (fonctions pures) =====================

describe('dayKeyForBet / groupBetsByDay / dayGroupLabel', () => {
  test("un pari en cours se regroupe sous la date de mise, un pari regle sous la date de reglement", () => {
    expect(dayKeyForBet({ status: 'pending', datePlaced: '2026-11-10T14:00:00Z', dateSettlement: null })).toBe('2026-11-10');
    expect(dayKeyForBet({ status: 'won', datePlaced: '2026-11-01', dateSettlement: '2026-11-12' })).toBe('2026-11-12');
  });

  test('groupe et trie du jour le plus recent au plus ancien', () => {
    const bets = [
      { id: 1, status: 'won', datePlaced: '2026-11-01', dateSettlement: '2026-11-01' },
      { id: 2, status: 'won', datePlaced: '2026-11-05', dateSettlement: '2026-11-05' },
      { id: 3, status: 'won', datePlaced: '2026-11-05', dateSettlement: '2026-11-05' },
    ];
    const groups = groupBetsByDay(bets);
    expect(groups.map(([day]) => day)).toEqual(['2026-11-05', '2026-11-01']);
    expect(groups[0][1]).toHaveLength(2);
  });

  test("dayGroupLabel : Aujourd'hui / Hier / libelle de jour pour les autres dates", () => {
    const now = new Date('2026-11-15T12:00:00');
    expect(dayGroupLabel('2026-11-15', t, 'fr', now)).toBe("Aujourd'hui");
    expect(dayGroupLabel('2026-11-14', t, 'fr', now)).toBe('Hier');
    expect(dayGroupLabel('2026-11-10', t, 'fr', now)).not.toBe("Aujourd'hui");
    expect(dayGroupLabel('2026-11-10', t, 'fr', now)).not.toBe('Hier');
  });
});

// ===================== Etat vide =====================

test('etat vide : aucun pari du tout -> message + bouton "Ajouter un pari"', async () => {
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText(t('bets_empty_title'))).toBeInTheDocument());
  expect(screen.getAllByText(t('bets_add_btn')).length).toBeGreaterThan(0);
});

test('etat vide filtre : des paris existent mais aucun ne correspond au filtre de statut', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'pending', equipe: 'MTL', adversaire: 'TOR', created_at: '2026-11-10' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('MTL vs TOR')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: t('bets_filter_status_label') }));
  fireEvent.click(screen.getByRole('option', { name: t('bets_lost') }));

  await waitFor(() => expect(screen.getByText(t('bets_empty_filtered_title'))).toBeInTheDocument());
  expect(screen.queryByText('MTL vs TOR')).not.toBeInTheDocument();
});

// ===================== Filtres =====================

test('filtre de statut : "Gagné" ne garde que les paris gagnes', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'gagne', resultat: 50, equipe: 'MTL', adversaire: 'TOR', verified_at: '2026-11-10' },
    { id: 'b2', account_id: 'acc1', bookmaker: 'Betway', mise: 20, cote: 1.8, statut: 'perdu', resultat: -20, equipe: 'BOS', adversaire: 'NYR', verified_at: '2026-11-11' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('MTL vs TOR')).toBeInTheDocument());
  expect(screen.getByText('BOS vs NYR')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: t('bets_filter_status_label') }));
  fireEvent.click(screen.getByRole('option', { name: t('bets_won') }));

  await waitFor(() => expect(screen.queryByText('BOS vs NYR')).not.toBeInTheDocument());
  expect(screen.getByText('MTL vs TOR')).toBeInTheDocument();
});

test('filtre de compte : ne garde que les paris du compte selectionne', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'pending', equipe: 'MTL', adversaire: 'TOR', created_at: '2026-11-10' },
    { id: 'b2', account_id: 'acc2', bookmaker: null, mise: 20, cote: 1.8, statut: 'pending', equipe: 'BOS', adversaire: 'NYR', created_at: '2026-11-11' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('MTL vs TOR')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: t('bets_filter_account_label') }));
  fireEvent.click(screen.getByRole('option', { name: 'Betway' }));

  await waitFor(() => expect(screen.queryByText('BOS vs NYR')).not.toBeInTheDocument());
  expect(screen.getByText('MTL vs TOR')).toBeInTheDocument();
});

test('filtre de type de pari : "Joueur" ne garde que les props joueur', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'pending', type_bet: 'Prop joueur', joueur_nom: 'Alexandre Texier', stat_type: 'Goals', ligne: 1, created_at: '2026-11-10' },
    { id: 'b2', account_id: 'acc1', bookmaker: 'Betway', mise: 20, cote: 1.8, statut: 'pending', type_bet: 'Moneyline', equipe: 'BOS', adversaire: 'NYR', created_at: '2026-11-11' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('BOS vs NYR')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: t('bets_filter_kind_label') }));
  fireEvent.click(screen.getByRole('option', { name: t('bets_filter_kind_player') }));

  await waitFor(() => expect(screen.queryByText('BOS vs NYR')).not.toBeInTheDocument());
  expect(screen.getByText('Alexandre Texier — Goals 1')).toBeInTheDocument();
});

// ===================== Mode masque =====================

test('mode masque : le bouton oeil remplace les montants par des points, jamais le badge "Actif"', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'pending', equipe: 'MTL', adversaire: 'TOR', created_at: '2026-11-10' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('MTL vs TOR')).toBeInTheDocument());
  expect(screen.getAllByText(t('home_active_badge')).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByLabelText(t('home_hide_amounts')));
  expect(screen.getAllByText(t('home_active_badge')).length).toBeGreaterThan(0);
  expect(screen.getAllByLabelText(t('home_amounts_hidden')).length).toBeGreaterThan(0);
});

// ===================== Reglement (detail panel) =====================

test('reglement "Gagne" depuis le panneau de detail met a jour le statut/resultat en base', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'pending', equipe: 'MTL', adversaire: 'TOR', created_at: '2026-11-10' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('MTL vs TOR')).toBeInTheDocument());

  fireEvent.click(screen.getByText('MTL vs TOR'));
  await waitFor(() => expect(screen.getByText(t('bet_detail_title'))).toBeInTheDocument());

  const updateSpy = jest.fn(() => mockQuery({ data: null, error: null }));
  supabase.from.mockImplementation((table) => {
    if (table === 'bets_auto') {
      return { ...mockQuery({ data: BETS_AUTO, error: null }), update: (champs) => { updateSpy(champs); return mockQuery({ data: null, error: null }); } };
    }
    if (table === 'bankroll_accounts') return mockQuery({ data: ACCOUNTS, error: null });
    if (table === 'bankroll_transactions') return mockQuery({ data: TRANSACTIONS, error: null });
    if (table === 'paris') return mockQuery({ data: PARIS, error: null });
    return mockQuery({ data: [], error: null });
  });

  fireEvent.click(within(screen.getByText(t('bet_detail_title')).closest('div[role="dialog"]') || document.body).getByText(t('bets_won')));

  await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ statut: 'gagne', resultat: 50 })));
});

test('reglement "Annule" force le resultat a 0 (mise remboursee, ni gagnant ni perdant)', async () => {
  BETS_AUTO = [
    { id: 'b1', account_id: 'acc1', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'pending', equipe: 'MTL', adversaire: 'TOR', created_at: '2026-11-10' },
  ];
  setupSupabase();
  render(<BetsPage lang="fr" />);
  await waitFor(() => expect(screen.getByText('MTL vs TOR')).toBeInTheDocument());

  fireEvent.click(screen.getByText('MTL vs TOR'));
  await waitFor(() => expect(screen.getByText(t('bet_detail_title'))).toBeInTheDocument());

  const updateSpy = jest.fn(() => mockQuery({ data: null, error: null }));
  supabase.from.mockImplementation((table) => {
    if (table === 'bets_auto') {
      return { ...mockQuery({ data: BETS_AUTO, error: null }), update: (champs) => { updateSpy(champs); return mockQuery({ data: null, error: null }); } };
    }
    if (table === 'bankroll_accounts') return mockQuery({ data: ACCOUNTS, error: null });
    if (table === 'bankroll_transactions') return mockQuery({ data: TRANSACTIONS, error: null });
    if (table === 'paris') return mockQuery({ data: PARIS, error: null });
    return mockQuery({ data: [], error: null });
  });

  fireEvent.click(screen.getByText(t('bets_cancelled_badge')));

  await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ statut: 'annule', resultat: 0 })));
});
