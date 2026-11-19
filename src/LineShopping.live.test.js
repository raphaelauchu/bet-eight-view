import { render, screen, waitFor } from '@testing-library/react';

// Force ODDS_COMPARATOR_LIVE_DATA a true pour ce fichier seulement -- couvre le mode
// "donnees" du comparateur (interrupteur a false par defaut dans l'app reelle, voir
// src/LineShopping.test.js pour le mode apercu reel).
jest.mock('./sportsbooksConfig', () => ({
  ...jest.requireActual('./sportsbooksConfig'),
  ODDS_COMPARATOR_LIVE_DATA: true,
}));
jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

const { ComparateurCotesLNH } = require('./LineShopping');
const { supabase } = require('./supabase');

const MATCH = {
  bookmakers: [
    {
      key: 'bet365', title: 'Bet365', last_update: '2026-11-18T12:00:00Z',
      markets: [
        { key: 'h2h', outcomes: [{ name: 'Canadiens', price: 2.10 }, { name: 'Maple Leafs', price: 1.80 }] },
        { key: 'spreads', outcomes: [{ name: 'Canadiens', point: -1.5, price: 2.50 }, { name: 'Maple Leafs', point: 1.5, price: 1.55 }] },
        { key: 'totals', outcomes: [{ name: 'Over', price: 1.95 }, { name: 'Under', price: 1.90 }] },
      ],
    },
    {
      key: 'betway', title: 'Betway', last_update: '2026-11-18T12:00:00Z',
      markets: [
        { key: 'h2h', outcomes: [{ name: 'Canadiens', price: 2.05 }, { name: 'Maple Leafs', price: 1.85 }] },
        { key: 'spreads', outcomes: [{ name: 'Canadiens', point: -1.5, price: 2.40 }, { name: 'Maple Leafs', point: 1.5, price: 1.60 }] },
        { key: 'totals', outcomes: [{ name: 'Over', price: 1.90 }, { name: 'Under', price: 1.92 }] },
      ],
    },
  ],
};

function mockProvince(province) {
  supabase.from.mockImplementation(() => {
    const q = {
      select: () => q,
      eq: () => q,
      single: () => Promise.resolve({ data: { province } }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    };
    return q;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('Mode donnees : les vraies cotes bet365/Betway s\'affichent, BET99/Sports Interaction indisponibles', async () => {
  mockProvince('quebec');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );

  await waitFor(() => expect(screen.getByText(/Comparateur de cotes/i)).toBeInTheDocument());

  // bet365 a la meilleure cote moneyline (2.10 -> +110), Betway (2.05 -> +105)
  expect(screen.getByText('+110')).toBeInTheDocument();
  expect(screen.getByText('2.10')).toBeInTheDocument();
  expect(screen.getByText('+105')).toBeInTheDocument();

  expect(screen.getAllByText('Cotes non disponibles').length).toBeGreaterThan(0);
  expect(screen.queryAllByText('—')).toHaveLength(0);

  // ligne "derniere mise a jour" presente uniquement en mode donnees
  expect(screen.getByText(/Cotes mises à jour/i)).toBeInTheDocument();
  expect(screen.queryByText(/Aperçu : les cotes en direct/i)).not.toBeInTheDocument();
});

test('Mode donnees : toujours aucune case "Reglementes seulement"', async () => {
  mockProvince('alberta');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );
  await waitFor(() => expect(screen.getByText(/Comparateur de cotes/i)).toBeInTheDocument());
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByText(/18\+ requis en Alberta/i)).toBeInTheDocument();
});
