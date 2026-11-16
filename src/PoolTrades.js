// Phase 4A : echanges et agents libres (ballotage).
//
// Reutilise les memes conventions visuelles que Pool.js/PoolDraftRoom.js (cartes arrondies,
// orange d'accent, variables --c-xxx pour le theme clair/sombre) et les hooks/composants de
// recherche de joueurs deja construits pour le draft (useNhlPlayers, useNhlTeams,
// PlayerAvatar, TeamLogo, PlayerDetailModal, calculerValeurIA) pour l'onglet "Agents libres".
//
// La propriete affichee ici vient TOUJOURS du serveur (get_member_breakdown, qui lit
// pool_roster_periods) : aucune des RPC d'echange/ballotage n'est appelee avec des donnees
// de salaire/poste fournies par le client sans etre revalidees cote serveur.

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile, useSaisonCourante } from './Analyses';
import { validateTrade, rosterTargetsByPosGroup } from './poolRules';
import {
  useNhlPlayers, useNhlTeams, PlayerDetailModal, PlayerAvatar, TeamLogo, round1,
  calculerValeurIA, posReelToPickPosition, memberLabel, useTeamCrests,
} from './PoolDraftRoom';
import { useTodayGames, usePlayerInjuries, gameStatusForTeam } from './PoolLockerRoom';
import { teamGradient } from './nhlTeamColors';
import PlayerCard from './PlayerCard';

const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '16px' };
const inputStyle = { width: '100%', padding: '10px 12px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '10px', color: 'var(--c-white)', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '11px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' };
const btnSecondary = { padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--c-888)', fontSize: '13px', fontWeight: '600' };
const sectionTitle = (color) => ({ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' });
const POS_COLORS = { F: '#f97316', D: '#3b82f6', G: '#22c55e', TEAM: '#a78bfa' };

// pos_group ('F'/'D'/'G'/'TEAM', convention serveur) <-> positionGroup mot ('forward'/...,
// convention historique de validateTrade()) : garde l'API existante de poolRules.js intacte
// (et ses tests) tout en reutilisant la meme fonction pour l'apercu en direct de l'UI.
const POS_GROUP_TO_WORD = { F: 'forward', D: 'defense', G: 'goalie', TEAM: 'team' };

function mapTradeError(code, t) {
  let translated = t(code);
  if (translated !== code) return translated;
  const prefixed = `pool_draft_error_${code}`;
  translated = t(prefixed);
  if (translated !== prefixed) return translated;
  return t('pool_draft_error_generic');
}

function itemKey(it) { return `${it.kind}:${it.ref_id}`; }

// ===================== Historique des echanges (compteurs + anti-reprise) =====================

function useTradeHistory(poolId) {
  const [trades, setTrades] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    const { data: tr } = await supabase.from('pool_trades').select('*').eq('pool_id', poolId).order('created_at', { ascending: false });
    const ids = (tr || []).map(t => t.id);
    const { data: it } = ids.length
      ? await supabase.from('pool_trade_items').select('*').in('trade_id', ids)
      : { data: [] };
    setTrades(tr || []);
    setItems(it || []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [poolId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase.channel(`pool_trades_${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_trades', filter: `pool_id=eq.${poolId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_transactions', filter: `pool_id=eq.${poolId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  // { countA, countB, tradedAwayByA, tradedAwayByB } attendu par validateTrade().
  function historyFor(memberAId, memberBId) {
    const accepted = trades.filter(t => t.status === 'accepted');
    const countA = accepted.filter(t => t.proposer_member_id === memberAId || t.recipient_member_id === memberAId).length;
    const countB = accepted.filter(t => t.proposer_member_id === memberBId || t.recipient_member_id === memberBId).length;
    const acceptedIds = new Set(accepted.map(t => t.id));
    const tradedAwayByA = items.filter(it => acceptedIds.has(it.trade_id) && it.from_member_id === memberAId).map(it => it.player_id);
    const tradedAwayByB = items.filter(it => acceptedIds.has(it.trade_id) && it.from_member_id === memberBId).map(it => it.player_id);
    return { countA, countB, tradedAwayByA, tradedAwayByB };
  }

  return { trades, items, loading, reload, historyFor };
}

function useMemberRoster(poolId, memberId) {
  const [rows, setRows] = useState(null);

  async function reload() {
    if (!memberId) { setRows([]); return; }
    const { data } = await supabase.rpc('get_member_breakdown', { p_pool_id: poolId, p_member_id: memberId });
    setRows(data || []);
  }

  useEffect(() => { setRows(null); reload(); }, [poolId, memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading: rows === null, reload };
}

// ===================== Fonctions pures (composition, plafond, contre-offre) =====================
// Exportees pour etre testees sans rendu -- aucune ne touche le serveur, seulement l'etat local
// (listes de joueurs selectionnes) et pool.rules.

// Composition APRES echange pour UNE equipe, par groupe F/D/G (jamais TEAM, hors perimetre de
// cet affichage -- voir requirement : seulement Attaquants/Defenseurs/Gardiens). activeRows =
// roster actif actuel de cette equipe ; given = joueurs qu'elle cederait (retires du compte) ;
// received = joueurs qu'elle recevrait (ajoutes au compte, par pos_group).
export function compositionAfterTrade(rules, activeRows, given, received) {
  const givenKeys = new Set((given || []).filter(Boolean).map(itemKey));
  const kept = (activeRows || []).filter(r => r.kind === 'player' && !givenKeys.has(itemKey(r)));
  const addedPositions = (received || []).filter(Boolean).filter(r => r.kind === 'player').map(r => r.pos_group);
  const counts = { F: 0, D: 0, G: 0 };
  kept.forEach(r => { if (counts[r.pos_group] != null) counts[r.pos_group]++; });
  addedPositions.forEach(p => { if (counts[p] != null) counts[p]++; });
  const targets = rosterTargetsByPosGroup(rules);
  return ['F', 'D', 'G'].map(pos => ({ pos, used: counts[pos], quota: targets[pos], ok: counts[pos] === targets[pos] }));
}

// Masse salariale APRES echange pour une equipe (seulement si rules.salaryCap.enabled -- la
// source capHit/actualSalary est deja ce qui a ete enregistre dans `salary` au moment du
// repechage/ajout, voir poolRules.SALARY_CAP_SOURCES, rien a recalculer ici).
export function capStatusAfterTrade(rules, activeRows, given, received) {
  const cap = Number(rules?.salaryCap?.amount) || 0;
  const currentTotal = (activeRows || []).reduce((s, r) => s + (Number(r.salary) || 0), 0);
  const givenTotal = (given || []).filter(Boolean).reduce((s, r) => s + (Number(r.salary) || 0), 0);
  const receivedTotal = (received || []).filter(Boolean).reduce((s, r) => s + (Number(r.salary) || 0), 0);
  const used = currentTotal - givenTotal + receivedTotal;
  return { used, cap, remaining: cap - used, over: cap > 0 && used > cap };
}

// Joueurs d'un membre deja proposes dans UNE AUTRE offre encore pending/pending_commissioner
// (hors celle qu'on est en train de visualiser/contre-offrir, excludeTradeId) : marques --
// jamais bloques -- dans le selecteur de roster, pour eviter un double engagement accidentel.
export function playersCommittedElsewhere(trades, items, memberId, excludeTradeId) {
  const pendingIds = new Set(
    (trades || [])
      .filter(t => (t.status === 'pending' || t.status === 'pending_commissioner') && t.id !== excludeTradeId)
      .map(t => t.id)
  );
  const set = new Set();
  (items || []).forEach(it => {
    if (pendingIds.has(it.trade_id) && it.from_member_id === memberId) set.add(`${it.kind}:${it.player_id}`);
  });
  return set;
}

function tradeItemToRow(it) {
  return { kind: it.kind, ref_id: it.player_id, label: it.player_name, pos_group: it.position, team_abbrev: it.nhl_team, salary: it.salary, total_points: null };
}

function itemsForSide(tradeId, items, memberId) {
  return (items || []).filter(it => it.trade_id === tradeId && it.from_member_id === memberId).map(tradeItemToRow);
}

// Prefill d'une contre-offre : les MEMES joueurs que l'offre d'origine, roles inverses (le
// destinataire original devient proposeur). "mySlots" = ce que le contre-offrant cederait
// (deja le sien, inchange), "partnerSlots" = ce qu'il recevrait (deja chez l'ex-proposeur,
// inchange) -- l'utilisateur peut ensuite librement modifier les deux avant d'envoyer.
export function buildCounterOfferSlots(trade, items) {
  return {
    mySlots: itemsForSide(trade.id, items, trade.recipient_member_id),
    partnerSlots: itemsForSide(trade.id, items, trade.proposer_member_id),
  };
}

function padTo3(arr) {
  const out = [...(arr || []).slice(0, 3)];
  while (out.length < 3) out.push(null);
  return out;
}

function enrichWithLivePoints(row, rowsAll) {
  if (!row) return row;
  const found = (rowsAll || []).find(r => r.kind === row.kind && String(r.ref_id) === String(row.ref_id));
  return found ? { ...row, total_points: found.total_points ?? row.total_points, salary: found.salary ?? row.salary } : row;
}

const TERMINAL_STATUSES = ['accepted', 'declined', 'cancelled', 'rejected', 'countered', 'expired'];

// ===================== Carte joueur compacte (case remplie/vide) =====================

function TradeSlotFilled({ row, seasonId, capEnabled, onOpen, onRemove }) {
  const isTeam = row.kind === 'team';
  return (
    <div className="trade-slot trade-slot-filled">
      <button type="button" className="trade-slot-main" onClick={() => onOpen(row)}>
        {isTeam ? <TeamLogo abbrev={row.ref_id} size={28} /> : <PlayerAvatar teamAbbrev={row.team_abbrev} goalie={row.pos_group === 'G'} size={28} />}
        <span className="trade-slot-pos" style={{ color: POS_COLORS[row.pos_group] }}>{row.pos_group}</span>
        <span className="trade-slot-name">{row.label}</span>
        {!isTeam && row.team_abbrev && <span className="trade-slot-team">{row.team_abbrev}</span>}
        {capEnabled && row.salary > 0 && <span className="trade-slot-salary">{Number(row.salary).toLocaleString()} $</span>}
        {row.total_points != null && <span className="trade-slot-points">{round1(row.total_points)}</span>}
      </button>
      {onRemove && (
        <button type="button" className="trade-slot-remove" aria-label="remove" onClick={onRemove}>×</button>
      )}
    </div>
  );
}

function TradeSlotEmpty({ onClick, t }) {
  return (
    <button type="button" className="trade-slot trade-slot-empty" onClick={onClick} disabled={!onClick}>
      + {t('pool_trades_slot_empty_label')}
    </button>
  );
}

// ===================== Compteurs de composition + plafond =====================

const COMPOSITION_LABEL_KEYS = { F: 'pool_slot_forwards', D: 'pool_slot_defense', G: 'pool_slot_goalies' };

function TradeCompositionRow({ composition, t }) {
  return (
    <div className="trade-composition-row">
      {composition.map(c => (
        <div key={c.pos} className={`trade-composition-chip ${c.ok ? 'trade-composition-ok' : 'trade-composition-bad'}`}>
          <div className="trade-composition-label">{t(COMPOSITION_LABEL_KEYS[c.pos])}</div>
          <div className="trade-composition-value">{c.used}/{c.quota}</div>
        </div>
      ))}
    </div>
  );
}

function TradeCapBar({ capInfo, sourceLabel, t }) {
  const pct = capInfo.cap > 0 ? Math.min(100, (Math.max(0, capInfo.used) / capInfo.cap) * 100) : 0;
  return (
    <div className="trade-cap-block">
      <div className="trade-cap-label">{t('pool_member_cap_label')} ({sourceLabel})</div>
      <div className="trade-cap-bar-track">
        <div className={`trade-cap-bar-fill ${capInfo.over ? 'trade-cap-bar-over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="trade-cap-numbers">
        <span>{t('pool_draft_salary_used')} {capInfo.used.toLocaleString()} $ / {capInfo.cap.toLocaleString()} $</span>
        <span className={capInfo.over ? 'trade-cap-over-text' : ''}>
          {capInfo.over ? t('pool_trades_cap_over_label') : t('pool_standings_salary_remaining').replace('{montant}', Math.max(0, capInfo.remaining).toLocaleString())}
        </span>
      </div>
    </div>
  );
}

// ===================== Panneau d'une equipe (mon equipe / equipe du participant) =====================

function TradeSidePanel({
  member, pool, crestAbbrev, points, slots, editable, capEnabled, capInfo, sourceLabel, composition,
  onSlotClick, onRemoveSlot, onOpenPlayer, seasonId, t,
  memberSelector,
}) {
  return (
    <div className="trade-side-panel">
      <div className="trade-side-header" style={{ backgroundImage: teamGradient(crestAbbrev) }}>
        {crestAbbrev ? <TeamLogo abbrev={crestAbbrev} size={40} /> : <div className="trade-side-header-no-team">{t('pool_locker_no_team_pick')}</div>}
        <div className="trade-side-header-text">
          <div className="trade-side-header-name">{memberLabel(member, pool.rules)}</div>
          <div className="trade-side-header-points">{round1(points)} {t('pool_standings_col_pts').toLowerCase()}</div>
        </div>
      </div>

      {memberSelector}

      <div className="trade-slots-list">
        {slots.map((row, i) => (
          <div className="trade-slot-row" key={i}>
            <span className="trade-row-number">{i + 1}</span>
            {row
              ? <TradeSlotFilled row={row} seasonId={seasonId} capEnabled={capEnabled} onOpen={onOpenPlayer} onRemove={editable ? () => onRemoveSlot(i) : null} />
              : <TradeSlotEmpty onClick={editable ? () => onSlotClick(i) : null} t={t} />}
          </div>
        ))}
      </div>

      <TradeCompositionRow composition={composition} t={t} />
      {capEnabled && <TradeCapBar capInfo={capInfo} sourceLabel={sourceLabel} t={t} />}
    </div>
  );
}

// ===================== Selecteur de roster (fenetre) =====================

function TradePlayerPickerModal({ rows, excludeKeys, elsewhereKeys, injuries, gamesToday, seasonId, onPick, onClose, t }) {
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');

  const filtered = (rows || []).filter(r => {
    if (excludeKeys.has(itemKey(r))) return false;
    if (posFilter !== 'ALL' && r.pos_group !== posFilter) return false;
    if (search.trim() && !r.label.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="trade-picker-backdrop" onClick={onClose}>
      <div className="trade-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="trade-picker-header">
          <span>{t('pool_trades_picker_title')}</span>
          <button type="button" className="trade-picker-close" onClick={onClose} aria-label={t('pool_join_cancel_btn')}>×</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pool_draft_search_ph')} style={{ ...inputStyle, marginBottom: '8px' }} />
        <div className="trade-picker-filters">
          {['ALL', 'F', 'D', 'G', 'TEAM'].map(p => (
            <button key={p} type="button" onClick={() => setPosFilter(p)}
              className={`trade-picker-filter-btn${posFilter === p ? ' trade-picker-filter-active' : ''}`}>
              {p === 'ALL' ? t('pool_draft_filter_all') : p === 'TEAM' ? t('pool_draft_filter_teams') : p}
            </button>
          ))}
        </div>
        <div className="trade-picker-list">
          {filtered.length === 0 ? (
            <div className="trade-picker-empty">{t('pool_trades_picker_empty')}</div>
          ) : filtered.map(r => {
            const key = itemKey(r);
            const disabled = elsewhereKeys.has(key);
            const injury = injuries?.[String(r.ref_id)];
            const gameStatus = gameStatusForTeam(gamesToday, r.team_abbrev);
            return (
              <button type="button" key={key} disabled={disabled} className="trade-picker-row" onClick={() => !disabled && onPick(r)}>
                {r.kind === 'team' ? <TeamLogo abbrev={r.ref_id} size={24} /> : <PlayerAvatar teamAbbrev={r.team_abbrev} goalie={r.pos_group === 'G'} size={24} />}
                <span className="trade-picker-pos" style={{ color: POS_COLORS[r.pos_group] }}>{r.pos_group}</span>
                <span className="trade-picker-name">{r.label}</span>
                {injury && <span className="trade-picker-injury-dot" aria-label={`${t('pool_locker_injury_prefix')} ${injury.status}`} />}
                {gameStatus && <span className={`trade-picker-game-dot trade-picker-game-dot-${gameStatus}`} />}
                {disabled && <span className="trade-picker-tag">{t('pool_trades_picker_elsewhere_tag')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===================== Liste (Reçues / Envoyées / Historique) =====================

function TradeListRow({ trade, members, pool, active, onClick, t }) {
  const proposer = members.find(m => m.id === trade.proposer_member_id);
  const recipient = members.find(m => m.id === trade.recipient_member_id);
  return (
    <button type="button" onClick={onClick} className={`trade-list-row${active ? ' trade-list-row-active' : ''}`}>
      <span className="trade-list-names">{memberLabel(proposer, pool.rules)} ⇄ {memberLabel(recipient, pool.rules)}</span>
      <span className="trade-list-status">{t(`pool_trade_status_${trade.status}`)}</span>
    </button>
  );
}

// ===================== Actions (destinataire / proposeur / commissaire) =====================

function TradeActionsBar({ trade, myMemberId, isCommissioner, onAccept, onDecline, onCancel, onApprove, onReject, onCounter, busy, error, t }) {
  const isRecipient = trade.recipient_member_id === myMemberId;
  const isProposer = trade.proposer_member_id === myMemberId;
  const pending = trade.status === 'pending';
  const pendingCommissioner = trade.status === 'pending_commissioner';

  return (
    <div className="trade-action-bar">
      {pending && isRecipient && (
        <div className="trade-action-buttons">
          <button type="button" className="trade-big-btn" disabled={busy} onClick={onAccept}>{t('pool_trades_accept_btn')}</button>
          <button type="button" className="trade-btn-secondary" disabled={busy} onClick={onDecline}>{t('pool_trades_decline_btn')}</button>
          <button type="button" className="trade-btn-secondary" disabled={busy} onClick={onCounter}>{t('pool_trades_counteroffer_btn')}</button>
        </div>
      )}
      {(pending || pendingCommissioner) && isProposer && (
        <button type="button" className="trade-btn-secondary" disabled={busy} onClick={onCancel}>{t('pool_trades_cancel_btn')}</button>
      )}
      {pendingCommissioner && isCommissioner && (
        <div className="trade-action-buttons">
          <button type="button" className="trade-big-btn" disabled={busy} onClick={onApprove}>{t('pool_trades_approve_btn')}</button>
          <button type="button" className="trade-btn-secondary" disabled={busy} onClick={onReject}>{t('pool_trades_reject_btn')}</button>
        </div>
      )}
      {TERMINAL_STATUSES.includes(trade.status) && (
        <div className="trade-status-pill trade-status-neutral">{t(`pool_trade_status_${trade.status}`)}</div>
      )}
      {error && <div className="trade-error-text">{error}</div>}
    </div>
  );
}

// ===================== Onglet "Echanges" =====================

export function PoolTradesTab({ pool, members, utilisateur, lang, isCommissioner }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const crests = useTeamCrests(pool.id);
  const myMember = members.find(m => m.user_id === utilisateur.id);
  const otherMembers = members.filter(m => m.id !== myMember?.id);

  const { trades, items, loading: historyLoading, reload: reloadHistory, historyFor } = useTradeHistory(pool.id);
  const [counters, setCounters] = useState(null);

  async function reloadCounters() {
    const { data } = await supabase.rpc('get_transaction_counters', { p_pool_id: pool.id, p_member_id: myMember.id });
    setCounters((data || [])[0] || null);
  }
  useEffect(() => { if (myMember?.id) reloadCounters(); }, [myMember?.id, trades]); // eslint-disable-line react-hooks/exhaustive-deps

  const [listTab, setListTab] = useState('received');
  const [mode, setMode] = useState('propose'); // 'propose' | 'view' | 'counter'
  const [viewingTrade, setViewingTrade] = useState(null);
  const [partnerId, setPartnerId] = useState(otherMembers[0]?.id || null);
  const [mySlots, setMySlots] = useState([null, null, null]);
  const [partnerSlots, setPartnerSlots] = useState([null, null, null]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pickerSide, setPickerSide] = useState(null); // 'mine' | 'partner' | null
  const [detailTarget, setDetailTarget] = useState(null);

  const editable = mode === 'propose' || mode === 'counter';

  let leftMemberId, rightMemberId;
  if (mode === 'view' && viewingTrade) {
    const amIParty = myMember && (viewingTrade.proposer_member_id === myMember.id || viewingTrade.recipient_member_id === myMember.id);
    leftMemberId = amIParty ? myMember.id : viewingTrade.proposer_member_id;
    rightMemberId = amIParty ? (viewingTrade.proposer_member_id === myMember.id ? viewingTrade.recipient_member_id : viewingTrade.proposer_member_id) : viewingTrade.recipient_member_id;
  } else if (mode === 'counter' && viewingTrade) {
    leftMemberId = myMember?.id;
    rightMemberId = viewingTrade.proposer_member_id;
  } else {
    leftMemberId = myMember?.id;
    rightMemberId = partnerId;
  }

  const { rows: leftRowsAll } = useMemberRoster(pool.id, leftMemberId);
  const { rows: rightRowsAll } = useMemberRoster(pool.id, rightMemberId);
  const leftActive = useMemo(() => (leftRowsAll || []).filter(r => r.is_active), [leftRowsAll]);
  const rightActive = useMemo(() => (rightRowsAll || []).filter(r => r.is_active), [rightRowsAll]);
  const leftMember = members.find(m => m.id === leftMemberId) || null;
  const rightMember = members.find(m => m.id === rightMemberId) || null;
  const leftPoints = (leftRowsAll || []).filter(r => r.is_active).reduce((s, r) => s + (Number(r.total_points) || 0), 0);
  const rightPoints = (rightRowsAll || []).filter(r => r.is_active).reduce((s, r) => s + (Number(r.total_points) || 0), 0);

  function startPropose() {
    setMode('propose'); setViewingTrade(null);
    setPartnerId(otherMembers[0]?.id || null);
    setMySlots([null, null, null]); setPartnerSlots([null, null, null]);
    setMessage(''); setError(''); setSuccessMsg('');
  }

  function startView(trade) {
    setMode('view'); setViewingTrade(trade);
    const amIParty = myMember && (trade.proposer_member_id === myMember.id || trade.recipient_member_id === myMember.id);
    const lId = amIParty ? myMember.id : trade.proposer_member_id;
    const rId = amIParty ? (trade.proposer_member_id === myMember.id ? trade.recipient_member_id : trade.proposer_member_id) : trade.recipient_member_id;
    setMySlots(padTo3(itemsForSide(trade.id, items, lId)));
    setPartnerSlots(padTo3(itemsForSide(trade.id, items, rId)));
    setError(''); setSuccessMsg('');
  }

  function startCounter(trade) {
    const { mySlots: ms, partnerSlots: ps } = buildCounterOfferSlots(trade, items);
    setMode('counter'); setViewingTrade(trade);
    setMySlots(padTo3(ms)); setPartnerSlots(padTo3(ps));
    setMessage(''); setError(''); setSuccessMsg('');
  }

  // Changer de participant (mode 'propose' uniquement) : l'offre d'en face n'a plus de sens
  // pour un autre membre, mes propres selections restent valides quel que soit le partenaire.
  useEffect(() => {
    if (mode === 'propose') { setPartnerSlots([null, null, null]); setError(''); setSuccessMsg(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  function switchPartner(offset) {
    if (otherMembers.length < 2) return;
    const idx = otherMembers.findIndex(m => m.id === partnerId);
    const next = (idx + offset + otherMembers.length) % otherMembers.length;
    setPartnerId(otherMembers[next].id);
  }

  const filledMy = mySlots.filter(Boolean);
  const filledPartner = partnerSlots.filter(Boolean);
  const sameCount = filledMy.length > 0 && filledMy.length === filledPartner.length;

  const preview = useMemo(() => {
    if (!editable || !leftMemberId || !rightMemberId) return null;
    if (!sameCount) return { ok: false, errors: ['pool_trade_error_count_mismatch'] };
    const toWordRoster = (rows) => rows.map(r => ({ id: r.ref_id, positionGroup: POS_GROUP_TO_WORD[r.pos_group] || 'forward', salary: Number(r.salary) || 0 }));
    const history = historyFor(leftMemberId, rightMemberId);
    return validateTrade(pool.rules, toWordRoster(leftActive), toWordRoster(rightActive), toWordRoster(filledMy), toWordRoster(filledPartner), history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, leftMemberId, rightMemberId, sameCount, filledMy, filledPartner, leftActive, rightActive, pool.rules, historyFor]);

  const compositionLeft = useMemo(() => compositionAfterTrade(pool.rules, leftActive, filledMy, filledPartner), [pool.rules, leftActive, filledMy, filledPartner]);
  const compositionRight = useMemo(() => compositionAfterTrade(pool.rules, rightActive, filledPartner, filledMy), [pool.rules, rightActive, filledPartner, filledMy]);
  const capEnabled = !!pool.rules?.salaryCap?.enabled;
  const capLeft = useMemo(() => capStatusAfterTrade(pool.rules, leftActive, filledMy, filledPartner), [pool.rules, leftActive, filledMy, filledPartner]);
  const capRight = useMemo(() => capStatusAfterTrade(pool.rules, rightActive, filledPartner, filledMy), [pool.rules, rightActive, filledPartner, filledMy]);
  const sourceLabel = t(`pool_salarycap_source_short_${pool.rules?.salaryCap?.source || 'capHit'}`);

  const compositionOk = compositionLeft.every(c => c.ok) && compositionRight.every(c => c.ok);
  const capOk = !capEnabled || (!capLeft.over && !capRight.over);
  const overallValid = !!preview?.ok && compositionOk && capOk;

  const invalidReason = !sameCount ? t('pool_trade_error_count_mismatch')
    : (preview && !preview.ok) ? mapTradeError(preview.errors[0], t)
    : !compositionOk ? t('pool_trade_error_roster_composition')
    : !capOk ? t('pool_trades_cap_over_label')
    : null;

  const gamesToday = useTodayGames();
  const injuriesKey = useMemo(() => [...leftActive, ...rightActive].filter(r => r.kind === 'player').map(r => String(r.ref_id)).join(','), [leftActive, rightActive]);
  const injuries = usePlayerInjuries(injuriesKey);

  function openPicker(side) { setPickerSide(side); }
  function closePicker() { setPickerSide(null); }

  function pickPlayer(row) {
    const setFn = pickerSide === 'mine' ? setMySlots : setPartnerSlots;
    setFn(prev => {
      const next = [...prev];
      const firstEmpty = next.findIndex(s => !s);
      if (firstEmpty !== -1) next[firstEmpty] = row;
      return next;
    });
    closePicker();
  }

  function removeSlot(side, index) {
    const setFn = side === 'mine' ? setMySlots : setPartnerSlots;
    setFn(prev => { const next = [...prev]; next[index] = null; return next; });
  }

  async function submitTrade() {
    setBusy(true); setError(''); setSuccessMsg('');
    const gives = filledMy.map(r => ({ kind: r.kind, player_id: r.ref_id }));
    const receives = filledPartner.map(r => ({ kind: r.kind, player_id: r.ref_id }));
    const { error: err } = await supabase.rpc('propose_trade', {
      p_pool_id: pool.id, p_to_member_id: partnerId, p_gives: gives, p_receives: receives, p_message: message.trim() || null,
    });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    setSuccessMsg(t('pool_trade_proposed_success'));
    reloadHistory();
    startPropose();
  }

  async function submitCounter() {
    setBusy(true); setError(''); setSuccessMsg('');
    const gives = filledMy.map(r => ({ kind: r.kind, player_id: r.ref_id }));
    const receives = filledPartner.map(r => ({ kind: r.kind, player_id: r.ref_id }));
    const { error: err } = await supabase.rpc('propose_counter_trade', {
      p_original_trade_id: viewingTrade.id, p_gives: gives, p_receives: receives, p_message: message.trim() || null,
    });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    setSuccessMsg(t('pool_trade_proposed_success'));
    reloadHistory();
    startPropose();
  }

  async function handleAccept() {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('respond_trade', { p_trade_id: viewingTrade.id, p_accept: true });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    reloadHistory(); startPropose();
  }
  async function handleDecline() {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('respond_trade', { p_trade_id: viewingTrade.id, p_accept: false });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    reloadHistory(); startPropose();
  }
  async function handleCancel() {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('cancel_trade', { p_trade_id: viewingTrade.id });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    reloadHistory(); startPropose();
  }
  async function handleApprove() {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('review_trade', { p_trade_id: viewingTrade.id, p_approve: true });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    reloadHistory(); startPropose();
  }
  async function handleReject() {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('review_trade', { p_trade_id: viewingTrade.id, p_approve: false });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    reloadHistory(); startPropose();
  }

  if (!pool.rules?.trades?.enabled) {
    return <div style={{ ...card, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_trades_disabled_notice')}</div>;
  }
  const readOnly = pool.status !== 'active';

  const received = trades.filter(tr => tr.recipient_member_id === myMember?.id && tr.status === 'pending');
  const sent = trades.filter(tr => tr.proposer_member_id === myMember?.id && ['pending', 'pending_commissioner'].includes(tr.status));
  const commissionerOnly = isCommissioner ? trades.filter(tr => tr.status === 'pending_commissioner' && tr.proposer_member_id !== myMember?.id && tr.recipient_member_id !== myMember?.id) : [];
  const receivedTabItems = [...received, ...commissionerOnly];
  const history = trades.filter(tr => TERMINAL_STATUSES.includes(tr.status));

  const showBuilder = mode === 'view' || mode === 'counter' || (!readOnly && otherMembers.length > 0);

  const leftExcludeKeys = new Set(mySlots.filter(Boolean).map(itemKey));
  const rightExcludeKeys = new Set(partnerSlots.filter(Boolean).map(itemKey));
  const leftElsewhereKeys = playersCommittedElsewhere(trades, items, leftMemberId, viewingTrade?.id ?? null);
  const rightElsewhereKeys = playersCommittedElsewhere(trades, items, rightMemberId, viewingTrade?.id ?? null);

  function openFiche(row) {
    setDetailTarget({ kind: row.kind, id: row.ref_id, name: row.label, team: row.team_abbrev, posReel: row.pos_group === 'D' ? 'D' : row.pos_group === 'G' ? 'G' : 'C' });
  }

  return (
    <div className="trade-screen">
      {readOnly && <div style={{ ...card, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_trades_readonly_notice')}</div>}

      {counters && (
        <div style={{ ...card, textAlign: 'center', padding: '10px', marginBottom: '12px' }}>
          <div style={{ fontSize: '9px', color: 'var(--c-666)', textTransform: 'uppercase' }}>{t('pool_trades_counter_trades')}</div>
          <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--c-white)' }}>{counters.trades_used}{counters.trades_max != null ? ` / ${counters.trades_max}` : ''}</div>
        </div>
      )}

      {mode !== 'propose' && (
        <button type="button" onClick={startPropose} style={{ ...btnSecondary, marginBottom: '12px' }}>{t('pool_trades_new_offer_btn')}</button>
      )}
      {mode === 'counter' && <div style={{ fontSize: '12px', color: '#f97316', marginBottom: '12px' }}>{t('pool_trades_counter_mode_notice')}</div>}

      {showBuilder && (
        <>
          <div className="trade-two-panels">
            <TradeSidePanel
              member={leftMember} pool={pool} crestAbbrev={crests[leftMemberId]} points={leftPoints}
              slots={mySlots.map(r => enrichWithLivePoints(r, leftRowsAll))} editable={editable}
              capEnabled={capEnabled} capInfo={capLeft} sourceLabel={sourceLabel} composition={compositionLeft}
              onSlotClick={() => openPicker('mine')} onRemoveSlot={(i) => removeSlot('mine', i)} onOpenPlayer={openFiche}
              seasonId={seasonId} t={t}
            />
            <TradeSidePanel
              member={rightMember} pool={pool} crestAbbrev={crests[rightMemberId]} points={rightPoints}
              slots={partnerSlots.map(r => enrichWithLivePoints(r, rightRowsAll))} editable={editable}
              capEnabled={capEnabled} capInfo={capRight} sourceLabel={sourceLabel} composition={compositionRight}
              onSlotClick={() => openPicker('partner')} onRemoveSlot={(i) => removeSlot('partner', i)} onOpenPlayer={openFiche}
              seasonId={seasonId} t={t}
              memberSelector={mode === 'propose' && otherMembers.length > 0 && (
                <div className="trade-member-selector">
                  <button type="button" onClick={() => switchPartner(-1)} aria-label={t('pool_member_prev_btn')} title={t('pool_member_prev_btn')} className="trade-member-arrow">‹</button>
                  <select value={partnerId || ''} onChange={e => setPartnerId(e.target.value)} className="trade-member-select">
                    {otherMembers.map(m => <option key={m.id} value={m.id}>{memberLabel(m, pool.rules)}</option>)}
                  </select>
                  <button type="button" onClick={() => switchPartner(1)} aria-label={t('pool_member_next_btn')} title={t('pool_member_next_btn')} className="trade-member-arrow">›</button>
                </div>
              )}
            />
          </div>

          {editable && (
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('pool_trades_message_ph')}
              style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', margin: '12px 0' }} />
          )}

          {mode === 'view' ? (
            <TradeActionsBar trade={viewingTrade} myMemberId={myMember?.id} isCommissioner={isCommissioner} busy={busy} error={error}
              onAccept={handleAccept} onDecline={handleDecline} onCancel={handleCancel} onApprove={handleApprove} onReject={handleReject}
              onCounter={() => startCounter(viewingTrade)} t={t} />
          ) : (
            <div className="trade-action-bar">
              <div className={`trade-status-pill ${overallValid ? 'trade-status-ok' : 'trade-status-bad'}`}>
                {overallValid ? t('pool_trades_valid_label') : (invalidReason || t('pool_trades_invalid_label'))}
              </div>
              {error && <div className="trade-error-text">{error}</div>}
              {successMsg && <div className="trade-success-text">{successMsg}</div>}
              <button type="button" className="trade-big-btn" disabled={busy || !overallValid} onClick={mode === 'counter' ? submitCounter : submitTrade}>
                {busy ? t('pool_wizard_saving') : (mode === 'counter' ? t('pool_trades_counteroffer_btn') : t('pool_trades_propose_btn'))}
              </button>
            </div>
          )}
        </>
      )}

      <div className="trade-lists">
        <div className="trade-lists-tabs">
          <button type="button" className={listTab === 'received' ? 'trade-lists-tab-active' : ''} onClick={() => setListTab('received')}>
            {t('pool_trades_received_title')} ({receivedTabItems.length})
          </button>
          <button type="button" className={listTab === 'sent' ? 'trade-lists-tab-active' : ''} onClick={() => setListTab('sent')}>
            {t('pool_trades_sent_title')} ({sent.length})
          </button>
          <button type="button" className={listTab === 'history' ? 'trade-lists-tab-active' : ''} onClick={() => setListTab('history')}>
            {t('pool_trades_history_title')}
          </button>
        </div>
        <div className="trade-lists-content">
          {historyLoading ? (
            <div style={{ color: 'var(--c-555)', fontSize: '13px', padding: '10px 0' }}>{t('pool_loading_generic')}</div>
          ) : (
            (listTab === 'received' ? receivedTabItems : listTab === 'sent' ? sent : history).length === 0 ? (
              <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '10px 0' }}>{t('pool_trades_history_empty')}</div>
            ) : (listTab === 'received' ? receivedTabItems : listTab === 'sent' ? sent : history).map(tr => (
              <TradeListRow key={tr.id} trade={tr} members={members} pool={pool} active={viewingTrade?.id === tr.id} onClick={() => startView(tr)} t={t} />
            ))
          )}
        </div>
      </div>

      {pickerSide && (
        <TradePlayerPickerModal
          rows={pickerSide === 'mine' ? leftActive : rightActive}
          excludeKeys={pickerSide === 'mine' ? leftExcludeKeys : rightExcludeKeys}
          elsewhereKeys={pickerSide === 'mine' ? leftElsewhereKeys : rightElsewhereKeys}
          injuries={injuries} gamesToday={gamesToday} seasonId={seasonId}
          onPick={pickPlayer} onClose={closePicker} t={t}
        />
      )}

      {detailTarget && (
        <PlayerDetailModal target={detailTarget} seasonId={seasonId} lang={lang} taken={false} ownerName={null}
          canPick={false} onPick={() => {}} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}

// ===================== Onglet "Agents libres" (ballotage) =====================

export function PoolWaiversTab({ pool, members, utilisateur, lang }) {
  const t = getT(lang);
  const isMobile = useIsMobile();
  const seasonId = useSaisonCourante();
  const myMember = members.find(m => m.user_id === utilisateur.id);

  const { players, loading: playersLoading, error: playersError } = useNhlPlayers(seasonId);
  const { teams, loading: teamsLoading } = useNhlTeams();

  const [takenIds, setTakenIds] = useState(null);
  const [droppedWindows, setDroppedWindows] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [counters, setCounters] = useState(null);
  const [posFilter, setPosFilter] = useState('ALL');
  const [injuredOnly, setInjuredOnly] = useState(false);
  const [tonightOnly, setTonightOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [nbShown, setNbShown] = useState(50);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [dropChoice, setDropChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [detailTarget, setDetailTarget] = useState(null);

  async function reloadState() {
    const [{ data: periods }, { data: dropped }, { data: claims }, { data: ctr }] = await Promise.all([
      supabase.from('pool_roster_periods').select('kind, player_id').eq('pool_id', pool.id).is('to_at', null),
      supabase.from('pool_dropped_players').select('*').eq('pool_id', pool.id).gt('available_at', new Date().toISOString()),
      myMember ? supabase.from('pool_waiver_claims').select('*').eq('pool_id', pool.id).eq('member_id', myMember.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
      myMember ? supabase.rpc('get_transaction_counters', { p_pool_id: pool.id, p_member_id: myMember.id }) : Promise.resolve({ data: [] }),
    ]);
    setTakenIds(new Set((periods || []).map(p => `${p.kind}:${p.player_id}`)));
    setDroppedWindows(dropped || []);
    setMyClaims(claims || []);
    setCounters((ctr || [])[0] || null);
  }

  useEffect(() => { reloadState(); }, [pool.id, myMember?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase.channel(`pool_waivers_${pool.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_transactions', filter: `pool_id=eq.${pool.id}` }, reloadState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_waiver_claims', filter: `pool_id=eq.${pool.id}` }, reloadState)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.id]);

  const playersWithValue = useMemo(() => players.map(p => ({ ...p, valeurIA: calculerValeurIA(p, pool.rules) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, pool.rules]);

  // Table player_injuries en entier (petite table -- seuls les joueurs blesses a un instant
  // donne, voir supabase/migrations/20261112_player_injuries.sql) : plus simple et plus leger
  // qu'une clause IN avec potentiellement des centaines d'agents libres. "Qui joue ce soir" :
  // meme cache nhl_games que la Vue vestiaire (un seul appel).
  const gamesToday = useTodayGames();
  const [injuries, setInjuries] = useState({});
  useEffect(() => {
    let annule = false;
    supabase.from('player_injuries').select('*').then(({ data, error: err }) => {
      if (annule) return;
      if (err) { setInjuries({}); return; }
      const map = {};
      (data || []).forEach(row => { map[row.player_id] = row; });
      setInjuries(map);
    }).catch(() => { if (!annule) setInjuries({}); });
    return () => { annule = true; };
  }, []);

  const filteredPlayers = useMemo(() => {
    if (!takenIds) return [];
    const q = search.trim().toLowerCase();
    return playersWithValue
      .filter(p => {
        if (takenIds.has(`player:${p.id}`)) return false;
        if (posFilter !== 'ALL' && posFilter !== 'TEAM' && posReelToPickPosition(p.posReel) !== posFilter) return false;
        if (injuredOnly && !injuries[String(p.id)]) return false;
        if (tonightOnly && !gameStatusForTeam(gamesToday, p.team)) return false;
        if (q && !p.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.valeurIA - a.valeurIA);
  }, [playersWithValue, posFilter, injuredOnly, tonightOnly, injuries, gamesToday, search, takenIds]);

  const filteredTeams = useMemo(() => {
    if (!takenIds) return [];
    const q = search.trim().toLowerCase();
    return teams.filter(tm => !takenIds.has(`team:${tm.abbrev}`) && (!q || tm.name.toLowerCase().includes(q) || tm.abbrev.toLowerCase().includes(q)));
  }, [teams, takenIds, search]);

  function waiverWindowFor(kind, playerId) {
    return droppedWindows.find(d => d.kind === kind && d.player_id === playerId);
  }

  function requestAdd(item, kind) {
    setError(''); setSuccessMsg('');
    setPendingAdd({ ...item, kind });
    setDropChoice(null);
  }

  async function confirmAdd() {
    if (!pendingAdd) return;
    setBusy(true); setError('');
    const position = pendingAdd.kind === 'team' ? 'TEAM' : posReelToPickPosition(pendingAdd.posReel);
    const nhlTeam = pendingAdd.kind === 'team' ? pendingAdd.abbrev : pendingAdd.team;
    const { data, error: err } = await supabase.rpc('add_free_agent', {
      p_pool_id: pool.id, p_kind: pendingAdd.kind, p_player_id: String(pendingAdd.id ?? pendingAdd.abbrev),
      p_player_name: pendingAdd.name, p_position: position, p_nhl_team: nhlTeam, p_salary: null,
      p_drop_player_id: dropChoice?.ref_id || null, p_drop_kind: dropChoice?.kind || 'player',
      p_detailed_position: pendingAdd.kind === 'team' ? null : pendingAdd.posReel,
    });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    setSuccessMsg(data?.claimed ? t('pool_waivers_claim_created') : t('pool_waivers_add_success'));
    setPendingAdd(null); setDropChoice(null);
    reloadState();
  }

  const { rows: myRows } = useMemberRoster(pool.id, myMember?.id);
  const myActive = useMemo(() => (myRows || []).filter(r => r.is_active), [myRows]);

  if (!pool.rules?.waivers?.enabled) {
    return <div style={{ ...card, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_waivers_disabled_notice')}</div>;
  }
  const readOnly = pool.status !== 'active';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {readOnly && <div style={{ ...card, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_trades_readonly_notice')}</div>}

      {counters && (
        <div style={{ ...card, textAlign: 'center', padding: '10px' }}>
          <div style={{ fontSize: '9px', color: 'var(--c-666)', textTransform: 'uppercase' }}>{t('pool_waivers_counter_adds')}</div>
          <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--c-white)' }}>{counters.adds_used}{counters.adds_max != null ? ` / ${counters.adds_max}` : ''}</div>
        </div>
      )}

      {myClaims.length > 0 && (
        <div style={card}>
          <div style={sectionTitle('#f97316')}>{t('pool_waivers_my_claims_title')}</div>
          {myClaims.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--c-161616)', fontSize: '12px' }}>
              <span style={{ color: 'var(--c-white)' }}>{c.add_player_name}</span>
              <span style={{ color: 'var(--c-666)' }}>{t('pool_waivers_processing_at')} {new Date(c.process_at).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US')}</span>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div style={card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pool_draft_search_ph')} style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'F', 'D', 'G', 'TEAM'].map(p => (
                <button key={p} onClick={() => { setPosFilter(p); setNbShown(50); }}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: posFilter === p ? (POS_COLORS[p] || '#f97316') : 'var(--c-111)', color: posFilter === p ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '700' }}>
                  {p === 'ALL' ? t('pool_draft_filter_all') : p === 'TEAM' ? t('pool_draft_filter_teams') : p}
                </button>
              ))}
            </div>
            {posFilter !== 'TEAM' && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setInjuredOnly(v => !v)}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: injuredOnly ? '#ef4444' : 'var(--c-111)', color: injuredOnly ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '700' }}>
                  {t('pool_waivers_filter_injured')}
                </button>
                <button onClick={() => setTonightOnly(v => !v)}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: tonightOnly ? '#f97316' : 'var(--c-111)', color: tonightOnly ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '700' }}>
                  {t('pool_waivers_filter_tonight')}
                </button>
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '10px' }}>{error}</div>}
          {successMsg && <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '10px' }}>{successMsg}</div>}

          {posFilter === 'TEAM' ? (
            teamsLoading || !takenIds ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-444)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
            ) : filteredTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('pool_draft_no_players_found')}</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {filteredTeams.map(tm => (
                  <PlayerCard key={tm.abbrev} size="S" lang={lang}
                    row={{ kind: 'team', ref_id: tm.abbrev, label: tm.name, total_points: 0 }}
                    onOpen={() => setDetailTarget({ kind: 'team', id: tm.abbrev, name: tm.name, rank: tm.rank })}
                    actionLabel={t('pool_waivers_add_btn')} onAction={() => requestAdd(tm, 'team')} />
                ))}
              </div>
            )
          ) : playersLoading || !takenIds ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-444)', fontSize: '13px' }}>{t('pool_draft_loading_players')}</div>
          ) : playersError ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#ef4444', fontSize: '13px' }}>{t('pool_draft_load_error')}</div>
          ) : filteredPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('pool_draft_no_players_found')}</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {filteredPlayers.slice(0, nbShown).map(j => {
                  const win = waiverWindowFor('player', j.id);
                  return (
                    <div key={j.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <PlayerCard size="S" lang={lang} seasonId={seasonId}
                        row={{ kind: 'player', ref_id: j.id, label: j.name, pos_group: posReelToPickPosition(j.posReel), team_abbrev: j.team, total_points: j.valeurIA }}
                        injury={injuries[String(j.id)]}
                        gameStatus={gameStatusForTeam(gamesToday, j.team)}
                        onOpen={() => setDetailTarget({ kind: 'player', id: j.id, name: j.name, team: j.team, posReel: j.posReel })}
                        actionLabel={t('pool_waivers_add_btn')} onAction={() => requestAdd(j, 'player')} />
                      {win && <div style={{ fontSize: '9px', color: '#f97316', textAlign: 'center' }}>{t('pool_waivers_until')} {new Date(win.available_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US')}</div>}
                    </div>
                  );
                })}
              </div>
              {nbShown < filteredPlayers.length && (
                <button onClick={() => setNbShown(n => n + 50)} style={{ ...btnSecondary, width: '100%' }}>{t('pool_draft_show_more')} ({filteredPlayers.length - nbShown})</button>
              )}
            </>
          )}
        </div>
      )}

      {pendingAdd && (
        <div onClick={() => setPendingAdd(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '16px', padding: '20px', maxWidth: isMobile ? '100%' : '420px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--c-white)', marginBottom: '14px' }}>{pendingAdd.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--c-666)', marginBottom: '10px' }}>{t('pool_waivers_drop_choice_label')}</div>
            <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer' }}>
                <input type="radio" checked={!dropChoice} onChange={() => setDropChoice(null)} />
                <span style={{ fontSize: '12px', color: 'var(--c-ccc)' }}>{t('pool_waivers_drop_none')}</span>
              </label>
              {myActive.map(r => (
                <label key={itemKey(r)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer' }}>
                  <input type="radio" checked={dropChoice && dropChoice.ref_id === r.ref_id} onChange={() => setDropChoice(r)} />
                  <span style={{ fontSize: '9px', fontWeight: '700', color: POS_COLORS[r.pos_group] }}>{r.pos_group}</span>
                  <span style={{ fontSize: '12px', color: 'var(--c-white)' }}>{r.label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmAdd} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? t('pool_wizard_saving') : t('pool_waivers_add_btn')}</button>
              <button onClick={() => setPendingAdd(null)} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <PlayerDetailModal target={detailTarget} seasonId={seasonId} lang={lang} taken={false} ownerName={null}
          canPick={false} onPick={() => {}} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}


