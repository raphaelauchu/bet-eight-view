import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// ===================== Porte d'entree "Complete ton profil" -- integration via App() ===========
// Corrige le trou ou un compte Google arrivait directement dans l'app sans jamais remplir de
// profil ni repondre a l'onboarding (ceux-ci n'apparaissaient qu'a la reconnexion). Ordre fixe :
// profil -> onboarding -> app, identique pour Google et courriel (ce test simule Google via
// user_metadata.given_name/family_name, mais le code ne distingue pas la methode -- seule
// l'absence de ligne `profiles` compte). Meme technique que src/AppOnboarding.test.js.
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

// `profilesRow` : null tant qu'aucune ligne n'existe (compte Google tout neuf -- rien ne la cree
// automatiquement, voir le commentaire de profileCompleted dans src/App.js) -- l'upsert de
// ProfileSetup/OnboardingFlow la cree/la met a jour EN PLACE, pour que chargerProfil() (re-appele
// par ProfileSetup.onComplete) voie la version a jour au prochain SELECT, comme Supabase le
// ferait reellement.
function mockSupabase({ profilesRow = null, connecteAuDepart = true } = {}) {
  let row = profilesRow;
  const accountInserts = [];
  supabase.auth.getSession.mockResolvedValue({ data: { session: connecteAuDepart ? { user: UTILISATEUR } : null } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.rpc.mockResolvedValue({ data: true, error: null });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
        // Simule le defaut DB "onboarding_completed not null default false" d'une PREMIERE
        // insertion (row encore null) -- un upsert reel sur une ligne inexistante fait un INSERT,
        // jamais un simple merge partiel : les colonnes omises recoivent leur defaut de colonne,
        // pas `undefined`.
        upsert: (payload) => { const base = row || { onboarding_completed: false }; row = { ...base, ...payload }; return Promise.resolve({ error: null }); },
      };
    }
    if (table === 'bankroll_accounts') {
      return { insert: (payload) => { accountInserts.push(payload); return Promise.resolve({ error: null }); } };
    }
    if (table === 'saved_picks') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }) };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  supabase.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) });
  return { accountInserts, getRow: () => row };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

test('nouveau compte Google (aucune ligne profiles) : ProfileSetup s\'affiche avant tout, jamais l\'app directement', async () => {
  mockSupabase({ profilesRow: null });
  render(<App />);
  await screen.findByText('Complete your profile');
  expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
  expect(screen.queryByText('1 OF 5')).not.toBeInTheDocument();
});

test('ordre fixe : profil complete -> onboarding (encore incomplet) -> app, jamais dans un autre ordre', async () => {
  const mocks = mockSupabase({ profilesRow: null });
  render(<App />);
  await screen.findByText('Complete your profile');

  fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: 'nouvelalex' } });
  await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument(), { timeout: 2000 });
  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: 'ON' } });
  const anneeAdulte = new Date().getFullYear() - 30;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeAdulte}-06-15` } });
  fireEvent.click(screen.getByRole('checkbox'));
  const bouton = screen.getByText('Create my profile').closest('button');
  await waitFor(() => expect(bouton).not.toBeDisabled());
  fireEvent.click(bouton);

  // Le profil est maintenant complete (profile_completed_at renseigne) -- enchaine directement
  // sur l'onboarding des 5 etapes (onboarding_completed=false par defaut pour cette ligne neuve),
  // jamais directement sur l'app.
  await screen.findByText('1 OF 5');
  expect(mocks.getRow().profile_completed_at).toBeTruthy();
  expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();

  // Termine l'onboarding -> atterrit enfin sur l'app.
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How much can you put in play?');
  fireEvent.click(screen.getByText('Under $100'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Track my bets'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Beginner'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How did you hear about us?');
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Google'));
  fireEvent.click(screen.getByText('Create my account'));

  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
});

test('compte deja complete (profil ET onboarding) : va directement a l\'app, sans flash de ProfileSetup/onboarding', async () => {
  mockSupabase({ profilesRow: { profile_completed_at: '2026-01-01T00:00:00.000Z', onboarding_completed: true, username: 'alex' } });
  render(<App />);
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(screen.queryByText('Complete your profile')).not.toBeInTheDocument();
  expect(screen.queryByText('1 OF 5')).not.toBeInTheDocument();
});

test('compte legacy : onboarding deja complete mais profil jamais rempli -> ProfileSetup seul, puis app (onboarding saute)', async () => {
  mockSupabase({ profilesRow: { profile_completed_at: null, onboarding_completed: true, username: 'alex' } });
  render(<App />);
  await screen.findByText('Complete your profile');

  fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: 'alex' } });
  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: 'QC' } });
  const anneeAdulte = new Date().getFullYear() - 30;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeAdulte}-06-15` } });
  fireEvent.click(screen.getByRole('checkbox'));
  // Nom d'utilisateur inchange (deja le sien) -> immediatement "Available", pas de blocage.
  await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument());
  const bouton = screen.getByText('Create my profile').closest('button');
  await waitFor(() => expect(bouton).not.toBeDisabled());
  fireEvent.click(bouton);

  // Onboarding deja complete -> saute directement a l'app, jamais les 5 etapes.
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(screen.queryByText('1 OF 5')).not.toBeInTheDocument();
});

test('aucun flash de l\'app pendant le chargement initial (ecran neutre tant que le statut n\'est pas connu)', async () => {
  mockSupabase({ profilesRow: { profile_completed_at: '2026-01-01T00:00:00.000Z', onboarding_completed: true } });
  render(<App />);
  // Avant meme la resolution des promesses mockees, rien de connecte/dashboard ne doit transparaitre.
  expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
  expect(screen.queryByText('Complete your profile')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
});

test('deconnexion depuis ProfileSetup : fonctionne (lien discret "Sign out")', async () => {
  mockSupabase({ profilesRow: null });
  render(<App />);
  await screen.findByText('Complete your profile');
  fireEvent.click(screen.getByText('Sign out'));
  await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(1));
});

test('reponses d\'onboarding pre-compte en localStorage : toujours appliquees apres avoir complete le profil', async () => {
  window.localStorage.setItem('betrics_onboarding_pending_v1', JSON.stringify({ bookmakers: ['bet99'], betSize: 'under_100', goals: ['track'], experience: 'beginner', source: 'google', ageConfirmed: true }));
  const mocks = mockSupabase({ profilesRow: null });
  render(<App />);
  await screen.findByText('Complete your profile');

  fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: 'nouvelalex' } });
  await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument(), { timeout: 2000 });
  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: 'ON' } });
  const anneeAdulte = new Date().getFullYear() - 30;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeAdulte}-06-15` } });
  fireEvent.click(screen.getByRole('checkbox'));
  const bouton = screen.getByText('Create my profile').closest('button');
  await waitFor(() => expect(bouton).not.toBeDisabled());
  fireEvent.click(bouton);

  // Les reponses locales (bet99) sont appliquees automatiquement une fois le profil complete --
  // atterrit directement sur l'app (onboarding deja marque complete par cette application), sans
  // jamais afficher les 5 etapes.
  await waitFor(() => expect(mocks.accountInserts.length).toBe(1));
  expect(mocks.accountInserts[0]).toMatchObject({ user_id: 'u1', kind: 'bet99' });
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(window.localStorage.getItem('betrics_onboarding_pending_v1')).toBeNull();
});
