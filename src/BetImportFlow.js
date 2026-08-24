import React from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { BOOKMAKERS_SUPPORTES } from './bookmakers';

const TYPES_BET = ['Moneyline', 'Over/Under', 'Prop joueur', 'Total', 'Parlay'];

function fichierVersJpegBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unsupported_image')); };
    img.src = url;
  });
}

const champStyle = { width: '100%', padding: '10px 12px', backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
const labelStyle = { color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' };

function BetImportFlow({ lang = 'en', onClose, onImported }) {
  const t = getT(lang);
  const [step, setStep] = React.useState(1);
  const [apercu, setApercu] = React.useState(null);
  const [imageBase64, setImageBase64] = React.useState(null);
  const [analysing, setAnalysing] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    bookmaker: BOOKMAKERS_SUPPORTES[0],
    joueur_ou_equipe: '',
    type_bet: TYPES_BET[0],
    stat_pariee: '',
    ligne: '',
    mise: '',
    cote: '',
  });
  const cameraInputRef = React.useRef(null);
  const galerieInputRef = React.useRef(null);

  const gainPotentiel = form.mise && form.cote ? (parseFloat(form.mise) * parseFloat(form.cote) - parseFloat(form.mise)) : null;

  async function onFichierChoisi(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErreur('');
    try {
      const dataUrl = await fichierVersJpegBase64(file);
      setApercu(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
    } catch {
      setErreur(t('import_error_unsupported_image'));
    }
  }

  async function analyser() {
    if (!imageBase64) return;
    setAnalysing(true);
    setErreur('');
    try {
      const { data, error } = await supabase.functions.invoke('bet-screenshot-parser', {
        body: { image_base64: imageBase64, media_type: 'image/jpeg' },
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      const extrait = data.data || {};
      setForm({
        bookmaker: BOOKMAKERS_SUPPORTES.includes(extrait.bookmaker) ? extrait.bookmaker : BOOKMAKERS_SUPPORTES[0],
        joueur_ou_equipe: extrait.joueur_ou_equipe || '',
        type_bet: extrait.type_bet || TYPES_BET[0],
        stat_pariee: extrait.stat_pariee || '',
        ligne: extrait.ligne ?? '',
        mise: extrait.mise ?? '',
        cote: extrait.cote ?? '',
      });
      setStep(2);
    } catch (e) {
      setErreur(t('import_error_analyze').replace('{erreur}', e.message || String(e)));
    }
    setAnalysing(false);
  }

  async function confirmerEtEnregistrer() {
    if (!form.mise || !form.cote) return;
    setSaving(true);
    setErreur('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('bets_auto').insert({
        user_id: user.id,
        bookmaker: form.bookmaker,
        type_bet: form.type_bet,
        joueur_nom: form.joueur_ou_equipe || null,
        stat_type: form.stat_pariee || null,
        ligne: form.ligne !== '' ? parseFloat(form.ligne) : null,
        mise: parseFloat(form.mise),
        cote: parseFloat(form.cote),
        gain_potentiel: gainPotentiel !== null ? parseFloat(gainPotentiel.toFixed(2)) : null,
        statut: 'pending',
      });
      if (error) throw error;
      setStep(3);
    } catch (e) {
      setErreur(String(e.message || e));
    }
    setSaving(false);
  }

  function champ(nom, label, props = {}) {
    return (
      <div>
        <div style={labelStyle}>{label}</div>
        <input style={champStyle} value={form[nom]} onChange={e => setForm({ ...form, [nom]: e.target.value })} {...props} />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #1a1a1a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.3px' }}>{t('import_title')}</div>
        <button onClick={onClose} style={{ backgroundColor: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px' }}>✕</button>
      </div>

      {erreur && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#ef4444' }}>
          {erreur}
        </div>
      )}

      {step === 1 && (
        <div>
          <input ref={cameraInputRef} type="file" accept="image/*,.heic,.heif" capture="environment" onChange={onFichierChoisi} style={{ display: 'none' }} />
          <input ref={galerieInputRef} type="file" accept="image/*,.heic,.heif" onChange={onFichierChoisi} style={{ display: 'none' }} />

          {!apercu ? (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => cameraInputRef.current?.click()} style={{ flex: 1, minWidth: '150px', padding: '20px 14px', backgroundColor: '#111', border: '1px dashed #333', borderRadius: '12px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                📷 {t('import_take_photo')}
              </button>
              <button onClick={() => galerieInputRef.current?.click()} style={{ flex: 1, minWidth: '150px', padding: '20px 14px', backgroundColor: '#111', border: '1px dashed #333', borderRadius: '12px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                🖼️ {t('import_choose_gallery')}
              </button>
            </div>
          ) : (
            <div>
              <img src={apercu} alt="screenshot" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '12px', marginBottom: '16px', border: '1px solid #222' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setApercu(null); setImageBase64(null); }} style={{ padding: '11px 20px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  {t('cancel_btn')}
                </button>
                <button onClick={analyser} disabled={analysing} style={{ flex: 1, padding: '11px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                  {analysing ? t('import_analyzing') : t('import_analyze_btn')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={labelStyle}>{t('import_field_bookmaker')}</div>
              <select style={champStyle} value={form.bookmaker} onChange={e => setForm({ ...form, bookmaker: e.target.value })}>
                {BOOKMAKERS_SUPPORTES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            {champ('joueur_ou_equipe', t('import_field_player_team'))}
            <div>
              <div style={labelStyle}>{t('import_field_bet_type')}</div>
              <select style={champStyle} value={form.type_bet} onChange={e => setForm({ ...form, type_bet: e.target.value })}>
                {TYPES_BET.map(bt => <option key={bt}>{bt}</option>)}
              </select>
            </div>
            {champ('stat_pariee', t('import_field_stat'))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {champ('ligne', t('import_field_line'), { type: 'number', step: '0.5' })}
              {champ('mise', t('import_field_stake'), { type: 'number' })}
              {champ('cote', t('import_field_odds'), { type: 'number', step: '0.01' })}
            </div>
            <div>
              <div style={labelStyle}>{t('import_field_potential')}</div>
              <div style={{ ...champStyle, backgroundColor: '#080808', color: '#22c55e', fontWeight: '700' }}>
                {gainPotentiel !== null ? `+$${gainPotentiel.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(1)} style={{ padding: '11px 20px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              {t('back_btn')}
            </button>
            <button onClick={confirmerEtEnregistrer} disabled={saving || !form.mise || !form.cote} style={{ flex: 1, padding: '11px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {saving ? t('saving_text') : t('import_confirm_btn')}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>✅</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#22c55e', marginBottom: '20px' }}>{t('import_saved_title')}</div>
          <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '20px' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>{form.joueur_ou_equipe || form.type_bet}</div>
            <div style={{ color: '#f97316', fontSize: '12px', marginBottom: '2px' }}>{form.type_bet} {form.stat_pariee && `· ${form.stat_pariee}`} {form.ligne !== '' && `· ${form.ligne}`}</div>
            <div style={{ color: '#444', fontSize: '12px' }}>{form.bookmaker} · {t('bets_odds')} {form.cote} · ${form.mise}</div>
            {gainPotentiel !== null && <div style={{ color: '#22c55e', fontSize: '12px', marginTop: '4px' }}>{t('bets_potential_short')}: +${gainPotentiel.toFixed(2)}</div>}
          </div>
          <button onClick={() => onImported?.()} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
            {t('import_back_to_list')}
          </button>
        </div>
      )}
    </div>
  );
}

export default BetImportFlow;
