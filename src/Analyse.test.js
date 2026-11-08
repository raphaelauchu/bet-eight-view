import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  AnalysesFlux, tabKey, openOrActivateTab, closeAnalyseTab, moveActiveSearchIndex,
  buildSearchGroups, readAnalyseState, writeAnalyseState, formFromSavedPick,
  buildMatchTab, calculerProbabiliteImplicite, calculerEdgePct, aggregerTendanceEquipe,
  filtrerFaceAFace, formeSequence,
} from './Analyses';
import HockeyTicker from './HockeyTicker';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
const { supabase } = require('./supabase');

// ===================== Fonctions pures (tabs/recherche/persistance, deja existantes) =====================

test('tabKey : identifie un onglet par kind+id', () => {
  expect(tabKey({ kind: 'player', id: '123' })).toBe('player:123');
  expect(tabKey({ kind: 'team', id: 'MTL' })).toBe('team:MTL');
  expect(tabKey({ kind: 'match', id: '2026020001' })).toBe('match:2026020001');
});

test('openOrActivateTab : ouvre un nouvel onglet, ou active l\'existant sans doublon', () => {
  const t1 = { kind: 'player', id: '1', nom: 'A' };
  const r1 = openOrActivateTab([], t1);
  expect(r1.tabs).toEqual([t1]);
  expect(r1.activeKey).toBe('player:1');

  const t2 = { kind: 'team', id: 'MTL', nom: 'Montréal' };
  const r2 = openOrActivateTab(r1.tabs, t2);
  expect(r2.tabs.length).toBe(2);

  // Rouvrir le meme joueur : pas de doublon, simplement active.
  const r3 = openOrActivateTab(r2.tabs, { kind: 'player', id: '1', nom: 'A' });
  expect(r3.tabs.length).toBe(2);
  expect(r3.activeKey).toBe('player:1');
});

test('closeAnalyseTab : ferme un onglet et active son voisin si c\'etait l\'actif', () => {
  const tabs = [{ kind: 'player', id: '1' }, { kind: 'player', id: '2' }, { kind: 'player', id: '3' }];
  const r1 = closeAnalyseTab(tabs, 'player:2', 'player:2');
  expect(r1.tabs.map(t => t.id)).toEqual(['1', '3']);
  expect(r1.activeKey).toBe('player:3');

  const r2 = closeAnalyseTab(tabs, 'player:3', 'player:3');
  expect(r2.activeKey).toBe('player:2');

  const r3 = closeAnalyseTab(tabs, 'player:1', 'player:2');
  expect(r3.activeKey).toBe('player:1');
  expect(r3.tabs.map(t => t.id)).toEqual(['1', '3']);

  const r4 = closeAnalyseTab([{ kind: 'player', id: '1' }], 'player:1', 'player:1');
  expect(r4.tabs).toEqual([]);
  expect(r4.activeKey).toBeNull();
});

test('moveActiveSearchIndex : navigation clavier Haut/Bas, boucle aux extremites', () => {
  expect(moveActiveSearchIndex(-1, 3, 1)).toBe(0);
  expect(moveActiveSearchIndex(-1, 3, -1)).toBe(2);
  expect(moveActiveSearchIndex(0, 3, 1)).toBe(1);
  expect(moveActiveSearchIndex(2, 3, 1)).toBe(0);
  expect(moveActiveSearchIndex(0, 3, -1)).toBe(2);
  expect(moveActiveSearchIndex(0, 0, 1)).toBe(-1);
});

test('buildSearchGroups : groupe Joueurs/Equipes, rien avant 2 caracteres', () => {
  const classement = [
    { teamAbbrev: { default: 'MTL' }, teamName: { default: 'Canadiens de Montréal' } },
    { teamAbbrev: { default: 'TOR' }, teamName: { default: 'Maple Leafs de Toronto' } },
  ];
  const freeText = [{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }];
  expect(buildSearchGroups('m', freeText, classement)).toEqual({ players: [], teams: [] });
  const g = buildSearchGroups('mo', freeText, classement);
  expect(g.teams.map(t => t.id)).toEqual(['MTL']);
  const g2 = buildSearchGroups('suzuki', freeText, classement);
  expect(g2.players.length).toBe(1);
  expect(g2.players[0].nom).toBe('Nick Suzuki');
});

test('buildSearchGroups : un gardien ressort correctement groupe comme joueur (bogue connu corrige)', () => {
  const freeText = [{ playerId: 99, name: 'Carey Price', teamAbbrev: 'MTL', positionCode: 'G' }];
  const g = buildSearchGroups('price', freeText, []);
  expect(g.players[0].position).toBe('G');
});

test('readAnalyseState/writeAnalyseState : persistance localStorage avec try/catch', () => {
  writeAnalyseState({ tabs: [{ kind: 'team', id: 'MTL', nom: 'Montréal' }], activeKey: 'team:MTL' });
  expect(readAnalyseState()).toEqual({ tabs: [{ kind: 'team', id: 'MTL', nom: 'Montréal' }], activeKey: 'team:MTL' });
  const original = window.localStorage;
  Object.defineProperty(window, 'localStorage', { value: { getItem() { throw new Error('indisponible'); }, setItem() { throw new Error('indisponible'); } }, configurable: true });
  expect(() => writeAnalyseState({ tabs: [], activeKey: null })).not.toThrow();
  expect(readAnalyseState()).toBeNull();
  Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
});

test('readAnalyseState : ignore une valeur corrompue (pas un objet {tabs:[...]})', () => {
  window.localStorage.setItem('betrics_analyse_tabs_v1', '{"oops": true}');
  expect(readAnalyseState()).toBeNull();
  window.localStorage.setItem('betrics_analyse_tabs_v1', 'pas du json valide {{{');
  expect(readAnalyseState()).toBeNull();
});

test('formFromSavedPick : pre-remplit le formulaire d\'ajout de pari existant (reutilise)', () => {
  const pickJoueur = { kind: 'player', ref_id: '123', label: 'Nick Suzuki', line: 1.5, odds: 1.9, planned_stake: 20 };
  const f1 = formFromSavedPick(pickJoueur);
  expect(f1.type_bet).toBe('Prop joueur');
  expect(f1.ligne).toBe(1.5);
  const pickEquipe = { kind: 'team', ref_id: 'MTL', label: 'Canadiens de Montréal', odds: 2.1 };
  const f2 = formFromSavedPick(pickEquipe);
  expect(f2.type_bet).toBe('Moneyline');
  expect(f2.equipe).toBe('MTL');
});

// ===================== Fonctions pures : matchup (edge, tendances, H2H, forme) =====================

const MATCH_BRUT = {
  id: 2026020001,
  gameDate: '2026-11-10',
  gameState: 'FUT',
  startTimeUTC: '2026-11-11T00:00:00Z',
  awayTeam: { abbrev: 'MTL', commonName: { default: 'Canadiens' }, score: null },
  homeTeam: { abbrev: 'TOR', commonName: { default: 'Maple Leafs' }, score: null },
};

test('buildMatchTab : construit un onglet "match" persistable a partir d\'un match brut du calendrier', () => {
  const tab = buildMatchTab(MATCH_BRUT);
  expect(tab.kind).toBe('match');
  expect(tab.id).toBe('2026020001');
  expect(tab.nom).toBe('MTL @ TOR');
  expect(tab.match.awayTeam.abbrev).toBe('MTL');
  expect(tab.match.homeTeam.abbrev).toBe('TOR');
});

test('calculerProbabiliteImplicite : cote decimale -> probabilite 0-1, null si invalide', () => {
  expect(calculerProbabiliteImplicite(2)).toBeCloseTo(0.5);
  expect(calculerProbabiliteImplicite(1.5)).toBeCloseTo(0.6667, 3);
  expect(calculerProbabiliteImplicite(null)).toBeNull();
  expect(calculerProbabiliteImplicite(1)).toBeNull(); // cote <= 1 : invalide
  expect(calculerProbabiliteImplicite('oups')).toBeNull();
});

test('calculerEdgePct : cas connus (modele vs cote implicite)', () => {
  // Modele 60%, cote decimale 2.0 -> implicite 50% -> edge +10%.
  expect(calculerEdgePct(60, 2)).toBe(10);
  // Modele 40%, cote decimale 2.0 -> implicite 50% -> edge -10%.
  expect(calculerEdgePct(40, 2)).toBe(-10);
  // Modele 50%, cote "juste" (decimale 2.0 = 50% implicite) -> edge nul.
  expect(calculerEdgePct(50, 2)).toBe(0);
  // Aucune cote disponible -> etat vide (null), jamais un edge invente.
  expect(calculerEdgePct(60, null)).toBeNull();
  expect(calculerEdgePct(null, 2)).toBeNull();
});

test('aggregerTendanceEquipe : fiche/buts pour-contre par periode (L5/L10/Saison)', () => {
  const games = [
    { homeTeam: { abbrev: 'MTL', score: 4 }, awayTeam: { abbrev: 'BOS', score: 2 } }, // MTL dom, victoire
    { homeTeam: { abbrev: 'OTT', score: 1 }, awayTeam: { abbrev: 'MTL', score: 3 } }, // MTL ext, victoire
    { homeTeam: { abbrev: 'MTL', score: 1 }, awayTeam: { abbrev: 'TOR', score: 5 } }, // MTL dom, defaite
  ];
  const szn = aggregerTendanceEquipe(games, 'MTL', 'SZN');
  expect(szn.victoires).toBe(2);
  expect(szn.defaites).toBe(1);
  expect(szn.bpMoy).toBeCloseTo((4 + 3 + 1) / 3);
  expect(szn.bcMoy).toBeCloseTo((2 + 1 + 5) / 3);

  const l5 = aggregerTendanceEquipe(games, 'MTL', 'L5'); // moins de 5 matchs -> tous pris
  expect(l5.nb).toBe(3);

  expect(aggregerTendanceEquipe([], 'MTL', 'SZN')).toBeNull();
  expect(aggregerTendanceEquipe(null, 'MTL', 'SZN')).toBeNull();
});

test('filtrerFaceAFace : ne garde que les matchs contre l\'adversaire donne', () => {
  const games = [
    { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'BOS' } },
    { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
    { homeTeam: { abbrev: 'TOR' }, awayTeam: { abbrev: 'MTL' } },
  ];
  expect(filtrerFaceAFace(games, 'TOR').length).toBe(2);
  expect(filtrerFaceAFace(games, 'OTT').length).toBe(0);
  expect(filtrerFaceAFace(null, 'TOR')).toEqual([]);
});

test('formeSequence : sequence W/L REELLE (pas aleatoire comme l\'ancien genT())', () => {
  const games = [
    { homeTeam: { abbrev: 'MTL', score: 4 }, awayTeam: { abbrev: 'BOS', score: 2 } }, // W
    { homeTeam: { abbrev: 'OTT', score: 5 }, awayTeam: { abbrev: 'MTL', score: 1 } }, // L
  ];
  expect(formeSequence(games, 'MTL')).toEqual(['W', 'L']);
  // Deterministe : deux appels sur les memes donnees donnent toujours le meme resultat
  // (contrairement a Math.random() dans l'ancien CarteMatchEquipesDetaille).
  expect(formeSequence(games, 'MTL')).toEqual(formeSequence(games, 'MTL'));
});

// ===================== HockeyTicker : bandeau de scores cliquable =====================

test('HockeyTicker : cliquer sur un match du bandeau appelle onSelectMatch avec ce match', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ gameWeek: [{ games: [MATCH_BRUT] }] }) }));
  const onSelectMatch = jest.fn();
  render(<HockeyTicker onSelectMatch={onSelectMatch} />);
  await waitFor(() => expect(screen.getAllByText('MTL').length).toBeGreaterThan(0));
  fireEvent.click(screen.getAllByText('MTL')[0].closest('div'));
  expect(onSelectMatch).toHaveBeenCalledWith(expect.objectContaining({ id: 2026020001 }));
});

// ===================== Composant : AnalysesFlux =====================

function mockQuery(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, in: () => q, gte: () => q, gt: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

function mockFetch(url) {
  const u = String(url);
  let body = {};
  if (u.includes('standings/now')) body = { standings: [] };
  else if (u.includes('search.d3.nhle.com')) body = [];
  else if (u.includes('/landing')) body = { firstName: { default: 'Nick' }, lastName: { default: 'Suzuki' }, position: 'C', currentTeamAbbrev: 'MTL' };
  else if (u.includes('game-log')) body = { gameLog: [] };
  else if (u.includes('schedule/')) body = { gameWeek: [{ games: [] }] }; // calendrier vide par defaut (voir test "etats vides")
  else if (u.includes('club-schedule-season')) body = { games: [] };
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  global.fetch = jest.fn(mockFetch);
  supabase.from.mockImplementation((table) => {
    if (table === 'watchlist_items') return mockQuery({ data: [], error: null });
    if (table === 'saved_picks') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });
  supabase.channel.mockImplementation(() => ({ on: () => ({ subscribe: () => ({}) }) }));
  Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });
});

const UTILISATEUR = { id: 'u1', email: 'alex@example.com' };

test('etat vide : calendrier sans match a venir, liste de suivi vide, paris a faire vide', async () => {
  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  await waitFor(() => expect(screen.getByText('Aucun match à venir pour le moment')).toBeInTheDocument());
  expect(screen.getByText('Aucun favori')).toBeInTheDocument();
  expect(screen.getByText('Aucun pari sauvegardé')).toBeInTheDocument();
}, 15000);

test('recherche universelle : cherche un joueur, le clic ouvre un onglet', async () => {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('search.d3.nhle.com')) {
      return Promise.resolve({ json: () => Promise.resolve([{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }]) });
    }
    return mockFetch(url);
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  const input = screen.getByPlaceholderText('Rechercher un joueur ou une équipe…');
  fireEvent.change(input, { target: { value: 'suzuki' } });
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Nick Suzuki'));

  await waitFor(() => expect(screen.queryByText('Aucun match à venir pour le moment')).not.toBeInTheDocument());
  expect(screen.getAllByText(/Nick Suzuki/).length).toBeGreaterThan(0);
}, 15000);

test('onglet fermable : le bouton X ferme l\'onglet et revient au calendrier', async () => {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('search.d3.nhle.com')) {
      return Promise.resolve({ json: () => Promise.resolve([{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }]) });
    }
    return mockFetch(url);
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  const input = screen.getByPlaceholderText('Rechercher un joueur ou une équipe…');
  fireEvent.change(input, { target: { value: 'suzuki' } });
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Nick Suzuki'));
  await waitFor(() => expect(screen.queryByText('Aucun match à venir pour le moment')).not.toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('Fermer l’onglet'));
  await waitFor(() => expect(screen.getByText('Aucun match à venir pour le moment')).toBeInTheDocument());
}, 15000);

test('ouverture d\'un onglet match depuis le calendrier', async () => {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('schedule/')) return Promise.resolve({ json: () => Promise.resolve({ gameWeek: [{ games: [MATCH_BRUT] }] }) });
    return mockFetch(url);
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  // A largeur desktop, la carte de match du calendrier affiche le nom complet de l'equipe
  // ("Canadiens"), pas l'abreviation (reservee au bandeau de scores et au mode mobile) :
  // cible ce texte pour ne pas confondre les deux composants, qui affichent tous deux "MTL".
  await waitFor(() => expect(screen.getByText('Canadiens')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Canadiens').closest('div[style*="cursor: pointer"]'));

  await waitFor(() => expect(screen.getByText(/MTL @ TOR/)).toBeInTheDocument()); // libelle de l'onglet (span "🆚 MTL @ TOR")
}, 15000);

test('ajout/retrait de favori : le bouton etoile insere puis supprime dans watchlist_items', async () => {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('search.d3.nhle.com')) {
      return Promise.resolve({ json: () => Promise.resolve([{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }]) });
    }
    return mockFetch(url);
  });
  const insert = jest.fn(() => Promise.resolve({ data: null, error: null }));
  const del = jest.fn(() => mockQuery({ data: null, error: null }));
  supabase.from.mockImplementation((table) => {
    if (table === 'watchlist_items') return { select: () => mockQuery({ data: [], error: null }), insert, delete: () => ({ eq: del }) };
    if (table === 'saved_picks') return mockQuery({ data: [], error: null });
    return mockQuery({ data: [], error: null });
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  const input = screen.getByPlaceholderText('Rechercher un joueur ou une équipe…');
  fireEvent.change(input, { target: { value: 'suzuki' } });
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Nick Suzuki'));

  await waitFor(() => expect(screen.getByLabelText('Ajouter a la liste de suivi')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Ajouter a la liste de suivi'));
  await waitFor(() => expect(insert).toHaveBeenCalledWith({ user_id: 'u1', kind: 'player', ref_id: '1' }));
}, 15000);

test('sauvegarde d\'un pari : le bouton "Sauvegarder un pari" insere dans saved_picks', async () => {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('search.d3.nhle.com')) {
      return Promise.resolve({ json: () => Promise.resolve([{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }]) });
    }
    return mockFetch(url);
  });
  const insert = jest.fn(() => Promise.resolve({ data: null, error: null }));
  supabase.from.mockImplementation((table) => {
    if (table === 'watchlist_items') return mockQuery({ data: [], error: null });
    if (table === 'saved_picks') return { select: () => mockQuery({ data: [], error: null }), insert };
    return mockQuery({ data: [], error: null });
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  const input = screen.getByPlaceholderText('Rechercher un joueur ou une équipe…');
  fireEvent.change(input, { target: { value: 'suzuki' } });
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Nick Suzuki'));

  await waitFor(() => expect(screen.getByText('Sauvegarder un pari')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Sauvegarder un pari'));
  await waitFor(() => expect(screen.getByText('Sauvegarder')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Sauvegarder'));

  await waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', kind: 'player', ref_id: '1', status: 'saved' })));
}, 15000);

test('suppression d\'un pari sauvegarde depuis le panneau "Paris a faire"', async () => {
  const del = jest.fn(() => mockQuery({ data: null, error: null }));
  supabase.from.mockImplementation((table) => {
    if (table === 'watchlist_items') return mockQuery({ data: [], error: null });
    if (table === 'saved_picks') {
      return {
        select: () => mockQuery({ data: [{ id: 'pick-1', kind: 'player', ref_id: '1', label: 'Nick Suzuki', market: 'Points', line: 1.5, odds: 1.9, planned_stake: 10, status: 'saved' }], error: null }),
        delete: () => ({ eq: del }),
      };
    }
    return mockQuery({ data: [], error: null });
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Supprimer'));
  await waitFor(() => expect(del).toHaveBeenCalledWith('id', 'pick-1'));
}, 15000);

test('matchup : changement de periode de tendances (L5/L10/Saison) recalcule les stats affichees', async () => {
  const gamesMtl = {
    games: [
      { gameState: 'FINAL', homeTeam: { abbrev: 'MTL', score: 5 }, awayTeam: { abbrev: 'OTT', score: 1 } },
      { gameState: 'FINAL', homeTeam: { abbrev: 'BOS', score: 1 }, awayTeam: { abbrev: 'MTL', score: 2 } },
    ],
  };
  const gamesTor = { games: [{ gameState: 'FINAL', homeTeam: { abbrev: 'TOR', score: 3 }, awayTeam: { abbrev: 'OTT', score: 2 } }] };
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('schedule/')) return Promise.resolve({ json: () => Promise.resolve({ gameWeek: [{ games: [MATCH_BRUT] }] }) });
    if (u.includes('club-schedule-season/MTL')) return Promise.resolve({ json: () => Promise.resolve(gamesMtl) });
    if (u.includes('club-schedule-season/TOR')) return Promise.resolve({ json: () => Promise.resolve(gamesTor) });
    if (u.includes('odds-api')) return Promise.resolve({ json: () => Promise.resolve([]) });
    return mockFetch(url);
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  await waitFor(() => expect(screen.getByText('Canadiens')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Canadiens').closest('div[style*="cursor: pointer"]'));

  await waitFor(() => expect(screen.getByText('Tendances')).toBeInTheDocument());
  // Saison (par defaut L10, ici identique a Saison car moins de 10 matchs) : MTL 2 victoires.
  await waitFor(() => expect(screen.getAllByText('2-0').length).toBeGreaterThan(0));

  fireEvent.click(screen.getByText('Saison'));
  await waitFor(() => expect(screen.getAllByText('2-0').length).toBeGreaterThan(0));
}, 15000);
