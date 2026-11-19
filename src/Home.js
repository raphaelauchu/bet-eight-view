import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';
import { getT } from './i18n';
import { getUrl } from './nhlApi';
import { useIsMobile, getDateStr } from './Analyses';
import { titreBetAuto } from './Dashboard';
import { WealthsimpleChart } from './WealthsimpleChart';
import { useFavorisData, IconExpand, IconFilter, IconStarFilled, TablePicks, TableWatchlist, EtatVideFavoris } from './Favoris';
import { ShareStatsButton } from './ShareStats';
import { AddSportsbookButton, SportsbookWaitlistSheet } from './SportsbookWaitlist';

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
// period='ytd' -> annee civile en cours (dynamique, contrairement aux autres periodes qui sont
// des durees fixes). dates[i] correspond a values[i], pour l'affichage (survol) du graphique.
export function computeChartSeries(parisTraites, period, mode) {
  const now = new Date();
  const days = period === 'ytd'
    ? (now - new Date(now.getFullYear(), 0, 1)) / 86400000
    : (CHART_PERIOD_DAYS[period] ?? CHART_PERIOD_DAYS['1m']);
  const filtered = (parisTraites || [])
    .filter(p => p.date_pari && (now - new Date(p.date_pari)) / 86400000 <= days)
    .sort((a, b) => new Date(a.date_pari) - new Date(b.date_pari));

  let cumulProfit = 0;
  let cumulStake = 0;
  const dates = [];
  const values = filtered.map(p => {
    cumulProfit += Number(p.profit) || 0;
    cumulStake += Number(p.mise) || 0;
    dates.push(p.date_pari);
    return mode === 'return' ? (cumulStake > 0 ? (cumulProfit / cumulStake) * 100 : 0) : cumulProfit;
  });
  return { values, dates, finalValue: values.length ? values[values.length - 1] : 0 };
}

// ===================== Styles partages (meme langage visuel que le reste de l'app) =====================

const cardStyle = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '18px', padding: '18px', border: '1px solid var(--c-161616)' };

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

// Remplace un montant sensible quand hideAmounts est actif : 5 petits points gris arrondis
// (pas de texte/emoji), avec un libelle accessible pour les lecteurs d'ecran.
export function MaskedDots({ t, count = 5, size = 5 }) {
  return (
    <span aria-label={t('home_amounts_hidden')} style={{ display: 'inline-flex', alignItems: 'center', gap: `${Math.max(3, Math.round(size / 2))}px`, verticalAlign: 'middle' }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: 'var(--c-666)', display: 'inline-block' }} />
      ))}
    </span>
  );
}

function IconBack({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconEye({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c6.5 0 10.5 7 10.5 7a18 18 0 0 1-3.1 3.9" />
      <path d="M6.1 6.1C3.2 8 1.5 11 1.5 11s4 7 10.5 7a10.4 10.4 0 0 0 4.1-.84" />
    </svg>
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

// `onAddSportsbook` optionnel : quand fourni, affiche le bouton "Ajouter un sportsbook" (style
// Wealthsimple "Add account") sur la meme ligne -- pilule + texte sur desktop (mobile=false),
// rond "+" seul sur mobile (mobile=true). Voir src/SportsbookWaitlist.js.
function GreetingBanner({ t, displayName, onAddSportsbook, mobile }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: mobile ? 'center' : 'flex-end', gap: '12px' }}>
      <div>
        <p style={{ margin: '0 0 2px', color: 'var(--c-444)', fontSize: '13px' }}>{t(greetingKey())}</p>
        <h2 style={{ margin: 0, fontSize: '30px', fontWeight: '800', letterSpacing: '-0.8px', color: 'var(--c-white)' }}>{displayName}</h2>
      </div>
      {onAddSportsbook && <AddSportsbookButton t={t} mobile={mobile} onClick={onAddSportsbook} />}
    </div>
  );
}

// ===================== Bankroll + courbe de profit fusionnees (un seul bloc, sans cadre) =====================

const CHART_PERIODS = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', 'all'];
const PERIOD_SUFFIX_KEYS = {
  '1d': 'home_period_suffix_1d', '1w': 'home_period_suffix_1w', '1m': 'home_period_suffix_1m',
  '3m': 'home_period_suffix_3m', '6m': 'home_period_suffix_6m', 'ytd': 'home_period_suffix_ytd',
  '1y': 'home_period_suffix_1y', 'all': 'home_period_suffix_all',
};

const JOURS_PAR_PERIODE = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365 };

// Total mise des paris regles dans la periode choisie (meme fenetre que computeChartSeries) --
// sert de denominateur au ROI affiche sous la grande valeur, pour que "ROI" signifie la meme
// chose ici que sur la page Aperçu de la performance (profit / mises), pas juste "% du solde
// de depart de la courbe".
function miseTotalePourPeriode(parisTraites, periode) {
  const maintenant = new Date();
  return (parisTraites || []).filter(p => {
    if (!p.date_pari) return false;
    if (periode === 'all') return true;
    const d = new Date(p.date_pari);
    if (periode === 'ytd') return d.getFullYear() === maintenant.getFullYear();
    return (maintenant - d) / 86400000 <= JOURS_PAR_PERIODE[periode];
  }).reduce((a, p) => a + (Number(p.mise) || 0), 0);
}

// Le texte de variation sous la grande valeur suit la periode/le mode selectionnes dans le
// graphique (et le point survole, le cas echeant) -- JAMAIS la grande valeur elle-meme en mode
// Valeur (qui reste le solde reel actuel, independant de la periode). En mode Rendement, la
// grande valeur ET la variation refletent toutes deux le gain/perte de la periode choisie.
// Toujours affichee (meme a $0.00 sans aucun pari) -- jamais masquee faute de donnees.
function BankrollHeroChart({ t, lang, bankroll, bankrollLoading, hideAmounts, onToggleHide, onGoToPerformance, parisTraites, betsLoading, betsPourPartage }) {
  const [period, setPeriod] = useState('1m');
  const [mode, setMode] = useState('value');
  const [hoverPoint, setHoverPoint] = useState(null);
  const display = bankroll != null ? bankroll.toFixed(2) : null;

  const { values, dates } = useMemo(() => computeChartSeries(parisTraites, period, mode), [parisTraites, period, mode]);
  const points = useMemo(() => values.map((v, i) => ({ date: dates[i], value: v })), [values, dates]);
  const miseTotalePeriode = useMemo(() => miseTotalePourPeriode(parisTraites, period), [parisTraites, period]);

  useEffect(() => { setHoverPoint(null); }, [period, mode]);

  const premierPoint = points.length ? points[0] : { value: 0 };
  const dernierPoint = points.length ? points[points.length - 1] : { value: 0 };
  const pointActif = hoverPoint || dernierPoint;
  const variation = pointActif.value - premierPoint.value;
  const hausse = variation >= 0;
  const couleur = hausse ? '#22c55e' : '#ef4444';
  const suffixe = t(PERIOD_SUFFIX_KEYS[period] || 'home_period_suffix_all');

  const texteVariation = mode === 'return'
    ? `${hausse ? '+' : ''}${variation.toFixed(1)}% ${suffixe} →`
    : (() => {
      const roiPct = miseTotalePeriode !== 0 ? (variation / miseTotalePeriode) * 100 : 0;
      return `${hausse ? '+' : ''}$${variation.toFixed(2)} (${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}% ${t('perf_roi')}) ${suffixe} →`;
    })();

  const grandeValeurTexte = mode === 'return'
    ? `${pointActif && pointActif.value >= 0 ? '+' : ''}${(pointActif?.value ?? 0).toFixed(1)}%`
    : (display != null ? `$${display}` : null);
  const grandeValeurCouleur = mode === 'return' ? couleur : 'var(--c-white)';
  const chargementValeur = mode === 'return' ? betsLoading : bankrollLoading;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{t('home_bankroll')}</p>
        <ShareStatsButton t={t} lang={lang} bets={betsPourPartage} bankroll={bankroll} />
      </div>

      {chargementValeur || grandeValeurTexte == null ? (
        <SkeletonBlock height={56} width="60%" />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0 6px' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: '900', color: grandeValeurCouleur, letterSpacing: '-2px', lineHeight: 1 }}>
            {hideAmounts ? <MaskedDots t={t} count={7} size={14} /> : grandeValeurTexte}
          </h1>
          <button
            onClick={onToggleHide}
            aria-label={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')}
            title={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')}
            className="home-eye-btn"
          >
            {hideAmounts ? <IconEye color="var(--c-666)" /> : <IconEyeOff color="var(--c-666)" />}
          </button>
        </div>
      )}

      {!chargementValeur && (
        <div style={{ marginBottom: '22px' }}>
          <button
            onClick={() => onGoToPerformance(period)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: '14px', fontWeight: hideAmounts ? '600' : '800', color: hideAmounts ? 'var(--c-666)' : couleur, cursor: 'pointer', textAlign: 'left' }}
          >
            {hideAmounts ? t('home_performance_insights') : texteVariation}
          </button>
        </div>
      )}

      {betsLoading ? <SkeletonBlock height={160} /> : (
        <WealthsimpleChart
          lang={lang}
          points={points}
          periods={CHART_PERIODS.map(p => ({ key: p, label: t(`home_chart_period_${p}`) }))}
          period={period} onSelectPeriod={setPeriod}
          modeOptions={[{ key: 'value', label: t('home_chart_mode_value') }, { key: 'return', label: t('home_chart_mode_return') }]}
          mode={mode} onSelectMode={setMode}
          emptyLabel={t('home_no_bets_period')}
          hauteur={150}
          color={couleur}
          onHoverChange={setHoverPoint}
        />
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

function StatsRow({ t, loading, roi, winRate, activeCount, hideAmounts }) {
  if (loading) {
    return (
      <div className="home-stats-grid">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ ...cardStyle, padding: '16px' }}><CardSkeleton lines={2} /></div>)}
      </div>
    );
  }
  const roiNum = parseFloat(roi);
  return (
    <div className="home-stats-grid">
      <StatCard label={t('home_stat_roi')} value={hideAmounts ? <MaskedDots t={t} /> : `${roiNum >= 0 ? '+' : ''}${roi}%`} color={roiNum >= 0 ? '#22c55e' : '#ef4444'} />
      <StatCard label={t('home_stat_win_rate')} value={`${winRate}%`} />
      <StatCard label={t('home_stat_active_bets')} value={activeCount} color="#f97316" />
    </div>
  );
}

// ===================== Paris recents =====================

function RecentBetsCard({ t, loading, recentCombines, onSeeAll, hideAmounts }) {
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
          ) : hideAmounts ? (
            <MaskedDots t={t} />
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

const MATCHS_PAR_PAGE = 4;

function TonightGamesCard({ t, lang, loading, games, selectedDate, todayStr, onOpenTeam }) {
  const [nbAffiches, setNbAffiches] = useState(MATCHS_PAR_PAGE);
  useEffect(() => { setNbAffiches(MATCHS_PAR_PAGE); }, [selectedDate, games]);

  const title = selectedDate === todayStr
    ? t('home_tonight')
    : `${t('home_games_on')} ${new Date(selectedDate + 'T12:00:00').toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'short' })}`;
  const gamesAffiches = games.slice(0, nbAffiches);
  const resteACacher = games.length - nbAffiches;

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
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gamesAffiches.map((m, i) => {
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
                    <span style={{ fontSize: '11px', color: 'var(--c-444)' }}>VS</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)' }} title="À domicile">{home}</span>
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
          {resteACacher > 0 && (
            <button onClick={() => setNbAffiches(n => Math.min(n + MATCHS_PAR_PAGE, games.length))}
              style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              {t('home_see_more').replace('{n}', resteACacher)}
            </button>
          )}
          {resteACacher <= 0 && games.length > MATCHS_PAR_PAGE && (
            <button onClick={() => setNbAffiches(MATCHS_PAR_PAGE)}
              style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              {t('home_see_less')}
            </button>
          )}
        </>
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

// ===================== Holdings/Watchlist (style Wealthsimple) : Picks + Watchlist =====================
// Branche sur les vraies donnees watchlist_items/saved_picks (src/Favoris.js, useFavorisData)
// -- avant cette carte disait juste "pas encore disponible", desormais lecture + retrait reels.
// Ajouter un favori ou "placer" un pick reste une action du contexte Analyses (match/joueur).

function SegmentTabsFavoris({ onglet, setOnglet, t }) {
  function TabBtn({ k, label }) {
    const actif = onglet === k;
    return (
      <button onClick={() => setOnglet(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px', fontSize: '14px', fontWeight: actif ? '800' : '600', color: actif ? 'var(--c-white)' : 'var(--c-555)', borderBottom: actif ? '2px solid #f97316' : '2px solid transparent' }}>
        {label}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      <TabBtn k="picks" label={t('favoris_tab_picks')} />
      <TabBtn k="watchlist" label={t('favoris_tab_watchlist')} />
    </div>
  );
}

function filtrerParRecherche(items, libelleFn, recherche) {
  if (!recherche) return items;
  const q = recherche.toLowerCase();
  return items.filter(x => libelleFn(x).toLowerCase().includes(q));
}

function iconBtnStyle(actif) {
  return { background: 'none', border: '1px solid var(--c-222)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: actif ? 'rgba(249,115,22,0.1)' : 'transparent' };
}

function LignePick({ p, t, hideAmounts }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid var(--c-111)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</div>
        <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>{p.market || '—'}{p.line != null ? ` ${p.line}` : ''}</div>
      </div>
      {hideAmounts ? (
        <MaskedDots t={t} />
      ) : (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)' }}>{p.odds ?? '—'}</div>
          {p.planned_stake != null && <div style={{ fontSize: '11px', color: 'var(--c-555)' }}>${p.planned_stake}</div>}
        </div>
      )}
    </div>
  );
}

function LigneWatchlist({ w, libelle, t, onRemove }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid var(--c-111)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{libelle(w)}</div>
        <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>{w.kind === 'team' ? t('favoris_type_equipe') : t('favoris_type_joueur')}</div>
      </div>
      <button onClick={() => onRemove(w)} aria-label={t('favoris_retirer')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
        <IconStarFilled />
      </button>
    </div>
  );
}

function HoldingsModal({ t, lang, onglet, setOnglet, picks, watchlist, libelle, onRemovePick, onRemoveWatchlist, chargement, onClose }) {
  const isMobile = useIsMobile();
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2200, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : '20px' }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--c-0d0d0d)', border: isMobile ? 'none' : '1px solid var(--c-222)',
        borderRadius: isMobile ? 0 : '18px', padding: isMobile ? '16px' : '20px',
        maxWidth: isMobile ? 'none' : '1000px', width: '100%', maxHeight: isMobile ? '100vh' : '85vh', overflow: 'auto',
        paddingTop: isMobile ? 'calc(16px + env(safe-area-inset-top))' : '20px',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          {isMobile && (
            <button onClick={onClose} aria-label={t('favoris_retour')} style={{ background: 'none', border: 'none', color: 'var(--c-white)', cursor: 'pointer', padding: '6px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBack />
            </button>
          )}
          <SegmentTabsFavoris onglet={onglet} setOnglet={setOnglet} t={t} />
          {!isMobile && (
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--c-222)', borderRadius: '8px', color: 'var(--c-888)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}>{t('favoris_retour')}</button>
          )}
        </div>
        {onglet === 'picks'
          ? <TablePicks t={t} lang={lang} picks={picks} onRemove={onRemovePick} chargement={chargement} />
          : <TableWatchlist t={t} lang={lang} items={watchlist} libelle={libelle} onRemove={onRemoveWatchlist} chargement={chargement} />}
      </div>
    </div>,
    document.body
  );
}

function HoldingsWatchlistCard({ t, lang, utilisateur, hideAmounts }) {
  const { watchlist, savedPicks, chargement, libelleWatchlist, retirerWatchlist, retirerPick } = useFavorisData(utilisateur);
  const [onglet, setOnglet] = useState('picks');
  const [agrandi, setAgrandi] = useState(false);
  const [filtreOuvert, setFiltreOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');

  const picksFiltres = filtrerParRecherche(savedPicks, p => p.label || '', recherche);
  const watchlistFiltree = filtrerParRecherche(watchlist, libelleWatchlist, recherche);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <SegmentTabsFavoris onglet={onglet} setOnglet={setOnglet} t={t} />
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setFiltreOuvert(o => !o)} aria-label={t('favoris_filtrer')} style={iconBtnStyle(filtreOuvert)}>
            <IconFilter color={filtreOuvert ? '#f97316' : 'var(--c-888)'} />
          </button>
          <button onClick={() => setAgrandi(true)} aria-label={t('favoris_agrandir')} style={iconBtnStyle(false)}>
            <IconExpand color="var(--c-888)" />
          </button>
        </div>
      </div>

      {filtreOuvert && (
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={t('favoris_filtrer_placeholder')}
          style={{ width: '100%', marginTop: '12px', padding: '8px 12px', backgroundColor: 'var(--c-0a0a0a)', border: '1px solid var(--c-1a1a1a)', borderRadius: '10px', color: 'var(--c-white)', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }} />
      )}

      <div style={{ marginTop: '6px' }}>
        {chargement ? (
          <EtatVideFavoris texte={t('favoris_chargement')} />
        ) : onglet === 'picks' ? (
          picksFiltres.length === 0 ? <EtatVideFavoris texte={t('favoris_picks_vide')} /> : picksFiltres.map(p => <LignePick key={p.id} p={p} t={t} hideAmounts={hideAmounts} />)
        ) : (
          watchlistFiltree.length === 0 ? <EtatVideFavoris texte={t('favoris_watchlist_vide')} /> : watchlistFiltree.map(w => <LigneWatchlist key={w.id} w={w} libelle={libelleWatchlist} t={t} onRemove={retirerWatchlist} />)
        )}
      </div>

      {agrandi && (
        <HoldingsModal t={t} lang={lang} onglet={onglet} setOnglet={setOnglet}
          picks={savedPicks} watchlist={watchlist} libelle={libelleWatchlist}
          onRemovePick={retirerPick} onRemoveWatchlist={retirerWatchlist}
          chargement={chargement} onClose={() => setAgrandi(false)} />
      )}
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

function DesktopHomeDashboard({ t, lang, utilisateur, data, onGoToBets, onGoToPerformance, onOpenTeamFiche }) {
  const {
    displayName, bankroll, bankrollLoading, parisTraites,
    recentCombines, roi, winRate, parisActifs, betsAutoActifs, betsLoading, betsPourPartage,
    week, weekLoading, selectedDate, setSelectedDate, dailyIdeas, ideasLoading,
  } = data;

  const [hideAmounts, setHideAmounts] = useState(() => readHideAmounts());
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [sportsbookOuvert, setSportsbookOuvert] = useState(false);

  function toggleHideAmounts() {
    setHideAmounts(prev => { writeHideAmounts(!prev); return !prev; });
  }

  const todayStr = getDateStr(new Date());
  const activeCount = parisActifs.length + betsAutoActifs.length;

  const selectedDayGames = useMemo(() => {
    const day = week.find(d => d.date === selectedDate);
    return day?.games || [];
  }, [week, selectedDate]);

  return (
    <div className="home-page">
      <style>{`
        @keyframes home-skel-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.8; } }
        .home-skel { background-color: var(--c-1a1a1a); animation: home-skel-pulse 1.4s ease-in-out infinite; }
        .home-eye-btn { background: none; border: none; padding: 6px; margin-top: -6px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .home-eye-btn:hover { background-color: var(--c-1a1a1a); }
      `}</style>

      <GreetingBanner t={t} displayName={displayName} onAddSportsbook={() => setSportsbookOuvert(true)} mobile={false} />

      <div className="home-grid">
        <div className="home-main-col">
          <BankrollHeroChart
            t={t} lang={lang} bankroll={bankroll} bankrollLoading={bankrollLoading}
            hideAmounts={hideAmounts} onToggleHide={toggleHideAmounts} onGoToPerformance={onGoToPerformance}
            parisTraites={parisTraites} betsLoading={betsLoading} betsPourPartage={betsPourPartage}
          />
          <StatsRow t={t} loading={betsLoading} roi={roi} winRate={winRate} activeCount={activeCount} hideAmounts={hideAmounts} />
          <RecentBetsCard t={t} loading={betsLoading} recentCombines={recentCombines} onSeeAll={onGoToBets} hideAmounts={hideAmounts} />
        </div>

        <div className="home-side-col">
          <WeekCalendarCard t={t} loading={weekLoading} week={week} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <TonightGamesCard t={t} lang={lang} loading={weekLoading} games={selectedDayGames} selectedDate={selectedDate} todayStr={todayStr} onOpenTeam={onOpenTeamFiche} />
          <HoldingsWatchlistCard t={t} lang={lang} utilisateur={utilisateur} hideAmounts={hideAmounts} />
          <DailyIdeasCard t={t} loading={ideasLoading} ideas={dailyIdeas} onOpenElite={() => setShowComingSoon(true)} />
        </div>
      </div>

      {showComingSoon && <ComingSoonOverlay t={t} onClose={() => setShowComingSoon(false)} />}
      {sportsbookOuvert && <SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={() => setSportsbookOuvert(false)} />}
    </div>
  );
}

// ===================== Mise en page mobile (<768px) =====================
// Une seule colonne qui reutilise EXACTEMENT les memes cartes que desktop/tablette (plus de
// JSX ni de logique dupliques) dans l'ordre demande : Bonjour, Bankroll (courbe + periodes +
// Valeur/Rendement), stats ROI/Taux/Paris actifs, Calendrier (defilement horizontal), Matchs du
// jour (4 + "Voir plus"), Picks/Watchlist, Idees du jour, Paris recents.

function MobileHomeDashboard({ t, lang, utilisateur, data, onGoToBets, onGoToPerformance, onOpenTeamFiche }) {
  const {
    displayName, bankroll, bankrollLoading, parisTraites,
    recentCombines, roi, winRate, parisActifs, betsAutoActifs, betsLoading, betsPourPartage,
    week, weekLoading, selectedDate, setSelectedDate, dailyIdeas, ideasLoading,
  } = data;

  const [hideAmounts, setHideAmounts] = useState(() => readHideAmounts());
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [sportsbookOuvert, setSportsbookOuvert] = useState(false);

  function toggleHideAmounts() {
    setHideAmounts(prev => { writeHideAmounts(!prev); return !prev; });
  }

  const todayStr = getDateStr(new Date());
  const activeCount = parisActifs.length + betsAutoActifs.length;

  const selectedDayGames = useMemo(() => {
    const day = week.find(d => d.date === selectedDate);
    return day?.games || [];
  }, [week, selectedDate]);

  return (
    <div className="home-mobile" style={{ padding: '16px', paddingBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '0 auto', overflowX: 'hidden' }}>
      <style>{`
        @keyframes home-skel-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.8; } }
        .home-skel { background-color: var(--c-1a1a1a); animation: home-skel-pulse 1.4s ease-in-out infinite; }
        .home-eye-btn { background: none; border: none; padding: 6px; margin-top: -6px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <GreetingBanner t={t} displayName={displayName} onAddSportsbook={() => setSportsbookOuvert(true)} mobile />

      <BankrollHeroChart
        t={t} lang={lang} bankroll={bankroll} bankrollLoading={bankrollLoading}
        hideAmounts={hideAmounts} onToggleHide={toggleHideAmounts} onGoToPerformance={onGoToPerformance}
        parisTraites={parisTraites} betsLoading={betsLoading} betsPourPartage={betsPourPartage}
      />

      <StatsRow t={t} loading={betsLoading} roi={roi} winRate={winRate} activeCount={activeCount} hideAmounts={hideAmounts} />

      <RecentBetsCard t={t} loading={betsLoading} recentCombines={recentCombines} onSeeAll={onGoToBets} hideAmounts={hideAmounts} />

      <WeekCalendarCard t={t} loading={weekLoading} week={week} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <TonightGamesCard t={t} lang={lang} loading={weekLoading} games={selectedDayGames} selectedDate={selectedDate} todayStr={todayStr} onOpenTeam={onOpenTeamFiche} />

      <HoldingsWatchlistCard t={t} lang={lang} utilisateur={utilisateur} hideAmounts={hideAmounts} />

      <DailyIdeasCard t={t} loading={ideasLoading} ideas={dailyIdeas} onOpenElite={() => setShowComingSoon(true)} />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
        <img src="/logo192.png" alt="Betrics" className="home-logo-anim" style={{ width: '56px', height: '56px', borderRadius: '16px' }} />
      </div>

      {showComingSoon && <ComingSoonOverlay t={t} onClose={() => setShowComingSoon(false)} />}
      {sportsbookOuvert && <SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={() => setSportsbookOuvert(false)} />}
    </div>
  );
}

// ===================== Composant principal : donnees partagees + choix de mise en page =====================

export function HomeDashboard({ utilisateur, onGoToProps, onGoToAnalytics, onGoToBets, onGoToPerformance, onOpenTeamFiche, lang = 'en' }) {
  const t = getT(lang);
  const isMobile = useIsMobile();

  const [firstName, setFirstName] = useState('');
  const [bankroll, setBankroll] = useState(null);
  const [bankrollLoading, setBankrollLoading] = useState(true);
  const [paris, setParis] = useState([]);
  const [betsAuto, setBetsAuto] = useState([]);
  const [betsLoading, setBetsLoading] = useState(true);

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

  // Calendrier + idees du jour : utilises par les DEUX mises en page desormais (la mobile
  // reutilise les memes cartes que desktop/tablette, voir MobileHomeDashboard plus bas).
  useEffect(() => {
    let annule = false;
    chargerSemaine().then(res => { if (!annule) { setWeek(res); setWeekLoading(false); } });
    return () => { annule = true; };
  }, []);

  useEffect(() => {
    let annule = false;
    chargerIdeesDuJour().then(res => { if (!annule) { setDailyIdeas(res); setIdeasLoading(false); } });
    return () => { annule = true; };
  }, []);

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

  // Paris unifies (paris + bets_auto, avec type_bet) pour la carte de partage (src/ShareStats.js)
  // -- meme fusion que PerformanceInsights.js (tousLesParis), independante des series du
  // graphique de BankrollHeroChart (qui ne lit que `paris`, historique).
  const betsPourPartage = paris.map(p => ({ date: p.date_pari, profit: Number(p.profit) || 0, mise: Number(p.mise) || 0, statut: p.statut, type: null }))
    .concat(betsAuto.map(b => ({ date: b.verified_at || b.created_at, profit: Number(b.resultat) || 0, mise: Number(b.mise) || 0, statut: b.statut === 'pending' ? 'actif' : b.statut, type: b.type_bet || null })));

  const sharedData = {
    displayName, bankroll, bankrollLoading, paris, betsAuto, parisTraites, betsAutoTraites,
    recentCombines, roi, winRate, parisActifs, betsAutoActifs, betsLoading, betsPourPartage,
    week, weekLoading, selectedDate, setSelectedDate, dailyIdeas, ideasLoading,
  };

  if (isMobile) {
    return (
      <MobileHomeDashboard
        t={t} lang={lang} utilisateur={utilisateur} data={sharedData}
        onGoToBets={onGoToBets}
        onGoToPerformance={onGoToPerformance || (() => {})}
        onOpenTeamFiche={onOpenTeamFiche || (() => {})}
      />
    );
  }
  return (
    <DesktopHomeDashboard
      t={t} lang={lang} utilisateur={utilisateur} data={sharedData}
      onGoToBets={onGoToBets}
      onGoToPerformance={onGoToPerformance || (() => {})}
      onOpenTeamFiche={onOpenTeamFiche || (() => {})}
    />
  );
}

// ===================== Chargements de donnees (colonne de droite, tablette/web) =====================

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
