import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomeDashboard } from './Home';

// ===================== Home.js : BANKROLL_SYNC_ENABLED=true =====================
// Fichier dedie (jest.mock statique, charge avant tout import) : verifie que la section
// "Synchronisation automatique" (liste d'attente, src/SportsbookWaitlist.js) existe toujours et
// se reaffiche normalement si on repasse src/bankrollConfig.js:BANKROLL_SYNC_ENABLED a `true` --
// voir Home.test.js pour le comportement par defaut (drapeau desactive).
jest.mock('./bankrollConfig', () => ({ BANKROLL_SYNC_ENABLED: true }));

jest.mock('./Analyses', () => ({
  useIsMobile: jest.fn(() => false),
  getDateStr: (d) => d.toISOString().slice(0, 10),
}));

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

const { supabase } = require('./supabase');

function tableResult(table) {
  const map = {
    profiles: { data: { first_name: 'Alex' }, error: null },
    bankroll_accounts: { data: [{ id: 'acc1', user_id: 'u1', name: 'Principal', kind: 'other', archived_at: null }], error: null },
    bankroll_transactions: { data: [{ id: 'tx1', account_id: 'acc1', type: 'deposit', amount: 500 }], error: null },
    paris: { data: [], error: null },
    bets_auto: { data: [], error: null },
    sportsbook_waitlist: { data: [], error: null },
    pool_members: { data: [], error: null },
    nhl_games: { data: [], error: null },
    nhl_player_game_stats: { data: [], error: null },
    nhl_team_game_results: { data: [], error: null },
  };
  return map[table] || { data: [], error: null };
}

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, gte: () => q, in: () => q, gt: () => q,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  supabase.from.mockImplementation((table) => mockQuery(tableResult(table)));
  supabase.rpc.mockResolvedValue({ data: [], error: null });
  supabase.channel.mockImplementation(() => ({ on: () => ({ subscribe: () => ({}) }) }));
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ gameWeek: [], standings: [] }) }));
});

test('BANKROLL_SYNC_ENABLED=true : la section "Synchronisation automatique" reapparait sous la creation manuelle de compte', async () => {
  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onOpenTeamFiche={noop} />);
  await waitFor(() => expect(screen.getByText('Ajouter un sportsbook')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Ajouter un sportsbook'));
  await waitFor(() => expect(screen.getByText('Synchronisation automatique')).toBeInTheDocument());
  expect(screen.getAllByText('Bientôt disponible').length).toBe(4);
});
