import React from 'react';
import { BOOKMAKERS_SUPPORTES } from './bookmakers';

export const TYPES_BET = ['Moneyline', 'Prop joueur', 'Total', 'Parlay'];
export const STAT_VALEURS = ['buts', 'passes', 'points', 'tirs', 'hits', 'blocs'];

export const TYPE_BET_DEPUIS_IA = {
  moneyline: 'Moneyline',
  spread: 'Moneyline',
  prop: 'Prop joueur',
  total: 'Total',
  parlay: 'Parlay',
};

export function mapperStatDepuisIA(valeur) {
  if (!valeur) return '';
  const v = String(valeur).toLowerCase();
  if (v.includes('but') || v.includes('goal')) return 'buts';
  if (v.includes('passe') || v.includes('assist')) return 'passes';
  if (v.includes('point')) return 'points';
  if (v.includes('tir') && !v.includes('bloq')) return 'tirs';
  if (v.includes('hit') || v.includes('échec') || v.includes('echec')) return 'hits';
  if (v.includes('bloc')) return 'blocs';
  return '';
}

export const champStyle = { width: '100%', padding: '10px 12px', backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
export const labelStyle = { color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' };

// Construit un objet form (utilise par BetAutoForm) a partir d'une ligne bets_auto existante.
export function formDepuisBetAuto(data) {
  const estTotal = data.type_bet === 'Total';
  return {
    bookmaker: BOOKMAKERS_SUPPORTES.includes(data.bookmaker) ? data.bookmaker : BOOKMAKERS_SUPPORTES[0],
    type_bet: TYPES_BET.includes(data.type_bet) ? data.type_bet : TYPES_BET[0],
    joueur_ou_equipe: data.joueur_nom || '',
    stat_pariee: !estTotal ? (mapperStatDepuisIA(data.stat_type) || STAT_VALEURS[0]) : STAT_VALEURS[0],
    over_under: estTotal && data.stat_type === 'Under' ? 'under' : 'over',
    ligne: data.ligne ?? '',
    mise: data.mise ?? '',
    cote: data.cote ?? '',
    equipe: data.equipe || '',
    adversaire: data.adversaire || '',
    date_match: data.game_date || '',
    game_id: data.game_id || '',
  };
}

// Traduit un objet form vers les colonnes de la table bets_auto.
export function champsDBDepuisForm(form, t) {
  const gainPotentiel = form.mise && form.cote ? (parseFloat(form.mise) * parseFloat(form.cote) - parseFloat(form.mise)) : null;
  const statType = form.type_bet === 'Prop joueur'
    ? (t ? t(`stat_${form.stat_pariee}`) : form.stat_pariee) || null
    : form.type_bet === 'Total'
    ? (form.over_under === 'under' ? 'Under' : 'Over')
    : null;
  return {
    bookmaker: form.bookmaker,
    type_bet: form.type_bet,
    joueur_nom: form.type_bet === 'Prop joueur' || form.type_bet === 'Parlay' ? (form.joueur_ou_equipe || null) : null,
    equipe: form.equipe || null,
    adversaire: form.adversaire || null,
    stat_type: statType,
    ligne: form.ligne !== '' ? parseFloat(form.ligne) : null,
    mise: parseFloat(form.mise),
    cote: parseFloat(form.cote),
    gain_potentiel: gainPotentiel !== null ? parseFloat(gainPotentiel.toFixed(2)) : null,
    game_date: form.date_match || null,
    game_id: form.game_id || null,
  };
}

// Champs du formulaire, adaptes au type de pari selectionne (Moneyline / Prop joueur / Total / Parlay).
// Partage entre BetImportFlow (creation) et BetDetailSheet (edition).
export function BetAutoForm({ form, setForm, t }) {
  const STAT_OPTIONS = STAT_VALEURS.map(v => ({ value: v, label: t(`stat_${v}`) }));
  const estMoneyline = form.type_bet === 'Moneyline';
  const estProp = form.type_bet === 'Prop joueur';
  const estTotal = form.type_bet === 'Total';
  const estParlay = form.type_bet === 'Parlay';

  function champ(nom, label, props = {}) {
    return (
      <div>
        <div style={labelStyle}>{label}</div>
        <input style={champStyle} value={form[nom]} onChange={e => setForm({ ...form, [nom]: e.target.value })} {...props} />
      </div>
    );
  }

  return (
    <>
      <div>
        <div style={labelStyle}>{t('import_field_bookmaker')}</div>
        <select style={champStyle} value={form.bookmaker} onChange={e => setForm({ ...form, bookmaker: e.target.value })}>
          {BOOKMAKERS_SUPPORTES.map(b => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <div style={labelStyle}>{t('import_field_bet_type')}</div>
        <select style={champStyle} value={form.type_bet} onChange={e => setForm({ ...form, type_bet: e.target.value })}>
          {TYPES_BET.map(bt => <option key={bt}>{bt}</option>)}
        </select>
      </div>

      {estMoneyline && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {champ('equipe', t('import_field_team_backed'))}
          {champ('adversaire', t('import_field_opponent'))}
        </div>
      )}

      {estProp && (
        <>
          {champ('joueur_ou_equipe', t('import_field_player'))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={labelStyle}>{t('import_field_stat_dropdown')}</div>
              <select style={champStyle} value={form.stat_pariee} onChange={e => setForm({ ...form, stat_pariee: e.target.value })}>
                {STAT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {champ('ligne', t('import_field_line'), { type: 'number', step: '0.5' })}
          </div>
        </>
      )}

      {estTotal && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={labelStyle}>{t('import_field_over_under')}</div>
              <select style={champStyle} value={form.over_under} onChange={e => setForm({ ...form, over_under: e.target.value })}>
                <option value="over">Over</option>
                <option value="under">Under</option>
              </select>
            </div>
            {champ('ligne', t('import_field_line'), { type: 'number', step: '0.5' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {champ('equipe', t('import_field_team'))}
            {champ('adversaire', t('import_field_opponent'))}
          </div>
        </>
      )}

      {estParlay && champ('joueur_ou_equipe', t('import_field_description'))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {champ('mise', t('import_field_stake'), { type: 'number' })}
        {champ('cote', t('import_field_odds'), { type: 'number', step: '0.01' })}
      </div>
      {champ('date_match', t('import_field_match_date'), { type: 'date' })}
    </>
  );
}
