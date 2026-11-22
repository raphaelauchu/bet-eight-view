import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile } from './useIsMobile';
import { fichierVersJpegBase64 } from './imageUtils';
import BetImportFlow from './BetImportFlow';
import BetDetailSheet from './BetDetailSheet';
import { AddAccountSheet } from './Bankroll';
import { DropdownPill } from './DropdownPill';
import { BottomSheet } from './BottomSheet';
import { BetRow } from './BetRow';
import { MaskedDots } from './MaskedDots';
import { ShareStatsButton } from './ShareStats';
import { readHideAmounts, writeHideAmounts } from './Home';
import {
  normalizeAllBets, betsForAccount, pendingBets, refDateForBet, isWithinPeriod,
  computeAtRisk, computeROI, computeWinRate, computeGlobalBankroll, computeAccountBalance,
} from './bankrollCalc';

// ===================== Onglet Paris (Bets) : refonte style Wealthsimple =====================
// Reutilise les memes composants que Home.js/Bankroll.js/PerformanceInsights.js (deja refaits) :
// DropdownPill (filtres), BottomSheet (feuille mobile, "Filtres" + detail), BetRow (ligne de
// pari partagee), MaskedDots/readHideAmounts (mode oeil), BetImportFlow+AddAccountSheet (flux
// d'ajout de pari existant), ShareStatsButton (partage). Aucune nouvelle logique de solde : le
// reglement (gagne/perdu/annule) se limite a changer le statut/resultat du pari en base -- le
// solde de chaque compte reste TOUJOURS derive (src/bankrollCalc.js:computeAccountBalance),
// jamais stocke/mis a jour manuellement (contrairement a l'ancien src/Dashboard.js qui touchait
// encore la table `bankroll` historique, morte depuis le passage aux comptes multiples).

export const BETS_PERIODS = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', 'all'];
const PAGE_SIZE = 20;

// ===================== Regroupement par jour (fonctions pures, exportees pour les tests) =====================

// Cle YYYY-MM-DD (jamais via un Date UTC intermediaire -- meme precaution que
// src/bankrollCalc.js:parseLocalDate, un pari du 1er novembre ne doit jamais glisser au 31
// octobre dans un fuseau a l'ouest de l'UTC).
export function dayKeyForBet(b) {
  const raw = refDateForBet(b);
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(raw).slice(0, 10);
}

// [[dayKey, [bets...]], ...] trie du jour le plus recent au plus ancien ; a l'interieur d'un
// jour, du pari le plus recent au plus ancien (meme ordre que la liste globale).
export function groupBetsByDay(bets) {
  const byDay = new Map();
  for (const b of bets) {
    const key = dayKeyForBet(b);
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(b);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
}

// Date locale (jamais toISOString(), qui convertit en UTC et peut decaler le jour selon le
// fuseau -- meme precaution que src/bankrollCalc.js:dateKey).
function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayGroupLabel(dayKey, t, lang, now = new Date()) {
  const todayStr = localDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateKey(yesterday);
  if (dayKey === todayStr) return t('bets_group_today');
  if (dayKey === yesterdayStr) return t('bets_group_yesterday');
  const d = new Date(`${dayKey}T12:00:00`);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  });
}

// ===================== Styles partages =====================

const cardStyle = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '18px', border: '1px solid var(--c-161616)' };

function IconPlus({ color = 'white', size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

function IconFilters({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" />
    </svg>
  );
}

// Memes icones que src/Home.js/src/Bankroll.js (jamais un emoji, pour rester coherent avec le
// reste de l'app style Wealthsimple).
function IconEye({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c6.5 0 10.5 7 10.5 7a18 18 0 0 1-3.1 3.9" />
      <path d="M6.1 6.1C3.2 8 1.5 11 1.5 11s4 7 10.5 7a10.4 10.4 0 0 0 4.1-.84" />
    </svg>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
      <div style={{ color: 'var(--c-555)', fontSize: '10.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-0.4px' }}>{value}</div>
    </div>
  );
}

function EmptyState({ icon = '🏒', title, sub, cta, onCta }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '28px' }}>{icon}</span>
      {title && <p style={{ margin: 0, color: 'var(--c-ccc)', fontSize: '14px', fontWeight: '700' }}>{title}</p>}
      {sub && <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '13px', maxWidth: '280px' }}>{sub}</p>}
      {cta && (
        <button onClick={onCta} style={{ marginTop: '10px', padding: '10px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '13px', fontWeight: '700' }}>
          {cta}
        </button>
      )}
    </div>
  );
}

// ===================== Filtres (pilules desktop / feuille "Filtres" mobile) =====================

function FilterBar({ t, period, setPeriod, status, setStatus, accountId, setAccountId, kind, setKind, accounts, isMobile, mobileSheetOpen, setMobileSheetOpen }) {
  const periodOptions = BETS_PERIODS.map(p => ({ value: p, label: t(`home_chart_period_${p}`) }));
  const statusOptions = [
    { value: 'all', label: t('bets_status_all') },
    { value: 'pending', label: t('home_active_badge') },
    { value: 'won', label: t('bets_won') },
    { value: 'lost', label: t('bets_lost') },
    { value: 'cancelled', label: t('bets_cancelled_badge') },
  ];
  const accountOptions = [
    { value: 'all', label: t('bets_filter_account_all') },
    ...accounts.map(a => ({ value: a.id, label: a.name || t('bank_account_other') })),
  ];
  const kindOptions = [
    { value: 'all', label: t('bets_filter_kind_all') },
    { value: 'match', label: t('bets_filter_kind_match') },
    { value: 'player', label: t('bets_filter_kind_player') },
  ];

  if (isMobile) {
    const activeCount = [status !== 'all', accountId !== 'all', kind !== 'all', period !== 'all'].filter(Boolean).length;
    return (
      <>
        <button
          onClick={() => setMobileSheetOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px', borderRadius: '20px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-0d0d0d)', color: 'var(--c-ccc)', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', minHeight: '44px' }}
        >
          <IconFilters />
          {t('bets_filters_btn')}
          {activeCount > 0 && (
            <span style={{ backgroundColor: '#f97316', color: 'white', borderRadius: '10px', minWidth: '16px', height: '16px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{activeCount}</span>
          )}
        </button>
        {mobileSheetOpen && (
          <BottomSheet onClose={() => setMobileSheetOpen(false)} title={t('bets_filters_btn')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                [t('bets_filter_period_label'), period, setPeriod, periodOptions],
                [t('bets_filter_status_label'), status, setStatus, statusOptions],
                [t('bets_filter_account_label'), accountId, setAccountId, accountOptions],
                [t('bets_filter_kind_label'), kind, setKind, kindOptions],
              ].map(([label, value, onChange, options], i) => (
                <div key={i}>
                  <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{label}</div>
                  <DropdownPill label={label} ariaLabel={label} value={value} onChange={onChange} options={options} fullWidth />
                </div>
              ))}
            </div>
          </BottomSheet>
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <DropdownPill ariaLabel={t('bets_filter_period_label')} label={t('bets_filter_period_label')} value={period} onChange={setPeriod} options={periodOptions} />
      <DropdownPill ariaLabel={t('bets_filter_status_label')} label={t('bets_filter_status_label')} value={status} onChange={setStatus} options={statusOptions} />
      <DropdownPill ariaLabel={t('bets_filter_account_label')} label={t('bets_filter_account_label')} value={accountId} onChange={setAccountId} options={accountOptions} />
      <DropdownPill ariaLabel={t('bets_filter_kind_label')} label={t('bets_filter_kind_label')} value={kind} onChange={setKind} options={kindOptions} />
    </div>
  );
}

// ===================== Liste regroupee par jour =====================

function BetsList({ t, lang, groups, hideAmounts, onOpenBet, hasMore, onSeeMore }) {
  return (
    <div style={cardStyle}>
      {groups.map(([dayKey, bets], gi) => (
        <div key={dayKey} style={{ marginTop: gi > 0 ? '18px' : 0 }}>
          <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
            {dayGroupLabel(dayKey, t, lang)}
          </div>
          {bets.map((b, i) => (
            <div key={b.id} onClick={() => onOpenBet(b)} style={{ cursor: 'pointer' }}>
              <BetRow
                t={t} bordered={i > 0} hideAmounts={hideAmounts}
                title={b.title} bookmaker={b.bookmaker} odds={b.odds} stake={b.stake}
                status={b.status} profit={b.profit}
              />
            </div>
          ))}
        </div>
      ))}
      {hasMore && (
        <button onClick={onSeeMore} style={{ width: '100%', marginTop: '16px', padding: '10px', background: 'none', border: '1px solid var(--c-222)', borderRadius: '10px', color: 'var(--c-888)', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', minHeight: '44px' }}>
          {t('bets_see_more')}
        </button>
      )}
    </div>
  );
}

// ===================== Composant principal =====================

export function BetsPage({ lang = 'en' }) {
  const t = getT(lang);
  const isMobile = useIsMobile();

  const [utilisateur, setUtilisateur] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [paris, setParis] = useState([]);
  const [betsAuto, setBetsAuto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreurAction, setErreurAction] = useState('');

  const [hideAmounts, setHideAmounts] = useState(() => readHideAmounts());
  const [period, setPeriod] = useState('all');
  const [status, setStatus] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [kind, setKind] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [selectedBet, setSelectedBet] = useState(null); // objet normalise (bankrollCalc.js:normalizeBet)
  const [imageImport, setImageImport] = useState(null); // { apercu, base64 }
  const [erreurImport, setErreurImport] = useState('');
  const [accountSheetResolve, setAccountSheetResolve] = useState(null);
  const fileInputRef = useRef(null);

  function toggleHide() { setHideAmounts(prev => { writeHideAmounts(!prev); return !prev; }); }

  function signalerErreur(contexte, error) {
    console.error(contexte, error);
    setErreurAction(t('bets_action_error').replace('{erreur}', error?.message || String(error)));
  }

  useEffect(() => { chargerDonnees(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function chargerDonnees() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUtilisateur(user);
      if (!user) { setLoading(false); return; }
      const [accRes, txRes, parisRes, betsAutoRes] = await Promise.all([
        supabase.from('bankroll_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('bankroll_transactions').select('*').eq('user_id', user.id),
        supabase.from('paris').select('*').eq('user_id', user.id),
        supabase.from('bets_auto').select('*').eq('user_id', user.id),
      ]);
      setAccounts(accRes.data || []);
      setTransactions(txRes.data || []);
      setParis(parisRes.data || []);
      setBetsAuto(betsAutoRes.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  function demanderCreationCompte() {
    return new Promise(resolve => setAccountSheetResolve(() => resolve));
  }

  // Reglement/edition/suppression : touchent UNIQUEMENT le statut/les champs du pari -- jamais un
  // solde stocke, qui reste toujours derive (voir computeAccountBalance). 'annule' rembourse la
  // mise au prochain rendu simplement parce que son profit est force a 0 par normalizeBet, voir
  // computeSettledReturns.
  async function marquerStatut(item, statut) {
    try {
      const d = item.data;
      if (item.type === 'manuel') {
        const profit = statut === 'gagne' ? parseFloat((d.mise * d.cote - d.mise).toFixed(2)) : statut === 'annule' ? 0 : -parseFloat(d.mise);
        const { error } = await supabase.from('paris').update({ statut, profit }).eq('id', d.id);
        if (error) { signalerErreur('marquerStatut', error); return; }
      } else {
        const resultat = statut === 'gagne' ? parseFloat((d.mise * d.cote - d.mise).toFixed(2)) : statut === 'annule' ? 0 : -parseFloat(d.mise);
        const { error } = await supabase.from('bets_auto').update({ statut, resultat, verified_at: new Date().toISOString() }).eq('id', d.id);
        if (error) { signalerErreur('marquerStatut', error); return; }
      }
      setErreurAction('');
      setSelectedBet(null);
      chargerDonnees();
    } catch (err) { signalerErreur('marquerStatut', err); }
  }

  async function supprimer(item) {
    try {
      const d = item.data;
      const table = item.type === 'manuel' ? 'paris' : 'bets_auto';
      const { error } = await supabase.from(table).delete().eq('id', d.id);
      if (error) { signalerErreur('supprimer', error); return; }
      setErreurAction('');
      setSelectedBet(null);
      chargerDonnees();
    } catch (err) { signalerErreur('supprimer', err); }
  }

  async function modifier(item, champs) {
    try {
      const table = item.type === 'manuel' ? 'paris' : 'bets_auto';
      const { error } = await supabase.from(table).update(champs).eq('id', item.data.id);
      if (error) { signalerErreur('modifier', error); return; }
      setErreurAction('');
      setSelectedBet(null);
      chargerDonnees();
    } catch (err) { signalerErreur('modifier', err); }
  }

  async function importerBetAuto(champs) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inseree, error } = await supabase.from('bets_auto').insert({ user_id: user.id, statut: 'pending', ...champs }).select().single();
    if (error) { signalerErreur('importerBetAuto', error); return null; }
    setErreurAction('');
    chargerDonnees();
    return inseree;
  }

  function ouvrirAjoutPari() {
    setErreurImport('');
    fileInputRef.current?.click();
  }

  async function onFichierChoisi(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fichierVersJpegBase64(file);
      setImageImport({ apercu: dataUrl, base64: dataUrl.split(',')[1] });
    } catch {
      setErreurImport(t('import_error_unsupported_image'));
    }
  }

  // ===================== Donnees derivees =====================

  const allBets = useMemo(() => normalizeAllBets(paris, betsAuto), [paris, betsAuto]);

  const accountsWithData = useMemo(() => accounts.map(a => ({
    archivedAt: a.archived_at,
    transactions: transactions.filter(tx => tx.account_id === a.id),
    bets: betsForAccount(allBets, a.id),
  })), [accounts, transactions, allBets]);
  const bankrollGlobal = useMemo(() => computeGlobalBankroll(accountsWithData), [accountsWithData]);

  const availableForAccount = useMemo(() => Object.fromEntries(accounts.map(a => [
    a.id,
    computeAccountBalance(transactions.filter(tx => tx.account_id === a.id), betsForAccount(allBets, a.id)),
  ])), [accounts, transactions, allBets]);

  // Periode/compte/type : bornent le resume ET la liste. Statut : ne borne QUE la liste (le
  // resume montre toujours "en cours"/"ROI"/"taux de reussite" sur l'ensemble de la portee, pas
  // seulement sur le sous-ensemble filtre par statut qu'on regarde dans la liste en dessous).
  const scopedBets = useMemo(() => allBets.filter(b => {
    if (accountId !== 'all' && b.accountId !== accountId) return false;
    if (kind !== 'all' && b.kind !== kind) return false;
    return isWithinPeriod(refDateForBet(b), period);
  }), [allBets, accountId, kind, period]);

  const listBets = useMemo(() => (status === 'all' ? scopedBets : scopedBets.filter(b => b.status === status)), [scopedBets, status]);
  const sortedListBets = useMemo(
    () => [...listBets].sort((a, b) => new Date(refDateForBet(b) || 0) - new Date(refDateForBet(a) || 0)),
    [listBets]
  );
  const visibleBets = sortedListBets.slice(0, visibleCount);
  const groupedVisible = useMemo(() => groupBetsByDay(visibleBets), [visibleBets]);
  const hasMore = visibleCount < sortedListBets.length;

  const pendingInScope = useMemo(() => pendingBets(scopedBets), [scopedBets]);
  const activeCount = pendingInScope.length;
  const atRiskAmount = computeAtRisk(scopedBets);
  const roi = computeROI(scopedBets);
  const winRate = computeWinRate(scopedBets);

  const betsPourPartage = useMemo(() => paris.map(p => ({
    date: p.date_pari, profit: Number(p.profit) || 0, mise: Number(p.mise) || 0, statut: p.statut, type: null,
  })).concat(betsAuto.map(b => ({
    date: b.verified_at || b.created_at, profit: Number(b.resultat) || 0, mise: Number(b.mise) || 0,
    statut: b.statut === 'pending' ? 'actif' : b.statut, type: b.type_bet || null,
  }))), [paris, betsAuto]);

  const existingKinds = new Set(accounts.filter(a => a.kind !== 'other').map(a => a.kind));
  const hasAnyBet = allBets.length > 0;

  function itemDepuisBetNormalise(b) {
    return { type: b.source === 'paris' ? 'manuel' : 'auto', data: b.raw };
  }

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [period, status, accountId, kind]);

  if (loading) {
    return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--c-555)' }}>{t('favoris_chargement')}</div>;
  }

  return (
    <div className="bets-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: '800', letterSpacing: '-0.6px', color: 'var(--c-white)' }}>{t('bets_title')}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShareStatsButton t={t} lang={lang} bets={betsPourPartage} bankroll={bankrollGlobal} />
          {!isMobile && (
            <button onClick={ouvrirAjoutPari} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '20px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', minHeight: '44px' }}>
              <IconPlus /> {t('bets_add_btn')}
            </button>
          )}
        </div>
      </div>

      {erreurAction && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span>{erreurAction}</span>
          <button onClick={() => setErreurAction('')} style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button onClick={toggleHide} aria-label={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')} title={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')} style={{ background: 'none', border: '1px solid var(--c-222)', borderRadius: '50%', width: '36px', height: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--c-888)', flexShrink: 0 }}>
          {hideAmounts ? <IconEye color="var(--c-888)" /> : <IconEyeOff color="var(--c-888)" />}
        </button>
        <div className="bets-stats-grid" style={{ flex: 1 }}>
          <StatChip label={t('home_stat_active_bets')} value={activeCount} />
          <StatChip label={t('bank_at_risk_label')} value={hideAmounts ? <MaskedDots t={t} /> : `$${atRiskAmount.toFixed(2)}`} />
          <StatChip label={t('home_stat_roi')} value={hideAmounts ? <MaskedDots t={t} /> : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} />
          <StatChip label={t('home_stat_win_rate')} value={`${winRate.toFixed(0)}%`} />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <FilterBar
          t={t} period={period} setPeriod={setPeriod} status={status} setStatus={setStatus}
          accountId={accountId} setAccountId={setAccountId} kind={kind} setKind={setKind}
          accounts={accounts} isMobile={isMobile}
          mobileSheetOpen={mobileFiltersOpen} setMobileSheetOpen={setMobileFiltersOpen}
        />
      </div>

      {!hasAnyBet ? (
        <EmptyState
          title={t('bets_empty_title')} sub={t('bets_empty_sub')}
          cta={t('bets_add_btn')} onCta={ouvrirAjoutPari}
        />
      ) : sortedListBets.length === 0 ? (
        <EmptyState icon="🔍" title={t('bets_empty_filtered_title')} sub={t('bets_empty_filtered_sub')} />
      ) : (
        <BetsList
          t={t} lang={lang} groups={groupedVisible} hideAmounts={hideAmounts}
          onOpenBet={setSelectedBet} hasMore={hasMore} onSeeMore={() => setVisibleCount(n => n + PAGE_SIZE)}
        />
      )}

      <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" onChange={onFichierChoisi} style={{ display: 'none' }} />

      {erreurImport && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', color: '#ef4444' }}>
          {erreurImport}
        </div>
      )}

      {imageImport && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 2300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <BetImportFlow
              lang={lang} apercu={imageImport.apercu} imageBase64={imageImport.base64}
              onClose={() => setImageImport(null)}
              onEnregistrer={importerBetAuto}
              onImported={() => setImageImport(null)}
              accounts={accounts}
              defaultAccountId={accounts[0]?.id || null}
              onCreateAccount={demanderCreationCompte}
              availableForAccount={availableForAccount}
            />
          </div>
        </div>
      )}

      {accountSheetResolve && (
        <AddAccountSheet
          t={t} utilisateur={utilisateur} existingKinds={existingKinds}
          onClose={() => { accountSheetResolve(null); setAccountSheetResolve(null); }}
          onCreated={(compte) => { setAccounts(prev => [...prev, compte]); accountSheetResolve(compte); setAccountSheetResolve(null); }}
        />
      )}

      {selectedBet && (
        <BetDetailSheet
          item={itemDepuisBetNormalise(selectedBet)}
          onClose={() => setSelectedBet(null)}
          lang={lang}
          onDelete={supprimer}
          onMarkStatut={marquerStatut}
          onSave={modifier}
          accounts={accounts}
        />
      )}

      {isMobile && (
        <button
          onClick={ouvrirAjoutPari}
          aria-label={t('bets_add_btn')}
          className="bets-fab"
          style={{ position: 'fixed', right: '16px', zIndex: 300, display: 'flex', alignItems: 'center', gap: '6px', padding: '13px 18px', borderRadius: '30px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(249,115,22,0.4)' }}
        >
          <IconPlus /> {t('bets_add_btn')}
        </button>
      )}
    </div>
  );
}

export default BetsPage;
