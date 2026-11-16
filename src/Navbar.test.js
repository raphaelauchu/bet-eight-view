import { render, screen, fireEvent, within } from '@testing-library/react';
import Navbar from './Navbar';

// ===================== Navigation publique (src/Navbar.js) =====================
// Logo + Outils (mega menu) + Pool + Tarifs + Ressources, FR/EN, Se connecter/Commencer,
// menu mobile plein ecran accessible. jsdom n'a pas de vrai layout (pas de media query
// appliquee visuellement) : on teste la presence/etat du DOM, pas le CSS responsive lui-meme.

function setup(lang = 'fr') {
  const navigate = jest.fn();
  const setLang = jest.fn();
  const onOpenAuth = jest.fn();
  const utils = render(<Navbar lang={lang} setLang={setLang} navigate={navigate} onOpenAuth={onOpenAuth} />);
  return { ...utils, navigate, setLang, onOpenAuth };
}

// ===================== Mega menu "Outils" =====================

test('mega menu Outils : s\'ouvre au clic, liste les vrais outils groupes par theme, se ferme a l\'activation d\'un item', () => {
  const { navigate } = setup('fr');
  const toolsBtn = screen.getByText('Outils');
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(toolsBtn);
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Fiche détaillée pour chaque joueur de la LNH.')).toBeInTheDocument();
  expect(screen.getByText('Pool de hockey')).toBeInTheDocument();
  // Le groupe "Bientot" (titre + 2 pastilles d'outils marques "bientot").
  expect(screen.getAllByText('Bientôt').length).toBe(3);

  fireEvent.click(screen.getByText('Modèles'));
  expect(navigate).toHaveBeenCalledWith('/outils/modeles');
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'false');
});

test('mega menu Outils : la touche Echap et le clic exterieur ferment le panneau', () => {
  setup('fr');
  const toolsBtn = screen.getByText('Outils');

  fireEvent.click(toolsBtn);
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(toolsBtn);
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'true');
  fireEvent.mouseDown(document.body);
  expect(toolsBtn).toHaveAttribute('aria-expanded', 'false');
});

test('item "Pool de hockey" du mega menu : navigue directement vers /pool (pas une ancre)', () => {
  const { navigate } = setup('fr');
  fireEvent.click(screen.getByText('Outils'));
  fireEvent.click(screen.getByText('Pool de hockey'));
  expect(navigate).toHaveBeenCalledWith('/pool');
});

// ===================== Menu "Ressources" =====================

test('menu Ressources : Guide et FAQ naviguent correctement', () => {
  const { navigate } = setup('fr');
  fireEvent.click(screen.getByText('Ressources'));
  fireEvent.click(screen.getByText('Guide'));
  expect(navigate).toHaveBeenCalledWith('/guide');
});

// ===================== Liens de premier niveau =====================

test('liens Pool et Tarifs naviguent vers leur page dediee', () => {
  const { navigate } = setup('fr');
  fireEvent.click(screen.getByText('Pool'));
  expect(navigate).toHaveBeenLastCalledWith('/pool');
  fireEvent.click(screen.getByText('Tarifs'));
  expect(navigate).toHaveBeenLastCalledWith('/tarifs');
});

// ===================== Connexion / inscription / langue =====================

test('Se connecter et Commencer ouvrent Auth dans le bon mode', () => {
  const { onOpenAuth } = setup('fr');
  fireEvent.click(screen.getByText('Se connecter'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('login');
  fireEvent.click(screen.getByText('Commencer'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
});

test('bascule de langue : EN devient actif au clic', () => {
  const { setLang } = setup('fr');
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  expect(setLang).toHaveBeenCalledWith('en');
});

// ===================== Menu mobile plein ecran =====================

test('menu mobile : s\'ouvre en plein ecran, accordeon par groupe, ferme a Echap, focus initial sur un bouton', () => {
  setup('fr');
  fireEvent.click(screen.getByLabelText('Ouvrir le menu'));

  const dialog = screen.getByRole('dialog');
  expect(dialog).toBeInTheDocument();
  expect(document.activeElement).toBeInstanceOf(HTMLButtonElement);
  // eslint-disable-next-line testing-library/no-node-access
  expect(dialog.contains(document.activeElement)).toBe(true);

  const analysisTrigger = screen.getByText('Analyse').closest('button');
  expect(analysisTrigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(analysisTrigger);
  expect(analysisTrigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Stats joueurs')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('menu mobile : le bouton Commencer ouvre Auth en inscription et referme le menu', () => {
  const { onOpenAuth } = setup('fr');
  fireEvent.click(screen.getByLabelText('Ouvrir le menu'));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByText('Commencer'));
  expect(onOpenAuth).toHaveBeenLastCalledWith('signup');
  expect(dialog).not.toBeInTheDocument();
});

// ===================== Bascule FR/EN du contenu =====================

test('bascule de langue : le libelle des liens change integralement', () => {
  const { rerender } = render(<Navbar lang="en" setLang={() => {}} navigate={() => {}} onOpenAuth={() => {}} />);
  expect(screen.getByText('Tools')).toBeInTheDocument();
  expect(screen.getByText('Pricing')).toBeInTheDocument();

  rerender(<Navbar lang="fr" setLang={() => {}} navigate={() => {}} onOpenAuth={() => {}} />);
  expect(screen.getByText('Outils')).toBeInTheDocument();
  expect(screen.getByText('Tarifs')).toBeInTheDocument();
});
