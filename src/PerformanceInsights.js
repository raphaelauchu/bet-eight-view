import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { readHideAmounts, MaskedDots } from './Home';
import { titreBetAuto } from './betDisplay';
import { DropdownPill } from './DropdownPill';
import { ShareStatsButton } from './ShareStats';
import {
  normalizeAllBets, betsForAccount, refDateForBet, isWithinPeriod, signColor,
  computeGlobalBankroll, computeNetDeposits, computePeriodStats, computeUnrealizedProfit, computeTotalReturn,
} from './bankrollCalc';

// Page "Aperçu de la performance" (style Wealthsimple "Performance insights"), ouverte depuis
// le bloc Bankroll de l'accueil (clic sur la ligne de variation, voir BankrollHeroChart dans
// src/Home.js) avec la periode courante preselectionnee. MEME source de donnees et MEMES
// fonctions de calcul que l'accueil/la page de compte (src/bankrollCalc.js, source unique de
// verite -- voir computeGlobalBankroll/computeNetDeposits/computePeriodStats) : comptes
// bankroll_accounts + transactions bankroll_transactions (jamais les anciennes tables
// `bankroll`/`transactions`, retirees lors de la refonte multi-comptes du 2026-11-21 mais encore
// interrogees ici par erreur avant ce correctif -- source du "924$" sans rapport et du "Net
// deposits" toujours a 0$, voir le CHANGELOG de ce fichier). Fusionne paris (table `paris`,
// entrees manuelles historiques) et bets_auto (table `bets_auto`, imports) via normalizeAllBets,
// jamais de donnee inventee. Respecte le choix "masquer le solde" fait a l'accueil (meme cle
// localStorage, lecture seule ici -- pas de bouton oeil sur cette page).

const PERIODES = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', 'all'];

function labelTypePari(type, t) {
  if (!type) return null;
  const cle = { 'Moneyline': 'perf_type_moneyline', 'Prop joueur': 'perf_type_prop', 'Total': 'perf_type_total', 'Parlay': 'perf_type_parlay' }[type];
  return cle ? t(cle) : type;
}

function IconBack({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconInfo({ color = 'var(--c-555)', size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" />
      <circle cx="12" cy="8.2" r="0.6" fill={color} stroke="none" />
    </svg>
  );
}

function InfoTooltip({ texte }) {
  return (
    <span title={texte} style={{ cursor: 'help', display: 'inline-flex', marginLeft: '5px', verticalAlign: 'middle' }}>
      <IconInfo />
    </span>
  );
}

const carteStyle = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '18px', border: '1px solid var(--c-161616)' };

function Montant({ hideAmounts, valeur, formatte, t, count = 5 }) {
  return hideAmounts ? <MaskedDots count={count} size={count > 5 ? 10 : 5} t={t} /> : formatte(valeur);
}

const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const fmtMontant = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;
const fmtMontantAbs = (v) => `$${v.toFixed(2)}`;

export function PerformanceInsights({ utilisateur, lang = 'fr', onBack, initialPeriod = 'all' }) {
  const t = getT(lang);
  const [hideAmounts] = useState(() => readHideAmounts());
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [paris, setParis] = useState([]);
  const [betsAuto, setBetsAuto] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [periode, setPeriode] = useState(PERIODES.includes(initialPeriod) ? initialPeriod : 'all');
  const [portee, setPortee] = useState('all');
  const [tableauOuvert, setTableauOuvert] = useState(false);

  useEffect(() => {
    if (!utilisateur?.id) { setChargement(false); return; }
    let annule = false;
    (async () => {
      const [acc, tx, pr, ba] = await Promise.all([
        supabase.from('bankroll_accounts').select('*').eq('user_id', utilisateur.id),
        supabase.from('bankroll_transactions').select('*').eq('user_id', utilisateur.id),
        supabase.from('paris').select('*').eq('user_id', utilisateur.id),
        supabase.from('bets_auto').select('*').eq('user_id', utilisateur.id),
      ]);
      if (annule) return;
      setAccounts(acc.data || []);
      setTransactions(tx.data || []);
      setParis(pr.data || []);
      setBetsAuto(ba.data || []);
      setChargement(false);
    })();
    return () => { annule = true; };
  }, [utilisateur?.id]);

  // Memes comptes/bets/transactions "globaux" que l'accueil (src/Home.js:HomeDashboard) et la
  // page de compte (src/Bankroll.js) : comptes non archives uniquement, aucun pari sans compte
  // (account_id NULL) ne compte dans aucun total tant qu'il n'est pas rattache.
  const allBets = useMemo(() => normalizeAllBets(paris, betsAuto), [paris, betsAuto]);
  const accountsNonArchivees = useMemo(() => new Set(accounts.filter(a => !a.archived_at).map(a => a.id)), [accounts]);
  const accountsWithData = useMemo(() => accounts.map(a => ({
    archivedAt: a.archived_at,
    transactions: transactions.filter(tx => tx.account_id === a.id),
    bets: betsForAccount(allBets, a.id),
  })), [accounts, transactions, allBets]);
  const betsGlobal = useMemo(() => allBets.filter(b => accountsNonArchivees.has(b.accountId)), [allBets, accountsNonArchivees]);
  const transactionsGlobal = useMemo(() => transactions.filter(tx => accountsNonArchivees.has(tx.account_id)), [transactions, accountsNonArchivees]);

  // Bankroll globale = EXACTEMENT la meme fonction que l'accueil (computeGlobalBankroll) -- plus
  // jamais lue depuis une colonne bankroll.montant separee qui pouvait diverger (voir le
  // commentaire de tete de fichier).
  const bankroll = useMemo(() => computeGlobalBankroll(accountsWithData), [accountsWithData]);

  const bookmakersDisponibles = useMemo(() => [...new Set(betsGlobal.map(b => b.bookmaker).filter(Boolean))].sort(), [betsGlobal]);
  const typesDisponibles = useMemo(() => [...new Set(betsGlobal.map(b => b.raw?.type_bet).filter(Boolean))], [betsGlobal]);

  const betsPortee = useMemo(() => betsGlobal.filter(b => {
    if (portee === 'all' || portee === 'sport:nhl') return true;
    if (portee.startsWith('book:')) return b.bookmaker === portee.slice(5);
    if (portee.startsWith('type:')) return b.raw?.type_bet === portee.slice(5);
    return true;
  }), [betsGlobal, portee]);

  // Depots nets ET rendement total : TOUJOURS depuis toujours (jamais bornes a la periode), voir
  // les 3 cartes du haut -- computeNetDeposits/computeTotalReturn/computeUnrealizedProfit, memes
  // fonctions que src/Bankroll.js:AccountDetail.
  const depotsNets = useMemo(() => computeNetDeposits(transactionsGlobal), [transactionsGlobal]);
  const rendementDepuisDebut = useMemo(() => computeTotalReturn(betsPortee), [betsPortee]);
  const profitNonRealise = useMemo(() => computeUnrealizedProfit(betsPortee), [betsPortee]);

  const periodeLabel = t(`perf_period_${periode}`);
  // Stats de la PERIODE : meme fonction/meme base de date (reglement pour un pari decide,
  // placement pour un pari encore en cours) que l'accueil et la page de compte -- voir
  // computePeriodStats (src/bankrollCalc.js). Jamais retours/mises affiche comme un ROI : roi =
  // profit/mises, deja correct dans computePeriodStats.
  const periodStats = useMemo(() => computePeriodStats(betsPortee, periode), [betsPortee, periode]);
  // "Rendement total (periode)" inclut aussi le gain potentiel des paris actifs PLACES durant la
  // periode (voir perf_total_return_period_tooltip) -- deja calcule par computePeriodStats
  // (totalWithUnrealized = profit + unrealized).
  const rendementTotalPeriode = periodStats.totalWithUnrealized;
  const tauxRendementSimple = depotsNets !== 0 ? (rendementTotalPeriode / Math.abs(depotsNets)) * 100 : 0;

  // "Mises placees (periode)" compte TOUS les paris de la periode (decides + encore en jeu),
  // meme filtre refDateForBet que computePeriodStats -- pas seulement les paris decides.
  const parisPeriode = useMemo(() => {
    const now = new Date();
    return betsPortee.filter(b => isWithinPeriod(refDateForBet(b), periode, now));
  }, [betsPortee, periode]);
  const nbMisesPeriode = parisPeriode.length;
  const montantMisesPeriode = parisPeriode.reduce((a, b) => a + (b.stake || 0), 0);
  const coteMoyennePeriode = nbMisesPeriode ? parisPeriode.reduce((a, b) => a + (b.odds || 0), 0) / nbMisesPeriode : 0;

  const tableauDonnees = useMemo(() => [...parisPeriode].sort((a, b) => new Date(refDateForBet(b) || 0) - new Date(refDateForBet(a) || 0)), [parisPeriode]);

  function exporterCSV() {
    const entetes = [t('perf_table_col_date'), t('perf_table_col_bet'), t('perf_table_col_sportsbook'), t('perf_table_col_stake'), t('perf_table_col_odds'), t('perf_table_col_result'), t('perf_table_col_profit')];
    const lignes = tableauDonnees.map(b => [
      refDateForBet(b) ? new Date(refDateForBet(b)).toISOString().slice(0, 10) : '',
      `"${(b.title || '').replace(/"/g, '""')}"`,
      b.bookmaker || '',
      (b.stake || 0).toFixed(2),
      (b.odds || 0).toFixed(2),
      t(b.status === 'won' ? 'perf_result_won' : b.status === 'lost' ? 'perf_result_lost' : 'perf_result_active'),
      b.status === 'pending' ? '' : (b.profit || 0).toFixed(2),
    ].join(','));
    const csv = [entetes.join(','), ...lignes].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `betrics-performance-${periode}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  const bankrollAffiche = bankroll != null ? bankroll.toFixed(2) : '0.00';

  return (
    <div className="perf-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--c-ccc)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '6px 2px', minHeight: '44px' }}>
          <IconBack /> {t('back_btn').replace('← ', '')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShareStatsButton t={t} lang={lang} bets={betsPourPartage(betsGlobal)} bankroll={bankroll} />
          <DropdownPill
            label={t('perf_scope_label')}
            value={portee}
            onChange={setPortee}
            groups={[
              { options: [{ value: 'all', label: t('perf_scope_all') }] },
              ...(bookmakersDisponibles.length > 0 ? [{ titre: t('perf_scope_group_bookmaker'), options: bookmakersDisponibles.map(bm => ({ value: `book:${bm}`, label: bm })) }] : []),
              { titre: t('perf_scope_group_sport'), options: [{ value: 'sport:nhl', label: t('perf_scope_sport_nhl') }] },
              ...(typesDisponibles.length > 0 ? [{ titre: t('perf_scope_group_type'), options: typesDisponibles.map(ty => ({ value: `type:${ty}`, label: labelTypePari(ty, t) })) }] : []),
            ]}
          />
        </div>
      </div>

      <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(24px, 3vw, 30px)', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--c-white)' }}>{t('perf_title')}</h1>
      <div style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '900', color: signColor(bankroll, 'var(--c-white)'), letterSpacing: '-1.5px', marginBottom: '24px' }}>
        {hideAmounts ? <MaskedDots count={7} size={12} t={t} /> : `$${bankrollAffiche}`} <span style={{ fontSize: '16px', color: 'var(--c-555)', fontWeight: '700' }}>{t('perf_currency')}</span>
      </div>

      <div className="perf-stats-grid" style={{ marginBottom: '32px' }}>
        <div style={carteStyle}>
          <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{t('perf_net_deposits')}</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}><Montant hideAmounts={hideAmounts} valeur={depotsNets} formatte={fmtMontantAbs} t={t} /></div>
        </div>
        <div style={carteStyle}>
          <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{t('perf_total_return')}</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: signColor(rendementDepuisDebut) }}><Montant hideAmounts={hideAmounts} valeur={rendementDepuisDebut} formatte={fmtMontant} t={t} /></div>
        </div>
        <div style={carteStyle}>
          <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
            {t('perf_unrealized_profit')}<InfoTooltip texte={t('perf_unrealized_tooltip')} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}><Montant hideAmounts={hideAmounts} valeur={profitNonRealise} formatte={fmtMontantAbs} t={t} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--c-white)' }}>{t('perf_overview_title')}</h2>
        <DropdownPill
          label={t('perf_overview_title')}
          value={periode}
          onChange={setPeriode}
          align="right"
          options={PERIODES.map(p => ({ value: p, label: t(`perf_period_${p}`) }))}
        />
      </div>

      {chargement ? (
        <div style={{ ...carteStyle, textAlign: 'center', color: 'var(--c-555)', fontSize: '13px', padding: '30px' }}>{t('favoris_chargement')}</div>
      ) : (
        <>
          <div style={{ ...carteStyle, marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--c-555)', fontWeight: '600', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  {t('perf_total_return_period').replace('{periode}', periodeLabel)}<InfoTooltip texte={t('perf_total_return_period_tooltip')} />
                </div>
                <div style={{ fontSize: '30px', fontWeight: '900', color: signColor(rendementTotalPeriode) }}>
                  <Montant hideAmounts={hideAmounts} valeur={rendementTotalPeriode} formatte={fmtMontant} t={t} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '28px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--c-555)', marginBottom: '4px' }}>{t('perf_simple_return_rate')}</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-ccc)' }}><Montant hideAmounts={hideAmounts} valeur={tauxRendementSimple} formatte={fmtPct} t={t} /></div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--c-555)', marginBottom: '4px' }}>{t('perf_roi')}</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-ccc)' }}><Montant hideAmounts={hideAmounts} valeur={periodStats.roi} formatte={fmtPct} t={t} /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="perf-two-grid" style={{ marginBottom: '32px' }}>
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', marginBottom: '8px' }}>{t('perf_realized_profit_period').replace('{periode}', periodeLabel)}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: signColor(periodStats.profit) }}><Montant hideAmounts={hideAmounts} valeur={periodStats.profit} formatte={fmtMontant} t={t} /></div>
            </div>
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', marginBottom: '8px' }}>{t('perf_win_rate_period').replace('{periode}', periodeLabel)}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}>
                {hideAmounts ? <MaskedDots t={t} /> : `${periodStats.winRate.toFixed(0)}%`}
                <span style={{ fontSize: '12px', color: 'var(--c-555)', fontWeight: '600', marginLeft: '8px' }}>{hideAmounts ? '' : `${periodStats.wonCount}-${periodStats.lostCount}`}</span>
              </div>
            </div>
          </div>

          <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '800', color: 'var(--c-white)' }}>{t('perf_contributions_title')}</h2>
          <div className="perf-two-grid" style={{ marginBottom: '24px' }}>
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', marginBottom: '8px' }}>{t('perf_stakes_placed_period').replace('{periode}', periodeLabel)}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}>
                {hideAmounts ? <MaskedDots t={t} /> : `${nbMisesPeriode} · ${fmtMontantAbs(montantMisesPeriode)}`}
              </div>
            </div>
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', marginBottom: '8px' }}>{t('perf_avg_odds')}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}>{nbMisesPeriode ? coteMoyennePeriode.toFixed(2) : '—'}</div>
            </div>
          </div>

          {nbMisesPeriode === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--c-555)', fontSize: '13px', padding: '10px 0 24px' }}>{t('home_no_bets_period')}</div>
          )}

          <button onClick={() => setTableauOuvert(true)} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: 0 }}>
            {t('perf_view_table')}
          </button>
        </>
      )}

      {tableauOuvert && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setTableauOuvert(false)}>
          <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '18px', border: '1px solid var(--c-222)', padding: '20px', maxWidth: '1000px', width: '100%', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--c-white)' }}>{t('perf_view_table').replace(' →', '')}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={exporterCSV} style={{ padding: '8px 14px', minHeight: '44px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid var(--c-333)', backgroundColor: 'var(--c-1a1a1a)', color: 'var(--c-ccc)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>{t('perf_export_csv')}</button>
                <button onClick={() => setTableauOuvert(false)} style={{ padding: '8px 14px', minHeight: '44px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid var(--c-222)', background: 'none', color: 'var(--c-888)', fontSize: '12px', cursor: 'pointer' }}>{t('favoris_retour')}</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                <thead>
                  <tr>
                    {['perf_table_col_date', 'perf_table_col_bet', 'perf_table_col_sportsbook', 'perf_table_col_stake', 'perf_table_col_odds', 'perf_table_col_result', 'perf_table_col_profit'].map(cle => (
                      <th key={cle} style={{ textAlign: 'left', fontSize: '11px', color: 'var(--c-555)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 12px', borderBottom: '1px solid var(--c-1a1a1a)', whiteSpace: 'nowrap' }}>{t(cle)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableauDonnees.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--c-555)', fontSize: '13px' }}>{t('home_no_bets_period')}</td></tr>
                  ) : tableauDonnees.map(b => (
                    <tr key={b.id}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{refDateForBet(b) ? new Date(refDateForBet(b)).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA') : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-white)', fontWeight: '600', borderBottom: '1px solid var(--c-141414)' }}>{b.title}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{b.bookmaker || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{hideAmounts ? <MaskedDots t={t} /> : `$${(b.stake || 0).toFixed(2)}`}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{b.odds ? b.odds.toFixed(2) : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{t(b.status === 'won' ? 'perf_result_won' : b.status === 'lost' ? 'perf_result_lost' : 'perf_result_active')}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '700', color: b.status === 'pending' ? 'var(--c-555)' : signColor(b.profit), borderBottom: '1px solid var(--c-141414)' }}>
                        {b.status === 'pending' ? '—' : hideAmounts ? <MaskedDots t={t} /> : fmtMontant(b.profit || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Paris unifies pour la carte de partage (src/ShareStats.js), memes champs qu'avant la refonte
// (date/profit/mise/statut/type) -- ShareStats n'a pas besoin du reste de la forme normalisee.
function betsPourPartage(betsGlobal) {
  return betsGlobal.map(b => ({ date: refDateForBet(b), profit: b.profit || 0, mise: b.stake || 0, statut: b.status === 'won' ? 'gagne' : b.status === 'lost' ? 'perdu' : b.status === 'cancelled' ? 'annule' : 'actif', type: b.raw?.type_bet || null }));
}
