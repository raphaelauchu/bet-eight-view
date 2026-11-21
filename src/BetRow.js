import React from 'react';
import { MaskedDots } from './MaskedDots';

// Ligne de pari partagee par les TROIS endroits qui en affichent une liste : "Recent Bets"
// (accueil, src/Home.js), "Paris récents" (page de compte, src/Bankroll.js) et le detail d'une
// journee du calendrier de profit (src/BankrollCalendar.js). Un seul composant -- avant cette
// extraction, chaque endroit avait sa propre version legerement differente (libelle du statut
// "Active" vs "Pending", sous-ligne sportsbook+cote vs date+cote+mise, et un bug d'affichage du
// montant negatif en "$-50.00" au lieu de "-$50.00").
//
// `status` suit le vocabulaire normalise de src/bankrollCalc.js (normalizeBet) : 'pending' |
// 'won' | 'lost'. `profit` est ignore quand status==='pending'.
export function BetRow({ t, title, bookmaker, odds, stake, status, profit, hideAmounts, bordered }) {
  const enCours = status === 'pending';
  const gagnant = profit >= 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: bordered ? '1px solid var(--c-111)' : 'none' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '13px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || '—'}</p>
        <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '11px' }}>{bookmaker || '—'} · {t('bets_odds')} {odds ?? '—'} · ${Number(stake || 0).toFixed(2)}</p>
      </div>
      {enCours ? (
        <span style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: '600', border: '1px solid rgba(249,115,22,0.3)', flexShrink: 0 }}>{t('home_active_badge')}</span>
      ) : hideAmounts ? (
        <MaskedDots t={t} count={3} size={5} />
      ) : (
        <span style={{ color: gagnant ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
          {gagnant ? '+' : '-'}${Math.abs(profit || 0).toFixed(2)}
        </span>
      )}
    </div>
  );
}

export default BetRow;
