import { render, screen } from '@testing-library/react';
import { PoolLobby, tabsForPool } from './Pool';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn(), rpc: jest.fn() } }));
jest.mock('./Analyses', () => ({
  useIsMobile: () => false,
  useIsDesktopWide: () => false,
  useSaisonCourante: () => '20262027',
  LOGOS_NHL: {},
  FicheJoueurStats: () => null,
}));

const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, in: () => q, is: () => q, gt: () => q, gte: () => q, or: () => q, limit: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_members') return mockQuery({ data: [{ id: 'm1', pool_id: 'p1', user_id: 'u1', role: 'commissioner', display_name: 'Moi', team_name: 'Mon equipe', joined_at: '2026-01-01' }], error: null });
    if (table === 'pool_picks') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
  supabase.channel.mockImplementation(() => {
    const chan = { on: () => chan, subscribe: () => ({}) };
    return chan;
  });
  supabase.rpc.mockImplementation(() => Promise.resolve({ data: [], error: null }));
});

const POOL_CLASSIC = (status) => ({ id: 'p1', name: 'Pool Test', season: '2026-27', max_members: 10, invite_code: 'ABC123', owner_id: 'u1', status, rules: { poolType: 'classic', salaryCap: { enabled: false }, draft: { orderMode: 'random' } } });
const POOL_FANTASY = (status) => ({ id: 'p1', name: 'Pool Test', season: '2026-27', max_members: 10, invite_code: 'ABC123', owner_id: 'u1', status, rules: { poolType: 'fantasy', salaryCap: { enabled: false }, draft: { orderMode: 'random' } } });

// ===================== tabsForPool : fonction pure =====================

test('tabsForPool : repechage non termine -> seulement Lobby + Draft', () => {
  expect(tabsForPool(POOL_CLASSIC('setup'))).toEqual(['lobby', 'draft']);
  expect(tabsForPool(POOL_CLASSIC('draft'))).toEqual(['lobby', 'draft']);
});

test('tabsForPool : repechage termine (classique) -> Accueil/Classement/Mon equipe/Echanges/Agents libres/Regles, sans Draft ni Alignement', () => {
  expect(tabsForPool(POOL_CLASSIC('active'))).toEqual(['lobby', 'standings', 'team', 'trades', 'waivers', 'rules']);
  expect(tabsForPool(POOL_CLASSIC('finished'))).toEqual(['lobby', 'standings', 'team', 'trades', 'waivers', 'rules']);
});

test('tabsForPool : repechage termine (fantasy) -> Alignement en plus', () => {
  expect(tabsForPool(POOL_FANTASY('active'))).toEqual(['lobby', 'standings', 'team', 'trades', 'waivers', 'lineup', 'rules']);
});

// ===================== Navigation rendue : avant/apres repechage =====================

test('navigation rendue : repechage non termine -> seuls Lobby et Draft apparaissent dans la barre', async () => {
  render(<PoolLobby pool={POOL_CLASSIC('setup')} utilisateur={{ id: 'u1' }} lang="fr" isMobile={false} onBack={() => {}} onEditRules={() => {}} />);
  await screen.findByText('Pool Test');

  expect(screen.getByRole('button', { name: 'Lobby' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Classement' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mon équipe' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Accueil' })).not.toBeInTheDocument();
});

test('navigation rendue : repechage termine -> Accueil remplace Lobby, Draft disparait, les onglets post-repechage apparaissent', async () => {
  render(<PoolLobby pool={POOL_CLASSIC('active')} utilisateur={{ id: 'u1' }} lang="fr" isMobile={false} onBack={() => {}} onEditRules={() => {}} />);
  await screen.findByText('Pool Test');

  expect(screen.getByRole('button', { name: 'Accueil' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Lobby' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Draft' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Classement' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mon équipe' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Échanges' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Agents libres' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Règles' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Alignement' })).not.toBeInTheDocument();
});

test('navigation rendue : pool fantasy repechage termine -> Alignement visible', async () => {
  render(<PoolLobby pool={POOL_FANTASY('active')} utilisateur={{ id: 'u1' }} lang="fr" isMobile={false} onBack={() => {}} onEditRules={() => {}} />);
  await screen.findByText('Pool Test');
  expect(screen.getByRole('button', { name: 'Alignement' })).toBeInTheDocument();
});

test('deep-link existant (onOpen(\'draft\')) : initialTab="draft" fonctionne toujours pendant le repechage', async () => {
  render(<PoolLobby pool={POOL_CLASSIC('setup')} utilisateur={{ id: 'u1' }} lang="fr" isMobile={false} initialTab="draft" onBack={() => {}} onEditRules={() => {}} />);
  await screen.findByText('Pool Test');
  // L'onglet Draft est actif par defaut (bouton en surbrillance) sans avoir eu a cliquer.
  const boutonDraft = screen.getByRole('button', { name: 'Draft' });
  expect(boutonDraft.style.backgroundColor).toBe('rgb(249, 115, 22)');
});
