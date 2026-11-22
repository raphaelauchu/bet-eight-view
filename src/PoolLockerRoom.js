import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useSaisonCourante, FicheJoueurStats } from './Analyses';
import { headshotUrl, TeamLogo, round1, memberLabel, easternDateStr } from './PoolDraftRoom';
import { POOL_TEAM_LOGOS } from './poolVisuals';
import { NHL_VISUALS_ENABLED } from './brandAssetsConfig';
import { teamGradient, teamColors } from './nhlTeamColors';
import PlayerCard, { computePlayerTier } from './PlayerCard';

const DATE_LOCALE = { fr: 'fr-CA', en: 'en-US' };

// ===================== Vue vestiaire : composition de la formation (pure, testable) =====================
// Deduit la formation sur glace a partir des lignes deja renvoyees par get_member_breakdown
// (rows) et des regles du pool (rules.roster) -- aucune nouvelle donnee, aucun calcul de
// points ici. Classique : tous les joueurs actifs sont "habilles" (pas de banc). Fantasy :
// seuls les slots C/LW/RW/D/G/UTIL comptent comme habilles sur la glace ; BN et IR forment
// les zones de reserve a part (toujours visibles, jamais retires de la vue).

function slotCountsForFantasy(rules) {
  const r = rules?.roster || {};
  return {
    forward: (Number(r.C) || 0) + (Number(r.LW) || 0) + (Number(r.RW) || 0) + (Number(r.UTIL) || 0),
    defense: Number(r.D) || 0,
    goalie: Number(r.G) || 0,
  };
}

function padRows(list, minSlots) {
  const total = Math.max(list.length, minSlots);
  return [...list, ...Array(Math.max(0, total - list.length)).fill(null)];
}

// Fantasy seulement : un groupe PAR SLOT REEL (C/LW/RW/D/G/UTIL -- jamais une numerotation
// inventee comme "Ligne 1/2/3", qui n'existe pas dans les regles du pool), avec le compte
// REELLEMENT configure pour ce slot (rules.roster[slotKey]) comme cible de remplissage.
function groupBySlot(players, rules, slotKeys) {
  const r = rules?.roster || {};
  return slotKeys
    .filter(key => (Number(r[key]) || 0) > 0)
    .map(key => ({ label: key, rows: padRows(players.filter(p => p.current_slot === key), Number(r[key]) || 0) }));
}

const FANTASY_FORWARD_SLOTS = ['C', 'LW', 'RW', 'UTIL'];

// rows : lignes de get_member_breakdown (kind/ref_id/label/pos_group/team_abbrev/total_points/
// is_active/closed_reason/current_slot...). rules : pool.rules (poolType + roster).
// lines/pairs : tableau de groupes { label, rows } -- label=null en pool classique (tous les
// joueurs comptent pareil, aucune etiquette "Ligne"/"Paire" n'est affichee), label=slot reel
// (ex. 'C', 'LW', 'D') en pool fantasy. counts/required : totaux pour l'indicateur discret du
// titre de bloc (ex. "9/9").
export function buildFormation(rows, rules) {
  const isFantasy = rules?.poolType === 'fantasy';
  const players = (rows || []).filter(r => r.is_active && r.kind === 'player');
  const bench = isFantasy ? players.filter(r => r.current_slot === 'BN') : [];
  const ir = isFantasy ? players.filter(r => r.current_slot === 'IR') : [];
  const dressed = isFantasy
    ? players.filter(r => r.current_slot && r.current_slot !== 'BN' && r.current_slot !== 'IR')
    : players;

  const forwards = dressed.filter(r => r.pos_group === 'F');
  const defense = dressed.filter(r => r.pos_group === 'D');
  const goalies = dressed.filter(r => r.pos_group === 'G');

  const slots = isFantasy
    ? slotCountsForFantasy(rules)
    : { forward: Number(rules?.roster?.forwards) || 9, defense: Number(rules?.roster?.defense) || 6, goalie: Number(rules?.roster?.goalies) || 2 };

  const lines = isFantasy
    ? groupBySlot(forwards, rules, FANTASY_FORWARD_SLOTS)
    : [{ label: null, rows: padRows(forwards, slots.forward) }];
  const pairs = isFantasy
    ? groupBySlot(defense, rules, ['D'])
    : [{ label: null, rows: padRows(defense, slots.defense) }];

  const teamPick = (rows || []).find(r => r.is_active && r.kind === 'team') || null;

  return {
    lines, pairs,
    goalies: padRows(goalies, slots.goalie),
    goaliesLabel: isFantasy ? 'G' : null,
    bench, ir, teamPick, isFantasy,
    counts: { forward: forwards.length, defense: defense.length, goalie: goalies.length },
    required: { forward: slots.forward, defense: slots.defense, goalie: slots.goalie },
  };
}

// Joueurs echanges hors de cette equipe : is_active=false + closed_reason='trade' (deja
// calcule par get_member_breakdown a partir de pool_roster_periods.to_at/closed_reason).
// total_points reste celui accumule PENDANT la periode de possession (pool_scored_events
// attribue deja les points par periode, jamais apres le depart du joueur).
export function buildFormerPlayers(rows) {
  return (rows || []).filter(r => !r.is_active && r.kind === 'player' && r.closed_reason === 'trade');
}

// 'live' si l'equipe du joueur joue en ce moment, 'tonight' si elle joue plus tard aujourd'hui,
// null sinon (pas de match, ou match deja termine). gamesToday : lignes nhl_games du jour
// (home_abbrev/away_abbrev/state), chargees une seule fois et mises en cache par useTodayGames.
export function gameStatusForTeam(gamesToday, abbrev) {
  if (!abbrev || !gamesToday) return null;
  const g = gamesToday.find(x => x.home_abbrev === abbrev || x.away_abbrev === abbrev);
  if (!g) return null;
  if (g.state === 'LIVE') return 'live';
  if (g.state === 'FUT') return 'tonight';
  return null;
}

export function useTodayGames() {
  const [games, setGames] = useState([]);
  useEffect(() => {
    let annule = false;
    supabase.from('nhl_games').select('home_abbrev, away_abbrev, state').eq('game_date', easternDateStr())
      .then(({ data, error }) => { if (!annule && !error) setGames(data || []); })
      .catch(() => { if (!annule) setGames([]); });
    return () => { annule = true; };
  }, []);
  return games;
}

// Table player_injuries (voir supabase/migrations/20261112_player_injuries.sql), alimentee
// par l'Edge Function sync-player-injuries (source ESPN, jamais fabriquee cote client). Si la
// table n'existe pas encore (migration pas encore appliquee) ou toute autre erreur reseau, se
// degrade silencieusement vers "aucune blessure affichee" -- ne doit jamais faire planter la
// Vue vestiaire.
export function usePlayerInjuries(idsKey) {
  const [injuries, setInjuries] = useState({});
  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').filter(Boolean) : [];
    if (ids.length === 0) { setInjuries({}); return; }
    let annule = false;
    supabase.from('player_injuries').select('*').in('player_id', ids)
      .then(({ data, error }) => {
        if (annule) return;
        if (error) { setInjuries({}); return; }
        const map = {};
        (data || []).forEach(row => { map[row.player_id] = row; });
        setInjuries(map);
      })
      .catch(() => { if (!annule) setInjuries({}); });
    return () => { annule = true; };
  }, [idsKey]);
  return injuries;
}

// ===================== Anciens joueurs : date et destination du depart (pure, testable) =====================
// periods : lignes brutes de pool_roster_periods (member_id/player_id/from_at/to_at) pour UN
// joueur donne, TOUS les membres du pool confondus (necessaire pour retrouver qui l'a recu).
// memberId : le membre dont on affiche les "anciens joueurs" (celui qui a perdu ce joueur).
// Renvoie { toAt, destMemberId } ou null si aucune periode fermee trouvee pour ce membre --
// destMemberId est null si aucune periode ulterieure d'un AUTRE membre n'a ete trouvee (ex.
// libere : personne ne le possede immediatement apres).
export function resolveFormerPlayerDeparture(periods, memberId, refId) {
  const mine = (periods || []).filter(p => String(p.player_id) === String(refId) && p.member_id === memberId && p.to_at);
  if (mine.length === 0) return null;
  const lastMine = mine.reduce((a, b) => (new Date(b.to_at) > new Date(a.to_at) ? b : a));
  const next = (periods || [])
    .filter(p => String(p.player_id) === String(refId) && p.member_id !== memberId && new Date(p.from_at) >= new Date(lastMine.to_at))
    .sort((a, b) => new Date(a.from_at) - new Date(b.from_at))[0] || null;
  return { toAt: lastMine.to_at, destMemberId: next ? next.member_id : null };
}

// Charge pool_roster_periods (lecture RLS deja ouverte a tout membre du pool, voir
// is_pool_member dans supabase/migrations/20261030_pools_foundation.sql) pour les seuls
// anciens joueurs affiches, puis derive date/destination via resolveFormerPlayerDeparture --
// aucune nouvelle colonne/RPC necessaire. Se degrade silencieusement (comme usePlayerInjuries)
// si la requete echoue : la section "Anciens joueurs" reste alors sans date/motif detaille.
export function useFormerPlayerDepartures(poolId, memberId, formerPlayers) {
  const idsKey = (formerPlayers || []).map(r => r.ref_id).join(',');
  const [meta, setMeta] = useState({});
  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').filter(Boolean) : [];
    if (ids.length === 0 || !poolId || !memberId) { setMeta({}); return; }
    let annule = false;
    supabase.from('pool_roster_periods').select('member_id, player_id, from_at, to_at')
      .eq('pool_id', poolId).eq('kind', 'player').in('player_id', ids)
      .then(({ data, error }) => {
        if (annule) return;
        if (error) { setMeta({}); return; }
        const next = {};
        ids.forEach(id => { next[id] = resolveFormerPlayerDeparture(data || [], memberId, id); });
        setMeta(next);
      })
      .catch(() => { if (!annule) setMeta({}); });
    return () => { annule = true; };
  }, [poolId, memberId, idsKey]);
  return meta;
}

const toggleBtnStyle = (active) => ({
  padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700',
  backgroundColor: active ? '#f97316' : 'var(--c-111)', color: active ? 'white' : 'var(--c-888)', minHeight: '44px',
});

// ===================== Formation : trois blocs (Attaque/Defense/Gardiens) =====================
// La carte joueur elle-meme vit dans src/PlayerCard.js (variant="formation" -- composant unique
// reutilise aussi, en variant par defaut, par les echanges/agents libres/repechage). La
// repartition en colonnes (3 blocs cote a cote >=1024px, empiles sinon) est purement CSS (voir
// .locker-board dans index.css) : le DOM produit ici est le MEME a toutes les largeurs.

function BlockTitle({ label, filled, required }) {
  return (
    <div className="locker-block-title">
      <span>{label}</span>
      <span className="locker-block-count">{filled}/{required}</span>
    </div>
  );
}

// Exporte en plus de l'usage interne (PoolTeamHub) : reutilise telle quelle par la page
// publique Pool (src/PoolShowcase.js) pour afficher une formation d'EXEMPLE avec le vrai
// composant de formation, sans dupliquer son rendu.
export function PoolIceBoard({ formation, seasonId, lang, gamesToday, injuries, allPoints, onOpen }) {
  const t = getT(lang);
  const card = (row, key) => (
    <PlayerCard key={key} row={row} variant="formation" seasonId={seasonId} lang={lang}
      tier={row ? computePlayerTier(row.total_points, allPoints) : undefined}
      injury={row ? injuries[String(row.ref_id)] : undefined}
      gameStatus={row ? gameStatusForTeam(gamesToday, row.team_abbrev) : null}
      onOpen={onOpen} />
  );

  return (
    <div className="locker-board">
      <div className="locker-block locker-block-forwards">
        <BlockTitle label={t('pool_locker_block_forwards')} filled={formation.counts.forward} required={formation.required.forward} />
        {formation.lines.map((group, i) => (
          <div className="locker-group" key={i}>
            {group.label && <div className="locker-group-label">{group.label}</div>}
            <div className="locker-group-cards">
              {group.rows.map((row, j) => card(row, row ? `${row.kind}:${row.ref_id}` : `empty-f-${i}-${j}`))}
            </div>
          </div>
        ))}
      </div>

      <div className="locker-block locker-block-defense">
        <BlockTitle label={t('pool_locker_block_defense')} filled={formation.counts.defense} required={formation.required.defense} />
        {formation.pairs.map((group, i) => (
          <div className="locker-group" key={i}>
            {group.label && <div className="locker-group-label">{group.label}</div>}
            <div className="locker-group-cards">
              {group.rows.map((row, j) => card(row, row ? `${row.kind}:${row.ref_id}` : `empty-d-${i}-${j}`))}
            </div>
          </div>
        ))}
      </div>

      <div className="locker-block locker-block-goalies">
        <BlockTitle label={t('pool_locker_block_goalies')} filled={formation.counts.goalie} required={formation.required.goalie} />
        <div className="locker-group">
          {formation.goaliesLabel && <div className="locker-group-label">{formation.goaliesLabel}</div>}
          <div className="locker-group-cards">
            {formation.goalies.map((row, i) => card(row, row ? `${row.kind}:${row.ref_id}` : `empty-g-${i}`))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Squelette de chargement (3 blocs muets, memes proportions que la vraie formation) --
// respecte prefers-reduced-motion (voir .locker-skeleton-card dans index.css : pas de pulsation
// si l'utilisateur prefere moins d'animation, juste un bloc statique).
function PoolIceBoardSkeleton() {
  return (
    <div className="locker-board" aria-hidden="true">
      {[3, 2, 2].map((n, bi) => (
        <div className="locker-block" key={bi}>
          <div className="locker-skeleton-title" />
          <div className="locker-group-cards" style={{ gridTemplateColumns: `repeat(${n}, minmax(110px, 150px))` }}>
            {Array.from({ length: n }).map((_, i) => <div className="locker-skeleton-card" key={i} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===================== Legende des paliers de carte (bronze/argent/or/elite) =====================
// Distinguables sans la couleur seule : nombre d'etoiles croissant (1 a 4), en plus de la
// couleur de la pastille -- jamais la couleur comme seul signal. Infobulle accessible (clic,
// survol, ou focus clavier, meme mecanisme que la croix de blessure de PlayerCard).

const TIER_ORDER = ['bronze', 'silver', 'gold', 'elite'];
const TIER_STARS = { bronze: 1, silver: 2, gold: 3, elite: 4 };

function TierLegend({ lang }) {
  const t = getT(lang);
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="locker-tier-legend">
      {TIER_ORDER.map(tier => (
        <div className="locker-tier-item" key={tier}>
          <span className={`locker-tier-dot locker-tier-dot-${tier}`} aria-hidden="true">{'★'.repeat(TIER_STARS[tier])}</span>
          <span className="locker-tier-name">{t(`pool_locker_tier_${tier}`)}</span>
        </div>
      ))}
      <span
        className="locker-tier-info"
        role="button"
        tabIndex={0}
        aria-label={t('pool_locker_tier_explain')}
        onClick={() => setShowInfo(v => !v)}
        onMouseEnter={() => setShowInfo(true)}
        onMouseLeave={() => setShowInfo(false)}
        onFocus={() => setShowInfo(true)}
        onBlur={() => setShowInfo(false)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowInfo(v => !v); } }}
      >ⓘ</span>
      {showInfo && <div className="locker-tier-tooltip" role="tooltip">{t('pool_locker_tier_explain')}</div>}
    </div>
  );
}

// ===================== Banc / Reserve des blesses (fantasy uniquement -- onglet masque sinon) =====================

function PoolBenchIrPanel({ formation, seasonId, lang, gamesToday, injuries, allPoints, onOpen }) {
  const t = getT(lang);
  const card = (row) => (
    <PlayerCard key={`${row.kind}:${row.ref_id}`} row={row} variant="formation" seasonId={seasonId} lang={lang}
      tier={computePlayerTier(row.total_points, allPoints)}
      injury={injuries[String(row.ref_id)]}
      gameStatus={gameStatusForTeam(gamesToday, row.team_abbrev)}
      onOpen={onOpen} />
  );
  return (
    <div className="locker-board">
      {formation.bench.length > 0 && (
        <div className="locker-block">
          <div className="locker-block-title">{t('pool_locker_bench_title')}</div>
          <div className="locker-flow-cards">{formation.bench.map(card)}</div>
        </div>
      )}
      {formation.ir.length > 0 && (
        <div className="locker-block">
          <div className="locker-block-title">{t('pool_locker_ir_title')}</div>
          <div className="locker-flow-cards">{formation.ir.map(card)}</div>
        </div>
      )}
    </div>
  );
}

// ===================== Anciens joueurs (echanges/liberations) =====================
// departures : map ref_id -> { toAt, destMemberId } (voir useFormerPlayerDepartures) --
// peut etre vide (requete pas encore resolue/en echec) : la carte et les points restent alors
// affiches, seule la ligne date/motif est omise -- jamais de donnee inventee.

function PoolFormerPlayers({ players, seasonId, lang, allPoints, onOpen, departures, membersById, poolRules }) {
  const t = getT(lang);
  return (
    <div className="locker-board">
      <div className="locker-block">
        <div className="locker-former-sub">{t('pool_locker_former_players_sub')}</div>
        <div className="locker-flow-cards">
          {players.map(row => {
            const dep = departures ? departures[String(row.ref_id)] : null;
            const destMember = dep?.destMemberId ? membersById?.[dep.destMemberId] : null;
            const dateStr = dep?.toAt
              ? new Date(dep.toAt).toLocaleDateString(DATE_LOCALE[lang] || DATE_LOCALE.en, { month: 'short', day: 'numeric', year: 'numeric' })
              : '';
            const motif = row.closed_reason === 'trade'
              ? t('pool_locker_former_traded_to').replace('{team}', destMember ? memberLabel(destMember, poolRules) : t('pool_locker_former_unknown_destination'))
              : t('pool_locker_former_dropped');
            return (
              <div className="locker-former-item" key={`${row.kind}:${row.ref_id}`}>
                <PlayerCard row={row} variant="formation" seasonId={seasonId} lang={lang}
                  tier={computePlayerTier(row.total_points, allPoints)} onOpen={onOpen} className="player-card-former" />
                <div className="locker-former-meta">
                  <div>{motif}</div>
                  {dateStr && <div className="locker-former-date">{dateStr}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===================== Bandeau d'equipe =====================

function PoolTeamBanner({ pool, member, rows, standingsRow, teamPick, lang }) {
  const t = getT(lang);
  const abbrev = teamPick?.ref_id;
  const bestPlayer = useMemo(() => {
    const actifs = (rows || []).filter(r => r.is_active && r.kind === 'player');
    if (actifs.length === 0) return null;
    return actifs.reduce((a, b) => ((Number(b.total_points) || 0) > (Number(a.total_points) || 0) ? b : a));
  }, [rows]);
  const totalPoints = standingsRow ? Number(standingsRow.total_points) || 0 : (rows || []).reduce((s, r) => s + (Number(r.total_points) || 0), 0);

  return (
    <div className="locker-banner" style={{ backgroundImage: teamGradient(abbrev) }}>
      <div className="locker-banner-left">
        {abbrev ? <TeamLogo abbrev={abbrev} size={56} /> : <div className="locker-banner-no-team">{t('pool_locker_no_team_pick')}</div>}
        <div>
          <div className="locker-banner-name">{memberLabel(member, pool.rules)}</div>
          {standingsRow?.rank != null && <div className="locker-banner-rank">{t('pool_locker_rank_label')} #{standingsRow.rank}</div>}
        </div>
      </div>
      <div className="locker-banner-stats">
        <div className="locker-banner-stat">
          <div className="locker-banner-stat-value">{round1(totalPoints)}</div>
          <div className="locker-banner-stat-label">{t('pool_locker_total_points')}</div>
        </div>
        <div className="locker-banner-stat">
          <div className="locker-banner-stat-value">{round1(standingsRow?.today_points ?? 0)}</div>
          <div className="locker-banner-stat-label">{t('pool_locker_today_points')}</div>
        </div>
        {bestPlayer && (
          <div className="locker-banner-stat locker-banner-best">
            <div className="locker-banner-stat-label">{t('pool_locker_best_player')}</div>
            <div className="locker-banner-best-name">{bestPlayer.label} · {round1(bestPlayer.total_points)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Export PNG ("Partager mon equipe") =====================
// Dessine un canevas a la main (en-tete degrade + liste des joueurs actifs) -- pas de
// html-to-image/html2canvas (dependance evitee) : la copie DOM->canvas n'est de toute facon
// pas fiable avec des images cross-origin non-CORS comme assets.nhle.com. Les images sont
// chargees via /api/nhl-image (proxy CORS leger, voir api/nhl-image.js) pour pouvoir etre
// dessinees sur le canevas sans "tainter" sa sortie (toBlob echouerait sinon).

function imageProxyUrl(nhlUrl) {
  if (!nhlUrl) return nhlUrl;
  // data: (casque/chandail dessines par Betrics, voir BrandAssets.js) : deja inline, jamais
  // de probleme CORS pour <canvas> -- ne jamais faire transiter par le proxy d'image LNH.
  if (nhlUrl.startsWith('data:')) return nhlUrl;
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  return estEnProduction ? `/api/nhl-image?url=${encodeURIComponent(nhlUrl)}` : nhlUrl;
}

function loadImageSafe(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
    setTimeout(() => finish(null), timeoutMs);
  });
}

// Exporte le canevas (pas de telechargement) : utile pour les tests ("au moins que la
// fonction s'execute") et reutilise par downloadLockerRoomImage ci-dessous.
export async function exportLockerRoomImage({ pool, member, rows, standingsRow, lang, seasonId, teamAbbrev }) {
  const t = getT(lang);
  const width = 900;
  const padding = 28;
  const headerH = 150;
  const rowH = 40;
  const players = (rows || []).filter(r => r.is_active && r.kind === 'player').sort((a, b) => (Number(b.total_points) || 0) - (Number(a.total_points) || 0));
  const height = headerH + padding * 2 + Math.max(players.length, 1) * rowH + 20;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return canvas; // environnement sans support canvas (ex. jsdom en test) : rien a dessiner, ne jamais planter

  const colors = teamColors(teamAbbrev);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, headerH);
  grad.addColorStop(0, colors.primary);
  grad.addColorStop(1, colors.secondary);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerH);

  if (NHL_VISUALS_ENABLED && teamAbbrev && POOL_TEAM_LOGOS[teamAbbrev]) {
    const logo = await loadImageSafe(imageProxyUrl(POOL_TEAM_LOGOS[teamAbbrev]));
    if (logo) ctx.drawImage(logo, padding, 20, 90, 90);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px -apple-system, Arial, sans-serif';
  ctx.fillText(memberLabel(member, pool.rules), padding + 110, 60);
  ctx.font = '600 15px -apple-system, Arial, sans-serif';
  const rankTxt = standingsRow?.rank != null ? `${t('pool_locker_rank_label')} #${standingsRow.rank} · ` : '';
  ctx.fillText(`${rankTxt}${round1(standingsRow?.total_points ?? 0)} ${t('pool_standings_col_pts')}`, padding + 110, 90);
  ctx.font = '700 16px -apple-system, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Betrics', width - padding, 36);
  ctx.textAlign = 'left';

  let y = headerH + padding + 14;
  ctx.font = '600 15px -apple-system, Arial, sans-serif';
  if (players.length === 0) {
    ctx.fillStyle = '#888888';
    ctx.fillText(t('pool_locker_no_players'), padding, y);
  }
  for (const r of players) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(padding, y - 22, width - padding * 2, rowH - 8);

    const headshot = await loadImageSafe(imageProxyUrl(headshotUrl(r.ref_id, seasonId, r.team_abbrev, r.pos_group)));
    if (headshot) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(padding + 16, y - 6, 15, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(headshot, padding + 1, y - 21, 30, 30);
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.label, padding + 42, y);
    ctx.fillStyle = '#f97316';
    ctx.textAlign = 'right';
    ctx.font = '700 16px -apple-system, Arial, sans-serif';
    ctx.fillText(String(round1(r.total_points)), width - padding - 10, y);
    ctx.font = '600 15px -apple-system, Arial, sans-serif';
    ctx.textAlign = 'left';
    y += rowH;
  }

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) { resolve(null); return; }
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    // Repli : certains environnements (jsdom en test, navigateurs sans support canvas reel)
    // exposent toBlob sans jamais appeler le callback -- ne doit jamais bloquer indefiniment.
    setTimeout(() => finish(null), 2000);
    try { canvas.toBlob((blob) => finish(blob), 'image/png'); } catch { finish(null); }
  });
}

// Genere l'image ET declenche son telechargement. Retourne true si un blob a bien ete produit
// (false en environnement sans canvas reel, ex. jsdom) -- jamais une exception non attrapee.
export async function downloadLockerRoomImage(params) {
  const canvas = await exportLockerRoomImage(params);
  const blob = await canvasToBlob(canvas);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nomFichier = (memberLabel(params.member, params.pool?.rules) || 'equipe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-');
  a.href = url;
  a.download = `betrics-${nomFichier}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

function ShareButton({ pool, member, rows, standingsRow, lang, seasonId, teamAbbrev }) {
  const t = getT(lang);
  const [busy, setBusy] = useState(false);
  async function handleClick() {
    setBusy(true);
    try { await downloadLockerRoomImage({ pool, member, rows, standingsRow, lang, seasonId, teamAbbrev }); }
    catch (err) { console.error(err); }
    setBusy(false);
  }
  return (
    <button type="button" onClick={handleClick} disabled={busy}
      style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: busy ? 'default' : 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700', minHeight: '44px', opacity: busy ? 0.7 : 1 }}>
      {busy ? t('pool_locker_sharing') : t('pool_locker_share_btn')}
    </button>
  );
}

// ===================== Composant principal : bascule Formation / Tableau =====================
// `children` = le tableau detaille deja existant (MEMBER_DETAIL_SECTIONS + MemberSummaryTable
// dans PoolDraftRoom.js), inchange, affiche quand vue==='table'. La selection de participant,
// les fleches precedent/suivant et la barre de periode restent la responsabilite de l'appelant
// (MemberDetailPanel) -- ce composant ne gere que l'affichage du participant deja selectionne.
// loading : rows pas encore charges (true) -- emptyMessage : texte a afficher a la place de la
// formation/du tableau si le participant n'a aucun joueur (pool pas encore repeche, ou
// participant sans choix) ; le bandeau (nom, rang, points) reste toujours visible, meme dans
// ces deux cas, comme l'en-tete qu'il remplace.
export function PoolTeamHub({ pool, member, members, rows, standingsRow, lang, children, loading, emptyMessage }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [vue, setVue] = useState('formation');
  const [openedPlayer, setOpenedPlayer] = useState(null);
  const gamesToday = useTodayGames();

  const rowsSafe = rows || [];
  const formation = useMemo(() => buildFormation(rowsSafe, pool.rules), [rowsSafe, pool.rules]);
  const formerPlayers = useMemo(() => buildFormerPlayers(rowsSafe), [rowsSafe]);
  // Contexte de comparaison pour les paliers visuels (bronze/argent/or/elite) : tous les
  // joueurs de CETTE equipe (actifs + anciens) -- relatif, jamais un seuil de points en dur.
  const allPoints = useMemo(() => rowsSafe.filter(r => r.kind === 'player').map(r => Number(r.total_points) || 0), [rowsSafe]);
  const injuriesKey = useMemo(() => rowsSafe.filter(r => r.kind === 'player').map(r => String(r.ref_id)).join(','), [rowsSafe]);
  const injuries = usePlayerInjuries(injuriesKey);
  const departures = useFormerPlayerDepartures(pool.id, member?.id, formerPlayers);
  const membersById = useMemo(() => {
    const map = {};
    (members || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  function openCard(row) {
    if (!row || row.kind !== 'player') return;
    setOpenedPlayer({ id: row.ref_id, nom: row.label, equipe: row.team_abbrev, position: row.pos_group, numero: '' });
  }

  const showContent = !loading && !emptyMessage;
  const reserveCount = formation.bench.length + formation.ir.length;
  const showBenchTab = reserveCount > 0;
  const showFormerTab = formerPlayers.length > 0;

  function tabButton(key, labelKey, count) {
    return (
      <button type="button" role="tab" aria-selected={vue === key} onClick={() => setVue(key)} style={toggleBtnStyle(vue === key)}>
        <span>{t(labelKey)}</span>
        {count != null && <span className="locker-tab-count">{count}</span>}
      </button>
    );
  }

  return (
    <div className="locker-team-hub">
      {showContent && (
        <div className="locker-tabs" role="tablist">
          {tabButton('formation', 'pool_locker_view_formation')}
          {tabButton('table', 'pool_locker_view_table')}
          {showBenchTab && tabButton('bench', 'pool_locker_tab_bench_ir', reserveCount)}
          {showFormerTab && tabButton('former', 'pool_locker_former_players', formerPlayers.length)}
        </div>
      )}

      <PoolTeamBanner pool={pool} member={member} rows={rowsSafe} standingsRow={standingsRow} teamPick={formation.teamPick} lang={lang} />
      <TierLegend lang={lang} />

      {loading ? (
        <PoolIceBoardSkeleton />
      ) : emptyMessage ? (
        <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '10px 0' }}>{emptyMessage}</div>
      ) : vue === 'table' ? children
        : vue === 'bench' && showBenchTab ? (
          <PoolBenchIrPanel formation={formation} seasonId={seasonId} lang={lang} gamesToday={gamesToday} injuries={injuries} allPoints={allPoints} onOpen={openCard} />
        ) : vue === 'former' && showFormerTab ? (
          <PoolFormerPlayers players={formerPlayers} seasonId={seasonId} lang={lang} allPoints={allPoints} onOpen={openCard}
            departures={departures} membersById={membersById} poolRules={pool.rules} />
        ) : (
          <>
            <PoolIceBoard formation={formation} seasonId={seasonId} lang={lang} gamesToday={gamesToday} injuries={injuries} allPoints={allPoints} onOpen={openCard} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <ShareButton pool={pool} member={member} rows={rowsSafe} standingsRow={standingsRow} lang={lang} seasonId={seasonId} teamAbbrev={formation.teamPick?.ref_id} />
            </div>
          </>
        )}

      {openedPlayer && (
        <div className="locker-player-modal-backdrop" onClick={() => setOpenedPlayer(null)}>
          <div className="locker-player-modal" onClick={e => e.stopPropagation()}>
            <FicheJoueurStats joueur={openedPlayer} onBack={() => setOpenedPlayer(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
