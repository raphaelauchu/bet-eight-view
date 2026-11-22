import { render, fireEvent } from '@testing-library/react';
import { PoolPlayerPhoto, PoolTeamLogo, PoolInitialsAvatar, poolPlayerPhotoUrl, POOL_TEAM_LOGOS } from './poolVisuals';
import { NHL_VISUALS_ENABLED } from './brandAssetsConfig';

// ===================== poolVisuals.js : photos joueurs / logos d'equipe -- Pool UNIQUEMENT =====================
// NHL_VISUALS_ENABLED=true est verifie ici (config reelle, src/brandAssetsConfig.js). Le
// scenario drapeau=false est dans un fichier separe (poolVisuals.flagOff.test.js) -- const
// exportee au niveau module, donc pas d'autre moyen propre de la faire varier entre deux tests.

jest.mock('./season', () => ({ useSaisonCourante: () => '20262027' }));

test('NHL_VISUALS_ENABLED est actif par defaut (Pool uniquement, independant de USE_LICENSED_NHL_ASSETS)', () => {
  expect(NHL_VISUALS_ENABLED).toBe(true);
});

test('poolPlayerPhotoUrl : URL officielle assets.nhle.com, saison/equipe/joueur', () => {
  expect(poolPlayerPhotoUrl('20262027', 'MTL', 8480018)).toBe('https://assets.nhle.com/mugs/nhl/20262027/MTL/8480018.png');
});

test('POOL_TEAM_LOGOS : couvre les 32 equipes avec des URLs assets.nhle.com', () => {
  expect(Object.keys(POOL_TEAM_LOGOS).length).toBe(32);
  expect(POOL_TEAM_LOGOS.MTL).toMatch(/^https:\/\/assets\.nhle\.com\//);
});

// ===================== PoolPlayerPhoto : drapeau actif =====================

test('PoolPlayerPhoto (drapeau actif) : <img> lazy, dimensions fixes, URL officielle', () => {
  const { container } = render(<PoolPlayerPhoto teamAbbrev="MTL" playerId={8480018} size={40} alt="Nick Suzuki" />);
  const img = container.querySelector('img');
  expect(img).toBeInTheDocument();
  expect(img.getAttribute('loading')).toBe('lazy');
  expect(img.getAttribute('width')).toBe('40');
  expect(img.getAttribute('height')).toBe('40');
  expect(img.getAttribute('src')).toBe('https://assets.nhle.com/mugs/nhl/20262027/MTL/8480018.png');
});

test('PoolPlayerPhoto (drapeau actif) : image en echec -> repli initiales sur la couleur de l\'equipe', () => {
  const { container } = render(<PoolPlayerPhoto teamAbbrev="MTL" playerId={8480018} size={40} name="Nick Suzuki" />);
  const img = container.querySelector('img');
  fireEvent.error(img);
  const fallback = container.querySelector('[role="img"]');
  expect(fallback).toBeInTheDocument();
  expect(fallback.textContent).toBe('NS');
  expect(container.querySelector('img')).not.toBeInTheDocument();
});

test('PoolPlayerPhoto : sans playerId (joueur manuel) -> initiales directement, jamais de requete photo', () => {
  const { container } = render(<PoolPlayerPhoto teamAbbrev="MTL" playerId={null} size={40} name="Jean Dupont" />);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container.querySelector('[role="img"]').textContent).toBe('JD');
});

// ===================== PoolTeamLogo : drapeau actif =====================

test('PoolTeamLogo (drapeau actif) : <img> lazy, dimensions fixes, URL officielle', () => {
  const { container } = render(<PoolTeamLogo teamAbbrev="MTL" size={20} title="Canadiens" />);
  const img = container.querySelector('img');
  expect(img).toBeInTheDocument();
  expect(img.getAttribute('loading')).toBe('lazy');
  expect(img.getAttribute('width')).toBe('20');
  expect(img.getAttribute('src')).toBe(POOL_TEAM_LOGOS.MTL);
});

test('PoolTeamLogo (drapeau actif) : image en echec -> repli abreviation texte', () => {
  const { container } = render(<PoolTeamLogo teamAbbrev="MTL" size={20} />);
  const img = container.querySelector('img');
  fireEvent.error(img);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container.textContent).toBe('MTL');
});

test('PoolTeamLogo : equipe inconnue -> repli abreviation texte directement', () => {
  const { container } = render(<PoolTeamLogo teamAbbrev="ZZZ" size={20} />);
  expect(container.querySelector('img')).not.toBeInTheDocument();
});

// ===================== PoolInitialsAvatar : initiales =====================

test('PoolInitialsAvatar : initiales sur la couleur reelle de l\'equipe (contraste AA)', () => {
  const { container } = render(<PoolInitialsAvatar teamAbbrev="MTL" name="Nick Suzuki" size={32} />);
  const el = container.querySelector('[role="img"]');
  expect(el.textContent).toBe('NS');
  expect(el.style.backgroundColor).not.toBe('');
});

test('PoolInitialsAvatar : nom absent -> "?"', () => {
  const { container } = render(<PoolInitialsAvatar teamAbbrev="MTL" name="" size={32} />);
  expect(container.querySelector('[role="img"]').textContent).toBe('?');
});

// Drapeau desactive : voir src/poolVisuals.flagOff.test.js (jest.mock statique en tete de
// fichier -- NHL_VISUALS_ENABLED est une const exportee, donc un fichier de test separe est le
// seul moyen propre de la faire varier sans resetModules (qui recharge aussi React et casse les
// hooks entre l'instance de render() et celle du composant).
