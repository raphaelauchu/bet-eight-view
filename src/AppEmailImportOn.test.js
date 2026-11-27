import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// ===================== Bloc "My Bookmakers" : EMAIL_IMPORT_ENABLED=true (reactivation) ==========
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : confirme que repasser le drapeau a `true` (src/
// emailImportConfig.js) reaffiche integralement le bloc, sans rien reecrire -- voir
// src/AppDeleteAccount.test.js pour le comportement par defaut (drapeau a false, bloc absent).
jest.mock('./emailImportConfig', () => ({ EMAIL_IMPORT_ENABLED: true }));
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

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/?page=profile');
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
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
});

test('EMAIL_IMPORT_ENABLED=true : le bloc "My Bookmakers" reapparait integralement (Gmail/Outlook, parsing, liste de bookmakers)', async () => {
  render(<App />);
  await screen.findByText('My Bookmakers');
  expect(screen.getByText('Connect your Gmail to automatically import bets received by email.')).toBeInTheDocument();
  expect(screen.getByText('Connect Gmail')).toBeInTheDocument();
  expect(screen.getByText('Connect Outlook')).toBeInTheDocument();
  expect(screen.getByText('Automatic Parsing')).toBeInTheDocument();
  expect(screen.getByText('Bet99')).toBeInTheDocument();
});

test('EMAIL_IMPORT_ENABLED=true : le drapeau active aussi la lecture de user_email_connections', async () => {
  render(<App />);
  await screen.findByText('My Bookmakers');
  expect(supabase.from).toHaveBeenCalledWith('user_email_connections');
});
