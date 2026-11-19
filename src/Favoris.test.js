import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavorisPage } from './Favoris';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}));
const { supabase } = require('./supabase');

const WATCHLIST = [{ id: 'w1', kind: 'team', ref_id: 'MTL', created_at: '2026-01-01T00:00:00Z' }];
const PICKS = [{ id: 'p1', label: 'Connor McDavid - O 1.5 pts', market: 'Points', line: 1.5, odds: -110, planned_stake: 20, note: '', created_at: '2026-01-02T00:00:00Z', status: 'saved' }];

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    delete: () => q,
  };
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
  supabase.from.mockImplementation((table) => {
    if (table === 'watchlist_items') return mockQuery({ data: WATCHLIST, error: null });
    if (table === 'saved_picks') return mockQuery({ data: PICKS, error: null });
    return mockQuery({ data: [], error: null });
  });
  supabase.channel.mockImplementation(() => ({ on: () => ({ subscribe: () => ({}) }) }));
  global.fetch = jest.fn((url) => {
    if (String(url).includes('standings/now')) {
      return Promise.resolve({ json: () => Promise.resolve({ standings: [{ teamAbbrev: { default: 'MTL' }, teamName: { default: 'Canadiens de Montréal' } }] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
});

test('affiche Picks par defaut, bascule vers Watchlist sans changer de page', async () => {
  render(<FavorisPage utilisateur={{ id: 'u1' }} lang="fr" />);

  await waitFor(() => expect(screen.getByText(/Connor McDavid/)).toBeInTheDocument());
  expect(screen.queryByText('Canadiens de Montréal')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Watchlist'));
  await waitFor(() => expect(screen.getByText('Canadiens de Montréal')).toBeInTheDocument());
  expect(screen.queryByText(/Connor McDavid/)).not.toBeInTheDocument();
});

test('le bouton agrandir ouvre un tableau pleine page avec colonnes et bouton retour', async () => {
  render(<FavorisPage utilisateur={{ id: 'u1' }} lang="fr" />);
  await waitFor(() => expect(screen.getByText(/Connor McDavid/)).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('Agrandir'));
  expect(screen.getByText('Marché')).toBeInTheDocument(); // en-tete de colonne, uniquement dans la vue agrandie
  expect(screen.getByText('← Retour')).toBeInTheDocument();

  // la bascule Picks/Watchlist reste disponible dans la vue agrandie
  fireEvent.click(screen.getByText('Watchlist'));
  await waitFor(() => expect(screen.getByText('Canadiens de Montréal')).toBeInTheDocument());

  fireEvent.click(screen.getByText('← Retour'));
  expect(screen.queryByText('← Retour')).not.toBeInTheDocument();
});

test('etat vide si aucun pick/favori', async () => {
  supabase.from.mockImplementation((table) => mockQuery({ data: [], error: null }));
  render(<FavorisPage utilisateur={{ id: 'u1' }} lang="fr" />);
  await waitFor(() => expect(screen.getByText('Aucun pick sauvegardé pour le moment.')).toBeInTheDocument());
});
