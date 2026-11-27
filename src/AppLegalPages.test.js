import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// ===================== Pages legales : routes publiques + historique (src/App.js, refonte du 27 ===
// nov 2026) -- integration a travers App() en entier, meme technique que
// src/AppOnboarding.test.js/src/AppAuthHistory.test.js. Verifie : chargement direct par URL (sans
// connexion, sans redirection vers l'accueil), titre de page correct FR/EN, bouton retour du
// navigateur, et que les liens du pied de page/de l'ecran d'auth/de l'onboarding menent aux bonnes
// adresses.
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

test.each([
  ['/confidentialite', 'Politique de confidentialité — Betrics'],
  ['/conditions', 'Conditions d\'utilisation — Betrics'],
  ['/privacy', 'Privacy policy — Betrics'],
  ['/terms', 'Terms of use — Betrics'],
])('chargement direct de %s : contenu affiche sans connexion, aucune redirection vers l\'accueil, titre "%s"', async (path, titreAttendu) => {
  mockSupabaseAnonyme();
  window.history.pushState({}, '', path);
  render(<App />);
  await waitFor(() => expect(document.title).toBe(titreAttendu));
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  expect(screen.queryByText('Get started')).not.toBeInTheDocument();
  expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
});

test('bouton retour du navigateur depuis une page legale ouverte via le pied de page revient a l\'accueil', async () => {
  mockSupabaseAnonyme();
  render(<App />);
  await screen.findAllByText('Get started');
  fireEvent.click(screen.getByText('Terms of use'));
  await waitFor(() => expect(document.title).toBe('Terms of use — Betrics'));

  simulateBack();
  await waitFor(() => expect(screen.getAllByText('Get started').length).toBeGreaterThan(0));
});

test('lien "Retour à l\'accueil" sur la page legale ramene a l\'accueil (sans dependre de l\'historique reel)', async () => {
  mockSupabaseAnonyme();
  window.history.pushState({}, '', '/privacy');
  render(<App />);
  await screen.findByRole('heading', { level: 1 });
  fireEvent.click(screen.getByText('← Back to home'));
  await waitFor(() => expect(screen.getAllByText('Get started').length).toBeGreaterThan(0));
  expect(window.location.pathname).toBe('/');
});

test('ecran de connexion : les liens "Terms of use"/"Privacy policy" menent aux bonnes pages, et le retour revient a l\'ecran d\'auth', async () => {
  mockSupabaseAnonyme();
  render(<App />);
  const boutons = await screen.findAllByText('Sign in');
  fireEvent.click(boutons[0]);
  await screen.findByText('Sign in to continue.');

  fireEvent.click(screen.getByText('Privacy policy'));
  await waitFor(() => expect(document.title).toBe('Privacy policy — Betrics'));

  simulateBack();
  await screen.findByText('Sign in to continue.');
});

test('onboarding (etape 5) : les liens legaux menent aux bonnes pages', async () => {
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
  fireEvent.click(screen.getByText('Track my bets'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('4 OF 5');
  fireEvent.click(screen.getByText('Beginner'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('5 OF 5');

  fireEvent.click(screen.getByText('Terms of use'));
  await waitFor(() => expect(document.title).toBe('Terms of use — Betrics'));

  simulateBack();
  await screen.findByText('5 OF 5');
});
