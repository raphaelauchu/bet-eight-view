import { render, screen, fireEvent } from '@testing-library/react';
import LandingHeroV2 from './LandingHeroV2';

// ===================== Hero V2 de l'accueil (src/LandingHeroV2.js) =====================
// Rendu isole (sans l'en-tete ni les autres sections) : titre Anton en 3 lignes, mockup de
// telephones (src/LandingPhoneDemo.js), note "gratuit" conditionnee par pricingConfig.js, lien
// jeu responsable. Voir Landing.test.js pour l'integration complete (hero + reste de la page).

test('rendu FR : titre en 3 lignes (dont une en orange), sous-titre, un seul h1, boutons et mockup', () => {
  render(<LandingHeroV2 lang="fr" onOpenAuth={() => {}} />);
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
  expect(screen.getByText('VOIS LES DONNÉES')).toBeInTheDocument();
  expect(screen.getByText('DERRIÈRE')).toBeInTheDocument();
  expect(screen.getByText('CHAQUE PARI.')).toHaveClass('landing2-hero-title-accent');
  expect(screen.getByText('Stats LNH, comparateur de cotes et suivi de bankroll dans une seule app.')).toBeInTheDocument();
  expect(screen.getByText('En direct · LNH')).toBeInTheDocument();
  expect(document.querySelectorAll('.landing-phone').length).toBe(2);
  expect(screen.getByText('Données de démonstration')).toBeInTheDocument();
});

test('rendu EN : titre et sous-titre traduits', () => {
  render(<LandingHeroV2 lang="en" onOpenAuth={() => {}} />);
  expect(screen.getByText('SEE THE DATA')).toBeInTheDocument();
  expect(screen.getByText('BEHIND')).toBeInTheDocument();
  expect(screen.getByText('EVERY BET.')).toBeInTheDocument();
  expect(screen.getByText('NHL stats, odds comparison and bankroll tracking in one app.')).toBeInTheDocument();
  expect(screen.getByText('Live · NHL')).toBeInTheDocument();
});

test('clic "Commencer" declenche onOpenAuth("signup"), "Voir comment ca marche" ne le declenche pas', () => {
  const onOpenAuth = jest.fn();
  render(<LandingHeroV2 lang="fr" onOpenAuth={onOpenAuth} />);
  fireEvent.click(screen.getByText('Commencer'));
  expect(onOpenAuth).toHaveBeenCalledWith('signup');
  fireEvent.click(screen.getByText('Voir comment ça marche'));
  expect(onOpenAuth).toHaveBeenCalledTimes(1);
});

test('lien "18+ - Jeu responsable" pointe vers l\'ancre du pied de page', () => {
  render(<LandingHeroV2 lang="fr" onOpenAuth={() => {}} />);
  const lien = screen.getByText('18+ · Jeu responsable');
  expect(lien).toHaveAttribute('href', '#jeu-responsable');
});

test('accessibilite : mockup de telephones expose un alt/aria-label descriptif (donnees de demonstration)', () => {
  render(<LandingHeroV2 lang="fr" onOpenAuth={() => {}} />);
  const phones = document.querySelectorAll('.landing-phone[role="img"]');
  expect(phones.length).toBe(2);
  phones.forEach(phone => {
    expect(phone.getAttribute('aria-label')).toMatch(/démonstration/i);
  });
});

test('boutons focusables au clavier (role button natif)', () => {
  render(<LandingHeroV2 lang="fr" onOpenAuth={() => {}} />);
  const boutonCommencer = screen.getByText('Commencer');
  expect(boutonCommencer.tagName).toBe('BUTTON');
  boutonCommencer.focus();
  expect(document.activeElement).toBe(boutonCommencer);
});

test('note "gratuit pour commencer" presente car un palier gratuit existe (pricingConfig.PLAN_FREE_FEATURES_KEYS non vide)', () => {
  // Cas "aucun palier gratuit" couvert dans un fichier dedie (jest.mock statique, voir
  // LandingHeroV2.noFreeTier.test.js) -- jest.resetModules()+require() ici casserait les hooks
  // (React duplique en deux instances de module), piege deja rencontre sur ce projet.
  render(<LandingHeroV2 lang="fr" onOpenAuth={() => {}} />);
  expect(screen.getByText('Gratuit pour commencer')).toBeInTheDocument();
});
