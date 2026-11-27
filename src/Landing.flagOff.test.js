import { render, screen } from '@testing-library/react';
import Landing from './Landing';

// ===================== Landing : LANDING_V2_ENABLED=false =====================
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : drapeau desactive -> l'ancien hero (HomeHero, WindowFrame
// "/landing/hero-analyse.png") doit s'afficher, jamais le hero V2 -- voir Landing.test.js pour
// le comportement par defaut (drapeau actif, hero V2).
jest.mock('./landingConfig', () => ({ LANDING_V2_ENABLED: false }));

test('ancien hero restaure quand le drapeau est desactive', () => {
  render(<Landing lang="fr" onOpenAuth={() => {}} />);
  // Ancien hero : titre en une seule ligne (landing_hero_title), pas le decoupage en 3 spans.
  expect(screen.queryByText('VOIS LES DONNÉES')).not.toBeInTheDocument();
  expect(screen.queryByText('CHAQUE PARI.')).not.toBeInTheDocument();
  expect(document.querySelector('.ws-hero-shot-wrap')).toBeInTheDocument();
  expect(document.querySelectorAll('.landing-phone').length).toBe(0);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  // Section Fonctions (src/LandingFeaturesV2.js) : meme drapeau, jamais montee quand il est faux.
  expect(document.getElementById('fonctions')).not.toBeInTheDocument();
  expect(document.querySelector('.landing2-features')).not.toBeInTheDocument();
});
