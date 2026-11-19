import { render, screen, fireEvent } from '@testing-library/react';
import { getT } from './i18n';
import { ShareStatsButton } from './ShareStats';

const t = getT('fr');

const BETS = [
  { date: new Date().toISOString(), profit: 50, mise: 100, statut: 'gagne', type: 'Moneyline' },
  { date: new Date().toISOString(), profit: -20, mise: 20, statut: 'perdu', type: 'Total' },
  { date: new Date().toISOString(), profit: 0, mise: 30, statut: 'actif', type: 'Prop joueur' },
];

function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
  setViewportWidth(1024);
  // jsdom n'implemente pas le rendu canvas reel -- le composant saute le dessin si ctx est
  // null (deja gere, voir ShareStats.js), seul toBlob doit etre mocke pour tester le partage.
  HTMLCanvasElement.prototype.toBlob = jest.fn(function (cb) {
    cb(new Blob(['x'], { type: 'image/png' }));
  });
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = jest.fn();
  delete navigator.share;
  delete navigator.canShare;
});

test('le bouton ouvre la feuille "Partager" avec le titre, l\'oeil, les periodes et le carrousel de 2 modeles', () => {
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  expect(screen.queryByText('Partager')).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  expect(screen.getByText('Partager')).toBeInTheDocument();
  expect(screen.getByLabelText('Masquer le solde')).toBeInTheDocument();
  ['1M', '3M', '6M', '1A', 'Tout'].forEach(label => expect(screen.getByText(label)).toBeInTheDocument());
  expect(screen.getByText('Performance')).toBeInTheDocument();
  expect(screen.getByText('Résumé')).toBeInTheDocument();
});

test('oeil : bascule le libelle masquer/afficher', () => {
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));

  const oeil = screen.getByLabelText('Masquer le solde');
  fireEvent.click(oeil);
  expect(screen.getByLabelText('Afficher le solde')).toBeInTheDocument();
});

test('carrousel : cliquer "Résumé" l\'active (aria-current)', () => {
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));

  const btnResume = screen.getByRole('button', { name: 'Résumé' });
  expect(btnResume).toHaveAttribute('aria-current', 'false');
  fireEvent.click(btnResume);
  expect(btnResume).toHaveAttribute('aria-current', 'true');
});

test('bouton d\'action : "Partager" sur mobile', () => {
  setViewportWidth(375);
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  expect(screen.getByRole('button', { name: 'Partager' })).toBeInTheDocument();
});

test('bouton d\'action : "Télécharger" sur desktop', () => {
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  expect(screen.getByRole('button', { name: 'Télécharger' })).toBeInTheDocument();
});

test('utilise le partage natif (Web Share API avec fichier) quand disponible', async () => {
  const share = jest.fn(() => Promise.resolve());
  navigator.share = share;
  navigator.canShare = jest.fn(() => true);

  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  fireEvent.click(screen.getByRole('button', { name: /Télécharger/ }));

  await new Promise(r => setTimeout(r, 0));
  expect(share).toHaveBeenCalledTimes(1);
  expect(share.mock.calls[0][0].files).toHaveLength(1);
});

test('replie sur le telechargement PNG quand le partage natif est indisponible', async () => {
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  fireEvent.click(screen.getByRole('button', { name: /Télécharger/ }));

  await new Promise(r => setTimeout(r, 0));
  expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
});

test('fermeture de la feuille via le bouton ✕', () => {
  render(<ShareStatsButton t={t} lang="fr" bets={BETS} bankroll={500} />);
  fireEvent.click(screen.getByLabelText('Partager mes statistiques'));
  expect(screen.getByText('Partager')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('← Retour'));
  expect(screen.queryByText('Partager')).not.toBeInTheDocument();
});
