import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModelesFlux from './Modeles';

jest.mock('./Analyses', () => ({
  LOGOS_NHL: {},
  useIsMobile: jest.fn(() => false),
  useSaisonCourante: () => '20252026',
  chargerProchaineSemaineAvecMatchs: () => Promise.resolve({}),
  formatSemaineDe: () => '',
  calculerFavoriMatch: () => ({ favoriAbbrev: '', probFavori: 0 }),
}));

const { useIsMobile } = require('./Analyses');

beforeEach(() => {
  jest.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ standings: [] }) }));
});

// ===================== iPad/web (>=768px) : liste a gauche (persistante) + detail a droite =====================

test('iPad/web : la liste des modeles reste visible a gauche apres selection, et le detail apparait a droite', async () => {
  render(<ModelesFlux />);
  fireEvent.click(screen.getByText('Analyser une Équipe'));
  await waitFor(() => expect(screen.getByText(/modèles disponibles/)).toBeInTheDocument());

  // Avant selection : message d'aide a droite, pas de bouton retour sur la liste (le bouton
  // "Back" present est celui de la liste, qui revient a l'accueil).
  expect(screen.getByText('Sélectionnez un modèle à gauche pour voir son détail')).toBeInTheDocument();

  const premierModele = document.querySelectorAll('div[style*="cursor: pointer"]')[0];
  fireEvent.click(premierModele);

  // La liste (ex. "modèles disponibles") reste affichee en meme temps que le detail (ROI).
  await waitFor(() => expect(screen.getByText('PRINCIPE DU MODÈLE')).toBeInTheDocument());
  expect(screen.getByText(/modèles disponibles/)).toBeInTheDocument();
});

// ===================== Mobile (<768px) : INCHANGE, navigation plein ecran =====================

test('mobile : la selection d\'un modele remplace la liste par le detail (comportement inchange)', async () => {
  useIsMobile.mockReturnValue(true);
  render(<ModelesFlux />);
  fireEvent.click(screen.getByText('Analyser une Équipe'));
  await waitFor(() => expect(screen.getByText(/modèles disponibles/)).toBeInTheDocument());

  const premierModele = document.querySelectorAll('div[style*="cursor: pointer"]')[0];
  fireEvent.click(premierModele);

  await waitFor(() => expect(screen.getByText('PRINCIPE DU MODÈLE')).toBeInTheDocument());
  expect(screen.queryByText(/modèles disponibles/)).not.toBeInTheDocument();
});
