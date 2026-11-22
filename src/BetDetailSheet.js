import React from 'react';
import { createPortal } from 'react-dom';
import { getT } from './i18n';
import { useIsMobile } from './useIsMobile';
import { BottomSheet } from './BottomSheet';
import { BET_TYPES } from './betTypes';
import { BOOKMAKERS_SUPPORTES } from './bookmakers';
import { champStyle, labelStyle, BetAutoForm, formDepuisBetAuto, champsDBDepuisForm } from './BetAutoForm';

// Panneau de detail d'un pari (src/Bets.js, seul appelant) : volet coulissant depuis la droite
// sur desktop/tablette (portail, jamais un enfant DOM de la ligne qui l'ouvre -- meme raison que
// BottomSheet.js), feuille du bas sur mobile (<768px, BottomSheet.js reutilise tel quel). Le
// contenu (vue/edition) est identique sur les deux : seul le conteneur change.

function ligne(label, valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--c-161616)' }}>
      <span style={{ color: 'var(--c-666)', fontSize: '13px' }}>{label}</span>
      <span style={{ color: 'var(--c-white)', fontSize: '13px', fontWeight: '600', textAlign: 'right' }}>{valeur}</span>
    </div>
  );
}

function formatDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }); } catch { return d; }
}

const boutonAction = (couleur) => ({ padding: '10px 12px', backgroundColor: `${couleur}1a`, color: couleur, border: `1px solid ${couleur}4d`, borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '600', flex: 1, minHeight: '40px' });

function champManuel(form, setForm, nom, label, props = {}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input style={champStyle} value={form[nom]} onChange={e => setForm({ ...form, [nom]: e.target.value })} {...props} />
    </div>
  );
}

// Conteneur responsive partage par ce fichier (et reutilisable par d'autres panneaux de detail
// futurs) : volet fixe ancre a droite (desktop/tablette, largeur fixe 440px, glissement CSS) vs
// BottomSheet plein ecran (mobile). Les deux passent par createPortal(document.body) -- jamais
// un enfant DOM direct du bouton/ligne qui ouvre le panneau (meme raison que BottomSheet.js :
// un ancetre position:sticky/backdrop-filter peut confiner un position:fixed imbrique).
export function DetailPanel({ title, onClose, children }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <BottomSheet onClose={onClose} title={title}>{children}</BottomSheet>;
  }
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2200, animation: 'detailpanel-fade-in 0.15s ease' }}>
      <style>{`
        @keyframes detailpanel-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes detailpanel-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '440px',
          backgroundColor: 'var(--c-0d0d0d)', borderLeft: '1px solid var(--c-1a1a1a)',
          padding: '20px', overflowY: 'auto', boxSizing: 'border-box',
          animation: 'detailpanel-slide-in 0.22s cubic-bezier(0.32,0.72,0,1)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontWeight: '800', fontSize: '17px', letterSpacing: '-0.3px', color: 'var(--c-white)' }}>{title}</span>
          <button onClick={onClose} aria-label="Fermer" style={{ width: '32px', height: '32px', minHeight: '32px', borderRadius: '50%', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-1a1a1a)', color: 'var(--c-888)', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function BetDetailSheet({ item, onClose, lang = 'en', onDelete, onMarkStatut, onSave, accounts }) {
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
        bookmaker: BOOKMAKERS_SUPPORTES.includes(d.bookmaker) ? d.bookmaker : '',
        account_id: d.account_id || null,
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
  const estAnnule = data.statut === 'annule' || data.statut === 'cancelled';
  // Meme libelle "Active" partout (src/BetRow.js, src/Home.js) pour un pari en cours -- jamais
  // "Pending" d'un cote et "Active"/"Actifs" de l'autre, voir la decouverte documentee dans
  // src/bankrollCalc.js (regle du solde) sur cette incoherence historique.
  const statutLabel = estGagne ? t('bets_won') : estAnnule ? t('bets_cancelled_badge') : estPerdu ? t('bets_lost') : t('home_active_badge');
  const compteUtilise = accounts?.find(a => a.id === data.account_id)?.name || null;

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
          bookmaker: formManuel.bookmaker || null,
          account_id: formManuel.account_id || null,
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
    <DetailPanel title={mode === 'edit' ? t('bet_detail_edit_title') : t('bet_detail_title')} onClose={onClose}>
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
                {ligne(t('bank_form_account_label'), compteUtilise)}
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
                {ligne(t('bank_form_account_label'), compteUtilise)}
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
            <button onClick={() => onMarkStatut(item, 'gagne')} style={boutonAction('#22c55e')}>{t('bets_won')}</button>
            <button onClick={() => onMarkStatut(item, 'perdu')} style={boutonAction('#ef4444')}>{t('bets_lost')}</button>
            <button onClick={() => onMarkStatut(item, 'annule')} style={boutonAction('#888888')}>{t('bets_cancelled_badge')}</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setMode('edit')} style={{ ...boutonAction('#f97316'), backgroundColor: 'transparent', border: '1px solid var(--c-333)', color: 'var(--c-ccc)' }}>{t('bet_detail_edit_btn')}</button>
            <button onClick={supprimer} style={{ ...boutonAction('#ef4444'), backgroundColor: 'transparent', border: '1px solid var(--c-333)', color: '#ef4444' }}>{t('bet_detail_delete_btn')}</button>
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
              <option value="">{t('import_field_bookmaker_none')}</option>
              {BOOKMAKERS_SUPPORTES.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          {accounts && (
            <div>
              <div style={labelStyle}>{t('bank_form_account_label')}</div>
              <select style={champStyle} value={formManuel.account_id || ''} onChange={e => setFormManuel({ ...formManuel, account_id: e.target.value || null })}>
                <option value="">{t('bank_form_account_none')}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {champManuel(formManuel, setFormManuel, 'mise', t('bets_stake'), { type: 'number' })}
            {champManuel(formManuel, setFormManuel, 'cote', t('bets_odds'), { type: 'number', step: '0.01' })}
          </div>
          {champManuel(formManuel, setFormManuel, 'date_pari', 'Date', { type: 'date' })}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setMode('view')} style={{ padding: '11px 20px', backgroundColor: 'transparent', color: 'var(--c-888)', border: '1px solid var(--c-333)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>{t('cancel_btn')}</button>
            <button onClick={sauvegarder} disabled={saving} style={{ flex: 1, padding: '11px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {saving ? t('saving_text') : t('bet_detail_save_btn')}
            </button>
          </div>
        </div>
      )}

      {mode === 'edit' && type === 'auto' && formAuto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <BetAutoForm form={formAuto} setForm={setFormAuto} t={t} accounts={accounts} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setMode('view')} style={{ padding: '11px 20px', backgroundColor: 'transparent', color: 'var(--c-888)', border: '1px solid var(--c-333)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>{t('cancel_btn')}</button>
            <button onClick={sauvegarder} disabled={saving} style={{ flex: 1, padding: '11px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {saving ? t('saving_text') : t('bet_detail_save_btn')}
            </button>
          </div>
        </div>
      )}
    </DetailPanel>
  );
}

export default BetDetailSheet;
