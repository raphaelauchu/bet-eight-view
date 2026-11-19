import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Test d'integration leger de App() (seule fois dans ce projet qu'un test rend App() en entier
// -- rendu possible a cout raisonnable en remplacant AnalysesFlux/ModelesFlux/HomeDashboard par
// des stubs : leurs propres arbres de dependances (Analyses.js ~6800 lignes, appels reseau NHL,
// etc.) ne sont alors jamais evalues). Couvre specifiquement la fusion Modeles -> onglet
// "Matchs/Modeles" segmente dans Analyses et la redirection de l'ancienne route ?page=props.
jest.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));
const { supabase } = require('./supabase');

jest.mock('./Analyses', () => ({
  AnalysesFlux: () => <div>ANALYSES_MATCHS_STUB</div>,
  RechercheOverlay: () => null,
  FicheJoueurStats: () => null,
  FicheEquipeWS: () => null,
  WS_THEME: { dark: {}, light: {} },
  useWSTheme: () => ['dark', jest.fn(), 'system', jest.fn()],
  useIsMobile: () => false,
}));
jest.mock('./Modeles', () => () => <div>MODELES_STUB</div>);
jest.mock('./Home', () => ({ HomeDashboard: () => <div>HOME_STUB</div> }));

const UTILISATEUR = { id: 'u1', email: 'alex@example.com' };

function mockConnecte({ isAdmin = false } = {}) {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { avatar_url: null, username: 'Alex', first_name: null, last_name: null, is_admin: isAdmin } }) }) }) };
    }
    if (table === 'saved_picks') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }) };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  supabase.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

test('onglet Analyses : controle segmente Matchs/Modeles, bascule sans changer de page, memorise le dernier choix', async () => {
  mockConnecte();
  render(<App />);

  await waitFor(() => expect(screen.getByLabelText('Analyses')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Analyses'));

  await waitFor(() => expect(screen.getByText('ANALYSES_MATCHS_STUB')).toBeInTheDocument());
  expect(screen.getByText('Games')).toBeInTheDocument();
  expect(screen.getByText('Models')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Models'));
  await waitFor(() => expect(screen.getByText('MODELES_STUB')).toBeInTheDocument());
  expect(screen.queryByText('ANALYSES_MATCHS_STUB')).not.toBeInTheDocument();
  // Toujours sur l'onglet Analyses (pas de changement de page) : la sidebar et son bouton
  // "Analyses" restent affiches, pas de retour a l'accueil.
  expect(screen.getByLabelText('Analyses')).toBeInTheDocument();

  expect(window.localStorage.getItem('betrics_stats_sous_onglet')).toBe('modeles');

  fireEvent.click(screen.getByText('Games'));
  await waitFor(() => expect(screen.getByText('ANALYSES_MATCHS_STUB')).toBeInTheDocument());
  expect(window.localStorage.getItem('betrics_stats_sous_onglet')).toBe('matchs');
});

test('?page=props (ancienne route Modeles, liens/signets existants) redirige vers Analyses > Modeles', async () => {
  mockConnecte();
  window.history.pushState({}, '', '/?page=props');
  render(<App />);

  await waitFor(() => expect(screen.getByText('MODELES_STUB')).toBeInTheDocument());
  expect(screen.queryByText('ANALYSES_MATCHS_STUB')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Analyses')).toBeInTheDocument(); // bien sur l'onglet Analyses, pas une page a part
});

test('le dernier onglet Matchs/Modeles choisi est memorise d\'une visite a l\'autre (localStorage)', async () => {
  window.localStorage.setItem('betrics_stats_sous_onglet', 'modeles');
  mockConnecte();
  render(<App />);

  await waitFor(() => expect(screen.getByLabelText('Analyses')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Analyses'));
  await waitFor(() => expect(screen.getByText('MODELES_STUB')).toBeInTheDocument());
});

test('plus d\'onglet "Models" dans la navigation principale (fusionne dans Analyses)', async () => {
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Analyses')).toBeInTheDocument());
  expect(screen.queryByLabelText('Models')).not.toBeInTheDocument();
});
