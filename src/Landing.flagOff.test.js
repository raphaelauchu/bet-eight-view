import { render, screen, fireEvent, within } from '@testing-library/react';
import Landing from './Landing';

// ===================== Landing : LANDING_V2_ENABLED=false =====================
// Fichier dedie (jest.mock statique, charge avant tout import, meme convention que
// src/poolVisuals.flagOff.test.js) : drapeau desactive -> l'ANCIENNE page complete doit
// s'afficher integralement (ancien hero + 4 blocs alternes + "Pour qui" + FAQ + CTA finale),
// jamais le hero/la section Fonctions V2 -- voir Landing.test.js pour le comportement par defaut
// (drapeau actif, V2 : hero + Fonctions seulement, plus aucune de ces anciennes sections).
jest.mock('./landingConfig', () => ({ LANDING_V2_ENABLED: false }));

function setup(lang = 'fr') {
  const onOpenAuth = jest.fn();
  return { ...render(<Landing lang={lang} onOpenAuth={onOpenAuth} />), onOpenAuth };
}

test('ancienne page complete restauree quand le drapeau est desactive', () => {
  setup('fr');
  // Ancien hero : titre en une seule ligne (landing_hero_title), pas le decoupage en 3 spans.
  expect(screen.queryByText('VOIS LES DONNÉES')).not.toBeInTheDocument();
  expect(screen.queryByText('CHAQUE PARI.')).not.toBeInTheDocument();
  expect(document.querySelector('.ws-hero-shot-wrap')).toBeInTheDocument();
  expect(document.querySelectorAll('.landing-phone').length).toBe(0);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  // Section Fonctions (src/LandingFeaturesV2.js) : meme drapeau, jamais montee quand il est faux.
  expect(document.getElementById('fonctions')).not.toBeInTheDocument();
  expect(document.querySelector('.landing2-features')).not.toBeInTheDocument();
  // Les anciennes sections, elles, sont de retour integralement.
  expect(document.getElementById('analyses')).toBeInTheDocument();
  expect(document.getElementById('pool-apercu')).toBeInTheDocument();
  expect(document.getElementById('bankroll')).toBeInTheDocument();
  expect(document.getElementById('outils')).toBeInTheDocument();
  expect(document.getElementById('faq')).toBeInTheDocument();
  expect(screen.getByText('Pour qui ?')).toBeInTheDocument();
  expect(screen.getByText('Questions fréquentes')).toBeInTheDocument();
  expect(screen.getByText('Prêt à parier avec ta tête ?')).toBeInTheDocument();
});

test('les 4 blocs alternes (Analyses, Pool, Bankroll, Outils) sont presents', () => {
  setup('fr');
  expect(screen.getByText('Chaque matchup, décortiqué.')).toBeInTheDocument();
  expect(screen.getByText('Un pool qui tourne toute la saison.')).toBeInTheDocument();
  expect(screen.getByText('Ta bankroll, suivie comme un portefeuille.')).toBeInTheDocument();
  expect(screen.getByText('Des outils pour objectiver chaque décision.')).toBeInTheDocument();
  ['Formation en cartes', 'Échanges avec contre-offres', 'Classement en direct', 'Agents libres', 'Règles 100 % personnalisables', 'Plafond salarial optionnel', 'Repêchage en direct']
    .forEach(label => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
});

test('"Pour qui" presente exactement trois profils', () => {
  setup('fr');
  const grid = document.querySelector('.ws-forwho-grid');
  expect(within(grid).getAllByRole('heading', { level: 3 }).length).toBe(3);
  expect(screen.getByText('Le parieur du quotidien')).toBeInTheDocument();
  expect(screen.getByText('L\'organisateur de pool')).toBeInTheDocument();
  expect(screen.getByText('Le parieur méthodique')).toBeInTheDocument();
});

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

test('donnees d\'exemple : toutes les captures du theme clair portent une pastille "exemple"', () => {
  setup('fr');
  const tags = document.querySelectorAll('.ws-window-example-tag');
  expect(tags.length).toBeGreaterThan(0);
  tags.forEach(tag => expect(tag).toHaveTextContent('Exemple'));
});

test('WindowFrame : si l\'image echoue, un emplacement propre (sans icone cassee) prend sa place', () => {
  setup('fr');
  const frame = document.querySelector('#analyses .ws-window-frame');
  const img = frame.querySelector('.ws-window-img');
  expect(img).toBeInTheDocument();
  fireEvent.error(img);
  expect(frame.querySelector('.ws-window-img')).not.toBeInTheDocument();
  expect(frame.querySelector('.ws-window-placeholder')).toBeInTheDocument();
});

test('boutons d\'inscription : ancien hero et CTA finale ouvrent tous les deux Auth en mode inscription', () => {
  const { onOpenAuth } = setup('fr');
  // "Créer un compte" existe a la fois dans l'ancien hero (landing_hero_cta_primary) et la CTA
  // finale (landing_final_cta) -- memes libelles, voir src/i18n.js.
  const boutons = screen.getAllByText('Créer un compte');
  expect(boutons.length).toBe(2);
  fireEvent.click(boutons[0]);
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
  fireEvent.click(boutons[1]);
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
});
