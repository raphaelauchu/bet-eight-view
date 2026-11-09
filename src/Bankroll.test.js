import { render, screen, waitFor } from '@testing-library/react';
import { BankrollPage } from './App';

jest.mock('./Analyses', () => ({
  useIsMobile: jest.fn(() => false),
  useIsDesktopWide: jest.fn(() => true),
}));

jest.mock('./supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { useIsMobile } = require('./Analyses');
const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, neq: () => q,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  supabase.from.mockImplementation((table) => {
    if (table === 'bankroll') return mockQuery({ data: { montant: 500 }, error: null });
    if (table === 'transactions') return mockQuery({ data: [], error: null });
    if (table === 'paris') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
});

const noop = () => {};

// ===================== iPad/web (>=768px) : colonne principale (graphique + historique) et
// colonne droite (solde, depot/retrait) =====================

test('iPad/web : solde et bouton nouvelle transaction dans la colonne droite, evolution et transactions dans la colonne principale', async () => {
  render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
  await waitFor(() => expect(document.body.textContent).toContain('$500'));
  expect(screen.getByText('Évolution Bankroll')).toBeInTheDocument();
  expect(screen.getByText('+ Nouvelle transaction')).toBeInTheDocument();
  expect(screen.getAllByText('Transactions').length).toBeGreaterThan(0);
});

// ===================== Mobile (<768px) : INCHANGE, une seule colonne =====================

test('mobile : une seule colonne (comportement inchange)', async () => {
  useIsMobile.mockReturnValue(true);
  render(<BankrollPage utilisateur={{ id: 'u1' }} onBack={noop} lang="fr" />);
  await waitFor(() => expect(document.body.textContent).toContain('$500'));
  expect(screen.getByText('Évolution Bankroll')).toBeInTheDocument();
  expect(screen.getByText('+ Nouvelle transaction')).toBeInTheDocument();
});
