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
