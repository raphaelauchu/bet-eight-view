import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FicheJoueurStats } from './Analyses';

const JOUEUR_PATINEUR = { id: 8480018, nom: 'Nick Suzuki', equipe: 'MTL', position: 'C', numero: 14 };
const JOUEUR_GARDIEN = { id: 8479361, nom: 'Jake Allen', equipe: 'MTL', position: 'G', numero: 34 };

const LANDING_PATINEUR = {
  headshot: 'https://assets.nhle.com/mugs/nhl/20252026/MTL/8480018.png',
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
    { season: 20252026, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 10, goals: 5, assists: 7, points: 12, plusMinus: 3, powerPlayPoints: 2, shots: 30, faceoffWinningPctg: 0.52, avgToi: '18:30', pim: 8 },
    { season: 20242025, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 82, goals: 28, assists: 61, points: 89, plusMinus: 10, pim: 20 },
  ],
};

const LANDING_GARDIEN = {
  headshot: 'https://assets.nhle.com/mugs/nhl/20252026/MTL/8479361.png',
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
    { season: 20252026, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 8, wins: 5, losses: 3, goalsAgainstAvg: 2.45, savePctg: 0.912, shutouts: 1 },
    { season: 20242025, gameTypeId: 2, leagueAbbrev: 'NHL', teamCommonName: { default: 'Canadiens' }, gamesPlayed: 40, wins: 18, losses: 15, goalsAgainstAvg: 2.80, savePctg: 0.901, shutouts: 2 },
  ],
};

function buildMockFetch(landing) {
  return jest.fn((url) => {
    const u = String(url);
    if (u.includes('/landing')) return Promise.resolve({ json: () => Promise.resolve(landing) });
    if (u.includes('game-log')) return Promise.resolve({ json: () => Promise.resolve({ gameLog: [] }) });
    if (u.includes('skater/realtime')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ hits: 4, blockedShots: 2 }] }) });
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('fiche profil patineur : header NHL Edge, bio, stats de saison et bouton Analyser', async () => {
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

  // Stats de la saison en cours (vue par defaut).
  expect(screen.getByText('Saison régulière')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument(); // PTS saison

  // Bouton Analyser.
  fireEvent.click(screen.getByText('Analyser'));
  expect(onAnalyser).toHaveBeenCalledWith(JOUEUR_PATINEUR);
});

test('selecteur Carriere (patineur) : tableau saison par saison avec +/- et PUN', async () => {
  global.fetch = buildMockFetch(LANDING_PATINEUR);
  render(<FicheJoueurStats joueur={JOUEUR_PATINEUR} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText('Nick Suzuki')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Carrière'));
  expect(screen.getByText('Statistiques de carrière')).toBeInTheDocument();
  ['Saison', 'Équipe', 'PJ', 'B', 'A', 'PTS', '+/-', 'PUN'].forEach(h => {
    expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
  });
  expect(screen.getByText('89')).toBeInTheDocument(); // PTS saison 2024-25
});

test('fiche profil gardien : stats GP/W/L/GAA/SV%/SO et tableau carriere PJ/V/MOY/%ARR/BL', async () => {
  global.fetch = buildMockFetch(LANDING_GARDIEN);
  render(<FicheJoueurStats joueur={JOUEUR_GARDIEN} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText('Jake Allen')).toBeInTheDocument());

  expect(screen.getByText('2.45')).toBeInTheDocument(); // GAA saison
  expect(screen.getByText('91.2%')).toBeInTheDocument(); // SV% saison

  fireEvent.click(screen.getByText('Carrière'));
  ['Saison', 'Équipe', 'PJ', 'V', 'MOY', '%ARR', 'BL'].forEach(h => {
    expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
  });
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
