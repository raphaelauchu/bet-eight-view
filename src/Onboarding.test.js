import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingFlow, readLocalOnboardingAnswers, saveLocalOnboardingAnswers, clearLocalOnboardingAnswers, LOCAL_STORAGE_KEY } from './Onboarding';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
const { supabase } = require('./supabase');

const UTILISATEUR = { id: 'u1' };
const noop = () => {};

function mockEcriture() {
  const accountInserts = [];
  const profileUpserts = [];
  supabase.from.mockImplementation((table) => {
    if (table === 'bankroll_accounts') {
      return { insert: (payload) => { accountInserts.push(payload); return Promise.resolve({ error: null }); } };
    }
    if (table === 'profiles') {
      return { upsert: (payload) => { profileUpserts.push(payload); return Promise.resolve({ error: null }); } };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  return { accountInserts, profileUpserts };
}

beforeEach(() => {
  jest.clearAllMocks();
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

// Carrousel desactive par defaut (ONBOARDING_INTRO_SLIDES_ENABLED=false, voir
// src/onboardingConfig.js) : les etapes s'affichent directement, sans diapo.
test('le carrousel est desactive par defaut : l\'etape 1 s\'affiche directement, pas de diapo', () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  expect(screen.getByText('Where do you bet?')).toBeInTheDocument();
  expect(screen.queryByText('Every bet,')).not.toBeInTheDocument();
  expect(screen.queryByText('Skip')).not.toBeInTheDocument();
});

test('etape 1 : aucun bouton retour ; grille de bookmakers (dont Mise-o-jeu+ et Other), choix multiple', () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  expect(screen.queryByLabelText('Back')).not.toBeInTheDocument();
  expect(screen.getByText('Mise-o-jeu+')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Other/ })).toBeInTheDocument(); // "Other" existe aussi dans le select de region (CA-OTHER)
  expect(screen.getByText('BET99').closest('button')).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Betway'));
  expect(screen.getByText('BET99').closest('button')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Betway').closest('button')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByText('BET99')); // deselection
  expect(screen.getByText('BET99').closest('button')).toHaveAttribute('aria-pressed', 'false');
});

test('etape 1 : la recherche filtre la grille', () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  fireEvent.change(screen.getByPlaceholderText('Search a sportsbook'), { target: { value: 'bet99' } });
  expect(screen.getByText('BET99')).toBeInTheDocument();
  expect(screen.queryByText('Betway')).not.toBeInTheDocument();
});

test('etape 1 : Continue desactive sans selection, le lien "I don\'t have an account" saute l\'exigence', async () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  expect(screen.getByText('Continue').closest('button')).toBeDisabled();

  fireEvent.click(screen.getByText('I don\'t have an account'));
  await waitFor(() => expect(screen.getByText('How much can you put in play?')).toBeInTheDocument());
  expect(screen.getByText('2 OF 5')).toBeInTheDocument();
});

test('etape 2 : 4 tranches de mise, choix unique, requis pour continuer -- ne cree aucun depot', async () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much can you put in play?');

  expect(screen.getByText('Continue').closest('button')).toBeDisabled();
  expect(screen.getByText('Just getting started')).toBeInTheDocument();
  expect(screen.getByText('High volume')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument(); // plus de champ montant

  fireEvent.click(screen.getByText('$100 – $500'));
  expect(screen.getByText('$100 – $500').closest('button')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Continue').closest('button')).not.toBeDisabled();

  fireEvent.click(screen.getByText('$2,000 and up'));
  expect(screen.getByText('$100 – $500').closest('button')).toHaveAttribute('aria-pressed', 'false');
});

test('etape 3 : choix multiple requis pour continuer, coche visible', async () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much can you put in play?');
  fireEvent.click(screen.getByText('Under $100'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');

  expect(screen.getByText('Continue').closest('button')).toBeDisabled();
  fireEvent.click(screen.getByText('Track my bets'));
  fireEvent.click(screen.getByText('Play in a pool'));
  expect(screen.getByText('Continue').closest('button')).not.toBeDisabled();
  expect(screen.getByText('Track my bets').closest('button')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Choose better bets').closest('button')).toHaveAttribute('aria-pressed', 'false');
});

test('etape 4 : choix unique avec sous-libelle, requis pour continuer', async () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much can you put in play?');
  fireEvent.click(screen.getByText('Under $100'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Track my bets'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What\'s your experience level?');

  expect(screen.getByText('Continue').closest('button')).toBeDisabled();
  expect(screen.getByText('I analyze odds and stats')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Advanced'));
  expect(screen.getByText('Continue').closest('button')).not.toBeDisabled();
});

async function allerAEtape5() {
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await completerDe2a5();
}

// A utiliser quand l'etape 1 a deja ete remplie manuellement (bookmaker choisi) par le test --
// continue juste a partir de l'etape 2, sans toucher a la selection de l'etape 1.
async function completerDe2a5() {
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
}

test('etape 5 : grille de sources (2 colonnes), separateur "Optional", champ texte, case 18+', async () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  await allerAEtape5();

  expect(screen.getByText('Optional')).toBeInTheDocument();
  expect(screen.getByText('Reddit')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Tell us in a few words...')).toBeInTheDocument();
  expect(screen.getByText(/1-800-461-0140/)).toBeInTheDocument(); // mention jeu responsable, memes coordonnees que le pied de page public (EN)

  expect(screen.getByText('Create my account').closest('button')).toBeDisabled();
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  expect(screen.getByText('Create my account').closest('button')).toBeDisabled(); // case seule : pas encore de source
  fireEvent.click(screen.getByText('X / Twitter'));
  expect(screen.getByText('Create my account').closest('button')).not.toBeDisabled();
});

test('retour en arriere : conserve les reponses deja saisies (bookmaker, tranche)', async () => {
  mockEcriture();
  render(<OnboardingFlow lang="en" onComplete={noop} />);
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How much can you put in play?');
  fireEvent.click(screen.getByText('Under $100'));

  fireEvent.click(screen.getByLabelText('Back'));
  await screen.findByText('Where do you bet?');
  expect(screen.getByText('BET99').closest('button')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How much can you put in play?');
  expect(screen.getByText('Under $100').closest('button')).toHaveAttribute('aria-pressed', 'true');
});

test('visiteur non connecte (pas d\'utilisateur) : "Create my account" ecrit dans localStorage, AUCUN appel Supabase', async () => {
  const mocks = mockEcriture();
  const onComplete = jest.fn();
  render(<OnboardingFlow lang="en" onComplete={onComplete} />);
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await completerDe2a5();
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Google'));
  fireEvent.click(screen.getByText('Create my account'));

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(mocks.accountInserts.length).toBe(0);
  expect(mocks.profileUpserts.length).toBe(0);
  expect(supabase.from).not.toHaveBeenCalled();
  const stocke = readLocalOnboardingAnswers();
  expect(stocke).toMatchObject({ bookmakers: ['bet99'], ageConfirmed: true, source: 'google' });
});

test('mode apercu : aucune ecriture Supabase NI localStorage, onComplete est quand meme appele avec les reponses', async () => {
  const mocks = mockEcriture();
  const onComplete = jest.fn();
  render(<OnboardingFlow lang="en" previewMode onComplete={onComplete} />);
  expect(screen.getByText('Preview mode')).toBeInTheDocument();

  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await completerDe2a5();
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Google'));
  fireEvent.click(screen.getByText('Create my account'));

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(onComplete.mock.calls[0][0]).toMatchObject({ bookmakers: ['bet99'] });
  expect(mocks.accountInserts.length).toBe(0);
  expect(mocks.profileUpserts.length).toBe(0);
  expect(readLocalOnboardingAnswers()).toBeNull();
});

test('chemin de repli (utilisateur deja connecte) : "Create my account" cree un compte PAR bookmaker a 0$, aucun depot', async () => {
  const mocks = mockEcriture();
  const onComplete = jest.fn();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={onComplete} />);
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Betway'));
  fireEvent.click(screen.getByText('Continue'));
  await completerDe2a5();
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Google'));
  fireEvent.click(screen.getByText('Create my account'));

  await waitFor(() => expect(mocks.accountInserts.length).toBe(2));
  expect(mocks.accountInserts.map(a => a.kind).sort()).toEqual(['bet99', 'betway']);
  expect(mocks.accountInserts.every(a => a.user_id === 'u1')).toBe(true);
  await waitFor(() => expect(mocks.profileUpserts.length).toBe(1));
  expect(mocks.profileUpserts[0]).toMatchObject({ id: 'u1', onboarding_completed: true });
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
});

describe('helpers localStorage (cle versionnee, try/catch)', () => {
  test('save/read/clear round-trip', () => {
    expect(readLocalOnboardingAnswers()).toBeNull();
    saveLocalOnboardingAnswers({ bookmakers: ['bet99'] });
    expect(readLocalOnboardingAnswers()).toEqual({ bookmakers: ['bet99'] });
    clearLocalOnboardingAnswers();
    expect(readLocalOnboardingAnswers()).toBeNull();
  });

  test('JSON corrompu -> null, jamais une exception', () => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, '{not json');
    expect(readLocalOnboardingAnswers()).toBeNull();
  });

  test('localStorage indisponible -> aucune exception (try/catch)', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', { value: { getItem() { throw new Error('indisponible'); }, setItem() { throw new Error('indisponible'); }, removeItem() { throw new Error('indisponible'); } }, configurable: true });
    expect(() => saveLocalOnboardingAnswers({ a: 1 })).not.toThrow();
    expect(readLocalOnboardingAnswers()).toBeNull();
    expect(() => clearLocalOnboardingAnswers()).not.toThrow();
    Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
  });
});
