import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileSetup from './ProfileSetup';

// ===================== Porte d'entree "Complete ton profil" -- formulaire isole =====================
// Voir src/AppProfileSetup.test.js pour l'integration complete a travers App() (ordre profil ->
// onboarding -> app, bouton retour, deconnexion). `resetMocks: true` (CRA) oblige a reposer
// l'implementation de supabase.from/rpc dans beforeEach, jamais dans la factory jest.mock (meme
// piege que Auth.test.js).
jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));
const { supabase } = require('./supabase');

const UTILISATEUR = { id: 'u1', user_metadata: { given_name: 'Alex', family_name: 'Tremblay' } };

function mockProfilesVide() {
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfilesVide();
  supabase.rpc.mockResolvedValue({ data: true, error: null });
});

function setup(props = {}) {
  const onComplete = jest.fn();
  const onLogout = jest.fn();
  const onOpenLegal = jest.fn();
  const utils = render(<ProfileSetup utilisateur={UTILISATEUR} lang="fr" onComplete={onComplete} onLogout={onLogout} onOpenLegal={onOpenLegal} {...props} />);
  return { ...utils, onComplete, onLogout, onOpenLegal };
}

async function attendreChargement() {
  await screen.findByText('Complète ton profil');
}

test('prefill prenom/nom depuis user_metadata (given_name/family_name, style Google)', async () => {
  setup();
  await attendreChargement();
  expect(screen.getByPlaceholderText('Prénom')).toHaveValue('Alex');
  expect(screen.getByPlaceholderText('Nom de famille')).toHaveValue('Tremblay');
});

test('prefill via full_name (decoupage sur le premier espace) si given_name/family_name absents', async () => {
  setup({ utilisateur: { id: 'u2', user_metadata: { full_name: 'Sam Lavoie' } } });
  await attendreChargement();
  expect(screen.getByPlaceholderText('Prénom')).toHaveValue('Sam');
  expect(screen.getByPlaceholderText('Nom de famille')).toHaveValue('Lavoie');
});

test('nom d\'utilisateur : format invalide affiche immediatement, sans appeler la RPC', async () => {
  setup();
  await attendreChargement();
  fireEvent.change(screen.getByPlaceholderText('Choisir un nom d\'utilisateur'), { target: { value: 'ab' } });
  await waitFor(() => expect(screen.getByText('3 à 20 caractères : lettres, chiffres, _ ou .')).toBeInTheDocument());
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test('nom d\'utilisateur : mot reserve bloque immediatement, sans appeler la RPC', async () => {
  setup();
  await attendreChargement();
  fireEvent.change(screen.getByPlaceholderText('Choisir un nom d\'utilisateur'), { target: { value: 'admin' } });
  await waitFor(() => expect(screen.getByText('3 à 20 caractères : lettres, chiffres, _ ou .')).toBeInTheDocument());
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test('nom d\'utilisateur : disponible (RPC apres debounce de 400ms)', async () => {
  setup();
  await attendreChargement();
  fireEvent.change(screen.getByPlaceholderText('Choisir un nom d\'utilisateur'), { target: { value: 'nouvelalex' } });
  await waitFor(() => expect(screen.getByText('Disponible')).toBeInTheDocument(), { timeout: 2000 });
  expect(supabase.rpc).toHaveBeenCalledWith('is_username_available', { p_username: 'nouvelalex' });
});

test('nom d\'utilisateur : deja pris (RPC renvoie false)', async () => {
  supabase.rpc.mockResolvedValue({ data: false, error: null });
  setup();
  await attendreChargement();
  fireEvent.change(screen.getByPlaceholderText('Choisir un nom d\'utilisateur'), { target: { value: 'dejapris' } });
  await waitFor(() => expect(screen.getByText('Déjà pris')).toBeInTheDocument(), { timeout: 2000 });
});

test('age minimum : bloque sous l\'age minimum de la region (Quebec, 18 ans), aucune donnee enregistree', async () => {
  const { onComplete } = setup();
  await attendreChargement();
  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: 'QC' } }); // pays par defaut deja CA
  const anneeRecente = new Date().getFullYear() - 16;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeRecente}-01-01` } });
  await waitFor(() => expect(screen.getByText('Tu dois avoir au moins 18 ans dans ta région pour utiliser Betrics.')).toBeInTheDocument());
  expect(screen.getByText('Créer mon profil').closest('button')).toBeDisabled();
  expect(onComplete).not.toHaveBeenCalled();
});

test('age minimum : 19 ans en Ontario (hors Alberta/Manitoba/Quebec)', async () => {
  setup();
  await attendreChargement();
  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: 'ON' } });
  const anneeRecente = new Date().getFullYear() - 18; // 18 ans -> encore sous le minimum de 19 en Ontario
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeRecente}-06-15` } });
  await waitFor(() => expect(screen.getByText('Tu dois avoir au moins 19 ans dans ta région pour utiliser Betrics.')).toBeInTheDocument());
});

test('liens legaux : appellent onOpenLegal avec "terms"/"privacy"', async () => {
  const { onOpenLegal } = setup();
  await attendreChargement();
  fireEvent.click(screen.getByText('Conditions d\'utilisation'));
  expect(onOpenLegal).toHaveBeenLastCalledWith('terms');
  fireEvent.click(screen.getByText('Politique de confidentialité'));
  expect(onOpenLegal).toHaveBeenLastCalledWith('privacy');
});

test('lien de deconnexion discret appelle onLogout', async () => {
  const { onLogout } = setup();
  await attendreChargement();
  fireEvent.click(screen.getByText('Se déconnecter'));
  expect(onLogout).toHaveBeenCalledTimes(1);
});

test('soumission complete : enregistre le profil (profile_completed_at renseigne) puis appelle onComplete', async () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert,
  }));
  const { onComplete } = setup();
  await attendreChargement();

  fireEvent.change(screen.getByPlaceholderText('Choisir un nom d\'utilisateur'), { target: { value: 'nouvelalex' } });
  await waitFor(() => expect(screen.getByText('Disponible')).toBeInTheDocument(), { timeout: 2000 });

  const selects = document.querySelectorAll('select');
  fireEvent.change(selects[1], { target: { value: 'ON' } }); // 19 ans minimum
  const anneeAdulte = new Date().getFullYear() - 30;
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${anneeAdulte}-06-15` } });
  fireEvent.click(screen.getByRole('checkbox'));

  const bouton = screen.getByText('Créer mon profil').closest('button');
  await waitFor(() => expect(bouton).not.toBeDisabled());
  fireEvent.click(bouton);

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    id: 'u1', first_name: 'Alex', last_name: 'Tremblay', username: 'nouvelalex', country: 'CA', region: 'ON',
  }));
  const payload = upsert.mock.calls[0][0];
  expect(payload.profile_completed_at).toBeTruthy();
});
