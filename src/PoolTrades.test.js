import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PoolTradesTab, PoolWaiversTab } from './PoolTrades';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
jest.mock('./Analyses', () => ({
  useIsMobile: () => false,
  useSaisonCourante: () => '20262027',
  LOGOS_NHL: {},
  FicheJoueurStats: () => null,
}));
jest.mock('./PoolDraftRoom', () => {
  const actual = jest.requireActual('./PoolDraftRoom');
  return {
    ...actual,
    useNhlPlayers: () => ({
      players: [
        { id: 'fa1', name: 'Agent Libre Sain', team: 'BOS', posReel: 'C', posGroup: 'forward', goals: 10, assists: 5, points: 15, shots: 40, plusMinus: 2 },
        { id: 'fa2', name: 'Agent Libre Blesse', team: 'TOR', posReel: 'D', posGroup: 'defense', goals: 1, assists: 3, points: 4, shots: 10, plusMinus: -1 },
      ],
      loading: false, error: false,
    }),
    useNhlTeams: () => ({ teams: [], loading: false }),
  };
});

const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, in: () => q, order: () => q, is: () => q, gt: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

const POOL = {
  id: 'pool-1', status: 'active',
  rules: {
    poolType: 'classic', salaryCap: { enabled: false },
    roster: { forwards: 9, defense: 6, goalies: 2, teamPicks: 0 },
    scoring: {
      forward: { goals: 2, assists: 1, powerPlayPoints: 0, shotsOnGoal: 0, plusMinus: 0 },
      defense: { goals: 2, assists: 1, powerPlayPoints: 0, shotsOnGoal: 0, plusMinus: 0 },
      goalie: { wins: 2, shutouts: 3, saves: 0 },
    },
    trades: { enabled: true, balanceByPosition: true, approval: 'none', noReacquire: false, maxPerSeason: null },
    waivers: { enabled: true, maxAddsPerSeason: null, noReacquireDropped: false },
  },
};
const MEMBERS = [
  { id: 'm-moi', user_id: 'u-moi', display_name: 'Moi', team_name: 'Mon Equipe' },
  { id: 'm-alice', user_id: 'u-alice', display_name: 'Alice', team_name: 'Equipe Alice' },
];

const MY_ROWS = [
  { kind: 'player', ref_id: 'p1', label: 'Mon Attaquant', pos_group: 'F', team_abbrev: 'MTL', total_points: 20, is_active: true, salary: 0, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p2', label: 'Mon Defenseur', pos_group: 'D', team_abbrev: 'MTL', total_points: 15, is_active: true, salary: 0, current_slot: null, closed_reason: null },
];
const PARTNER_ROWS = [
  { kind: 'player', ref_id: 'p3', label: 'Son Attaquant', pos_group: 'F', team_abbrev: 'BOS', total_points: 25, is_active: true, salary: 0, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p4', label: 'Son Defenseur', pos_group: 'D', team_abbrev: 'BOS', total_points: 10, is_active: true, salary: 0, current_slot: null, closed_reason: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  supabase.rpc.mockImplementation((fn, args) => {
    if (fn === 'get_member_breakdown') {
      return Promise.resolve({ data: args.p_member_id === 'm-moi' ? MY_ROWS : PARTNER_ROWS, error: null });
    }
    if (fn === 'get_transaction_counters') return Promise.resolve({ data: [{ trades_used: 0, trades_max: null, adds_used: 0, adds_max: null }], error: null });
    if (fn === 'propose_trade') return Promise.resolve({ data: {}, error: null });
    if (fn === 'add_free_agent') return Promise.resolve({ data: { claimed: false }, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  supabase.from.mockImplementation((table) => {
    if (table === 'player_injuries') return mockQuery({ data: [{ player_id: 'fa2', player_name: 'Agent Libre Blesse', team_abbrev: 'TOR', status: 'Blessure au bas du corps', description: 'Retour dans 1 semaine.' }], error: null });
    return mockQuery({ data: [], error: null });
  });
  supabase.channel.mockImplementation(() => {
    const chan = { on: () => chan, subscribe: () => ({}) };
    return chan;
  });
});

// ===================== Echanges : composition, ajout/retrait, erreur de regle =====================

test('PoolTradesTab : deux colonnes PlayerCard (mon equipe / equipe du participant)', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(screen.getByText('Mon Attaquant')).toBeInTheDocument());
  expect(screen.getByText('Son Attaquant')).toBeInTheDocument();
});

test('PoolTradesTab : ajout/retrait -- bouton Ajouter puis Retirer, le bouton Proposer s\'active une fois les deux cotes remplis', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(screen.getByText('Mon Attaquant')).toBeInTheDocument());

  const proposerBtn = screen.getByRole('button', { name: 'Proposer l\'échange' });
  expect(proposerBtn).toBeDisabled();

  // Ajoute mon attaquant (F) et son attaquant (F) -- composition equilibree, aucune erreur de regle.
  const carteMoi = screen.getByText('Mon Attaquant').closest('.player-card');
  fireEvent.click(within(carteMoi).getByText('Ajouter'));
  expect(within(carteMoi).getByText('Retirer')).toBeInTheDocument(); // bascule Ajouter -> Retirer

  const carteSon = screen.getByText('Son Attaquant').closest('.player-card');
  fireEvent.click(within(carteSon).getByText('Ajouter'));

  await waitFor(() => expect(proposerBtn).not.toBeDisabled());

  fireEvent.click(within(carteMoi).getByText('Retirer'));
  expect(within(carteMoi).getByText('Ajouter')).toBeInTheDocument();
  expect(proposerBtn).toBeDisabled();
});

test('PoolTradesTab : erreur de regle -- composition desequilibree (F contre D) bloque la proposition', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(screen.getByText('Mon Attaquant')).toBeInTheDocument());

  // Je cede mon attaquant (F) contre son defenseur (D) : meme bareme de pointage mais poste
  // different de chaque cote -- balanceByPosition rejette (erreur affichee, bouton desactive).
  fireEvent.click(within(screen.getByText('Mon Attaquant').closest('.player-card')).getByText('Ajouter'));
  fireEvent.click(within(screen.getByText('Son Defenseur').closest('.player-card')).getByText('Ajouter'));

  await waitFor(() => expect(screen.getByText('L\'échange doit inclure le même nombre de joueurs par poste des deux côtés.')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Proposer l\'échange' })).toBeDisabled();
});

test('PoolTradesTab : compteurs de composition en direct (F/D/G) affiches selon rules.roster', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(screen.getByText('Mon Attaquant')).toBeInTheDocument());
  // buildQuotaRows affiche "used/quota" (ex. "1/9" pour les attaquants, roster.forwards=9) --
  // au moins un compteur de ce type doit apparaitre pour mon equipe.
  expect(screen.getAllByText(/\/9/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/\/6/).length).toBeGreaterThan(0);
});

test('PoolTradesTab : echanges desactives par les regles du pool -- message, aucun selecteur', async () => {
  const poolSansEchanges = { ...POOL, rules: { ...POOL.rules, trades: { ...POOL.rules.trades, enabled: false } } };
  render(<PoolTradesTab pool={poolSansEchanges} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  expect(screen.getByText('Les échanges sont désactivés par les règles de ce pool.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Proposer l\'échange' })).not.toBeInTheDocument();
});

// ===================== Agents libres : filtres, blessures, remplacement =====================

test('PoolWaiversTab : grille de PlayerCard avec filtre "Blesses" (player_injuries reel, jamais invente)', async () => {
  render(<PoolWaiversTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" />);
  await waitFor(() => expect(screen.getByText('Agent Libre Sain')).toBeInTheDocument());
  expect(screen.getByText('Agent Libre Blesse')).toBeInTheDocument();
  expect(screen.getByLabelText(/Blessure :/, { selector: 'span' })).toBeInTheDocument();

  fireEvent.click(screen.getByText('Blessés'));
  expect(screen.queryByText('Agent Libre Sain')).not.toBeInTheDocument();
  expect(screen.getByText('Agent Libre Blesse')).toBeInTheDocument();
});

test('PoolWaiversTab : respecte rules.waivers -- ajout desactive si le ballotage est desactive pour ce pool', async () => {
  const poolSansWaivers = { ...POOL, rules: { ...POOL.rules, waivers: { ...POOL.rules.waivers, enabled: false } } };
  render(<PoolWaiversTab pool={poolSansWaivers} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" />);
  expect(screen.getByText('Le ballottage est désactivé par les règles de ce pool.')).toBeInTheDocument();
  expect(screen.queryByText('Agent Libre Sain')).not.toBeInTheDocument();
});

test('PoolWaiversTab : "Remplacer" (mode agent libre) -- ouvre le choix du joueur a laisser, pre-rempli avec ma formation', async () => {
  render(<PoolWaiversTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" />);
  await waitFor(() => expect(screen.getByText('Agent Libre Sain')).toBeInTheDocument());

  fireEvent.click(within(screen.getByText('Agent Libre Sain').closest('.player-card')).getByText('Ajouter'));
  await waitFor(() => expect(screen.getByText('Abandonner un joueur (si nécessaire) :')).toBeInTheDocument());
  expect(screen.getByText('Mon Attaquant')).toBeInTheDocument();
  expect(screen.getByText('Mon Defenseur')).toBeInTheDocument();

  const modal = screen.getByText('Abandonner un joueur (si nécessaire) :').parentElement;
  fireEvent.click(within(modal).getByRole('button', { name: 'Ajouter' }));
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('add_free_agent', expect.objectContaining({ p_pool_id: 'pool-1', p_player_id: 'fa1' })));
});
