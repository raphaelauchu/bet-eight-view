import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile, useSaisonCourante, LOGOS_NHL } from './Analyses';
import {
  computePicksPerMember, computeRosterQuota, computeCurrentMemberId, PICK_POSITIONS,
} from './poolRules';

// ===================== Styles (memes conventions que Pool.js) =====================
const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '16px' };
const inputStyle = { width: '100%', padding: '10px 12px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '10px', color: 'var(--c-white)', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '11px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' };
const btnSecondary = { padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--c-888)', fontSize: '13px', fontWeight: '600' };
const sectionTitle = (color) => ({ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' });
const POS_COLORS = { F: '#f97316', D: '#3b82f6', G: '#22c55e', TEAM: '#a78bfa' };

function round1(n) { return Math.round(n * 10) / 10; }

function mapPosGroup(code) {
  if (code === 'D') return 'defense';
  if (code === 'G') return 'goalie';
  return 'forward';
}
function mapPosReel(code) {
  if (code === 'L') return 'LW';
  if (code === 'R') return 'RW';
  if (code === 'D') return 'D';
  if (code === 'G') return 'G';
  return 'C';
}
// Position coarse ('F'|'D'|'G'|'TEAM') utilisee dans pool_picks / les quotas de roster.
function posReelToPickPosition(posReel) {
  if (posReel === 'D') return 'D';
  if (posReel === 'G') return 'G';
  return 'F';
}

function getStatsUrl(fullUrl) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  return estEnProduction ? `/api/nhl?path=${encodeURIComponent(fullUrl)}` : fullUrl;
}

// Valeur IA : utilise les memes categories que l'assistant solo PoolDraft.js (buts, passes,
// points en avantage numerique, tirs, +/- pour les patineurs ; victoires, blanchissages,
// arrets pour les gardiens), exactement celles disponibles via l'API NHL publique utilisee
// ici. Les categories sans donnee disponible (mises en echec, tirs bloques, penalites, buts
// vainqueurs, toutes les stats d'equipe) contribuent 0 pour l'instant - aucune source de
// donnees NHL publique ne les fournit via cet endpoint.
function calculerValeurIA(player, rules) {
  if (!rules) return 0;
  if (player.posGroup === 'goalie') {
    const p = rules.scoring.goalie;
    return round1((player.wins || 0) * (p.wins || 0) + (player.shutouts || 0) * (p.shutouts || 0) + (player.saves || 0) * (p.saves || 0));
  }
  if (player.posGroup === 'team') return 0;
  const p = player.posGroup === 'defense' ? rules.scoring.defense : rules.scoring.forward;
  return round1(
    (player.goals || 0) * (p.goals || 0) + (player.assists || 0) * (p.assists || 0)
    + (player.ppPoints || 0) * (p.powerPlayPoints || 0) + (player.shots || 0) * (p.shotsOnGoal || 0)
    + (player.plusMinus || 0) * (p.plusMinus || 0)
  );
}

function construirJoueurManuel(nom, positionCode, equipe, idConnu) {
  const estGardien = positionCode === 'G';
  return {
    id: idConnu ? String(idConnu) : `manual-${Date.now()}`,
    name: nom, team: equipe, positionCode,
    posGroup: estGardien ? 'goalie' : mapPosGroup(positionCode),
    posReel: estGardien ? 'G' : mapPosReel(positionCode),
    manual: true,
    gamesPlayed: 0, goals: 0, assists: 0, points: 0, plusMinus: 0, shots: 0, ppPoints: 0,
    wins: 0, shutouts: 0, saves: 0, savePct: 0,
  };
}

function useNhlPlayers(seasonId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(false);
      try {
        const [resSum, resGoal] = await Promise.all([
          fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=${seasonId}&limit=-1`)),
          fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/goalie/summary?cayenneExp=seasonId=${seasonId}&limit=-1`)),
        ]);
        const [dataSum, dataGoal] = await Promise.all([resSum.json(), resGoal.json()]);
        const skaters = (dataSum.data || []).map(s => ({
          id: String(s.playerId), name: s.skaterFullName, team: s.teamAbbrevs,
          positionCode: s.positionCode, posGroup: mapPosGroup(s.positionCode), posReel: mapPosReel(s.positionCode),
          gamesPlayed: s.gamesPlayed || 0, goals: s.goals || 0, assists: s.assists || 0, points: s.points || 0,
          plusMinus: s.plusMinus || 0, shots: s.shots || 0, ppPoints: s.ppPoints || 0,
        }));
        const goalies = (dataGoal.data || []).map(g => ({
          id: String(g.playerId), name: g.goalieFullName, team: g.teamAbbrevs,
          positionCode: 'G', posGroup: 'goalie', posReel: 'G',
          gamesPlayed: g.gamesPlayed || 0, wins: g.wins || 0, shutouts: g.shutouts || 0, saves: g.saves || 0, savePct: g.savePct || 0,
        }));
        if (!cancelled) { setPlayers([...skaters, ...goalies].sort((a, b) => a.name.localeCompare(b.name))); setLoading(false); }
      } catch { if (!cancelled) { setError(true); setLoading(false); } }
    }
    load();
    return () => { cancelled = true; };
  }, [seasonId]);

  return { players, setPlayers, loading, error };
}

function mapPickError(code, t) {
  const key = `pool_draft_error_${code}`;
  const translated = t(key);
  return translated !== key ? translated : t('pool_draft_error_generic');
}

// ===================== Salle d'attente (status = 'setup') =====================

export function DraftWaitingRoom({ pool, members, lang, isCommissioner, onStartDraft, startBusy, startError }) {
  const t = getT(lang);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '6px' }}>{t('pool_draft_waiting_title')}</div>
      <div style={{ fontSize: '13px', color: 'var(--c-666)', marginBottom: '16px' }}>{t('pool_draft_waiting_sub')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '280px', margin: '0 auto 16px' }}>
        {members.map(m => (
          <div key={m.id} style={{ backgroundColor: 'var(--c-111)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--c-white)' }}>
            {m.display_name || m.team_name}
          </div>
        ))}
      </div>
      {pool.rules?.draft?.scheduledAt && (
        <div style={{ fontSize: '12px', color: 'var(--c-888)', marginBottom: '16px' }}>
          {t('pool_draft_scheduled_at')} : {new Date(pool.rules.draft.scheduledAt).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
        </div>
      )}
      {isCommissioner && (
        confirmOpen ? (
          <div style={{ maxWidth: '360px', margin: '0 auto' }}>
            <div style={{ fontSize: '12px', color: '#f97316', marginBottom: '10px' }}>{t('pool_draft_start_confirm')}</div>
            {startError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px' }}>{startError}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmOpen(false)} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
              <button onClick={() => onStartDraft()} disabled={startBusy} style={{ ...btnPrimary, flex: 1, opacity: startBusy ? 0.6 : 1 }}>
                {startBusy ? t('pool_wizard_saving') : t('pool_draft_start_btn')}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmOpen(true)} style={btnPrimary}>{t('pool_draft_start_btn')}</button>
        )
      )}
      {!isCommissioner && <div style={{ fontSize: '12px', color: 'var(--c-555)' }}>{t('pool_draft_waiting_non_commissioner')}</div>}
    </div>
  );
}

// ===================== Panneau "Mon equipe" (reutilise dans l'onglet dedie et dans la salle de draft) =====================

export function TeamRosterPanel({ pool, members, picks, lang, viewedMemberId, setViewedMemberId }) {
  const t = getT(lang);
  const member = members.find(m => m.id === viewedMemberId) || members[0];
  const memberPicks = picks.filter(p => p.member_id === member?.id);
  const capEnabled = !!pool.rules?.salaryCap?.enabled;
  const salaryUsed = memberPicks.reduce((s, p) => s + (Number(p.salary) || 0), 0);
  const capAmount = Number(pool.rules?.salaryCap?.amount) || 0;

  const quotaRows = useMemo(() => {
    if (pool.rules.poolType === 'classic') {
      return [
        { pos: 'F', labelKey: 'pool_slot_forwards', used: memberPicks.filter(p => p.position === 'F').length, quota: computeRosterQuota(pool.rules, 'F') },
        { pos: 'D', labelKey: 'pool_slot_defense', used: memberPicks.filter(p => p.position === 'D').length, quota: computeRosterQuota(pool.rules, 'D') },
        { pos: 'G', labelKey: 'pool_slot_goalies', used: memberPicks.filter(p => p.position === 'G').length, quota: computeRosterQuota(pool.rules, 'G') },
        { pos: 'TEAM', labelKey: 'pool_recap_team_picks', used: memberPicks.filter(p => p.position === 'TEAM').length, quota: computeRosterQuota(pool.rules, 'TEAM') },
      ];
    }
    return [
      { pos: 'F', labelKey: 'pool_draft_skaters', used: memberPicks.filter(p => p.position === 'F' || p.position === 'D').length, quota: computeRosterQuota(pool.rules, 'F') },
      { pos: 'G', labelKey: 'pool_slot_G', used: memberPicks.filter(p => p.position === 'G').length, quota: computeRosterQuota(pool.rules, 'G') },
      { pos: 'TEAM', labelKey: 'pool_recap_team_picks', used: memberPicks.filter(p => p.position === 'TEAM').length, quota: computeRosterQuota(pool.rules, 'TEAM') },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberPicks, pool.rules]);

  return (
    <div style={card}>
      <select value={member?.id || ''} onChange={e => setViewedMemberId(e.target.value)}
        style={{ ...inputStyle, fontWeight: '700', marginBottom: '10px' }}>
        {members.map(m => <option key={m.id} value={m.id}>{m.display_name || m.team_name}</option>)}
      </select>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {quotaRows.map(r => (
          <div key={r.pos} style={{ backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center', flex: 1, minWidth: '56px' }}>
            <div style={{ fontSize: '9px', color: POS_COLORS[r.pos], fontWeight: '700' }}>{t(r.labelKey)}</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-white)' }}>{r.used}/{r.quota}</div>
          </div>
        ))}
      </div>

      {capEnabled && (
        <div style={{ backgroundColor: 'var(--c-111)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: 'var(--c-666)' }}>{t('pool_draft_salary_used')}</div>
          <div style={{ fontSize: '13px', fontWeight: '900', color: salaryUsed > capAmount ? '#ef4444' : '#22c55e' }}>
            {salaryUsed.toLocaleString()} $ / {capAmount.toLocaleString()} $
          </div>
        </div>
      )}

      {memberPicks.length === 0 ? (
        <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '10px 0' }}>{t('pool_draft_no_picks_yet')}</div>
      ) : (
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {memberPicks.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid var(--c-161616)' }}>
              <span style={{ fontSize: '10px', color: 'var(--c-444)', minWidth: '18px' }}>{p.pick_no || '—'}</span>
              <span style={{ fontSize: '9px', fontWeight: '700', color: POS_COLORS[p.position] }}>{p.position}</span>
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.player_name}</span>
              {capEnabled && p.salary > 0 && <span style={{ fontSize: '10px', color: 'var(--c-666)' }}>{Number(p.salary).toLocaleString()} $</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Tableau du draft =====================

export function DraftBoard({ pool, members, picks, lang }) {
  const t = getT(lang);
  const picksPerMember = computePicksPerMember(pool.rules);
  const order = pool.draft_state?.order || members.map(m => m.id);
  const rounds = Math.max(1, Math.ceil((pool.draft_state?.total_picks || picksPerMember * members.length) / Math.max(1, members.length)));

  function pickFor(round, memberId) {
    return picks.find(p => p.round === round && p.member_id === memberId && p.pick_no != null);
  }

  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <div style={sectionTitle('var(--c-666)')}>{t('pool_draft_board_title')}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${(order.length + 1) * 110}px` }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', color: 'var(--c-555)' }}>{t('pool_draft_round_label')}</th>
            {order.map(mid => {
              const m = members.find(x => x.id === mid);
              return <th key={mid} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', color: 'var(--c-888)', whiteSpace: 'nowrap' }}>{m?.display_name || m?.team_name || '?'}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rounds }).map((_, i) => {
            const r = i + 1;
            return (
              <tr key={r} style={{ borderTop: '1px solid var(--c-161616)' }}>
                <td style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--c-555)', fontWeight: '700' }}>{r}</td>
                {order.map(mid => {
                  const pick = pickFor(r, mid);
                  return (
                    <td key={mid} style={{ padding: '6px 8px', fontSize: '11px', color: pick ? 'var(--c-white)' : 'var(--c-333)' }}>
                      {pick ? pick.player_name : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===================== Salle de draft en direct =====================

export default function PoolDraftRoom({ pool, members, picks, utilisateur, lang, isCommissioner, onAction }) {
  const t = getT(lang);
  const isMobile = useIsMobile();
  const seasonId = useSaisonCourante();
  const { players, setPlayers, loading, error } = useNhlPlayers(seasonId);

  const myMember = members.find(m => m.user_id === utilisateur.id);
  const [viewedMemberId, setViewedMemberId] = useState(myMember?.id || members[0]?.id);
  useEffect(() => { if (!viewedMemberId && members[0]) setViewedMemberId(myMember?.id || members[0].id); }, [members, myMember, viewedMemberId]);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [posFilter, setPosFilter] = useState('ALL');
  const [nbShown, setNbShown] = useState(50);
  const [manualAdd, setManualAdd] = useState(null);
  const [pendingPick, setPendingPick] = useState(null); // joueur/equipe en attente de confirmation
  const [salaryInput, setSalaryInput] = useState('0');
  const [pickForMemberId, setPickForMemberId] = useState(null); // mode "choisir pour un absent" (commissaire)
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const draftState = pool.draft_state || {};
  const order = draftState.order || [];
  const currentPick = draftState.current_pick || 0;
  const totalPicks = draftState.total_picks || 0;
  const paused = !!draftState.paused;
  const deadline = draftState.pick_deadline ? new Date(draftState.pick_deadline).getTime() : null;
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const draftType = pool.rules.draft.type;
  const draftFinished = pool.status === 'active';
  const currentMemberId = computeCurrentMemberId(order, currentPick, draftType);
  const currentMember = members.find(m => m.id === currentMemberId);
  const nextMemberId = computeCurrentMemberId(order, currentPick + 1, draftType);
  const nextMember = members.find(m => m.id === nextMemberId);
  const isMyTurn = !draftFinished && !paused && currentMember && myMember && currentMember.id === myMember.id;
  const round = order.length ? Math.min(Math.ceil(currentPick / order.length), Math.ceil(totalPicks / order.length)) : 1;
  const totalRounds = order.length ? Math.ceil(totalPicks / order.length) : 1;

  const takenPlayerIds = useMemo(() => new Set(picks.filter(p => p.kind === 'player').map(p => p.player_id)), [picks]);
  const takenTeamIds = useMemo(() => new Set(picks.filter(p => p.kind === 'team').map(p => p.player_id)), [picks]);

  const playersWithValue = useMemo(() => players.map(p => ({ ...p, valeurIA: calculerValeurIA(p, pool.rules) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, pool.rules]);

  const idsRecherche = useMemo(() => new Set(searchResults.map(r => String(r.playerId))), [searchResults]);
  const searchActive = search.trim().length >= 2;
  const filteredPlayers = useMemo(() => {
    return playersWithValue
      .filter(p => {
        if (posFilter !== 'ALL' && posReelToPickPosition(p.posReel) !== posFilter) return false;
        if (searchActive && !idsRecherche.has(p.id)) return false;
        return true;
      })
      .sort((a, b) => b.valeurIA - a.valeurIA);
  }, [playersWithValue, posFilter, searchActive, idsRecherche]);

  async function runSearch(q) {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=${lang === 'fr' ? 'fr-CA' : 'en-US'}&limit=10&q=${encodeURIComponent(q)}&active=true`);
      const data = await res.json();
      setSearchResults(data || []);
      setSearchOpen(true);
    } catch { setSearchResults([]); }
  }

  const activeMemberForPick = pickForMemberId || (isMyTurn ? myMember?.id : null);
  const teamPicksRemaining = members.length
    ? computeRosterQuota(pool.rules, 'TEAM') - picks.filter(p => p.position === 'TEAM' && p.member_id === (pickForMemberId || myMember?.id)).length
    : 0;
  const canFreeTeamPick = !pool.rules.draft.teamPickCountsAsRound && teamPicksRemaining > 0 && !draftFinished;

  // Auto-pick a l'expiration du minuteur : n'importe quel client connecte peut le declencher
  // (pas seulement celui sur l'horloge). La RPC revalide tout cote serveur et est idempotente
  // (si un autre client a deja avance le pick, l'echeance n'est plus depassee et l'appel
  // echoue sans effet - on ignore alors silencieusement l'erreur).
  const autoPickAttempted = useRef(null);
  useEffect(() => {
    if (draftFinished || paused || !deadline || !currentMember) return;
    if (now < deadline) return;
    if (autoPickAttempted.current === currentPick) return;
    autoPickAttempted.current = currentPick;
    const candidate = pickBestAvailableFor(currentMember, players, picks, pool);
    if (!candidate) return;
    supabase.rpc('auto_pick', {
      p_pool_id: pool.id, p_kind: candidate.kind, p_player_id: candidate.playerId,
      p_player_name: candidate.playerName, p_position: candidate.position,
      p_nhl_team: candidate.nhlTeam, p_salary: candidate.salary,
    }).then(() => onAction?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, deadline, paused, draftFinished, currentPick, currentMember, players.length]);

  function requestPick(player, kind = 'player') {
    setActionError('');
    setPendingPick({ ...player, kind });
    setSalaryInput('0');
  }

  async function confirmPick() {
    if (!pendingPick) return;
    setBusy(true); setActionError('');
    const salary = pool.rules.salaryCap.enabled ? (parseInt(salaryInput, 10) || 0) : null;
    const pickPosition = pendingPick.kind === 'team' ? 'TEAM' : posReelToPickPosition(pendingPick.posReel);
    const nhlTeam = pendingPick.kind === 'team' ? pendingPick.id : pendingPick.team;
    const base = {
      p_pool_id: pool.id, p_kind: pendingPick.kind, p_player_id: String(pendingPick.id), p_player_name: pendingPick.name,
      p_position: pickPosition, p_nhl_team: nhlTeam, p_salary: salary, p_is_manual: !!pendingPick.manual,
    };
    const { error: err } = pickForMemberId
      ? await supabase.rpc('commissioner_pick', { ...base, p_member_id: pickForMemberId })
      : await supabase.rpc('make_pick', base);
    setBusy(false);
    if (err) { setActionError(mapPickError(err.message, t)); return; }
    setPendingPick(null);
    setPickForMemberId(null);
    onAction?.();
  }

  function addManualPlayer() {
    if (!manualAdd || !manualAdd.name.trim() || !manualAdd.team) return;
    const nouveau = construirJoueurManuel(manualAdd.name.trim(), manualAdd.positionCode, manualAdd.team, manualAdd.knownId);
    if (!players.find(p => p.id === nouveau.id)) setPlayers(ps => [...ps, nouveau]);
    requestPick({ ...nouveau, valeurIA: 0 });
    setManualAdd(null);
    setSearch(''); setSearchResults([]); setSearchOpen(false);
  }

  async function doPause() { setBusy(true); await supabase.rpc('pause_draft', { p_pool_id: pool.id }); setBusy(false); onAction?.(); }
  async function doResume() { setBusy(true); await supabase.rpc('resume_draft', { p_pool_id: pool.id }); setBusy(false); onAction?.(); }
  async function doUndo() { setBusy(true); setActionError(''); const { error: err } = await supabase.rpc('undo_last_pick', { p_pool_id: pool.id }); setBusy(false); if (err) setActionError(mapPickError(err.message, t)); onAction?.(); }

  if (draftFinished) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...card, textAlign: 'center', backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>{t('pool_draft_finished_title')}</div>
        </div>
        <TeamRosterPanel pool={pool} members={members} picks={picks} lang={lang} viewedMemberId={viewedMemberId} setViewedMemberId={setViewedMemberId} />
        <DraftBoard pool={pool} members={members} picks={picks} lang={lang} />
      </div>
    );
  }

  return (
    <div>
      {/* Bandeau tour actuel */}
      <div style={{
        background: paused ? 'rgba(239,68,68,0.08)' : isMyTurn ? 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.08))' : 'rgba(249,115,22,0.04)',
        border: paused ? '1px solid rgba(239,68,68,0.3)' : isMyTurn ? '1px solid #f97316' : '1px solid rgba(249,115,22,0.2)',
        borderRadius: '14px', padding: '14px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
      }}>
        {paused ? (
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>{t('pool_draft_paused_banner')}</div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: '10px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>{t('pool_draft_on_the_clock')}</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--c-white)' }}>{isMyTurn ? '🎯 ' : ''}{currentMember?.display_name || currentMember?.team_name || '?'}</div>
              {nextMember && <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>{t('pool_draft_next_up')} : {nextMember.display_name || nextMember.team_name}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--c-888)' }}>{t('pool_draft_round_label')} {round}/{totalRounds}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-888)' }}>{t('pool_draft_pick_label')} #{currentPick}/{totalPicks}</div>
              {secondsLeft != null && (
                <div style={{ fontSize: '20px', fontWeight: '900', color: secondsLeft <= 10 ? '#ef4444' : '#f97316' }}>{secondsLeft}s</div>
              )}
            </div>
          </>
        )}
      </div>

      {isCommissioner && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {paused ? (
            <button onClick={doResume} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{t('pool_draft_resume_btn')}</button>
          ) : (
            <button onClick={doPause} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>{t('pool_draft_pause_btn')}</button>
          )}
          <button onClick={doUndo} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>{t('pool_draft_undo_btn')}</button>
          <select value={pickForMemberId || ''} onChange={e => setPickForMemberId(e.target.value || null)}
            style={{ ...inputStyle, width: 'auto' }}>
            <option value="">{t('pool_draft_pick_for_none')}</option>
            {members.filter(m => m.id !== myMember?.id).map(m => (
              <option key={m.id} value={m.id}>{t('pool_draft_pick_for')} {m.display_name || m.team_name}</option>
            ))}
          </select>
        </div>
      )}

      {canFreeTeamPick && (
        <div style={{ ...card, marginBottom: '14px' }}>
          <div style={sectionTitle(POS_COLORS.TEAM)}>{t('pool_draft_pick_team_title')}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.keys(LOGOS_NHL).sort().filter(ab => !takenTeamIds.has(ab)).map(ab => (
              <button key={ab} onClick={() => requestPick({ id: ab, name: ab, team: ab }, 'team')}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-111)', color: 'var(--c-ccc)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                {ab}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{actionError}</div>}

      {/* Recherche / filtres */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setNbShown(50); runSearch(e.target.value); }}
            placeholder={t('pool_draft_search_ph')} style={inputStyle} />
          {searchOpen && search.trim().length >= 2 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--c-1a1a1a)', borderRadius: '10px', border: '1px solid var(--c-333)', marginTop: '4px', overflow: 'hidden', zIndex: 100 }}>
              {searchResults.map((r, i) => {
                const trouve = playersWithValue.find(p => p.id === String(r.playerId));
                const pickExistant = picks.find(p => p.kind === 'player' && p.player_id === String(r.playerId));
                const dejaPris = !!pickExistant;
                const owner = dejaPris ? members.find(m => m.id === pickExistant.member_id) : null;
                return (
                  <button key={r.playerId ?? i} type="button" disabled={dejaPris}
                    onClick={() => {
                      const joueur = trouve || { ...construirJoueurManuel(r.name, r.positionCode || 'C', r.teamAbbrev || '', r.playerId) };
                      if (!trouve) setPlayers(ps => [...ps, joueur]);
                      setSearch(''); setSearchResults([]); setSearchOpen(false);
                      requestPick({ ...joueur, valeurIA: joueur.valeurIA ?? 0 });
                    }}
                    style={{ all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', width: '100%', cursor: dejaPris ? 'not-allowed' : 'pointer', borderBottom: '1px solid var(--c-222)', opacity: dejaPris ? 0.5 : 1 }}>
                    <img src={LOGOS_NHL[r.teamAbbrev]} alt={r.teamAbbrev} style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0, pointerEvents: 'none' }} onError={e => { e.target.style.display = 'none'; }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--c-white)' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: dejaPris ? '#ef4444' : 'var(--c-666)' }}>
                        {dejaPris ? `${t('pool_draft_already_taken')} — ${owner?.display_name || owner?.team_name || '?'}` : `${r.teamAbbrev} · ${r.positionCode}`}
                      </div>
                    </div>
                    {dejaPris && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '700', flexShrink: 0, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: '6px', padding: '3px 6px' }}>{t('pool_draft_already_taken_badge')}</span>}
                  </button>
                );
              })}
              <button type="button" onClick={() => { setManualAdd({ name: search, positionCode: 'C', team: '', knownId: null }); setSearchOpen(false); }}
                style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', padding: '10px 14px', cursor: 'pointer', color: '#f97316', fontSize: '12px', fontWeight: '700' }}>
                + {t('pool_draft_add_manual')} : {search}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['ALL', 'F', 'D', 'G'].map(p => (
            <button key={p} onClick={() => { setPosFilter(p); setSearch(''); setSearchResults([]); setSearchOpen(false); setNbShown(50); }}
              style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: posFilter === p ? (POS_COLORS[p] || '#f97316') : 'var(--c-111)', color: posFilter === p ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '700' }}>
              {p === 'ALL' ? t('pool_draft_filter_all') : p}
            </button>
          ))}
        </div>
      </div>

      {manualAdd && (
        <div style={{ ...card, border: '1px solid rgba(167,139,250,0.35)', marginBottom: '14px' }}>
          <div style={sectionTitle('#a78bfa')}>{t('pool_draft_add_manual')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
            <input value={manualAdd.name} onChange={e => setManualAdd(a => ({ ...a, name: e.target.value }))} placeholder={t('pool_field_first_name')} style={inputStyle} />
            <select value={manualAdd.positionCode} onChange={e => setManualAdd(a => ({ ...a, positionCode: e.target.value }))} style={inputStyle}>
              <option value="C">C</option><option value="L">LW</option><option value="R">RW</option><option value="D">D</option><option value="G">G</option>
            </select>
            <select value={manualAdd.team} onChange={e => setManualAdd(a => ({ ...a, team: e.target.value }))} style={inputStyle}>
              <option value="">...</option>
              {Object.keys(LOGOS_NHL).sort().map(ab => <option key={ab} value={ab}>{ab}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addManualPlayer} disabled={!manualAdd.name.trim() || !manualAdd.team} style={{ ...btnPrimary, opacity: (!manualAdd.name.trim() || !manualAdd.team) ? 0.5 : 1 }}>{t('pool_draft_add_btn')}</button>
            <button onClick={() => setManualAdd(null)} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
          </div>
        </div>
      )}

      {pendingPick && (
        <div onClick={() => setPendingPick(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '16px', padding: '20px', maxWidth: '360px', width: '100%' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--c-white)', marginBottom: '14px' }}>{pendingPick.name}</div>
            {pool.rules.salaryCap.enabled && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--c-777)', marginBottom: '6px', fontWeight: '600' }}>{t('pool_salarycap_amount')}</div>
                <input type="number" autoFocus value={salaryInput} onChange={e => setSalaryInput(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmPick} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1 }}>{t('pool_draft_confirm_pick')}</button>
              <button onClick={() => setPendingPick(null)} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '16px' }}>
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-444)', fontSize: '13px' }}>{t('pool_draft_loading_players')}</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef4444', fontSize: '13px' }}>{t('pool_draft_load_error')}</div>
          ) : filteredPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('pool_draft_no_players_found')}</div>
          ) : (
            <>
              {filteredPlayers.slice(0, nbShown).map(j => {
                const taken = takenPlayerIds.has(j.id);
                const canPick = !!activeMemberForPick && !taken;
                return (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-161616)', borderRadius: '12px', padding: '10px 12px', marginBottom: '6px', opacity: taken ? 0.4 : 1, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: POS_COLORS[posReelToPickPosition(j.posReel)], backgroundColor: 'var(--c-111)', borderRadius: '6px', padding: '3px 7px', flexShrink: 0 }}>{j.posReel}</span>
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--c-555)' }}>
                        {j.team} · {j.posGroup === 'goalie' ? `${j.wins}V · ${((j.savePct || 0) * 100).toFixed(1)}%` : `${j.points} PTS (${j.goals}B-${j.assists}P)`}
                      </div>
                    </div>
                    {pool.rules.draftAssistant?.enabled && (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: '900', color: '#f97316' }}>{j.valeurIA}</div>
                        <div style={{ fontSize: '8px', color: 'var(--c-555)' }}>{t('pool_draft_ia_label')}</div>
                      </div>
                    )}
                    <button onClick={() => requestPick(j)} disabled={!canPick}
                      style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: canPick ? 'pointer' : 'not-allowed', backgroundColor: canPick ? 'rgba(249,115,22,0.15)' : 'var(--c-1a1a1a)', color: canPick ? '#f97316' : 'var(--c-444)', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                      {taken ? t('pool_draft_already_taken_badge') : t('pool_draft_pick_btn')}
                    </button>
                  </div>
                );
              })}
              {nbShown < filteredPlayers.length && (
                <button onClick={() => setNbShown(n => n + 50)} style={{ ...btnSecondary, width: '100%' }}>{t('pool_draft_show_more')} ({filteredPlayers.length - nbShown})</button>
              )}
            </>
          )}
        </div>

        <div>
          <TeamRosterPanel pool={pool} members={members} picks={picks} lang={lang} viewedMemberId={viewedMemberId} setViewedMemberId={setViewedMemberId} />
        </div>
      </div>
    </div>
  );
}

// Calcule, cote client, le meilleur joueur disponible pour le poste le plus manquant du
// membre sur l'horloge (utilise pour l'auto-pick a l'expiration du minuteur). Renvoie null
// si aucune donnee n'est encore chargee (un autre client ou le serveur tranchera alors).
export function pickBestAvailableFor(member, players, picks, pool) {
  if (!member || !players.length) return null;
  const memberPicks = picks.filter(p => p.member_id === member.id);
  const positions = pool.rules.poolType === 'classic' ? ['F', 'D', 'G'] : ['F', 'G'];
  const needed = positions.find(pos => {
    const used = memberPicks.filter(p => pos === 'F' && pool.rules.poolType !== 'classic' ? (p.position === 'F' || p.position === 'D') : p.position === pos).length;
    return used < computeRosterQuota(pool.rules, pos);
  });
  if (!needed) return null;
  const takenIds = new Set(picks.filter(p => p.kind === 'player').map(p => p.player_id));
  const candidates = players
    .filter(p => !takenIds.has(p.id))
    .filter(p => posReelToPickPosition(p.posReel) === needed)
    .map(p => ({ ...p, valeurIA: calculerValeurIA(p, pool.rules) }))
    .sort((a, b) => b.valeurIA - a.valeurIA);
  if (!candidates.length) return null;
  const best = candidates[0];
  return {
    kind: 'player', playerId: best.id, playerName: best.name,
    position: posReelToPickPosition(best.posReel), nhlTeam: best.team, salary: null,
  };
}

export { PICK_POSITIONS };
