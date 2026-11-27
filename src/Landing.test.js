import { render, screen, fireEvent } from '@testing-library/react';
import Landing from './Landing';

// ===================== Accueil public V2 (src/Landing.js, LANDING_V2_ENABLED=true par defaut) ===
// Contenu de l'accueil V2 uniquement -- navigation (src/Navbar.js/src/LandingHeaderV2.js) et pied
// de page (src/PublicFooter.js) sont testes separement, ils vivent dans src/PublicSite.js, pas
// ici. La V2 ne garde QUE le hero + la section Fonctions (qui porte sa propre bande CTA) --
// HomeAlternating/ForWho/HomeFaq/HomeFinalCta (ancienne page) ne sont plus montes ici, voir
// src/Landing.flagOff.test.js pour ce contenu-la (toujours present derriere le drapeau a false).
// Aucune donnee reseau ni supabase ici (page statique) -- jsdom n'a pas d'IntersectionObserver
// reel : les sections Reveal restent dans le DOM (seule leur classe CSS d'opacite differe), donc
// testables normalement sans attendre l'animation.

function setup(lang = 'fr') {
  const onOpenAuth = jest.fn();
  const utils = render(<Landing lang={lang} onOpenAuth={onOpenAuth} />);
  return { ...utils, onOpenAuth };
}

// ===================== Rendu des sections =====================

test('rendu : hero V2 + section Fonctions presents, un seul h1', () => {
  setup('fr');
  expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
  expect(screen.getByText('VOIS LES DONNÉES')).toBeInTheDocument();
  expect(screen.getByText('CHAQUE PARI.')).toBeInTheDocument();
  expect(document.getElementById('fonctions')).toBeInTheDocument();
  expect(screen.getByText('FONCTIONS')).toBeInTheDocument();
  expect(screen.getByText('COMMENCER')).toBeInTheDocument();
});

test('rendu : les anciennes sections (blocs alternes, Pour qui, FAQ, CTA finale) ne sont plus montees', () => {
  setup('fr');
  expect(document.getElementById('analyses')).not.toBeInTheDocument();
  expect(document.getElementById('pool-apercu')).not.toBeInTheDocument();
  expect(document.getElementById('bankroll')).not.toBeInTheDocument();
  expect(document.getElementById('outils')).not.toBeInTheDocument();
  expect(document.getElementById('faq')).not.toBeInTheDocument();
  expect(screen.queryByText('Chaque matchup, décortiqué.')).not.toBeInTheDocument();
  expect(screen.queryByText('Un pool qui tourne toute la saison.')).not.toBeInTheDocument();
  expect(screen.queryByText('Ta bankroll, suivie comme un portefeuille.')).not.toBeInTheDocument();
  expect(screen.queryByText('Des outils pour objectiver chaque décision.')).not.toBeInTheDocument();
  expect(screen.queryByText('Pour qui ?')).not.toBeInTheDocument();
  expect(screen.queryByText('Questions fréquentes')).not.toBeInTheDocument();
  expect(screen.queryByText('Prêt à parier avec ta tête ?')).not.toBeInTheDocument();
  expect(screen.queryByText('Créer un compte')).not.toBeInTheDocument(); // CTA finale retiree (landing_final_cta)
});

// ===================== Bascule FR/EN =====================

test('bascule de langue : le contenu passe integralement au francais ou a l\'anglais', () => {
  const { rerender } = render(<Landing lang="en" onOpenAuth={() => {}} />);
  expect(screen.getByText('SEE THE DATA')).toBeInTheDocument();
  expect(screen.getByText('EVERY BET.')).toBeInTheDocument();
  expect(screen.getByText('FEATURES')).toBeInTheDocument();

  rerender(<Landing lang="fr" onOpenAuth={() => {}} />);
  expect(screen.getByText('VOIS LES DONNÉES')).toBeInTheDocument();
  expect(screen.getByText('CHAQUE PARI.')).toBeInTheDocument();
  expect(screen.getByText('FONCTIONS')).toBeInTheDocument();
  expect(screen.queryByText('SEE THE DATA')).not.toBeInTheDocument();
});

// ===================== Boutons de connexion/inscription =====================

test('boutons d\'inscription : hero V2 et bande CTA de la section Fonctions ouvrent tous les deux Auth en mode inscription', () => {
  const { onOpenAuth } = setup('fr');

  // "Commencer" existe dans le hero (src/LandingHeroV2.js) ET dans la bande CTA de la section
  // Fonctions (src/LandingFeaturesV2.js) -- meme reutilisation de nav_signup, DOM order garanti.
  const boutons = screen.getAllByText('Commencer');
  expect(boutons.length).toBe(2);

  fireEvent.click(boutons[0]); // hero
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');

  fireEvent.click(screen.getByText(/Voir comment ça marche/));
  // navigation en page (ancre), ne doit pas ouvrir Auth une deuxieme fois.
  expect(onOpenAuth).toHaveBeenCalledTimes(1);

  fireEvent.click(boutons[1]); // bande CTA finale de la section Fonctions
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');

  fireEvent.click(screen.getByText('Se connecter'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('login');
});

// ===================== Contenu responsable : aucun chiffre/temoignage invente =====================

test('contenu responsable : aucun chiffre de confiance ni temoignage, aucune mention de prix/forfait (hors donnees de demonstration du mockup de telephones)', () => {
  setup('fr');
  // Le mockup de telephones (src/LandingPhoneDemo.js) et les 3 cartes interactives de la section
  // Fonctions (src/LandingFeaturesV2.js) affichent volontairement des montants/cotes -- des
  // donnees de DEMONSTRATION clairement etiquetees (pastille "Données de démonstration" partout),
  // pas un chiffre de confiance ni un prix annonce -- exclus avant de verifier le reste de la page.
  const bodyClone = document.body.cloneNode(true);
  const mockup = bodyClone.querySelector('.landing2-hero-visual');
  if (mockup) mockup.remove();
  const features = bodyClone.querySelector('.landing2-features');
  if (features) features.remove();
  const body = bodyClone.textContent;
  expect(body).not.toMatch(/99%/);
  expect(body).not.toMatch(/uptime/i);
  expect(body).not.toMatch(/40\+/);
  expect(body).not.toMatch(/\$\d/);
  expect(screen.queryByText(/témoignage/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/avis/i)).not.toBeInTheDocument();
  // Aucune pastille "nouveau"/badge gadget sur l'accueil.
  expect(screen.queryByText(/^NEW$/i)).not.toBeInTheDocument();
});

test('mockup de telephones et cartes Fonctions : montants de demonstration clairement etiquetes, aucune note d\'App Store/nombre d\'utilisateurs/temoignage', () => {
  setup('fr');
  // 1 mockup de telephones (hero) + 3 cartes interactives (section Fonctions) = 4 pastilles.
  expect(screen.getAllByText('Données de démonstration').length).toBe(4);
  expect(document.querySelectorAll('.landing-phone').length).toBe(2);
  expect(screen.queryByText(/★|⭐|note.*app store|app store.*note/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/utilisateurs/i)).not.toBeInTheDocument();
});
