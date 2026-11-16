import { render, screen, fireEvent, within } from '@testing-library/react';
import Landing from './Landing';

// ===================== Landing publique (src/Landing.js) =====================
// Aucune donnee reseau ni supabase ici (page statique) -- pas de mock necessaire. jsdom n'a
// pas d'IntersectionObserver reel : les sections Reveal restent dans le DOM (seule leur classe
// CSS d'opacite differe), donc testables normalement sans attendre l'animation.

function setup(lang = 'fr') {
  const onOpenAuth = jest.fn();
  const utils = render(<Landing lang={lang} setLang={() => {}} onOpenAuth={onOpenAuth} />);
  return { ...utils, onOpenAuth };
}

// ===================== Rendu des sections =====================

test('rendu : toutes les sections attendues sont presentes (nav, hero, fonctions, pool, pour commencer, bientot, faq, pied de page)', () => {
  setup('fr');
  expect(screen.getByText('Transforme une décision émotionnelle en pari calculé.')).toBeInTheDocument();
  expect(document.getElementById('fonctions')).toBeInTheDocument();
  expect(document.getElementById('pool')).toBeInTheDocument();
  expect(document.getElementById('analyses')).toBeInTheDocument();
  expect(document.getElementById('bankroll')).toBeInTheDocument();
  expect(document.getElementById('faq')).toBeInTheDocument();
  expect(screen.getByText('Pour commencer')).toBeInTheDocument();
  expect(screen.getByText('Bientôt')).toBeInTheDocument();
  expect(screen.getAllByText('À venir').length).toBe(2); // comparateur de cotes + detection +EV
  expect(screen.getByText('Questions fréquentes')).toBeInTheDocument();
  expect(document.querySelector('.landing-footer')).toBeInTheDocument();
});

test('rendu : les 4 cartes de fonctions et les 3 blocs alternes sont presents', () => {
  setup('fr');
  expect(screen.getByRole('heading', { name: 'Analyses' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pool de hockey' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Suivi de bankroll' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Modèles' })).toBeInTheDocument();
  expect(screen.getByText('Un pool qui tourne toute la saison.')).toBeInTheDocument();
  expect(screen.getByText('Chaque matchup, décortiqué.')).toBeInTheDocument();
  expect(screen.getByText('Ta bankroll, suivie comme un portefeuille.')).toBeInTheDocument();
  // Les 7 points du pool explicitement demandes (certains apparaissent aussi, verbatim,
  // dans le resume court de la carte "fonctions" -- d'ou getAllByText plutot que getByText).
  ['Formation en cartes', 'Échanges avec contre-offres', 'Classement en direct', 'Agents libres', 'Règles 100 % personnalisables', 'Plafond salarial optionnel', 'Repêchage en direct']
    .forEach(label => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
});

// ===================== Bascule FR/EN =====================

test('bascule de langue : le contenu passe integralement au francais ou a l\'anglais', () => {
  const { rerender } = render(<Landing lang="en" setLang={() => {}} onOpenAuth={() => {}} />);
  expect(screen.getByText('Turn an emotional decision into a calculated bet.')).toBeInTheDocument();
  expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();

  rerender(<Landing lang="fr" setLang={() => {}} onOpenAuth={() => {}} />);
  expect(screen.getByText('Transforme une décision émotionnelle en pari calculé.')).toBeInTheDocument();
  expect(screen.getByText('Questions fréquentes')).toBeInTheDocument();
  expect(screen.queryByText('Turn an emotional decision into a calculated bet.')).not.toBeInTheDocument();
});

// ===================== Boutons de connexion/inscription =====================

test('boutons de connexion/inscription : chacun ouvre Auth dans le bon mode', () => {
  const { onOpenAuth } = setup('fr');

  fireEvent.click(screen.getByText('Se connecter'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('login');

  fireEvent.click(screen.getAllByText('Créer un compte')[0]); // nav
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');

  fireEvent.click(screen.getByText('Voir comment ça marche'));
  // navigation en page (ancre), ne doit pas ouvrir Auth.
  expect(onOpenAuth).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByText('Créer un pool')); // section "pour commencer"
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');

  fireEvent.click(screen.getByText('Prêt à parier avec ta tête ?').closest('section').querySelector('button'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
});

// ===================== FAQ accessible au clavier =====================

test('FAQ : accessible au clavier (bouton natif, focusable), aria-expanded et contenu masque/affiche correctement', () => {
  setup('fr');
  const question = screen.getByText('Betrics place-t-il des paris pour moi ?').closest('button');
  // Bouton HTML natif (pas un div role="button") : active par Entree/Espace nativement par
  // le navigateur, sans gestionnaire onKeyDown a tester separement.
  expect(question.tagName).toBe('BUTTON');
  expect(question).toHaveAttribute('aria-expanded', 'false');

  const answerId = question.getAttribute('aria-controls');
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.getElementById(answerId)).toHaveAttribute('hidden');

  question.focus();
  expect(document.activeElement).toBe(question);
  fireEvent.click(question); // equivalent a l'activation native par Entree/Espace sur un <button>
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
  // Anciens chiffres fictifs de la landing precedente, qui ne doivent plus exister.
  expect(body).not.toMatch(/99%/);
  expect(body).not.toMatch(/uptime/i);
  expect(body).not.toMatch(/40\+/);
  expect(body).not.toMatch(/\$\d/); // aucun prix affiche
  expect(screen.queryByText(/témoignage/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/avis/i)).not.toBeInTheDocument();

  // La bande de confiance contient uniquement les 3 mentions honnetes attendues.
  const trustItems = document.querySelectorAll('.landing-trust-item');
  expect(trustItems.length).toBe(3);
  expect(trustItems[0]).toHaveTextContent('Données de la LNH');
  expect(trustItems[1]).toHaveTextContent('Gratuit pour commencer');
  expect(trustItems[2]).toHaveTextContent('Bilingue FR/EN');
});

test('section "Bientot" : aucun prix, les deux fonctions sont marquees "a venir"', () => {
  setup('fr');
  const soonCards = document.querySelectorAll('.landing-soon-card');
  expect(soonCards.length).toBe(2);
  soonCards.forEach(card => expect(within(card).getByText('À venir')).toBeInTheDocument());
});

// ===================== Jeu responsable =====================

test('pied de page : message de jeu responsable present (age selon la province, ressource d\'aide sourcee)', () => {
  setup('fr');
  expect(screen.getByText(/Betrics est un outil d'analyse\. Nous ne plaçons pas de paris/)).toBeInTheDocument();
  expect(screen.getByText(/18 ans et plus au Québec, en Alberta et au Manitoba/)).toBeInTheDocument();
  expect(screen.getByText('Jeu : aide et référence')).toBeInTheDocument();
  expect(screen.getByText(/1 800 461-0140/)).toBeInTheDocument();
  expect(screen.getByText(/aidejeu\.ca/)).toBeInTheDocument();
});

// ===================== Pages legales simples =====================

test('pied de page : les liens legaux ouvrent une page simple avec un retour vers la landing', () => {
  setup('fr');
  fireEvent.click(screen.getByText('Conditions d\'utilisation'));
  expect(screen.getByRole('heading', { name: 'Conditions d\'utilisation' })).toBeInTheDocument();
  expect(screen.queryByText('Transforme une décision émotionnelle en pari calculé.')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('← Retour'));
  expect(screen.getByText('Transforme une décision émotionnelle en pari calculé.')).toBeInTheDocument();
});

// ===================== Captures produit : repli propre si l'image est absente =====================

test('ProductShot : si l\'image echoue, un emplacement propre (sans icone cassee) prend sa place', () => {
  setup('fr');
  // Plusieurs captures sur la page (hero + 3 blocs alternes) : on cible precisement celle du
  // hero plutot qu'un querySelector generique (qui retomberait sur la capture suivante une
  // fois la premiere remplacee par son emplacement de repli).
  const heroFrame = document.querySelector('.landing-hero-shot-wrap .landing-shot-frame');
  const img = heroFrame.querySelector('.landing-shot-img');
  expect(img).toBeInTheDocument();
  fireEvent.error(img);
  expect(heroFrame.querySelector('.landing-shot-img')).not.toBeInTheDocument();
  expect(heroFrame.querySelector('.landing-shot-placeholder')).toBeInTheDocument();
});
