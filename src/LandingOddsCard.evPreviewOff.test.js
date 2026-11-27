import { render, screen } from '@testing-library/react';
import { getT } from './i18n';
import LandingOddsCard from './LandingOddsCard';

// ===================== LandingOddsCard : LANDING_EV_PREVIEW_ENABLED=false =====================
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : drapeau desactive -> la pastille "+EV", le pourcentage,
// l'etiquette "Bientôt" et l'explication disparaissent entierement -- retour a la version
// "probabilite implicite + marge" seulement. Voir LandingOddsCard.test.js pour le cas actif.
jest.mock('./landingConfig', () => ({ LANDING_EV_PREVIEW_ENABLED: false }));

const t = getT('fr');

test('EV entierement absent (pastille, pourcentage, etiquette Bientôt, explication) quand le drapeau est a false', () => {
  render(<LandingOddsCard t={t} />);
  expect(screen.queryByText(/\+EV/)).not.toBeInTheDocument();
  expect(screen.queryByText('Bientôt')).not.toBeInTheDocument();
  expect(screen.queryByText('Valeur attendue (EV)')).not.toBeInTheDocument();
  expect(screen.queryByText(/EV = probabilité équitable/)).not.toBeInTheDocument();
  // La version sans EV reste complete : probabilite implicite + marge toujours affichees.
  expect(screen.getByText('Probabilité implicite (meilleure cote)')).toBeInTheDocument();
  expect(screen.getByText('Marge du marché')).toBeInTheDocument();
  expect(screen.getByText('Les cotes réelles dépendent des sources disponibles.')).toBeInTheDocument();
});
