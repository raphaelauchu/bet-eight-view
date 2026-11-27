import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Test d'integration leger de App() (seule fois dans ce projet qu'un test rend App() en entier
// -- rendu possible a cout raisonnable en remplacant AnalysesFlux/ModelesFlux/HomeDashboard par
// des stubs : leurs propres arbres de dependances (Analyses.js ~6800 lignes, appels reseau NHL,
// etc.) ne sont alors jamais evalues). Couvre specifiquement la fusion Modeles -> onglet
// "Matchs/Modeles" segmente dans Analyses et la redirection de l'ancienne route ?page=props.
jest.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));
const { supabase } = require('./supabase');

// Mock de requete chainable (select/eq/order/...) qui se resout en `result` -- meme pattern que
// Bankroll.test.js/Home.test.js -- pour que BankrollPage/BetsPage (rendues en entier quand on
// navigue vers "Bankroll"/"Bets" depuis le sheet "More", voir plus bas) ne plantent jamais sur un
// enchainement de methodes non mocke (ex. .eq().order()), meme si le resultat reste vide.
function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, neq: () => q, in: () => q, gt: () => q, gte: () => q, is: () => q,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

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
// BankrollPage/BetsPage (rendues en entier quand on navigue vers "Bankroll"/"Bets" depuis le
// sheet "More", voir plus bas) importent aussi readHideAmounts/writeHideAmounts/MaskedDots de ce
// module -- il faut les reexporter ici, sinon le mock de HomeDashboard les rend undefined.
jest.mock('./Home', () => ({
  HomeDashboard: () => <div>HOME_STUB</div>,
  readHideAmounts: () => false,
  writeHideAmounts: () => {},
  MaskedDots: () => null,
}));

const { useIsMobile } = require('./Analyses');

const UTILISATEUR = { id: 'u1', email: 'alex@example.com' };

function mockConnecte({ isAdmin = false } = {}) {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { avatar_url: null, username: 'Alex', first_name: null, last_name: null, is_admin: isAdmin, profile_completed_at: '2026-01-01T00:00:00.000Z' } }) }) }) };
    }
    if (table === 'saved_picks') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }) };
    }
    return mockQuery({ data: [], error: null });
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

  // La feuille "More" (dernier onglet de la bottom nav, icone hamburger -- ex-bouton "..." de
  // la top bar) ne liste plus que Bets/Bankroll (Pool n'y est plus).
  fireEvent.click(screen.getByLabelText('More'));
  expect(screen.getByText('Bets')).toBeInTheDocument();
  expect(screen.getByText('Bankroll')).toBeInTheDocument();
});

// ===================== Onglet "More" de la bottom nav mobile (ex-menu "..." de la top bar) =====

test('bottom nav mobile : "More" est le dernier onglet (icone hamburger), inactif tant qu\'aucune page du sheet n\'est affichee', async () => {
  useIsMobile.mockReturnValue(true);
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('More')).toBeInTheDocument());

  const libelles = screen.getAllByRole('button').map(b => b.getAttribute('aria-label')).filter(l => ['Home', 'Search', 'Analyses', 'Pool', 'More'].includes(l));
  expect(libelles).toEqual(['Home', 'Search', 'Analyses', 'Pool', 'More']);
  expect(screen.getByLabelText('More').querySelector('svg line')).toBeInTheDocument(); // icone hamburger (3 lignes), pas 3 points

  expect(screen.getByLabelText('Home')).toHaveAttribute('aria-current', 'page'); // page par defaut
  expect(screen.getByLabelText('More')).not.toHaveAttribute('aria-current');
});

test('bottom nav mobile : clic sur "More" ouvre un sheet (overlay + dialog), fermeture via le bouton X sans naviguer', async () => {
  useIsMobile.mockReturnValue(true);
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('More')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('More'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Bets')).toBeInTheDocument();
  expect(screen.getByText('Bankroll')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Fermer'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('More')).not.toHaveAttribute('aria-current'); // aucune navigation
  expect(screen.getByLabelText('Home')).toHaveAttribute('aria-current', 'page');
});

test('bottom nav mobile : clic sur "More" puis sur le fond (overlay) ferme le sheet sans naviguer', async () => {
  useIsMobile.mockReturnValue(true);
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('More')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('More'));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(dialog.parentElement); // le fond semi-transparent, pas le contenu du sheet

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('More')).not.toHaveAttribute('aria-current');
});

test('bottom nav mobile : clic sur "Bankroll" dans le sheet "More" navigue vers Bankroll, ferme le sheet et active "More"', async () => {
  useIsMobile.mockReturnValue(true);
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('More')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('More'));
  fireEvent.click(screen.getByText('Bankroll'));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // sheet ferme apres la navigation
  await waitFor(() => expect(screen.getByLabelText('More')).toHaveAttribute('aria-current', 'page'));
  expect(screen.getByLabelText('Home')).not.toHaveAttribute('aria-current');
});

test('bottom nav mobile : clic sur "Bets" dans le sheet "More" navigue vers Paris, ferme le sheet et active "More"', async () => {
  useIsMobile.mockReturnValue(true);
  mockConnecte();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('More')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('More'));
  fireEvent.click(screen.getByText('Bets'));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('More')).toHaveAttribute('aria-current', 'page'));
});
