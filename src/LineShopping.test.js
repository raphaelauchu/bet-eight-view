import { render, screen, waitFor } from '@testing-library/react';
import { ComparateurCotesLNH } from './LineShopping';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
const { supabase } = require('./supabase');

const MATCH = {
  bookmakers: [
    {
      key: 'bet365', title: 'Bet365', last_update: '2026-11-18T12:00:00Z',
      markets: [
        { key: 'h2h', outcomes: [{ name: 'Canadiens', price: 2.10 }, { name: 'Maple Leafs', price: 1.80 }] },
        { key: 'totals', outcomes: [{ name: 'Over', price: 1.95 }, { name: 'Under', price: 1.90 }] },
      ],
    },
    {
      key: 'betway', title: 'Betway', last_update: '2026-11-18T12:00:00Z',
      markets: [
        { key: 'h2h', outcomes: [{ name: 'Canadiens', price: 2.05 }, { name: 'Maple Leafs', price: 1.85 }] },
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

test('Quebec : aucun logo, aucun lien sortant, mentions age/jeu responsable et statut hors reglementation presentes', async () => {
  mockProvince('quebec');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );

  await waitFor(() => expect(screen.getByText(/Comparateur de cotes/i)).toBeInTheDocument());

  expect(screen.queryAllByRole('img')).toHaveLength(0);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(document.querySelectorAll('a[href]')).toHaveLength(0);

  expect(screen.getByText(/18\+ requis au Québec/i)).toBeInTheDocument();
  expect(screen.getByText(/Jouez de façon responsable/i)).toBeInTheDocument();
  expect(screen.getByText(/ne constituent pas un conseil de pari/i)).toBeInTheDocument();

  // 4 sportsbooks (bet365, betway, bet99, sports interaction) x 2 tableaux de marche (Moneyline, Total)
  const etiquettesGrises = screen.getAllByText(/Hors réglementation au Québec/i);
  expect(etiquettesGrises.length).toBe(8);

  expect(screen.queryByText('Mise-o-jeu+')).not.toBeInTheDocument();
  expect(screen.queryByText(/Seul site réglementé au Québec/i)).not.toBeInTheDocument();
});

test('BET99 et Sports Interaction affichent "Cotes non disponibles" (non fournis par la source)', async () => {
  mockProvince('quebec');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );
  await waitFor(() => expect(screen.getAllByText('BET99').length).toBeGreaterThan(0));
  expect(screen.getAllByText('Cotes non disponibles').length).toBeGreaterThan(0);
});

test('Autre province : aucun sportsbook affiche, message d\'indisponibilite seulement', async () => {
  mockProvince('autre');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );
  await waitFor(() => expect(screen.getByText(/n'est pas disponible dans votre province/i)).toBeInTheDocument());
  expect(screen.queryByText('bet365')).not.toBeInTheDocument();
  expect(screen.queryByText('Betway')).not.toBeInTheDocument();
});

test('Match deja joue : le comparateur ne rend rien', async () => {
  mockProvince('quebec');
  const { container } = render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={true}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );
  expect(container.firstChild).toBeNull();
});
