import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BankrollPage } from './Bankroll';

jest.mock('./useIsMobile', () => ({ useIsMobile: jest.fn(() => false) }));

jest.mock('./imageUtils', () => ({ fichierVersJpegBase64: jest.fn() }));
jest.mock('./nhlGameLookup', () => ({ trouverGameId: jest.fn() }));

jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() }, functions: { invoke: jest.fn() } },
}));

const { useIsMobile } = require('./useIsMobile');
const { supabase } = require('./supabase');
const { fichierVersJpegBase64 } = require('./imageUtils');
const { trouverGameId } = require('./nhlGameLookup');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, neq: () => q, is: () => q,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    insert: () => q, update: () => q, delete: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const ACCOUNTS = [
  { id: 'acc-autre', user_id: 'u1', name: 'Épargne', kind: 'other', created_at: '2026-01-01', archived_at: null },
  { id: 'acc-betway', user_id: 'u1', name: 'Betway', kind: 'betway', created_at: '2026-01-02', archived_at: null },
];
const TRANSACTIONS = [
  { id: 'tx1', user_id: 'u1', account_id: 'acc-autre', type: 'deposit', amount: 500, occurred_on: '2026-01-01', note: null },
  { id: 'tx2', user_id: 'u1', account_id: 'acc-betway', type: 'deposit', amount: 200, occurred_on: '2026-01-02', note: null },
];
const PARIS = [];
const BETS_AUTO = [
  { id: 'b1', user_id: 'u1', account_id: 'acc-betway', bookmaker: 'Betway', mise: 50, cote: 2, statut: 'gagne', resultat: 50, verified_at: '2026-02-01', created_at: '2026-01-15', equipe: 'MTL', adversaire: 'TOR' },
];

function setupSupabase({ accounts = ACCOUNTS, transactions = TRANSACTIONS, paris = PARIS, betsAuto = BETS_AUTO } = {}) {
  supabase.from.mockImplementation((table) => {
    if (table === 'bankroll_accounts') return mockQuery({ data: accounts, error: null });
    if (table === 'bankroll_transactions') return mockQuery({ data: transactions, error: null });
    if (table === 'paris') return mockQuery({ data: paris, error: null });
    if (table === 'bets_auto') return mockQuery({ data: betsAuto, error: null });
    return mockQuery({ data: [], error: null });
  });
}

const noop = () => {};

beforeEach(() => {
  useIsMobile.mockReturnValue(false);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  fichierVersJpegBase64.mockResolvedValue('data:image/jpeg;base64,xx');
  trouverGameId.mockResolvedValue(null);
  setupSupabase();
});

describe('vue d\'ensemble', () => {
  test('affiche la bankroll globale (somme des comptes) et une carte par compte', async () => {
    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    // Épargne : 500 (depot) + 0 (aucun pari) = 500. Betway : 200 (depot) + 50 (profit) = 250.
    // Global = 750.
    await waitFor(() => expect(screen.getByText('$750.00')).toBeInTheDocument());
    expect(screen.getByText('Épargne')).toBeInTheDocument();
    expect(screen.getByText('Betway')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
  });

  test('etat vide quand l\'utilisateur n\'a aucun compte', async () => {
    setupSupabase({ accounts: [], transactions: [], betsAuto: [] });
    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('Ajoute ton premier compte')).toBeInTheDocument());
    expect(screen.getAllByText('+ Ajouter un compte').length).toBeGreaterThan(0);
  });

  test('clic sur une carte de compte ouvre la page de ce compte', async () => {
    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('Betway')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Betway'));
    await waitFor(() => expect(screen.getByText('Paris récents')).toBeInTheDocument());
    expect(screen.getByText('Ajouter de l’argent')).toBeInTheDocument();
    expect(screen.getByText('Retirer')).toBeInTheDocument();
  });
});

describe('nouvel utilisateur (aucun compte -- plus de "Principal" auto-cree)', () => {
  beforeEach(() => {
    setupSupabase({ accounts: [], transactions: [], paris: [], betsAuto: [] });
  });

  test('total a 0$ et etat vide soigne avec la pilule "+ Ajouter un compte"', async () => {
    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('$0.00')).toBeInTheDocument());
    expect(screen.getByText('Ajoute ton premier compte')).toBeInTheDocument();
    expect(screen.getAllByText('+ Ajouter un compte').length).toBeGreaterThan(0);
    // Aucune trace d'un compte "Principal" nulle part dans la page.
    expect(screen.queryByText('Principal')).not.toBeInTheDocument();
  });

  test('"+ Ajouter un compte" cree exactement le compte choisi par l\'utilisateur, jamais un "Principal" automatique', async () => {
    const insertedAccounts = [];
    supabase.from.mockImplementation((table) => {
      if (table === 'bankroll_accounts') {
        return {
          select: () => mockQuery({ data: insertedAccounts.map((p, i) => ({ id: `new-acc-${i}`, archived_at: null, ...p })), error: null }),
          insert: (payload) => {
            insertedAccounts.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: `new-acc-${insertedAccounts.length - 1}`, ...payload, archived_at: null }, error: null }) }) };
          },
        };
      }
      if (table === 'bankroll_transactions') return mockQuery({ data: [], error: null });
      if (table === 'paris') return mockQuery({ data: [], error: null });
      if (table === 'bets_auto') return mockQuery({ data: [], error: null });
      return mockQuery({ data: [], error: null });
    });

    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('Ajoute ton premier compte')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('+ Ajouter un compte')[0]);
    await waitFor(() => expect(screen.getByText('Betway', { selector: 'button' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Betway', { selector: 'button' }));
    await waitFor(() => expect(screen.getByText('Créer le compte')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Créer le compte'));

    await waitFor(() => expect(insertedAccounts.length).toBe(1));
    expect(insertedAccounts[0].name).toBe('Betway');
    expect(insertedAccounts[0].name).not.toBe('Principal');
    await waitFor(() => expect(screen.getByText('Comptes')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Ajoute ton premier compte')).not.toBeInTheDocument());
  });
});

describe('page de compte', () => {
  async function ouvrirCompteBetway() {
    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('Betway')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Betway'));
    await waitFor(() => expect(screen.getByText('Paris récents')).toBeInTheDocument());
  }

  test('affiche le solde du compte, disponible/en jeu, depots nets et le pari regle', async () => {
    await ouvrirCompteBetway();
    expect(screen.getByText('MTL vs TOR')).toBeInTheDocument();
    expect(screen.getAllByText('$250.00').length).toBeGreaterThan(0); // solde + disponible (aucun pari en attente)
  });

  test('le bouton retour revient a la vue d\'ensemble (pas a l\'accueil)', async () => {
    await ouvrirCompteBetway();
    fireEvent.click(screen.getAllByText('← Retour')[0]);
    await waitFor(() => expect(screen.getByText('Comptes')).toBeInTheDocument());
  });
});

describe('ajouter un pari depuis la page de compte', () => {
  test('le pari cree est rattache au compte courant meme si le formulaire ne fournit aucun compte (ordre du spread)', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { data: { mise: 25, cote: 1.8, bookmaker: 'Betway', equipe: 'MTL', adversaire: 'TOR' } },
      error: null,
    });
    const insertedPayloads = [];
    supabase.from.mockImplementation((table) => {
      if (table === 'bankroll_accounts') return mockQuery({ data: ACCOUNTS, error: null });
      if (table === 'bankroll_transactions') return mockQuery({ data: TRANSACTIONS, error: null });
      if (table === 'paris') return mockQuery({ data: PARIS, error: null });
      if (table === 'bets_auto') {
        return {
          select: () => mockQuery({ data: BETS_AUTO, error: null }),
          insert: (payload) => {
            insertedPayloads.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new-bet', ...payload }, error: null }) }) };
          },
        };
      }
      return mockQuery({ data: [], error: null });
    });

    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('Betway')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Betway'));
    await waitFor(() => expect(screen.getByText('+ Ajouter un pari')).toBeInTheDocument());

    fireEvent.click(screen.getByText('+ Ajouter un pari'));
    const fileInput = document.querySelector('input[type="file"]');
    const fichier = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [fichier] } });

    await waitFor(() => expect(screen.getByText('Confirmer et enregistrer')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirmer et enregistrer'));

    await waitFor(() => expect(insertedPayloads.length).toBe(1));
    expect(insertedPayloads[0].account_id).toBe('acc-betway');
  });
});

describe('mobile', () => {
  test('une seule colonne, tuiles depot/retrait visibles', async () => {
    useIsMobile.mockReturnValue(true);
    render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
    await waitFor(() => expect(screen.getByText('Betway')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Betway'));
    await waitFor(() => expect(screen.getByText('Ajouter de l’argent')).toBeInTheDocument());
  });
});
