import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PoolStandings, TeamRosterPanel } from './PoolDraftRoom';

// Regression test pour le bogue "clic sur un participant affiche toujours MON equipe" :
// PoolStandings passait un prop `member` a MemberDetailPanel, qui attend `initialMemberId`
// -- l'ancien composant retombait donc toujours sur members[0] (voir 20261110 commit).
jest.mock('./supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

jest.mock('./Analyses', () => ({
  useIsMobile: jest.fn(() => false),
  useSaisonCourante: () => '20252026',
}));

const { supabase } = require('./supabase');
const { useIsMobile } = require('./Analyses');

const POOL = { id: 'pool-1', rules: { poolType: 'classic', display: 'team', salaryCap: { enabled: false } } };

// Alice = premiere dans l'ordre du selecteur (members[]) ; Dave = dernier ; Moi = utilisateur
// courant, ni premier ni dernier. Classement (rang) volontairement dans un ORDRE DIFFERENT
// de members[], pour distinguer "premiere ligne du tableau" de "premier du selecteur".
const MEMBERS = [
  { id: 'm-alice', user_id: 'u-alice', display_name: 'Alice', team_name: 'Equipe Alice' },
  { id: 'm-moi', user_id: 'u-moi', display_name: 'Moi', team_name: 'Mon Equipe' },
  { id: 'm-zach', user_id: 'u-zach', display_name: 'Zach', team_name: 'Equipe Zach' },
  { id: 'm-dave', user_id: 'u-dave', display_name: 'Dave', team_name: 'Equipe Dave' },
];

const STANDINGS_ROWS = [
  { member_id: 'm-dave', display_name: 'Dave', team_name: 'Equipe Dave', rank: 1, today_games_played: 0, today_points: 0, today_avg: 0, total_games_played: 10, total_points: 50, total_avg: 5, total_diff: 0, yesterday_points: 0 },
  { member_id: 'm-alice', display_name: 'Alice', team_name: 'Equipe Alice', rank: 2, today_games_played: 0, today_points: 0, today_avg: 0, total_games_played: 10, total_points: 40, total_avg: 4, total_diff: 10, yesterday_points: 0 },
  { member_id: 'm-zach', display_name: 'Zach', team_name: 'Equipe Zach', rank: 3, today_games_played: 0, today_points: 0, today_avg: 0, total_games_played: 10, total_points: 30, total_avg: 3, total_diff: 20, yesterday_points: 0 },
  { member_id: 'm-moi', display_name: 'Moi', team_name: 'Mon Equipe', rank: 4, today_games_played: 0, today_points: 0, today_avg: 0, total_games_played: 10, total_points: 20, total_avg: 2, total_diff: 30, yesterday_points: 0 },
];

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  supabase.rpc.mockImplementation((fn) => {
    if (fn === 'get_pool_standings') return Promise.resolve({ data: STANDINGS_ROWS, error: null });
    if (fn === 'get_pool_top_scorers_today') return Promise.resolve({ data: [], error: null });
    if (fn === 'get_member_breakdown') return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: null, error: null });
  });
  supabase.from.mockImplementation(() => ({
    select: () => ({
      order: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }));
});

// L'en-tete du detail (nom du participant AFFICHE) est un <div> de ce style precis -- distinct
// des <option> du selecteur, qui portent le MEME libelle (ex. "Equipe Dave" dans l'option ET
// dans l'en-tete une fois ce participant selectionne). On cible explicitement le <div> pour ne
// pas avoir un "multiple elements" sur un libelle qui apparait legitimement deux fois a l'ecran.
function headerText() {
  return document.querySelector('div[style*="font-size: 16px"][style*="font-weight: 800"]')?.textContent;
}

async function renderStandings() {
  render(<PoolStandings pool={POOL} members={MEMBERS} utilisateur={{ id: 'u-moi' }} lang="fr" isCommissioner={false} />);
  await waitFor(() => expect(screen.getByText('Dave')).toBeInTheDocument());
}

test('cliquer sur la premiere ligne du classement (Dave, rang 1) affiche l\'equipe de Dave', async () => {
  await renderStandings();
  fireEvent.click(screen.getByText('Dave'));
  await waitFor(() => expect(headerText()).toBe('Equipe Dave'));
});

test('cliquer sur la derniere ligne du classement (Moi, rang 4) affiche mon equipe', async () => {
  await renderStandings();
  fireEvent.click(screen.getByText('Moi'));
  await waitFor(() => expect(headerText()).toBe('Mon Equipe'));
});

test('cliquer sur un participant du milieu (Alice) affiche l\'equipe d\'Alice, pas la premiere du selecteur', async () => {
  await renderStandings();
  fireEvent.click(screen.getByText('Alice'));
  await waitFor(() => expect(headerText()).toBe('Equipe Alice'));
});

test('le selecteur reflete le participant affiche et permet de changer d\'equipe sans revenir au classement', async () => {
  await renderStandings();
  fireEvent.click(screen.getByText('Zach'));
  await waitFor(() => expect(headerText()).toBe('Equipe Zach'));

  const select = screen.getByRole('combobox');
  expect(select.value).toBe('m-zach');

  fireEvent.change(select, { target: { value: 'm-dave' } });
  await waitFor(() => expect(headerText()).toBe('Equipe Dave'));
  expect(select.value).toBe('m-dave');

  // Sur iPad/web (useIsMobile mocke a false ici), le tableau du classement reste visible a
  // cote de la fiche du participant selectionne (voir .pool-standings-shell) -- on ne revient
  // PAS a un etat "tableau seul", mais le tableau n'est jamais remplace non plus.
  expect(screen.queryByRole('table')).toBeInTheDocument();
});

test('les fleches precedent/suivant changent d\'equipe en conservant la periode selectionnee', async () => {
  await renderStandings();
  fireEvent.click(screen.getByText('Alice')); // Alice = members[0]
  await waitFor(() => expect(headerText()).toBe('Equipe Alice'));

  // Change la periode avant de naviguer : doit rester sur "Jour" apres le changement d'equipe.
  fireEvent.click(screen.getByText('Jour'));

  fireEvent.click(screen.getByLabelText('Participant suivant'));
  await waitFor(() => expect(headerText()).toBe('Mon Equipe')); // members[1] = Moi

  const jourBtn = screen.getByText('Jour');
  expect(jourBtn.style.backgroundColor).toBe('rgb(249, 115, 22)'); // toujours actif (periode conservee)

  fireEvent.click(screen.getByLabelText('Participant précédent'));
  await waitFor(() => expect(headerText()).toBe('Equipe Alice'));

  // Fleche precedente depuis le premier (Alice, index 0) doit boucler vers le dernier (Dave).
  fireEvent.click(screen.getByLabelText('Participant précédent'));
  await waitFor(() => expect(headerText()).toBe('Equipe Dave'));
});

test('l\'onglet "Mon equipe" (TeamRosterPanel) affiche toujours mon equipe, independamment du classement', async () => {
  render(<TeamRosterPanel pool={POOL} members={MEMBERS} lang="fr" viewedMemberId="m-moi" />);
  await waitFor(() => expect(headerText()).toBe('Mon Equipe'));
});

test('iPad/web : le tableau du classement reste visible a cote de la fiche du participant selectionne', async () => {
  useIsMobile.mockReturnValue(false);
  await renderStandings();
  fireEvent.click(screen.getByText('Dave'));
  await waitFor(() => expect(headerText()).toBe('Equipe Dave'));
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByText('Dave')).toBeInTheDocument(); // toujours dans le tableau
});

test('mobile (<768px) : cliquer un participant remplace toujours le tableau par sa fiche (comportement inchange)', async () => {
  useIsMobile.mockReturnValue(true);
  await renderStandings();
  fireEvent.click(screen.getByText('Dave'));
  await waitFor(() => expect(headerText()).toBe('Equipe Dave'));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
