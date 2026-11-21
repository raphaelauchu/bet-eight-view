import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile, useMinWidth } from './useIsMobile';
import { BottomSheet } from './BottomSheet';
import { DropdownPill } from './DropdownPill';
import { WealthsimpleChart } from './WealthsimpleChart';
import { BankrollCalendar } from './BankrollCalendar';
import { MaskedDots, readHideAmounts, writeHideAmounts } from './Home';
import { AddAccountBody } from './AddAccountBody';
import BetImportFlow from './BetImportFlow';
import { fichierVersJpegBase64 } from './imageUtils';
import {
  normalizeAllBets, betsForAccount, computeAccountBalance,
  computeAtRisk, computeAvailable, computeNetDeposits, computeROI, computeWinRate,
  computeAverageOdds, computeBestDay, computeTotalStaked,
  computeGlobalBankroll, computeBankrollSeries, computeVariation, BANKROLL_PERIODS,
} from './bankrollCalc';

// Refonte de l'onglet Bankroll : comptes multiples (un par sportsbook manuel + "Autre"),
// strictement MANUEL (aucune connexion reelle a un sportsbook, voir src/SportsbookWaitlist.js
// pour la liste d'attente de synchronisation automatique). Deux ecrans :
// - BankrollOverview : solde global (= somme des comptes non archives, bankrollCalc.js) + grille
//   de cartes de comptes.
// - AccountDetail : solde/courbe/calendrier/paris recents d'UN compte + actions (depot/retrait).
// BankrollPage (export principal, remplace l'ancienne version inline de src/App.js) choisit
// entre les deux selon l'etat local `selectedAccountId`, sans jamais quitter la page "Bankroll".

function IconPlusSmall({ color = 'currentColor', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}
function IconDots({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  );
}
function IconArrowDownCircle({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" /><path d="m6 13 6 6 6-6" />
    </svg>
  );
}
function IconArrowUpCircle({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="m6 11 6-6 6 6" />
    </svg>
  );
}
function IconEyeSm({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOffSm({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c6.5 0 10.5 7 10.5 7a18 18 0 0 1-3.1 3.9" />
      <path d="M6.1 6.1C3.2 8 1.5 11 1.5 11s4 7 10.5 7a10.4 10.4 0 0 0 4.1-.84" />
    </svg>
  );
}

function fmt(n) { return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`; }
function fmtSigned(n) { return `${n >= 0 ? '+' : ''}$${n.toFixed(2)}`; }

function nomCompte(a, t) {
  return a.name || t('bank_account_other');
}

function formatDateCourte(dateStr, lang) {
  if (!dateStr) return '—';
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' });
}

// ===================== Conteneur generique feuille du bas (mobile) / modale centree (desktop) ====

function SheetOrModal({ title, onClose, children, maxWidth = 440 }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <BottomSheet onClose={onClose} title={title}>{children}</BottomSheet>;
  }
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: `${maxWidth}px`, maxHeight: '85vh', overflowY: 'auto', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '18px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--c-white)' }}>{title}</span>
          <button onClick={onClose} aria-label="Fermer" style={{ width: '30px', height: '30px', minHeight: '30px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'none', color: 'var(--c-888)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const inputStyle = { width: '100%', padding: '11px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
const labelStyle = { color: 'var(--c-555)', fontSize: '12px', marginBottom: '6px', fontWeight: '500' };
const primaryBtn = { padding: '12px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const secondaryBtn = { padding: '11px 20px', backgroundColor: 'transparent', color: 'var(--c-888)', border: '1px solid var(--c-333)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' };

// ===================== Ajouter un compte =====================
// Le formulaire lui-meme (AddAccountBody) vit dans son propre fichier (src/AddAccountBody.js)
// pour que src/Home.js puisse le reutiliser sans importer Bankroll.js (voir ce fichier pour le
// detail du cycle evite).

export function AddAccountSheet({ t, utilisateur, existingKinds, onClose, onCreated }) {
  return (
    <SheetOrModal title={t('bank_add_account_title')} onClose={onClose}>
      <AddAccountBody t={t} utilisateur={utilisateur} existingKinds={existingKinds} onCreated={onCreated} />
    </SheetOrModal>
  );
}

// ===================== Renommer =====================

function RenameAccountSheet({ t, account, onClose, onRenamed }) {
  const [nom, setNom] = useState(account.name);
  const [saving, setSaving] = useState(false);

  async function sauvegarder() {
    if (!nom.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('bankroll_accounts').update({ name: nom.trim() }).eq('id', account.id);
    setSaving(false);
    if (!error) onRenamed(nom.trim());
  }

  return (
    <SheetOrModal title={t('bank_rename_title')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} autoFocus />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={secondaryBtn}>{t('cancel_btn')}</button>
          <button onClick={sauvegarder} disabled={saving || !nom.trim()} style={{ ...primaryBtn, flex: 1 }}>{saving ? t('saving_text') : t('confirm_btn')}</button>
        </div>
      </div>
    </SheetOrModal>
  );
}

// ===================== Supprimer (confirmation forte) =====================

function DeleteAccountSheet({ t, account, onClose, onDeleted }) {
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const pretASupprimer = confirmation.trim() === account.name;

  async function supprimer() {
    setSaving(true);
    const { error } = await supabase.from('bankroll_accounts').delete().eq('id', account.id);
    setSaving(false);
    if (!error) onDeleted();
  }

  return (
    <SheetOrModal title={t('bank_delete_title')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, color: 'var(--c-888)', fontSize: '13px', lineHeight: '1.6' }}>{t('bank_delete_warning')}</p>
        <div>
          <div style={labelStyle}>{t('bank_delete_type_name').replace('{nom}', account.name)}</div>
          <input style={inputStyle} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={secondaryBtn}>{t('cancel_btn')}</button>
          <button onClick={supprimer} disabled={saving || !pretASupprimer}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: pretASupprimer ? 'pointer' : 'not-allowed', backgroundColor: '#ef4444', color: 'white', fontSize: '14px', fontWeight: '700', opacity: pretASupprimer ? 1 : 0.5 }}>
            {saving ? t('saving_text') : t('bank_delete_confirm_btn')}
          </button>
        </div>
      </div>
    </SheetOrModal>
  );
}

// ===================== Menu ⋯ d'un compte =====================

function AccountActionsMenu({ t, account, allowDelete, onRename, onArchive, onUnarchive, onDelete }) {
  const [ouvert, setOuvert] = useState(false);
  const [sousEcran, setSousEcran] = useState(null); // 'rename' | 'delete' | null
  const ref = React.useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!ouvert || isMobile) return;
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [ouvert, isMobile]);

  const itemStyle = { width: '100%', textAlign: 'left', padding: '10px 12px', backgroundColor: 'transparent', border: 'none', color: 'var(--c-white)', fontSize: '13px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '40px', boxSizing: 'border-box' };

  const corps = (
    <>
      <button style={itemStyle} onClick={() => { setOuvert(false); setSousEcran('rename'); }}>{t('bank_menu_rename')}</button>
      {account.archived_at ? (
        <button style={itemStyle} onClick={() => { setOuvert(false); onUnarchive(); }}>{t('bank_menu_unarchive')}</button>
      ) : (
        <button style={itemStyle} onClick={() => { setOuvert(false); onArchive(); }}>{t('bank_menu_archive')}</button>
      )}
      {allowDelete && (
        <button style={{ ...itemStyle, color: '#ef4444' }} onClick={() => { setOuvert(false); setSousEcran('delete'); }}>{t('bank_menu_delete')}</button>
      )}
    </>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOuvert(o => !o)} aria-label={t('bank_menu_more')} style={{ width: '30px', height: '30px', minHeight: '30px', borderRadius: '50%', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-0d0d0d)', color: 'var(--c-888)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconDots />
      </button>
      {ouvert && isMobile && (
        <BottomSheet onClose={() => setOuvert(false)}>{corps}</BottomSheet>
      )}
      {ouvert && !isMobile && (
        <div style={{ position: 'absolute', top: '34px', right: 0, backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '12px', padding: '6px', minWidth: '170px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 410 }}>
          {corps}
        </div>
      )}
      {sousEcran === 'rename' && (
        <RenameAccountSheet t={t} account={account} onClose={() => setSousEcran(null)} onRenamed={(nom) => { setSousEcran(null); onRename(nom); }} />
      )}
      {sousEcran === 'delete' && (
        <DeleteAccountSheet t={t} account={account} onClose={() => setSousEcran(null)} onDeleted={() => { setSousEcran(null); onDelete(); }} />
      )}
    </div>
  );
}

// ===================== Mini-courbe (carte de compte) =====================

function MiniSparkline({ points, color, height = 36 }) {
  if (!points || points.length < 2) {
    return <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center' }}><div style={{ width: '100%', height: '1.5px', backgroundColor: 'var(--c-222)' }} /></div>;
  }
  const W = 160, H = height;
  const vals = points.map(p => p.value);
  const max = Math.max(...vals), min = Math.min(...vals);
  const range = (max - min) || 1;
  const coords = vals.map((v, i) => ({ x: (i / (vals.length - 1)) * W, y: H - ((v - min) / range) * H }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`).join(' ');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ===================== Carte de compte (vue d'ensemble) =====================

function AccountCard({ t, account, hideAmounts, onOpen, onRename, onArchive, onUnarchive, onDelete }) {
  const bets = account.bets;
  const balance = computeAccountBalance(account.transactions, bets);
  const roi = computeROI(bets);
  const { values, dates } = computeBankrollSeries(bets, '1m', 'value');
  const points = values.map((v, i) => ({ date: dates[i], value: v }));
  const variation = computeVariation(points);
  const couleur = variation >= 0 ? '#22c55e' : '#ef4444';

  return (
    <div onClick={onOpen} style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '18px', border: '1px solid var(--c-161616)', cursor: 'pointer', position: 'relative', opacity: account.archived_at ? 0.55 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomCompte(account, t)}</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-white)', letterSpacing: '-0.5px', marginTop: '4px' }}>
            {hideAmounts ? <MaskedDots t={t} count={5} size={8} /> : fmt(balance)}
          </div>
        </div>
        <AccountActionsMenu t={t} account={account} allowDelete onRename={onRename} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} />
      </div>
      <MiniSparkline points={points} color={couleur} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: couleur }}>{hideAmounts ? <MaskedDots t={t} count={3} size={5} /> : `${variation >= 0 ? '+' : ''}$${variation.toFixed(2)}`}</span>
        <span style={{ fontSize: '11px', color: 'var(--c-555)' }}>{t('perf_roi')} {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ===================== Vue d'ensemble =====================

export function BankrollOverview({ t, lang, utilisateur, accounts, archivedAccounts, onSelectAccount, onBack, onChanged }) {
  const isMobile = useIsMobile();
  const [hideAmounts, setHideAmounts] = useState(() => readHideAmounts());
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [period, setPeriod] = useState('1m');
  const [mode, setMode] = useState('value');
  const [hoverPoint, setHoverPoint] = useState(null);

  function toggleHide() { setHideAmounts(prev => { writeHideAmounts(!prev); return !prev; }); }

  const allBetsCombined = useMemo(() => accounts.flatMap(a => a.bets), [accounts]);
  const globalBalance = useMemo(() => computeGlobalBankroll(accounts), [accounts]);
  const { values, dates } = useMemo(() => computeBankrollSeries(allBetsCombined, period, mode), [allBetsCombined, period, mode]);
  const points = useMemo(() => values.map((v, i) => ({ date: dates[i], value: v })), [values, dates]);
  const pointActif = hoverPoint || (points.length ? points[points.length - 1] : { value: 0 });
  const premierPoint = points.length ? points[0] : { value: 0 };
  const variation = pointActif.value - premierPoint.value;
  const hausse = variation >= 0;
  const couleur = hausse ? '#22c55e' : '#ef4444';
  const existingKinds = useMemo(() => new Set(accounts.filter(a => a.kind !== 'other').map(a => a.kind)), [accounts]);

  const grandeValeur = mode === 'return' ? `${pointActif.value >= 0 ? '+' : ''}${pointActif.value.toFixed(1)}%` : fmt(globalBalance);

  const hero = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{t('home_bankroll')}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0 6px' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: '900', color: mode === 'return' ? couleur : 'var(--c-white)', letterSpacing: '-2px', lineHeight: 1 }}>
          {hideAmounts ? <MaskedDots t={t} count={7} size={13} /> : grandeValeur}
        </h1>
        <button onClick={toggleHide} aria-label={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')} style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}>
          {hideAmounts ? <IconEyeSm color="var(--c-666)" /> : <IconEyeOffSm color="var(--c-666)" />}
        </button>
      </div>
      <div style={{ marginBottom: '18px', fontSize: '14px', fontWeight: '800', color: hideAmounts ? 'var(--c-666)' : couleur }}>
        {hideAmounts ? <MaskedDots t={t} count={4} size={6} /> : `${hausse ? '+' : ''}$${variation.toFixed(2)}`}
      </div>
      <WealthsimpleChart
        lang={lang} points={points}
        periods={BANKROLL_PERIODS.map(p => ({ key: p, label: t(`home_chart_period_${p}`) }))}
        period={period} onSelectPeriod={setPeriod}
        modeOptions={[{ key: 'value', label: t('home_chart_mode_value') }, { key: 'return', label: t('home_chart_mode_return') }]}
        mode={mode} onSelectMode={setMode}
        emptyLabel={t('bank_empty_chart')} hauteur={150} color={couleur}
        onHoverChange={setHoverPoint}
      />
    </>
  );

  return (
    <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: isMobile ? '600px' : '1000px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={secondaryBtn}>{t('back_btn')}</button>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('home_bankroll')}</h2>
      </div>

      <div style={{ backgroundColor: 'var(--c-0a0a0a)', borderRadius: '18px', padding: '20px', border: '1px solid var(--c-1a1a1a)', marginBottom: '24px' }}>
        {hero}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>{t('bank_accounts_section_title')}</h3>
        <button onClick={() => setShowAddAccount(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '20px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-111)', color: 'var(--c-white)', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' }}>
          <IconPlusSmall size={13} /> {t('bank_add_account_cta')}
        </button>
      </div>

      {accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px dashed var(--c-222)' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>💰</div>
          <p style={{ margin: '0 0 4px', color: 'var(--c-white)', fontWeight: '700', fontSize: '14px' }}>{t('bank_empty_accounts_title')}</p>
          <p style={{ margin: '0 0 16px', color: 'var(--c-555)', fontSize: '13px' }}>{t('bank_empty_accounts_body')}</p>
          <button onClick={() => setShowAddAccount(true)} style={{ ...primaryBtn, padding: '10px 20px' }}>{t('bank_add_account_cta')}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
          {accounts.map(a => (
            <AccountCard
              key={a.id} t={t} account={a} hideAmounts={hideAmounts}
              onOpen={() => onSelectAccount(a.id)}
              onRename={() => onChanged()}
              onArchive={async () => { await supabase.from('bankroll_accounts').update({ archived_at: new Date().toISOString() }).eq('id', a.id); onChanged(); }}
              onUnarchive={async () => { await supabase.from('bankroll_accounts').update({ archived_at: null }).eq('id', a.id); onChanged(); }}
              onDelete={() => onChanged()}
            />
          ))}
        </div>
      )}

      {archivedAccounts.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={() => setShowArchived(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--c-555)', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', padding: '8px 0' }}>
            {t('bank_archived_accounts').replace('{n}', archivedAccounts.length)} {showArchived ? '▾' : '▸'}
          </button>
          {showArchived && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px', marginTop: '10px' }}>
              {archivedAccounts.map(a => (
                <AccountCard
                  key={a.id} t={t} account={a} hideAmounts={hideAmounts}
                  onOpen={() => onSelectAccount(a.id)}
                  onRename={() => onChanged()}
                  onArchive={() => {}}
                  onUnarchive={async () => { await supabase.from('bankroll_accounts').update({ archived_at: null }).eq('id', a.id); onChanged(); }}
                  onDelete={() => onChanged()}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showAddAccount && (
        <AddAccountSheet t={t} utilisateur={utilisateur} existingKinds={existingKinds} onClose={() => setShowAddAccount(false)} onCreated={() => { setShowAddAccount(false); onChanged(); }} />
      )}
    </div>
  );
}

// ===================== Depot / Retrait =====================

function MoneySheet({ t, type, account, onClose, onSaved }) {
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const balance = computeAccountBalance(account.transactions, account.bets);
  const available = computeAvailable(balance, computeAtRisk(account.bets));

  async function confirmer() {
    const m = parseFloat(montant);
    if (!m || m <= 0) { setErreur(t('bank_error_amount')); return; }
    if (type === 'withdrawal' && m > available) { setErreur(t('bank_error_withdrawal_exceeds')); return; }
    setSaving(true);
    setErreur('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('bankroll_transactions').insert({
      user_id: user.id, account_id: account.id, type, amount: m, occurred_on: date, note: note || null,
    });
    setSaving(false);
    if (error) { setErreur(error.message); return; }
    onSaved(type === 'deposit' ? t('bank_toast_deposit_done') : t('bank_toast_withdrawal_done'));
  }

  return (
    <SheetOrModal title={type === 'deposit' ? t('bank_add_money_title') : t('bank_withdraw_title')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {type === 'withdrawal' && (
          <div style={{ fontSize: '12.5px', color: 'var(--c-666)' }}>{t('bank_available_label')}: <strong style={{ color: 'var(--c-white)' }}>{fmt(available)}</strong></div>
        )}
        <div>
          <div style={labelStyle}>{t('bank_amount')}</div>
          <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0.00" value={montant} onChange={e => setMontant(e.target.value)} autoFocus />
        </div>
        <div>
          <div style={labelStyle}>Date</div>
          <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <div style={labelStyle}>{t('bank_note')}</div>
          <input style={inputStyle} placeholder={t('bank_note_placeholder')} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        {erreur && <div style={{ color: '#ef4444', fontSize: '12px' }}>{erreur}</div>}
        <button onClick={confirmer} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>{saving ? t('saving_text') : t('confirm_btn')}</button>
      </div>
    </SheetOrModal>
  );
}

// ===================== Historique des transactions =====================

function TransactionHistorySheet({ t, lang, account, onClose, onChanged }) {
  async function supprimer(tx) {
    await supabase.from('bankroll_transactions').delete().eq('id', tx.id);
    onChanged();
  }
  const triees = [...account.transactions].sort((a, b) => new Date(b.occurred_on) - new Date(a.occurred_on));
  return (
    <SheetOrModal title={t('bank_tx_history_title')} onClose={onClose} maxWidth={480}>
      {triees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('bank_no_tx')}</div>
      ) : triees.map((tx, i) => (
        <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--c-white)' }}>{tx.type === 'deposit' ? t('deposit_btn') : t('withdrawal_btn')}</div>
            {tx.note && <div style={{ color: 'var(--c-555)', fontSize: '11.5px' }}>{tx.note}</div>}
            <div style={{ color: 'var(--c-333)', fontSize: '11px' }}>{new Date(`${tx.occurred_on}T00:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: tx.type === 'deposit' ? '#22c55e' : '#ef4444' }}>{tx.type === 'deposit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}</span>
            <button onClick={() => supprimer(tx)} style={{ backgroundColor: 'transparent', border: '1px solid var(--c-222)', color: 'var(--c-444)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
          </div>
        </div>
      ))}
    </SheetOrModal>
  );
}

// ===================== Tableau des paris recents =====================

function AccountBetsTable({ t, lang, bets, hideAmounts }) {
  const [voirTout, setVoirTout] = useState(false);
  const triees = [...bets].sort((a, b) => new Date(b.dateSettlement || b.datePlaced || 0) - new Date(a.dateSettlement || a.datePlaced || 0));
  const affiches = voirTout ? triees : triees.slice(0, 5);

  return (
    <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '20px', border: '1px solid var(--c-161616)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{t('bank_recent_bets_title')}</h3>
        {triees.length > 5 && (
          <button onClick={() => setVoirTout(v => !v)} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}>
            {voirTout ? t('bank_show_less') : t('bank_see_all')}
          </button>
        )}
      </div>
      {affiches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('bank_no_bets_account')}</div>
      ) : affiches.map((b, i) => (
        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '11px 0', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.match || b.selection || '—'}</div>
            <div style={{ color: 'var(--c-555)', fontSize: '11.5px' }}>{formatDateCourte(b.dateSettlement || b.datePlaced, lang)} · {t('bets_odds')} {b.odds} · ${b.stake.toFixed(2)}</div>
          </div>
          {b.status === 'pending' ? (
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', flexShrink: 0 }}>{t('bets_auto_status_pending')}</span>
          ) : (
            <span style={{ fontWeight: '800', fontSize: '14px', color: b.profit >= 0 ? '#22c55e' : '#ef4444', flexShrink: 0 }}>
              {hideAmounts ? <MaskedDots t={t} count={3} size={5} /> : `${b.profit >= 0 ? '+' : ''}$${b.profit.toFixed(2)}`}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ===================== Ajouter un pari (depuis la page de compte) =====================

function AddBetFromAccount({ t, lang, account, onClose, onImported }) {
  const [image, setImage] = useState(null);
  const inputRef = React.useRef(null);

  useEffect(() => { inputRef.current?.click(); }, []);

  async function onFichierChoisi(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) { onClose(); return; }
    try {
      const dataUrl = await fichierVersJpegBase64(file);
      setImage({ apercu: dataUrl, base64: dataUrl.split(',')[1] });
    } catch { onClose(); }
  }

  async function enregistrer(champs) {
    const { data: { user } } = await supabase.auth.getUser();
    // account_id APRES le spread de `champs` : ce compte est deja fixe par le contexte (page de
    // compte), il doit gagner meme si champsDBDepuisForm a renvoye account_id: null (aucun
    // selecteur de compte n'est affiche ici, voir BetImportFlow sans prop `accounts`).
    const { data: inseree, error } = await supabase.from('bets_auto')
      .insert({ user_id: user.id, statut: 'pending', ...champs, account_id: account.id })
      .select().single();
    if (error) return null;
    return inseree;
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" onChange={onFichierChoisi} style={{ display: 'none' }} />
      {image && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 2300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <BetImportFlow lang={lang} apercu={image.apercu} imageBase64={image.base64} onClose={onClose} onEnregistrer={enregistrer} onImported={onImported} />
          </div>
        </div>
      )}
    </>
  );
}

// ===================== Page d'un compte =====================

export function AccountDetail({ t, lang, utilisateur, account, accounts, onBack, onSwitchAccount, onChanged }) {
  // Seuil propre a cette page (1024px, pas le seuil mobile standard de l'app a 768px) : la
  // grille 2 colonnes (carte bankroll+calendrier+paris a gauche, actions+stats a droite) n'a
  // assez de place qu'a partir d'un iPad en mode paysage/un petit laptop -- en portrait iPad
  // (768-1023px) cette page reste a une seule colonne, voir useMinWidth (src/useIsMobile.js).
  const isDesktopGrid = useMinWidth(1024);
  const [hideAmounts, setHideAmounts] = useState(() => readHideAmounts());
  const [period, setPeriod] = useState('1m');
  const [mode, setMode] = useState('value');
  const [hoverPoint, setHoverPoint] = useState(null);
  const [sheet, setSheet] = useState(null); // 'deposit' | 'withdraw' | 'history' | 'rename' | 'addbet' | null
  const [toast, setToast] = useState('');

  function toggleHide() { setHideAmounts(prev => { writeHideAmounts(!prev); return !prev; }); }

  const bets = account.bets;
  const balance = computeAccountBalance(account.transactions, bets);
  const atRisk = computeAtRisk(bets);
  const available = computeAvailable(balance, atRisk);
  const netDeposits = computeNetDeposits(account.transactions);
  const roi = computeROI(bets);
  const winRate = computeWinRate(bets);
  const totalStaked = computeTotalStaked(bets);
  const avgOdds = computeAverageOdds(bets);
  const bestDay = computeBestDay(bets);
  const derniereMaj = account.transactions.length
    ? [...account.transactions].sort((a, b) => new Date(b.occurred_on) - new Date(a.occurred_on))[0].occurred_on
    : null;

  const { values, dates } = useMemo(() => computeBankrollSeries(bets, period, mode), [bets, period, mode]);
  const points = useMemo(() => values.map((v, i) => ({ date: dates[i], value: v })), [values, dates]);
  const pointActif = hoverPoint || (points.length ? points[points.length - 1] : { value: 0 });
  const premierPoint = points.length ? points[0] : { value: 0 };
  const variation = pointActif.value - premierPoint.value;
  const hausse = variation >= 0;
  const couleur = hausse ? '#22c55e' : '#ef4444';
  const grandeValeur = mode === 'return' ? `${pointActif.value >= 0 ? '+' : ''}${pointActif.value.toFixed(1)}%` : fmt(balance);

  function afterSaved(message) {
    setSheet(null);
    setToast(message);
    onChanged();
    setTimeout(() => setToast(''), 2500);
  }

  const statCard = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', padding: '16px', border: '1px solid var(--c-161616)' };

  const header = (
    <div data-testid="bank-block-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <button onClick={onBack} style={secondaryBtn}>{t('back_btn')}</button>
      <DropdownPill
        ariaLabel={t('bank_switch_account')}
        options={accounts.map(a => ({ value: a.id, label: nomCompte(a, t) }))}
        value={account.id}
        onChange={onSwitchAccount}
      />
      <div style={{ marginLeft: 'auto' }}>
        <AccountActionsMenu
          t={t} account={account} allowDelete={false}
          onRename={() => onChanged()}
          onArchive={async () => { await supabase.from('bankroll_accounts').update({ archived_at: new Date().toISOString() }).eq('id', account.id); onChanged(); onBack(); }}
          onUnarchive={async () => { await supabase.from('bankroll_accounts').update({ archived_at: null }).eq('id', account.id); onChanged(); }}
          onDelete={() => {}}
        />
      </div>
    </div>
  );

  const heroBlock = (
    <div data-testid="bank-block-hero" style={{ backgroundColor: 'var(--c-0a0a0a)', borderRadius: '18px', padding: '20px', border: '1px solid var(--c-1a1a1a)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(32px, 5vw, 46px)', fontWeight: '900', color: mode === 'return' ? couleur : 'var(--c-white)', letterSpacing: '-2px', lineHeight: 1 }}>
          {hideAmounts ? <MaskedDots t={t} count={7} size={13} /> : grandeValeur}
        </h1>
        <button onClick={toggleHide} aria-label={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')} style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}>
          {hideAmounts ? <IconEyeSm color="var(--c-666)" /> : <IconEyeOffSm color="var(--c-666)" />}
        </button>
      </div>
      <div style={{ marginBottom: '16px', fontSize: '13px', fontWeight: '800', color: hideAmounts ? 'var(--c-666)' : couleur }}>
        {hideAmounts ? <MaskedDots t={t} count={4} size={6} /> : `${hausse ? '+' : ''}$${variation.toFixed(2)}`}
      </div>
      <WealthsimpleChart
        lang={lang} points={points}
        periods={BANKROLL_PERIODS.map(p => ({ key: p, label: t(`home_chart_period_${p}`) }))}
        period={period} onSelectPeriod={setPeriod}
        modeOptions={[{ key: 'value', label: t('home_chart_mode_value') }, { key: 'return', label: t('home_chart_mode_return') }]}
        mode={mode} onSelectMode={setMode}
        emptyLabel={t('bank_empty_chart')} hauteur={140} color={couleur}
        onHoverChange={setHoverPoint}
      />
    </div>
  );

  const calendarBlock = (
    <div data-testid="bank-block-calendar" style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '18px', border: '1px solid var(--c-161616)' }}>
      <BankrollCalendar t={t} lang={lang} bets={bets} hideAmounts={hideAmounts} />
    </div>
  );

  const addBetBtn = (
    <button onClick={() => setSheet('addbet')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '20px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' }}>
      <IconPlusSmall size={13} /> {t('bank_add_bet_cta')}
    </button>
  );

  // Chaque bloc n'est defini qu'UNE fois ; seul l'assemblage (grille desktop vs liste mobile
  // ordonnee, voir le return plus bas) differe selon isDesktopGrid -- pas de JSX duplique.
  const recentBetsBlock = (
    <div data-testid="bank-block-recent-bets">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-6px' }}>{addBetBtn}</div>
      <AccountBetsTable t={t} lang={lang} bets={bets} hideAmounts={hideAmounts} />
    </div>
  );

  const moneyButtons = (
    <div data-testid="bank-block-money-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <button onClick={() => setSheet('deposit')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '18px 10px', borderRadius: '14px', border: '1px solid var(--c-1a1a1a)', backgroundColor: 'var(--c-0d0d0d)', color: 'var(--c-white)', cursor: 'pointer' }}>
        <IconArrowDownCircle color="#22c55e" />
        <span style={{ fontSize: '12.5px', fontWeight: '700' }}>{t('bank_add_money_title')}</span>
      </button>
      <button onClick={() => setSheet('withdraw')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '18px 10px', borderRadius: '14px', border: '1px solid var(--c-1a1a1a)', backgroundColor: 'var(--c-0d0d0d)', color: 'var(--c-white)', cursor: 'pointer' }}>
        <IconArrowUpCircle color="#ef4444" />
        <span style={{ fontSize: '12.5px', fontWeight: '700' }}>{t('bank_withdraw_title')}</span>
      </button>
    </div>
  );

  const availableAtRiskBlock = (
    <div data-testid="bank-block-available-at-risk" style={statCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('bank_available_label')}</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--c-white)', marginTop: '4px' }}>{hideAmounts ? <MaskedDots t={t} /> : fmt(available)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('bank_at_risk_label')}</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--c-white)', marginTop: '4px' }}>{hideAmounts ? <MaskedDots t={t} /> : fmt(atRisk)}</div>
        </div>
      </div>
    </div>
  );

  const netDepositsBlock = (
    <div data-testid="bank-block-net-deposits" style={statCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('bank_net_deposits_label')}</div>
        {derniereMaj && <div style={{ color: 'var(--c-444)', fontSize: '10.5px' }}>{new Date(`${derniereMaj}T00:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' })}</div>}
      </div>
      <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--c-white)', marginTop: '4px' }}>{hideAmounts ? <MaskedDots t={t} /> : fmt(netDeposits)}</div>
      <button onClick={() => setSheet('history')} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginTop: '8px' }}>{t('bank_see_history')}</button>
    </div>
  );

  const statsBlock = (
    <div data-testid="bank-block-stats" style={statCard}>
      <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>{t('bank_stats_title')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          ['ROI', hideAmounts ? null : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`, roi >= 0 ? '#22c55e' : '#ef4444'],
          [t('bank_win_rate'), `${winRate}%`, 'var(--c-white)'],
          [t('bets_total_staked'), hideAmounts ? null : fmt(totalStaked), 'var(--c-white)'],
          [t('bank_avg_odds'), avgOdds ? avgOdds.toFixed(2) : '—', 'var(--c-white)'],
          [t('bank_best_day'), hideAmounts ? null : (bestDay ? fmtSigned(bestDay.profit) : '—'), bestDay && bestDay.profit >= 0 ? '#22c55e' : bestDay ? '#ef4444' : 'var(--c-white)'],
        ].map(([label, val, color], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--c-666)' }}>{label}</span>
            <span style={{ fontWeight: '700', color }}>{val === null ? <MaskedDots t={t} count={3} size={4} /> : val}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      // .bankroll-account-mobile (index.css) degage la barre de navigation flottante du bas --
      // en inline style, jsdom/cssstyle ne sait pas parser calc()+env() (voir Bankroll.test.js),
      // d'ou le passage par une classe CSS plutot qu'un paddingBottom inline.
      className={isDesktopGrid ? undefined : 'bankroll-account-mobile'}
      style={{
        padding: isDesktopGrid ? '0' : '16px', maxWidth: isDesktopGrid ? 'none' : '600px', margin: isDesktopGrid ? '0' : '0 auto',
        fontFamily: '-apple-system, sans-serif', boxSizing: 'border-box',
      }}>
      {/* Back / selecteur de compte / ... : seule sur toute la largeur, TOUJOURS hors de la
          grille 2 colonnes -- sinon la colonne de droite s'alignerait sur cette ligne au lieu de
          s'aligner sur le haut de la carte bankroll (voir bankroll-grid, align-items: start). */}
      {header}

      {isDesktopGrid ? (
        <div className="bankroll-grid">
          <div className="bankroll-main-col">{heroBlock}{calendarBlock}{recentBetsBlock}</div>
          <div className="bankroll-side-col">{moneyButtons}{availableAtRiskBlock}{netDepositsBlock}{statsBlock}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {heroBlock}
          {moneyButtons}
          {calendarBlock}
          {recentBetsBlock}
          {availableAtRiskBlock}
          {netDepositsBlock}
          {statsBlock}
        </div>
      )}

      {sheet === 'deposit' && <MoneySheet t={t} type="deposit" account={account} onClose={() => setSheet(null)} onSaved={afterSaved} />}
      {sheet === 'withdraw' && <MoneySheet t={t} type="withdrawal" account={account} onClose={() => setSheet(null)} onSaved={afterSaved} />}
      {sheet === 'history' && <TransactionHistorySheet t={t} lang={lang} account={account} onClose={() => setSheet(null)} onChanged={onChanged} />}
      {sheet === 'addbet' && <AddBetFromAccount t={t} lang={lang} account={account} onClose={() => setSheet(null)} onImported={() => afterSaved(t('bank_toast_bet_added'))} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--c-1a1a1a)', border: '1px solid var(--c-333)', borderRadius: '12px', padding: '12px 20px', color: 'var(--c-white)', fontSize: '13px', fontWeight: '600', zIndex: 2400, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ===================== Page principale (chargement des donnees, choix de l'ecran) =====================

export function BankrollPage({ utilisateur, onBack, lang = 'en' }) {
  const t = getT(lang);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [paris, setParis] = useState([]);
  const [betsAuto, setBetsAuto] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  async function charger() {
    const [accRes, txRes, parisRes, betsAutoRes] = await Promise.all([
      supabase.from('bankroll_accounts').select('*').eq('user_id', utilisateur.id).order('created_at', { ascending: true }),
      supabase.from('bankroll_transactions').select('*').eq('user_id', utilisateur.id),
      supabase.from('paris').select('*').eq('user_id', utilisateur.id),
      supabase.from('bets_auto').select('*').eq('user_id', utilisateur.id),
    ]);
    setAccounts(accRes.data || []);
    setTransactions(txRes.data || []);
    setParis(parisRes.data || []);
    setBetsAuto(betsAutoRes.data || []);
    setChargement(false);
  }

  useEffect(() => { if (utilisateur?.id) charger(); }, [utilisateur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allBets = useMemo(() => normalizeAllBets(paris, betsAuto), [paris, betsAuto]);

  const accountsWithData = useMemo(() => accounts.map(a => ({
    ...a,
    transactions: transactions.filter(tx => tx.account_id === a.id),
    bets: betsForAccount(allBets, a.id),
  })), [accounts, transactions, allBets]);

  const activeAccounts = accountsWithData.filter(a => !a.archived_at);
  const archivedAccounts = accountsWithData.filter(a => a.archived_at);

  if (chargement) {
    return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--c-555)' }}>Loading...</div>;
  }

  if (selectedAccountId) {
    const compte = accountsWithData.find(a => a.id === selectedAccountId);
    if (!compte) {
      setSelectedAccountId(null);
      return null;
    }
    return (
      <AccountDetail
        t={t} lang={lang} utilisateur={utilisateur}
        account={compte} accounts={activeAccounts}
        onBack={() => setSelectedAccountId(null)}
        onSwitchAccount={setSelectedAccountId}
        onChanged={charger}
      />
    );
  }

  return (
    <BankrollOverview
      t={t} lang={lang} utilisateur={utilisateur}
      accounts={activeAccounts} archivedAccounts={archivedAccounts}
      onSelectAccount={setSelectedAccountId}
      onBack={onBack}
      onChanged={charger}
    />
  );
}

export default BankrollPage;
