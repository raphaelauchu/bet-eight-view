import React from 'react';
import { getT } from './i18n';
import { BET_TYPES } from './betTypes';
import { BOOKMAKERS_SUPPORTES } from './bookmakers';
import { champStyle, labelStyle, BetAutoForm, formDepuisBetAuto, champsDBDepuisForm } from './BetAutoForm';

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

const boutonAction = (couleur) => ({ padding: '10px 16px', backgroundColor: `${couleur}1a`, color: couleur, border: `1px solid ${couleur}4d`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', flex: 1 });

function champManuel(form, setForm, nom, label, props = {}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input style={champStyle} value={form[nom]} onChange={e => setForm({ ...form, [nom]: e.target.value })} {...props} />
    </div>
  );
}

function BetDetailSheet({ item, onClose, lang = 'en', onDelete, onMarkStatut, onSave }) {
  const t = getT(lang);
  const [mode, setMode] = React.useState('view');
  const [formManuel, setFormManuel] = React.useState(null);
  const [formAuto, setFormAuto] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setMode('view');
    if (!item) return;
    if (item.type === 'manuel') {
      const d = item.data;
      setFormManuel({
        match: d.match || '',
        type_pari: d.type_pari || BET_TYPES[0].value,
        selection: d.selection || '',
        bookmaker: BOOKMAKERS_SUPPORTES.includes(d.bookmaker) ? d.bookmaker : BOOKMAKERS_SUPPORTES[0],
        mise: d.mise ?? '',
        cote: d.cote ?? '',
        date_pari: d.date_pari ? d.date_pari.slice(0, 10) : '',
      });
    } else {
      setFormAuto(formDepuisBetAuto(item.data));
    }
  }, [item]);

  if (!item) return null;
  const { type, data } = item;

  const estGagne = data.statut === 'gagne' || data.statut === 'won';
  const estPerdu = data.statut === 'perdu' || data.statut === 'lost';
  const statutLabel = estGagne ? t('bets_won') : estPerdu ? t('bets_lost') : type === 'auto' ? t('bets_auto_status_pending') : t('bets_tab_active');

  function supprimer() {
    if (window.confirm(t('bet_detail_confirm_delete'))) {
      onDelete(item);
    }
  }

  async function sauvegarder() {
    setSaving(true);
    try {
      if (type === 'manuel') {
        await onSave(item, {
          match: formManuel.match,
          type_pari: formManuel.type_pari,
          selection: formManuel.selection || null,
          bookmaker: formManuel.bookmaker,
          mise: parseFloat(formManuel.mise),
          cote: parseFloat(formManuel.cote),
          date_pari: formManuel.date_pari || null,
        });
      } else {
        await onSave(item, champsDBDepuisForm(formAuto, t));
      }
      setMode('view');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#0d0d0d', borderRadius: '20px 20px 0 0', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #1a1a1a', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: '800', fontSize: '17px', letterSpacing: '-0.3px' }}>{mode === 'edit' ? t('bet_detail_edit_title') : t('bet_detail_title')}</div>
          <button onClick={onClose} style={{ backgroundColor: 'transparent', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {type === 'auto' && mode === 'view' && (
          <div style={{ display: 'inline-block', marginBottom: '12px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
            📷 {t('bets_import_btn')}
          </div>
        )}

        {mode === 'view' && (
          <>
            <div>
              {type === 'manuel' ? (
                <>
                  {ligne(t('bets_match'), data.match)}
                  {ligne(t('import_field_bet_type'), BET_TYPES.find(bt => bt.value === data.type_pari)?.label || data.type_pari)}
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => onMarkStatut(item, 'gagne')} style={boutonAction('#22c55e')}>{t('bets_won')} ✅</button>
              <button onClick={() => onMarkStatut(item, 'perdu')} style={boutonAction('#ef4444')}>{t('bets_lost')} ❌</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setMode('edit')} style={{ ...boutonAction('#f97316'), backgroundColor: 'transparent', border: '1px solid #333', color: '#ccc' }}>{t('bet_detail_edit_btn')}</button>
              <button onClick={supprimer} style={{ ...boutonAction('#ef4444'), backgroundColor: 'transparent', border: '1px solid #333', color: '#ef4444' }}>{t('bet_detail_delete_btn')}</button>
            </div>
          </>
        )}

        {mode === 'edit' && type === 'manuel' && formManuel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {champManuel(formManuel, setFormManuel, 'match', t('bets_match'))}
            <div>
              <div style={labelStyle}>{t('import_field_bet_type')}</div>
              <select style={champStyle} value={formManuel.type_pari} onChange={e => setFormManuel({ ...formManuel, type_pari: e.target.value })}>
                {BET_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
              </select>
            </div>
            {champManuel(formManuel, setFormManuel, 'selection', t('bets_selections'))}
            <div>
              <div style={labelStyle}>Bookmaker</div>
              <select style={champStyle} value={formManuel.bookmaker} onChange={e => setFormManuel({ ...formManuel, bookmaker: e.target.value })}>
                {BOOKMAKERS_SUPPORTES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {champManuel(formManuel, setFormManuel, 'mise', t('bets_stake'), { type: 'number' })}
              {champManuel(formManuel, setFormManuel, 'cote', t('bets_odds'), { type: 'number', step: '0.01' })}
            </div>
            {champManuel(formManuel, setFormManuel, 'date_pari', 'Date', { type: 'date' })}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setMode('view')} style={{ padding: '11px 20px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>{t('cancel_btn')}</button>
              <button onClick={sauvegarder} disabled={saving} style={{ flex: 1, padding: '11px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                {saving ? t('saving_text') : t('bet_detail_save_btn')}
              </button>
            </div>
          </div>
        )}

        {mode === 'edit' && type === 'auto' && formAuto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <BetAutoForm form={formAuto} setForm={setFormAuto} t={t} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setMode('view')} style={{ padding: '11px 20px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>{t('cancel_btn')}</button>
              <button onClick={sauvegarder} disabled={saving} style={{ flex: 1, padding: '11px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                {saving ? t('saving_text') : t('bet_detail_save_btn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BetDetailSheet;
