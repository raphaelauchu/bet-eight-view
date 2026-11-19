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
  useIsMobile: jest.fn(() => false),
}));
jest.mock('./Modeles', () => () => <div>MODELES_STUB</div>);
jest.mock('./Home', () => ({ HomeDashboard: () => <div>HOME_STUB</div> }));

const { useIsMobile } = require('./Analyses');

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
  useIsMobile.mockReturnValue(false); // repli deterministe (desktop) entre les tests
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

// ===================== Pool : icone etoile, position sous Analyses =====================

test('sidebar desktop : Pool utilise l\'icone etoile (ex-icone de Modeles), directement sous Analyses, avant Paris/Bankroll', async () => {
  mockConnecte();
  const { container } = render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Pool')).toBeInTheDocument());

  // Meme icone (chemin SVG) que l'ancienne icone de "Modeles" -- plus son ancienne icone
  // (rectangle + lignes "draft").
  const boutonPool = screen.getByLabelText('Pool');
  expect(boutonPool.querySelector('svg path[d^="M12 2.5"]')).toBeInTheDocument();
  expect(boutonPool.querySelector('svg rect')).not.toBeInTheDocument();

  // Ordre : Home, Search, Analyses, Pool, puis Bets, Bankroll, Settings (lang par defaut de
  // App() = 'en', voir les autres tests de ce fichier).
  const libelles = screen.getAllByRole('button').map(b => b.getAttribute('aria-label')).filter(Boolean).filter(l => l !== 'Betrics');
  expect(libelles).toEqual(['Home', 'Search', 'Analyses', 'Pool', 'Bets', 'Bankroll', 'Settings']);

  // Un seul separateur dans la sidebar, place juste avant Paris (donc apres Pool, pas apres
  // Analyses) : aucun separateur entre Analyses et Pool.
  const separateur = container.querySelector('div[style*="width: 28px"]');
  expect(separateur).toBeInTheDocument();
  // eslint-disable-next-line no-bitwise
  expect(boutonPool.compareDocumentPosition(separateur) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // eslint-disable-next-line no-bitwise
  expect(separateur.compareDocumentPosition(screen.getByLabelText('Bets')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('bottom nav mobile : Pool utilise la meme icone etoile, en 4e position (Home/Search/Analyses/Pool)', async () => {
  useIsMobile.mockReturnValue(true);
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Pool')).toBeInTheDocument());

  const libelles = screen.getAllByRole('button').map(b => b.getAttribute('aria-label')).filter(l => ['Home', 'Search', 'Analyses', 'Pool'].includes(l));
  expect(libelles).toEqual(['Home', 'Search', 'Analyses', 'Pool']);

  const boutonPool = screen.getByLabelText('Pool');
  expect(boutonPool.querySelector('svg path[d^="M12 2.5"]')).toBeInTheDocument();

  // La feuille "..." mobile ne liste plus que Bets/Bankroll (Pool n'y est plus).
  fireEvent.click(screen.getByLabelText('More'));
  expect(screen.getByText('Bets')).toBeInTheDocument();
  expect(screen.getByText('Bankroll')).toBeInTheDocument();
});
