import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Test d'integration de l'onboarding (src/Onboarding.js) a travers App() en entier -- meme
// technique que src/AppStatsNav.js (stubs d'AnalysesFlux/Modeles/HomeDashboard, voir ce fichier
// pour le detail). Couvre : affichage conditionne a onboarding_completed, navigation
// carrousel -> etapes -> creation des comptes bankroll, etape 1 sautee (compte "Other"), case
// 18+ obligatoire, et le MODE APERCU (?onboarding=preview, aucune ecriture).
//
// Gotcha : "Get started" existe AUSSI sur la landing page publique (src/PublicSite.js, affichee
// tant que supabase.auth.getSession() n'a pas resolu). Attendre ce texte en premier peut donc se
// resoudre par erreur sur la landing page encore affichee, avant meme la connexion -- tous les
// tests passent systematiquement par "Skip" (texte unique au carrousel) pour confirmer qu'on est
// bien dans l'onboarding avant d'interagir plus loin.
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

function mockConnecte({ onboardingCompleted = true } = {}) {
  const accountInserts = [];
  const txInserts = [];
  const profileUpserts = [];

  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: UTILISATEUR } } });
  supabase.auth.getUser.mockResolvedValue({ data: { user: UTILISATEUR } });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { avatar_url: null, username: 'Alex', first_name: null, last_name: null, is_admin: false, onboarding_completed: onboardingCompleted } }) }) }),
        upsert: (payload) => { profileUpserts.push(payload); return Promise.resolve({ error: null }); },
      };
    }
    if (table === 'bankroll_accounts') {
      return {
        insert: (payload) => {
          const row = { id: `acc-${accountInserts.length}`, ...payload };
          accountInserts.push(payload);
          return { select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) };
        },
      };
    }
    if (table === 'bankroll_transactions') {
      return { insert: (payload) => { txInserts.push(payload); return Promise.resolve({ error: null }); } };
    }
    if (table === 'saved_picks') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }) };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  supabase.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) });

  return { accountInserts, txInserts, profileUpserts };
}

// Quitte le carrousel vers l'etape 1 via "Skip" (texte unique, voir le commentaire de tete de
// fichier) -- equivalent fonctionnel de "Get started" pour la navigation, sans l'ambiguite.
async function allerAuxEtapes() {
  fireEvent.click(await screen.findByText('Skip'));
  await screen.findByText('Where do you bet?');
}

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  window.history.pushState({}, '', '/');
});

test('onboarding deja complete : le dashboard s\'affiche normalement, aucun carrousel', async () => {
  mockConnecte({ onboardingCompleted: true });
  render(<App />);
  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(screen.queryByText('Skip')).not.toBeInTheDocument();
});

test('onboarding non complete : le carrousel s\'affiche a la place du dashboard', async () => {
  mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await waitFor(() => expect(screen.getByText('Skip')).toBeInTheDocument());
  expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
  // Diapo 1 : titre en deux lignes.
  expect(screen.getByText('Every bet,')).toBeInTheDocument();
  expect(screen.getByText('always up to date')).toBeInTheDocument();
  expect(screen.getAllByText('Example').length).toBeGreaterThan(0);
});

test('carrousel : "Skip" mene directement a l\'etape 1 des etapes', async () => {
  mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await allerAuxEtapes();
  expect(screen.getByText('1 OF 5')).toBeInTheDocument();
});

test('etape 1 : aucun bouton retour ; Continue desactive tant qu\'aucun bookmaker n\'est choisi', async () => {
  mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await allerAuxEtapes();

  expect(screen.queryByLabelText('Back')).not.toBeInTheDocument();
  expect(screen.getByText('Continue').closest('button')).toBeDisabled();

  fireEvent.click(screen.getByText('BET99'));
  expect(screen.getByText('Continue').closest('button')).not.toBeDisabled();
});

test('etape 1 : "I don\'t have an account" saute l\'exigence et passe a l\'etape 2 (compte generique)', async () => {
  mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await allerAuxEtapes();

  fireEvent.click(screen.getByText('I don\'t have an account'));
  await waitFor(() => expect(screen.getByText('How much is in your bankroll?')).toBeInTheDocument());
  expect(screen.getByText('Account')).toBeInTheDocument(); // libelle generique, pas un bookmaker precis
  expect(screen.getByText('2 OF 5')).toBeInTheDocument();
  // Etape 2 : toujours possible de continuer a 0$.
  expect(screen.getByText('Continue').closest('button')).not.toBeDisabled();
  // Retour en arriere possible (etapes 1 a 4).
  fireEvent.click(screen.getByLabelText('Back'));
  await waitFor(() => expect(screen.getByText('Where do you bet?')).toBeInTheDocument());
});

test('etape 5 : "Finish" reste desactive tant que la case 18+ n\'est pas cochee', async () => {
  mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much is in your bankroll?');
  fireEvent.click(screen.getByText('Continue')); // etape 2 -> 3
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue')); // etape 3 -> 4
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Continue')); // etape 4 -> 5
  await screen.findByText('How did you hear about us?');

  expect(screen.getByText('Finish').closest('button')).toBeDisabled();
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  expect(screen.getByText('Finish').closest('button')).not.toBeDisabled();
});

test('flux complet (bookmaker choisi + montant) : cree le compte bankroll, le depot initial, marque l\'onboarding complete, puis affiche le dashboard', async () => {
  const mocks = mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await allerAuxEtapes();

  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue')); // -> etape 2
  await screen.findByText('How much is in your bankroll?');
  expect(screen.getByText('BET99')).toBeInTheDocument(); // libelle du bookmaker choisi, pas "Account"

  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '150' } });
  fireEvent.click(screen.getByText('Continue')); // -> etape 3
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue')); // -> etape 4
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Continue')); // -> etape 5
  await screen.findByText('How did you hear about us?');

  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Finish'));

  await waitFor(() => expect(mocks.accountInserts.length).toBe(1));
  expect(mocks.accountInserts[0]).toMatchObject({ user_id: 'u1', name: 'BET99', kind: 'bet99' });
  expect(mocks.txInserts.length).toBe(1);
  expect(mocks.txInserts[0]).toMatchObject({ user_id: 'u1', account_id: 'acc-0', type: 'deposit', amount: 150 });
  await waitFor(() => expect(mocks.profileUpserts.length).toBe(1));
  expect(mocks.profileUpserts[0]).toMatchObject({ id: 'u1', onboarding_completed: true });
  expect(mocks.profileUpserts[0].onboarding_answers).toMatchObject({ bookmakers: ['bet99'] });

  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
});

test('aucun bookmaker choisi (etape sautee) : cree un seul compte "Other" sans depot si aucun montant saisi', async () => {
  const mocks = mockConnecte({ onboardingCompleted: false });
  render(<App />);
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much is in your bankroll?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue')); // etape 3 -> 4
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Continue')); // etape 4 -> 5
  await screen.findByText('How did you hear about us?');
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Finish'));

  await waitFor(() => expect(mocks.accountInserts.length).toBe(1));
  expect(mocks.accountInserts[0]).toMatchObject({ user_id: 'u1', kind: 'other' });
  expect(mocks.txInserts.length).toBe(0); // aucun montant saisi -> pas de transaction
});

test('MODE APERCU (?onboarding=preview) : s\'affiche meme si deja complete, et ne fait AUCUNE ecriture a la fin', async () => {
  const mocks = mockConnecte({ onboardingCompleted: true });
  window.history.pushState({}, '', '/?onboarding=preview');
  render(<App />);

  await waitFor(() => expect(screen.getByText('Preview mode')).toBeInTheDocument());
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much is in your bankroll?');
  expect(screen.getByText('Preview mode')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '999' } });
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How did you hear about us?');

  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Finish'));

  await waitFor(() => expect(screen.getByText('HOME_STUB')).toBeInTheDocument());
  expect(mocks.accountInserts.length).toBe(0);
  expect(mocks.txInserts.length).toBe(0);
  expect(mocks.profileUpserts.length).toBe(0);
  expect(window.location.search).toBe(''); // ?onboarding=preview retire apres la fin de l'apercu
});
