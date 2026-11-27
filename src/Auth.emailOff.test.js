import { render, screen } from '@testing-library/react';
import Auth from './Auth';

// ===================== Auth : AUTH_EMAIL_ENABLED=false =====================
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : le bouton courriel et le separateur "ou" disparaissent
// entierement -- jamais seulement masques en CSS. Voir Auth.test.js pour le cas actif et
// Auth.googleOff.test.js pour le drapeau Google.
jest.mock('./authConfig', () => ({ AUTH_GOOGLE_ENABLED: true, AUTH_EMAIL_ENABLED: false, AUTH_APPLE_ENABLED: false }));
jest.mock('./supabase', () => ({ supabase: { auth: {}, from: jest.fn() } }));

test('aucun bouton courriel ni separateur "ou" ; le bouton Google reste seul', () => {
  render(<Auth onConnexion={() => {}} onBackToHome={() => {}} lang="fr" initialMode="login" />);
  expect(screen.queryByText('Continuer avec courriel')).not.toBeInTheDocument();
  expect(screen.queryByText('ou')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeInTheDocument();
});
