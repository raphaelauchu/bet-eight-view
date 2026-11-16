import { render } from '@testing-library/react';
import { USE_LICENSED_NHL_ASSETS, USE_PLAYER_HELMET_ICONS } from './brandAssetsConfig';
import { NHL_TEAM_COLORS } from './nhlTeamColors';
import {
  readableTextColor, playerAvatarUri, jerseyAvatarUri, teamCrestUri,
  PlayerHelmet, GoalieMask, TeamJersey, TeamCrest, PlayerAvatar, BlankProfileIcon,
} from './BrandAssets';
import PlayerCard from './PlayerCard';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

// PlayerCard (variant="formation") resout le numero de chandail via useRosterNumber
// (src/rosterNumbers.js, roster/{abbrev}/current) -- jamais un appel reel ici : roster vide
// simule (le joueur retombe sur ses initiales, comportement teste plus bas).
beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ forwards: [], defensemen: [], goalies: [] }) }));
});

// ===================== Interrupteur =====================
// Ce fichier verifie le comportement "aucune licence LNH/NHLPA" (USE_LICENSED_NHL_ASSETS=false).
// S'il echoue apres un changement de src/brandAssetsConfig.js, c'est le signal attendu : les
// assertions ci-dessous (aucune URL nhle.com) ne s'appliquent qu'a cet etat.
test('interrupteur : USE_LICENSED_NHL_ASSETS est a false (aucune licence pour le moment)', () => {
  expect(USE_LICENSED_NHL_ASSETS).toBe(false);
});

// Casque/masque abandonnes (regle finale) au profit d'une icone de profil vide identique pour
// toutes les positions -- code conserve mais gele derriere USE_PLAYER_HELMET_ICONS.
test('interrupteur : USE_PLAYER_HELMET_ICONS est a false (casque/masque abandonnes)', () => {
  expect(USE_PLAYER_HELMET_ICONS).toBe(false);
});

// ===================== Icone de profil vide (remplace casque/masque partout) =====================

test('PlayerHelmet/GoalieMask : rendent desormais la MEME icone de profil vide, identique pour toutes les positions', () => {
  const { container: c1 } = render(<PlayerHelmet teamAbbrev="MTL" size={64} />);
  const { container: c2 } = render(<GoalieMask teamAbbrev="MTL" size={64} />);
  // Meme sortie (modulo l'id de degrade unique par useId) : aucune distinction visuelle
  // attaquant/defenseur/gardien tant que USE_PLAYER_HELMET_ICONS est faux.
  const normalize = (html) => html.replace(/pa-clip-[:\w-]+/g, 'pa-clip-X');
  expect(normalize(c1.innerHTML)).toBe(normalize(c2.innerHTML));
  // Ni visiere, ni grille de masque (lignes de la grille du gardien), ni "B" de Betrics --
  // une silhouette generique seulement (cercle exterieur + tete + epaules).
  expect(c1.querySelectorAll('line').length).toBe(0);
  expect(c1.querySelectorAll('clipPath').length).toBe(1);
  expect(c1.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2); // cercle exterieur + tete
});

test('BlankProfileIcon : xmlns + dimensions explicites, aucun <img>, contraste AA (equipe connue et inconnue)', () => {
  function relLuminance(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a, b) {
    const [L1, L2] = [relLuminance(a), relLuminance(b)];
    const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (light + 0.05) / (dark + 0.05);
  }
  for (const abbrev of [...Object.keys(NHL_TEAM_COLORS), '', 'ZZZ']) {
    const { container } = render(<BlankProfileIcon teamAbbrev={abbrev} size={64} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('width')).toBe('64');
    expect(svg.getAttribute('height')).toBe('64');
    expect(container.querySelectorAll('img').length).toBe(0);
    const circleBg = container.querySelector('svg > circle').getAttribute('fill'); // cercle exterieur (fond)
    const silhouette = container.querySelector('g[clip-path]').getAttribute('fill'); // tete + epaules
    expect(contrast(circleBg, silhouette)).toBeGreaterThanOrEqual(4.5);
  }
});

function isDataUri(src) { return typeof src === 'string' && src.startsWith('data:image/svg+xml,'); }
function pointsToNhlDomain(src) { return typeof src === 'string' && /nhle?\.com/.test(src); }

// ===================== Generateurs : jamais de domaine LNH =====================

test('playerAvatarUri / jerseyAvatarUri / teamCrestUri : toujours un data: URI, jamais assets.nhle.com', () => {
  for (const abbrev of [...Object.keys(NHL_TEAM_COLORS), 'XXX', undefined]) {
    const helmet = playerAvatarUri(abbrev, { goalie: false });
    const mask = playerAvatarUri(abbrev, { goalie: true });
    const jersey = jerseyAvatarUri(abbrev, { number: 23 });
    const jerseyInitials = jerseyAvatarUri(abbrev, { name: 'Jean Dupont' });
    const crest = teamCrestUri(abbrev);
    [helmet, mask, jersey, jerseyInitials, crest].forEach(src => {
      expect(isDataUri(src)).toBe(true);
      expect(pointsToNhlDomain(src)).toBe(false);
    });
  }
});

test('jerseyAvatarUri : affiche le numero si fourni, sinon les initiales (jamais invente)', () => {
  const withNumber = decodeURIComponent(jerseyAvatarUri('MTL', { number: 23, name: 'Dupont' }));
  expect(withNumber).toContain('>23<');
  expect(withNumber).toContain('DUPONT');
  const withoutNumber = decodeURIComponent(jerseyAvatarUri('MTL', { name: 'Jean Dupont' }));
  // Nom de famille seul, initiales si pas de numero -- "JD", jamais "23".
  expect(withoutNumber).toContain('DUPONT');
  expect(withoutNumber).toContain('>JD<');
});

test('jerseyAvatarUri : nom inconnu -> numero seul ; aucun des deux -> "?"', () => {
  const numeroSeul = decodeURIComponent(jerseyAvatarUri('BOS', { number: 37 }));
  expect(numeroSeul).toContain('>37<');
  const aucun = decodeURIComponent(jerseyAvatarUri('EDM', {}));
  expect(aucun).toContain('>?<');
});

test('teamCrestUri : chandail vue de face SANS texte (variante compacte, tres petits emplacements)', () => {
  const svg = decodeURIComponent(teamCrestUri('TOR'));
  expect(svg).not.toContain('<text');
  expect(svg).not.toContain('TOR');
});

// ===================== Contraste AA du texte sur le chandail =====================

test('readableTextColor : contraste >= 4.5:1 (AA texte normal) pour chaque couleur d\'equipe reelle', () => {
  function luminance(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a, b) {
    const [L1, L2] = [luminance(a), luminance(b)];
    const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (light + 0.05) / (dark + 0.05);
  }
  Object.entries(NHL_TEAM_COLORS).forEach(([abbrev, { primary }]) => {
    const text = readableTextColor(primary);
    expect(contrast(primary, text)).toBeGreaterThanOrEqual(4.5);
  });
});

// ===================== Composants React =====================

test('PlayerHelmet / TeamJersey / TeamCrest / PlayerAvatar : rendent un <svg> inline (pas une image), sans domaine LNH', () => {
  const { container } = render(
    <>
      <PlayerHelmet teamAbbrev="MTL" />
      <PlayerHelmet teamAbbrev="MTL" goalie />
      <TeamJersey teamAbbrev="TOR" number={97} />
      <TeamCrest teamAbbrev="BOS" />
      <PlayerAvatar teamAbbrev="EDM" variant="formation" name="Marchand" number={63} />
      <PlayerAvatar teamAbbrev="EDM" variant="card" />
    </>
  );
  // SVG inline dans le DOM (instruction 6), jamais un <img src="..."> pour ces composants.
  expect(container.querySelectorAll('svg').length).toBe(6);
  expect(container.querySelectorAll('img').length).toBe(0);
  expect(pointsToNhlDomain(container.innerHTML)).toBe(false);
});

// ===================== Regression bout-en-bout : PlayerCard (les deux variantes) =====================

function makeRow(overrides) {
  return { kind: 'player', ref_id: '8480018', label: 'Nick Suzuki', pos_group: 'F', team_abbrev: 'MTL', total_points: 10, ...overrides };
}

test('PlayerCard (variant="default") : casque SVG inline, abreviation d\'equipe en texte, aucune image', () => {
  const { container } = render(<PlayerCard row={makeRow()} lang="fr" seasonId="20262027" />);
  // Casque (PlayerAvatar/PlayerHelmet) + logo d'equipe (TeamLogo/TeamAbbrevText) = jamais un <img>.
  expect(container.querySelectorAll('img').length).toBe(0);
  expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  expect(container.innerHTML).toContain('>MTL<');
  expect(pointsToNhlDomain(container.innerHTML)).toBe(false);
});

test('PlayerCard (variant="formation") : chandail SVG inline (numero inconnu -> initiales), aucune image LNH', () => {
  const { container } = render(<PlayerCard row={makeRow({ pos_group: 'G' })} variant="formation" lang="fr" seasonId="20262027" />);
  // Le chandail (TeamJersey) et le petit badge d'equipe (TeamLogo/TeamAbbrevText) sont tous les
  // deux du SVG/texte inline -- plus aucun <img> dans cette variante non plus.
  expect(container.querySelectorAll('img').length).toBe(0);
  expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  expect(pointsToNhlDomain(container.innerHTML)).toBe(false);
  // "Nick Suzuki" sans numero connu (fetch de roster non resolu en test) -> initiales "NS".
  expect(container.innerHTML).toContain('>NS<');
});

test('PlayerCard : logo d\'equipe (kind="team") -- abreviation en texte, aucune image', () => {
  const { container } = render(<PlayerCard row={{ kind: 'team', ref_id: 'MTL', label: 'MTL', total_points: 5 }} lang="fr" seasonId="20262027" />);
  expect(container.querySelectorAll('img').length).toBe(0);
  expect(container.innerHTML).toContain('>MTL<');
  expect(pointsToNhlDomain(container.innerHTML)).toBe(false);
});
