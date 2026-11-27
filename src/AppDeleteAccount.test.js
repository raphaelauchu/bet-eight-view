import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// ===================== Suppression de compte -- integration via App() (Loi 25) =====================
// Bouton "Delete my account" dans ProfilePage (src/App.js, section "Danger zone") -> modale en 2
// temps (src/DeleteAccountModal.js) -> App.js:handleDeleteAccount (RPC delete_my_account,
// deconnexion, nettoyage localStorage). Meme technique que src/AppProfileSetup.test.js.
jest.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
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

const UTILISATEUR = { id: 'u1', email: 'alex@example.com', created_at: '2026-01-01T00:00:00.000Z' };

function mockSupabaseConnecte() {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { avatar_url: null, username: 'alex', first_name: 'Alex', last_name: 'T', is_admin: false, onboarding_completed: true, profile_completed_at: '2026-01-01T00:00:00.000Z', province: '' } }) }) }),
        upsert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === 'user_email_connections') {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
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
  window.history.pushState({}, '', '/?page=profile');
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

async function ouvrirModaleEtTaperDelete() {
  await screen.findByText('Danger zone');
  fireEvent.click(screen.getByText('Delete my account'));
  await screen.findByText('Delete your account?');
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
}

test('bouton "Delete my account" visible dans la page de profil ("Danger zone"), bloc "My Bookmakers" absent (EMAIL_IMPORT_ENABLED=false)', async () => {
  mockSupabaseConnecte();
  render(<App />);
  await screen.findByText('Danger zone');
  expect(screen.getByText('Delete my account')).toBeInTheDocument();
  expect(screen.queryByText('My Bookmakers')).not.toBeInTheDocument();
  expect(screen.queryByText('Connect Gmail')).not.toBeInTheDocument();
});

test('le bouton final de la modale reste desactive jusqu\'a ce que "DELETE" soit tape exactement', async () => {
  mockSupabaseConnecte();
  render(<App />);
  await screen.findByText('Danger zone');
  fireEvent.click(screen.getByText('Delete my account'));
  await screen.findByText('Delete your account?');
  fireEvent.click(screen.getByText('Continue'));
  const bouton = screen.getByText('Permanently delete my account').closest('button');
  expect(bouton).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DEL' } });
  expect(bouton).toBeDisabled();
});

test('succes : appelle la RPC delete_my_account, deconnecte et nettoie le localStorage lie a Betrics', async () => {
  mockSupabaseConnecte();
  supabase.rpc.mockResolvedValue({ data: null, error: null });
  window.localStorage.setItem('betrics_onboarding_pending_v1', 'x');
  window.localStorage.setItem('betrics_stats_theme', 'dark');
  window.localStorage.setItem('unrelated_app_key', 'keep-me');
  render(<App />);
  await ouvrirModaleEtTaperDelete();

  fireEvent.click(screen.getByText('Permanently delete my account'));

  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('delete_my_account'));
  await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(1));
  expect(window.localStorage.getItem('betrics_onboarding_pending_v1')).toBeNull();
  expect(window.localStorage.getItem('betrics_stats_theme')).toBeNull();
  expect(window.localStorage.getItem('unrelated_app_key')).toBe('keep-me'); // ne nettoie que les cles betrics_*
});

test('echec : message d\'erreur clair affiche, AUCUNE deconnexion, possibilite de reessayer', async () => {
  mockSupabaseConnecte();
  supabase.rpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
  render(<App />);
  await ouvrirModaleEtTaperDelete();

  fireEvent.click(screen.getByText('Permanently delete my account'));

  await waitFor(() => expect(screen.getByText('Deletion failed. Please try again in a moment.')).toBeInTheDocument());
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  expect(screen.getByText('Try again')).toBeInTheDocument();
  // Toujours sur la page de profil, rien n'a deconnecte l'utilisateur.
  expect(screen.getByText('Danger zone')).toBeInTheDocument();
});

test('lien discret "Delete my account" accessible depuis ProfileSetup (profil incomplet)', async () => {
  window.history.pushState({}, '', '/');
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  supabase.rpc.mockResolvedValue({ data: true, error: null });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        upsert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === 'saved_picks') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }) };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  supabase.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) });

  render(<App />);
  await screen.findByText('Complete your profile');
  fireEvent.click(screen.getByText('Delete my account'));
  await screen.findByText('Delete your account?');
});
