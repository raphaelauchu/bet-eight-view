import React, { useState } from 'react';
import { teamColors } from './nhlTeamColors';
import { readableTextColor, TeamAbbrevText } from './BrandAssets';
import { LOGOS_NHL_REAL } from './Analyses';
import { useSaisonCourante } from './season';
import { NHL_VISUALS_ENABLED } from './brandAssetsConfig';

// ===================== Visuels LNH -- onglet Pool UNIQUEMENT =====================
// src/brandAssetsConfig.js:USE_LICENSED_NHL_ASSETS reste `false` et continue de geler les
// photos de joueurs / logos d'equipe PARTOUT AILLEURS dans l'app (Accueil, Analyses, Paris,
// Bankroll, Recherche, partage de stats) -- ce fichier ne touche a rien de tout ca. Seul le
// Pool (liste des joueurs, selection, classement, cartes de joueurs, equipes -- voir
// PoolDraftRoom.js:PlayerAvatar/TeamLogo, PoolDraft.js, PlayerCard.js) utilise les composants
// ci-dessous, gates par NHL_VISUALS_ENABLED (brandAssetsConfig.js) : URLs officielles publiques
// assets.nhle.com chargees a la volee (jamais copiees dans le depot), avec repli propre
// (initiales du joueur sur la couleur de l'equipe / abreviation texte) si l'image echoue ou si
// ce drapeau est a `false`.

// Meme URL que playerPhotoUrl() (src/Analyses.js) construit quand USE_LICENSED_NHL_ASSETS est a
// true -- mais INDEPENDANTE de ce drapeau global : le Pool a son propre interrupteur.
export function poolPlayerPhotoUrl(seasonId, teamAbbrev, playerId) {
  return `https://assets.nhle.com/mugs/nhl/${seasonId}/${teamAbbrev || 'current'}/${playerId}.png`;
}

// Memes URLs que LOGOS_NHL_REAL (src/Analyses.js, 32 equipes) -- reexportees ici pour que les
// composants Pool n'aient qu'un seul module a importer.
export const POOL_TEAM_LOGOS = LOGOS_NHL_REAL;

function initialsFromName(label) {
  const mots = (label || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

// Repli joueur : initiales sur la couleur reelle de l'equipe (nhlTeamColors.js), texte en blanc
// ou quasi-noir selon le meilleur contraste AA (readableTextColor, src/BrandAssets.js). Jamais
// un "fantome" gris generique.
export function PoolInitialsAvatar({ teamAbbrev, name, size = 32, alt, className }) {
  const { primary } = teamColors(teamAbbrev);
  const fg = readableTextColor(primary);
  return (
    <div
      role="img" aria-label={alt || name || ''} className={className}
      style={{
        width: size, height: size, minWidth: size, borderRadius: '50%', backgroundColor: primary, color: fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0,
        fontSize: Math.max(9, Math.round(size * 0.36)), letterSpacing: '0.02em', lineHeight: 1,
      }}
    >
      {initialsFromName(name)}
    </div>
  );
}

// Photo de joueur reelle (assets.nhle.com), dimensions fixes (pas de saut de mise en page),
// loading="lazy". Sans playerId (ex. joueur manuel hors API), drapeau a `false`, ou si l'image
// echoue au chargement : initiales sur la couleur de l'equipe (PoolInitialsAvatar), jamais de
// requete reseau dans ce dernier cas.
export function PoolPlayerPhoto({ teamAbbrev, size = 32, alt, playerId, name, className }) {
  const seasonId = useSaisonCourante();
  const [failed, setFailed] = useState(false);
  if (!NHL_VISUALS_ENABLED || !playerId || failed) {
    return <PoolInitialsAvatar teamAbbrev={teamAbbrev} name={name || alt} size={size} alt={alt} className={className} />;
  }
  return (
    <img
      src={poolPlayerPhotoUrl(seasonId, teamAbbrev, playerId)}
      alt={alt || ''} loading="lazy" width={size} height={size} className={className}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', backgroundColor: 'var(--c-111)', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

// Logo d'equipe reel (assets.nhle.com, SVG), dimensions fixes, loading="lazy". Drapeau a
// `false`, equipe inconnue, ou image en echec : abreviation texte (TeamAbbrevText,
// src/BrandAssets.js -- couleur de l'equipe si contraste AA, sinon couleur de texte du contexte).
export function PoolTeamLogo({ teamAbbrev, size = 20, alt, title, className }) {
  const [failed, setFailed] = useState(false);
  const url = POOL_TEAM_LOGOS[teamAbbrev];
  if (!NHL_VISUALS_ENABLED || !url || failed) {
    return (
      <TeamAbbrevText
        teamAbbrev={teamAbbrev} title={title || alt} className={className}
        style={{ fontSize: Math.max(10, Math.round(size * 0.5)), flexShrink: 0, lineHeight: 1 }}
      />
    );
  }
  return (
    <img
      src={url} alt={alt || teamAbbrev || ''} title={title} loading="lazy" width={size} height={size} className={className}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}
