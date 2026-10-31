import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { supabase } from './supabase';
import { getT } from './i18n';
import { getUrl } from './nhlApi';
import { useIsMobile, useSaisonCourante, LOGOS_NHL } from './Analyses';
import {
  computePicksPerMember, computeRosterQuota, computeCurrentMemberId, PICK_POSITIONS,
  currentSeasonLabelFromSeasonId, POSITION_STAT_KEYS, GOALIE_STAT_KEYS, TEAM_STAT_KEYS,
} from './poolRules';

// ===================== Styles (memes conventions que Pool.js) =====================
const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '16px' };
const inputStyle = { width: '100%', padding: '10px 12px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '10px', color: 'var(--c-white)', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '11px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' };
const btnSecondary = { padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--c-888)', fontSize: '13px', fontWeight: '600' };
const sectionTitle = (color) => ({ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' });
const POS_COLORS = { F: '#f97316', D: '#3b82f6', G: '#22c55e', TEAM: '#a78bfa' };
const PLACEHOLDER_HEADSHOT = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#333"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7"/></svg>');

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

function headshotUrl(playerId, seasonId, team) {
  return `https://assets.nhle.com/mugs/nhl/${seasonId}/${team || 'current'}/${playerId}.png`;
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

// Valeur IA : utilise les memes categories que l'assistant solo PoolDraft.js (buts, passes,
// points en avantage numerique, tirs, +/- pour les patineurs ; victoires, blanchissages,
// arrets pour les gardiens), exactement celles disponibles via l'API NHL publique utilisee
// ici. Les categories sans donnee disponible (mises en echec, tirs bloques, penalites, buts
// vainqueurs, toutes les stats d'equipe) contribuent 0 pour l'instant - aucune source de
// donnees NHL publique ne les fournit via cet endpoint.
//
// Utilise les champs *_ia (voir useNhlPlayers) quand disponibles : ils melangent la saison en
// cours avec la saison precedente tant que l'echantillon de la saison en cours est petit, pour
// que le classement ne soit pas domine par le hasard des premiers matchs. Les joueurs ajoutes
// manuellement n'ont pas ces champs et retombent sur leurs valeurs brutes (toutes a 0).
function calculerValeurIA(player, rules) {
  if (!rules) return 0;
  if (player.posGroup === 'goalie') {
    const p = rules.scoring.goalie;
    return round1(
      (player.winsIA ?? player.wins ?? 0) * (p.wins || 0)
      + (player.shutoutsIA ?? player.shutouts ?? 0) * (p.shutouts || 0)
      + (player.savesIA ?? player.saves ?? 0) * (p.saves || 0)
    );
  }
  if (player.posGroup === 'team') return 0;
  const p = player.posGroup === 'defense' ? rules.scoring.defense : rules.scoring.forward;
  return round1(
    (player.goalsIA ?? player.goals ?? 0) * (p.goals || 0) + (player.assistsIA ?? player.assists ?? 0) * (p.assists || 0)
    + (player.ppPointsIA ?? player.ppPoints ?? 0) * (p.powerPlayPoints || 0) + (player.shotsIA ?? player.shots ?? 0) * (p.shotsOnGoal || 0)
    + (player.plusMinusIA ?? player.plusMinus ?? 0) * (p.plusMinus || 0)
  );
}

// Un groupe de pointage (forward/defense/goalie) sans aucune ponderation non nulle produit une
// valeur IA de 0 pour tout le monde : le tri n'est alors pas significatif (ordre arbitraire),
// il faut le signaler plutot que de laisser croire a un classement reel.
function groupHasScoring(rules, group) {
  const map = rules?.scoring?.[group] || {};
  return Object.values(map).some(v => Number(v) !== 0);
}
function posFilterToScoringGroup(posFilter) {
  if (posFilter === 'D') return 'defense';
  if (posFilter === 'G') return 'goalie';
  if (posFilter === 'F') return 'forward';
  return null;
}

// Rattrapage de debut de saison : tant que le nombre de matchs joues cette saison est sous ce
// seuil, on complete avec le taux par match de la saison precedente (pondere par le nombre de
// matchs manquants) pour stabiliser le classement. Au-dela du seuil, les stats de la saison en
// cours suffisent et la formule redevient simplement currentTotal (poids supplementaire nul).
const SEASON_BLEND_GAMES = 15;
function blendStat(currentTotal, currentGp, prevTotal, prevGp) {
  const extraWeight = Math.max(0, SEASON_BLEND_GAMES - (currentGp || 0));
  if (extraWeight <= 0 || !prevGp) return currentTotal || 0;
  return (currentTotal || 0) + (prevTotal / prevGp) * extraWeight;
}
function previousSeasonId(seasonId) {
  const n = Number(seasonId);
  return n ? String(n - 10001) : null;
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
  const [blendInfo, setBlendInfo] = useState({ active: false, prevSeasonId: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(false);
      try {
        const prevId = previousSeasonId(seasonId);
        const [resSum, resGoal, resSumPrev, resGoalPrev] = await Promise.all([
          fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=${seasonId}&limit=-1`)),
          fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/goalie/summary?cayenneExp=seasonId=${seasonId}&limit=-1`)),
          prevId ? fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=${prevId}&limit=-1`)) : Promise.resolve(null),
          prevId ? fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/goalie/summary?cayenneExp=seasonId=${prevId}&limit=-1`)) : Promise.resolve(null),
        ]);
        const [dataSum, dataGoal, dataSumPrev, dataGoalPrev] = await Promise.all([
          resSum.json(), resGoal.json(),
          resSumPrev ? resSumPrev.json() : null, resGoalPrev ? resGoalPrev.json() : null,
        ]);
        const prevSkatersById = new Map((dataSumPrev?.data || []).map(s => [String(s.playerId), s]));
        const prevGoaliesById = new Map((dataGoalPrev?.data || []).map(g => [String(g.playerId), g]));

        const skaters = (dataSum.data || []).map(s => {
          const id = String(s.playerId);
          const prev = prevSkatersById.get(id);
          const gp = s.gamesPlayed || 0;
          const prevGp = prev?.gamesPlayed || 0;
          return {
            id, name: s.skaterFullName, team: s.teamAbbrevs,
            positionCode: s.positionCode, posGroup: mapPosGroup(s.positionCode), posReel: mapPosReel(s.positionCode),
            gamesPlayed: gp, goals: s.goals || 0, assists: s.assists || 0, points: s.points || 0,
            plusMinus: s.plusMinus || 0, shots: s.shots || 0, ppPoints: s.ppPoints || 0,
            goalsIA: blendStat(s.goals, gp, prev?.goals, prevGp),
            assistsIA: blendStat(s.assists, gp, prev?.assists, prevGp),
            ppPointsIA: blendStat(s.ppPoints, gp, prev?.ppPoints, prevGp),
            shotsIA: blendStat(s.shots, gp, prev?.shots, prevGp),
            plusMinusIA: blendStat(s.plusMinus, gp, prev?.plusMinus, prevGp),
          };
        });
        const goalies = (dataGoal.data || []).map(g => {
          const id = String(g.playerId);
          const prev = prevGoaliesById.get(id);
          const gp = g.gamesPlayed || 0;
          const prevGp = prev?.gamesPlayed || 0;
          return {
            id, name: g.goalieFullName, team: g.teamAbbrevs,
            positionCode: 'G', posGroup: 'goalie', posReel: 'G',
            gamesPlayed: gp, wins: g.wins || 0, shutouts: g.shutouts || 0, saves: g.saves || 0, savePct: g.savePct || 0,
            winsIA: blendStat(g.wins, gp, prev?.wins, prevGp),
            shutoutsIA: blendStat(g.shutouts, gp, prev?.shutouts, prevGp),
            savesIA: blendStat(g.saves, gp, prev?.saves, prevGp),
          };
        });

        const allGp = [...skaters, ...goalies].map(p => p.gamesPlayed);
        const maxGp = allGp.length ? Math.max(...allGp) : 0;
        if (!cancelled) {
          setPlayers([...skaters, ...goalies].sort((a, b) => a.name.localeCompare(b.name)));
          setBlendInfo({ active: !!prevId && maxGp < SEASON_BLEND_GAMES, prevSeasonId: prevId });
          setLoading(false);
        }
      } catch { if (!cancelled) { setError(true); setLoading(false); } }
    }
    load();
    return () => { cancelled = true; };
  }, [seasonId]);

  return { players, setPlayers, loading, error, blendInfo };
}

// Classement NHL en direct (rang + logo + nom complet) pour le filtre "Equipes NHL" de la
// recherche. En cas d'echec, retombe sur la simple liste des 32 abbreviations connues
// (sans rang) pour que le pick d'equipe reste toujours possible.
function useNhlTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(getUrl('standings/now'));
        const data = await res.json();
        const list = (data.standings || []).map(s => ({
          abbrev: s.teamAbbrev?.default,
          name: s.teamName?.default || s.teamAbbrev?.default,
          logo: s.teamLogo,
          rank: s.leagueSequence ?? null,
        })).filter(t => t.abbrev);
        if (!cancelled) { setTeams(list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))); setLoading(false); }
      } catch {
        if (!cancelled) {
          setTeams(Object.keys(LOGOS_NHL).sort().map(ab => ({ abbrev: ab, name: ab, logo: LOGOS_NHL[ab], rank: null })));
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { teams, loading };
}

function mapPickError(code, t) {
  const key = `pool_draft_error_${code}`;
  const translated = t(key);
  return translated !== key ? translated : t('pool_draft_error_generic');
}

function PlayerAvatar({ src, fallback, size = 32 }) {
  const [failed, setFailed] = useState(false);
  return (
    <img src={failed || !src ? (fallback || PLACEHOLDER_HEADSHOT) : src} alt=""
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', backgroundColor: 'var(--c-111)', flexShrink: 0 }} />
  );
}

function TeamLogo({ abbrev, size = 20 }) {
  return (
    <img src={LOGOS_NHL[abbrev]} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      onError={e => { e.target.style.display = 'none'; }} />
  );
}

// ===================== Fiche joueur / equipe (modal) =====================

function PlayerDetailModal({ target, seasonId, lang, taken, ownerName, canPick, onPick, onClose }) {
  const t = getT(lang);
  const isTeam = target.kind === 'team';
  const isManualPlayer = !isTeam && (target.manual || String(target.id).startsWith('manual-'));
  const [loading, setLoading] = useState(!isTeam && !isManualPlayer);
  const [infos, setInfos] = useState(null);
  const [career, setCareer] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isTeam || isManualPlayer) return;
    let cancelled = false;
    async function load() {
      setLoading(true); setNotFound(false);
      try {
        const res = await fetch(getUrl(`player/${target.id}/landing`));
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        if (cancelled) return;
        setInfos({
          headshot: data.headshot,
          teamLogo: data.teamLogo,
          team: data.currentTeamAbbrev || target.team,
          fullName: `${data.firstName?.default || ''} ${data.lastName?.default || ''}`.trim() || target.name,
          position: data.position || target.posReel,
          number: data.sweaterNumber,
          birthDate: data.birthDate,
          heightCm: data.heightInCentimeters,
          weightKg: data.weightInKilograms,
        });
        setCareer((data.seasonTotals || []).filter(s => s.leagueAbbrev === 'NHL' && s.gameTypeId === 2).sort((a, b) => b.season - a.season));
      } catch {
        if (!cancelled) setNotFound(true);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [target.id, isTeam, isManualPlayer, target.team, target.name, target.posReel]);

  const isGoalie = (infos?.position || target.posReel) === 'G';
  const age = calcAge(infos?.birthDate);

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '16px', padding: '20px', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        {isTeam ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <TeamLogo abbrev={target.id} size={56} />
            <div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--c-white)' }}>{target.name}</div>
              {target.rank != null && <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{t('pool_draft_team_rank')} #{target.rank}</div>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <PlayerAvatar src={!isManualPlayer ? (infos?.headshot || headshotUrl(target.id, seasonId, infos?.team || target.team)) : null} size={64} />
            <div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--c-white)' }}>{infos?.fullName || target.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--c-666)' }}>
                {infos?.team && <TeamLogo abbrev={infos.team} size={16} />}
                <span>{infos?.position || target.posReel} · {infos?.team || target.team}{infos?.number ? ` · #${infos.number}` : ''}</span>
              </div>
              {(age != null || infos?.heightCm) && (
                <div style={{ fontSize: '11px', color: 'var(--c-555)', marginTop: '2px' }}>
                  {age != null ? `${age} ${t('pool_draft_age_years')}` : ''}{age != null && infos?.heightCm ? ' · ' : ''}{infos?.heightCm ? `${infos.heightCm} cm` : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {taken && (
          <div style={{ fontSize: '12px', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
            {t('pool_draft_already_taken')} — {ownerName}
          </div>
        )}

        {!isTeam && (
          loading ? (
            <div style={{ color: 'var(--c-555)', fontSize: '13px', padding: '16px 0' }}>{t('pool_loading_generic')}</div>
          ) : notFound || isManualPlayer || career.length === 0 ? (
            <div style={{ color: 'var(--c-555)', fontSize: '13px', padding: '16px 0' }}>{t('pool_draft_no_nhl_stats')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--c-1e1e1e)' }}>
                    {(isGoalie
                      ? [t('pool_draft_th_season'), t('pool_draft_th_team'), 'PJ', 'V', 'D', 'DP', 'BL', '%ARR', 'MOY']
                      : [t('pool_draft_th_season'), t('pool_draft_th_team'), 'PJ', 'B', 'A', 'PTS', '+/-', 'PCP', 'TIRS']
                    ).map(h => (
                      <th key={h} style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--c-555)', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {career.map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--c-161616)' }}>
                      <td style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--c-white)', fontWeight: '600' }}>{String(s.season).slice(0, 4)}-{String(s.season).slice(6, 8)}</td>
                      <td style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--c-888)' }}>{s.teamName?.default || '—'}</td>
                      {isGoalie ? (
                        <>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.gamesPlayed ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.wins ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.losses ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.otLosses ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.shutouts ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.savePctg != null ? (s.savePctg * 100).toFixed(1) : '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.goalsAgainstAvg != null ? s.goalsAgainstAvg.toFixed(2) : '—'}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.gamesPlayed ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.goals ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.assists ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px', fontWeight: '700', color: 'var(--c-white)' }}>{s.points ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.plusMinus ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.powerPlayPoints ?? '—'}</td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>{s.shots ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {canPick && !taken && (
            <button onClick={onPick} style={{ ...btnPrimary, flex: 1 }}>{t('pool_draft_pick_btn')}</button>
          )}
          <button onClick={onClose} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
        </div>
      </div>
    </div>
  );
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

// ===================== Panneau "Mon equipe" statique (onglet dedie + resume de fin) =====================

// "Mon equipe" : meme rendu detaille que le clic sur un participant dans le Classement (voir
// MemberDetailPanel plus bas), avec un selecteur de membre en plus. Fonctionne a tout moment
// (setup/draft/active) : get_member_breakdown part du roster (pool_picks), pas des matchs,
// donc la liste des choix s'affiche avec 0 point tant que le pointage n'a pas commence.
export function TeamRosterPanel({ pool, members, lang, viewedMemberId, setViewedMemberId }) {
  const member = members.find(m => m.id === viewedMemberId) || members[0];
  return (
    <div>
      <select value={member?.id || ''} onChange={e => setViewedMemberId(e.target.value)}
        style={{ ...inputStyle, fontWeight: '700', marginBottom: '10px' }}>
        {members.map(m => <option key={m.id} value={m.id}>{m.display_name || m.team_name}</option>)}
      </select>
      <MemberDetailPanel pool={pool} member={member} lang={lang} />
    </div>
  );
}

function buildQuotaRows(rules, memberPicks) {
  if (rules.poolType === 'classic') {
    return [
      { pos: 'F', labelKey: 'pool_slot_forwards', used: memberPicks.filter(p => p.position === 'F').length, quota: computeRosterQuota(rules, 'F') },
      { pos: 'D', labelKey: 'pool_slot_defense', used: memberPicks.filter(p => p.position === 'D').length, quota: computeRosterQuota(rules, 'D') },
      { pos: 'G', labelKey: 'pool_slot_goalies', used: memberPicks.filter(p => p.position === 'G').length, quota: computeRosterQuota(rules, 'G') },
      { pos: 'TEAM', labelKey: 'pool_recap_team_picks', used: memberPicks.filter(p => p.position === 'TEAM').length, quota: computeRosterQuota(rules, 'TEAM') },
    ];
  }
  return [
    { pos: 'F', labelKey: 'pool_draft_skaters', used: memberPicks.filter(p => p.position === 'F' || p.position === 'D').length, quota: computeRosterQuota(rules, 'F') },
    { pos: 'G', labelKey: 'pool_slot_G', used: memberPicks.filter(p => p.position === 'G').length, quota: computeRosterQuota(rules, 'G') },
    { pos: 'TEAM', labelKey: 'pool_recap_team_picks', used: memberPicks.filter(p => p.position === 'TEAM').length, quota: computeRosterQuota(rules, 'TEAM') },
  ];
}

function QuotaRowsDisplay({ rows, t }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
      {rows.map(r => (
        <div key={r.pos} style={{ backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center', flex: 1, minWidth: '56px' }}>
          <div style={{ fontSize: '9px', color: POS_COLORS[r.pos], fontWeight: '700' }}>{t(r.labelKey)}</div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-white)' }}>{r.used}/{r.quota}</div>
        </div>
      ))}
    </div>
  );
}

function PickRow({ pick, capEnabled, onClick, highlight, seasonId, points }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 4px', borderTop: '1px solid var(--c-161616)',
      cursor: onClick ? 'pointer' : 'default', backgroundColor: highlight ? 'rgba(249,115,22,0.12)' : 'transparent',
      borderRadius: '8px', transition: 'background-color 1.5s ease',
    }}>
      <span style={{ fontSize: '10px', color: 'var(--c-444)', minWidth: '18px' }}>{pick.pick_no || '—'}</span>
      {pick.kind === 'team' ? <TeamLogo abbrev={pick.nhl_team || pick.player_id} size={22} /> : <PlayerAvatar src={!pick.is_manual ? headshotUrl(pick.player_id, seasonId, pick.nhl_team) : null} size={22} />}
      <span style={{ fontSize: '9px', fontWeight: '700', color: POS_COLORS[pick.position] }}>{pick.position}</span>
      <span style={{ flex: 1, fontSize: '12px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick.player_name}</span>
      {capEnabled && pick.salary > 0 && <span style={{ fontSize: '10px', color: 'var(--c-666)' }}>{Number(pick.salary).toLocaleString()} $</span>}
      {points !== undefined && <span style={{ fontSize: '12px', fontWeight: '800', color: '#f97316', minWidth: '28px', textAlign: 'right' }}>{round1(Number(points) || 0)}</span>}
    </div>
  );
}

// ===================== Classement (Phase 3 : moteur de pointage) =====================

const CHART_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a78bfa', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#84cc16', '#f472b6'];

function memberLabel(m, rules) {
  if (rules?.display === 'team' && m?.team_name) return m.team_name;
  return m?.display_name || m?.team_name || '?';
}

// Transforme les lignes (member_id, display_name, day, points) renvoyees par
// get_pool_daily_points en une serie cumulative, une ligne par jour, une colonne par membre
// (format attendu par recharts). Les jours sans match pour un membre reprennent son dernier
// total connu (ligne plate, pas de trou dans le graphique).
function buildCumulativeSeries(daily, members, rules) {
  const days = Array.from(new Set(daily.map(r => r.day))).sort();
  const labelByMember = Object.fromEntries(members.map(m => [m.id, memberLabel(m, rules)]));
  const pointsByMemberDay = {};
  daily.forEach(r => { pointsByMemberDay[`${r.member_id}:${r.day}`] = Number(r.points) || 0; });

  const running = Object.fromEntries(members.map(m => [m.id, 0]));
  return days.map(day => {
    const row = { day };
    members.forEach(m => {
      running[m.id] += pointsByMemberDay[`${m.id}:${day}`] || 0;
      row[labelByMember[m.id]] = round1(running[m.id]);
    });
    return row;
  });
}

export function PoolStandings({ pool, members, utilisateur, lang, isCommissioner }) {
  const t = getT(lang);
  const [standings, setStandings] = useState(null);
  const [daily, setDaily] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailMemberId, setDetailMemberId] = useState(null);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState('');

  const myMember = members.find(m => m.user_id === utilisateur.id);

  async function loadStandings() {
    setLoading(true); setError('');
    const [standingsRes, dailyRes, lastGameRes] = await Promise.all([
      supabase.rpc('get_pool_standings', { p_pool_id: pool.id }),
      supabase.rpc('get_pool_daily_points', { p_pool_id: pool.id }),
      supabase.from('nhl_games').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (standingsRes.error) setError(standingsRes.error.message);
    setStandings(standingsRes.data || []);
    setDaily(dailyRes.data || []);
    setLastSync(lastGameRes.data?.updated_at || null);
    setLoading(false);
  }

  useEffect(() => { loadStandings(); }, [pool.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(loadStandings, 120000);
    return () => clearInterval(id);
  }, [pool.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRecalc() {
    setRecalcBusy(true); setRecalcMsg('');
    const { data, error: err } = await supabase.functions.invoke('sync-nhl-stats', { body: { pool_id: pool.id } });
    if (err || data?.error) {
      setRecalcMsg(t('pool_error_generic').replace('{erreur}', data?.error || err.message));
    } else {
      setRecalcMsg(t('pool_standings_recalc_done').replace('{n}', data?.gamesSynced ?? 0));
      await loadStandings();
    }
    setRecalcBusy(false);
  }

  const chartData = useMemo(() => buildCumulativeSeries(daily, members, pool.rules), [daily, members, pool.rules]);
  const detailMember = members.find(m => m.id === detailMemberId);

  if (loading && !standings) {
    return <div style={card}><div style={{ color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_loading_generic')}</div></div>;
  }

  if (detailMember) {
    return (
      <MemberDetailPanel pool={pool} member={detailMember} lang={lang} onBack={() => setDetailMemberId(null)} />
    );
  }

  const noGamesYet = (standings || []).every(row => Number(row.total_points) === 0) && daily.length === 0;
  const capEnabled = !!pool.rules?.salaryCap?.enabled;
  const capAmount = Number(pool.rules?.salaryCap?.amount) || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>
          {t('pool_standings_last_sync')} {lastSync ? new Date(lastSync).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US') : t('pool_standings_never_synced')}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={loadStandings} style={btnSecondary}>{t('pool_standings_refresh_btn')}</button>
          {isCommissioner && (
            <button onClick={handleRecalc} disabled={recalcBusy} style={{ ...btnSecondary, opacity: recalcBusy ? 0.6 : 1 }}>
              {recalcBusy ? t('pool_wizard_saving') : t('pool_standings_recalc_btn')}
            </button>
          )}
        </div>
      </div>

      {recalcMsg && <div style={{ fontSize: '12px', color: 'var(--c-666)', marginBottom: '10px' }}>{recalcMsg}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{t('pool_error_generic').replace('{erreur}', error)}</div>}

      <div style={{ fontSize: '11px', color: 'var(--c-555)', marginBottom: '12px' }}>{t('pool_standings_lineup_note')}</div>

      {noGamesYet && (
        <div style={{ fontSize: '13px', color: 'var(--c-555)', textAlign: 'center', padding: '10px 0', marginBottom: '8px' }}>
          {t('pool_standings_empty')}
        </div>
      )}

      <div style={{ ...card, marginBottom: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: capEnabled ? '520px' : '420px' }}>
          <thead>
            <tr style={{ color: 'var(--c-666)', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('pool_standings_col_rank')}</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('pool_standings_col_member')}</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('pool_standings_col_total')}</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('pool_standings_col_today')}</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('pool_standings_col_last7')}</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('pool_standings_col_gap')}</th>
              {capEnabled && <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('pool_standings_col_salary')}</th>}
            </tr>
          </thead>
          <tbody>
            {(standings || []).map((row, i) => {
              const isMe = row.member_id === myMember?.id;
              const gap = i === 0 ? 0 : Number(standings[0].total_points) - Number(row.total_points);
              const salaryUsed = Number(row.salary_used) || 0;
              return (
                <tr key={row.member_id} onClick={() => setDetailMemberId(row.member_id)}
                  style={{ cursor: 'pointer', backgroundColor: isMe ? 'rgba(249,115,22,0.12)' : 'transparent', borderTop: '1px solid var(--c-161616)' }}>
                  <td style={{ padding: '8px', fontWeight: '800', color: row.rank === 1 ? '#f97316' : 'var(--c-white)' }}>{row.rank}</td>
                  <td style={{ padding: '8px', color: 'var(--c-white)', fontWeight: isMe ? '800' : '500' }}>{row.display_name || row.team_name}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: 'var(--c-white)' }}>{round1(row.total_points)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--c-666)' }}>{round1(row.today_points)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--c-666)' }}>{round1(row.last7_points)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--c-666)' }}>{i === 0 ? '—' : `-${round1(gap)}`}</td>
                  {capEnabled && (
                    <td style={{ padding: '8px', textAlign: 'right', color: salaryUsed > capAmount ? '#ef4444' : 'var(--c-666)' }}>
                      {salaryUsed.toLocaleString()} $ / {capAmount.toLocaleString()} $
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {chartData.length > 1 && (
        <div style={{ ...card, height: '280px' }}>
          <div style={sectionTitle('var(--c-666)')}>{t('pool_standings_chart_title')}</div>
          <ResponsiveContainer width="100%" height="88%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-222)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--c-666)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--c-666)' }} />
              <RechartsTooltip contentStyle={{ backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {members.map((m, i) => (
                <Line key={m.id} type="monotone" dataKey={memberLabel(m, pool.rules)} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Sections dans l'ordre demande : Attaquants, Defenseurs, Gardiens, Equipe NHL. Chaque ligne
// de get_member_breakdown porte deja pos_group ('F'/'D'/'G'/'TEAM' -- vient de
// pool_picks.position, toujours renseigne meme sans aucun match joue) et est deja triee par
// points decroissants puis pick_no croissant par la RPC : un simple filtre par section suffit.
const MEMBER_DETAIL_SECTIONS = [
  { pos: 'F', titleKey: 'pool_slot_forwards', statKeys: POSITION_STAT_KEYS },
  { pos: 'D', titleKey: 'pool_slot_defense', statKeys: POSITION_STAT_KEYS },
  { pos: 'G', titleKey: 'pool_slot_goalies', statKeys: GOALIE_STAT_KEYS },
  { pos: 'TEAM', titleKey: 'pool_recap_team_picks', statKeys: TEAM_STAT_KEYS },
];

// Detail d'un participant : utilise a la fois pour le clic sur une ligne du Classement
// (onBack fourni) et pour l'onglet "Mon equipe" (onBack absent, voir TeamRosterPanel). Appele
// a tout moment post-draft -- get_member_breakdown part du roster, pas des matchs.
function MemberDetailPanel({ pool, member, lang, onBack }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let annule = false;
    setRows(null);
    if (!member?.id) return;
    supabase.rpc('get_member_breakdown', { p_pool_id: pool.id, p_member_id: member.id }).then(({ data }) => {
      if (!annule) setRows(data || []);
    });
    return () => { annule = true; };
  }, [pool.id, member?.id]);

  const capEnabled = !!pool.rules?.salaryCap?.enabled;
  const capAmount = Number(pool.rules?.salaryCap?.amount) || 0;
  const total = (rows || []).reduce((s, r) => s + (Number(r.total_points) || 0), 0);
  const salaryUsed = (rows || []).reduce((s, r) => s + (Number(r.salary) || 0), 0);
  const quotaRows = useMemo(() => buildQuotaRows(pool.rules, (rows || []).map(r => ({ position: r.pos_group }))), [rows, pool.rules]);

  return (
    <div style={card}>
      {onBack && <button onClick={onBack} style={{ ...btnSecondary, marginBottom: '12px' }}>{t('pool_lobby_back_btn')}</button>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--c-white)' }}>{memberLabel(member, pool.rules)}</div>
        <div style={{ fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{round1(total)} {t('pool_standings_total_points').toLowerCase()}</div>
      </div>

      <QuotaRowsDisplay rows={quotaRows} t={t} />

      {capEnabled && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--c-666)', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
            <span>{t('pool_draft_salary_used')} ({t(`pool_salarycap_source_short_${pool.rules.salaryCap.source}`)})</span>
            <span style={{ fontWeight: '700', color: salaryUsed > capAmount ? '#ef4444' : 'var(--c-ccc)' }}>
              {salaryUsed.toLocaleString()} $ / {capAmount.toLocaleString()} $ — {t('pool_standings_salary_remaining').replace('{montant}', Math.max(0, capAmount - salaryUsed).toLocaleString())}
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--c-111)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, capAmount ? (salaryUsed / capAmount) * 100 : 0)}%`, backgroundColor: salaryUsed > capAmount ? '#ef4444' : '#22c55e', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {rows === null ? (
        <div style={{ color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '10px 0' }}>{t('pool_draft_no_picks_yet')}</div>
      ) : (
        MEMBER_DETAIL_SECTIONS.map(section => {
          const sectionRows = rows.filter(r => r.pos_group === section.pos);
          if (sectionRows.length === 0) return null;
          return (
            <div key={section.pos} style={{ marginBottom: '16px' }}>
              <div style={sectionTitle(POS_COLORS[section.pos])}>{t(section.titleKey)}</div>
              {sectionRows.map(r => (
                <MemberDetailRow key={`${r.kind}:${r.ref_id}`} row={r} statKeys={section.statKeys} capEnabled={capEnabled} seasonId={seasonId} t={t} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function MemberDetailRow({ row, statKeys, capEnabled, seasonId, t }) {
  const isTeam = row.kind === 'team';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderTop: '1px solid var(--c-161616)', flexWrap: 'wrap' }}>
      {isTeam ? <TeamLogo abbrev={row.ref_id} size={28} /> : <PlayerAvatar src={headshotUrl(row.ref_id, seasonId, row.team_abbrev)} size={28} />}
      <div style={{ flex: 1, minWidth: '130px' }}>
        <div style={{ fontSize: '13px', color: 'var(--c-white)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
        <div style={{ fontSize: '10px', color: 'var(--c-666)' }}>
          {!isTeam && row.team_abbrev ? `${row.team_abbrev} · ` : ''}{t('pool_standings_games_played').replace('{n}', row.games_played)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '10px', color: 'var(--c-555)' }}>
        {statKeys.map(k => (
          <span key={k}>{t(`pool_stat_${k}`)} <strong style={{ color: 'var(--c-ccc)' }}>{row.stats?.[k] ?? 0}</strong></span>
        ))}
      </div>
      {capEnabled && !isTeam && row.salary > 0 && <span style={{ fontSize: '10px', color: 'var(--c-666)' }}>{Number(row.salary).toLocaleString()} $</span>}
      <div style={{ textAlign: 'right', minWidth: '50px' }}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-white)' }}>{round1(row.total_points)}</div>
        {Number(row.today_points) !== 0 && <div style={{ fontSize: '10px', color: '#22c55e' }}>+{round1(row.today_points)} {t('pool_standings_today_suffix')}</div>}
      </div>
    </div>
  );
}

// ===================== Panneau "equipe" en direct (sidebar de la salle de draft) =====================

export function LiveTeamFollowPanel({ pool, members, picks, myMember, currentMemberId, lang, onOpenDetail }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [manualMemberId, setManualMemberId] = useState(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [justPickedId, setJustPickedId] = useState(null);
  const prevPicksLen = useRef(picks.length);

  useEffect(() => {
    if (picks.length > prevPicksLen.current) {
      const last = picks[picks.length - 1];
      setJustPickedId(last.id);
      const timer = setTimeout(() => setJustPickedId(null), 1800);
      prevPicksLen.current = picks.length;
      return () => clearTimeout(timer);
    }
    prevPicksLen.current = picks.length;
  }, [picks]);

  const effectiveMemberId = autoFollow ? (currentMemberId || myMember?.id || members[0]?.id) : (manualMemberId || myMember?.id || members[0]?.id);
  const member = members.find(m => m.id === effectiveMemberId) || members[0];
  const memberPicks = picks.filter(p => p.member_id === member?.id);
  const capEnabled = !!pool.rules?.salaryCap?.enabled;
  const salaryUsed = memberPicks.reduce((s, p) => s + (Number(p.salary) || 0), 0);
  const capAmount = Number(pool.rules?.salaryCap?.amount) || 0;
  const quotaRows = useMemo(() => buildQuotaRows(pool.rules, memberPicks), [memberPicks, pool.rules]);

  const idx = members.findIndex(m => m.id === member?.id);
  function go(dir) {
    const next = members[(idx + dir + members.length) % members.length];
    setAutoFollow(false);
    setManualMemberId(next.id);
  }

  return (
    <div style={card}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
        <input type="checkbox" checked={autoFollow} onChange={e => { setAutoFollow(e.target.checked); if (e.target.checked) setManualMemberId(null); }} />
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-ccc)' }}>{t('pool_draft_follow_live')}</span>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <button onClick={() => go(-1)} style={{ ...btnSecondary, padding: '6px 10px' }}>‹</button>
        <select value={member?.id || ''} onChange={e => { setAutoFollow(false); setManualMemberId(e.target.value); }}
          style={{ ...inputStyle, flex: 1, fontWeight: '700' }}>
          {members.map(m => <option key={m.id} value={m.id}>{m.display_name || m.team_name}</option>)}
        </select>
        <button onClick={() => go(1)} style={{ ...btnSecondary, padding: '6px 10px' }}>›</button>
      </div>

      {!autoFollow && currentMemberId && (
        <button onClick={() => { setAutoFollow(true); setManualMemberId(null); }} style={{ ...btnSecondary, width: '100%', marginBottom: '10px', fontSize: '11px' }}>
          {t('pool_draft_back_to_current')}
        </button>
      )}

      <QuotaRowsDisplay rows={quotaRows} t={t} />

      {capEnabled && (
        <div style={{ backgroundColor: 'var(--c-111)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: 'var(--c-666)' }}>{t('pool_draft_salary_used')} ({t(`pool_salarycap_source_short_${pool.rules.salaryCap.source}`)})</div>
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
            <PickRow key={p.id} pick={p} capEnabled={capEnabled} highlight={p.id === justPickedId} seasonId={seasonId}
              onClick={() => onOpenDetail?.(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Tous les choix =====================

export function AllPicksPanel({ pool, members, picks, lang, onOpenDetail }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [filterMemberId, setFilterMemberId] = useState('');
  const sorted = [...picks].sort((a, b) => {
    const an = a.pick_no ?? -1, bn = b.pick_no ?? -1;
    if (an !== bn) return bn - an;
    return new Date(b.picked_at) - new Date(a.picked_at);
  });
  const filtered = filterMemberId ? sorted.filter(p => p.member_id === filterMemberId) : sorted;

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={sectionTitle('var(--c-666)')}>{t('pool_draft_all_picks_title')}</div>
        <select value={filterMemberId} onChange={e => setFilterMemberId(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="">{t('pool_draft_filter_all_members')}</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.display_name || m.team_name}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '10px 0' }}>{t('pool_draft_no_picks_yet')}</div>
      ) : (
        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          {filtered.map(p => {
            const m = members.find(x => x.id === p.member_id);
            return (
              <div key={p.id} onClick={() => onOpenDetail?.(p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderTop: '1px solid var(--c-161616)', cursor: 'pointer' }}>
                <span style={{ fontSize: '10px', color: '#f97316', fontWeight: '700', minWidth: '26px' }}>{p.pick_no ? `#${p.pick_no}` : '—'}</span>
                {p.kind === 'team' ? <TeamLogo abbrev={p.nhl_team || p.player_id} size={28} /> : <PlayerAvatar src={!p.is_manual ? headshotUrl(p.player_id, seasonId, p.nhl_team) : null} size={28} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--c-white)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.player_name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--c-666)' }}>{t('pool_draft_round_label')} {p.round || '—'} · {m?.display_name || m?.team_name || '?'}</div>
                </div>
                <span style={{ fontSize: '9px', fontWeight: '700', color: POS_COLORS[p.position] }}>{p.position}</span>
              </div>
            );
          })}
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
  const { players, setPlayers, loading, error, blendInfo } = useNhlPlayers(seasonId);
  const { teams, loading: teamsLoading } = useNhlTeams();

  const myMember = members.find(m => m.user_id === utilisateur.id);

  const [innerTab, setInnerTab] = useState('available');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [posFilter, setPosFilter] = useState('ALL');
  const [showTaken, setShowTaken] = useState(false);
  const [nbShown, setNbShown] = useState(50);
  const [manualAdd, setManualAdd] = useState(null);
  const [manualAddTeam, setManualAddTeam] = useState(null);
  const [pendingPick, setPendingPick] = useState(null); // joueur/equipe en attente de confirmation
  const [salaryInput, setSalaryInput] = useState('0');
  const [pickForMemberId, setPickForMemberId] = useState(null); // mode "choisir pour un absent" (commissaire)
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [detailTarget, setDetailTarget] = useState(null);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const draftState = pool.draft_state || {};
  const order = draftState.order || [];
  const currentPick = draftState.current_pick || 0;
  const totalPicks = draftState.total_picks || 0;
  const paused = !!draftState.paused;
  // Pendant la pause, le minuteur affiche est fige sur le temps restant memorise au moment
  // de la pause (paused_remaining_ms), jamais recalcule depuis pick_deadline.
  const deadline = !paused && draftState.pick_deadline ? new Date(draftState.pick_deadline).getTime() : null;
  const secondsLeft = paused
    ? Math.ceil((draftState.paused_remaining_ms || 0) / 1000)
    : (deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null);
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

  function pickOwnerName(pick) {
    const m = members.find(x => x.id === pick.member_id);
    return m?.display_name || m?.team_name || '?';
  }

  const playersWithValue = useMemo(() => players.map(p => ({ ...p, valeurIA: calculerValeurIA(p, pool.rules) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, pool.rules]);

  const idsRecherche = useMemo(() => new Set(searchResults.map(r => String(r.playerId))), [searchResults]);
  const searchActive = search.trim().length >= 2;
  const filteredPlayers = useMemo(() => {
    return playersWithValue
      .filter(p => {
        if (posFilter !== 'ALL' && posFilter !== 'TEAM' && posReelToPickPosition(p.posReel) !== posFilter) return false;
        if (searchActive && !idsRecherche.has(p.id)) return false;
        if (!showTaken && takenPlayerIds.has(p.id)) return false;
        return true;
      })
      .sort((a, b) => b.valeurIA - a.valeurIA);
  }, [playersWithValue, posFilter, searchActive, idsRecherche, showTaken, takenPlayerIds]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams
      .filter(tm => {
        if (!showTaken && takenTeamIds.has(tm.abbrev)) return false;
        if (q && !tm.name.toLowerCase().includes(q) && !tm.abbrev.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [teams, search, showTaken, takenTeamIds]);

  async function runSearch(q) {
    if (posFilter === 'TEAM') return; // la recherche d'equipe est un filtre local (voir filteredTeams)
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
  // Un choix d'equipe NHL "libre" (teamPickCountsAsRound=false) n'est jamais bloquant pour le
  // minuteur : n'importe quel membre peut le faire a tout moment, pas seulement celui sur
  // l'horloge (contrairement aux joueurs/equipes qui comptent comme une ronde).
  const canPickTeamNow = !draftFinished && (pool.rules.draft.teamPickCountsAsRound ? !!activeMemberForPick : teamPicksRemaining > 0);

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
    const candidate = pickBestAvailableFor(currentMember, players, picks, pool, teams);
    if (!candidate) return;
    supabase.rpc('auto_pick', {
      p_pool_id: pool.id, p_kind: candidate.kind, p_player_id: candidate.playerId,
      p_player_name: candidate.playerName, p_position: candidate.position,
      p_nhl_team: candidate.nhlTeam, p_salary: candidate.salary,
    }).then(() => onAction?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, deadline, paused, draftFinished, currentPick, currentMember, players.length, teams.length]);

  function requestPick(player, kind = 'player') {
    setActionError('');
    setDetailTarget(null);
    setPendingPick({ ...player, kind });
    setSalaryInput('0');
  }

  async function confirmPick() {
    if (!pendingPick) return;
    setBusy(true); setActionError('');
    const isTeamPick = pendingPick.kind === 'team';
    const salary = (!isTeamPick && pool.rules.salaryCap.enabled) ? (parseInt(salaryInput, 10) || 0) : null;
    const pickPosition = isTeamPick ? 'TEAM' : posReelToPickPosition(pendingPick.posReel);
    const nhlTeam = isTeamPick ? pendingPick.id : pendingPick.team;
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

  function addManualTeam() {
    if (!manualAddTeam || !manualAddTeam.name.trim()) return;
    const abbrev = (manualAddTeam.abbrev || manualAddTeam.name).trim().toUpperCase().slice(0, 4);
    requestPick({ id: abbrev, name: manualAddTeam.name.trim(), manual: true }, 'team');
    setManualAddTeam(null);
  }

  async function doPause() { setBusy(true); await supabase.rpc('pause_draft', { p_pool_id: pool.id }); setBusy(false); onAction?.(); }
  async function doResume() { setBusy(true); await supabase.rpc('resume_draft', { p_pool_id: pool.id }); setBusy(false); onAction?.(); }
  async function doUndo() { setBusy(true); setActionError(''); const { error: err } = await supabase.rpc('undo_last_pick', { p_pool_id: pool.id }); setBusy(false); if (err) setActionError(mapPickError(err.message, t)); onAction?.(); }

  function openPlayerDetailFromPick(pick) {
    setDetailTarget({
      kind: pick.kind, id: pick.player_id, name: pick.player_name,
      team: pick.nhl_team, posReel: pick.position === 'G' ? 'G' : pick.position === 'D' ? 'D' : 'C',
      manual: pick.is_manual, rank: null,
    });
  }
  function openPlayerDetailFromList(player) {
    setDetailTarget({ kind: 'player', id: player.id, name: player.name, team: player.team, posReel: player.posReel, manual: player.manual });
  }
  function openTeamDetail(tm) {
    setDetailTarget({ kind: 'team', id: tm.abbrev, name: tm.name, rank: tm.rank });
  }

  const detailTaken = detailTarget && (detailTarget.kind === 'team' ? takenTeamIds.has(detailTarget.id) : takenPlayerIds.has(detailTarget.id));
  const detailOwner = detailTarget && detailTaken
    ? pickOwnerName(picks.find(p => p.kind === detailTarget.kind && p.player_id === detailTarget.id) || {})
    : null;
  const detailCanPick = detailTarget && !detailTaken && !!activeMemberForPick;

  if (draftFinished) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...card, textAlign: 'center', backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>{t('pool_draft_finished_title')}</div>
        </div>
        <LiveTeamFollowPanel pool={pool} members={members} picks={picks} myMember={myMember} currentMemberId={null} lang={lang} onOpenDetail={openPlayerDetailFromPick} />
        <AllPicksPanel pool={pool} members={members} picks={picks} lang={lang} onOpenDetail={openPlayerDetailFromPick} />
        <DraftBoard pool={pool} members={members} picks={picks} lang={lang} />
      </div>
    );
  }

  const tabs = isMobile ? ['available', 'picks', 'teams'] : ['available', 'picks'];

  return (
    <div>
      {/* Bandeau tour actuel */}
      <div style={{
        background: paused ? 'rgba(239,68,68,0.08)' : isMyTurn ? 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.08))' : 'rgba(249,115,22,0.04)',
        border: paused ? '1px solid rgba(239,68,68,0.3)' : isMyTurn ? '1px solid #f97316' : '1px solid rgba(249,115,22,0.2)',
        borderRadius: '14px', padding: '14px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>{t('pool_draft_on_the_clock')}</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--c-white)' }}>{isMyTurn ? '🎯 ' : ''}{currentMember?.display_name || currentMember?.team_name || '?'}</div>
          {nextMember && <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>{t('pool_draft_next_up')} : {nextMember.display_name || nextMember.team_name}</div>}
          {paused && <div style={{ fontSize: '13px', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>{t('pool_draft_paused_banner')}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--c-888)' }}>{t('pool_draft_round_label')} {round}/{totalRounds}</div>
          <div style={{ fontSize: '12px', color: 'var(--c-888)' }}>{t('pool_draft_pick_label')} #{currentPick}/{totalPicks}</div>
          {secondsLeft != null && (
            <div style={{ fontSize: '20px', fontWeight: '900', color: paused ? 'var(--c-666)' : (secondsLeft <= 10 ? '#ef4444' : '#f97316') }}>{secondsLeft}s</div>
          )}
        </div>
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

      {actionError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{actionError}</div>}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setInnerTab(tab)}
            style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: innerTab === tab ? '#f97316' : 'var(--c-111)', color: innerTab === tab ? 'white' : 'var(--c-888)', fontSize: '12px', fontWeight: '700' }}>
            {t(`pool_draft_tab_${tab}`)}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '16px' }}>
        <div>
          {innerTab === 'available' && (
            <>
              {/* Recherche / filtres */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <input value={search} onChange={e => { setSearch(e.target.value); setNbShown(50); runSearch(e.target.value); }}
                    placeholder={posFilter === 'TEAM' ? t('pool_draft_search_team_ph') : t('pool_draft_search_ph')} style={inputStyle} />
                  {posFilter !== 'TEAM' && searchOpen && search.trim().length >= 2 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--c-1a1a1a)', borderRadius: '10px', border: '1px solid var(--c-333)', marginTop: '4px', overflow: 'hidden', zIndex: 100 }}>
                      {searchResults.map((r, i) => {
                        const trouve = playersWithValue.find(p => p.id === String(r.playerId));
                        const pickExistant = picks.find(p => p.kind === 'player' && p.player_id === String(r.playerId));
                        const dejaPris = !!pickExistant;
                        return (
                          <button key={r.playerId ?? i} type="button" disabled={dejaPris}
                            onClick={() => {
                              const joueur = trouve || { ...construirJoueurManuel(r.name, r.positionCode || 'C', r.teamAbbrev || '', r.playerId) };
                              if (!trouve) setPlayers(ps => [...ps, joueur]);
                              setSearch(''); setSearchResults([]); setSearchOpen(false);
                              requestPick({ ...joueur, valeurIA: joueur.valeurIA ?? 0 });
                            }}
                            style={{ all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', width: '100%', cursor: dejaPris ? 'not-allowed' : 'pointer', borderBottom: '1px solid var(--c-222)', opacity: dejaPris ? 0.5 : 1 }}>
                            <TeamLogo abbrev={r.teamAbbrev} size={20} />
                            <div style={{ flex: 1, textAlign: 'left' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--c-white)' }}>{r.name}</div>
                              <div style={{ fontSize: '11px', color: dejaPris ? '#ef4444' : 'var(--c-666)' }}>
                                {dejaPris ? `${t('pool_draft_already_taken')} — ${pickOwnerName(pickExistant)}` : `${r.teamAbbrev} · ${r.positionCode}`}
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
                  {['ALL', 'F', 'D', 'G', 'TEAM'].map(p => (
                    <button key={p} onClick={() => { setPosFilter(p); setSearch(''); setSearchResults([]); setSearchOpen(false); setNbShown(50); }}
                      style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: posFilter === p ? (POS_COLORS[p] || '#f97316') : 'var(--c-111)', color: posFilter === p ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '700' }}>
                      {p === 'ALL' ? t('pool_draft_filter_all') : p === 'TEAM' ? t('pool_draft_filter_teams') : p}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showTaken} onChange={e => setShowTaken(e.target.checked)} />
                <span style={{ fontSize: '12px', color: 'var(--c-888)' }}>{t('pool_draft_show_taken')}</span>
              </label>

              {posFilter === 'TEAM' && (
                <button onClick={() => setManualAddTeam({ name: search, abbrev: '' })} style={{ ...btnSecondary, marginBottom: '12px' }}>
                  + {t('pool_draft_add_manual_team')}
                </button>
              )}

              {manualAddTeam && (
                <div style={{ ...card, border: '1px solid rgba(167,139,250,0.35)', marginBottom: '14px' }}>
                  <div style={sectionTitle('#a78bfa')}>{t('pool_draft_add_manual_team')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <input value={manualAddTeam.name} onChange={e => setManualAddTeam(a => ({ ...a, name: e.target.value }))} placeholder={t('pool_field_name')} style={inputStyle} />
                    <input value={manualAddTeam.abbrev} onChange={e => setManualAddTeam(a => ({ ...a, abbrev: e.target.value.toUpperCase() }))} placeholder="ABC" maxLength={4} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={addManualTeam} disabled={!manualAddTeam.name.trim()} style={{ ...btnPrimary, opacity: !manualAddTeam.name.trim() ? 0.5 : 1 }}>{t('pool_draft_add_btn')}</button>
                    <button onClick={() => setManualAddTeam(null)} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
                  </div>
                </div>
              )}

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

              {posFilter !== 'TEAM' && pool.rules.draftAssistant?.enabled && blendInfo.active && (
                <div style={{ fontSize: '11px', color: 'var(--c-666)', marginBottom: '10px' }}>
                  {t('pool_draft_ia_season_basis')
                    .replace('{saison}', currentSeasonLabelFromSeasonId(seasonId))
                    .replace('{saisonPrec}', currentSeasonLabelFromSeasonId(blendInfo.prevSeasonId))}
                </div>
              )}

              {posFilterToScoringGroup(posFilter) && pool.rules.draftAssistant?.enabled && !groupHasScoring(pool.rules, posFilterToScoringGroup(posFilter)) && (
                <div style={{ fontSize: '12px', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
                  {t('pool_draft_no_scoring_warning').replace('{position}', t(`pool_slot_${posFilter === 'F' ? 'forwards' : posFilter === 'D' ? 'defense' : 'goalies'}`))}
                </div>
              )}

              {posFilter === 'TEAM' ? (
                teamsLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-444)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
                ) : filteredTeams.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('pool_draft_no_players_found')}</div>
                ) : (
                  filteredTeams.map(tm => {
                    const taken = takenTeamIds.has(tm.abbrev);
                    const canPick = canPickTeamNow && !taken;
                    return (
                      <div key={tm.abbrev} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-161616)', borderRadius: '12px', padding: '10px 12px', marginBottom: '6px', opacity: taken ? 0.4 : 1 }}>
                        <div onClick={() => openTeamDetail(tm)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
                          <TeamLogo abbrev={tm.abbrev} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tm.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--c-555)' }}>{tm.abbrev}{tm.rank != null ? ` · ${t('pool_draft_team_rank')} #${tm.rank}` : ''}</div>
                          </div>
                        </div>
                        <button onClick={() => requestPick({ id: tm.abbrev, name: tm.name, team: tm.abbrev }, 'team')} disabled={!canPick}
                          style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: canPick ? 'pointer' : 'not-allowed', backgroundColor: canPick ? 'rgba(249,115,22,0.15)' : 'var(--c-1a1a1a)', color: canPick ? '#f97316' : 'var(--c-444)', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                          {taken ? t('pool_draft_already_taken_badge') : t('pool_draft_pick_btn')}
                        </button>
                      </div>
                    );
                  })
                )
              ) : loading ? (
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
                        <div onClick={() => openPlayerDetailFromList(j)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', minWidth: '100px' }}>
                          <PlayerAvatar src={!j.manual ? headshotUrl(j.id, seasonId, j.team) : null} size={32} />
                          <span style={{ fontSize: '10px', fontWeight: '700', color: POS_COLORS[posReelToPickPosition(j.posReel)], backgroundColor: 'var(--c-111)', borderRadius: '6px', padding: '3px 7px', flexShrink: 0 }}>{j.posReel}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--c-555)' }}>
                              {j.team} · {j.posGroup === 'goalie' ? `${j.wins}V · ${((j.savePct || 0) * 100).toFixed(1)}%` : `${j.points} PTS (${j.goals}B-${j.assists}P)`}
                            </div>
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
            </>
          )}

          {innerTab === 'picks' && (
            <AllPicksPanel pool={pool} members={members} picks={picks} lang={lang} onOpenDetail={openPlayerDetailFromPick} />
          )}

          {isMobile && innerTab === 'teams' && (
            <LiveTeamFollowPanel pool={pool} members={members} picks={picks} myMember={myMember} currentMemberId={currentMemberId} lang={lang} onOpenDetail={openPlayerDetailFromPick} />
          )}
        </div>

        {!isMobile && (
          <div>
            <LiveTeamFollowPanel pool={pool} members={members} picks={picks} myMember={myMember} currentMemberId={currentMemberId} lang={lang} onOpenDetail={openPlayerDetailFromPick} />
          </div>
        )}
      </div>

      {pendingPick && (
        <div onClick={() => setPendingPick(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '16px', padding: '20px', maxWidth: '360px', width: '100%' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--c-white)', marginBottom: '14px' }}>{pendingPick.name}</div>
            {pendingPick.kind !== 'team' && pool.rules.salaryCap.enabled && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--c-777)', marginBottom: '6px', fontWeight: '600' }}>
                  {t(`pool_salarycap_input_label_${pool.rules.salaryCap.source}`)}
                </div>
                <input type="number" autoFocus value={salaryInput} onChange={e => setSalaryInput(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
                <div style={{ fontSize: '10px', color: 'var(--c-555)', marginTop: '6px' }}>{t('pool_draft_salary_note')}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmPick} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1 }}>{t('pool_draft_confirm_pick')}</button>
              <button onClick={() => setPendingPick(null)} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <PlayerDetailModal target={detailTarget} seasonId={seasonId} lang={lang} taken={detailTaken} ownerName={detailOwner}
          canPick={detailCanPick} onPick={() => requestPick(detailTarget, detailTarget.kind)} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}

// Calcule, cote client, le meilleur choix disponible (joueur ou equipe) pour le poste le
// plus manquant du membre sur l'horloge (utilise pour l'auto-pick a l'expiration du
// minuteur). Une equipe n'est consideree que si rules.draft.teamPickCountsAsRound est actif
// (sinon le choix d'equipe est "libre", jamais bloquant pour le minuteur). Renvoie null si
// aucune donnee n'est encore chargee (un autre client ou le serveur tranchera alors).
export function pickBestAvailableFor(member, players, picks, pool, teams = []) {
  if (!member) return null;
  const memberPicks = picks.filter(p => p.member_id === member.id);
  const basePositions = pool.rules.poolType === 'classic' ? ['F', 'D', 'G'] : ['F', 'G'];
  const positions = pool.rules.draft.teamPickCountsAsRound ? [...basePositions, 'TEAM'] : basePositions;
  const needed = positions.find(pos => {
    const used = memberPicks.filter(p => (pos === 'F' && pool.rules.poolType !== 'classic') ? (p.position === 'F' || p.position === 'D') : p.position === pos).length;
    return used < computeRosterQuota(pool.rules, pos);
  });
  if (!needed) return null;

  if (needed === 'TEAM') {
    const takenTeams = new Set(picks.filter(p => p.kind === 'team').map(p => p.player_id));
    const available = teams.filter(tm => !takenTeams.has(tm.abbrev)).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    if (!available.length) return null;
    const best = available[0];
    return { kind: 'team', playerId: best.abbrev, playerName: best.name, position: 'TEAM', nhlTeam: best.abbrev, salary: null };
  }

  if (!players.length) return null;
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
