import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { getUrl } from './nhlApi';
import { useIsMobile, getDateStr } from './Analyses';
import { titreBetAuto } from './Dashboard';

// ===================== Persistance locale (masquer les montants) =====================
// try/catch systematique : localStorage peut etre indisponible (navigation privee, quota
// plein, restrictions navigateur) -- jamais bloquant, juste perdu pour la session suivante.
const HIDE_AMOUNTS_KEY = 'betrics_home_hide_amounts';

export function readHideAmounts() {
  try { return window.localStorage.getItem(HIDE_AMOUNTS_KEY) === '1'; } catch { return false; }
}

export function writeHideAmounts(value) {
  try { window.localStorage.setItem(HIDE_AMOUNTS_KEY, value ? '1' : '0'); } catch { /* ignore */ }
}

// ===================== Fonctions pures (exportees pour les tests) =====================

export function greetingKey(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'home_greeting_morning';
  if (h < 18) return 'home_greeting_afternoon';
  return 'home_greeting_evening';
}

// Plus longue serie de victoires consecutives dans une liste de paris regles, triee du plus
// ancien au plus recent (statut 'gagne'/'perdu'/autre -- toute valeur differente de 'gagne'
// casse la serie, y compris un statut inattendu).
export function computeBestWinStreak(settledAsc) {
  let best = 0;
  let current = 0;
  for (const bet of settledAsc) {
    if (bet.statut === 'gagne') { current += 1; if (current > best) best = current; }
    else current = 0;
  }
  return best;
}

function isSameDay(dateStr, todayStr) {
  return !!dateStr && String(dateStr).slice(0, 10) === todayStr;
}

// Variation du jour ($) : profit/perte des paris regles aujourd'hui (manuels + importes).
// Approximation honnete (les paris manuels n'ont pas de date de reglement separee de
// date_pari) plutot qu'une fabrication : documentee dans le libelle i18n ("Variation du jour").
export function computeTodayChangeAmount(paris, betsAuto, todayStr) {
  const manual = (paris || []).filter(p => p.statut !== 'actif' && isSameDay(p.date_pari, todayStr))
    .reduce((s, p) => s + (Number(p.profit) || 0), 0);
  const auto = (betsAuto || []).filter(b => b.statut !== 'pending' && isSameDay(b.verified_at, todayStr))
    .reduce((s, b) => s + (Number(b.resultat) || 0), 0);
  return manual + auto;
}

export function computeTodayChangePercent(changeAmount, bankroll) {
  const before = (bankroll || 0) - changeAmount;
  if (!before || before <= 0) return 0;
  return (changeAmount / before) * 100;
}

// Reconstruit un objet "equipe" compatible avec FicheEquipeWS (qui attend le format de
// l'endpoint standings) a partir d'un objet equipe du calendrier NHL (schedule), beaucoup
// plus pauvre (abbrev/placeName/logo seulement). Les champs absents (division, fiche...)
// restent simplement vides cote affichage plutot que fabriques.
export function buildEquipeFromScheduleTeam(teamObj) {
  if (!teamObj) return null;
  return {
    teamAbbrev: { default: teamObj.abbrev },
    teamName: { default: teamObj.placeName?.default || teamObj.commonName?.default || teamObj.abbrev },
    teamLogo: teamObj.logo,
  };
}

const CHART_PERIOD_DAYS = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, all: Infinity };

// Donnees de la courbe de profit pour une periode/un mode donnes. mode='value' -> profit
// cumulatif ($) ; mode='return' -> rendement cumulatif (%) = profit cumulatif / mise cumulee.
export function computeChartSeries(parisTraites, period, mode) {
  const now = new Date();
  const days = CHART_PERIOD_DAYS[period] ?? CHART_PERIOD_DAYS['1m'];
  const filtered = (parisTraites || [])
    .filter(p => p.date_pari && (now - new Date(p.date_pari)) / 86400000 <= days)
    .sort((a, b) => new Date(a.date_pari) - new Date(b.date_pari));

  let cumulProfit = 0;
  let cumulStake = 0;
  const values = filtered.map(p => {
    cumulProfit += Number(p.profit) || 0;
    cumulStake += Number(p.mise) || 0;
    return mode === 'return' ? (cumulStake > 0 ? (cumulProfit / cumulStake) * 100 : 0) : cumulProfit;
  });
  return { values, finalValue: values.length ? values[values.length - 1] : 0 };
}

// ===================== Styles partages (meme langage visuel que le reste de l'app) =====================

const cardStyle = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '18px', padding: '18px', border: '1px solid var(--c-161616)' };
const heroCardStyle = { position: 'relative', borderRadius: '24px', padding: '28px', overflow: 'hidden', background: 'linear-gradient(135deg, var(--c-1a1a1a) 0%, var(--c-111) 100%)', border: '1px solid var(--c-222)' };
const chipBase = { padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' };

function chip(active) {
  return { ...chipBase, backgroundColor: active ? '#f97316' : 'var(--c-1a1a1a)', color: active ? 'white' : 'var(--c-555)' };
}

// ===================== Skeleton / etats vides generiques =====================

function SkeletonBlock({ height = 16, width = '100%' }) {
  return <div className="home-skel" style={{ height, width, borderRadius: '8px' }} />;
}

function CardSkeleton({ lines = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Array.from({ length: lines }).map((_, i) => <SkeletonBlock key={i} height={i === 0 ? 18 : 14} width={i === 0 ? '50%' : '100%'} />)}
    </div>
  );
}

function EmptyState({ icon = '—', title, sub, cta, onCta }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      {title && <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '13px', fontWeight: '600' }}>{title}</p>}
      {sub && <p style={{ margin: 0, color: 'var(--c-333)', fontSize: '12px', maxWidth: '240px' }}>{sub}</p>}
      {cta && (
        <button onClick={onCta} style={{ marginTop: '8px', padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' }}>
          {cta}
        </button>
      )}
    </div>
  );
}

// ===================== Bandeau d'accueil + bankroll (colonne principale) =====================

function GreetingBanner({ t, displayName }) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', color: 'var(--c-444)', fontSize: '13px' }}>{t(greetingKey())}</p>
      <h2 style={{ margin: 0, fontSize: '30px', fontWeight: '800', letterSpacing: '-0.8px', color: 'var(--c-white)' }}>{displayName}</h2>
    </div>
  );
}

function BankrollHero({ t, bankroll, loading, changeAmount, changePercent, hideAmounts, onToggleHide }) {
  const display = bankroll != null ? bankroll.toFixed(2) : null;
  const changePositive = changeAmount >= 0;
  return (
    <div style={heroCardStyle}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{t('home_bankroll')}</p>
        <button
          onClick={onToggleHide}
          aria-label={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')}
          title={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')}
          style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-0a0a0a)', color: 'var(--c-888)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {hideAmounts ? '🙈' : '👁️'}
        </button>
      </div>

      {loading || display == null ? (
        <SkeletonBlock height={56} width="60%" />
      ) : (
        <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-2px', lineHeight: 1 }}>
          {hideAmounts ? t('home_amounts_hidden') : `$${display}`}
        </h1>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('home_today_change')}</span>
        {!loading && (
          <span style={{ fontSize: '14px', fontWeight: '800', color: changePositive ? '#22c55e' : '#ef4444' }}>
            {hideAmounts
              ? t('home_amounts_hidden')
              : `${changePositive ? '+' : ''}$${changeAmount.toFixed(2)} (${changePositive ? '+' : ''}${changePercent.toFixed(1)}%)`}
          </span>
        )}
      </div>
    </div>
  );
}

// ===================== Graphique de profit (agrandi, bascule Valeur/Rendement) =====================

const CHART_PERIODS = ['1d', '1w', '1m', '3m', '6m', '1y', 'all'];

function ProfitChartCard({ t, parisTraites, loading }) {
  const [period, setPeriod] = useState('1m');
  const [mode, setMode] = useState('value');

  const { values, finalValue } = useMemo(() => computeChartSeries(parisTraites, period, mode), [parisTraites, period, mode]);

  const H = 100, W = 400;
  const maxVal = Math.max(...values, mode === 'return' ? 1 : 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  const points = values.map((v, i) => {
    const x = values.length === 1 ? W / 2 : (i / (values.length - 1)) * W;
    const y = H - ((v - minVal) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const positive = finalValue >= 0;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--c-555)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('home_profit_curve')}</span>
          {!loading && (
            <span style={{ fontSize: '15px', fontWeight: '800', color: positive ? '#22c55e' : '#ef4444' }}>
              {mode === 'value' ? `${positive ? '+' : ''}$${finalValue.toFixed(2)}` : `${positive ? '+' : ''}${finalValue.toFixed(1)}%`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--c-0a0a0a)', borderRadius: '10px', padding: '3px' }}>
          {['value', 'return'].map(m => (
            <button key={m} className="home-chip" onClick={() => setMode(m)} style={chip(mode === m)}>
              {t(m === 'value' ? 'home_chart_mode_value' : 'home_chart_mode_return')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {CHART_PERIODS.map(p => (
          <button key={p} className="home-chip" onClick={() => setPeriod(p)} style={chip(period === p)}>
            {t(`home_chart_period_${p === 'all' ? 'all' : p}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonBlock height={340} />
      ) : values.length > 1 ? (
        <div style={{ height: 'clamp(320px, 30vw, 380px)' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="homeProfitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity="0.35" />
                <stop offset="100%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={`0,${H} ${points} ${W},${H}`} fill="url(#homeProfitGrad)" stroke="none" />
            <polyline points={points} fill="none" stroke={positive ? '#22c55e' : '#ef4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="0" y1={H - ((0 - minVal) / range) * H} x2={W} y2={H - ((0 - minVal) / range) * H} stroke="var(--c-333)" strokeWidth="0.5" strokeDasharray="4,4" />
          </svg>
        </div>
      ) : (
        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--c-333)', fontSize: '13px' }}>{t('home_no_bets_period')}</span>
        </div>
      )}
    </div>
  );
}

// ===================== Rangee de cartes stats =====================

function StatCard({ label, value, color = 'var(--c-white)' }) {
  return (
    <div style={{ ...cardStyle, padding: '16px', textAlign: 'center' }}>
      <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '900', color, letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

function StatsRow({ t, loading, roi, winRate, activeCount, bestStreak }) {
  if (loading) {
    return (
      <div className="home-stats-grid">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ ...cardStyle, padding: '16px' }}><CardSkeleton lines={2} /></div>)}
      </div>
    );
  }
  const roiNum = parseFloat(roi);
  return (
    <div className="home-stats-grid">
      <StatCard label={t('home_stat_roi')} value={`${roiNum >= 0 ? '+' : ''}${roi}%`} color={roiNum >= 0 ? '#22c55e' : '#ef4444'} />
      <StatCard label={t('home_stat_win_rate')} value={`${winRate}%`} />
      <StatCard label={t('home_stat_active_bets')} value={activeCount} color="#f97316" />
      <StatCard label={t('home_stat_best_streak')} value={bestStreak > 0 ? `${bestStreak} ${t('home_stat_streak_unit')}` : '—'} color={bestStreak > 0 ? '#22c55e' : 'var(--c-white)'} />
    </div>
  );
}

// ===================== Paris recents =====================

function RecentBetsCard({ t, loading, recentCombines, onSeeAll }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_recent_bets')}</h3>
        <button onClick={onSeeAll} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '12px', cursor: 'pointer', padding: '6px 2px' }}>{t('home_see_all')}</button>
      </div>
      {loading ? (
        <CardSkeleton lines={3} />
      ) : recentCombines.length === 0 ? (
        <EmptyState icon="🏒" title={t('home_no_bets_title')} sub={t('home_no_bets_sub')} />
      ) : recentCombines.map((p, i) => (
        <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '13px', color: 'var(--c-white)' }}>{p.titre}</p>
            <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px' }}>{p.bookmaker} · {t('home_odds')} {p.cote}</p>
          </div>
          {p.statut === 'actif' ? (
            <span style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: '600' }}>{t('home_active_badge')}</span>
          ) : (
            <span style={{ color: p.statut === 'gagne' ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '14px' }}>
              {p.statut === 'gagne' ? '+' : '-'}${Math.abs(p.statut === 'gagne' ? p.profit : p.mise).toFixed(2)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ===================== Colonne de droite : matchs + calendrier =====================

function TonightGamesCard({ t, loading, games, selectedDate, todayStr, onOpenTeam }) {
  const title = selectedDate === todayStr ? t('home_tonight') : `${t('home_games_on')} ${selectedDate}`;
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{title}</h3>
        {!loading && games.length > 0 && <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600' }}>{games.length} {t('home_games_unit')}</span>}
      </div>
      {loading ? (
        <CardSkeleton lines={3} />
      ) : games.length === 0 ? (
        <EmptyState icon="🏒" title={t('home_no_games_day')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {games.map((m, i) => {
            const away = m.awayTeam?.abbrev;
            const home = m.homeTeam?.abbrev;
            const heure = new Date(m.startTimeUTC).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
            const isLive = m.gameState === 'LIVE' || m.gameState === 'CRIT';
            return (
              <button
                key={m.id || i}
                onClick={() => onOpenTeam(buildEquipeFromScheduleTeam(m.homeTeam))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none', background: 'none', border: 'none', borderTopStyle: 'solid', cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)' }}>{away}</span>
                  <span style={{ fontSize: '11px', color: 'var(--c-444)' }}>@</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)' }}>{home}</span>
                </div>
                {isLive ? (
                  <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>LIVE</span>
                ) : (
                  <span style={{ color: 'var(--c-555)', fontSize: '12px' }}>{heure}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekCalendarCard({ t, loading, week, selectedDate, onSelectDate }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_calendar_title')}</h3>
      {loading ? (
        <CardSkeleton lines={1} />
      ) : week.length === 0 ? (
        <EmptyState icon="📅" title={t('home_calendar_no_games')} />
      ) : (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {week.map(day => {
            const active = day.date === selectedDate;
            const label = new Date(day.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' });
            const count = day.games?.length || 0;
            return (
              <button
                key={day.date}
                className="home-chip"
                onClick={() => onSelectDate(day.date)}
                style={{ flex: '0 0 auto', minWidth: '64px', padding: '10px 6px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: active ? '#f97316' : 'var(--c-111)', color: active ? 'white' : 'var(--c-888)', textAlign: 'center' }}
              >
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: '11px', marginTop: '3px', color: active ? 'rgba(255,255,255,0.85)' : 'var(--c-555)' }}>
                  {count > 0 ? t('home_calendar_games_count').replace('{n}', count) : t('home_calendar_no_games')}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================== Mes pools =====================

function MyPoolsCard({ t, loading, pools, onOpenPool, onCreateOrJoin }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_pools_title')}</h3>
      {loading ? (
        <CardSkeleton lines={2} />
      ) : pools.length === 0 ? (
        <EmptyState icon="🏆" title={t('home_pools_empty_title')} cta={t('home_pools_empty_cta')} onCta={onCreateOrJoin} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pools.map(p => (
            <div key={p.poolId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderTop: '1px solid var(--c-111)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--c-555)' }}>
                  {t('home_pools_rank_short')} #{p.rank ?? '—'} · {t('home_pools_points_short')} {Number(p.points || 0).toFixed(1)}
                </div>
              </div>
              <button onClick={() => onOpenPool(p.poolId)} style={{ flex: '0 0 auto', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-111)', color: 'var(--c-ccc)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                {t('home_pools_open_btn')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Favoris (aucun systeme existant : etat vide uniquement) =====================

function FavoritesCard({ t }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_favorites_title')}</h3>
      <EmptyState icon="⭐" sub={t('home_favorites_empty')} />
    </div>
  );
}

// ===================== Idees du jour + carte verrouillee Elite =====================

function DailyIdeasCard({ t, loading, ideas, onOpenElite }) {
  const hasIdeas = ideas && (ideas.hotPlayer || ideas.streakTeam);
  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_ideas_title')}</h3>
      {loading ? (
        <CardSkeleton lines={3} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!hasIdeas && <div style={{ color: 'var(--c-333)', fontSize: '12px', padding: '4px 0 6px' }}>{t('home_ideas_empty')}</div>}
          {ideas?.hotPlayer && (
            <div style={{ backgroundColor: 'var(--c-111)', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#f97316', marginBottom: '4px' }}>🔥 {t('home_idea_hot_player_title')}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-ccc)' }}>
                {t('home_idea_hot_player_body').replace('{nom}', ideas.hotPlayer.player_name).replace('{equipe}', ideas.hotPlayer.team_abbrev).replace('{pts}', ideas.hotPlayer.points)}
              </div>
            </div>
          )}
          {ideas?.streakTeam && (
            <div style={{ backgroundColor: 'var(--c-111)', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', marginBottom: '4px' }}>📈 {t('home_idea_streak_title')}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-ccc)' }}>
                {t('home_idea_streak_body').replace('{equipe}', ideas.streakTeam.team).replace('{n}', ideas.streakTeam.n)}
              </div>
            </div>
          )}

          <button
            onClick={onOpenElite}
            style={{ textAlign: 'left', backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span style={{ fontSize: '18px' }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-white)' }}>{t('home_elite_title')}</span>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: '6px', padding: '2px 6px', letterSpacing: '0.5px' }}>{t('home_elite_badge')}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-555)' }}>{t('home_elite_body')}</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function ComingSoonOverlay({ t, onClose }) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label={t('home_coming_soon_title')}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, maxWidth: '360px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '800', color: 'var(--c-white)' }}>{t('home_coming_soon_title')}</h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--c-666)' }}>{t('home_coming_soon_body')}</p>
        <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' }}>
          {t('home_coming_soon_close')}
        </button>
      </div>
    </div>
  );
}

// ===================== Mise en page tablette/web (>=768px) =====================

function DesktopHomeDashboard({ t, data, onGoToBets, onGoToPool, onOpenTeamFiche }) {
  const {
    displayName, bankroll, bankrollLoading, paris, betsAuto, parisTraites, betsAutoTraites,
    recentCombines, roi, winRate, parisActifs, betsAutoActifs, betsLoading,
    pools, poolsLoading, week, weekLoading, selectedDate, setSelectedDate, dailyIdeas, ideasLoading,
  } = data;

  const [hideAmounts, setHideAmounts] = useState(() => readHideAmounts());
  const [showComingSoon, setShowComingSoon] = useState(false);

  function toggleHideAmounts() {
    setHideAmounts(prev => { writeHideAmounts(!prev); return !prev; });
  }

  const todayStr = getDateStr(new Date());
  const changeAmount = computeTodayChangeAmount(paris, betsAuto, todayStr);
  const changePercent = computeTodayChangePercent(changeAmount, bankroll || 0);

  const settledCombinedAsc = useMemo(() => {
    const list = [
      ...parisTraites.map(p => ({ statut: p.statut, date: p.date_pari })),
      ...betsAutoTraites.map(b => ({ statut: b.statut, date: b.verified_at || b.created_at })),
    ].filter(x => x.date);
    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [parisTraites, betsAutoTraites]);
  const bestStreak = computeBestWinStreak(settledCombinedAsc);
  const activeCount = parisActifs.length + betsAutoActifs.length;

  const selectedDayGames = useMemo(() => {
    const day = week.find(d => d.date === selectedDate);
    return day?.games || [];
  }, [week, selectedDate]);

  return (
    <div className="home-grid">
      <style>{`
        @keyframes home-skel-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.8; } }
        .home-skel { background-color: var(--c-1a1a1a); animation: home-skel-pulse 1.4s ease-in-out infinite; }
      `}</style>

      <div className="home-main-col">
        <GreetingBanner t={t} displayName={displayName} />
        <BankrollHero
          t={t} bankroll={bankroll} loading={bankrollLoading}
          changeAmount={changeAmount} changePercent={changePercent}
          hideAmounts={hideAmounts} onToggleHide={toggleHideAmounts}
        />
        <ProfitChartCard t={t} parisTraites={parisTraites} loading={betsLoading} />
        <StatsRow t={t} loading={betsLoading} roi={roi} winRate={winRate} activeCount={activeCount} bestStreak={bestStreak} />
        <RecentBetsCard t={t} loading={betsLoading} recentCombines={recentCombines} onSeeAll={onGoToBets} />
      </div>

      <div className="home-side-col">
        <TonightGamesCard t={t} loading={weekLoading} games={selectedDayGames} selectedDate={selectedDate} todayStr={todayStr} onOpenTeam={onOpenTeamFiche} />
        <WeekCalendarCard t={t} loading={weekLoading} week={week} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <MyPoolsCard t={t} loading={poolsLoading} pools={pools} onOpenPool={onGoToPool} onCreateOrJoin={() => onGoToPool(null)} />
        <FavoritesCard t={t} />
        <DailyIdeasCard t={t} loading={ideasLoading} ideas={dailyIdeas} onOpenElite={() => setShowComingSoon(true)} />
      </div>

      {showComingSoon && <ComingSoonOverlay t={t} onClose={() => setShowComingSoon(false)} />}
    </div>
  );
}

// ===================== Mise en page mobile (<768px) : INCHANGEE (meme JSX qu'avant le redesign) =====================

function MobileHomeDashboard({ t, data, onGoToBets }) {
  const {
    displayName, bankroll, paris, betsAuto, parisActifs, roi, winRate, recentCombines,
  } = data;

  const [filtreGraph, setFiltreGraph] = useState('1m');
  const [filtreCustomDebut, setFiltreCustomDebut] = useState('');
  const [filtreCustomFin, setFiltreCustomFin] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [matchsSoir, setMatchsSoir] = useState([]);

  useEffect(() => {
    const today = getDateStr(new Date());
    fetch(getUrl('schedule/' + today))
      .then(r => r.json())
      .then(d => setMatchsSoir((d.gameWeek?.[0]?.games || []).slice(0, 5)))
      .catch(() => {});
  }, []);

  const bankrollDisplay = bankroll != null ? bankroll.toFixed(2) : '...';
  const kellyStake = bankroll != null ? (bankroll * 0.05).toFixed(2) : '...';

  const now = new Date();
  const periodeJoursHome = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
  const parisTraites = paris.filter(p => p.statut !== 'actif');
  const paris30 = parisTraites.filter(p => p.date_pari && (now - new Date(p.date_pari)) / 86400000 <= 30);
  const profit30 = paris30.reduce((a, p) => a + (p.profit || 0), 0);
  const gagnes30 = paris30.filter(p => p.statut === 'gagne').length;
  const winRate30 = paris30.length > 0 ? Math.round(gagnes30 / paris30.length * 100) : 0;
  const mise30 = paris30.reduce((a, p) => a + (p.mise || 0), 0);
  const roi30 = mise30 > 0 ? ((profit30 / mise30) * 100).toFixed(1) : '0.0';

  const parisFiltresGraph = parisTraites.filter(p => {
    if (!p.date_pari) return false;
    const datePari = new Date(p.date_pari);
    if (filtreCustomDebut && filtreCustomFin) {
      const debut = new Date(filtreCustomDebut);
      const fin = new Date(filtreCustomFin);
      fin.setHours(23, 59, 59);
      return datePari >= debut && datePari <= fin;
    }
    const diff = (now - datePari) / 86400000;
    return diff <= periodeJoursHome[filtreGraph];
  });

  const parisTraitesSorted = [...parisFiltresGraph].sort((a, b) => new Date(a.date_pari) - new Date(b.date_pari));
  let cumul = 0;
  const curveData = parisTraitesSorted.map(p => { cumul += (p.profit || 0); return cumul; });
  const maxVal = Math.max(...curveData, 1);
  const minVal = Math.min(...curveData, 0);
  const range = maxVal - minVal || 1;
  const H = 60;
  const W = 200;
  const points = curveData.map((v, i) => {
    const x = curveData.length === 1 ? W / 2 : (i / (curveData.length - 1)) * W;
    const y = H - ((v - minVal) / range) * H;
    return x + ',' + y;
  }).join(' ');
  const profitFiltre = parisFiltresGraph.reduce((a, p) => a + (p.profit || 0), 0);

  return (
    <div style={{ padding: '20px 20px 0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <p style={{ margin: '0 0 2px', color: 'var(--c-444)', fontSize: '13px' }}>{t('home_welcome')}</p>
        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.8px', color: 'var(--c-white)' }}>{displayName}</h2>
      </div>

      <div style={{ position: 'relative', borderRadius: '24px', padding: '24px', marginBottom: '16px', overflow: 'hidden', background: 'linear-gradient(135deg, var(--c-1a1a1a) 0%, var(--c-111) 100%)', border: '1px solid var(--c-222)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{t('home_bankroll')}</p>
          <div style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '20px', padding: '3px 10px' }}>
            <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600' }}>{t('home_live')}</span>
          </div>
        </div>
        <h1 style={{ margin: '6px 0 16px', fontSize: '44px', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-2px', lineHeight: 1 }}>
          ${bankrollDisplay !== '...' ? bankrollDisplay.split('.')[0] : '0'}<span style={{ fontSize: '24px', color: 'var(--c-555)' }}>.{bankrollDisplay !== '...' ? (bankrollDisplay.split('.')[1] || '00') : '00'}</span>
        </h1>

        <div style={{ marginBottom: '12px', backgroundColor: 'var(--c-0a0a0a)', borderRadius: '12px', padding: '12px', border: '1px solid var(--c-1a1a1a)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('home_last30')}</span>
            <span style={{ fontSize: '10px', color: '#f97316', fontWeight: '600' }}>{t('home_live')}</span>
          </div>
          <div style={{ display: 'flex' }}>
            {[
              [t('home_profit'), (profit30 >= 0 ? '+' : '') + '$' + profit30.toFixed(2), profit30 >= 0 ? '#22c55e' : '#ef4444'],
              [t('home_win_rate'), winRate30 + '%', 'white'],
              [t('home_roi'), (parseFloat(roi30) >= 0 ? '+' : '') + roi30 + '%', parseFloat(roi30) >= 0 ? '#22c55e' : '#ef4444'],
            ].map(([label, val, color], i) => (
              <div key={i} style={{ flex: 1, borderRight: i < 2 ? '1px solid var(--c-1a1a1a)' : 'none', paddingRight: i < 2 ? '10px' : '0', paddingLeft: i > 0 ? '10px' : '0' }}>
                <p style={{ margin: '0 0 2px', color: 'var(--c-444)', fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px', backgroundColor: 'var(--c-0d0d0d)', borderRadius: '12px', padding: '12px', border: '1px solid var(--c-1a1a1a)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('home_profit_curve')}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: profitFiltre >= 0 ? '#22c55e' : '#ef4444' }}>{profitFiltre >= 0 ? '+' : ''}${profitFiltre.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y']].map(([val, label]) => (
                <button key={val} onClick={() => { setFiltreGraph(val); setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
                  style={{ padding: '2px 8px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: filtreGraph === val && !filtreCustomDebut ? '#f97316' : 'var(--c-1a1a1a)', color: filtreGraph === val && !filtreCustomDebut ? 'white' : 'var(--c-555)', fontSize: '10px', fontWeight: '600' }}>
                  {label}
                </button>
              ))}
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ padding: '2px 6px', borderRadius: '20px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: showAdvanced || filtreCustomDebut ? '#f97316' : 'transparent', color: showAdvanced || filtreCustomDebut ? 'white' : 'var(--c-555)', fontSize: '11px' }}>
                ⚙
              </button>
            </div>
          </div>
          {showAdvanced && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              <input type="date" value={filtreCustomDebut} onChange={e => { setFiltreCustomDebut(e.target.value); setFiltreGraph('1m'); }}
                style={{ flex: 1, padding: '6px 8px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '8px', color: 'var(--c-white)', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ color: 'var(--c-444)', fontSize: '10px' }}>→</span>
              <input type="date" value={filtreCustomFin} onChange={e => { setFiltreCustomFin(e.target.value); setFiltreGraph('1m'); }}
                style={{ flex: 1, padding: '6px 8px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '8px', color: 'var(--c-white)', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              {(filtreCustomDebut || filtreCustomFin) && (
                <button onClick={() => { setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
                  style={{ padding: '6px 8px', backgroundColor: 'transparent', border: '1px solid var(--c-333)', borderRadius: '8px', color: 'var(--c-555)', cursor: 'pointer', fontSize: '10px' }}>✕</button>
              )}
            </div>
          )}
          {curveData.length > 1 ? (
            <svg width="100%" height={H} viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none">
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={profitFiltre >= 0 ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={profitFiltre >= 0 ? '#22c55e' : '#ef4444'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline points={points} fill="none" stroke={profitFiltre >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="0" y1={H - ((0 - minVal) / range) * H} x2={W} y2={H - ((0 - minVal) / range) * H} stroke="var(--c-333)" strokeWidth="0.5" strokeDasharray="4,4" />
            </svg>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--c-333)', fontSize: '11px' }}>{t('home_no_bets_period')}</div>
          )}
        </div>

        <div style={{ display: 'flex', borderTop: '1px solid var(--c-1f1f1f)', paddingTop: '16px' }}>
          {[[t('home_roi'), `${parseFloat(roi) >= 0 ? '+' : ''}${roi}%`, parseFloat(roi) >= 0 ? '#22c55e' : '#ef4444'], [t('home_win_rate'), `${winRate}%`, 'white'], [t('home_active'), `${parisActifs.length} ${t('home_bets_unit')}`, '#f97316']].map(([label, val, color], i) => (
            <div key={i} style={{ flex: 1, borderRight: i < 2 ? '1px solid var(--c-1f1f1f)' : 'none', paddingRight: i < 2 ? '16px' : '0', paddingLeft: i > 0 ? '16px' : '0' }}>
              <p style={{ margin: '0 0 3px', color: 'var(--c-444)', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color }}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {matchsSoir.length > 0 && (
        <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '18px', padding: '18px', border: '1px solid var(--c-161616)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_tonight')}</h3>
            <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600' }}>{matchsSoir.length} {t('home_games_unit')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matchsSoir.map((m, i) => {
              const away = m.awayTeam?.abbrev;
              const home = m.homeTeam?.abbrev;
              const heure = new Date(m.startTimeUTC).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
              const isLive = m.gameState === 'LIVE' || m.gameState === 'CRIT';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)' }}>{away}</span>
                    <span style={{ fontSize: '11px', color: 'var(--c-444)' }}>@</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)' }}>{home}</span>
                  </div>
                  {isLive ? (
                    <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>LIVE</span>
                  ) : (
                    <span style={{ color: 'var(--c-555)', fontSize: '12px' }}>{heure}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '18px', padding: '18px', border: '1px solid var(--c-161616)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>{t('home_recent_bets')}</h3>
          <span onClick={onGoToBets} style={{ color: '#f97316', fontSize: '12px', cursor: 'pointer' }}>{t('home_see_all')}</span>
        </div>
        {recentCombines.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '8px' }}>
            <span style={{ fontSize: '28px' }}>🏒</span>
            <p style={{ margin: 0, color: 'var(--c-333)', fontSize: '13px' }}>{t('home_no_bets_title')}</p>
            <p style={{ margin: 0, color: 'var(--c-222)', fontSize: '12px' }}>{t('home_no_bets_sub')}</p>
          </div>
        ) : recentCombines.map((p, i) => (
          <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '13px', color: 'var(--c-white)' }}>{p.titre}</p>
              <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px' }}>{p.bookmaker} · {t('home_odds')} {p.cote}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {p.statut === 'actif' ? (
                <span style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: '600' }}>{t('home_active_badge')}</span>
              ) : (
                <span style={{ color: p.statut === 'gagne' ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '14px' }}>
                  {p.statut === 'gagne' ? '+' : '-'}${Math.abs(p.statut === 'gagne' ? p.profit : p.mise).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', color: 'var(--c-444)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('home_kelly')}</p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#22c55e', letterSpacing: '-1px' }}>${kellyStake.split('.')[0]}<span style={{ fontSize: '18px', color: '#1a6b3c' }}>.{kellyStake.split('.')[1] || '00'}</span></p>
          </div>
          <div style={{ backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: '14px', padding: '12px 16px', border: '1px solid rgba(34,197,94,0.15)' }}>
            <p style={{ margin: '0 0 2px', color: '#22c55e', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>{t('home_per_bet')}</p>
            <p style={{ margin: 0, color: '#1a6b3c', fontSize: '10px', textAlign: 'center' }}>{t('home_max_risk')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Composant principal : donnees partagees + choix de mise en page =====================

export function HomeDashboard({ utilisateur, onGoToProps, onGoToAnalytics, onGoToBets, onGoToPool, onOpenTeamFiche, lang = 'en' }) {
  const t = getT(lang);
  const isMobile = useIsMobile();

  const [firstName, setFirstName] = useState('');
  const [bankroll, setBankroll] = useState(null);
  const [bankrollLoading, setBankrollLoading] = useState(true);
  const [paris, setParis] = useState([]);
  const [betsAuto, setBetsAuto] = useState([]);
  const [betsLoading, setBetsLoading] = useState(true);

  const [pools, setPools] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [week, setWeek] = useState([]);
  const [weekLoading, setWeekLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => getDateStr(new Date()));
  const [dailyIdeas, setDailyIdeas] = useState(null);
  const [ideasLoading, setIdeasLoading] = useState(true);

  // Donnees communes (bankroll / paris / betsAuto / profil) : utilisees par les DEUX mises en
  // page (mobile inchangee et desktop/tablette), un seul chargement.
  useEffect(() => {
    if (!utilisateur?.id) return;
    supabase.from('profiles').select('first_name').eq('id', utilisateur.id).single()
      .then(({ data }) => { if (data?.first_name) setFirstName(data.first_name); });
    supabase.from('bankroll').select('montant').eq('user_id', utilisateur.id).maybeSingle()
      .then(({ data }) => { setBankroll(data ? data.montant : 0); setBankrollLoading(false); })
      .catch(() => setBankrollLoading(false));
    Promise.all([
      supabase.from('paris').select('*').eq('user_id', utilisateur.id).order('date_pari', { ascending: false }),
      supabase.from('bets_auto').select('*').eq('user_id', utilisateur.id).order('created_at', { ascending: false }),
    ]).then(([parisRes, betsAutoRes]) => {
      setParis(parisRes.data || []);
      setBetsAuto(betsAutoRes.data || []);
      setBetsLoading(false);
    }).catch(() => setBetsLoading(false));
  }, [utilisateur?.id]);

  // Donnees propres a la mise en page tablette/web (pools, calendrier, idees du jour) : pas
  // besoin sur mobile, qui ne les affiche pas (comportement actuel inchangé).
  useEffect(() => {
    if (isMobile || !utilisateur?.id) return;
    let annule = false;
    chargerMesPools(utilisateur.id).then(res => { if (!annule) { setPools(res); setPoolsLoading(false); } });
    return () => { annule = true; };
  }, [isMobile, utilisateur?.id]);

  useEffect(() => {
    if (isMobile) return;
    let annule = false;
    chargerSemaine().then(res => { if (!annule) { setWeek(res); setWeekLoading(false); } });
    return () => { annule = true; };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    let annule = false;
    chargerIdeesDuJour().then(res => { if (!annule) { setDailyIdeas(res); setIdeasLoading(false); } });
    return () => { annule = true; };
  }, [isMobile]);

  const displayName = firstName || utilisateur?.email?.split('@')[0] || 'there';
  const parisActifs = paris.filter(p => p.statut === 'actif');
  const parisTraites = paris.filter(p => p.statut !== 'actif');
  const betsAutoActifs = betsAuto.filter(b => b.statut === 'pending');
  const betsAutoTraites = betsAuto.filter(b => b.statut !== 'pending');
  const profitTotal = parisTraites.reduce((acc, p) => acc + (p.profit || 0), 0);
  const parisGagnes = parisTraites.filter(p => p.statut === 'gagne').length;
  const winRate = parisTraites.length > 0 ? Math.round((parisGagnes / parisTraites.length) * 100) : 0;
  const miseTotale = parisTraites.reduce((acc, p) => acc + (p.mise || 0), 0);
  const roi = miseTotale > 0 ? ((profitTotal / miseTotale) * 100).toFixed(1) : '0.0';
  const recentCombines = [
    ...paris.map(p => ({ key: `m-${p.id}`, titre: p.match, bookmaker: p.bookmaker, cote: p.cote, statut: p.statut, profit: p.profit, mise: p.mise, date: p.date_pari })),
    ...betsAuto.map(b => ({ key: `a-${b.id}`, titre: titreBetAuto(b), bookmaker: b.bookmaker, cote: b.cote, statut: b.statut === 'pending' ? 'actif' : b.statut, profit: b.resultat, mise: b.mise, date: b.verified_at || b.created_at })),
  ].sort((a, b) => {
    const actifA = a.statut === 'actif' ? 0 : 1;
    const actifB = b.statut === 'actif' ? 0 : 1;
    if (actifA !== actifB) return actifA - actifB;
    return new Date(b.date || 0) - new Date(a.date || 0);
  }).slice(0, 3);

  const sharedData = {
    displayName, bankroll, bankrollLoading, paris, betsAuto, parisTraites, betsAutoTraites,
    recentCombines, roi, winRate, parisActifs, betsAutoActifs, betsLoading,
    pools, poolsLoading, week, weekLoading, selectedDate, setSelectedDate, dailyIdeas, ideasLoading,
  };

  if (isMobile) {
    return <MobileHomeDashboard t={t} data={sharedData} onGoToBets={onGoToBets} />;
  }
  return (
    <DesktopHomeDashboard
      t={t} data={sharedData}
      onGoToBets={onGoToBets}
      onGoToPool={onGoToPool || (() => {})}
      onOpenTeamFiche={onOpenTeamFiche || (() => {})}
    />
  );
}

// ===================== Chargements de donnees (colonne de droite, tablette/web) =====================

async function chargerMesPools(userId) {
  try {
    const { data } = await supabase.from('pool_members').select('id, pool:pools(id,name,status)').eq('user_id', userId);
    const rows = (data || []).filter(r => r.pool);
    const withStandings = await Promise.all(rows.map(async (r) => {
      try {
        const { data: standings } = await supabase.rpc('get_pool_standings', { p_pool_id: r.pool.id });
        const mine = (standings || []).find(s => s.member_id === r.id);
        return { poolId: r.pool.id, name: r.pool.name, status: r.pool.status, rank: mine?.rank ?? null, points: mine?.total_points ?? 0 };
      } catch {
        return { poolId: r.pool.id, name: r.pool.name, status: r.pool.status, rank: null, points: 0 };
      }
    }));
    return withStandings;
  } catch { return []; }
}

async function chargerSemaine() {
  try {
    const today = getDateStr(new Date());
    const res = await fetch(getUrl(`schedule/${today}`));
    const data = await res.json();
    return (data.gameWeek || []).slice(0, 7);
  } catch { return []; }
}

// Idees du jour : agregats legers cote client sur une fenetre bornee de 7 jours (aucune
// nouvelle table/fonction SQL -- uniquement des lectures sur nhl_games/nhl_player_game_stats/
// nhl_team_game_results, deja synchronisees par l'Edge Function sync-nhl-stats et deja
// lisibles par tout utilisateur authentifie).
async function chargerIdeesDuJour() {
  try {
    const depuis = getDateStr(new Date(Date.now() - 7 * 86400000));
    const { data: games } = await supabase.from('nhl_games').select('game_id, game_date').gte('game_date', depuis).eq('state', 'FINAL');
    const gameIds = (games || []).map(g => g.game_id);
    if (gameIds.length === 0) return { hotPlayer: null, streakTeam: null };
    const dateByGame = Object.fromEntries((games || []).map(g => [g.game_id, g.game_date]));

    const [{ data: stats }, { data: results }] = await Promise.all([
      supabase.from('nhl_player_game_stats').select('player_id,player_name,team_abbrev,points,game_id').in('game_id', gameIds),
      supabase.from('nhl_team_game_results').select('team_abbrev,result,game_id').in('game_id', gameIds),
    ]);

    const byPlayer = new Map();
    (stats || []).forEach(s => {
      const cur = byPlayer.get(s.player_id) || { player_name: s.player_name, team_abbrev: s.team_abbrev, points: 0 };
      cur.points += Number(s.points) || 0;
      byPlayer.set(s.player_id, cur);
    });
    let hotPlayer = null;
    for (const v of byPlayer.values()) { if (v.points > 0 && (!hotPlayer || v.points > hotPlayer.points)) hotPlayer = v; }

    const byTeam = new Map();
    (results || []).forEach(r => {
      const list = byTeam.get(r.team_abbrev) || [];
      list.push({ date: dateByGame[r.game_id], result: r.result });
      byTeam.set(r.team_abbrev, list);
    });
    let streakTeam = null;
    for (const [team, list] of byTeam.entries()) {
      const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
      let streak = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].result === 'W') streak++; else break;
      }
      if (streak >= 2 && (!streakTeam || streak > streakTeam.n)) streakTeam = { team, n: streak };
    }

    return { hotPlayer, streakTeam };
  } catch { return { hotPlayer: null, streakTeam: null }; }
}

export default HomeDashboard;
