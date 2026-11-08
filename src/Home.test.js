import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  HomeDashboard, computeBestWinStreak, computeTodayChangeAmount, computeTodayChangePercent,
  computeChartSeries, buildEquipeFromScheduleTeam, greetingKey, readHideAmounts, writeHideAmounts,
} from './Home';

jest.mock('./Analyses', () => ({
  useIsMobile: jest.fn(() => false),
  getDateStr: (d) => d.toISOString().slice(0, 10),
}));

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const { useIsMobile } = require('./Analyses');
const { supabase } = require('./supabase');

// ===================== Fonctions pures =====================

test('computeBestWinStreak : trouve la plus longue serie de victoires consecutives', () => {
  expect(computeBestWinStreak([{ statut: 'gagne' }, { statut: 'gagne' }, { statut: 'perdu' }, { statut: 'gagne' }])).toBe(2);
  expect(computeBestWinStreak([{ statut: 'perdu' }, { statut: 'perdu' }])).toBe(0);
  expect(computeBestWinStreak([])).toBe(0);
});

test('computeTodayChangeAmount : additionne seulement les paris regles aujourd\'hui (manuels + importes)', () => {
  const today = '2026-11-08';
  const paris = [
    { statut: 'gagne', date_pari: '2026-11-08T10:00:00Z', profit: 50 },
    { statut: 'perdu', date_pari: '2026-11-07T10:00:00Z', profit: -20 }, // hier : ignore
    { statut: 'actif', date_pari: '2026-11-08T10:00:00Z', profit: 0 }, // actif : ignore
  ];
  const betsAuto = [{ statut: 'gagne', verified_at: '2026-11-08T12:00:00Z', resultat: 10 }];
  expect(computeTodayChangeAmount(paris, betsAuto, today)).toBe(60);
});

test('computeTodayChangePercent : rapport a la bankroll AVANT la variation', () => {
  expect(computeTodayChangePercent(50, 550)).toBeCloseTo(10, 5); // avant = 500
  expect(computeTodayChangePercent(0, 0)).toBe(0); // division par zero evitee
});

test('computeChartSeries : mode valeur = profit cumulatif, mode rendement = % cumule', () => {
  const paris = [
    { date_pari: new Date().toISOString(), profit: 10, mise: 100 },
    { date_pari: new Date().toISOString(), profit: -5, mise: 50 },
  ];
  const value = computeChartSeries(paris, 'all', 'value');
  expect(value.finalValue).toBeCloseTo(5);
  const ret = computeChartSeries(paris, 'all', 'return');
  expect(ret.finalValue).toBeCloseTo((5 / 150) * 100);
});

test('buildEquipeFromScheduleTeam : convertit un objet equipe du calendrier NHL pour FicheEquipeWS', () => {
  const equipe = buildEquipeFromScheduleTeam({ abbrev: 'MTL', placeName: { default: 'Montréal' }, logo: 'logo.svg' });
  expect(equipe.teamAbbrev.default).toBe('MTL');
  expect(equipe.teamName.default).toBe('Montréal');
  expect(equipe.teamLogo).toBe('logo.svg');
  expect(buildEquipeFromScheduleTeam(null)).toBeNull();
});

test('greetingKey : matin/apres-midi/soir selon l\'heure', () => {
  expect(greetingKey(new Date('2026-01-01T08:00:00'))).toBe('home_greeting_morning');
  expect(greetingKey(new Date('2026-01-01T14:00:00'))).toBe('home_greeting_afternoon');
  expect(greetingKey(new Date('2026-01-01T20:00:00'))).toBe('home_greeting_evening');
});

test('readHideAmounts/writeHideAmounts : try/catch si localStorage indisponible', () => {
  const original = window.localStorage;
  Object.defineProperty(window, 'localStorage', { value: { getItem() { throw new Error('indisponible'); }, setItem() { throw new Error('indisponible'); } }, configurable: true });
  expect(() => writeHideAmounts(true)).not.toThrow();
  expect(readHideAmounts()).toBe(false); // repli silencieux
  Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
});

// ===================== Composant : mise en page desktop/tablette (>=768px) =====================

function tableResult(table) {
  const map = {
    profiles: { data: { first_name: 'Alex' }, error: null },
    bankroll: { data: { montant: 500 }, error: null },
    paris: { data: [], error: null },
    bets_auto: { data: [], error: null },
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

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  supabase.from.mockImplementation((table) => mockQuery(tableResult(table)));
  supabase.rpc.mockResolvedValue({ data: [], error: null });
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ gameWeek: [] }) }));
});

const noop = () => {};

test('desktop/tablette : etats vides affiches pour pools, favoris, calendrier, matchs et idees quand aucune donnee', async () => {
  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onGoToPool={noop} onOpenTeamFiche={noop} />);

  await waitFor(() => expect(screen.getByText("Vous n'êtes dans aucun pool")).toBeInTheDocument());
  expect(screen.getByText(/suivi des joueurs et équipes favoris/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Aucun match')).toBeInTheDocument()); // calendrier vide
  expect(screen.getByText('Aucun match ce jour')).toBeInTheDocument(); // carte matchs vide
  await waitFor(() => expect(screen.getByText(/Pas assez de matchs récents/)).toBeInTheDocument());
  expect(screen.getByText(/EV \/ Arbitrage/)).toBeInTheDocument(); // carte Elite toujours visible
  expect(screen.getByText('Elite')).toBeInTheDocument();
});

test('desktop/tablette : la carte Mes pools affiche le rang et les points quand get_pool_standings repond', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_members') {
      return mockQuery({ data: [{ id: 'member-1', pool: { id: 'pool-1', name: 'Pool Test', status: 'active' } }], error: null });
    }
    return mockQuery(tableResult(table));
  });
  supabase.rpc.mockResolvedValue({ data: [{ member_id: 'member-1', rank: 2, total_points: 42.5 }], error: null });

  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onGoToPool={noop} onOpenTeamFiche={noop} />);

  await waitFor(() => expect(screen.getByText('Pool Test')).toBeInTheDocument());
  expect(screen.getByText(/#2/)).toBeInTheDocument();
  expect(screen.getByText(/42.5/)).toBeInTheDocument();
});

test('desktop/tablette : le bouton Ouvrir d\'un pool declenche onGoToPool avec le bon id', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'pool_members') {
      return mockQuery({ data: [{ id: 'member-1', pool: { id: 'pool-42', name: 'Pool Test', status: 'active' } }], error: null });
    }
    return mockQuery(tableResult(table));
  });
  supabase.rpc.mockResolvedValue({ data: [{ member_id: 'member-1', rank: 1, total_points: 10 }], error: null });
  const onGoToPool = jest.fn();

  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onGoToPool={onGoToPool} onOpenTeamFiche={noop} />);

  await waitFor(() => expect(screen.getByText('Pool Test')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Ouvrir'));
  expect(onGoToPool).toHaveBeenCalledWith('pool-42');
});

test('desktop/tablette : bouton oeil masque/affiche le montant de la bankroll', async () => {
  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onGoToPool={noop} onOpenTeamFiche={noop} />);

  await waitFor(() => expect(screen.getByText('$500.00')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Masquer les montants'));
  expect(screen.getAllByText('•••••').length).toBeGreaterThan(0); // bankroll ET variation du jour sont tous deux masques
  expect(screen.queryByText('$500.00')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Afficher les montants'));
  await waitFor(() => expect(screen.getByText('$500.00')).toBeInTheDocument());
});

test('desktop/tablette : la carte Idees du jour affiche le joueur chaud et la serie quand les donnees existent', async () => {
  supabase.from.mockImplementation((table) => {
    if (table === 'nhl_games') return mockQuery({ data: [{ game_id: 1, game_date: '2026-11-07' }], error: null });
    if (table === 'nhl_player_game_stats') return mockQuery({ data: [{ player_id: 99, player_name: 'J. Testeur', team_abbrev: 'MTL', points: 5, game_id: 1 }], error: null });
    if (table === 'nhl_team_game_results') return mockQuery({ data: [{ team_abbrev: 'MTL', result: 'W', game_id: 1 }, { team_abbrev: 'MTL', result: 'W', game_id: 1 }], error: null });
    return mockQuery(tableResult(table));
  });

  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onGoToPool={noop} onOpenTeamFiche={noop} />);

  await waitFor(() => expect(screen.getByText(/J\. Testeur/)).toBeInTheDocument());
});

test('desktop/tablette : la carte Elite ouvre un message "Bientôt disponible" (pas de vraie logique de paywall)', async () => {
  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} onGoToPool={noop} onOpenTeamFiche={noop} />);

  await waitFor(() => expect(screen.getByText('Elite')).toBeInTheDocument());
  fireEvent.click(screen.getByText(/EV \/ Arbitrage/));
  expect(screen.getByText('Bientôt disponible')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Fermer'));
  expect(screen.queryByText('Bientôt disponible')).not.toBeInTheDocument();
});

// ===================== Mobile (<768px) : comportement actuel inchange =====================

test('mobile : affiche le libelle de bienvenue existant, pas le bandeau desktop ni les nouvelles cartes', async () => {
  useIsMobile.mockReturnValue(true);
  render(<HomeDashboard utilisateur={{ id: 'u1', email: 'alex@example.com' }} lang="fr" onGoToBets={noop} />);

  await waitFor(() => expect(screen.getByText('Bon retour')).toBeInTheDocument());
  expect(screen.queryByText("Mes pools")).not.toBeInTheDocument();
  expect(screen.queryByText('Favoris')).not.toBeInTheDocument();
  expect(screen.queryByText(/Idées du jour/)).not.toBeInTheDocument();
});
