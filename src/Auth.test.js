import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Auth from './Auth';

// ===================== Ecran de connexion/inscription (src/Auth.js, refonte du 27 nov 2026) =====
// Ecran de choix (Google/courriel) avant le formulaire courriel+mot de passe existant -- voir
// Auth.googleOff.test.js/Auth.emailOff.test.js pour le comportement des drapeaux
// src/authConfig.js desactives (fichiers dedies, meme convention que poolVisuals.flagOff.test.js).
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
    from: jest.fn(),
  },
}));
const { supabase } = require('./supabase');

function setup(props = {}) {
  const onConnexion = jest.fn();
  const onBackToHome = jest.fn();
  const onOpenLegal = jest.fn();
  const utils = render(<Auth onConnexion={onConnexion} onBackToHome={onBackToHome} onOpenLegal={onOpenLegal} lang="fr" initialMode="login" {...props} />);
  return { ...utils, onConnexion, onBackToHome, onOpenLegal };
}

// `react-scripts` active `resetMocks: true` : toute implementation passee a jest.fn(impl) dans la
// factory jest.mock ci-dessus serait effacee AVANT CHAQUE test -- le comportement par defaut de
// supabase.from doit donc etre (re)pose ici via mockImplementation, jamais dans la factory.
beforeEach(() => {
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) }) }),
    upsert: () => Promise.resolve({ error: null }),
  }));
});

// ===================== Ecran de choix : affichage selon les drapeaux (cas par defaut, les deux actifs) ====

test('ecran de choix (connexion) : boutons Google et courriel, separateur "ou", mentions legales et jeu responsable', () => {
  setup();
  expect(screen.getByText('Bienvenue')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeInTheDocument();
  expect(screen.getByText('Continuer avec courriel')).toBeInTheDocument();
  expect(screen.getByText('ou')).toBeInTheDocument();
  expect(screen.getByText('Conditions d\'utilisation')).toBeInTheDocument();
  expect(screen.getByText('Politique de confidentialité')).toBeInTheDocument();
  expect(screen.getByText('18+ · Jeu responsable')).toBeInTheDocument();
});

test('ecran de choix (inscription) : titre et sous-titre adaptes', () => {
  setup({ initialMode: 'signup' });
  expect(screen.getByText('Crée ton compte')).toBeInTheDocument();
});

// ===================== Google OAuth =====================

test('"Continuer avec Google" appelle signInWithOAuth avec le provider google et redirectTo = origine du site', async () => {
  supabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }));
  await waitFor(() => expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  }));
});

test('Google : erreur affichee clairement, bouton reactive (pas d\'ecran casse)', async () => {
  supabase.auth.signInWithOAuth.mockResolvedValue({ data: null, error: { message: 'oauth down' } });
  setup();
  const bouton = screen.getByRole('button', { name: 'Continuer avec Google' });
  fireEvent.click(bouton);
  await waitFor(() => expect(screen.getByText('La connexion avec Google a échoué. Réessaie dans un instant.')).toBeInTheDocument());
  expect(bouton).not.toBeDisabled();
});

// ===================== Formulaire courriel =====================

test('"Continuer avec courriel" affiche le formulaire de connexion (courriel/utilisateur + mot de passe)', () => {
  setup();
  fireEvent.click(screen.getByText('Continuer avec courriel'));
  expect(screen.getByText('Courriel ou nom d\'utilisateur')).toBeInTheDocument();
  expect(screen.getByText('Mot de passe')).toBeInTheDocument();
  expect(screen.getByText('Mot de passe oublié?')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continuer avec Google' })).not.toBeInTheDocument();
});

test('formulaire de connexion : soumission reussie appelle onConnexion', async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  const { onConnexion } = setup();
  fireEvent.click(screen.getByText('Continuer avec courriel'));
  fireEvent.change(screen.getByPlaceholderText('ton@courriel.com ou nom d\'utilisateur'), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByText('Se connecter →'));
  await waitFor(() => expect(onConnexion).toHaveBeenCalled());
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'secret123' });
});

test('formulaire de connexion : identifiants incorrects affiches clairement, onConnexion jamais appele', async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'invalid' } });
  const { onConnexion } = setup();
  fireEvent.click(screen.getByText('Continuer avec courriel'));
  fireEvent.change(screen.getByPlaceholderText('ton@courriel.com ou nom d\'utilisateur'), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByText('Se connecter →'));
  await waitFor(() => expect(screen.getByText('Courriel/nom d\'utilisateur ou mot de passe incorrect.')).toBeInTheDocument());
  expect(onConnexion).not.toHaveBeenCalled();
});

test('formulaire d\'inscription : courriel seul (pas de champ utilisateur), signUp + upsert du profil, ecran de confirmation', async () => {
  supabase.auth.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  setup({ initialMode: 'signup' });
  fireEvent.click(screen.getByText('Continuer avec courriel'));
  expect(screen.getByText('Courriel')).toBeInTheDocument();
  expect(screen.queryByText('Courriel ou nom d\'utilisateur')).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('ton@courriel.com'), { target: { value: 'nouveau@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByText('Créer mon compte →'));
  await waitFor(() => expect(screen.getByText(/nouveau@example.com/)).toBeInTheDocument());
  expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'nouveau@example.com', password: 'secret123' });
});

test('mot de passe oublie : soumission appelle resetPasswordForEmail, affiche l\'ecran "lien envoye"', async () => {
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  setup();
  fireEvent.click(screen.getByText('Continuer avec courriel'));
  fireEvent.click(screen.getByText('Mot de passe oublié?'));
  fireEvent.change(screen.getByPlaceholderText('ton@courriel.com ou nom d\'utilisateur'), { target: { value: 'alex@example.com' } });
  fireEvent.click(screen.getByText('Envoyer le lien'));
  await waitFor(() => expect(screen.getByText('Lien envoyé!')).toBeInTheDocument());
  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('alex@example.com', { redirectTo: window.location.origin });
});

// ===================== Bascule connexion/inscription =====================

test('bascule : "Créer un compte" puis "Se connecter" changent le titre et le mode', () => {
  setup();
  fireEvent.click(screen.getByText('Créer un compte'));
  expect(screen.getByText('Crée ton compte')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Se connecter'));
  expect(screen.getByText('Bienvenue')).toBeInTheDocument();
});

// ===================== Retour arriere (fleche d'en-tete) =====================

test('fleche retour : depuis l\'ecran de choix, appelle onBackToHome', () => {
  const { onBackToHome } = setup();
  fireEvent.click(screen.getByLabelText('Retour à l\'accueil'));
  expect(onBackToHome).toHaveBeenCalledTimes(1);
});

test('fleche retour : depuis le formulaire courriel, revient a l\'ecran de choix (n\'appelle PAS onBackToHome)', () => {
  const { onBackToHome } = setup();
  fireEvent.click(screen.getByText('Continuer avec courriel'));
  fireEvent.click(screen.getByLabelText('Retour'));
  expect(onBackToHome).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeInTheDocument();
});

// ===================== Liens legaux =====================

test('liens legaux : "Conditions d\'utilisation" et "Politique de confidentialité" appellent onOpenLegal', () => {
  const { onOpenLegal } = setup();
  fireEvent.click(screen.getByText('Conditions d\'utilisation'));
  expect(onOpenLegal).toHaveBeenLastCalledWith('terms');
  fireEvent.click(screen.getByText('Politique de confidentialité'));
  expect(onOpenLegal).toHaveBeenLastCalledWith('privacy');
});

// ===================== Accessibilite =====================

test('accessibilite : boutons principaux focusables au clavier', () => {
  setup();
  const google = screen.getByRole('button', { name: 'Continuer avec Google' });
  google.focus();
  expect(document.activeElement).toBe(google);
});
