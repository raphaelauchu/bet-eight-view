import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  buildFormation, buildFormerPlayers, gameStatusForTeam, resolveFormerPlayerDeparture,
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

test('buildFormation : regles classiques par defaut (9F/6D/2G) -- un seul groupe SANS etiquette par bloc (tous les joueurs comptent pareil)', () => {
  const rules = { poolType: 'classic', roster: { forwards: 9, defense: 6, goalies: 2, teamPicks: 1 } };
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => makeRow({ ref_id: `f${i}`, label: `F${i}`, pos_group: 'F' })),
    ...Array.from({ length: 4 }, (_, i) => makeRow({ ref_id: `d${i}`, label: `D${i}`, pos_group: 'D' })),
    makeRow({ ref_id: 'g0', label: 'G0', pos_group: 'G' }),
    makeRow({ kind: 'team', ref_id: 'MTL', label: 'Canadiens', pos_group: 'TEAM' }),
  ];
  const formation = buildFormation(rows, rules);

  expect(formation.isFantasy).toBe(false);

  expect(formation.lines.length).toBe(1); // pas de "Ligne 1/2/3" en classique : un seul groupe
  expect(formation.lines[0].label).toBeNull();
  expect(formation.lines[0].rows.length).toBe(9);
  expect(formation.lines[0].rows.filter(Boolean).length).toBe(7);
  expect(formation.lines[0].rows.filter(c => c === null).length).toBe(2); // 9 - 7 reels

  expect(formation.pairs.length).toBe(1); // pas de "Paire 1/2/3" en classique
  expect(formation.pairs[0].label).toBeNull();
  expect(formation.pairs[0].rows.length).toBe(6);
  expect(formation.pairs[0].rows.filter(Boolean).length).toBe(4);

  expect(formation.goaliesLabel).toBeNull(); // pas de "Partant/Reserviste" en classique
  expect(formation.goalies.length).toBe(2);
  expect(formation.goalies.filter(Boolean).length).toBe(1);

  expect(formation.counts).toEqual({ forward: 7, defense: 4, goalie: 1 });
  expect(formation.required).toEqual({ forward: 9, defense: 6, goalie: 2 });

  expect(formation.bench).toEqual([]);
  expect(formation.ir).toEqual([]);
  expect(formation.teamPick?.ref_id).toBe('MTL');
});

test('buildFormation : alignement fantasy personnalise -- un groupe PAR SLOT REEL (C/LW/RW/D/G), jamais une numerotation inventee', () => {
  const rules = { poolType: 'fantasy', roster: { C: 1, LW: 1, RW: 1, D: 2, G: 1, UTIL: 1, bench: 3, ir: 1 } };
  const rows = [
    makeRow({ ref_id: 'c1', label: 'Centre', pos_group: 'F', current_slot: 'C' }),
    makeRow({ ref_id: 'lw1', label: 'Ailier G', pos_group: 'F', current_slot: 'LW' }),
    // RW et UTIL restent vides : doivent quand meme apparaitre comme groupes (padding a 1 slot).
    makeRow({ ref_id: 'd1', label: 'Def 1', pos_group: 'D', current_slot: 'D' }),
    makeRow({ ref_id: 'd2', label: 'Def 2', pos_group: 'D', current_slot: 'D' }),
    makeRow({ ref_id: 'g1', label: 'Gardien', pos_group: 'G', current_slot: 'G' }),
    makeRow({ ref_id: 'bn1', label: 'Banc 1', pos_group: 'F', current_slot: 'BN' }),
    makeRow({ ref_id: 'ir1', label: 'Blesse 1', pos_group: 'D', current_slot: 'IR' }),
  ];
  const formation = buildFormation(rows, rules);

  expect(formation.isFantasy).toBe(true);

  // 4 groupes (C, LW, RW, UTIL), chacun son propre libelle et sa propre cible (1 slot chacun).
  expect(formation.lines.map(g => g.label)).toEqual(['C', 'LW', 'RW', 'UTIL']);
  expect(formation.lines.find(g => g.label === 'C').rows).toEqual([expect.objectContaining({ ref_id: 'c1' })]);
  expect(formation.lines.find(g => g.label === 'LW').rows).toEqual([expect.objectContaining({ ref_id: 'lw1' })]);
  expect(formation.lines.find(g => g.label === 'RW').rows).toEqual([null]);
  expect(formation.lines.find(g => g.label === 'UTIL').rows).toEqual([null]);

  expect(formation.pairs.map(g => g.label)).toEqual(['D']);
  expect(formation.pairs[0].rows.filter(Boolean).length).toBe(2);
  expect(formation.pairs[0].rows.length).toBe(2);

  expect(formation.goaliesLabel).toBe('G');
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

// ===================== resolveFormerPlayerDeparture : date + destination du depart =====================

test('resolveFormerPlayerDeparture : echange -> destinataire trouve ; libere -> aucun destinataire ; pas concerne -> null', () => {
  const periods = [
    { member_id: 'x', player_id: 'p1', from_at: '2026-01-01T00:00:00Z', to_at: '2026-02-01T00:00:00Z' },
    { member_id: 'y', player_id: 'p1', from_at: '2026-02-02T00:00:00Z', to_at: null },
    { member_id: 'x', player_id: 'p2', from_at: '2026-01-01T00:00:00Z', to_at: '2026-03-01T00:00:00Z' },
  ];
  expect(resolveFormerPlayerDeparture(periods, 'x', 'p1')).toEqual({ toAt: '2026-02-01T00:00:00Z', destMemberId: 'y' });
  expect(resolveFormerPlayerDeparture(periods, 'x', 'p2')).toEqual({ toAt: '2026-03-01T00:00:00Z', destMemberId: null });
  expect(resolveFormerPlayerDeparture(periods, 'z', 'p1')).toBeNull();
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

  // Formation par defaut : le nom du joueur apparait dans une carte (sur 2 lignes -- prenom
  // puis nom -- d'ou la recherche sur 'McDavid' et non la chaine complete), pas le tableau.
  await waitFor(() => expect(screen.getByText('McDavid')).toBeInTheDocument());
  expect(screen.queryByText('CONTENU-TABLEAU-EXISTANT')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Tableau'));
  expect(screen.getByText('CONTENU-TABLEAU-EXISTANT')).toBeInTheDocument();
  expect(screen.queryByText('McDavid')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Formation'));
  expect(screen.getByText('McDavid')).toBeInTheDocument();
});

test('PoolTeamHub : clic sur une carte ouvre FicheJoueurStats', async () => {
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('McDavid')).toBeInTheDocument());
  fireEvent.click(screen.getByText('McDavid'));
  expect(screen.getByText('FICHE:Connor McDavid')).toBeInTheDocument();
  fireEvent.click(screen.getByText('fermer-fiche'));
  expect(screen.queryByText('FICHE:Connor McDavid')).not.toBeInTheDocument();
});

test('PoolTeamHub : Formation (pool classique) affiche 3 blocs avec un indicateur de places, SANS etiquette Ligne/Paire/Partant', async () => {
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('McDavid')).toBeInTheDocument());

  expect(screen.getByText('Attaque')).toBeInTheDocument();
  expect(screen.getByText('Défense')).toBeInTheDocument();
  expect(screen.getByText('Gardiens')).toBeInTheDocument();

  // Indicateur discret "rempli/requis" sur chaque titre de bloc (2 attaquants/9 requis ici).
  expect(screen.getByText('Attaque').closest('.locker-block-title')).toHaveTextContent('2/9');
  expect(screen.getByText('Défense').closest('.locker-block-title')).toHaveTextContent('0/6');
  expect(screen.getByText('Gardiens').closest('.locker-block-title')).toHaveTextContent('0/2');

  // Aucune etiquette inventee en pool classique (tous les joueurs comptent pareil).
  expect(screen.queryByText(/Ligne 1/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Paire 1/)).not.toBeInTheDocument();
  expect(screen.queryByText('Partant')).not.toBeInTheDocument();
  expect(screen.queryByText('Réserviste')).not.toBeInTheDocument();

  // La repartition cote a cote (conteneur large) vs empilee (conteneur etroit) est purement
  // CSS (container queries, voir .locker-board dans index.css) : jsdom n'execute pas de vrai
  // moteur de rendu CSS, donc ce test verifie la structure DOM (3 blocs, meme ordre) sur
  // laquelle cette mise en page CSS s'appuie -- le comportement visuel reel (aucun debordement
  // a 1024/1180/1440/1920px) doit etre verifie dans un navigateur, pas ici.
  const board = document.querySelector('.locker-board');
  const blocs = Array.from(board.children).filter(el => el.classList.contains('locker-block'));
  expect(blocs.length).toBe(3);
});

test('PoolTeamHub : Formation (pool fantasy) affiche les VRAIS libelles de slot (C/LW/RW/D/G), jamais Ligne/Paire/Partant', async () => {
  const rows = [
    makeRow({ ref_id: 'c1', label: 'Centre Un', pos_group: 'F', current_slot: 'C' }),
    makeRow({ ref_id: 'd1', label: 'Defenseur Un', pos_group: 'D', current_slot: 'D' }),
    makeRow({ ref_id: 'g1', label: 'Gardien Un', pos_group: 'G', current_slot: 'G' }),
  ];
  render(<PoolTeamHub pool={POOL_FANTASY} member={MEMBER} rows={rows} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Formation')).toBeInTheDocument());

  const groupLabels = Array.from(document.querySelectorAll('.locker-group-label')).map(el => el.textContent);
  expect(groupLabels).toEqual(expect.arrayContaining(['C', 'LW', 'RW', 'UTIL', 'D', 'G']));

  expect(screen.queryByText(/Ligne/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Paire/)).not.toBeInTheDocument();
  expect(screen.queryByText('Partant')).not.toBeInTheDocument();
  expect(screen.queryByText('Réserviste')).not.toBeInTheDocument();
});

test('PoolTeamHub : legende des paliers (bronze/argent/or/elite), avec infobulle accessible au focus', async () => {
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('McDavid')).toBeInTheDocument());

  expect(screen.getByText('Bronze')).toBeInTheDocument();
  expect(screen.getByText('Argent')).toBeInTheDocument();
  expect(screen.getByText('Or')).toBeInTheDocument();
  expect(screen.getByText('Élite')).toBeInTheDocument();

  // Chaque palier distinguable sans la couleur seule (nombre d'etoiles croissant).
  const dots = document.querySelectorAll('.locker-tier-dot');
  const starCounts = Array.from(dots).map(d => d.textContent.length);
  expect(starCounts).toEqual([1, 2, 3, 4]);

  const info = screen.getByLabelText(/Palier selon les points/);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(info);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.blur(info);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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
  await waitFor(() => expect(screen.getByText('McDavid')).toBeInTheDocument());
  expect(screen.queryByLabelText(/Blessure :/)).not.toBeInTheDocument();
});

test('PoolTeamHub : joueur echange cache par defaut, visible dans son propre onglet "Anciens joueurs" avec ses points pendant la possession', async () => {
  const rows = [
    ...baseRows(),
    makeRow({ ref_id: 'echange1', label: 'Joueur Echange', pos_group: 'D', is_active: false, closed_reason: 'trade', total_points: 7 }),
  ];
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={rows} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Anciens joueurs')).toBeInTheDocument());

  // Masque tant que l'onglet "Anciens joueurs" n'est pas selectionne : il reste sur Formation.
  expect(screen.queryByText('Echange')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Anciens joueurs'));
  const carte = screen.getByText('Echange').closest('.player-card');
  expect(carte).toHaveTextContent('7');
});

const POOL_FANTASY = {
  id: 'pool-2', status: 'active',
  rules: { poolType: 'fantasy', roster: { C: 1, LW: 1, RW: 1, D: 2, G: 1, UTIL: 1, bench: 3, ir: 1 }, salaryCap: { enabled: false } },
};

test('PoolTeamHub : aucun compteur sur Formation/Tableau, compteur uniquement sur Banc/IR et Anciens joueurs', async () => {
  const rows = [
    makeRow({ ref_id: 'c1', label: 'Centre Un', pos_group: 'F', current_slot: 'C' }),
    makeRow({ ref_id: 'lw1', label: 'Ailier Un', pos_group: 'F', current_slot: 'LW' }),
    makeRow({ ref_id: 'd1', label: 'Defenseur Un', pos_group: 'D', current_slot: 'D' }),
    makeRow({ ref_id: 'g1', label: 'Gardien Un', pos_group: 'G', current_slot: 'G' }),
    makeRow({ ref_id: 'bn1', label: 'Banc Un', pos_group: 'F', current_slot: 'BN' }),
    makeRow({ ref_id: 'ir1', label: 'Blesse Un', pos_group: 'D', current_slot: 'IR' }),
    makeRow({ ref_id: 'echange1', label: 'Ancien Un', pos_group: 'F', is_active: false, closed_reason: 'trade', total_points: 3 }),
  ];
  render(<PoolTeamHub pool={POOL_FANTASY} member={MEMBER} rows={rows} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Formation')).toBeInTheDocument());

  // Formation et Tableau : jamais de pastille de compteur sur l'onglet lui-meme.
  expect(screen.getByText('Formation').closest('button').querySelector('.locker-tab-count')).toBeNull();
  expect(screen.getByText('Tableau').closest('button').querySelector('.locker-tab-count')).toBeNull();

  // Banc/IR : visible (non vide) avec 1 banc + 1 IR = 2.
  expect(screen.getByText('Banc/IR')).toBeInTheDocument();
  expect(screen.getByText('Banc/IR').closest('button')).toHaveTextContent('2');
  // Anciens joueurs : 1.
  expect(screen.getByText('Anciens joueurs').closest('button')).toHaveTextContent('1');
});

test('PoolTeamHub : onglet Banc/IR masque pour un pool classique (toujours vide) ou un pool fantasy sans reserve', async () => {
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={baseRows()} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Formation')).toBeInTheDocument());
  expect(screen.queryByText('Banc/IR')).not.toBeInTheDocument();
});

test('PoolTeamHub : onglet Banc/IR -- joueur sans photo affiche ses initiales, jamais un fantome', async () => {
  const rows = [makeRow({ ref_id: 'bn1', label: 'Jean Dupont', pos_group: 'F', current_slot: 'BN', team_abbrev: 'MTL' })];
  render(<PoolTeamHub pool={POOL_FANTASY} member={MEMBER} rows={rows} standingsRow={null} lang="fr">table</PoolTeamHub>);
  await waitFor(() => expect(screen.getByText('Banc/IR')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Banc/IR'));

  const img = document.querySelector('.player-card-photo-img');
  expect(img).toBeInTheDocument();
  fireEvent.error(img);
  expect(document.querySelector('.player-card-initials')).toBeInTheDocument();
  expect(screen.getByText('JD')).toBeInTheDocument();
});

test('PoolTeamHub : etat de chargement -- squelette affiche, pas de carte/onglet, pas de crash', () => {
  render(<PoolTeamHub pool={POOL} member={MEMBER} rows={null} standingsRow={null} lang="fr" loading>table</PoolTeamHub>);
  expect(document.querySelectorAll('.locker-skeleton-card').length).toBeGreaterThan(0);
  expect(screen.queryByText('Formation')).not.toBeInTheDocument();
  expect(screen.queryByText('McDavid')).not.toBeInTheDocument();
});

test('PoolTeamHub : etat vide -- message affiche, bandeau toujours visible, pas de crash', () => {
  render(
    <PoolTeamHub pool={POOL} member={MEMBER} rows={[]} standingsRow={null} lang="fr" emptyMessage="Aucun joueur">table</PoolTeamHub>
  );
  expect(screen.getByText('Aucun joueur')).toBeInTheDocument();
  expect(document.querySelector('.locker-banner')).toBeInTheDocument();
});

// ===================== Mise en page : CSS proportionnelle, container queries =====================
// jsdom ne rend pas de vraies mises en page CSS (pas de moteur de layout) : on ne peut donc pas
// mesurer un debordement reel ici. On verifie a la place, en lisant le texte source de la
// feuille de style, que le mecanisme employe est bien celui qui garantit l'absence de
// debordement (container queries bornees par minmax(0, ...) plutot qu'un decoupage fixe en
// pixels, et un conteneur de taille sur .locker-team-hub) -- un test de regression contre un
// retour accidentel a `repeat(3, 1fr)`/`@media` qui recreerait le bogue de debordement.

test('CSS : la formation utilise des container queries proportionnelles (minmax(0, ...)), pas une largeur fixe', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf8');

  expect(css).toMatch(/\.locker-team-hub\s*\{[^}]*container-type:\s*inline-size/);
  expect(css).toMatch(/@container[^{]*\{\s*\.locker-board\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*3fr\)\s*minmax\(0,\s*2fr\)\s*minmax\(0,\s*2fr\)/);
  // Les cartes ont un plancher/plafond (jamais une largeur fixe en pixels qui empecherait la
  // grille de se comprimer et causerait un debordement dans un conteneur etroit).
  expect(css).toMatch(/\.locker-group-cards\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(110px,\s*150px\)\)/);
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
