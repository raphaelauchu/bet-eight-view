import { render, screen } from '@testing-library/react';
import Auth from './Auth';

// ===================== Auth : AUTH_GOOGLE_ENABLED=false =====================
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : le bouton Google et le separateur "ou" disparaissent
// entierement -- jamais seulement masques en CSS. Voir Auth.test.js pour le cas actif et
// Auth.emailOff.test.js pour le drapeau courriel.
jest.mock('./authConfig', () => ({ AUTH_GOOGLE_ENABLED: false, AUTH_EMAIL_ENABLED: true, AUTH_APPLE_ENABLED: false }));
jest.mock('./supabase', () => ({ supabase: { auth: {}, from: jest.fn() } }));

test('aucun bouton Google ni separateur "ou" ; le bouton courriel reste seul', () => {
  render(<Auth onConnexion={() => {}} onBackToHome={() => {}} lang="fr" initialMode="login" />);
  expect(screen.queryByRole('button', { name: 'Continuer avec Google' })).not.toBeInTheDocument();
  expect(screen.queryByText('ou')).not.toBeInTheDocument();
  expect(screen.getByText('Continuer avec courriel')).toBeInTheDocument();
});
