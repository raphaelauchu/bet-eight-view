import React, { useMemo, useState } from 'react';
import {
  impliedProbability, bookMargin, bestBookForSide, computeEV,
} from './landingFeaturesCalc';
import { LANDING_EV_PREVIEW_ENABLED } from './landingConfig';

// ===================== Carte interactive "Comparateur de cotes" (bloc 3, src/LandingFeaturesV2.js) ====
// Pari FICTIF (joueur fictif, marche "Plus de 2,5 tirs"), 5 livres generiques sans logo
// (Book A..E) -- jamais le mot "arbitrage", aucune promesse de gains. Cotes choisies pour
// produire un EV positif cote "Plus" et negatif cote "Moins" sur ces donnees de demonstration
// (verifie dans landingFeaturesCalc.test.js : computeEV(BOOKS, 'over') ~= +2.8%).
const BOOKS = [
  { name: 'Book A', over: 1.8, under: 2.05 },
  { name: 'Book B', over: 1.75, under: 2.1 },
  { name: 'Book C', over: 1.95, under: 1.95 },
  { name: 'Book D', over: 1.85, under: 2.0 },
  { name: 'Book E', over: 1.78, under: 2.08 },
];

export default function LandingOddsCard({ t }) {
  const [side, setSide] = useState('over');

  const sorted = useMemo(() => [...BOOKS].sort((a, b) => b[side] - a[side]), [side]);
  const best = useMemo(() => bestBookForSide(BOOKS, side), [side]);
  const impliedProb = useMemo(() => (best ? impliedProbability(best[side]) : 0), [best, side]);
  const margin = useMemo(() => (best ? bookMargin(best.over, best.under) : 0), [best]);
  const ev = useMemo(() => computeEV(BOOKS, side), [side]);
  const evPositive = LANDING_EV_PREVIEW_ENABLED && ev !== null && ev > 0;

  return (
    <div className="landing2-card landing2-odds-card">
      <div className="landing2-card-title">{t('landing2_feat3_prop')}</div>

      <div className="landing2-odds-toggle" role="group">
        <button type="button" className={`landing2-pill ${side === 'over' ? 'landing2-pill-active' : ''}`} aria-pressed={side === 'over'} onClick={() => setSide('over')}>
          {t('landing2_feat3_toggle_over')}
        </button>
        <button type="button" className={`landing2-pill ${side === 'under' ? 'landing2-pill-active' : ''}`} aria-pressed={side === 'under'} onClick={() => setSide('under')}>
          {t('landing2_feat3_toggle_under')}
        </button>
      </div>

      <table className="landing2-odds-table">
        <thead>
          <tr>
            <th scope="col">{t('landing2_feat3_book_col')}</th>
            <th scope="col">{t('bets_odds')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(book => {
            const isBest = best && book.name === best.name;
            return (
              <tr key={book.name}>
                <td>{book.name}</td>
                <td className={isBest ? 'landing2-odds-best-cell' : ''}>
                  {book[side].toFixed(2)}
                  {isBest && evPositive && (
                    <span className="landing2-ev-badge">+EV {(ev * 100).toFixed(1)}%</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="landing2-odds-metrics">
        <div className="landing2-prop-stat">
          <span className="landing2-prop-stat-label">{t('landing2_feat3_implied_prob_label')}</span>
          <span className="landing2-prop-stat-value">{(impliedProb * 100).toFixed(1)}%</span>
        </div>
        <div className="landing2-prop-stat">
          <span className="landing2-prop-stat-label">{t('landing2_feat3_margin_label')}</span>
          <span className="landing2-prop-stat-value">{(margin * 100).toFixed(1)}%</span>
        </div>
        {LANDING_EV_PREVIEW_ENABLED && ev !== null && (
          <div className="landing2-prop-stat">
            <span className="landing2-prop-stat-label">
              {t('landing2_feat3_ev_label')} <span className="ws-soon-tag">{t('tools_soon_tag')}</span>
            </span>
            <span className="landing2-prop-stat-value">{ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      {LANDING_EV_PREVIEW_ENABLED && ev !== null && (
        <p className="landing2-odds-ev-explanation">{t('landing2_feat3_ev_explanation')}</p>
      )}

      <p className="landing2-odds-real-odds-note">{t('landing2_feat3_real_odds_note')}</p>
      <p className="landing2-card-caption">{t('landing2_demo_data_caption')}</p>
    </div>
  );
}
