import { render, screen, fireEvent } from '@testing-library/react';
import LandingHeaderV2 from './LandingHeaderV2';

// ===================== En-tete de l'accueil V2 (src/LandingHeaderV2.js) =====================
// Rendu desktop (pastilles de ligue + actions completes) vs mobile (logo + Commencer + lien Se
// connecter), bascule via useIsMobile (seuil 768px, voir src/useIsMobile.js) -- deux arbres DOM
// distincts (jamais les deux a la fois) pour eviter les doublons d'elements interactifs.

function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

afterEach(() => {
  setViewportWidth(1024); // repli deterministe (desktop) entre les tests
});

test('desktop : pastilles de ligue (LNH active, NFL grisee "bientot", non cliquables), logo centre, actions a droite', () => {
  setViewportWidth(1024);
  const onOpenAuth = jest.fn();
  render(<LandingHeaderV2 lang="fr" onOpenAuth={onOpenAuth} />);

  expect(screen.getByText('LNH')).toBeInTheDocument();
  const nfl = screen.getByText('NFL').closest('.landing2-league-pill-soon');
  expect(nfl).toHaveAttribute('aria-disabled', 'true');
  expect(nfl.tagName).not.toBe('BUTTON');
  expect(screen.getByText('Bientôt')).toBeInTheDocument();

  expect(screen.getByText('Betrics')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Se connecter'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('login');
  fireEvent.click(screen.getByText('Commencer'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
});

test('mobile : logo a gauche, "Commencer" a droite, "Se connecter" en petit lien -- pas de pastilles de ligue', () => {
  setViewportWidth(500);
  const onOpenAuth = jest.fn();
  render(<LandingHeaderV2 lang="fr" onOpenAuth={onOpenAuth} />);

  expect(screen.queryByText('LNH')).not.toBeInTheDocument();
  expect(screen.getByText('Betrics')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Commencer'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');

  const lien = screen.getByText('Se connecter');
  expect(lien.tagName).toBe('BUTTON');
  expect(lien).toHaveClass('landing2-link');
});

test('anglais : libelles traduits (Get started / Sign in / Coming soon)', () => {
  setViewportWidth(1024);
  render(<LandingHeaderV2 lang="en" onOpenAuth={() => {}} />);
  expect(screen.getByText('NHL')).toBeInTheDocument();
  expect(screen.getByText('Coming soon')).toBeInTheDocument();
  expect(screen.getByText('Sign in')).toBeInTheDocument();
  expect(screen.getByText('Get started')).toBeInTheDocument();
});
