import React from 'react';
import { getT } from './i18n';

const BET_TYPES_LABELS = {
  moneyline: 'Money Line',
  spread: 'Puck Line',
  total: 'Total Goals',
  prop: 'Player Prop',
  parlay: 'Parlay',
};

function ligne(label, valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #161616' }}>
      <span style={{ color: '#666', fontSize: '13px' }}>{label}</span>
      <span style={{ color: 'white', fontSize: '13px', fontWeight: '600', textAlign: 'right' }}>{valeur}</span>
    </div>
  );
}

function formatDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }); } catch { return d; }
}

function BetDetailSheet({ item, onClose, lang = 'en' }) {
  const t = getT(lang);
  if (!item) return null;
  const { type, data } = item;

  const estGagne = data.statut === 'gagne' || data.statut === 'won';
  const estPerdu = data.statut === 'perdu' || data.statut === 'lost';
  const statutLabel = estGagne ? t('bets_won') : estPerdu ? t('bets_lost') : type === 'auto' ? t('bets_auto_status_pending') : t('bets_tab_active');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#0d0d0d', borderRadius: '20px 20px 0 0', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #1a1a1a', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: '800', fontSize: '17px', letterSpacing: '-0.3px' }}>{t('bet_detail_title')}</div>
          <button onClick={onClose} style={{ backgroundColor: 'transparent', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {type === 'auto' && (
          <div style={{ display: 'inline-block', marginBottom: '12px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
            📷 {t('bets_import_btn')}
          </div>
        )}

        <div>
          {type === 'manuel' ? (
            <>
              {ligne(t('bets_match'), data.match)}
              {ligne(t('import_field_bet_type'), BET_TYPES_LABELS[data.type_pari] || data.type_pari)}
              {ligne(t('bets_selections'), data.selection)}
              {ligne('Bookmaker', data.bookmaker)}
              {ligne(t('bets_stake'), data.mise != null ? `$${data.mise}` : null)}
              {ligne(t('bets_odds'), data.cote)}
              {ligne(t('import_field_potential'), data.mise && data.cote ? `+$${(data.mise * data.cote - data.mise).toFixed(2)}` : null)}
              {ligne('Date', formatDate(data.date_pari))}
            </>
          ) : (
            <>
              {ligne(t('import_field_player_team'), data.joueur_nom)}
              {ligne(t('import_field_team'), data.equipe)}
              {ligne(t('import_field_opponent'), data.adversaire)}
              {ligne(t('import_field_bet_type'), data.type_bet)}
              {ligne(t('import_field_stat'), data.stat_type)}
              {ligne(t('import_field_line'), data.ligne)}
              {ligne('Bookmaker', data.bookmaker)}
              {ligne(t('bets_stake'), data.mise != null ? `$${data.mise}` : null)}
              {ligne(t('bets_odds'), data.cote)}
              {ligne(t('import_field_potential'), data.gain_potentiel != null ? `+$${parseFloat(data.gain_potentiel).toFixed(2)}` : null)}
              {ligne(t('bet_detail_match_date'), formatDate(data.game_date))}
              {ligne(t('bet_detail_game_id'), data.game_id)}
            </>
          )}
          {ligne(t('bet_detail_status'), statutLabel)}
        </div>
      </div>
    </div>
  );
}

export default BetDetailSheet;
