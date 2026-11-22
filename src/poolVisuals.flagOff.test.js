import { render } from '@testing-library/react';
import { PoolPlayerPhoto, PoolTeamLogo } from './poolVisuals';

// ===================== poolVisuals.js : NHL_VISUALS_ENABLED=false =====================
// Fichier dedie (jest.mock statique, charge avant tout import) : quand le drapeau Pool est
// desactive, initiales/abreviations partout, jamais de requete assets.nhle.com -- voir
// poolVisuals.test.js pour le comportement drapeau actif (defaut reel de brandAssetsConfig.js).
jest.mock('./brandAssetsConfig', () => ({
  NHL_VISUALS_ENABLED: false, USE_LICENSED_NHL_ASSETS: false, USE_PLAYER_HELMET_ICONS: false,
}));
jest.mock('./season', () => ({ useSaisonCourante: () => '20262027' }));

test('PoolPlayerPhoto : initiales directement, jamais de requete assets.nhle.com', () => {
  const { container } = render(<PoolPlayerPhoto teamAbbrev="MTL" playerId={8480018} size={40} name="Nick Suzuki" />);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container.querySelector('[role="img"]').textContent).toBe('NS');
});

test('PoolTeamLogo : abreviation texte directement, jamais de requete assets.nhle.com', () => {
  const { container } = render(<PoolTeamLogo teamAbbrev="MTL" size={20} />);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container.textContent).toBe('MTL');
});
