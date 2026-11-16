import { render, screen, fireEvent, within } from '@testing-library/react';
import Landing from './Landing';

// ===================== Accueil public (src/Landing.js) =====================
// Contenu de l'accueil uniquement -- navigation (src/Navbar.js) et pied de page
// (src/PublicFooter.js) sont testes separement (voir Navbar.test.js), ils vivent dans
// src/PublicSite.js, pas ici. Aucune donnee reseau ni supabase ici (page statique) -- jsdom
// n'a pas d'IntersectionObserver reel : les sections Reveal restent dans le DOM (seule leur
// classe CSS d'opacite differe), donc testables normalement sans attendre l'animation.

function setup(lang = 'fr') {
  const onOpenAuth = jest.fn();
  const utils = render(<Landing lang={lang} onOpenAuth={onOpenAuth} />);
  return { ...utils, onOpenAuth };
}

// ===================== Rendu des sections =====================

test('rendu : toutes les sections attendues sont presentes (hero, blocs alternes, pour qui, faq, cta finale)', () => {
  setup('fr');
  expect(screen.getByText('Transforme une décision émotionnelle en pari calculé.')).toBeInTheDocument();
  expect(document.getElementById('analyses')).toBeInTheDocument();
  expect(document.getElementById('pool-apercu')).toBeInTheDocument();
  expect(document.getElementById('bankroll')).toBeInTheDocument();
  expect(document.getElementById('outils')).toBeInTheDocument();
  expect(document.getElementById('faq')).toBeInTheDocument();
  expect(screen.getByText('Pour qui ?')).toBeInTheDocument();
  expect(screen.getByText('Questions fréquentes')).toBeInTheDocument();
  expect(screen.getByText('Prêt à parier avec ta tête ?')).toBeInTheDocument();
});

test('rendu : les 4 blocs alternes (Analyses, Pool, Bankroll, Outils) sont presents', () => {
  setup('fr');
  expect(screen.getByText('Chaque matchup, décortiqué.')).toBeInTheDocument();
  expect(screen.getByText('Un pool qui tourne toute la saison.')).toBeInTheDocument();
  expect(screen.getByText('Ta bankroll, suivie comme un portefeuille.')).toBeInTheDocument();
  expect(screen.getByText('Des outils pour objectiver chaque décision.')).toBeInTheDocument();
  // Les 7 points du pool explicitement demandes.
  ['Formation en cartes', 'Échanges avec contre-offres', 'Classement en direct', 'Agents libres', 'Règles 100 % personnalisables', 'Plafond salarial optionnel', 'Repêchage en direct']
    .forEach(label => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
});

test('rendu : "Pour qui" presente exactement trois profils', () => {
  setup('fr');
  const grid = document.querySelector('.ws-forwho-grid');
  expect(within(grid).getAllByRole('heading', { level: 3 }).length).toBe(3);
  expect(screen.getByText('Le parieur du quotidien')).toBeInTheDocument();
  expect(screen.getByText('L\'organisateur de pool')).toBeInTheDocument();
  expect(screen.getByText('Le parieur méthodique')).toBeInTheDocument();
});

// ===================== Bascule FR/EN =====================

test('bascule de langue : le contenu passe integralement au francais ou a l\'anglais', () => {
  const { rerender } = render(<Landing lang="en" onOpenAuth={() => {}} />);
  expect(screen.getByText('Turn an emotional decision into a calculated bet.')).toBeInTheDocument();
  expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();

  rerender(<Landing lang="fr" onOpenAuth={() => {}} />);
  expect(screen.getByText('Transforme une décision émotionnelle en pari calculé.')).toBeInTheDocument();
  expect(screen.getByText('Questions fréquentes')).toBeInTheDocument();
  expect(screen.queryByText('Turn an emotional decision into a calculated bet.')).not.toBeInTheDocument();
});

// ===================== Boutons de connexion/inscription =====================

test('boutons "Créer un compte" : ouvrent Auth en mode inscription (hero et cta finale)', () => {
  const { onOpenAuth } = setup('fr');

  const ctaButtons = screen.getAllByText('Créer un compte'); // hero + CTA finale
  expect(ctaButtons.length).toBe(2);
  fireEvent.click(ctaButtons[0]);
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');

  fireEvent.click(screen.getByText(/Voir comment ça marche/));
  // navigation en page (ancre), ne doit pas ouvrir Auth une deuxieme fois.
  expect(onOpenAuth).toHaveBeenCalledTimes(1);

  fireEvent.click(ctaButtons[1]);
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
});

// ===================== FAQ accessible au clavier =====================

test('FAQ : accessible au clavier (bouton natif, focusable), aria-expanded et contenu masque/affiche correctement', () => {
  setup('fr');
  const question = screen.getByText('Betrics place-t-il des paris pour moi ?').closest('button');
  expect(question.tagName).toBe('BUTTON');
  expect(question).toHaveAttribute('aria-expanded', 'false');

  const answerId = question.getAttribute('aria-controls');
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.getElementById(answerId)).toHaveAttribute('hidden');

  question.focus();
  expect(document.activeElement).toBe(question);
  fireEvent.click(question);
  expect(question).toHaveAttribute('aria-expanded', 'true');
  // eslint-disable-next-line testing-library/no-node-access
  const answerPanel = document.getElementById(answerId);
  expect(answerPanel).not.toHaveAttribute('hidden');
  expect(within(answerPanel).getByText(/toujours toi qui décides et qui places ton pari/)).toBeInTheDocument();

  fireEvent.click(question);
  expect(question).toHaveAttribute('aria-expanded', 'false');
});

test('FAQ : les 6 questions demandees sont toutes presentes', () => {
  setup('fr');
  ['Qu\'est-ce que Betrics ?', 'Est-ce gratuit ?', 'Le pool de hockey est-il gratuit ?', 'Betrics place-t-il des paris pour moi ?', 'Mes données sont-elles protégées ?', 'Betrics encourage-t-il le jeu responsable ?']
    .forEach(q => expect(screen.getByText(q)).toBeInTheDocument());
});

// ===================== Contenu responsable : aucun chiffre/temoignage invente =====================

test('contenu responsable : aucun chiffre de confiance ni temoignage, aucune mention de prix/forfait', () => {
  setup('fr');
  const body = document.body.textContent;
  expect(body).not.toMatch(/99%/);
  expect(body).not.toMatch(/uptime/i);
  expect(body).not.toMatch(/40\+/);
  expect(body).not.toMatch(/\$\d/);
  expect(screen.queryByText(/témoignage/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/avis/i)).not.toBeInTheDocument();
  // Aucune pastille "nouveau"/badge gadget sur l'accueil.
  expect(screen.queryByText(/^NEW$/i)).not.toBeInTheDocument();
});

test('donnees d\'exemple : toutes les captures du theme clair portent une pastille "exemple"', () => {
  setup('fr');
  const tags = document.querySelectorAll('.ws-window-example-tag');
  expect(tags.length).toBeGreaterThan(0);
  tags.forEach(tag => expect(tag).toHaveTextContent('Exemple'));
});

// ===================== Captures produit : repli propre si l'image est absente =====================

test('WindowFrame : si l\'image echoue, un emplacement propre (sans icone cassee) prend sa place', () => {
  setup('fr');
  const heroFrame = document.querySelector('.ws-hero-shot-wrap .ws-window-frame');
  const img = heroFrame.querySelector('.ws-window-img');
  expect(img).toBeInTheDocument();
  fireEvent.error(img);
  expect(heroFrame.querySelector('.ws-window-img')).not.toBeInTheDocument();
  expect(heroFrame.querySelector('.ws-window-placeholder')).toBeInTheDocument();
});
