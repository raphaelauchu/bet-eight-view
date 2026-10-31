// Phase 4B : alignement des pools fantasy (actifs / banc / reserve blesses).
//
// Onglet "Alignement" (pools fantasy uniquement -- jamais affiche pour un pool classique, ni
// avant que le pool soit 'active'). Reutilise les memes conventions visuelles que
// Pool.js/PoolDraftRoom.js/PoolTrades.js (cartes arrondies, orange d'accent, variables
// --c-xxx pour le theme clair/sombre) et les hooks/composants deja construits pour le draft
// (useNhlPlayers -- memes donnees NHL, pour le retro-remplissage paresseux du poste detaille,
// voir note de conception en tete de la migration 20261109).
//
// Deplacement d'un joueur : glisser-deposer natif (HTML5 draggable) sur ordinateur, et
// selection au toucher (clic sur le joueur puis clic sur un poste) sur mobile -- ce deuxieme
// mode fonctionne aussi au clavier/souris sur ordinateur, comme filet de secours.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile, useSaisonCourante } from './Analyses';
import { useNhlPlayers, PlayerAvatar, TeamLogo, headshotUrl, memberLabel, round1 } from './PoolDraftRoom';
import { mirrorEligibleSlots } from './poolRules';

const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '16px' };
const inputStyle = { width: '100%', padding: '10px 12px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '10px', color: 'var(--c-white)', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '11px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' };
const btnSecondary = { padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--c-888)', fontSize: '13px', fontWeight: '600' };
const sectionTitle = (color) => ({ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' });

const ACTIVE_SLOT_KEYS = ['C', 'LW', 'RW', 'D', 'G', 'UTIL'];
const SLOT_COLORS = { C: '#f97316', LW: '#f97316', RW: '#f97316', D: '#3b82f6', G: '#22c55e', UTIL: '#a78bfa', BN: '#888888', IR: '#ef4444' };

function mapLineupError(code, t) {
  let translated = t(code);
  if (translated !== code) return translated;
  const prefixed = `pool_draft_error_${code}`;
  translated = t(prefixed);
  if (translated !== prefixed) return translated;
  return t('pool_draft_error_generic');
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatGameTime(iso, lang) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  } catch { return null; }
}

function nextMondayLabel(lang) {
  const now = new Date();
  const toronto = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const isodow = toronto.getDay() === 0 ? 7 : toronto.getDay();
  let daysUntilMonday = (8 - isodow) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  const target = new Date(toronto);
  target.setDate(toronto.getDate() + daysUntilMonday);
  return target.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ===================== Carte joueur (draggable + selectionnable) =====================

function PlayerCard({ row, seasonId, lang, canEdit, isMobile, selected, onSelect, onDragStart, t }) {
  const label = row.detailed_position || row.pos_group;
  return (
    <div
      draggable={canEdit && !isMobile}
      onDragStart={canEdit && !isMobile ? () => onDragStart(row) : undefined}
      onClick={canEdit ? () => onSelect(row) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px',
        backgroundColor: selected ? 'rgba(249,115,22,0.14)' : 'var(--c-111)',
        border: selected ? '1px solid #f97316' : '1px solid var(--c-1a1a1a)',
        cursor: canEdit ? (isMobile ? 'pointer' : 'grab') : 'default',
      }}>
      <PlayerAvatar src={headshotUrl(row.ref_id, seasonId, row.team_abbrev)} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
          {row.is_locked && <span title={t('pool_lineup_locked_tooltip')} style={{ fontSize: '11px' }}>🔒</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--c-666)' }}>
          <span style={{ color: SLOT_COLORS[label] || 'var(--c-666)', fontWeight: '700' }}>{label}</span>
          {row.team_abbrev && <TeamLogo abbrev={row.team_abbrev} size={12} />}
          {row.next_game_at && (
            <span>{t('pool_lineup_next_game')} {formatGameTime(row.next_game_at, lang)}{row.next_game_opponent ? ` vs ${row.next_game_opponent}` : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== Case de poste (zone de depot) =====================

function SlotBox({ slotKey, title, quota, rows, seasonId, lang, canEdit, isMobile, selectedPlayer, onSelectPlayer, onAssign, dragPlayer, setDragPlayer, t }) {
  const [hover, setHover] = useState(false);
  const occupantCount = rows.length;
  const over = quota != null && occupantCount > quota;

  function eligibleFor(row) { return mirrorEligibleSlots(row.pos_group, row.detailed_position).includes(slotKey); }

  function tryDrop(row) {
    if (!row) return;
    if (!eligibleFor(row)) return;
    onAssign(row, slotKey);
  }

  const canReceiveSelected = selectedPlayer && eligibleFor(selectedPlayer) && !rows.some(r => r.ref_id === selectedPlayer.ref_id && r.kind === selectedPlayer.kind);

  return (
    <div
      onDragOver={e => { if (canEdit) e.preventDefault(); }}
      onDragEnter={() => canEdit && setHover(true)}
      onDragLeave={() => setHover(false)}
      onDrop={() => { setHover(false); if (canEdit) { tryDrop(dragPlayer); setDragPlayer(null); } }}
      onClick={() => { if (canEdit && canReceiveSelected) tryDrop(selectedPlayer); }}
      style={{
        border: `1px dashed ${hover || canReceiveSelected ? '#f97316' : 'var(--c-222)'}`,
        borderRadius: '12px', padding: '10px', minHeight: '58px',
        backgroundColor: hover || canReceiveSelected ? 'rgba(249,115,22,0.06)' : 'transparent',
        cursor: canEdit && canReceiveSelected ? 'pointer' : 'default',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', color: SLOT_COLORS[slotKey] || 'var(--c-666)', textTransform: 'uppercase' }}>{title}</span>
        {quota != null && <span style={{ fontSize: '10px', color: over ? '#ef4444' : 'var(--c-666)' }}>{occupantCount}/{quota}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map(r => (
          <PlayerCard key={`${r.kind}:${r.ref_id}`} row={r} seasonId={seasonId} lang={lang} canEdit={canEdit} isMobile={isMobile}
            selected={selectedPlayer?.ref_id === r.ref_id && selectedPlayer?.kind === r.kind}
            onSelect={onSelectPlayer} onDragStart={setDragPlayer} t={t} />
        ))}
        {rows.length === 0 && <div style={{ fontSize: '11px', color: 'var(--c-333)', padding: '4px 0' }}>{t('pool_lineup_slot_empty')}</div>}
      </div>
    </div>
  );
}

// ===================== Grille complete =====================

function LineupGrid({ rows, roster, seasonId, lang, canEdit, isMobile, selectedPlayer, onSelectPlayer, onAssign, dragPlayer, setDragPlayer, t }) {
  const bySlot = useMemo(() => {
    const map = {};
    for (const r of rows) { const s = r.slot || 'BN'; (map[s] = map[s] || []).push(r); }
    return map;
  }, [rows]);

  const selectedEligible = selectedPlayer ? mirrorEligibleSlots(selectedPlayer.pos_group, selectedPlayer.detailed_position) : null;

  return (
    <div>
      {selectedPlayer && canEdit && (
        <div style={{ ...card, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}>
          <span style={{ fontSize: '12px', color: 'var(--c-ccc)' }}>{t('pool_lineup_selected_player_hint').replace('{name}', selectedPlayer.label)}</span>
          <button onClick={() => onSelectPlayer(null)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: '11px' }}>{t('pool_lineup_cancel_selection')}</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
        {ACTIVE_SLOT_KEYS.filter(k => Number(roster?.[k]) > 0).map(k => (
          <SlotBox key={k} slotKey={k} title={t(`pool_slot_${k}`)} quota={Number(roster[k])} rows={bySlot[k] || []}
            seasonId={seasonId} lang={lang} canEdit={canEdit} isMobile={isMobile}
            selectedPlayer={selectedPlayer} onSelectPlayer={onSelectPlayer} onAssign={onAssign}
            dragPlayer={dragPlayer} setDragPlayer={setDragPlayer} t={t} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
        <SlotBox slotKey="BN" title={t('pool_slot_bench')} quota={null} rows={bySlot.BN || []}
          seasonId={seasonId} lang={lang} canEdit={canEdit} isMobile={isMobile}
          selectedPlayer={selectedPlayer} onSelectPlayer={onSelectPlayer} onAssign={onAssign}
          dragPlayer={dragPlayer} setDragPlayer={setDragPlayer} t={t} />
        <SlotBox slotKey="IR" title={t('pool_slot_ir')} quota={null} rows={bySlot.IR || []}
          seasonId={seasonId} lang={lang} canEdit={canEdit} isMobile={isMobile}
          selectedPlayer={selectedPlayer} onSelectPlayer={onSelectPlayer} onAssign={onAssign}
          dragPlayer={dragPlayer} setDragPlayer={setDragPlayer} t={t} />
      </div>

      {selectedPlayer && canEdit && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--c-666)' }}>
          {t('pool_lineup_eligible_hint')} {selectedEligible.map(s => t(`pool_slot_${s}`)).join(' · ')}
        </div>
      )}
    </div>
  );
}

// ===================== Composant principal =====================

export function PoolLineupTab({ pool, members, utilisateur, lang }) {
  const t = getT(lang);
  const isMobile = useIsMobile();
  const seasonId = useSaisonCourante();
  const { players } = useNhlPlayers(seasonId);
  const myMember = members.find(m => m.user_id === utilisateur.id);
  const isCommissioner = pool.owner_id === utilisateur.id;
  const mode = pool.rules.lineup;
  const roster = pool.rules.roster || {};

  const [selectedMemberId, setSelectedMemberId] = useState(myMember?.id || members[0]?.id);
  const member = members.find(m => m.id === selectedMemberId) || members[0];
  const canEdit = !!member && (member.id === myMember?.id || isCommissioner);

  const [selectedDay, setSelectedDay] = useState(todayStr);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [dragPlayer, setDragPlayer] = useState(null);
  const backfillAttempted = useRef(new Set());

  const pAt = useMemo(() => {
    if (mode !== 'daily' || selectedDay === todayStr()) return null;
    return new Date(`${selectedDay}T12:00:00`).toISOString();
  }, [mode, selectedDay]);

  async function load() {
    if (!member?.id) return;
    setError('');
    const params = { p_pool_id: pool.id, p_member_id: member.id };
    if (pAt) params.p_at = pAt;
    const { data, error: err } = await supabase.rpc('get_lineup', params);
    if (err) { setError(mapLineupError(err.message, t)); setRows([]); return; }
    setRows(data || []);
  }

  useEffect(() => { setRows(null); setSelectedPlayer(null); load(); }, [pool.id, member?.id, pAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retro-remplissage paresseux du poste detaille (voir migration 20261109) : reutilise les
  // donnees NHL deja chargees par useNhlPlayers (aucun nouvel appel reseau), une seule
  // tentative par pool par session pour eviter une boucle si l'ecriture echoue (RLS, etc.).
  useEffect(() => {
    if (!rows || !rows.length || !players.length) return;
    if (backfillAttempted.current.has(pool.id)) return;
    const missing = rows.filter(r => !r.detailed_position);
    if (!missing.length) return;
    const byId = new Map(players.map(p => [p.id, p.posReel]));
    const assignments = missing
      .map(r => ({ player_id: r.ref_id, detailed_position: byId.get(r.ref_id) }))
      .filter(a => a.detailed_position);
    if (!assignments.length) return;
    backfillAttempted.current.add(pool.id);
    supabase.rpc('backfill_detailed_positions', { p_pool_id: pool.id, p_assignments: assignments }).then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, players]);

  useEffect(() => {
    if (!member?.id) return;
    const channel = supabase.channel(`pool_lineup_${pool.id}_${member.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_lineup_periods', filter: `pool_id=eq.${pool.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.id, member?.id]);

  async function assign(row, slot) {
    if (!canEdit || mode === 'fixed' || busy) return;
    setBusy(true); setError(''); setSuccessMsg(''); setSelectedPlayer(null); setDragPlayer(null);
    const { error: err } = await supabase.rpc('set_lineup', {
      p_pool_id: pool.id, p_member_id: member.id,
      p_assignments: [{ kind: row.kind, player_id: row.ref_id, slot }],
    });
    setBusy(false);
    if (err) { setError(mapLineupError(err.message, t)); return; }
    setSuccessMsg(mode === 'weekly' ? t('pool_lineup_saved_weekly_notice').replace('{date}', nextMondayLabel(lang)) : t('pool_lineup_saved_notice'));
    load();
  }

  async function autoFill() {
    if (!canEdit || mode === 'fixed' || busy) return;
    setBusy(true); setError(''); setSuccessMsg('');
    const { error: err } = await supabase.rpc('auto_fill_lineup', { p_pool_id: pool.id, p_member_id: member.id });
    setBusy(false);
    if (err) { setError(mapLineupError(err.message, t)); return; }
    setSuccessMsg(mode === 'weekly' ? t('pool_lineup_saved_weekly_notice').replace('{date}', nextMondayLabel(lang)) : t('pool_lineup_saved_notice'));
    load();
  }

  if (!member) return null;

  return (
    <div>
      {members.length > 1 && (
        <select value={member.id} onChange={e => setSelectedMemberId(e.target.value)} style={{ ...inputStyle, fontWeight: '700', marginBottom: '12px' }}>
          {members.map(m => <option key={m.id} value={m.id}>{memberLabel(m, pool.rules)}</option>)}
        </select>
      )}

      {mode === 'fixed' && (
        <div style={{ ...card, marginBottom: '12px', border: '1px solid var(--c-222)' }}>
          <div style={sectionTitle('var(--c-666)')}>{t('pool_lineup_fixed_title')}</div>
          <div style={{ fontSize: '12px', color: 'var(--c-888)' }}>{t('pool_lineup_fixed_notice')}</div>
        </div>
      )}

      {mode === 'weekly' && canEdit && (
        <div style={{ ...card, marginBottom: '12px', backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontSize: '12px', color: '#3b82f6' }}>{t('pool_lineup_weekly_notice').replace('{date}', nextMondayLabel(lang))}</div>
        </div>
      )}

      {mode === 'daily' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
          {selectedDay !== todayStr() && <span style={{ fontSize: '11px', color: 'var(--c-666)' }}>{t('pool_lineup_daily_viewing_other_day')}</span>}
        </div>
      )}

      {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
      {successMsg && <div style={{ color: '#22c55e', fontSize: '13px', marginBottom: '10px' }}>{successMsg}</div>}

      {canEdit && mode !== 'fixed' && (selectedDay === todayStr() || mode !== 'daily') && (
        <button onClick={autoFill} disabled={busy} style={{ ...btnPrimary, width: '100%', marginBottom: '12px', opacity: busy ? 0.6 : 1 }}>
          {t('pool_lineup_autofill_btn')}
        </button>
      )}

      {rows === null ? (
        <div style={{ color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '10px 0' }}>{t('pool_draft_no_picks_yet')}</div>
      ) : (
        <LineupGrid rows={rows} roster={roster} seasonId={seasonId} lang={lang}
          canEdit={canEdit && mode !== 'fixed' && (mode !== 'daily' || selectedDay === todayStr())}
          isMobile={isMobile} selectedPlayer={selectedPlayer} onSelectPlayer={setSelectedPlayer} onAssign={assign}
          dragPlayer={dragPlayer} setDragPlayer={setDragPlayer} t={t} />
      )}
    </div>
  );
}
