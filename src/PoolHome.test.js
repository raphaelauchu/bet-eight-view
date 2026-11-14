import { render, screen, waitFor } from '@testing-library/react';
import { PoolHomeDashboard } from './PoolHome';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('./Analyses', () => ({
  useSaisonCourante: () => '20262027',
  LOGOS_NHL: {},
}));

const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, in: () => q, is: () => q, gt: () => q, gte: () => q, or: () => q, order: () => q, limit: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const POOL = { id: 'pool-1', rules: { poolType: 'classic' } };
const MEMBERS = [
  { id: 'm-moi', user_id: 'u-moi', display_name: 'Moi', team_name: 'Mon Equipe' },
  { id: 'm-alice', user_id: 'u-alice', display_name: 'Alice', team_name: 'Equipe Alice' },
];
const MY_MEMBER = MEMBERS[0];

const STANDINGS = [
  { member_id: 'm-alice', display_name: 'Alice', team_name: 'Equipe Alice', rank: 1, total_points: 50 },
  { member_id: 'm-moi', display_name: 'Moi', team_name: 'Mon Equipe', rank: 2, total_points: 30 },
];

const MY_ROWS = [
  { kind: 'player', ref_id: 'p1', label: 'Mon Joueur', pos_group: 'F', team_abbrev: 'MTL', total_points: 20, is_active: true },
];

const TRANSACTIONS = [
  { id: 'tx1', pool_id: 'pool-1', member_id: 'm-alice', type: 'add', details: { player_name: 'Agent Libre X' }, created_at: '2026-11-10T12:00:00Z' },
  { id: 'tx2', pool_id: 'pool-1', member_id: 'm-moi', type: 'trade', details: {}, created_at: '2026-11-09T12:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  supabase.rpc.mockImplementation((fn) => {
    if (fn === 'get_pool_standings') return Promise.resolve({ data: STANDINGS, error: null });
    if (fn === 'get_member_breakdown') return Promise.resolve({ data: MY_ROWS, error: null });
    return Promise.resolve({ data: [], error: null });
  });
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_roster_periods') return mockQuery({ data: [{ member_id: 'm-alice', player_id: 'BOS' }], error: null });
    if (table === 'pool_transactions') return mockQuery({ data: TRANSACTIONS, error: null });
    if (table === 'nhl_games') return mockQuery({ data: [{ game_id: 1, game_date: '2026-11-16', home_abbrev: 'MTL', away_abbrev: 'TOR', state: 'FUT' }], error: null });
    if (table === 'player_injuries') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
});

test('PoolHomeDashboard : ecussons de tous les participants', async () => {
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getAllByAltText('BOS').length).toBeGreaterThan(0)); // ecusson d'Alice
  expect(screen.getAllByText('Moi').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
});

test('PoolHomeDashboard : top 3 du classement', async () => {
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getByText('50')).toBeInTheDocument());
  expect(screen.getByText('30')).toBeInTheDocument();
});

test('PoolHomeDashboard : prochains matchs de mes joueurs (MTL, via mon roster actif)', async () => {
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getByText('TOR @ MTL')).toBeInTheDocument());
});

test('PoolHomeDashboard : aucun match a venir -- etat vide propre', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_roster_periods') return mockQuery({ data: [], error: null });
    if (table === 'pool_transactions') return mockQuery({ data: [], error: null });
    if (table === 'nhl_games') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getByText('Aucun match à venir pour tes joueurs dans les prochains jours.')).toBeInTheDocument());
});

test('PoolHomeDashboard : fil d\'activite -- echanges/ajouts (pool_transactions) tries par recence', async () => {
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getByText(/Alice.*Ajout d'agent libre.*Agent Libre X/)).toBeInTheDocument());
  expect(screen.getByText(/Moi.*Échange accepté/)).toBeInTheDocument();
});

test('PoolHomeDashboard : blessure d\'un de MES joueurs apparait dans le fil d\'activite (jamais inventee)', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_roster_periods') return mockQuery({ data: [], error: null });
    if (table === 'pool_transactions') return mockQuery({ data: [], error: null });
    if (table === 'nhl_games') return mockQuery({ data: [], error: null });
    if (table === 'player_injuries') return mockQuery({ data: [{ player_id: 'p1', player_name: 'Mon Joueur', status: 'Blessure au genou', description: null, updated_at: '2026-11-12T00:00:00Z' }], error: null });
    return mockQuery({ data: [], error: null });
  });
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getByText(/Blessure : Mon Joueur \(Blessure au genou\)/)).toBeInTheDocument());
});

test('PoolHomeDashboard : aucune activite -- etat vide propre', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_roster_periods') return mockQuery({ data: [], error: null });
    if (table === 'pool_transactions') return mockQuery({ data: [], error: null });
    if (table === 'nhl_games') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
  render(<PoolHomeDashboard pool={POOL} members={MEMBERS} myMember={MY_MEMBER} lang="fr" />);
  await waitFor(() => expect(screen.getByText('Aucune activité récente.')).toBeInTheDocument());
});
