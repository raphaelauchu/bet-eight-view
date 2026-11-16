import React, { useId } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { teamColors } from './nhlTeamColors';

// ===================== Actifs visuels neutres (aucune photo/logo LNH) =====================
// Tant que src/brandAssetsConfig.js (USE_LICENSED_NHL_ASSETS) reste a false, CHAQUE photo de
// joueur et CHAQUE logo d'equipe de l'app est dessine ici, en SVG inline (variables de couleur,
// jamais une image par equipe/joueur) aux couleurs publiques de l'equipe (nhlTeamColors.js) --
// jamais un visage, un ecusson, un motif de chandail officiel ni rien imitant un logo reel. Le
// seul logo autorise est le "B" de Betrics (trace fidele de public/logo512.png, voir
// BETRICS_B_PATHS plus bas -- jamais redessine).
//
// Casque (PlayerHelmet) / masque (GoalieMask) pour les cartes, fiches, echanges, repechage,
// listes (A). Chandail vu de dos avec nom + numero (TeamJersey) pour les alignements et la
// formation du pool (B). Chandail vu de face, sans texte, pour les tres petits emplacements
// (TeamCrest -- classements, calendrier) (D). Barres de recherche : aucune image (C, voir
// Analyses.js).
//
// Chaque forme existe sous DEUX formes a partir de la MEME JSX (PlayerHelmetSvg/GoalieMaskSvg/
// TeamJerseySvg, qui acceptent un `idPrefix` pour des id de degrade uniques) :
//  - composants React (PlayerHelmet/GoalieMask/TeamJersey/TeamCrest) : <svg> inline dans le DOM,
//    polices de la page disponibles normalement.
//  - fonctions *Uri (playerAvatarUri/jerseyAvatarUri/teamCrestUri) : rendent la MEME JSX en
//    chaine via renderToStaticMarkup, encodees en data: URI -- utilisees uniquement la ou une
//    chaine est necessaire (export canvas de la Vue vestiaire, voir PoolLockerRoom.js).

function relativeLuminance([r, g, b]) {
  const toLinear = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function hexToRgb(hex) {
  const h = (hex || '#111111').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

// amt > 0 eclaircit vers le blanc, amt < 0 assombrit vers le noir (amt dans [-1, 1]).
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => (amt >= 0 ? c + (255 - c) * amt : c + c * amt);
  return rgbToHex([f(r), f(g), f(b)]);
}

function contrastRatio(hexA, hexB) {
  const L1 = relativeLuminance(hexToRgb(hexA));
  const L2 = relativeLuminance(hexToRgb(hexB));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// Choisit blanc ou quasi-noir pour le texte/logo sur `bgHex`, selon lequel offre le MEILLEUR
// contraste (vise AA 4.5:1, atteint pour toutes les couleurs d'equipe de nhlTeamColors.js).
export function readableTextColor(bgHex) {
  const white = contrastRatio(bgHex, '#ffffff');
  const black = contrastRatio(bgHex, '#0a0a0a');
  return white >= black ? '#ffffff' : '#0a0a0a';
}

function resolveColors(teamAbbrev) {
  return teamColors(teamAbbrev);
}

// ===================== Logo d'equipe = texte seul (regle finale, partout) =====================
// Plus aucune image/chandail pour representer une equipe (listes, bandeau des matchs,
// classements, calendrier, playoffs, picks, watchlist...) -- seulement son abreviation, dans la
// couleur principale de l'equipe SI le contraste est AA (>= 4.5:1) contre le fond sombre habituel
// de l'app, sinon la couleur de texte normale du contexte (null : l'appelant garde son style).
const APP_DARK_BG = '#111111';

export function teamAbbrevColor(teamAbbrev, bgHex = APP_DARK_BG) {
  const { primary } = resolveColors(teamAbbrev);
  return contrastRatio(primary, bgHex) >= 4.5 ? primary : null;
}

export function TeamAbbrevText({ teamAbbrev, bg = APP_DARK_BG, style, className, onClick, title }) {
  const color = teamAbbrevColor(teamAbbrev, bg);
  const abbrev = (teamAbbrev || '').toUpperCase();
  return (
    <span
      className={className}
      title={title}
      onClick={onClick}
      style={{ fontWeight: 800, letterSpacing: '0.02em', ...(color ? { color } : {}), ...style }}
    >
      {abbrev}
    </span>
  );
}

// ===================== Logo "B" de Betrics =====================
// Trace vectoriel fidele de public/logo512.png (potrace, puis normalise dans un cadre
// 293.577535 x 265.564600 -- voir docs/avatar-previews/README si present) : 4 sous-chemins
// (le corps du "B" + les 3 barres ascendantes), jamais redessines ni deformes. Utilise tel
// quel, a l'echelle, comme seul logo autorise sur les casques/masques.
const B_MARK_VIEW_W = 293.577535;
const B_MARK_VIEW_H = 265.564600;
const B_MARK_INNER_TRANSFORM = 'translate(-112.200881,390.106181) scale(0.1,-0.1)';
const B_MARK_PATHS = [
  'M1872 3488 c-89 -227 -165 -422 -169 -432 -7 -20 10 -12 538 265 l226 119 445 0 445 0 34 -23 c52 -35 64 -68 50 -133 -17 -77 -65 -141 -131 -178 l-55 -31 -470 -3 -470 -3 -386 -207 -385 -206 -36 -101 c-20 -55 -74 -206 -121 -335 -47 -129 -87 -244 -91 -256 -6 -20 -4 -20 36 -14 72 12 139 52 208 123 15 15 31 27 36 27 5 0 20 10 34 21 32 26 129 89 136 89 5 0 56 48 293 278 41 40 110 97 153 127 l77 55 443 0 c424 0 443 -1 484 -20 56 -28 78 -74 71 -146 -11 -108 -92 -220 -195 -267 -40 -19 -71 -23 -211 -27 l-163 -5 -84 -205 c-46 -113 -87 -213 -90 -223 -6 -18 6 -19 298 -14 330 5 373 11 523 67 239 92 403 272 491 540 23 71 27 103 28 195 1 102 -1 114 -28 168 -28 57 -100 127 -146 142 -16 5 -9 12 37 36 79 42 138 92 191 163 113 152 165 360 128 506 -33 127 -99 206 -219 260 -121 54 -102 53 -977 57 l-815 4 -163 -413z',
  'M2203 2028 c-89 -222 -160 -404 -159 -405 1 -1 78 29 172 66 l169 69 127 309 c70 169 132 320 137 336 l10 27 -148 0 -147 0 -161 -402z',
  'M1733 1823 c-83 -208 -147 -379 -143 -381 4 -2 79 26 166 61 l159 65 127 308 c70 170 128 312 128 317 0 4 -64 7 -143 7 l-144 0 -150 -377z',
  'M1395 1942 c-5 -4 -12 -16 -13 -27 -2 -11 -62 -166 -133 -344 -72 -178 -129 -324 -127 -326 2 -1 78 30 169 68 l166 69 107 264 c60 146 110 273 113 284 5 19 0 20 -133 20 -77 0 -143 -4 -149 -8z',
];

// Place le "B" dans un carre `size` au coin (x, y), centre, couleur `fill`. `size` < 18 (sur un
// casque dessine dans un viewBox 0-100) correspond a peu pres au seuil "illisible sous 40px
// affiches" demande -- l'appelant (PlayerHelmet/GoalieMask) decide de l'inclure ou non.
function BetricsBMark({ x, y, size, fill }) {
  const scale = size / Math.max(B_MARK_VIEW_W, B_MARK_VIEW_H);
  const scaledW = B_MARK_VIEW_W * scale;
  const scaledH = B_MARK_VIEW_H * scale;
  const offX = x + (size - scaledW) / 2;
  const offY = y + (size - scaledH) / 2;
  return (
    <g transform={`translate(${offX} ${offY}) scale(${scale})`} fill={fill}>
      <g transform={B_MARK_INNER_TRANSFORM}>
        {B_MARK_PATHS.map((d, i) => <path key={i} d={d} />)}
      </g>
    </g>
  );
}

function svgToDataUri(markup) {
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

function uriFromElement(element) {
  return svgToDataUri(renderToStaticMarkup(element));
}

// ===================== A) Casque (attaquant/defenseur) -- vue 3/4, coque unie + relief =======
// Coque UNIE en couleur principale (le degrade n'est qu'un ombrage de volume, jamais un motif
// peint) ; seuls details en couleur secondaire : liseret bas, vis/fixations. Visiere, jugulaire,
// grilles d'aeration et vis : elements generiques, aucun ne reproduit un casque de marque reelle.
function PlayerHelmetSvg({ teamAbbrev, size = 44, idPrefix, title, className }) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  const textColor = readableTextColor(primary);
  const showMark = size >= 40;
  const gShell = `h-shell-${idPrefix}`;
  const gVisor = `h-visor-${idPrefix}`;
  const gShadow = `h-shadow-${idPrefix}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title || ''} className={className}>
      <defs>
        <linearGradient id={gShell} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={shade(primary, 0.32)} />
          <stop offset="45%" stopColor={primary} />
          <stop offset="100%" stopColor={shade(primary, -0.32)} />
        </linearGradient>
        <linearGradient id={gVisor} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#bcd9ff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={gShadow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="52" cy="92" rx="26" ry="5.5" fill={`url(#${gShadow})`} />

      {/* Coque principale, vue 3/4 : dome plus haut qu'large (jamais une sphere), couronne
          aplatie, machoire plus anguleuse a l'avant-bas (ou la visiere s'attache). */}
      <path
        d="M31,42 C29,27 38,13 54,11 C70,10 82,19 85,34 C88,48 86,62 78,73 C70,84 58,89 47,87 C37,85 30,78 27,68 C25,60 25,50 31,42 Z"
        fill={`url(#${gShell})`}
        stroke={shade(primary, -0.45)}
        strokeWidth="0.6"
      />

      {/* Arete/couture avant (separe la coque de la zone de visiere -- evite l'effet "boule") */}
      <path d="M30,45 C33,38 40,33 48,32" fill="none" stroke={shade(primary, -0.4)} strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />

      {/* Liseret bas (couleur secondaire, generique) */}
      <path d="M32,76 C39,83 49,86 58,83" fill="none" stroke={secondary} strokeWidth="2.2" strokeLinecap="round" opacity="0.95" />

      {/* Nervure centrale (relief, pas un motif peint) */}
      <path d="M56,12 C53,28 52,46 54,64" fill="none" stroke={shade(primary, -0.18)} strokeWidth="1.6" opacity="0.5" strokeLinecap="round" />
      <path d="M53,13 C50,28 49,44 51,60" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.2" strokeLinecap="round" />

      {/* Fentes d'aeration */}
      <g fill="#0a0a0a" opacity="0.45">
        <rect x="62" y="18" width="11" height="3.2" rx="1.6" transform="rotate(20 67.5 19.6)" />
        <rect x="68" y="25" width="10" height="3" rx="1.5" transform="rotate(24 73 26.5)" />
        <rect x="72" y="33" width="9" height="2.8" rx="1.4" transform="rotate(28 76.5 34.4)" />
      </g>

      {/* Visiere : bande fine type lunette (jamais un rond -- evite l'effet "oeil") */}
      <path
        d="M24,47 C29,42 40,40 49,41 C54,42 57,44 57,48 C57,52 53,54 47,55 C38,56 29,55 24,51 C22,50 22,48 24,47 Z"
        fill="#0b1016" stroke={shade(primary, -0.55)} strokeWidth="1.1"
      />
      <path
        d="M24,47 C29,42 40,40 49,41 C54,42 57,44 57,48 C57,52 53,54 47,55 C38,56 29,55 24,51 C22,50 22,48 24,47 Z"
        fill={`url(#${gVisor})`}
      />
      <path d="M27,45 C34,40 43,38 50,41" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.5" strokeLinecap="round" />

      {/* Oreillette + vis (bien separee de la visiere) */}
      <circle cx="23" cy="68" r="4.6" fill="#0a0a0a" />
      <circle cx="23" cy="68" r="4.6" fill="none" stroke={shade(primary, -0.3)} strokeWidth="0.6" />
      <circle cx="21.5" cy="66.5" r="0.8" fill="#ffffff" opacity="0.35" />
      <circle cx="78" cy="40" r="1.3" fill="#cfd3d8" />
      <circle cx="77.6" cy="39.6" r="0.4" fill="#ffffff" />
      <circle cx="38" cy="85" r="1.1" fill="#cfd3d8" />

      {/* Jugulaire noire sous le menton */}
      <path d="M22,74 C25,80 35,86 47,87 C53,87 58,85 61,81" fill="none" stroke="#0a0a0a" strokeWidth="3.4" strokeLinecap="round" />

      {/* Reflet specifique (brillance haut, plus discret) */}
      <ellipse cx="48" cy="21" rx="12" ry="6" fill="#ffffff" opacity="0.24" transform="rotate(-14 48 21)" />

      {showMark && <BetricsBMark x={64} y={48} size={18} fill={textColor} />}
    </svg>
  );
}

// ===================== A) Masque de gardien -- vue 3/4, grille generique (pas un masque reel) ==
function GoalieMaskSvg({ teamAbbrev, size = 44, idPrefix, title, className }) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  const textColor = readableTextColor(primary);
  const showMark = size >= 40;
  const gShell = `m-shell-${idPrefix}`;
  const gShadow = `m-shadow-${idPrefix}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title || ''} className={className}>
      <defs>
        <linearGradient id={gShell} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={shade(primary, 0.3)} />
          <stop offset="45%" stopColor={primary} />
          <stop offset="100%" stopColor={shade(primary, -0.3)} />
        </linearGradient>
        <radialGradient id={gShadow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="52" cy="92" rx="31" ry="6" fill={`url(#${gShadow})`} />

      {/* Coque large et ronde (joues de gardien) */}
      <path
        d="M50,8 C72,7 88,22 90,42 C92,60 86,76 72,84 C64,89 56,90 48,89 C34,88 22,80 16,66 C11,54 12,38 22,26 C30,16 40,9 50,8 Z"
        fill={`url(#${gShell})`}
        stroke={shade(primary, -0.45)}
        strokeWidth="0.6"
      />

      {/* Liseret bas */}
      <path d="M20,68 C28,80 40,87 52,87 C60,87 67,85 72,81" fill="none" stroke={secondary} strokeWidth="2" strokeLinecap="round" opacity="0.9" />

      {/* Zone de cage (ouverture sombre) */}
      <path d="M30,38 C28,56 34,72 48,78 C58,81 68,74 70,58 C72,46 66,34 54,30 C44,27 34,30 30,38 Z" fill="#0a0a0a" opacity="0.55" />

      {/* Grille (barres noires, generiques) */}
      <g stroke="#0a0a0a" strokeWidth="2.6" strokeLinecap="round">
        <line x1="34" y1="33" x2="32" y2="72" />
        <line x1="44" y1="29" x2="43" y2="78" />
        <line x1="54" y1="29" x2="56" y2="78" />
        <line x1="64" y1="33" x2="67" y2="71" />
        <line x1="29" y1="44" x2="69" y2="42" />
        <line x1="28" y1="58" x2="69" y2="58" />
      </g>
      <g stroke="#2a2a2a" strokeWidth="0.8" opacity="0.5">
        <line x1="34" y1="33" x2="32" y2="72" />
        <line x1="54" y1="29" x2="56" y2="78" />
      </g>

      {/* Sangles arriere + vis */}
      <path d="M16,50 L8,46" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" />
      <path d="M16,62 L8,64" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="40" r="1.3" fill="#cfd3d8" />
      <circle cx="76" cy="40" r="1.3" fill="#cfd3d8" />
      <circle cx="23.6" cy="39.6" r="0.4" fill="#ffffff" />

      {/* Mentonniere */}
      <rect x="40" y="78" width="22" height="7" rx="3.5" fill={shade(primary, -0.1)} stroke={shade(primary, -0.4)} strokeWidth="0.5" />

      {/* Reflet */}
      <ellipse cx="42" cy="20" rx="16" ry="8" fill="#ffffff" opacity="0.26" transform="rotate(-14 42 20)" />

      {showMark && <BetricsBMark x={41} y={14} size={18} fill={textColor} />}
    </svg>
  );
}

// ===================== B) Chandail (vue de dos) -- nom + numero, bandes generiques ===========
function fitFontSize(text, maxWidth, base, min) {
  const len = (text || '').length || 1;
  const estWidth = len * base * 0.6;
  if (estWidth <= maxWidth) return base;
  return Math.max(min, Math.floor(maxWidth / (len * 0.6)));
}

function initialsFrom(label) {
  const words = (label || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Nom de famille seul (dernier mot), en majuscules -- jamais le prenom (convention de
// chandail : "SUZUKI", pas "NICK SUZUKI").
function lastNameUpper(label) {
  const words = (label || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words[words.length - 1].toUpperCase();
}

const JERSEY_FONT = "'Oswald', 'Arial Narrow', Arial, Helvetica, sans-serif";

function TeamJerseySvg({ teamAbbrev, name, number, size = 44, compact, idPrefix, title, className }) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  const textColor = readableTextColor(primary);
  const outline = textColor === '#ffffff' ? '#0a0a0a' : '#ffffff';
  const gBody = `j-body-${idPrefix}`;
  const gShadow = `j-shadow-${idPrefix}`;

  const hasNumber = number != null && String(number).trim() !== '';
  const hasName = !!(name && name.trim());
  const nameLabel = hasName ? lastNameUpper(name) : '';
  const numberLabel = hasNumber ? String(number).trim() : (hasName ? initialsFrom(name) : '?');
  const nameFontSize = fitFontSize(nameLabel, 58, 15, 8);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width={size} height={size * 1.2} role="img" aria-label={title || ''} className={className}>
      <defs>
        <linearGradient id={gBody} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={shade(primary, 0.2)} />
          <stop offset="50%" stopColor={primary} />
          <stop offset="100%" stopColor={shade(primary, -0.22)} />
        </linearGradient>
        <radialGradient id={gShadow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50" cy="114" rx="34" ry="6" fill={`url(#${gShadow})`} />

      {/* Manches */}
      <path d="M30,16 L8,30 L13,56 L32,45 Z" fill={`url(#${gBody})`} stroke={shade(primary, -0.4)} strokeWidth="0.6" />
      <path d="M70,16 L92,30 L87,56 L68,45 Z" fill={`url(#${gBody})`} stroke={shade(primary, -0.4)} strokeWidth="0.6" />
      {/* Poignets (bande secondaire generique) */}
      <rect x="8" y="48" width="9" height="9" rx="1.5" fill={secondary} transform="rotate(-6 12 52)" />
      <rect x="83" y="48" width="9" height="9" rx="1.5" fill={secondary} transform="rotate(6 88 52)" />

      {/* Corps */}
      <path
        d="M30,16 L70,16 L80,29 L80,108 C80,111 77,114 73,114 L27,114 C23,114 20,111 20,108 L20,29 Z"
        fill={`url(#${gBody})`}
        stroke={shade(primary, -0.4)}
        strokeWidth="0.6"
      />

      {/* Col en V (discret) */}
      <path d="M40,16 L50,27 L60,16" fill="none" stroke={secondary} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Bande a la taille (secondaire, generique -- jamais un motif d'equipe) */}
      <rect x="20" y="90" width="60" height="7" fill={secondary} opacity="0.95" />

      {/* Plis / reflet de tissu (discrets) */}
      <path d="M34,32 C36,55 35,78 33,100" stroke="#ffffff" strokeWidth="3" opacity="0.07" fill="none" />
      <path d="M66,32 C64,55 65,78 67,100" stroke="#000000" strokeWidth="3" opacity="0.08" fill="none" />

      {!compact && hasName && (
        <text x="50" y="38" fontFamily={JERSEY_FONT} fontSize={nameFontSize} fontWeight="700" letterSpacing="0.5"
          fill={textColor} stroke={outline} strokeWidth="1.6" paintOrder="stroke" textAnchor="middle">{nameLabel}</text>
      )}
      {!compact && (
        <text x="50" y="78" fontFamily={JERSEY_FONT} fontSize="34" fontWeight="700"
          fill={textColor} stroke={outline} strokeWidth="2.2" paintOrder="stroke" textAnchor="middle">{numberLabel}</text>
      )}
      {!compact && size >= 40 && (
        <>
          <text x="12.5" y="54" fontFamily={JERSEY_FONT} fontSize="7" fontWeight="700" fill={textColor} stroke={outline}
            strokeWidth="1" paintOrder="stroke" textAnchor="middle" transform="rotate(-6 12.5 54)">{numberLabel}</text>
          <text x="87.5" y="54" fontFamily={JERSEY_FONT} fontSize="7" fontWeight="700" fill={textColor} stroke={outline}
            strokeWidth="1" paintOrder="stroke" textAnchor="middle" transform="rotate(6 87.5 54)">{numberLabel}</text>
        </>
      )}
    </svg>
  );
}

// ===================== D) Chandail vue de face, sans texte -- tres petits emplacements =======
function TeamCrestSvg({ teamAbbrev, size = 24, idPrefix, title, className }) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  const gBody = `c-body-${idPrefix}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title || ''} className={className}>
      <defs>
        <linearGradient id={gBody} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={shade(primary, 0.22)} />
          <stop offset="55%" stopColor={primary} />
          <stop offset="100%" stopColor={shade(primary, -0.2)} />
        </linearGradient>
      </defs>
      <path d="M36,18 L14,30 L19,50 L38,41 Z" fill={`url(#${gBody})`} />
      <path d="M64,18 L86,30 L81,50 L62,41 Z" fill={`url(#${gBody})`} />
      <path d="M36,18 L64,18 L74,30 L74,86 C74,90 71,93 67,93 L33,93 C29,93 26,90 26,86 L26,30 Z" fill={`url(#${gBody})`} />
      <path d="M43,18 L50,27 L57,18" fill="none" stroke={secondary} strokeWidth="2.6" strokeLinejoin="round" />
      <rect x="26" y="72" width="48" height="6" fill={secondary} opacity="0.95" />
    </svg>
  );
}

// ===================== Composants React (rendu inline, polices de la page disponibles) =======
export function PlayerHelmet({ teamAbbrev, goalie, size = 44, alt, className }) {
  const id = useId();
  return goalie
    ? <GoalieMaskSvg teamAbbrev={teamAbbrev} size={size} idPrefix={id} title={alt} className={className} />
    : <PlayerHelmetSvg teamAbbrev={teamAbbrev} size={size} idPrefix={id} title={alt} className={className} />;
}

// Alias explicite de PlayerHelmet (goalie=true) : rendu identique, nom plus clair quand
// l'appelant connait deja la position (C · MTL · #14 -- G = masque, F/D = casque, voir rule C).
export function GoalieMask({ teamAbbrev, size = 44, alt, className }) {
  return <PlayerHelmet teamAbbrev={teamAbbrev} goalie size={size} alt={alt} className={className} />;
}

export function TeamJersey({ teamAbbrev, name, number, size = 44, compact, alt, className }) {
  const id = useId();
  return (
    <TeamJerseySvg
      teamAbbrev={teamAbbrev}
      name={name}
      number={number != null && number !== '' ? number : null}
      size={size}
      compact={compact}
      idPrefix={id}
      title={alt}
      className={className}
    />
  );
}

export function TeamCrest({ teamAbbrev, size = 24, alt, className }) {
  const id = useId();
  return <TeamCrestSvg teamAbbrev={teamAbbrev} size={size} idPrefix={id} title={alt} className={className} />;
}

// Choisit casque/masque ou chandail selon le CONTEXTE d'affichage : `variant="formation"` (vue
// vestiaire du pool, alignements Analyses) affiche un chandail avec nom/numero (B) ; tout le
// reste (cartes, fiches, echanges, repechage, listes) affiche un casque/masque (A).
export function PlayerAvatar({ teamAbbrev, goalie, variant = 'card', name, number, size = 44, alt, className }) {
  if (variant === 'formation') {
    return <TeamJersey teamAbbrev={teamAbbrev} name={name} number={number} size={size} alt={alt} className={className} />;
  }
  return <PlayerHelmet teamAbbrev={teamAbbrev} goalie={goalie} size={size} alt={alt} className={className} />;
}

// ===================== Generateurs de data: URI (export canvas uniquement, voir PoolLockerRoom) =
export function playerAvatarUri(teamAbbrev, { goalie } = {}) {
  const el = goalie
    ? <GoalieMaskSvg teamAbbrev={teamAbbrev} size={100} idPrefix="x" />
    : <PlayerHelmetSvg teamAbbrev={teamAbbrev} size={100} idPrefix="x" />;
  return uriFromElement(el);
}

export function jerseyAvatarUri(teamAbbrev, { number, name } = {}) {
  return uriFromElement(
    <TeamJerseySvg teamAbbrev={teamAbbrev} name={name || null} number={number != null && number !== '' ? number : null} size={100} idPrefix="x" />
  );
}

export function teamCrestUri(teamAbbrev) {
  return uriFromElement(<TeamCrestSvg teamAbbrev={teamAbbrev} size={100} idPrefix="x" />);
}
