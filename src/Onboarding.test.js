import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingFlow } from './Onboarding';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
const { supabase } = require('./supabase');

const UTILISATEUR = { id: 'u1' };
const noop = () => {};

function mockEcriture() {
  const accountInserts = [];
  const txInserts = [];
  const profileUpserts = [];
  supabase.from.mockImplementation((table) => {
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
    if (table === 'profiles') {
      return { upsert: (payload) => { profileUpserts.push(payload); return Promise.resolve({ error: null }); } };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  return { accountInserts, txInserts, profileUpserts };
}

beforeEach(() => jest.clearAllMocks());

async function allerAuxEtapes() {
  fireEvent.click(await screen.findByText('Skip'));
  await screen.findByText('Where do you bet?');
}

test('carrousel : 3 points de pagination, le point actif change au clic', () => {
  mockEcriture();
  const { container } = render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  const points = container.querySelectorAll('[aria-label="1"], [aria-label="2"], [aria-label="3"]');
  expect(points.length).toBe(3);
  expect(points[0]).toHaveAttribute('aria-current', 'true');

  fireEvent.click(points[2]);
  expect(screen.getByText('Play in a pool')).toBeInTheDocument();
  expect(points[2]).toHaveAttribute('aria-current', 'true');
  expect(points[0]).not.toHaveAttribute('aria-current');
});

test('carrousel : balayage tactile (swipe) avance/recule d\'une diapo', () => {
  mockEcriture();
  const { container } = render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  const zone = container.querySelector('[role="group"]');
  expect(screen.getByText('Every bet,')).toBeInTheDocument();

  fireEvent.touchStart(zone, { touches: [{ clientX: 300 }] });
  fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 100 }] }); // glisse vers la gauche -> diapo suivante
  expect(screen.getByText('The NHL stats')).toBeInTheDocument();

  fireEvent.touchStart(zone, { touches: [{ clientX: 100 }] });
  fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 300 }] }); // glisse vers la droite -> diapo precedente
  expect(screen.getByText('Every bet,')).toBeInTheDocument();
});

test('carrousel : "Get started" mene aussi directement a l\'etape 1', async () => {
  mockEcriture();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  fireEvent.click(screen.getByText('Get started'));
  await waitFor(() => expect(screen.getByText('Where do you bet?')).toBeInTheDocument());
});

test('etape 3 : choix multiple -- plusieurs objectifs peuvent etre selectionnes et deselectionnes', async () => {
  mockEcriture();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much is in your bankroll?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');

  const track = screen.getByText('Track my bets').closest('button');
  const pool = screen.getByText('Play in a pool').closest('button');
  expect(track).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(track);
  fireEvent.click(pool);
  expect(track).toHaveAttribute('aria-pressed', 'true');
  expect(pool).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(track); // deselection
  expect(track).toHaveAttribute('aria-pressed', 'false');
  expect(pool).toHaveAttribute('aria-pressed', 'true');
});

test('etape 4 : choix unique -- selectionner une experience deselectionne les autres', async () => {
  mockEcriture();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('I don\'t have an account'));
  await screen.findByText('How much is in your bankroll?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What\'s your experience level?');

  fireEvent.click(screen.getByText('Beginner'));
  expect(screen.getByText('Beginner').closest('button')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByText('Advanced'));
  expect(screen.getByText('Advanced').closest('button')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Beginner').closest('button')).toHaveAttribute('aria-pressed', 'false');
});

test('navigation arriere : revenir a l\'etape 1 conserve les bookmakers deja coches', async () => {
  mockEcriture();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How much is in your bankroll?');

  fireEvent.click(screen.getByLabelText('Back'));
  await screen.findByText('Where do you bet?');
  expect(screen.getByText('BET99').closest('button')).toHaveAttribute('aria-pressed', 'true');
});

test('creation des comptes : un compte par bookmaker choisi, depot uniquement si un montant est saisi', async () => {
  const mocks = mockEcriture();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" onComplete={noop} />);
  await allerAuxEtapes();
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Betway'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How much is in your bankroll?');

  const inputs = screen.getAllByPlaceholderText('0.00');
  expect(inputs.length).toBe(2);
  fireEvent.change(inputs[0], { target: { value: '200' } }); // BET99 : avec montant
  // Betway reste a 0 (pas de depot pour ce compte)

  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How did you hear about us?');
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Finish'));

  await waitFor(() => expect(mocks.accountInserts.length).toBe(2));
  expect(mocks.accountInserts.map(a => a.kind).sort()).toEqual(['bet99', 'betway']);
  expect(mocks.txInserts.length).toBe(1); // un seul depot (BET99)
  expect(mocks.txInserts[0]).toMatchObject({ amount: 200, type: 'deposit' });
});

test('mode apercu : aucune ecriture Supabase n\'est declenchee, onComplete est quand meme appele', async () => {
  const mocks = mockEcriture();
  const onComplete = jest.fn();
  render(<OnboardingFlow utilisateur={UTILISATEUR} lang="en" previewMode onComplete={onComplete} />);
  expect(screen.getByText('Preview mode')).toBeInTheDocument();

  await allerAuxEtapes();
  fireEvent.click(screen.getByText('BET99'));
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How much is in your bankroll?');
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '500' } });
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What do you want to do with Betrics?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('What\'s your experience level?');
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText('How did you hear about us?');
  fireEvent.click(screen.getByText('I am 18 years of age or older'));
  fireEvent.click(screen.getByText('Finish'));

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(mocks.accountInserts.length).toBe(0);
  expect(mocks.txInserts.length).toBe(0);
  expect(mocks.profileUpserts.length).toBe(0);
  expect(supabase.from).not.toHaveBeenCalled();
});
