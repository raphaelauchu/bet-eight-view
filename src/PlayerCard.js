import React, { useState, useEffect, useRef } from 'react';
import { getT } from './i18n';
import { headshotUrl, TeamLogo, PlayerAvatar, round1 } from './PoolDraftRoom';
import { teamColors } from './nhlTeamColors';

// ===================== PlayerCard : carte joueur unique, reutilisee partout =====================
// Formation (Vue vestiaire), echanges, agents libres, repechage, anciens joueurs -- un seul
// composant visuel pour toute l'identite "jeu video de hockey" du module Pool. Les points
// affiches sont TOUJOURS ceux du joueur DANS CE POOL (row.total_points, deja calcule par
// get_member_breakdown / les listes d'agents libres -- jamais une cote ou une stat NHL globale
// inventee pour l'occasion).

export const PLAYER_CARD_SIZES = ['S', 'M', 'L'];
const SIZE_PX = { S: 32, M: 44, L: 64 };

// Paliers visuels relatifs a la distribution de points DU CONTEXTE AFFICHE (ex. tous les
// joueurs d'un pool visibles dans la grille/la formation courante), jamais un seuil de points
// absolu code en dur -- deux pools n'ont pas le meme bareme de pointage, un "20 points" peut
// etre exceptionnel dans l'un et ordinaire dans l'autre. Moins de 2 valeurs comparables (trop
// peu de contexte pour un classement significatif) : palier neutre 'bronze', jamais invente.
export const PLAYER_CARD_TIER_PERCENTILES = { elite: 0.85, gold: 0.65, silver: 0.35 };
export const PLAYER_CARD_TIERS = ['bronze', 'silver', 'gold', 'elite'];

export function computePlayerTier(points, allPoints) {
  const valeurs = (allPoints || []).map(Number).filter(Number.isFinite);
  const p = Number(points);
  if (valeurs.length < 2 || !Number.isFinite(p)) return 'bronze';
  const sorted = [...valeurs].sort((a, b) => a - b);
  const rangPercentile = sorted.filter(v => v <= p).length / sorted.length;
  if (rangPercentile >= PLAYER_CARD_TIER_PERCENTILES.elite) return 'elite';
  if (rangPercentile >= PLAYER_CARD_TIER_PERCENTILES.gold) return 'gold';
  if (rangPercentile >= PLAYER_CARD_TIER_PERCENTILES.silver) return 'silver';
  return 'bronze';
}

// ===================== Variante "formation" : carte large pour la Vue vestiaire =====================
// Reutilise le MEME composant (identite visuelle unique) via un prop `variant` optionnel --
// le chemin par defaut (variant absent/'default', utilise par les echanges, les agents libres
// et le repechage) reste pixel pour pixel inchange. 'formation' n'affecte QUE le rendu interne
// (nom complet sur 2 lignes, points/blessure en haut, statut de match en bas, initiales si pas
// de photo) via ses propres classes CSS (player-card-formation, pcf-*), jamais les classes
// .player-card-S/M/L existantes -- aucun autre ecran n'est donc visuellement affecte.

function splitNameTwoLines(label) {
  const mots = (label || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return [label || '', ''];
  return [mots[0], mots.slice(1).join(' ')];
}

function formationNameFontSize(label) {
  const len = (label || '').length;
  if (len > 20) return '10px';
  if (len > 14) return '11.5px';
  return '13px';
}

function initialsFromName(label) {
  const mots = (label || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

// Jamais de fantome gris : si la photo echoue (ou n'existe pas encore pour ce joueur), des
// initiales sur la couleur reelle de son equipe LNH (nhlTeamColors.js) prennent sa place.
function PlayerPhotoOrInitials({ src, label, teamAbbrev }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const colors = teamColors(teamAbbrev);
    return (
      <div className="player-card-initials" style={{ backgroundColor: colors.primary }} aria-hidden="true">
        {initialsFromName(label)}
      </div>
    );
  }
  return <img src={src} alt="" className="player-card-photo-img" onError={() => setFailed(true)} />;
}

// row : ligne get_member_breakdown (ou forme compatible : kind/ref_id/label/pos_group/
// team_abbrev/total_points) -- null = emplacement vide (placeholder).
// tier : 'bronze'|'silver'|'gold'|'elite' (voir computePlayerTier), optionnel.
// size : 'S'|'M'|'L'. injury : ligne player_injuries ou undefined. gameStatus : 'live'|'tonight'|null.
// actionLabel/onAction : bouton d'action optionnel (ex. "Ajouter", "Remplacer") distinct du
// clic sur la carte (qui ouvre la fiche via onOpen). selected/disabled : etats pour les
// selecteurs (echanges, remplacement d'agent libre).
// variant : 'default' (toutes les grilles existantes, inchange) | 'formation' (Vue vestiaire,
// voir plus haut) -- ignore `size`.
export default function PlayerCard({
  row, tier, size = 'M', variant = 'default', seasonId, lang, injury, gameStatus, onOpen,
  actionLabel, onAction, selected, disabled, animatePoints = true, className,
}) {
  const t = getT(lang);
  const [justScored, setJustScored] = useState(false);
  const [showInjury, setShowInjury] = useState(false);
  const prevPointsRef = useRef(row ? Number(row.total_points) || 0 : null);

  useEffect(() => {
    if (!row || !animatePoints) return;
    const current = Number(row.total_points) || 0;
    const prev = prevPointsRef.current;
    if (prev != null && current > prev) {
      setJustScored(true);
      const id = setTimeout(() => setJustScored(false), 1600);
      prevPointsRef.current = current;
      return () => clearTimeout(id);
    }
    prevPointsRef.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.total_points, animatePoints]);

  if (!row) {
    const emptyClass = variant === 'formation' ? 'player-card player-card-formation player-card-empty' : `player-card player-card-${size} player-card-empty`;
    return (
      <div className={emptyClass}>
        <div className="player-card-placeholder-icon" aria-hidden="true">+</div>
        <div className="player-card-empty-label">{t('pool_locker_empty_slot')}</div>
      </div>
    );
  }

  const isTeam = row.kind === 'team';
  const photoSize = SIZE_PX[size] || SIZE_PX.M;
  const statutAccessible = [
    injury ? `${t('pool_locker_injury_prefix')} ${injury.status}` : null,
    gameStatus ? (gameStatus === 'live' ? t('pool_locker_live_now') : t('pool_locker_playing_tonight')) : null,
  ].filter(Boolean).join(', ');
  const nomAccessible = `${row.label} — ${round1(row.total_points)} ${t('pool_standings_col_pts')}${statutAccessible ? `, ${statutAccessible}` : ''}`;

  if (variant === 'formation') {
    const [prenom, nom] = splitNameTwoLines(row.label);
    return (
      <div
        className={[
          'player-card', 'player-card-formation', `player-card-tier-${tier || 'bronze'}`,
          justScored ? 'player-card-scored' : '', selected ? 'player-card-selected' : '', disabled ? 'player-card-disabled' : '', className || '',
        ].filter(Boolean).join(' ')}
        onClick={() => { if (!disabled && onOpen) onOpen(row); }}
        role={onOpen ? 'button' : 'group'}
        tabIndex={onOpen && !disabled ? 0 : -1}
        onKeyDown={e => { if (onOpen && !disabled && e.key === 'Enter') onOpen(row); }}
        aria-label={nomAccessible}
        aria-pressed={selected != null ? !!selected : undefined}
        aria-disabled={disabled || undefined}
      >
        <div className="pcf-top">
          <div className="pcf-points">{round1(row.total_points)}</div>
          {injury && (
            <span
              className="player-card-injury-badge"
              role="button"
              tabIndex={0}
              aria-label={`${t('pool_locker_injury_prefix')} ${injury.status}`}
              onClick={e => { e.stopPropagation(); setShowInjury(v => !v); }}
              onMouseEnter={() => setShowInjury(true)}
              onMouseLeave={() => setShowInjury(false)}
              onFocus={() => setShowInjury(true)}
              onBlur={() => setShowInjury(false)}
            >+</span>
          )}
        </div>

        {injury && showInjury && (
          <div className="player-card-injury-tooltip" role="tooltip" onClick={e => e.stopPropagation()}>
            <strong>{injury.status}</strong>
            <div>{injury.description || t('pool_locker_injury_unknown_duration')}</div>
          </div>
        )}

        <div className="pcf-photo">
          <PlayerPhotoOrInitials src={headshotUrl(row.ref_id, seasonId, row.team_abbrev)} label={row.label} teamAbbrev={row.team_abbrev} />
        </div>

        <div className="pcf-name" style={{ fontSize: formationNameFontSize(row.label) }}>
          <div className="pcf-name-line">{prenom}</div>
          {nom && <div className="pcf-name-line">{nom}</div>}
        </div>

        <div className="pcf-footer">
          <span className="pcf-pos">{row.pos_group}</span>
          {row.team_abbrev && <TeamLogo abbrev={row.team_abbrev} size={16} />}
        </div>

        {gameStatus && (
          <div className={`pcf-status pcf-status-${gameStatus}`}>
            {gameStatus === 'live' ? t('pool_locker_live_now') : t('pool_locker_playing_tonight')}
          </div>
        )}

        {actionLabel && onAction && (
          <button type="button" className="player-card-action-btn" onClick={e => { e.stopPropagation(); onAction(row); }}>
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        'player-card', `player-card-${size}`, `player-card-tier-${tier || 'bronze'}`,
        justScored ? 'player-card-scored' : '', selected ? 'player-card-selected' : '', disabled ? 'player-card-disabled' : '', className || '',
      ].filter(Boolean).join(' ')}
      onClick={() => { if (!disabled && onOpen) onOpen(row); }}
      role={onOpen ? 'button' : 'group'}
      tabIndex={onOpen && !disabled ? 0 : -1}
      onKeyDown={e => { if (onOpen && !disabled && e.key === 'Enter') onOpen(row); }}
      aria-label={nomAccessible}
      aria-pressed={selected != null ? !!selected : undefined}
      aria-disabled={disabled || undefined}
    >
      <div className="player-card-points">{round1(row.total_points)}</div>

      <div className="player-card-badges">
        {injury && (
          <span
            className="player-card-injury-badge"
            role="button"
            tabIndex={0}
            aria-label={`${t('pool_locker_injury_prefix')} ${injury.status}`}
            onClick={e => { e.stopPropagation(); setShowInjury(v => !v); }}
            onMouseEnter={() => setShowInjury(true)}
            onMouseLeave={() => setShowInjury(false)}
            onFocus={() => setShowInjury(true)}
            onBlur={() => setShowInjury(false)}
          >+</span>
        )}
        {gameStatus && (
          <span className={`player-card-game-badge player-card-game-badge-${gameStatus}`}>
            {gameStatus === 'live' ? t('pool_locker_live_now') : t('pool_locker_playing_tonight')}
          </span>
        )}
      </div>

      {injury && showInjury && (
        <div className="player-card-injury-tooltip" role="tooltip" onClick={e => e.stopPropagation()}>
          <strong>{injury.status}</strong>
          <div>{injury.description || t('pool_locker_injury_unknown_duration')}</div>
        </div>
      )}

      {isTeam ? <TeamLogo abbrev={row.ref_id} size={photoSize} /> : <PlayerAvatar src={headshotUrl(row.ref_id, seasonId, row.team_abbrev)} size={photoSize} />}
      {!isTeam && row.team_abbrev && <TeamLogo abbrev={row.team_abbrev} size={size === 'L' ? 18 : 14} />}
      <div className="player-card-name">{row.label}</div>
      {!isTeam && <div className="player-card-pos">{row.pos_group}</div>}

      {actionLabel && onAction && (
        <button type="button" className="player-card-action-btn" onClick={e => { e.stopPropagation(); onAction(row); }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
