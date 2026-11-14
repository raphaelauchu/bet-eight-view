import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FicheJoueurStats } from './Analyses';
import { _resetCacheSaisonCourante } from './season';

// Saison "courante" utilisee par tous les tests : doit correspondre a ce que standings-season
// renvoie ci-dessous (20262027), jamais a une saison figee en dur.
const SAISON_ACTUELLE = 20262027;
const SAISON_PRECEDENTE = 20252026;

const JOUEUR_PATINEUR = { id: 8480018, nom: 'Nick Suzuki', equipe: 'MTL', position: 'C', numero: 14 };
const JOUEUR_GARDIEN = { id: 8479361, nom: 'Jake Allen', equipe: 'MTL', position: 'G', numero: 34 };

const LANDING_PATINEUR = {
  headshot: 'https://assets.nhle.com/mugs/nhl/20262027/MTL/8480018.png',
  teamLogo: 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg',
  currentTeamAbbrev: 'MTL',
  fullTeamName: { default: 'Canadiens de Montréal' },
  firstName: { default: 'Nick' },
  lastName: { default: 'Suzuki' },
  position: 'C',
  sweaterNumber: 14,
  heightInInches: 71,
  weightInPounds: 192,
  birthDate: '2001-08-10',
  birthCity: { default: 'London' },
  birthCountry: 'CAN',
  shootsCatches: 'L',
  draftDetails: { year: 2019, round: 1, overallPick: 13, teamAbbrev: 'MTL' },
  seasonTotals: [
    { season: SAISON_PRECEDENTE, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 82, goals: 28, assists: 61, points: 89, plusMinus: 10, pim: 20 },
    { season: SAISON_ACTUELLE, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 10, goals: 5, assists: 7, points: 12, plusMinus: 3, powerPlayPoints: 2, shots: 30, faceoffWinningPctg: 0.52, avgToi: '18:30', pim: 8 },
  ],
};

const LANDING_GARDIEN = {
  headshot: 'https://assets.nhle.com/mugs/nhl/20262027/MTL/8479361.png',
  teamLogo: 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg',
  currentTeamAbbrev: 'MTL',
  fullTeamName: { default: 'Canadiens de Montréal' },
  firstName: { default: 'Jake' },
  lastName: { default: 'Allen' },
  position: 'G',
  sweaterNumber: 34,
  heightInInches: 75,
  weightInPounds: 206,
  birthDate: '1990-08-07',
  birthCity: { default: 'Fredericton' },
  birthCountry: 'CAN',
  shootsCatches: 'L',
  draftDetails: { year: 2008, round: 2, overallPick: 34, teamAbbrev: 'STL' },
  seasonTotals: [
    { season: SAISON_PRECEDENTE, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 40, wins: 18, losses: 15, goalsAgainstAvg: 2.80, savePctg: 0.901, shutouts: 2 },
    { season: SAISON_ACTUELLE, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 8, wins: 5, losses: 3, goalsAgainstAvg: 2.45, savePctg: 0.912, shutouts: 1 },
  ],
};

function buildMockFetch(landing) {
  return jest.fn((url) => {
    const u = String(url);
    if (u.includes('standings-season')) return Promise.resolve({ json: () => Promise.resolve({ seasons: [{ id: SAISON_ACTUELLE }] }) });
    if (u.includes('/landing')) return Promise.resolve({ json: () => Promise.resolve(landing) });
    if (u.includes('game-log')) return Promise.resolve({ json: () => Promise.resolve({ gameLog: [] }) });
    if (u.includes('skater/realtime')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ hits: 4, blockedShots: 2 }] }) });
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetCacheSaisonCourante();
});

test('fiche profil patineur : header NHL Edge, bio, stats de la saison en cours et bouton Analyser', async () => {
  global.fetch = buildMockFetch(LANDING_PATINEUR);
  const onAnalyser = jest.fn();
  render(<FicheJoueurStats joueur={JOUEUR_PATINEUR} onBack={() => {}} onAnalyser={onAnalyser} />);

  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());

  // En-tete : position, nom d'equipe complet + abreviation, numero, main.
  expect(screen.getByText(/C · Canadiens de Montréal \(MTL\) · #14 · G/)).toBeInTheDocument();

  // Bio.
  expect(screen.getByText("5'11\"")).toBeInTheDocument();
  expect(screen.getByText('192 lb')).toBeInTheDocument();
  expect(screen.getByText('CAN')).toBeInTheDocument(); // Nationalite
  expect(screen.getByText(/2019 · Ronde 1, 13e au total/)).toBeInTheDocument();

  // Stats de la SAISON EN COURS (2026-27) par defaut -- jamais la saison precedente (bogue corrige).
  await waitFor(() => expect(screen.getByText('Saison 2026-27')).toBeInTheDocument());
  expect(screen.getByText('12')).toBeInTheDocument(); // PTS saison 2026-27
  expect(screen.queryByText('89')).not.toBeInTheDocument(); // PTS saison 2025-26 (ne doit pas s'afficher ici)
  expect(screen.queryByText('Aucun match cette saison.')).not.toBeInTheDocument();

  // Bouton Analyser.
  fireEvent.click(screen.getByText('Analyser'));
  expect(onAnalyser).toHaveBeenCalledWith(JOUEUR_PATINEUR);
});

test('selecteur Carriere (patineur) : saison en cours en haut, +/- et PUN inclus', async () => {
  global.fetch = buildMockFetch(LANDING_PATINEUR);
  render(<FicheJoueurStats joueur={JOUEUR_PATINEUR} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Carrière'));
  expect(screen.getByText('Statistiques de carrière')).toBeInTheDocument();
  ['Saison', 'Équipe', 'PJ', 'B', 'A', 'PTS', '+/-', 'PUN'].forEach(h => {
    expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
  });

  // La saison en cours (2026-27, incomplete) apparait en premiere ligne, avant 2025-26.
  const lignes = screen.getAllByRole('row').slice(1); // ignore l'entete
  expect(lignes[0]).toHaveTextContent('2026-27');
  expect(lignes[1]).toHaveTextContent('2025-26');
});

test('fiche profil gardien : stats GAA/SV% de la saison en cours et tableau carriere PJ/V/MOY/%ARR/BL', async () => {
  global.fetch = buildMockFetch(LANDING_GARDIEN);
  render(<FicheJoueurStats joueur={JOUEUR_GARDIEN} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText('Jake Allen')).toBeInTheDocument());

  expect(screen.getByText('2.45')).toBeInTheDocument(); // GAA saison 2026-27 (pas 2.80, saison 2025-26)
  expect(screen.getByText('91.2%')).toBeInTheDocument(); // SV% saison 2026-27

  fireEvent.click(screen.getByText('Carrière'));
  ['Saison', 'Équipe', 'PJ', 'V', 'MOY', '%ARR', 'BL'].forEach(h => {
    expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
  });
});

test('joueur sans match cette saison : zeros affiches avec message explicite, pas de repli sur la saison precedente', async () => {
  const landingRecrue = { ...LANDING_PATINEUR, seasonTotals: [LANDING_PATINEUR.seasonTotals[0]] }; // seule la saison precedente existe
  global.fetch = buildMockFetch(landingRecrue);
  render(<FicheJoueurStats joueur={JOUEUR_PATINEUR} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());

  await waitFor(() => expect(screen.getByText('Aucun match cette saison.')).toBeInTheDocument());
  expect(screen.getByText('Saison 2026-27')).toBeInTheDocument();
  // Zeros affiches (G/A/PTS), jamais les stats de la saison precedente (89 PTS) utilisees en silence.
  expect(screen.queryByText('89')).not.toBeInTheDocument();
  const zeros = screen.getAllByText('0');
  expect(zeros.length).toBeGreaterThan(0);
});

test('bio absente : etat vide propre, rien d\'invente', async () => {
  const landingSansBio = {
    ...LANDING_PATINEUR,
    heightInInches: undefined,
    weightInPounds: undefined,
    birthDate: undefined,
    birthCity: undefined,
    birthCountry: undefined,
    draftDetails: undefined,
  };
  global.fetch = buildMockFetch(landingSansBio);
  render(<FicheJoueurStats joueur={JOUEUR_PATINEUR} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());

  expect(screen.getByText('Non repêché')).toBeInTheDocument();
  // Taille/Poids/Age/Naissance/Lieu/Nationalite absents : affiches en '-', jamais de valeur fabriquee.
  const tirets = screen.getAllByText('-');
  expect(tirets.length).toBeGreaterThanOrEqual(5);
});
