import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  buildFormation, buildFormerPlayers, gameStatusForTeam,
  exportLockerRoomImage, downloadLockerRoomImage, PoolTeamHub,
} from './PoolLockerRoom';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('./Analyses', () => ({
  useSaisonCourante: () => '20262027',
  LOGOS_NHL: { MTL: 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg' },
  FicheJoueurStats: ({ joueur, onBack }) => (
    <div>
      <span>FICHE:{joueur.nom}</span>
      <button onClick={onBack}>fermer-fiche</button>
    </div>
  ),
}));

const { supabase } = require('./supabase');

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, in: () => q, order: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

// ===================== buildFormation : composition selon les regles =====================

function makeRow(overrides) {
  return {
    kind: 'player', ref_id: '1', label: 'Joueur', pos_group: 'F', team_abbrev: 'MTL',
    total_points: 0, is_active: true, closed_reason: null, current_slot: null,
    ...overrides,
  };
}

test('buildFormation : regles classiques par defaut (9F/6D/2G), trios et paires avec placeholders', () => {
  const rules = { poolType: 'classic', roster: { forwards: 9, defense: 6, goalies: 2, teamPicks: 1 } };
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => makeRow({ ref_id: `f${i}`, label: `F${i}`, pos_group: 'F' })),
    ...Array.from({ length: 4 }, (_, i) => makeRow({ ref_id: `d${i}`, label: `D${i}`, pos_group: 'D' })),
    makeRow({ ref_id: 'g0', label: 'G0', pos_group: 'G' }),
    makeRow({ kind: 'team', ref_id: 'MTL', label: 'Canadiens', pos_group: 'TEAM' }),
  ];
  const formation = buildFormation(rows, rules);

  expect(formation.lines.length).toBe(3); // 9 slots / 3 par ligne
  expect(formation.lines.flat().filter(Boolean).length).toBe(7);
  expect(formation.lines.flat().filter(c => c === null).length).toBe(2); // 9 - 7 reels

  expect(formation.pairs.length).toBe(3); // 6 slots / 2 par paire
  expect(formation.pairs.flat().filter(Boolean).length).toBe(4);
  expect(formation.pairs.flat().filter(c => c === null).length).toBe(2);

  expect(formation.goalies.length).toBe(2);
  expect(formation.goalies.filter(Boolean).length).toBe(1);

  expect(formation.bench).toEqual([]);
  expect(formation.ir).toEqual([]);
  expect(formation.teamPick?.ref_id).toBe('MTL');
});

test('buildFormation : alignement fantasy personnalise (C/LW/RW/D/G/UTIL/banc/IR)', () => {
  const rules = { poolType: 'fantasy', roster: { C: 1, LW: 1, RW: 1, D: 2, G: 1, UTIL: 1, bench: 3, ir: 1 } };
  const rows = [
    makeRow({ ref_id: 'c1', label: 'Centre', pos_group: 'F', current_slot: 'C' }),
    makeRow({ ref_id: 'lw1', label: 'Ailier G', pos_group: 'F', current_slot: 'LW' }),
    makeRow({ ref_id: 'rw1', label: 'Ailier D', pos_group: 'F', current_slot: 'RW' }),
    makeRow({ ref_id: 'd1', label: 'Def 1', pos_group: 'D', current_slot: 'D' }),
    makeRow({ ref_id: 'd2', label: 'Def 2', pos_group: 'D', current_slot: 'D' }),
    makeRow({ ref_id: 'g1', label: 'Gardien', pos_group: 'G', current_slot: 'G' }),
    makeRow({ ref_id: 'bn1', label: 'Banc 1', pos_group: 'F', current_slot: 'BN' }),
    makeRow({ ref_id: 'ir1', label: 'Blesse 1', pos_group: 'D', current_slot: 'IR' }),
  ];
  const formation = buildFormation(rows, rules);

  // Slots avant : C+LW+RW+UTIL = 4 -> 3 reels + 1 vide, groupes par trios (1 ligne de 3 + 1 ligne de 1 pad a 3... )
  const forwardCards = formation.lines.flat();
  expect(forwardCards.filter(Boolean).length).toBe(3);
  expect(forwardCards.length).toBe(4); // 1 ligne de 3 + 1 ligne contenant le 4e slot (vide)

  const defenseCards = formation.pairs.flat();
  expect(defenseCards.filter(Boolean).length).toBe(2);
  expect(defenseCards.length).toBe(2); // D:2 -> exactement 1 paire

  expect(formation.goalies.filter(Boolean).length).toBe(1);

  expect(formation.bench.map(r => r.ref_id)).toEqual(['bn1']);
  expect(formation.ir.map(r => r.ref_id)).toEqual(['ir1']);
});

// ===================== Joueurs echanges ("Anciens joueurs") =====================

test('buildFormerPlayers : seuls les joueurs actifs echanges (is_active=false, closed_reason=trade) ressortent', () => {
  const rows = [
    makeRow({ ref_id: 'actif', is_active: true, closed_reason: null }),
    makeRow({ ref_id: 'echange', is_active: false, closed_reason: 'trade', total_points: 12 }),
    makeRow({ ref_id: 'retire', is_active: false, closed_reason: 'drop' }),
    { kind: 'team', ref_id: 'MTL', is_active: false, closed_reason: 'trade', label: 'Canadiens' },
  ];
  const former = buildFormerPlayers(rows);
  expect(former.map(r => r.ref_id)).toEqual(['echange']);
  expect(former[0].total_points).toBe(12);
});

test('gameStatusForTeam : en direct, joue ce soir, ou rien', () => {
  const games = [
    { home_abbrev: 'MTL', away_abbrev: 'BOS', state: 'LIVE' },
    { home_abbrev: 'EDM', away_abbrev: 'TOR', state: 'FUT' },
  ];
  expect(gameStatusForTeam(games, 'MTL')).toBe('live');
  expect(gameStatusForTeam(games, 'TOR')).toBe('tonight');
  expect(gameStatusForTeam(games, 'NYR')).toBeNull();
  expect(gameStatusForTeam(games, null)).toBeNull();
});

// ===================== Composant : PoolTeamHub (formation/tableau, blessures) =====================

const POOL = { id: 'pool-1', status: 'active', rules: { poolType: 'classic', roster: { forwards: 9, defense: 6, goalies: 2, teamPicks: 1 }, salaryCap: { enabled: false } } };
const MEMBER = { id: 'm1', user_id: 'u1', display_name: 'Alex', team_name: 'Equipe Alex' };

function baseRows() {
  return [
    makeRow({ ref_id: '8478402', label: 'Connor McDavid', pos_group: 'F' }),
    makeRow({ ref_id: '8480018', label: 'Nick Suzuki', pos_group: 'F' }),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  supabase.from.mockImplementation((table) => {
    if (table === 'nhl_games') return mockQuery({ data: [], error: null });
    if (table === 'player_injuries') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
});

test('PoolTeamHub : bascule Formation/Tableau, le tableau existant reste accessible', async () => {
  render(
    <PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={{ rank: 2, total_points: 45, today_points: 3 }} lang="fr">
      <div>CONTENU-TABLEAU-EXISTANT</div>
    </PoolTeamHub>
  );

  // Formation par defaut : le nom du joueur apparait dans une carte, pas le contenu du tableau.
  await waitFor(() => expect(screen.getByText('Connor McDavid')).toBeInTheDocument());
  expect(screen.queryByText('CONTENU-TABLEAU-EXISTANT')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Tableau'));
  expect(screen.getByText('CONTENU-TABLEAU-EXISTANT')).toBeInTheDocument();
  expect(screen.queryByText('Connor McDavid')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Formation'));
  expect(screen.getByText('Connor McDavid')).toBeInTheDocument();
});

test('PoolTeamHub : clic sur une carte ouvre FicheJoueurStats', async () => {
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Connor McDavid')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Connor McDavid'));
  expect(screen.getByText('FICHE:Connor McDavid')).toBeInTheDocument();
  fireEvent.click(screen.getByText('fermer-fiche'));
  expect(screen.queryByText('FICHE:Connor McDavid')).not.toBeInTheDocument();
});

test('PoolTeamHub : joueur blesse avec donnees affiche le badge et le detail, sans donnees reste propre', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'player_injuries') {
      return mockQuery({
        data: [{ player_id: '8478402', player_name: 'Connor McDavid', team_abbrev: 'EDM', status: 'Injured Reserve', description: 'Haut du corps, retour estime dans 2 semaines.' }],
        error: null,
      });
    }
    return mockQuery({ data: [], error: null });
  });

  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(document.querySelector('.player-card-injury-badge')).toBeInTheDocument());

  fireEvent.click(document.querySelector('.player-card-injury-badge'));
  expect(screen.getByText('Injured Reserve')).toBeInTheDocument();
  expect(screen.getByText('Haut du corps, retour estime dans 2 semaines.')).toBeInTheDocument();

  // Suzuki n'a pas de ligne dans player_injuries : un seul badge-blessure sur toute la page
  // (la carte elle-meme porte aussi la mention dans son aria-label accessible, donc 2 elements
  // au total pour McDavid -- jamais 2 joueurs distincts).
  expect(document.querySelectorAll('.player-card-injury-badge').length).toBe(1);
});

test('PoolTeamHub : aucune blessure retournee (table absente/erreur) -- pas de badge, pas de crash', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'player_injuries') return mockQuery({ data: null, error: { message: 'relation "player_injuries" does not exist' } });
    return mockQuery({ data: [], error: null });
  });
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Connor McDavid')).toBeInTheDocument());
  expect(screen.queryByLabelText(/Blessure :/)).not.toBeInTheDocument();
});

test('PoolTeamHub : joueur echange visible dans "Anciens joueurs" avec ses points pendant la possession', async () => {
  const rows = [
    ...baseRows(),
    makeRow({ ref_id: 'echange1', label: 'Joueur Echange', pos_group: 'D', is_active: false, closed_reason: 'trade', total_points: 7 }),
  ];
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={rows} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Anciens joueurs')).toBeInTheDocument());
  const carte = screen.getByText('Joueur Echange').closest('.player-card');
  expect(carte).toHaveTextContent('7');
});

// ===================== Export PNG ("Partager mon equipe") =====================

test('exportLockerRoomImage / downloadLockerRoomImage : s\'executent sans exception', async () => {
  const canvas = await exportLockerRoomImage({
    pool: POOL, member: MEMBER, rows: baseRows(), standingsRow: { rank: 1, total_points: 20 }, lang: 'fr', seasonId: '20262027', teamAbbrev: 'MTL',
  });
  expect(canvas).toBeTruthy();

  const resultat = await downloadLockerRoomImage({
    pool: POOL, member: MEMBER, rows: baseRows(), standingsRow: { rank: 1, total_points: 20 }, lang: 'fr', seasonId: '20262027', teamAbbrev: 'MTL',
  });
  expect(typeof resultat).toBe('boolean');
}, 10000);
