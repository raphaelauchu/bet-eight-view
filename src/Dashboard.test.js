import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

jest.mock('./Analyses', () => ({
  useIsMobile: jest.fn(() => false),
}));

jest.mock('./supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

const { useIsMobile } = require('./Analyses');
const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  supabase.from.mockImplementation((table) => {
    if (table === 'paris') return mockQuery({ data: [], error: null });
    if (table === 'bankroll') return mockQuery({ data: { montant: 500 }, error: null });
    if (table === 'bets_auto') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
});

// ===================== iPad/web (>=768px) : colonne de resume (ROI, victoires, mises
// actives, courbe de profit) a cote de la liste des paris =====================

test('iPad/web : la colonne de resume (ROI, victoires, mises actives) est affichee', async () => {
  render(<Dashboard lang="fr" />);
  await waitFor(() => expect(screen.getByText('Résumé')).toBeInTheDocument());
  expect(screen.getByText('Mises actives')).toBeInTheDocument();
  expect(screen.getByText('Courbe de profit')).toBeInTheDocument();
  // La liste principale (paris actifs) reste presente a cote du resume.
  expect(screen.getAllByText(/Actifs/).length).toBeGreaterThan(0);
});

// ===================== Mobile (<768px) : INCHANGE, pas de colonne de resume =====================

test('mobile : aucune colonne de resume (mise en page a une seule colonne, inchangee)', async () => {
  useIsMobile.mockReturnValue(true);
  render(<Dashboard lang="fr" />);
  await waitFor(() => expect(screen.getAllByText(/Actifs/).length).toBeGreaterThan(0));
  expect(screen.queryByText('Résumé')).not.toBeInTheDocument();
  expect(screen.queryByText('Courbe de profit')).not.toBeInTheDocument();
});
