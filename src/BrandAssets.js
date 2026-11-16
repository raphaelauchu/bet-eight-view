import React from 'react';
import { teamColors } from './nhlTeamColors';

// ===================== Actifs visuels neutres (aucune photo/logo LNH) =====================
// Tant que src/brandAssetsConfig.js (USE_LICENSED_NHL_ASSETS) reste a false, CHAQUE photo de
// joueur et CHAQUE logo d'equipe de l'app est dessine ici, en SVG, aux couleurs publiques de
// l'equipe (src/nhlTeamColors.js) -- jamais un visage, un ecusson, un motif de chandail
// officiel ni quoi que ce soit imitant un logo reel. Casque pour les attaquants/defenseurs,
// masque a grille pour les gardiens (A), chandail avec numero/initiales pour la formation du
// pool (B), badge rond avec l'abreviation de l'equipe pour remplacer un logo (D).

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

function contrastRatio(hexA, hexB) {
  const L1 = relativeLuminance(hexToRgb(hexA));
  const L2 = relativeLuminance(hexToRgb(hexB));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// Choisit blanc ou quasi-noir pour le texte sur `bgHex`, selon lequel offre le MEILLEUR
// contraste (toujours >= celui de l'autre option -- vise AA 4.5:1, atteint pour toutes les
// couleurs d'equipe de nhlTeamColors.js, meme les plus intermediaires en luminosite).
export function readableTextColor(bgHex) {
  const white = contrastRatio(bgHex, '#ffffff');
  const black = contrastRatio(bgHex, '#0a0a0a');
  return white >= black ? '#ffffff' : '#0a0a0a';
}

function escapeXml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgToDataUri(markup) {
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

function resolveColors(teamAbbrev) {
  return teamColors(teamAbbrev);
}

// ===================== A) Casque (attaquant/defenseur) =====================
export function helmetSvgMarkup(teamAbbrev) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50 10 C72 10 86 28 86 50 C86 68 74 82 50 82 C26 82 14 68 14 50 C14 28 28 10 50 10 Z" fill="${primary}"/>
    <rect x="47" y="12" width="6" height="34" rx="3" fill="${secondary}" opacity="0.85"/>
    <path d="M34 46 C34 64 40 78 54 80 C66 78 70 66 68 52 C66 40 54 36 34 46 Z" fill="${secondary}" opacity="0.2"/>
    <circle cx="30" cy="54" r="5" fill="${secondary}"/>
    <path d="M30 70 Q42 84 58 76" stroke="${secondary}" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// ===================== A) Masque de gardien (grille, pas un motif de masque reel) ========
export function goalieMaskSvgMarkup(teamAbbrev) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50 8 C76 8 90 28 90 52 C90 72 76 88 50 88 C24 88 10 72 10 52 C10 28 24 8 50 8 Z" fill="${primary}"/>
    <path d="M28 40 C28 62 36 80 50 82 C64 80 72 62 72 40 C72 30 62 26 50 28 C38 26 28 30 28 40 Z" fill="#111111" opacity="0.55"/>
    <g stroke="${secondary}" stroke-width="2.5" stroke-linecap="round">
      <line x1="34" y1="34" x2="34" y2="76"/>
      <line x1="44" y1="30" x2="44" y2="80"/>
      <line x1="56" y1="30" x2="56" y2="80"/>
      <line x1="66" y1="34" x2="66" y2="76"/>
      <line x1="28" y1="46" x2="72" y2="46"/>
      <line x1="28" y1="60" x2="72" y2="60"/>
    </g>
    <rect x="38" y="78" width="24" height="8" rx="4" fill="${secondary}"/>
  </svg>`;
}

export function playerAvatarUri(teamAbbrev, { goalie } = {}) {
  return svgToDataUri(goalie ? goalieMaskSvgMarkup(teamAbbrev) : helmetSvgMarkup(teamAbbrev));
}

// ===================== B) Chandail (formation du pool) : numero ou initiales =====================
export function jerseySvgMarkup(teamAbbrev, label) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  const textColor = readableTextColor(primary);
  const text = escapeXml(label);
  const fontSize = text.length > 2 ? 22 : 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M30 18 L8 30 L14 54 L34 44 Z" fill="${primary}"/>
    <path d="M70 18 L92 30 L86 54 L66 44 Z" fill="${primary}"/>
    <path d="M30 18 L70 18 L78 30 L78 92 L22 92 L22 30 Z" fill="${primary}"/>
    <rect x="8" y="46" width="10" height="10" fill="${secondary}"/>
    <rect x="82" y="46" width="10" height="10" fill="${secondary}"/>
    <path d="M38 18 L50 30 L62 18" fill="none" stroke="${secondary}" stroke-width="5" stroke-linejoin="round"/>
    <text x="50" y="68" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" fill="${textColor}" text-anchor="middle">${text}</text>
  </svg>`;
}

export function jerseyAvatarUri(teamAbbrev, { number, label } = {}) {
  const shown = (number != null && number !== '') ? `#${number}` : (label || '?');
  return svgToDataUri(jerseySvgMarkup(teamAbbrev, shown));
}

// ===================== D) Badge rond + abreviation (remplace un logo d'equipe) =====================
export function crestSvgMarkup(teamAbbrev) {
  const { primary, secondary } = resolveColors(teamAbbrev);
  const textColor = readableTextColor(primary);
  const abbrev = escapeXml((teamAbbrev || '').slice(0, 3).toUpperCase() || '—');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="46" fill="${primary}"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="${secondary}" stroke-width="6"/>
    <text x="50" y="61" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="${textColor}" text-anchor="middle">${abbrev}</text>
  </svg>`;
}

export function teamCrestUri(teamAbbrev) {
  return svgToDataUri(crestSvgMarkup(teamAbbrev));
}

// ===================== Composants React reutilisables =====================
export function PlayerHelmet({ teamAbbrev, goalie, size = 44, alt = '', className }) {
  return <img src={playerAvatarUri(teamAbbrev, { goalie })} width={size} height={size} alt={alt} className={className} draggable={false} />;
}

export function TeamJersey({ teamAbbrev, number, label, size = 44, alt, className }) {
  return <img src={jerseyAvatarUri(teamAbbrev, { number, label })} width={size} height={size} alt={alt ?? (teamAbbrev || '')} className={className} draggable={false} />;
}

export function TeamCrest({ teamAbbrev, size = 24, alt, className }) {
  return <img src={teamCrestUri(teamAbbrev)} width={size} height={size} alt={alt ?? (teamAbbrev || '')} className={className} draggable={false} />;
}

// Choisit casque ou chandail selon le CONTEXTE d'affichage : `variant="formation"` (vue
// vestiaire du pool, voir PlayerCard.js) affiche un chandail avec numero/initiales (B) ;
// tout le reste (cartes, fiches, echanges, repechage, listes) affiche un casque/masque (A).
export function PlayerAvatar({ teamAbbrev, goalie, variant = 'card', number, label, size = 44, alt, className }) {
  if (variant === 'formation') {
    return <TeamJersey teamAbbrev={teamAbbrev} number={number} label={label} size={size} alt={alt} className={className} />;
  }
  return <PlayerHelmet teamAbbrev={teamAbbrev} goalie={goalie} size={size} alt={alt} className={className} />;
}
