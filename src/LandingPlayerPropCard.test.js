import { render, screen, fireEvent } from '@testing-library/react';
import { getT } from './i18n';
import LandingPlayerPropCard from './LandingPlayerPropCard';

// ===================== Carte "Fiches joueur" (src/LandingPlayerPropCard.js) =====================
// Jeu de donnees fixe (18 matchs + "ce soir") -- voir landingFeaturesCalc.test.js pour la preuve
// que ligne 2.5 + aucun filtre -> exactement "83 % (15/18)", le chiffre repris ici.
const t = getT('fr');

function setup() {
  return render(<LandingPlayerPropCard t={t} />);
}

test('rendu par defaut : 83 % (15/18), 18 barres + la barre "ce soir", donnees de demonstration', () => {
  setup();
  expect(screen.getByText('83% (15/18)')).toBeInTheDocument();
  expect(document.querySelectorAll('.landing2-prop-bar-col').length).toBe(19); // 18 matchs + ce soir
  expect(screen.getByText(/Ce soir/)).toBeInTheDocument();
  expect(screen.getByText('Données de démonstration')).toBeInTheDocument();
});

test('aucune photo de joueur, aucun vrai nom (initiales seulement, nom fictif en texte)', () => {
  setup();
  expect(document.querySelector('.landing2-avatar-circle img')).not.toBeInTheDocument();
  expect(screen.getByText('FR')).toBeInTheDocument();
  expect(screen.getByText(/Félix Rainville/)).toBeInTheDocument();
});

test('ligne +/- : recalcule le taux de reussite par pas de 0.5 (les barres changent de couleur)', () => {
  setup();
  expect(screen.getByText('Ligne 2.5')).toBeInTheDocument();
  expect(screen.getByText('83% (15/18)')).toBeInTheDocument();

  // +0.5 (ligne 3.0) : toutes les valeurs sont entieres, aucune ne se situe entre 2.5 et 3 --
  // le taux reste identique (verifie que le pas de 0.5 fonctionne sans fausser le calcul).
  fireEvent.click(screen.getByLabelText('Augmenter la ligne'));
  expect(screen.getByText('Ligne 3.0')).toBeInTheDocument();
  expect(screen.getByText('83% (15/18)')).toBeInTheDocument();

  // +0.5 a nouveau (ligne 3.5) : exclut desormais les matchs a exactement 3 -> 9/18.
  fireEvent.click(screen.getByLabelText('Augmenter la ligne'));
  expect(screen.getByText('Ligne 3.5')).toBeInTheDocument();
  expect(screen.getByText('50% (9/18)')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Diminuer la ligne'));
  fireEvent.click(screen.getByLabelText('Diminuer la ligne'));
  expect(screen.getByText('Ligne 2.5')).toBeInTheDocument();
  expect(screen.getByText('83% (15/18)')).toBeInTheDocument();
});

test('puces de filtre : "5 derniers"/"10 derniers"/"Domicile"/"Extérieur" recalculent barres et taux, aria-pressed bascule', () => {
  setup();
  const puce5 = screen.getByText('5 derniers');
  expect(puce5).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(puce5);
  expect(puce5).toHaveAttribute('aria-pressed', 'true');
  expect(document.querySelectorAll('.landing2-prop-bar-col').length).toBe(6); // 5 matchs + ce soir
  expect(screen.getByText('80% (4/5)')).toBeInTheDocument();

  // Un second clic sur la meme puce la desactive (retour a "aucun filtre").
  fireEvent.click(puce5);
  expect(puce5).toHaveAttribute('aria-pressed', 'false');
  expect(document.querySelectorAll('.landing2-prop-bar-col').length).toBe(19);

  fireEvent.click(screen.getByText('Domicile'));
  expect(screen.getByText('89% (8/9)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Extérieur'));
  expect(screen.getByText('78% (7/9)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('10 derniers'));
  expect(screen.getByText('90% (9/10)')).toBeInTheDocument();
});

test('puces de filtre : focusables au clavier (boutons natifs)', () => {
  setup();
  const puce = screen.getByText('Domicile');
  expect(puce.tagName).toBe('BUTTON');
  puce.focus();
  expect(document.activeElement).toBe(puce);
});
