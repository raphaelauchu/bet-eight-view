import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { readHideAmounts, MaskedDots } from './Home';
import { titreBetAuto } from './Dashboard';

// Page "Aperçu de la performance" (style Wealthsimple "Performance insights"), ouverte depuis
// le bloc Bankroll de l'accueil (clic sur la ligne de variation, voir BankrollHeroChart dans
// src/Home.js) avec la periode courante preselectionnee. Fusionne paris (table `paris`,
// entrees manuelles historiques) et bets_auto (table `bets_auto`, imports) en une liste
// uniforme pour les calculs -- memes deux sources que Home.js/Dashboard.js, jamais de donnee
// inventee. Respecte le choix "masquer le solde" fait a l'accueil (meme cle localStorage,
// lecture seule ici -- pas de bouton oeil sur cette page).

const PERIODES = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', 'all'];
const JOURS_PAR_PERIODE = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365 };

function filtrerParPeriode(liste, periode) {
  const maintenant = new Date();
  return liste.filter(x => {
    if (!x.date) return false;
    if (periode === 'all') return true;
    const d = new Date(x.date);
    if (periode === 'ytd') return d.getFullYear() === maintenant.getFullYear();
    return (maintenant - d) / 86400000 <= JOURS_PAR_PERIODE[periode];
  });
}

function gainPotentiel(p) {
  return p.mise && p.cote ? p.mise * p.cote - p.mise : 0;
}

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

function IconChevronDown({ color = 'var(--c-666)', size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Menu deroulant flottant style Wealthsimple : bouton (libelle actif + chevron), panneau
// arrondi avec groupes optionnels, bouton radio a droite de l'option selectionnee.
function DropdownFlottant({ label, groups, valeur, onChange, alignRight = false }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    function onClickDehors(e) { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); }
    document.addEventListener('mousedown', onClickDehors);
    return () => document.removeEventListener('mousedown', onClickDehors);
  }, [ouvert]);

  const optionActive = groups.flatMap(g => g.options).find(o => o.value === valeur);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOuvert(o => !o)} aria-haspopup="listbox" aria-expanded={ouvert} aria-label={label} className="perf-dropdown-btn">
        <span>{optionActive ? optionActive.label : label}</span>
        <IconChevronDown />
      </button>
      {ouvert && (
        <div className="perf-dropdown-panel" style={alignRight ? { right: 0 } : { left: 0 }}>
          {groups.map((g, i) => (
            <div key={i}>
              {g.titre && <div className="perf-dropdown-titre">{g.titre}</div>}
              {g.options.map(opt => (
                <button key={opt.value} className="perf-dropdown-option" onClick={() => { onChange(opt.value); setOuvert(false); }}>
                  <span>{opt.label}</span>
                  <span className={`perf-radio${opt.value === valeur ? ' perf-radio-actif' : ''}`}><span /></span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [bankroll, setBankroll] = useState(null);
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
      const [bk, tx, pr, ba] = await Promise.all([
        supabase.from('bankroll').select('montant').eq('user_id', utilisateur.id).maybeSingle(),
        supabase.from('transactions').select('*').eq('user_id', utilisateur.id),
        supabase.from('paris').select('*').eq('user_id', utilisateur.id),
        supabase.from('bets_auto').select('*').eq('user_id', utilisateur.id),
      ]);
      if (annule) return;
      setBankroll(bk.data ? bk.data.montant : 0);
      setTransactions(tx.data || []);
      setParis(pr.data || []);
      setBetsAuto(ba.data || []);
      setChargement(false);
    })();
    return () => { annule = true; };
  }, [utilisateur?.id]);

  // Fusionne les deux sources de paris en une liste uniforme pour les calculs et le tableau.
  const tousLesParis = useMemo(() => [
    ...paris.map(p => ({
      id: `m-${p.id}`, date: p.date_pari, label: p.match || '—', bookmaker: p.bookmaker || null,
      mise: Number(p.mise) || 0, cote: Number(p.cote) || 0, statut: p.statut, profit: Number(p.profit) || 0, type: null,
    })),
    ...betsAuto.map(b => ({
      id: `a-${b.id}`, date: b.verified_at || b.created_at, label: titreBetAuto(b), bookmaker: b.bookmaker || null,
      mise: Number(b.mise) || 0, cote: Number(b.cote) || 0, statut: b.statut === 'pending' ? 'actif' : b.statut,
      profit: Number(b.resultat) || 0, type: b.type_bet || null,
    })),
  ], [paris, betsAuto]);

  const bookmakersDisponibles = useMemo(() => [...new Set(tousLesParis.map(p => p.bookmaker).filter(Boolean))].sort(), [tousLesParis]);
  const typesDisponibles = useMemo(() => [...new Set(tousLesParis.map(p => p.type).filter(Boolean))], [tousLesParis]);

  const parisPortee = useMemo(() => tousLesParis.filter(p => {
    if (portee === 'all' || portee === 'sport:nhl') return true;
    if (portee.startsWith('book:')) return p.bookmaker === portee.slice(5);
    if (portee.startsWith('type:')) return p.type === portee.slice(5);
    return true;
  }), [tousLesParis, portee]);

  const parisActifsTotal = parisPortee.filter(p => p.statut === 'actif');
  const parisReglesTotal = parisPortee.filter(p => p.statut !== 'actif');

  const totalDepose = transactions.filter(x => x.type === 'deposit').reduce((a, x) => a + (x.montant || 0), 0);
  const totalRetire = transactions.filter(x => x.type === 'withdrawal').reduce((a, x) => a + (x.montant || 0), 0);
  const depotsNets = totalDepose - totalRetire;
  const rendementDepuisDebut = parisReglesTotal.reduce((a, p) => a + p.profit, 0);
  const profitNonRealise = parisActifsTotal.reduce((a, p) => a + gainPotentiel(p), 0);

  const periodeLabel = t(`perf_period_${periode}`);
  const parisPeriode = useMemo(() => filtrerParPeriode(parisPortee, periode), [parisPortee, periode]);
  const parisReglesPeriode = parisPeriode.filter(p => p.statut !== 'actif');
  const parisActifsPeriode = parisPeriode.filter(p => p.statut === 'actif');
  const profitRealisePeriode = parisReglesPeriode.reduce((a, p) => a + p.profit, 0);
  const profitPotentielPeriode = parisActifsPeriode.reduce((a, p) => a + gainPotentiel(p), 0);
  const rendementTotalPeriode = profitRealisePeriode + profitPotentielPeriode;
  const miseTotaleReglesPeriode = parisReglesPeriode.reduce((a, p) => a + p.mise, 0);
  const tauxRendementSimple = depotsNets !== 0 ? (rendementTotalPeriode / Math.abs(depotsNets)) * 100 : 0;
  const roiPeriode = miseTotaleReglesPeriode !== 0 ? (profitRealisePeriode / miseTotaleReglesPeriode) * 100 : 0;
  const gagnesPeriode = parisReglesPeriode.filter(p => p.statut === 'gagne').length;
  const perdusPeriode = parisReglesPeriode.filter(p => p.statut === 'perdu').length;
  const tauxReussitePeriode = parisReglesPeriode.length ? (gagnesPeriode / parisReglesPeriode.length) * 100 : 0;

  const nbMisesPeriode = parisPeriode.length;
  const montantMisesPeriode = parisPeriode.reduce((a, p) => a + p.mise, 0);
  const coteMoyennePeriode = nbMisesPeriode ? parisPeriode.reduce((a, p) => a + p.cote, 0) / nbMisesPeriode : 0;

  const tableauDonnees = useMemo(() => [...parisPeriode].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [parisPeriode]);

  function exporterCSV() {
    const entetes = [t('perf_table_col_date'), t('perf_table_col_bet'), t('perf_table_col_sportsbook'), t('perf_table_col_stake'), t('perf_table_col_odds'), t('perf_table_col_result'), t('perf_table_col_profit')];
    const lignes = tableauDonnees.map(p => [
      p.date ? new Date(p.date).toISOString().slice(0, 10) : '',
      `"${(p.label || '').replace(/"/g, '""')}"`,
      p.bookmaker || '',
      p.mise.toFixed(2),
      p.cote.toFixed(2),
      t(p.statut === 'gagne' ? 'perf_result_won' : p.statut === 'perdu' ? 'perf_result_lost' : 'perf_result_active'),
      p.statut === 'actif' ? '' : p.profit.toFixed(2),
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
      <style>{`
        .perf-dropdown-btn { display: flex; align-items: center; gap: 6px; padding: 7px 12px; background-color: var(--c-0d0d0d); border: 1px solid var(--c-222); border-radius: 20px; color: var(--c-ccc); font-size: 12px; font-weight: 600; cursor: pointer; }
        .perf-dropdown-btn:hover { border-color: var(--c-333); }
        .perf-dropdown-panel { position: absolute; top: calc(100% + 6px); z-index: 60; min-width: 200px; background-color: var(--c-111); border: 1px solid var(--c-222); border-radius: 14px; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
        .perf-dropdown-titre { padding: 8px 10px 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--c-666); }
        .perf-dropdown-option { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 9px 10px; background: none; border: none; border-radius: 9px; color: var(--c-ccc); font-size: 13px; cursor: pointer; text-align: left; }
        .perf-dropdown-option:hover { background-color: var(--c-1a1a1a); }
        .perf-radio { width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--c-444); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .perf-radio span { width: 7px; height: 7px; border-radius: 50%; background: none; }
        .perf-radio-actif { border-color: #f97316; }
        .perf-radio-actif span { background-color: #f97316; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--c-ccc)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '6px 2px' }}>
          <IconBack /> {t('back_btn').replace('← ', '')}
        </button>
        <DropdownFlottant
          label={t('perf_scope_label')}
          valeur={portee}
          onChange={setPortee}
          groups={[
            { options: [{ value: 'all', label: t('perf_scope_all') }] },
            ...(bookmakersDisponibles.length > 0 ? [{ titre: t('perf_scope_group_bookmaker'), options: bookmakersDisponibles.map(bm => ({ value: `book:${bm}`, label: bm })) }] : []),
            { titre: t('perf_scope_group_sport'), options: [{ value: 'sport:nhl', label: t('perf_scope_sport_nhl') }] },
            ...(typesDisponibles.length > 0 ? [{ titre: t('perf_scope_group_type'), options: typesDisponibles.map(ty => ({ value: `type:${ty}`, label: labelTypePari(ty, t) })) }] : []),
          ]}
        />
      </div>

      <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(24px, 3vw, 30px)', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--c-white)' }}>{t('perf_title')}</h1>
      <div style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-1.5px', marginBottom: '24px' }}>
        {hideAmounts ? <MaskedDots count={7} size={12} t={t} /> : `$${bankrollAffiche}`} <span style={{ fontSize: '16px', color: 'var(--c-555)', fontWeight: '700' }}>{t('perf_currency')}</span>
      </div>

      <div className="perf-stats-grid" style={{ marginBottom: '32px' }}>
        <div style={carteStyle}>
          <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{t('perf_net_deposits')}</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}><Montant hideAmounts={hideAmounts} valeur={depotsNets} formatte={fmtMontantAbs} t={t} /></div>
        </div>
        <div style={carteStyle}>
          <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{t('perf_total_return')}</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: rendementDepuisDebut >= 0 ? '#22c55e' : '#ef4444' }}><Montant hideAmounts={hideAmounts} valeur={rendementDepuisDebut} formatte={fmtMontant} t={t} /></div>
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
        <DropdownFlottant
          label={t('perf_overview_title')}
          valeur={periode}
          onChange={setPeriode}
          alignRight
          groups={[{ options: PERIODES.map(p => ({ value: p, label: t(`perf_period_${p}`) })) }]}
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
                <div style={{ fontSize: '30px', fontWeight: '900', color: rendementTotalPeriode >= 0 ? '#22c55e' : '#ef4444' }}>
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
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-ccc)' }}><Montant hideAmounts={hideAmounts} valeur={roiPeriode} formatte={fmtPct} t={t} /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="perf-two-grid" style={{ marginBottom: '32px' }}>
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', marginBottom: '8px' }}>{t('perf_realized_profit_period').replace('{periode}', periodeLabel)}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: profitRealisePeriode >= 0 ? '#22c55e' : '#ef4444' }}><Montant hideAmounts={hideAmounts} valeur={profitRealisePeriode} formatte={fmtMontant} t={t} /></div>
            </div>
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', marginBottom: '8px' }}>{t('perf_win_rate_period').replace('{periode}', periodeLabel)}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}>
                {hideAmounts ? <MaskedDots t={t} /> : `${tauxReussitePeriode.toFixed(0)}%`}
                <span style={{ fontSize: '12px', color: 'var(--c-555)', fontWeight: '600', marginLeft: '8px' }}>{hideAmounts ? '' : `${gagnesPeriode}-${perdusPeriode}`}</span>
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
                <button onClick={exporterCSV} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--c-333)', backgroundColor: 'var(--c-1a1a1a)', color: 'var(--c-ccc)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>{t('perf_export_csv')}</button>
                <button onClick={() => setTableauOuvert(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--c-222)', background: 'none', color: 'var(--c-888)', fontSize: '12px', cursor: 'pointer' }}>{t('favoris_retour')}</button>
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
                  ) : tableauDonnees.map(p => (
                    <tr key={p.id}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{p.date ? new Date(p.date).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA') : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-white)', fontWeight: '600', borderBottom: '1px solid var(--c-141414)' }}>{p.label}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{p.bookmaker || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{hideAmounts ? <MaskedDots t={t} /> : `$${p.mise.toFixed(2)}`}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{p.cote ? p.cote.toFixed(2) : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' }}>{t(p.statut === 'gagne' ? 'perf_result_won' : p.statut === 'perdu' ? 'perf_result_lost' : 'perf_result_active')}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '700', color: p.statut === 'actif' ? 'var(--c-555)' : p.profit >= 0 ? '#22c55e' : '#ef4444', borderBottom: '1px solid var(--c-141414)' }}>
                        {p.statut === 'actif' ? '—' : hideAmounts ? <MaskedDots t={t} /> : fmtMontant(p.profit)}
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
