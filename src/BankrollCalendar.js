import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from './useIsMobile';
import { BottomSheet } from './BottomSheet';
import { MaskedDots } from './Home';
import { buildMonthCalendar, betsForDay, formatCompactAmount } from './bankrollCalc';

// Calendrier mensuel de profit (src/Bankroll.js : page de compte ET vue d'ensemble avec bascule
// "Tous les comptes") -- grille Dim-Sam, une tuile par jour du mois colore selon le profit/la
// perte realise ce jour-la (intensite proportionnelle a l'ampleur dans le mois affiche), bordure
// pointillee pour un jour qui n'a que des paris en attente, neutre pour un jour sans aucun pari.
// Clic/Entree sur un jour ouvre un panneau (feuille du bas mobile, modale centree desktop) avec
// le detail des paris de ce jour (src/bankrollCalc.js:betsForDay).

function IconChevronLeft({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function IconChevronRightCal({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const JOURS_SEMAINE_FR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const JOURS_SEMAINE_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function tileColors(entry, maxAbs) {
  if (!entry) return null;
  if (!entry.hasSettled && !entry.hasPending) {
    return { bg: 'var(--c-0d0d0d)', border: 'var(--c-1a1a1a)', borderStyle: 'solid', fg: 'var(--c-555)' };
  }
  if (!entry.hasSettled && entry.hasPending) {
    return { bg: 'var(--c-0d0d0d)', border: 'var(--c-444)', borderStyle: 'dashed', fg: 'var(--c-888)' };
  }
  const positif = entry.profit >= 0;
  const alpha = maxAbs > 0 ? Math.min(0.85, 0.18 + 0.6 * (Math.abs(entry.profit) / maxAbs)) : 0.18;
  const couleur = positif ? '34,197,94' : '239,68,68';
  return {
    bg: `rgba(${couleur},${alpha})`,
    border: `rgba(${couleur},${Math.min(1, alpha + 0.25)})`,
    borderStyle: 'solid',
    fg: positif ? '#bbf7d0' : '#fecaca',
  };
}

function DayDetailBody({ t, lang, bets, dateStr }) {
  const d = new Date(`${dateStr}T00:00:00`);
  const titre = d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <>
      <div style={{ padding: '2px 44px 12px 6px', fontSize: '14px', fontWeight: '800', color: 'var(--c-white)', textTransform: 'capitalize' }}>{titre}</div>
      {bets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('bank_cal_day_empty')}</div>
      ) : bets.map((b, i) => (
        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 4px', borderTop: i > 0 ? '1px solid var(--c-111)' : 'none' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.match || b.selection || '—'}</div>
            <div style={{ color: 'var(--c-555)', fontSize: '11.5px', marginTop: '2px' }}>{t('bets_odds')} {b.odds || '—'} · ${b.stake.toFixed(2)}</div>
          </div>
          {b.status === 'pending' ? (
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', flexShrink: 0 }}>{t('bets_auto_status_pending')}</span>
          ) : (
            <span style={{ fontWeight: '800', fontSize: '15px', color: b.profit >= 0 ? '#22c55e' : '#ef4444', flexShrink: 0 }}>{b.profit >= 0 ? '+' : ''}${b.profit.toFixed(2)}</span>
          )}
        </div>
      ))}
    </>
  );
}

function DayDetailPanel({ t, lang, bets, dateStr, onClose }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <BottomSheet onClose={onClose}>
        <DayDetailBody t={t} lang={lang} bets={bets} dateStr={dateStr} />
      </BottomSheet>
    );
  }
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '18px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', position: 'relative' }}>
        <button onClick={onClose} aria-label={t('back_btn')} style={{ position: 'absolute', top: '14px', right: '14px', width: '30px', height: '30px', minHeight: '30px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'none', color: 'var(--c-888)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        <DayDetailBody t={t} lang={lang} bets={bets} dateStr={dateStr} />
      </div>
    </div>,
    document.body
  );
}

export function BankrollCalendar({ t, lang, bets, hideAmounts }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const gridRef = useRef(null);

  const { weeks, monthProfit } = useMemo(() => buildMonthCalendar(bets, year, monthIndex), [bets, year, monthIndex]);
  const flatDays = useMemo(() => weeks.flat().filter(Boolean), [weeks]);
  const maxAbs = useMemo(() => Math.max(1, ...flatDays.filter(d => d.hasSettled).map(d => Math.abs(d.profit))), [flatDays]);

  const joursSemaine = lang === 'fr' ? JOURS_SEMAINE_FR : JOURS_SEMAINE_EN;
  const titreMois = new Date(year, monthIndex, 1).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' });

  function changerMois(delta) {
    let m = monthIndex + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIndex(m);
    setYear(y);
    setActiveIdx(0);
    setSelectedDay(null);
  }

  function ouvrirJour(entry) {
    setSelectedDay(entry.date);
  }

  function onGridKeyDown(e, idx) {
    const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in deltas) {
      e.preventDefault();
      const next = Math.min(flatDays.length - 1, Math.max(0, idx + deltas[e.key]));
      setActiveIdx(next);
      gridRef.current?.querySelector(`[data-cal-idx="${next}"]`)?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ouvrirJour(flatDays[idx]);
    }
  }

  function ariaLabelJour(entry) {
    const d = new Date(year, monthIndex, entry.dayNum);
    const dateTxt = d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short' });
    if (entry.hasSettled) {
      const signe = entry.profit >= 0 ? '+' : '';
      return `${dateTxt}, ${entry.profit >= 0 ? t('bank_cal_profit_label') : t('bank_cal_loss_label')} ${signe}$${Math.abs(entry.profit).toFixed(0)}`;
    }
    if (entry.hasPending) return `${dateTxt}, ${t('bets_auto_status_pending')}`;
    return `${dateTxt}, ${t('bank_cal_no_bet')}`;
  }

  let flatCounter = -1;

  return (
    <div className="bank-cal">
      <style>{`
        .bank-cal-day { min-height: 40px; box-sizing: border-box; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; padding: 2px; gap: 2px; }
        .bank-cal-day:focus-visible { outline: 2px solid #f97316; outline-offset: 1px; }
        .bank-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        @media (max-width: 480px) { .bank-cal-day { font-size: 10px; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => changerMois(-1)} aria-label={t('bank_cal_prev_month')} style={{ width: '32px', height: '32px', minHeight: '32px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'var(--c-0d0d0d)', color: 'var(--c-888)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconChevronLeft />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-white)', textTransform: 'capitalize' }}>{titreMois}</div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: monthProfit >= 0 ? '#22c55e' : '#ef4444', marginTop: '2px' }}>
            {t('bank_cal_month_profit')}: {hideAmounts ? <MaskedDots t={t} count={3} size={5} /> : `${monthProfit >= 0 ? '+' : ''}$${monthProfit.toFixed(2)}`}
          </div>
        </div>
        <button onClick={() => changerMois(1)} aria-label={t('bank_cal_next_month')} style={{ width: '32px', height: '32px', minHeight: '32px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'var(--c-0d0d0d)', color: 'var(--c-888)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconChevronRightCal />
        </button>
      </div>

      <div className="bank-cal-grid" style={{ marginBottom: '4px' }}>
        {joursSemaine.map((j, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--c-555)', textTransform: 'uppercase' }}>{j}</div>
        ))}
      </div>

      <div className="bank-cal-grid" role="grid" aria-label={t('bank_cal_title')} ref={gridRef}>
        {weeks.flat().map((entry, cellIdx) => {
          if (!entry) return <div key={cellIdx} />;
          flatCounter += 1;
          const idx = flatCounter;
          const colors = tileColors(entry, maxAbs);
          return (
            <button
              key={cellIdx}
              type="button"
              role="gridcell"
              data-cal-idx={idx}
              tabIndex={idx === activeIdx ? 0 : -1}
              className="bank-cal-day"
              aria-label={ariaLabelJour(entry)}
              onClick={() => { setActiveIdx(idx); ouvrirJour(entry); }}
              onFocus={() => setActiveIdx(idx)}
              onKeyDown={e => onGridKeyDown(e, idx)}
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderStyle: colors.borderStyle }}
            >
              <span style={{ color: colors.fg, fontWeight: '700' }}>{entry.dayNum}</span>
              {entry.hasSettled && (
                <span style={{ color: colors.fg, fontSize: '9.5px', fontWeight: '600' }}>
                  {hideAmounts ? <MaskedDots t={t} count={3} size={3} /> : `${entry.profit >= 0 ? '+' : ''}${formatCompactAmount(entry.profit)}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <DayDetailPanel
          t={t} lang={lang}
          bets={betsForDay(bets, selectedDay)}
          dateStr={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

export default BankrollCalendar;
