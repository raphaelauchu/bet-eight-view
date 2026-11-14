import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  PoolTradesTab, PoolWaiversTab,
  compositionAfterTrade, capStatusAfterTrade, playersCommittedElsewhere, buildCounterOfferSlots,
} from './PoolTrades';

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

// Roster volontairement minimal (1F/1D/1G chaque equipe) avec roster.forwards/defense/goalies
// a 1 : la composition de CHAQUE equipe correspond EXACTEMENT a son quota avant tout echange
// (realiste : une equipe respecte deja ses propres regles). Un echange 1-pour-1 de meme poste
// garde la composition valide des deux cotes ; un echange croise (F contre D) la casse des deux
// cotes -- les tests de composition "9/6/2 par defaut et personnalise" vivent dans
// src/poolRules.test.js (rosterTargetsByPosGroup) et ci-dessous (compositionAfterTrade, fonction
// pure), pas besoin de repeter un roster complet ici pour les tests d'interaction.
const POOL = {
  id: 'pool-1', status: 'active',
  rules: {
    poolType: 'classic', salaryCap: { enabled: false },
    roster: { forwards: 1, defense: 1, goalies: 1, teamPicks: 0 },
    scoring: {
      forward: { goals: 2, assists: 1, powerPlayPoints: 0, shotsOnGoal: 0, plusMinus: 0 },
      defense: { goals: 2, assists: 1, powerPlayPoints: 0, shotsOnGoal: 0, plusMinus: 0 },
      goalie: { wins: 2, shutouts: 3, saves: 0 },
    },
    trades: { enabled: true, balanceByPosition: true, approval: 'none', noReacquire: false, maxPerSeason: null },
    waivers: { enabled: true, maxAddsPerSeason: null, noReacquireDropped: false },
  },
};
const POOL_WITH_CAP = { ...POOL, rules: { ...POOL.rules, salaryCap: { enabled: true, amount: 10000000, source: 'capHit' } } };
const MEMBERS = [
  { id: 'm-moi', user_id: 'u-moi', display_name: 'Moi', team_name: 'Mon Equipe' },
  { id: 'm-alice', user_id: 'u-alice', display_name: 'Alice', team_name: 'Equipe Alice' },
  { id: 'm-bob', user_id: 'u-bob', display_name: 'Bob', team_name: 'Equipe Bob' },
];

const MY_ROWS = [
  { kind: 'player', ref_id: 'p1', label: 'Mon Attaquant', pos_group: 'F', team_abbrev: 'MTL', total_points: 20, is_active: true, salary: 4000000, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p2', label: 'Mon Defenseur', pos_group: 'D', team_abbrev: 'MTL', total_points: 15, is_active: true, salary: 3000000, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p5', label: 'Mon Gardien', pos_group: 'G', team_abbrev: 'MTL', total_points: 5, is_active: true, salary: 2000000, current_slot: null, closed_reason: null },
];
const ALICE_ROWS = [
  { kind: 'player', ref_id: 'p3', label: 'Son Attaquant', pos_group: 'F', team_abbrev: 'BOS', total_points: 25, is_active: true, salary: 8000000, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p4', label: 'Son Defenseur', pos_group: 'D', team_abbrev: 'BOS', total_points: 10, is_active: true, salary: 1000000, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p6', label: 'Son Gardien', pos_group: 'G', team_abbrev: 'BOS', total_points: 8, is_active: true, salary: 1000000, current_slot: null, closed_reason: null },
];
const BOB_ROWS = [
  { kind: 'player', ref_id: 'p7', label: 'Attaquant de Bob', pos_group: 'F', team_abbrev: 'TOR', total_points: 12, is_active: true, salary: 1000000, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p8', label: 'Defenseur de Bob', pos_group: 'D', team_abbrev: 'TOR', total_points: 9, is_active: true, salary: 1000000, current_slot: null, closed_reason: null },
  { kind: 'player', ref_id: 'p9', label: 'Gardien de Bob', pos_group: 'G', team_abbrev: 'TOR', total_points: 3, is_active: true, salary: 1000000, current_slot: null, closed_reason: null },
];
const ROWS_BY_MEMBER = { 'm-moi': MY_ROWS, 'm-alice': ALICE_ROWS, 'm-bob': BOB_ROWS };

// Offre reçue en attente : Alice (proposeur) <-> Moi (destinataire). Alice cede son Attaquant,
// je cede le mien -- items.from_member_id porte TOUJOURS celui qui cede (convention serveur).
const RECEIVED_TRADE = { id: 'trade-1', pool_id: 'pool-1', proposer_member_id: 'm-alice', recipient_member_id: 'm-moi', status: 'pending', message: null };
const RECEIVED_TRADE_ITEMS = [
  { id: 'ti1', trade_id: 'trade-1', from_member_id: 'm-alice', to_member_id: 'm-moi', kind: 'player', player_id: 'p3', player_name: 'Son Attaquant', position: 'F', nhl_team: 'BOS', salary: 8000000 },
  { id: 'ti2', trade_id: 'trade-1', from_member_id: 'm-moi', to_member_id: 'm-alice', kind: 'player', player_id: 'p1', player_name: 'Mon Attaquant', position: 'F', nhl_team: 'MTL', salary: 4000000 },
];

function mockSupabaseDefault({ trades = [], tradeItems = [] } = {}) {
  supabase.rpc.mockImplementation((fn, args) => {
    if (fn === 'get_member_breakdown') return Promise.resolve({ data: ROWS_BY_MEMBER[args.p_member_id] || [], error: null });
    if (fn === 'get_transaction_counters') return Promise.resolve({ data: [{ trades_used: 0, trades_max: null, adds_used: 0, adds_max: null }], error: null });
    if (fn === 'propose_trade') return Promise.resolve({ data: {}, error: null });
    if (fn === 'propose_counter_trade') return Promise.resolve({ data: {}, error: null });
    if (fn === 'respond_trade') return Promise.resolve({ data: {}, error: null });
    if (fn === 'cancel_trade') return Promise.resolve({ data: {}, error: null });
    if (fn === 'review_trade') return Promise.resolve({ data: {}, error: null });
    if (fn === 'add_free_agent') return Promise.resolve({ data: { claimed: false }, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_trades') return mockQuery({ data: trades, error: null });
    if (table === 'pool_trade_items') return mockQuery({ data: tradeItems, error: null });
    if (table === 'player_injuries') return mockQuery({ data: [{ player_id: 'fa2', player_name: 'Agent Libre Blesse', team_abbrev: 'TOR', status: 'Blessure au bas du corps', description: 'Retour dans 1 semaine.' }], error: null });
    return mockQuery({ data: [], error: null });
  });
  supabase.channel.mockImplementation(() => {
    const chan = { on: () => chan, subscribe: () => ({}) };
    return chan;
  });
}

function panels() {
  const els = document.querySelectorAll('.trade-side-panel');
  return { left: els[0], right: els[1] };
}

// Nom du participant affiche dans l'en-tete d'un panneau : distinct du <select> de bascule de
// partenaire (panneau de droite), qui porte aussi le texte de chaque membre dans ses <option>.
function panelHeaderName(panel) {
  return panel.querySelector('.trade-side-header-name')?.textContent;
}

async function addFromPicker(side, playerLabel) {
  const panel = side === 'left' ? panels().left : panels().right;
  fireEvent.click(within(panel).getAllByRole('button', { name: /Ajouter un joueur/ })[0]);
  await waitFor(() => expect(screen.getByText('Choisir un joueur')).toBeInTheDocument());
  fireEvent.click(screen.getByText(playerLabel));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseDefault();
});

// ===================== Fonctions pures (composition, plafond, elsewhere, contre-offre) =====================

test('compositionAfterTrade : valide si F/D/G restent exactement aux quotas apres un echange 1-pour-1 de meme poste', () => {
  const rules = { poolType: 'classic', roster: { forwards: 1, defense: 1, goalies: 1 } };
  const result = compositionAfterTrade(rules, MY_ROWS, [MY_ROWS[0]], [ALICE_ROWS[0]]); // cede p1(F), recoit p3(F)
  expect(result.find(c => c.pos === 'F')).toEqual({ pos: 'F', used: 1, quota: 1, ok: true });
  expect(result.find(c => c.pos === 'D')).toEqual({ pos: 'D', used: 1, quota: 1, ok: true });
});

test('compositionAfterTrade : invalide si un echange croise (F contre D) desequilibre un poste', () => {
  const rules = { poolType: 'classic', roster: { forwards: 1, defense: 1, goalies: 1 } };
  const result = compositionAfterTrade(rules, MY_ROWS, [MY_ROWS[0]], [ALICE_ROWS[1]]); // cede p1(F), recoit p4(D)
  expect(result.find(c => c.pos === 'F')).toEqual({ pos: 'F', used: 0, quota: 1, ok: false });
  expect(result.find(c => c.pos === 'D')).toEqual({ pos: 'D', used: 2, quota: 1, ok: false });
});

test('capStatusAfterTrade : plafond depasse quand le salaire recu excede le salaire cede', () => {
  const rules = { salaryCap: { amount: 10000000 } };
  const result = capStatusAfterTrade(rules, MY_ROWS, [MY_ROWS[0]], [ALICE_ROWS[0]]); // cede 4M, recoit 8M
  expect(result.used).toBe(9000000 - 4000000 + 8000000);
  expect(result.over).toBe(true);
});

test('capStatusAfterTrade : sous le plafond -- pas depasse', () => {
  const rules = { salaryCap: { amount: 10000000 } };
  const result = capStatusAfterTrade(rules, MY_ROWS, [MY_ROWS[0]], [ALICE_ROWS[1]]); // cede 4M, recoit 1M
  expect(result.over).toBe(false);
});

test('playersCommittedElsewhere : marque un joueur deja propose dans une autre offre pending', () => {
  const trades = [{ id: 'other-trade', status: 'pending' }];
  const items = [{ trade_id: 'other-trade', from_member_id: 'm-alice', kind: 'player', player_id: 'p3' }];
  const set = playersCommittedElsewhere(trades, items, 'm-alice', null);
  expect(set.has('player:p3')).toBe(true);
});

test('playersCommittedElsewhere : exclut l\'offre en cours de visualisation/contre-offre', () => {
  const trades = [{ id: 'trade-1', status: 'pending' }];
  const items = [{ trade_id: 'trade-1', from_member_id: 'm-alice', kind: 'player', player_id: 'p3' }];
  const set = playersCommittedElsewhere(trades, items, 'm-alice', 'trade-1');
  expect(set.has('player:p3')).toBe(false);
});

test('buildCounterOfferSlots : prefill = memes joueurs, roles inverses (destinataire original devient proposeur)', () => {
  const { mySlots, partnerSlots } = buildCounterOfferSlots(RECEIVED_TRADE, RECEIVED_TRADE_ITEMS);
  expect(mySlots.map(r => r.label)).toEqual(['Mon Attaquant']); // ce que moi (destinataire original) cederait
  expect(partnerSlots.map(r => r.label)).toEqual(['Son Attaquant']); // ce qu'Alice (proposeur original) cederait
});

// ===================== Composant : construction de l'offre (propose) =====================

test('PoolTradesTab : deux panneaux face a face (mon equipe / equipe du participant)', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(panels().left).toBeTruthy());
  expect(panelHeaderName(panels().left)).toBe('Moi');
  expect(panelHeaderName(panels().right)).toBe('Alice'); // partenaire par defaut = 1er autre membre
});

test('PoolTradesTab : ajout via le selecteur de roster, le bouton Proposer s\'active une fois les deux cotes equilibres', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(panels().left).toBeTruthy());

  const proposerBtn = screen.getByRole('button', { name: 'Proposer l\'échange' });
  expect(proposerBtn).toBeDisabled();
  expect(screen.getByText('Le nombre de joueurs doit être le même des deux côtés.')).toBeInTheDocument();

  await addFromPicker('left', 'Mon Attaquant');
  expect(within(panels().left).getByText('Mon Attaquant')).toBeInTheDocument();
  expect(proposerBtn).toBeDisabled(); // un seul cote rempli, compte different

  await addFromPicker('right', 'Son Attaquant');
  expect(within(panels().right).getByText('Son Attaquant')).toBeInTheDocument();

  await waitFor(() => expect(proposerBtn).not.toBeDisabled());
  expect(screen.getByText('Échange valide')).toBeInTheDocument();

  // Retirer (x) remet le bouton a l'etat desactive.
  fireEvent.click(within(panels().left).getByLabelText('remove'));
  expect(within(panels().left).queryByText('Mon Attaquant')).not.toBeInTheDocument();
  expect(proposerBtn).toBeDisabled();
});

test('PoolTradesTab : erreur de regle -- echange croise (F contre D) affiche la raison et bloque le bouton', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(panels().left).toBeTruthy());

  await addFromPicker('left', 'Mon Attaquant');
  await addFromPicker('right', 'Son Defenseur');

  await waitFor(() => expect(screen.getByText('L\'échange doit inclure le même nombre de joueurs par poste des deux côtés.')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Proposer l\'échange' })).toBeDisabled();
});

test('PoolTradesTab : plafond salarial depasse -- barre rouge, bouton desactive malgre un echange 1-pour-1 equilibre', async () => {
  render(<PoolTradesTab pool={POOL_WITH_CAP} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(panels().left).toBeTruthy());

  await addFromPicker('left', 'Mon Attaquant'); // 4M
  await addFromPicker('right', 'Son Attaquant'); // 8M -- 9M - 4M + 8M = 13M > plafond 10M

  await waitFor(() => expect(screen.getByText('Plafond salarial dépassé')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Proposer l\'échange' })).toBeDisabled();
});

test('PoolTradesTab : bascule entre membres (fleches et liste) reinitialise le panneau de droite', async () => {
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(panels().left).toBeTruthy());
  expect(panelHeaderName(panels().right)).toBe('Alice');

  await addFromPicker('right', 'Son Attaquant');
  expect(within(panels().right).getByText('Son Attaquant')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Participant suivant'));
  await waitFor(() => expect(panelHeaderName(panels().right)).toBe('Bob'));
  // Changer de partenaire reinitialise les cases de droite (Son Attaquant n'a plus de sens pour Bob).
  expect(within(panels().right).queryByText('Son Attaquant')).not.toBeInTheDocument();

  await addFromPicker('right', 'Attaquant de Bob');
  expect(within(panels().right).getByText('Attaquant de Bob')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Participant précédent'));
  await waitFor(() => expect(panelHeaderName(panels().right)).toBe('Alice'));
});

test('PoolTradesTab : selecteur de roster -- recherche, filtre de position, et marquage "deja propose ailleurs"', async () => {
  mockSupabaseDefault({ trades: [{ id: 'other-trade', pool_id: 'pool-1', proposer_member_id: 'm-moi', recipient_member_id: 'm-bob', status: 'pending' }], tradeItems: [{ id: 'oti', trade_id: 'other-trade', from_member_id: 'm-moi', to_member_id: 'm-bob', kind: 'player', player_id: 'p2', player_name: 'Mon Defenseur', position: 'D', nhl_team: 'MTL', salary: 3000000 }] });
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(panels().left).toBeTruthy());

  fireEvent.click(within(panels().left).getAllByRole('button', { name: /Ajouter un joueur/ })[0]);
  await waitFor(() => expect(screen.getByText('Choisir un joueur')).toBeInTheDocument());

  // Recherche.
  fireEvent.change(screen.getByPlaceholderText('Rechercher un joueur (dès 2 lettres)...'), { target: { value: 'Gardien' } });
  expect(screen.queryByText('Mon Attaquant')).not.toBeInTheDocument();
  expect(screen.getByText('Mon Gardien')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Rechercher un joueur (dès 2 lettres)...'), { target: { value: '' } });

  // Filtre de position.
  fireEvent.click(screen.getByRole('button', { name: 'D' }));
  expect(screen.queryByText('Mon Attaquant')).not.toBeInTheDocument();
  expect(screen.getByText('Mon Defenseur')).toBeInTheDocument();

  // Deja propose dans une autre offre pending (other-trade) : marque, pas selectionnable.
  const rowDefenseur = screen.getByText('Mon Defenseur').closest('button');
  expect(rowDefenseur).toBeDisabled();
  expect(within(rowDefenseur).getByText('Déjà proposé ailleurs')).toBeInTheDocument();
  fireEvent.click(rowDefenseur);
  expect(screen.getByText('Choisir un joueur')).toBeInTheDocument(); // le picker reste ouvert, rien n'a ete ajoute
});

test('PoolTradesTab : echanges desactives par les regles du pool -- message, aucun panneau', async () => {
  const poolSansEchanges = { ...POOL, rules: { ...POOL.rules, trades: { ...POOL.rules.trades, enabled: false } } };
  render(<PoolTradesTab pool={poolSansEchanges} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  expect(screen.getByText('Les échanges sont désactivés par les règles de ce pool.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Proposer l\'échange' })).not.toBeInTheDocument();
});

// ===================== Composant : ecran destinataire (accepter/refuser/contre-offre) =====================

test('PoolTradesTab : offre recue -- panneaux en lecture seule, Accepter/Refuser/Contre-offre', async () => {
  mockSupabaseDefault({ trades: [RECEIVED_TRADE], tradeItems: RECEIVED_TRADE_ITEMS });
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);

  await waitFor(() => expect(screen.getByText(/Échanges reçus \(1\)/)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Alice.*Moi/));

  await waitFor(() => expect(within(panels().left).getByText('Mon Attaquant')).toBeInTheDocument());
  expect(within(panels().right).getByText('Son Attaquant')).toBeInTheDocument();
  // Lecture seule : pas de bouton retirer sur les cases.
  expect(screen.queryByLabelText('remove')).not.toBeInTheDocument();

  expect(screen.getByRole('button', { name: 'Accepter' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refuser' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Contre-offre' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('respond_trade', { p_trade_id: 'trade-1', p_accept: true }));
});

test('PoolTradesTab : contre-offre -- prerempli avec les memes joueurs, modifiable, envoie propose_counter_trade', async () => {
  mockSupabaseDefault({ trades: [RECEIVED_TRADE], tradeItems: RECEIVED_TRADE_ITEMS });
  render(<PoolTradesTab pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);

  await waitFor(() => expect(screen.getByText(/Échanges reçus \(1\)/)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Alice.*Moi/));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Contre-offre' })).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Contre-offre' }));

  // Prerempli : memes joueurs toujours visibles, mais desormais modifiables (bouton retirer).
  await waitFor(() => expect(within(panels().left).getByText('Mon Attaquant')).toBeInTheDocument());
  expect(within(panels().right).getByText('Son Attaquant')).toBeInTheDocument();
  expect(screen.getAllByLabelText('remove').length).toBe(2);
  expect(screen.getByText('Tu modifies une contre-offre à cet échange.')).toBeInTheDocument();

  const counterBtn = screen.getByRole('button', { name: 'Contre-offre' });
  await waitFor(() => expect(counterBtn).not.toBeDisabled());
  fireEvent.click(counterBtn);

  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('propose_counter_trade', expect.objectContaining({
    p_original_trade_id: 'trade-1',
    p_gives: [{ kind: 'player', player_id: 'p1' }],
    p_receives: [{ kind: 'player', player_id: 'p3' }],
  })));
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
