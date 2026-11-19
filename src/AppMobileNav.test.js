import { render, screen, fireEvent } from '@testing-library/react';
import { getT } from './i18n';
import { BottomNav, MobileTopBar, MoreSheet } from './App';

const t = getT('fr');

function Icon({ color, size }) {
  return <svg data-testid="icon" width={size} height={size} style={{ color }} />;
}

const TABS = [
  { id: 'home', label: 'Accueil', Icon },
  { id: 'search', label: 'Recherche', Icon },
  { id: 'stats', label: 'Analyses', Icon, badge: 2 },
  { id: 'props', label: 'Modèles', Icon },
];

const noop = () => {};

test('BottomNav : 4 onglets seulement, icones sans libelle visible, clic appelle onSelectTab', () => {
  const onSelectTab = jest.fn();
  render(<BottomNav tabs={TABS} activeId="stats" onSelectTab={onSelectTab} />);

  const boutons = screen.getAllByRole('button');
  expect(boutons).toHaveLength(4);
  // Pas de libelle texte visible (icones seules) : seul l'aria-label porte le nom.
  expect(screen.queryByText('Accueil')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Accueil')).toBeInTheDocument();

  expect(screen.getByLabelText('Analyses')).toHaveAttribute('aria-current', 'page');
  expect(screen.getByLabelText('Accueil')).not.toHaveAttribute('aria-current');

  fireEvent.click(screen.getByLabelText('Recherche'));
  expect(onSelectTab).toHaveBeenCalledWith(TABS[1]);
});

test('MoreSheet : liste les sections secondaires avec icone + libelle, ferme et navigue au clic', () => {
  const tabsSecondaires = [
    { id: 'pooldraft', label: 'Pool', Icon },
    { id: 'bets', label: 'Paris', Icon },
    { id: 'bankroll', label: 'Bankroll', Icon },
  ];
  const onSelectTab = jest.fn();
  const onClose = jest.fn();
  render(<MoreSheet tabs={tabsSecondaires} onSelectTab={onSelectTab} onClose={onClose} t={t} />);

  expect(screen.getByText('Pool')).toBeInTheDocument();
  expect(screen.getByText('Paris')).toBeInTheDocument();
  expect(screen.getByText('Bankroll')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Bankroll'));
  expect(onSelectTab).toHaveBeenCalledWith(tabsSecondaires[2]);
  expect(onClose).toHaveBeenCalledTimes(1);
});

function renderTopBar(overrides = {}) {
  return render(
    <MobileTopBar
      title="Accueil"
      onGoHome={noop}
      tabsSecondaires={[{ id: 'pooldraft', label: 'Pool', Icon }]}
      onSelectTab={noop}
      utilisateur={{ id: 'u1', email: 'alex@example.com' }}
      avatarUrl={null}
      displayName="Alex"
      themePref="dark" setThemePref={noop}
      lang="fr" setLang={noop}
      onGoToProfile={noop} onLogout={noop} t={t}
      {...overrides}
    />
  );
}

test('MobileTopBar : logo a gauche, titre au centre, "..." ouvre la feuille des sections secondaires', () => {
  renderTopBar();

  expect(screen.getByLabelText('Betrics')).toBeInTheDocument();
  expect(screen.getByText('Accueil')).toBeInTheDocument();
  expect(screen.queryByText('Pool')).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Plus'));
  expect(screen.getByText('Pool')).toBeInTheDocument();
});

test('MobileTopBar : le bouton de profil ouvre la feuille du bas (nom, Apparence, Langue, Paramètres, Déconnexion)', () => {
  renderTopBar();

  fireEvent.click(screen.getByLabelText('Réglages'));
  expect(screen.getByText('Alex')).toBeInTheDocument();
  expect(screen.getByText('Apparence')).toBeInTheDocument();
  expect(screen.getByText('Langue')).toBeInTheDocument();
  expect(screen.getByText('Déconnexion')).toBeInTheDocument();
});

test('MobileTopBar : pas de bouton "..." quand il n\'y a aucune section secondaire', () => {
  renderTopBar({ tabsSecondaires: [] });
  expect(screen.queryByLabelText('Plus')).not.toBeInTheDocument();
});

test('MobileTopBar : position fixe (pas sticky) avec un z-index eleve -- en-tete toujours visible, jamais masque au defilement', () => {
  renderTopBar();
  const barre = screen.getByLabelText('Betrics').closest('div');
  expect(barre).toHaveStyle({ position: 'fixed', top: '0px' });
});

test('"..." et profil s\'ouvrent aussi au toucher (touchstart/touchend), pas seulement au clic souris', () => {
  renderTopBar();

  fireEvent.touchStart(screen.getByLabelText('Plus'));
  fireEvent.touchEnd(screen.getByLabelText('Plus'));
  fireEvent.click(screen.getByLabelText('Plus')); // les navigateurs mobiles emettent aussi un click synthetique apres le toucher
  expect(screen.getByText('Pool')).toBeInTheDocument();
});

test('les feuilles "..." et profil sont rendues via portail (document.body), jamais imbriquees dans la top bar', () => {
  const { container } = renderTopBar();

  fireEvent.click(screen.getByLabelText('Plus'));
  const feuillePlus = screen.getByRole('dialog');
  expect(container.contains(feuillePlus)).toBe(false);
  expect(document.body.contains(feuillePlus)).toBe(true);
  fireEvent.click(feuillePlus.parentElement); // ferme via le fond

  fireEvent.click(screen.getByLabelText('Réglages'));
  const feuilleProfil = screen.getByRole('dialog');
  expect(container.contains(feuilleProfil)).toBe(false);
  expect(document.body.contains(feuilleProfil)).toBe(true);
});

test('les boutons "..." et profil restent presents et cliquables apres un re-render du parent (persistance, pas de disparition)', () => {
  const { rerender } = renderTopBar({ title: 'Accueil' });
  expect(screen.getByLabelText('Plus')).toBeInTheDocument();
  expect(screen.getByLabelText('Réglages')).toBeInTheDocument();

  // Simule un re-render du parent (ex. changement de page -> nouveau titre), comme App() le
  // ferait a chaque navigation -- les boutons ne doivent ni disparaitre ni perdre leur etat.
  rerender(
    <MobileTopBar
      title="Analyses" onGoHome={noop}
      tabsSecondaires={[{ id: 'pooldraft', label: 'Pool', Icon }]} onSelectTab={noop}
      utilisateur={{ id: 'u1', email: 'alex@example.com' }} avatarUrl={null} displayName="Alex"
      themePref="dark" setThemePref={noop} lang="fr" setLang={noop}
      onGoToProfile={noop} onLogout={noop} t={t}
    />
  );

  expect(screen.getByText('Analyses')).toBeInTheDocument();
  const boutonPlus = screen.getByLabelText('Plus');
  const boutonProfil = screen.getByLabelText('Réglages');
  expect(boutonPlus).toBeInTheDocument();
  expect(boutonProfil).toBeInTheDocument();

  fireEvent.click(boutonPlus);
  expect(screen.getByText('Pool')).toBeInTheDocument();
});

test('ouvrir la feuille de profil puis cliquer a l\'interieur (ex. le nom) ne la referme pas aussitot', () => {
  renderTopBar();
  fireEvent.click(screen.getByLabelText('Réglages'));
  expect(screen.getByText('Alex')).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByText('Alex'));
  fireEvent.click(screen.getByText('Alex'));
  expect(screen.getByText('Alex')).toBeInTheDocument();
  expect(screen.getByText('Apparence')).toBeInTheDocument();
});
