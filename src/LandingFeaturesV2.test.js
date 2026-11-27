import { render, screen, fireEvent } from '@testing-library/react';
import LandingFeaturesV2 from './LandingFeaturesV2';

// ===================== Section "Fonctions" -- orchestration (src/LandingFeaturesV2.js) =====
// Integration complete des 3 cartes (interactions propres a chacune testees dans leurs fichiers
// dedies : LandingPlayerPropCard.test.js, LandingBankrollCard.test.js, LandingOddsCard.test.js) --
// ici : structure de la section (separateurs, un h2 par bloc, bande CTA finale).

function setup(lang = 'fr') {
  const onOpenAuth = jest.fn();
  const utils = render(<LandingFeaturesV2 lang={lang} onOpenAuth={onOpenAuth} />);
  return { ...utils, onOpenAuth };
}

test('rendu FR : id="fonctions", 2 separateurs en pointilles (FONCTIONS, COMMENCER), un h2 par bloc', () => {
  setup('fr');
  expect(document.getElementById('fonctions')).toBeInTheDocument();
  expect(screen.getByText('FONCTIONS')).toBeInTheDocument();
  expect(screen.getByText('COMMENCER')).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(3);
  expect(screen.getByText('Vois combien de fois ça passe')).toBeInTheDocument();
  expect(screen.getByText('Chaque dollar, à sa place')).toBeInTheDocument();
  expect(screen.getByText('La meilleure cote, d’un coup d’œil')).toBeInTheDocument();
});

test('rendu EN : libelles traduits', () => {
  setup('en');
  expect(screen.getByText('FEATURES')).toBeInTheDocument();
  expect(screen.getByText('GET STARTED')).toBeInTheDocument();
  expect(screen.getByText('See how often it hits')).toBeInTheDocument();
});

test('bande CTA finale : "Commencer" et "Se connecter" appellent onOpenAuth avec le bon mode', () => {
  const { onOpenAuth } = setup('fr');
  const boutons = screen.getAllByText('Commencer');
  fireEvent.click(boutons[boutons.length - 1]); // bande CTA = dernier "Commencer" du DOM
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
  fireEvent.click(screen.getByText('Se connecter'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('login');
});

test('aucune promesse de gains, aucun chiffre d\'utilisateurs invente, jamais le mot "arbitrage"', () => {
  setup('fr');
  const texte = document.body.textContent;
  expect(texte).not.toMatch(/arbitrage/i);
  expect(texte).not.toMatch(/profit garanti/i);
  expect(screen.queryByText(/témoignage/i)).not.toBeInTheDocument();
});
