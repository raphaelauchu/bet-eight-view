import { render, screen, fireEvent, within } from '@testing-library/react';
import { getT } from './i18n';
import LandingOddsCard from './LandingOddsCard';

// ===================== Carte "Comparateur de cotes" (src/LandingOddsCard.js) =====================
// EV reel verifie dans landingFeaturesCalc.test.js ("jeu de donnees reel de la carte") : cote
// "Plus" -> EV ~= +2.8% (positif, pastille "+EV" visible) ; cote "Moins" -> EV negatif (pas de
// pastille). LANDING_EV_PREVIEW_ENABLED=true par defaut ici -- voir
// LandingOddsCard.evPreviewOff.test.js pour le comportement drapeau a false.
const t = getT('fr');

function setup() {
  return render(<LandingOddsCard t={t} />);
}

test('rendu par defaut (cote "Plus") : meilleure cote Book C en tete, pastille +EV visible, Bientôt affiche', () => {
  setup();
  const lignes = document.querySelectorAll('.landing2-odds-table tbody tr');
  expect(lignes.length).toBe(5);
  expect(within(lignes[0]).getByText('Book C')).toBeInTheDocument(); // meilleure cote "Plus" = 1.95
  expect(screen.getByText(/\+EV \+?2\.8%/)).toBeInTheDocument();
  expect(screen.getByText('Bientôt')).toBeInTheDocument();
  expect(screen.getByText('Données de démonstration')).toBeInTheDocument();
  expect(screen.getByText('Les cotes réelles dépendent des sources disponibles.')).toBeInTheDocument();
});

test('bascule "Moins" : reordonne le tableau (Book B en tete), aucune pastille +EV (EV negatif)', () => {
  setup();
  const boutonMoins = screen.getByText('Moins');
  expect(boutonMoins).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(boutonMoins);
  expect(boutonMoins).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Plus')).toHaveAttribute('aria-pressed', 'false');

  const lignes = document.querySelectorAll('.landing2-odds-table tbody tr');
  expect(within(lignes[0]).getByText('Book B')).toBeInTheDocument(); // meilleure cote "Moins" = 2.10
  expect(screen.queryByText(/\+EV/)).not.toBeInTheDocument();
});

test('probabilite implicite et marge du marche recalculees en direct selon la meilleure cote du cote selectionne', () => {
  setup();
  // "Plus" : meilleure cote Book C = 1.95/1.95 -> implicite 1/1.95=51.3%, marge 2.6%.
  expect(screen.getByText('51.3%')).toBeInTheDocument();
  expect(screen.getByText('2.6%')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Moins'));
  // "Moins" : meilleure cote Book B = 2.10, livre B (over 1.75/under 2.10) -> implicite
  // 1/2.10=47.6%, marge = 1/1.75+1/2.10-1 = 4.76%.
  expect(screen.getByText('47.6%')).toBeInTheDocument();
  expect(screen.getByText('4.8%')).toBeInTheDocument();
});

test('aucun logo de bookmaker, aucun mot "arbitrage", aucune promesse de gains', () => {
  setup();
  expect(document.querySelectorAll('.landing2-odds-card img').length).toBe(0);
  const texte = document.body.textContent;
  expect(texte).not.toMatch(/arbitrage/i);
  expect(texte).not.toMatch(/profit garanti/i);
  expect(texte).not.toMatch(/\bgagne\b/i);
});

test('boutons Plus/Moins : focusables au clavier', () => {
  setup();
  const bouton = screen.getByText('Plus');
  expect(bouton.tagName).toBe('BUTTON');
  bouton.focus();
  expect(document.activeElement).toBe(bouton);
});
