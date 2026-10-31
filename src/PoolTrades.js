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
import { validateTrade } from './poolRules';
import {
  useNhlPlayers, useNhlTeams, PlayerAvatar, TeamLogo, PlayerDetailModal,
  calculerValeurIA, posReelToPickPosition, memberLabel, round1, headshotUrl,
} from './PoolDraftRoom';

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

// ===================== Onglet "Echanges" =====================

export function PoolTradesTab({ pool, members, utilisateur, lang, isCommissioner }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const myMember = members.find(m => m.user_id === utilisateur.id);
  const otherMembers = members.filter(m => m.id !== myMember?.id);

  const [partnerId, setPartnerId] = useState(otherMembers[0]?.id || null);
  const [givesIds, setGivesIds] = useState(new Set());
  const [receivesIds, setReceivesIds] = useState(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [detailTarget, setDetailTarget] = useState(null);

  const { rows: myRows } = useMemberRoster(pool.id, myMember?.id);
  const { rows: partnerRows } = useMemberRoster(pool.id, partnerId);
  const { trades, items, loading: historyLoading, reload: reloadHistory, historyFor } = useTradeHistory(pool.id);
  const [counters, setCounters] = useState(null);

  async function reloadCounters() {
    const { data } = await supabase.rpc('get_transaction_counters', { p_pool_id: pool.id, p_member_id: myMember.id });
    setCounters((data || [])[0] || null);
  }
  useEffect(() => { if (myMember?.id) reloadCounters(); }, [myMember?.id, trades]); // eslint-disable-line react-hooks/exhaustive-deps

  const myActive = useMemo(() => (myRows || []).filter(r => r.is_active), [myRows]);
  const partnerActive = useMemo(() => (partnerRows || []).filter(r => r.is_active), [partnerRows]);

  function toggle(setFn, key) {
    setFn(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  useEffect(() => { setGivesIds(new Set()); setReceivesIds(new Set()); setError(''); setSuccessMsg(''); }, [partnerId]);

  const givesItems = myActive.filter(r => givesIds.has(itemKey(r)));
  const receivesItems = partnerActive.filter(r => receivesIds.has(itemKey(r)));

  const preview = useMemo(() => {
    if (!myMember || !partnerId || givesItems.length === 0 || receivesItems.length === 0) return null;
    const toWordRoster = (rows) => rows.map(r => ({ id: r.ref_id, positionGroup: POS_GROUP_TO_WORD[r.pos_group] || 'forward', salary: Number(r.salary) || 0 }));
    const history = historyFor(myMember.id, partnerId);
    return validateTrade(
      pool.rules,
      toWordRoster(myActive), toWordRoster(partnerActive),
      toWordRoster(givesItems), toWordRoster(receivesItems),
      history
    );
  }, [myMember, partnerId, givesItems, receivesItems, myActive, partnerActive, pool.rules, historyFor]);

  const capEnabled = !!pool.rules?.salaryCap?.enabled;
  const mySalaryAfter = (myActive.reduce((s, r) => s + (Number(r.salary) || 0), 0)) - givesItems.reduce((s, r) => s + (Number(r.salary) || 0), 0) + receivesItems.reduce((s, r) => s + (Number(r.salary) || 0), 0);
  const partnerSalaryAfter = (partnerActive.reduce((s, r) => s + (Number(r.salary) || 0), 0)) - receivesItems.reduce((s, r) => s + (Number(r.salary) || 0), 0) + givesItems.reduce((s, r) => s + (Number(r.salary) || 0), 0);
  const capAmount = Number(pool.rules?.salaryCap?.amount) || 0;

  async function submitTrade() {
    setBusy(true); setError(''); setSuccessMsg('');
    const gives = givesItems.map(r => ({ kind: r.kind, player_id: r.ref_id }));
    const receives = receivesItems.map(r => ({ kind: r.kind, player_id: r.ref_id }));
    const { error: err } = await supabase.rpc('propose_trade', {
      p_pool_id: pool.id, p_to_member_id: partnerId, p_gives: gives, p_receives: receives, p_message: message.trim() || null,
    });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    setSuccessMsg(t('pool_trade_proposed_success'));
    setGivesIds(new Set()); setReceivesIds(new Set()); setMessage('');
    reloadHistory();
  }

  if (!pool.rules?.trades?.enabled) {
    return <div style={{ ...card, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_trades_disabled_notice')}</div>;
  }
  const readOnly = pool.status !== 'active';

  const received = trades.filter(tr => tr.recipient_member_id === myMember?.id && tr.status === 'pending');
  const sent = trades.filter(tr => tr.proposer_member_id === myMember?.id && ['pending', 'pending_commissioner'].includes(tr.status));
  const commissionerQueue = isCommissioner ? trades.filter(tr => tr.status === 'pending_commissioner') : [];
  const history = trades.filter(tr => ['accepted', 'declined', 'cancelled', 'rejected'].includes(tr.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {readOnly && <div style={{ ...card, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_trades_readonly_notice')}</div>}

      {counters && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ ...card, flex: 1, textAlign: 'center', padding: '10px' }}>
            <div style={{ fontSize: '9px', color: 'var(--c-666)', textTransform: 'uppercase' }}>{t('pool_trades_counter_trades')}</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--c-white)' }}>{counters.trades_used}{counters.trades_max != null ? ` / ${counters.trades_max}` : ''}</div>
          </div>
        </div>
      )}

      {!readOnly && otherMembers.length > 0 && (
        <div style={card}>
          <div style={sectionTitle('#f97316')}>{t('pool_trades_propose_title')}</div>
          <select value={partnerId || ''} onChange={e => setPartnerId(e.target.value)} style={{ ...inputStyle, marginBottom: '12px', fontWeight: '700' }}>
            {otherMembers.map(m => <option key={m.id} value={m.id}>{memberLabel(m, pool.rules)}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--c-666)', fontWeight: '700', marginBottom: '6px' }}>{t('pool_trades_my_roster')}</div>
              <RosterCheckboxList rows={myActive} selected={givesIds} onToggle={k => toggle(setGivesIds, k)} capEnabled={capEnabled} seasonId={seasonId} onOpenDetail={setDetailTarget} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--c-666)', fontWeight: '700', marginBottom: '6px' }}>{t('pool_trades_their_roster')}</div>
              {partnerId ? (
                <RosterCheckboxList rows={partnerActive} selected={receivesIds} onToggle={k => toggle(setReceivesIds, k)} capEnabled={capEnabled} seasonId={seasonId} onOpenDetail={setDetailTarget} />
              ) : (
                <div style={{ color: 'var(--c-555)', fontSize: '12px' }}>{t('pool_trades_pick_partner')}</div>
              )}
            </div>
          </div>

          {capEnabled && (givesItems.length > 0 || receivesItems.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px', fontSize: '11px' }}>
              <div style={{ color: mySalaryAfter > capAmount ? '#ef4444' : 'var(--c-666)' }}>{t('pool_trades_salary_after')} {mySalaryAfter.toLocaleString()} $ / {capAmount.toLocaleString()} $</div>
              <div style={{ color: partnerSalaryAfter > capAmount ? '#ef4444' : 'var(--c-666)' }}>{t('pool_trades_salary_after')} {partnerSalaryAfter.toLocaleString()} $ / {capAmount.toLocaleString()} $</div>
            </div>
          )}

          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('pool_trades_message_ph')}
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', marginBottom: '10px' }} />

          {preview && !preview.ok && (
            <div style={{ marginBottom: '10px' }}>
              {preview.errors.map(code => (
                <div key={code} style={{ fontSize: '12px', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '8px', padding: '7px 10px', marginBottom: '4px' }}>
                  {mapTradeError(code, t)}
                </div>
              ))}
            </div>
          )}
          {error && <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '10px' }}>{error}</div>}
          {successMsg && <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '10px' }}>{successMsg}</div>}

          <button onClick={submitTrade} disabled={busy || !preview?.ok} style={{ ...btnPrimary, width: '100%', opacity: (busy || !preview?.ok) ? 0.5 : 1 }}>
            {busy ? t('pool_wizard_saving') : t('pool_trades_propose_btn')}
          </button>
        </div>
      )}

      {received.length > 0 && (
        <TradeListCard title={t('pool_trades_received_title')} trades={received} items={items} members={members} pool={pool} lang={lang}
          renderActions={tr => <RespondActions trade={tr} t={t} onDone={reloadHistory} />} />
      )}

      {sent.length > 0 && (
        <TradeListCard title={t('pool_trades_sent_title')} trades={sent} items={items} members={members} pool={pool} lang={lang}
          renderActions={tr => <CancelAction trade={tr} t={t} onDone={reloadHistory} />} />
      )}

      {commissionerQueue.length > 0 && (
        <TradeListCard title={t('pool_trades_commissioner_queue_title')} trades={commissionerQueue} items={items} members={members} pool={pool} lang={lang}
          renderActions={tr => <ReviewActions trade={tr} t={t} onDone={reloadHistory} />} />
      )}

      <TradeListCard title={t('pool_trades_history_title')} trades={history} items={items} members={members} pool={pool} lang={lang}
        loading={historyLoading} emptyKey="pool_trades_history_empty" />

      {detailTarget && (
        <PlayerDetailModal target={detailTarget} seasonId={seasonId} lang={lang} taken={false} ownerName={null}
          canPick={false} onPick={() => {}} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}

function RosterCheckboxList({ rows, selected, onToggle, capEnabled, seasonId, onOpenDetail }) {
  if (rows.length === 0) return <div style={{ color: 'var(--c-333)', fontSize: '12px' }}>—</div>;
  return (
    <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--c-161616)', borderRadius: '10px', padding: '6px' }}>
      {rows.map(r => {
        const key = itemKey(r);
        const isTeam = r.kind === 'team';
        return (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.has(key)} onChange={() => onToggle(key)} />
            {isTeam ? <TeamLogo abbrev={r.ref_id} size={22} /> : <PlayerAvatar src={headshotUrl(r.ref_id, seasonId, r.team_abbrev)} size={22} />}
            <span style={{ fontSize: '9px', fontWeight: '700', color: POS_COLORS[r.pos_group], flexShrink: 0 }}>{r.pos_group}</span>
            <span onClick={(e) => { e.preventDefault(); onOpenDetail({ kind: r.kind, id: r.ref_id, name: r.label, team: r.team_abbrev, posReel: r.pos_group === 'D' ? 'D' : r.pos_group === 'G' ? 'G' : 'C' }); }}
              style={{ flex: 1, fontSize: '12px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent' }}>
              {r.label}
            </span>
            {capEnabled && r.salary > 0 && <span style={{ fontSize: '9px', color: 'var(--c-666)', flexShrink: 0 }}>{Number(r.salary).toLocaleString()} $</span>}
          </label>
        );
      })}
    </div>
  );
}

function TradeListCard({ title, trades, items, members, pool, lang, renderActions, loading, emptyKey }) {
  const t = getT(lang);
  if (loading) return <div style={card}><div style={{ color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_loading_generic')}</div></div>;
  return (
    <div style={card}>
      <div style={sectionTitle('var(--c-666)')}>{title}</div>
      {trades.length === 0 ? (
        <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '6px 0' }}>{emptyKey ? t(emptyKey) : t('pool_draft_no_picks_yet')}</div>
      ) : (
        trades.map(tr => {
          const proposer = members.find(m => m.id === tr.proposer_member_id);
          const recipient = members.find(m => m.id === tr.recipient_member_id);
          const tradeItems = items.filter(it => it.trade_id === tr.id);
          const givesItems = tradeItems.filter(it => it.from_member_id === tr.proposer_member_id);
          const receivesItems = tradeItems.filter(it => it.from_member_id === tr.recipient_member_id);
          return (
            <div key={tr.id} style={{ borderTop: '1px solid var(--c-161616)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ fontSize: '12px', color: 'var(--c-888)' }}>
                  <strong style={{ color: 'var(--c-white)' }}>{memberLabel(proposer, pool.rules)}</strong> ⇄ <strong style={{ color: 'var(--c-white)' }}>{memberLabel(recipient, pool.rules)}</strong>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#f97316', textTransform: 'uppercase' }}>{t(`pool_trade_status_${tr.status}`)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--c-666)' }}>
                <div>{givesItems.map(it => it.player_name).join(', ') || '—'}</div>
                <div>{receivesItems.map(it => it.player_name).join(', ') || '—'}</div>
              </div>
              {tr.message && <div style={{ fontSize: '11px', color: 'var(--c-555)', marginTop: '6px', fontStyle: 'italic' }}>"{tr.message}"</div>}
              {renderActions && <div style={{ marginTop: '8px' }}>{renderActions(tr)}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}

function RespondActions({ trade, t, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function respond(accept) {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('respond_trade', { p_trade_id: trade.id, p_accept: accept });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    onDone();
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => respond(true)} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1 }}>{t('pool_trades_accept_btn')}</button>
        <button onClick={() => respond(false)} disabled={busy} style={btnSecondary}>{t('pool_trades_decline_btn')}</button>
      </div>
      {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px' }}>{error}</div>}
    </div>
  );
}

function CancelAction({ trade, t, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('cancel_trade', { p_trade_id: trade.id });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    onDone();
  }
  return (
    <div>
      <button onClick={cancel} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>{t('pool_trades_cancel_btn')}</button>
      {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px' }}>{error}</div>}
    </div>
  );
}

function ReviewActions({ trade, t, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function review(approve) {
    setBusy(true); setError('');
    const { error: err } = await supabase.rpc('review_trade', { p_trade_id: trade.id, p_approve: approve });
    setBusy(false);
    if (err) { setError(mapTradeError(err.message, t)); return; }
    onDone();
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => review(true)} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1 }}>{t('pool_trades_approve_btn')}</button>
        <button onClick={() => review(false)} disabled={busy} style={btnSecondary}>{t('pool_trades_reject_btn')}</button>
      </div>
      {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px' }}>{error}</div>}
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

  const filteredPlayers = useMemo(() => {
    if (!takenIds) return [];
    const q = search.trim().toLowerCase();
    return playersWithValue
      .filter(p => {
        if (takenIds.has(`player:${p.id}`)) return false;
        if (posFilter !== 'ALL' && posFilter !== 'TEAM' && posReelToPickPosition(p.posReel) !== posFilter) return false;
        if (q && !p.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.valeurIA - a.valeurIA);
  }, [playersWithValue, posFilter, search, takenIds]);

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
          </div>

          {error && <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '10px' }}>{error}</div>}
          {successMsg && <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '10px' }}>{successMsg}</div>}

          {posFilter === 'TEAM' ? (
            teamsLoading || !takenIds ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-444)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
            ) : filteredTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('pool_draft_no_players_found')}</div>
            ) : (
              filteredTeams.map(tm => (
                <FreeAgentRow key={tm.abbrev} isTeam onOpenDetail={() => setDetailTarget({ kind: 'team', id: tm.abbrev, name: tm.name, rank: tm.rank })}
                  content={<><TeamLogo abbrev={tm.abbrev} size={32} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)' }}>{tm.name}</div><div style={{ fontSize: '10px', color: 'var(--c-555)' }}>{tm.abbrev}</div></div></>}
                  onAdd={() => requestAdd(tm, 'team')} t={t} />
              ))
            )
          ) : playersLoading || !takenIds ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-444)', fontSize: '13px' }}>{t('pool_draft_loading_players')}</div>
          ) : playersError ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#ef4444', fontSize: '13px' }}>{t('pool_draft_load_error')}</div>
          ) : filteredPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('pool_draft_no_players_found')}</div>
          ) : (
            <>
              {filteredPlayers.slice(0, nbShown).map(j => {
                const win = waiverWindowFor('player', j.id);
                return (
                  <FreeAgentRow key={j.id} onOpenDetail={() => setDetailTarget({ kind: 'player', id: j.id, name: j.name, team: j.team, posReel: j.posReel })}
                    content={
                      <>
                        <PlayerAvatar src={headshotUrl(j.id, seasonId, j.team)} size={32} />
                        <span style={{ fontSize: '10px', fontWeight: '700', color: POS_COLORS[posReelToPickPosition(j.posReel)], backgroundColor: 'var(--c-111)', borderRadius: '6px', padding: '3px 7px', flexShrink: 0 }}>{j.posReel}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--c-555)' }}>
                            {j.team} · {j.posGroup === 'goalie' ? `${j.wins}V` : `${j.points} PTS`}
                            {win && <span style={{ color: '#f97316' }}> · {t('pool_waivers_until')} {new Date(win.available_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US')}</span>}
                          </div>
                        </div>
                      </>
                    }
                    onAdd={() => requestAdd(j, 'player')} t={t} />
                );
              })}
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

function FreeAgentRow({ content, onAdd, onOpenDetail, isTeam, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-161616)', borderRadius: '12px', padding: '10px 12px', marginBottom: '6px' }}>
      <div onClick={onOpenDetail} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', minWidth: 0 }}>{content}</div>
      <button onClick={onAdd} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
        {t('pool_waivers_add_btn')}
      </button>
    </div>
  );
}

