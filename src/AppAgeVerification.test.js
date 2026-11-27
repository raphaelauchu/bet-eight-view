import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// ===================== Verification de l'age -- integration via App()/ProfileSetup ===============
// Un utilisateur sous l'age minimum de sa region ne doit JAMAIS pouvoir enregistrer son profil,
// jamais atteindre l'onboarding ni l'app -- voir src/profileConfig.js pour le calcul pur
// (profileConfig.test.js) et supabase/migrations/20261127_3_delete_account.sql pour le filet de
// securite cote base de donnees (plancher absolu de 18 ans). Meme technique que
// src/AppProfileSetup.test.js.
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

const UTILISATEUR = { id: 'u1', email: 'alex@example.com', user_metadata: { given_name: 'Alex', family_name: 'Tremblay' } };

function mockSupabase() {
  const upserts = [];
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  supabase.rpc.mockResolvedValue({ data: true, error: null });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        upsert: (payload) => { upserts.push(payload); return Promise.resolve({ error: null }); },
      };
    }
    if (table === 'saved_picks') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }) };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  supabase.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) });
  return { upserts };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

function remplirChampsCommuns(regionCode) {
  fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: 'nouvelalex' } });
  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: regionCode } });
  fireEvent.click(screen.getByRole('checkbox'));
}

test('17 ans au Quebec (minimum 18) : bouton bloque, message poli, AUCUN appel d\'ecriture, jamais l\'onboarding ni l\'app', async () => {
  const mocks = mockSupabase();
  render(<App />);
  await screen.findByText('Complete your profile');

  remplirChampsCommuns('QC');
  await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument(), { timeout: 2000 });
  const anneeMineure = new Date().getFullYear() - 17;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeMineure}-06-15` } });

  await waitFor(() => expect(screen.getByText('You must be at least 18 to use Betrics in your region.')).toBeInTheDocument());
  const bouton = screen.getByText('Create my profile').closest('button');
  expect(bouton).toBeDisabled();

  fireEvent.click(bouton); // meme un clic force (desactive) ne doit rien declencher
  await new Promise(r => setTimeout(r, 50));
  // Aucune ECRITURE (upsert du profil) -- is_username_available (lecture seule, verification de
  // disponibilite) a bien ete appelee plus haut, ce n'est pas une ecriture de donnees.
  expect(mocks.upserts.length).toBe(0);
  expect(supabase.rpc).not.toHaveBeenCalledWith('delete_my_account');
  expect(screen.queryByText('1 OF 5')).not.toBeInTheDocument();
  expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
  expect(screen.getByText('Complete your profile')).toBeInTheDocument();
});

test('18 ans au Quebec (minimum 18) : passe, aucun blocage', async () => {
  mockSupabase();
  render(<App />);
  await screen.findByText('Complete your profile');

  remplirChampsCommuns('QC');
  await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument(), { timeout: 2000 });
  const anneeMajeure = new Date().getFullYear() - 18;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeMajeure}-06-15` } });

  expect(screen.queryByText(/must be at least/)).not.toBeInTheDocument();
  const bouton = screen.getByText('Create my profile').closest('button');
  await waitFor(() => expect(bouton).not.toBeDisabled());
});

test('18 ans en Ontario (minimum 19) : bloque, meme age que le cas Quebec reussi juste au-dessus', async () => {
  mockSupabase();
  render(<App />);
  await screen.findByText('Complete your profile');

  remplirChampsCommuns('ON');
  await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument(), { timeout: 2000 });
  const anneeMajeureQC = new Date().getFullYear() - 18;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeMajeureQC}-06-15` } });

  await waitFor(() => expect(screen.getByText('You must be at least 19 to use Betrics in your region.')).toBeInTheDocument());
  expect(screen.getByText('Create my profile').closest('button')).toBeDisabled();
});
