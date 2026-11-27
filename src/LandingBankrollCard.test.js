import { render, screen, fireEvent } from '@testing-library/react';
import { getT } from './i18n';
import LandingBankrollCard from './LandingBankrollCard';

// ===================== Carte "Bankroll" (src/LandingBankrollCard.js) =====================
// Tous les chiffres attendus ici sont ceux produits par src/bankrollCalc.js applique au jeu de
// donnees de demonstration fixe du fichier -- recalcules a la main dans les commentaires pour
// verification, jamais une valeur arbitraire.
const t = getT('fr');

function setup() {
  return render(<LandingBankrollCard t={t} />);
}

// BET99 : depot 500$ ; mises (reglees+en cours) 40+25+30+20=115 ; retours regles
// (40+36.4)+(25-25)+(30+24)=76.4+0+54=130.4 -> solde 500-115+130.4=515.40$.
test('rendu par defaut (compte BET99 actif, periode 1M) : solde issu de bankrollCalc, donnees de demonstration', () => {
  setup();
  expect(screen.getByText('$515.40')).toBeInTheDocument();
  expect(screen.getByText('BET99').closest('button')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Données de démonstration')).toBeInTheDocument();
});

test('puces de compte : "Tous" additionne les 3 comptes (515.40 + 253.50 + 214.00 = 982.90$)', () => {
  setup();
  fireEvent.click(screen.getByText('Tous'));
  expect(screen.getByText('$982.90')).toBeInTheDocument();
});

// Betway : depot 300$ ; mises 50+35+20+15=120 ; retours regles (50-50)+(35+38.5)+(20-20)=0+73.5+0=73.5
// -> solde 300-120+73.5=253.50$.
test('puces de compte : Betway affiche son propre solde (253.50$), aria-pressed bascule', () => {
  setup();
  const puceBetway = screen.getByText('Betway');
  expect(puceBetway).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(puceBetway);
  expect(puceBetway).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('BET99')).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('$253.50')).toBeInTheDocument();
});

// Mise-o-jeu+ : depots nets 200-20=180 ; mises 25+15+10=50 ; retours regles (25+35)+(15+9)=84
// -> solde 180-50+84=214.00$.
test('puces de compte : Mise-o-jeu+ affiche son propre solde (214.00$)', () => {
  setup();
  fireEvent.click(screen.getByText('Mise-o-jeu+'));
  expect(screen.getByText('$214.00')).toBeInTheDocument();
});

test('boutons de periode (1S/1M/Tout) : changent la periode active (aria-pressed), le solde reste le solde reel du compte', () => {
  setup();
  const bouton1S = screen.getByText('1S');
  const bouton1M = screen.getByText('1M');
  expect(bouton1M).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(bouton1S);
  expect(bouton1S).toHaveAttribute('aria-pressed', 'true');
  expect(bouton1M).toHaveAttribute('aria-pressed', 'false');
  // Le solde (computeAccountBalance) n'est jamais filtre par periode -- seul le ROI/taux de
  // reussite/la courbe ci-dessous changent (voir src/bankrollCalc.js:computeAccountBalance).
  expect(screen.getByText('$515.40')).toBeInTheDocument();
});

test('3 paris recents (BetRow), aucune photo/logo, titres fictifs', () => {
  setup();
  expect(screen.getByText('LCX @ ORB')).toBeInTheDocument(); // pending, le plus recent (BET99)
  expect(document.querySelectorAll('.landing2-bankroll-recent-bets img').length).toBe(0);
});

test('puces de compte et de periode : focusables au clavier (boutons natifs)', () => {
  setup();
  const puce = screen.getByText('Betway');
  expect(puce.tagName).toBe('BUTTON');
  puce.focus();
  expect(document.activeElement).toBe(puce);
});
