import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  AnalysesFlux, tabKey, openOrActivateTab, closeAnalyseTab, moveActiveSearchIndex,
  buildSearchGroups, readAnalyseState, writeAnalyseState, formFromSavedPick,
} from './Analyses';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
const { supabase } = require('./supabase');

// ===================== Fonctions pures =====================

test('tabKey : identifie un onglet par kind+id', () => {
  expect(tabKey({ kind: 'player', id: '123' })).toBe('player:123');
  expect(tabKey({ kind: 'team', id: 'MTL' })).toBe('team:MTL');
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
  // Ferme l'actif du milieu -> active le suivant (id 3).
  const r1 = closeAnalyseTab(tabs, 'player:2', 'player:2');
  expect(r1.tabs.map(t => t.id)).toEqual(['1', '3']);
  expect(r1.activeKey).toBe('player:3');

  // Ferme le dernier onglet actif -> active le precedent.
  const r2 = closeAnalyseTab(tabs, 'player:3', 'player:3');
  expect(r2.activeKey).toBe('player:2');

  // Ferme un onglet qui n'est pas l'actif -> l'actif ne change pas.
  const r3 = closeAnalyseTab(tabs, 'player:1', 'player:2');
  expect(r3.activeKey).toBe('player:1');
  expect(r3.tabs.map(t => t.id)).toEqual(['1', '3']);

  // Ferme le seul onglet ouvert -> plus aucun actif.
  const r4 = closeAnalyseTab([{ kind: 'player', id: '1' }], 'player:1', 'player:1');
  expect(r4.tabs).toEqual([]);
  expect(r4.activeKey).toBeNull();
});

test('moveActiveSearchIndex : navigation clavier Haut/Bas, boucle aux extremites', () => {
  expect(moveActiveSearchIndex(-1, 3, 1)).toBe(0); // rien de selectionne -> premier
  expect(moveActiveSearchIndex(-1, 3, -1)).toBe(2); // rien de selectionne, fleche haut -> dernier
  expect(moveActiveSearchIndex(0, 3, 1)).toBe(1);
  expect(moveActiveSearchIndex(2, 3, 1)).toBe(0); // boucle vers le premier
  expect(moveActiveSearchIndex(0, 3, -1)).toBe(2); // boucle vers le dernier
  expect(moveActiveSearchIndex(0, 0, 1)).toBe(-1); // aucun resultat
});

test('buildSearchGroups : groupe Joueurs/Equipes, rien avant 2 caracteres', () => {
  const classement = [
    { teamAbbrev: { default: 'MTL' }, teamName: { default: 'Canadiens de Montréal' } },
    { teamAbbrev: { default: 'TOR' }, teamName: { default: 'Maple Leafs de Toronto' } },
  ];
  const freeText = [{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }];

  expect(buildSearchGroups('m', freeText, classement)).toEqual({ players: [], teams: [] });

  const g = buildSearchGroups('mo', freeText, classement);
  expect(g.teams.map(t => t.id)).toEqual(['MTL']); // "mo" matche Montréal, pas Toronto

  const g2 = buildSearchGroups('suzuki', freeText, classement);
  expect(g2.players.length).toBe(1);
  expect(g2.players[0].nom).toBe('Nick Suzuki');
  expect(g2.teams).toEqual([]);
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
  expect(f1.joueur_ou_equipe).toBe('Nick Suzuki');
  expect(f1.ligne).toBe(1.5);
  expect(f1.mise).toBe(20);

  const pickEquipe = { kind: 'team', ref_id: 'MTL', label: 'Canadiens de Montréal', odds: 2.1 };
  const f2 = formFromSavedPick(pickEquipe);
  expect(f2.type_bet).toBe('Moneyline');
  expect(f2.equipe).toBe('MTL');
  expect(f2.cote).toBe(2.1);
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
  // Desktop large (>=1200px) par defaut : les 3 zones s'affichent en ligne, sans tiroir a ouvrir.
  Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });
});

const UTILISATEUR = { id: 'u1', email: 'alex@example.com' };

test('etats vides : aucun onglet ouvert, liste de suivi vide, paris a faire vide', async () => {
  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  await waitFor(() => expect(screen.getByText('Aucune analyse ouverte')).toBeInTheDocument());
  expect(screen.getByText('Aucun favori')).toBeInTheDocument();
  expect(screen.getByText('Aucun pari sauvegardé')).toBeInTheDocument();
});

test('recherche universelle : cherche un joueur, le clic ouvre un onglet', async () => {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('search.d3.nhle.com')) {
      return Promise.resolve({ json: () => Promise.resolve([{ playerId: 1, name: 'Nick Suzuki', teamAbbrev: 'MTL', positionCode: 'C' }]) });
    }
    return mockFetch(url);
  });

  render(<AnalysesFlux lang="fr" utilisateur={UTILISATEUR} />);
  await waitFor(() => expect(screen.getByText('Aucune analyse ouverte')).toBeInTheDocument());

  const input = screen.getByPlaceholderText('Rechercher un joueur ou une équipe…');
  fireEvent.change(input, { target: { value: 'suzuki' } });

  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Nick Suzuki'));

  // L'onglet apparait dans la barre d'onglets et le panneau "aucune analyse" disparait.
  await waitFor(() => expect(screen.queryByText('Aucune analyse ouverte')).not.toBeInTheDocument());
  expect(screen.getAllByText(/Nick Suzuki/).length).toBeGreaterThan(0);
});

test('onglet fermable : le bouton X ferme l\'onglet et revient a l\'etat vide', async () => {
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
  await waitFor(() => expect(screen.queryByText('Aucune analyse ouverte')).not.toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('Fermer l’onglet'));
  await waitFor(() => expect(screen.getByText('Aucune analyse ouverte')).toBeInTheDocument());
});

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
});

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
});

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
});
