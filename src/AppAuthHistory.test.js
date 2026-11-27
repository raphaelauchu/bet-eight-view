import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// ===================== Bouton retour du navigateur : auth + onboarding (refonte du 27 nov 2026) ===
// Integration a travers App() en entier -- meme technique que src/AppOnboarding.test.js (stubs
// d'AnalysesFlux/Modeles/HomeDashboard). Chaque OUVERTURE/AVANCEE pousse sa propre entree
// d'historique (voir src/App.js:openAuth/openOnboardingStep1/goToOnboardingStep) -- le bouton
// retour doit systematiquement revenir a l'ecran precedent. `simulateBack()` : history.back() met
// a jour window.location de maniere synchrone dans jsdom, mais l'evenement popstate lui-meme est
// mis en file (comme dans un vrai navigateur) -- on le declenche nous-memes immediatement pour ne
// pas dependre du minutage interne de jsdom.
jest.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() },
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
jest.mock('./Home', () => ({
  HomeDashboard: () => <div>HOME_STUB</div>,
  readHideAmounts: () => false,
  writeHideAmounts: () => {},
  MaskedDots: () => null,
}));

function simulateBack() {
  window.history.back();
  fireEvent(window, new PopStateEvent('popstate'));
}

function mockSupabaseAnonyme() {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
  supabase.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  supabase.from.mockImplementation(() => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }));
  supabase.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

test('ouvrir "Se connecter" puis retour du navigateur = accueil', async () => {
  mockSupabaseAnonyme();
  render(<App />);

  const boutons = await screen.findAllByText('Sign in');
  fireEvent.click(boutons[0]);
  await screen.findByText('Sign in to continue.');
  expect(window.location.search).toBe('?auth=signin');

  simulateBack();
  await waitFor(() => expect(screen.queryByText('Sign in to continue.')).not.toBeInTheDocument());
  expect(await screen.findAllByText('Get started')).not.toHaveLength(0);
  expect(window.location.search).toBe('');
});

test('ouvrir inscription, avancer de 3 etapes, retour trois fois = accueil', async () => {
  mockSupabaseAnonyme();
  render(<App />);

  const boutons = await screen.findAllByText('Get started');
  fireEvent.click(boutons[0]);
  await screen.findByText('1 OF 5');
  expect(window.location.search).toBe('?onboarding=1&step=1');

  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('2 OF 5');
  expect(window.location.search).toBe('?onboarding=1&step=2');

  fireEvent.click(screen.getByText('Under $100'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('3 OF 5');
  expect(window.location.search).toBe('?onboarding=1&step=3');

  // 3 avancees poussees (step1, step2, step3) -- 3 retours doivent repasser par step2, step1, puis
  // atterrir sur l'accueil.
  simulateBack();
  await screen.findByText('2 OF 5');
  simulateBack();
  await screen.findByText('1 OF 5');
  simulateBack();
  await waitFor(() => expect(screen.queryByText('1 OF 5')).not.toBeInTheDocument());
  expect(await screen.findAllByText('Get started')).not.toHaveLength(0);
  expect(window.location.search).toBe('');
});

test('rechargement de page sur une etape (?onboarding=1&step=3) : retombe directement sur cette etape', async () => {
  mockSupabaseAnonyme();
  window.history.pushState({}, '', '/?onboarding=1&step=3');
  render(<App />);
  await screen.findByText('3 OF 5');
});

test('etape 1 : nouvelle fleche retour "accueil" (showBackAtStep1) ramene a l\'accueil', async () => {
  mockSupabaseAnonyme();
  render(<App />);
  const boutons = await screen.findAllByText('Get started');
  fireEvent.click(boutons[0]);
  await screen.findByText('1 OF 5');

  fireEvent.click(screen.getByLabelText('Back to home'));
  await waitFor(() => expect(screen.queryByText('1 OF 5')).not.toBeInTheDocument());
  expect(await screen.findAllByText('Get started')).not.toHaveLength(0);
  expect(window.location.search).toBe('');
});

test('depuis l\'etape 3, la fleche retour standard recule d\'une etape (history.back) en conservant les reponses', async () => {
  mockSupabaseAnonyme();
  render(<App />);
  const boutons = await screen.findAllByText('Get started');
  fireEvent.click(boutons[0]);
  await screen.findByText('1 OF 5');
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('2 OF 5');
  fireEvent.click(screen.getByText('Under $100'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('3 OF 5');

  fireEvent.click(screen.getByLabelText('Back'));
  await screen.findByText('2 OF 5');
  expect(window.location.search).toBe('?onboarding=1&step=2');
});

test('mode apercu (?onboarding=preview) : toujours inchange, aucune interaction avec l\'historique auth/onboarding', async () => {
  mockSupabaseAnonyme();
  window.history.pushState({}, '', '/?onboarding=preview');
  render(<App />);
  await waitFor(() => expect(screen.getByText('Preview mode')).toBeInTheDocument());
  expect(screen.getByText('1 OF 5')).toBeInTheDocument();
  // Pas de fleche retour a l'etape 1 en mode apercu (onBackToHome non branche ici, inchange).
  expect(screen.queryByLabelText('Back to home')).not.toBeInTheDocument();
});
