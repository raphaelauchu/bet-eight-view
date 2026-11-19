import { render, screen, waitFor } from '@testing-library/react';
import { ComparateurCotesLNH } from './LineShopping';

// ODDS_COMPARATOR_LIVE_DATA est a false par defaut (src/sportsbooksConfig.js) -- ces tests
// couvrent le mode apercu reel de l'app. Le mode donnees (interrupteur a true) est couvert par
// src/LineShopping.live.test.js, qui force le module a true via jest.mock.
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

test('Mode apercu : banniere affichee, toutes les cellules de cotes sont des tirets, aucune cote inventee', async () => {
  mockProvince('quebec');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );

  await waitFor(() => expect(screen.getByText(/Comparateur de cotes/i)).toBeInTheDocument());

  expect(screen.getByText(/Aperçu : les cotes en direct seront bientôt disponibles/i)).toBeInTheDocument();

  // bet365, Betway, BET99, Sports Interaction x Moneyline/Total/Ecart de buts x 2 colonnes = 24 tirets
  const tirets = screen.getAllByText('—');
  expect(tirets.length).toBe(24);

  // jamais "+110"/"2.10" etc. -- la cote fournie dans MATCH ne doit jamais apparaitre a l'ecran
  expect(screen.queryByText('+110')).not.toBeInTheDocument();
  expect(screen.queryByText('2.10')).not.toBeInTheDocument();

  // aucune ligne "derniere mise a jour" en mode apercu
  expect(screen.queryByText(/Cotes mises à jour/i)).not.toBeInTheDocument();
});

test('Mode apercu : les 4 books et les 3 marches sont presents, avec leur statut provincial', async () => {
  mockProvince('quebec');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );
  await waitFor(() => expect(screen.getAllByText('BET99').length).toBeGreaterThan(0));
  expect(screen.getAllByText('bet365').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Betway').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Sports Interaction').length).toBeGreaterThan(0);
  expect(screen.getByText('Moneyline')).toBeInTheDocument();
  expect(screen.getByText('Total')).toBeInTheDocument();
  expect(screen.getByText('Écart de buts (Puck line)')).toBeInTheDocument();
  expect(screen.getAllByText(/Hors réglementation au Québec/i).length).toBe(12); // 4 books x 3 marches
});

test('La case "Reglementes seulement" n\'existe plus', async () => {
  mockProvince('ontario');
  render(
    <ComparateurCotesLNH matchBrut={MATCH} nom1="Canadiens" nom2="Maple Leafs" dejaJoue={false}
      utilisateur={{ id: 'u1' }} lang="fr" cotesFetchedAt="2026-11-18T12:00:00Z" />
  );
  await waitFor(() => expect(screen.getByText(/Comparateur de cotes/i)).toBeInTheDocument());
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText(/Réglementés seulement/i)).not.toBeInTheDocument();
  expect(screen.getByText(/19\+ requis en Ontario/i)).toBeInTheDocument();
});

test('Quebec : aucun logo, aucun lien sortant, mentions age/jeu responsable presentes', async () => {
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
  expect(screen.queryByText('Mise-o-jeu+')).not.toBeInTheDocument();
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
