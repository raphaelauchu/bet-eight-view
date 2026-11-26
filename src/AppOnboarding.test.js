import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { LOCAL_STORAGE_KEY } from './Onboarding';

// Test d'integration de l'onboarding (src/Onboarding.js, refonte du 26 nov 2026 -- les 5 etapes
// passent AVANT la creation de compte) a travers App() en entier -- meme technique que
// src/AppStatsNav.js (stubs d'AnalysesFlux/Modeles/HomeDashboard, voir ce fichier pour le detail).
//
// Gotcha : "Get started"/"Continue" peuvent exister ailleurs (landing publique, src/PublicSite.js)
// -- tous les tests attendent d'abord un texte UNIQUE a l'ecran vise (ex. "Where do you bet?")
// avant d'interagir, jamais un libelle generique partage.
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

const { useIsMobile } = require('./Analyses');

const UTILISATEUR = { id: 'u1', email: 'alex@example.com' };

// `connecteAuDepart` : simule soit un visiteur qui arrive deja connecte (rechargement de page,
// retour OAuth -- getSession() resout immediatement), soit un visiteur anonyme qui ne se connecte
// que plus tard dans le test (voir declencherConnexion ci-dessous, qui rejoue le callback
// onAuthStateChange -- JAMAIS une dependance a un quelconque etat React du composant Onboarding).
function mockSupabase({ onboardingCompleted = true, connecteAuDepart = true } = {}) {
  const accountInserts = [];
  const profileUpserts = [];
  let authStateCallback = null;

  supabase.auth.getSession.mockResolvedValue({ data: { session: connecteAuDepart ? { user: UTILISATEUR } : null } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockImplementation((cb) => {
    authStateCallback = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { avatar_url: null, username: 'Alex', first_name: null, last_name: null, is_admin: false, onboarding_completed: onboardingCompleted } }) }) }),
        upsert: (payload) => { profileUpserts.push(payload); return Promise.resolve({ error: null }); },
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

  return {
    accountInserts, profileUpserts,
    // Simule la connexion reussie APRES le montage (inscription + confirmation, ou connexion
    // d'un compte existant) -- rejoue exactement ce que fait l'abonnement reel d'App().
    declencherConnexion() { authStateCallback?.('SIGNED_IN', { user: UTILISATEUR }); },
  };
}

async function demarrerDepuisLaLanding() {
  fireEvent.click(await screen.findByText('Get started'));
  await screen.findByText('Where do you bet?');
}

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  window.history.pushState({}, '', '/');
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

test('utilisateur deja onboarde : le dashboard s\'affiche normalement, aucun onboarding', async () => {
  mockSupabase({ onboardingCompleted: true, connecteAuDepart: true });
  render(<App />);
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(screen.queryByText('Where do you bet?')).not.toBeInTheDocument();
});

test('carrousel desactive (ONBOARDING_INTRO_SLIDES_ENABLED=false) : "Get started" sur la landing mene directement a l\'etape 1, sans diapo', async () => {
  mockSupabase({ connecteAuDepart: false });
  render(<App />);
  await demarrerDepuisLaLanding();
  expect(screen.getByText('1 OF 5')).toBeInTheDocument();
  expect(screen.queryByText('Every bet,')).not.toBeInTheDocument(); // diapo du carrousel, jamais montee
});

test('visiteur non connecte : remplit les 5 etapes -> enchaine vers l\'inscription, reponses stockees en localStorage (pas d\'ecriture Supabase)', async () => {
  const mocks = mockSupabase({ connecteAuDepart: false });
  render(<App />);
  await demarrerDepuisLaLanding();

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
  fireEvent.click(screen.getByText('Google'));
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Create my account'));

  // Enchaine sur l'ecran d'inscription existant (src/Auth.js) -- jamais une ecriture Supabase.
  await waitFor(() => expect(screen.getByText('Create your free account')).toBeInTheDocument());
  expect(mocks.accountInserts.length).toBe(0);
  expect(mocks.profileUpserts.length).toBe(0);

  const stocke = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  expect(stocke).toMatchObject({ bookmakers: ['bet99'], betSize: 'under_100', goals: ['track'], experience: 'beginner', source: 'google', ageConfirmed: true });
});

test('premiere connexion apres inscription (reponses locales + utilisateur fraichement connecte) : cree les comptes a 0$ et marque l\'onboarding complete, puis vide le localStorage', async () => {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ bookmakers: ['bet99', 'mise_o_jeu'], betSize: 'under_100', goals: ['track'], experience: 'beginner', source: 'google', ageConfirmed: true }));
  const mocks = mockSupabase({ onboardingCompleted: false, connecteAuDepart: false });
  render(<App />);
  await waitFor(() => expect(screen.getByText('Get started')).toBeInTheDocument()); // encore anonyme

  mocks.declencherConnexion();

  await waitFor(() => expect(mocks.accountInserts.length).toBe(2));
  expect(mocks.accountInserts.map(a => a.kind).sort()).toEqual(['bet99', 'mise_o_jeu']);
  expect(mocks.accountInserts.every(a => a.user_id === 'u1')).toBe(true);
  await waitFor(() => expect(mocks.profileUpserts.length).toBe(1));
  expect(mocks.profileUpserts[0]).toMatchObject({ id: 'u1', onboarding_completed: true });
  expect(mocks.profileUpserts[0].onboarding_answers).toMatchObject({ bookmakers: ['bet99', 'mise_o_jeu'] });

  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull();
});

test('application des reponses apres un RECHARGEMENT COMPLET de page (utilisateur deja authentifie au montage, composant Onboarding jamais monte dans ce test)', async () => {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ bookmakers: ['bet365'], betSize: '100_500', goals: [], experience: 'intermediate', source: 'reddit', ageConfirmed: true }));
  const mocks = mockSupabase({ onboardingCompleted: false, connecteAuDepart: true }); // deja connecte des le depart, comme apres un rechargement
  render(<App />);

  await waitFor(() => expect(mocks.accountInserts.length).toBe(1));
  expect(mocks.accountInserts[0]).toMatchObject({ user_id: 'u1', kind: 'bet365' });
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull();
});

test('"Je n\'ai aucun compte" : aucun compte bankroll n\'est cree a l\'application des reponses', async () => {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ bookmakers: [], betSize: 'under_100', goals: [], experience: 'beginner', source: 'other', ageConfirmed: true }));
  const mocks = mockSupabase({ onboardingCompleted: false, connecteAuDepart: true });
  render(<App />);

  await waitFor(() => expect(mocks.profileUpserts.length).toBe(1));
  expect(mocks.accountInserts.length).toBe(0);
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
});

test('connexion d\'un compte EXISTANT (deja onboarde) avec des reponses locales perimees : les efface sans les appliquer', async () => {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ bookmakers: ['betway'], betSize: 'under_100', goals: [], experience: 'beginner', source: 'other', ageConfirmed: true }));
  const mocks = mockSupabase({ onboardingCompleted: true, connecteAuDepart: true }); // deja onboarde en base
  render(<App />);

  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(mocks.accountInserts.length).toBe(0); // jamais applique
  expect(mocks.profileUpserts.length).toBe(0); // deja complete, pas touche
  expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull(); // mais efface
});

test('etape 5 : "Create my account" reste desactive tant que la case 18+ ET une source ne sont pas toutes les deux remplies', async () => {
  mockSupabase({ connecteAuDepart: false });
  render(<App />);
  await demarrerDepuisLaLanding();
  fireEvent.click(screen.getByText('I don\'t have an account'));
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

  expect(screen.getByText('Create my account').closest('button')).toBeDisabled();
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  expect(screen.getByText('Create my account').closest('button')).toBeDisabled(); // case cochee seule : pas encore de source
  fireEvent.click(screen.getByText('Google'));
  expect(screen.getByText('Create my account').closest('button')).not.toBeDisabled();
});

test('MODE APERCU, visiteur NON connecte (?onboarding=preview) : fonctionne, pastille visible, AUCUNE ecriture', async () => {
  const mocks = mockSupabase({ connecteAuDepart: false });
  window.history.pushState({}, '', '/?onboarding=preview');
  render(<App />);

  await waitFor(() => expect(screen.getByText('Preview mode')).toBeInTheDocument());
  expect(screen.getByText('1 OF 5')).toBeInTheDocument(); // directement les etapes, carrousel desactive

  fireEvent.click(screen.getByText('I don\'t have an account'));
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

  await waitFor(() => expect(window.location.search).toBe(''));
  expect(mocks.accountInserts.length).toBe(0);
  expect(mocks.profileUpserts.length).toBe(0);
  expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull();
});

test('"Already have an account? Sign in" depuis les etapes vide les reponses locales et bascule vers la connexion', async () => {
  mockSupabase({ connecteAuDepart: false });
  render(<App />);
  await demarrerDepuisLaLanding();
  fireEvent.click(screen.getByText('BET99'));

  fireEvent.click(screen.getByText(/Already have an account/));
  await waitFor(() => expect(screen.getByText('Sign in to your account')).toBeInTheDocument());
  expect(window.localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull();
});

test('cas de secours : utilisateur deja connecte, onboarding non termine, AUCUNE reponse locale -> affiche les etapes apres connexion et ecrit directement', async () => {
  const mocks = mockSupabase({ onboardingCompleted: false, connecteAuDepart: true });
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 OF 5')).toBeInTheDocument());
  // Pas de lien "Already have an account" : l'utilisateur est deja connecte.
  expect(screen.queryByText(/Already have an account/)).not.toBeInTheDocument();

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

  await waitFor(() => expect(mocks.accountInserts.length).toBe(1));
  expect(mocks.accountInserts[0]).toMatchObject({ user_id: 'u1', kind: 'bet99' });
  await waitFor(() => expect(mocks.profileUpserts.length).toBe(1));
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
});
