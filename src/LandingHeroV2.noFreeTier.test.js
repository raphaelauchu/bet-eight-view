import { render, screen } from '@testing-library/react';
import LandingHeroV2 from './LandingHeroV2';

// ===================== LandingHeroV2 : aucun palier gratuit configure =====================
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : quand pricingConfig.PLAN_FREE_FEATURES_KEYS est vide, la
// note "Gratuit pour commencer" ne doit jamais s'afficher (pas de promesse non confirmee) --
// voir LandingHeroV2.test.js pour le cas reel actuel (palier gratuit existant).
jest.mock('./pricingConfig', () => ({ PLAN_FREE_FEATURES_KEYS: [] }));

test('note "gratuit pour commencer" absente si aucun palier gratuit n\'est configure', () => {
  render(<LandingHeroV2 lang="fr" onOpenAuth={() => {}} />);
  expect(screen.queryByText('Gratuit pour commencer')).not.toBeInTheDocument();
});
