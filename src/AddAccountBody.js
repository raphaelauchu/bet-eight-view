import React, { useState } from 'react';
import { supabase } from './supabase';

// Formulaire "Ajouter un compte" (sans feuille/modale autour) -- fichier dedie (plutot que
// defini dans src/Bankroll.js) pour que src/Home.js puisse le reutiliser (feuille "Ajouter un
// sportsbook", au-dessus de la liste d'attente "Synchronisation automatique") sans importer
// Bankroll.js : Bankroll.js importe des utilitaires de Home.js (MaskedDots, readHideAmounts),
// un import Home -> Bankroll aurait ferme un cycle (Home -> Bankroll -> Home).

// Exporte (pas seulement local) : src/Onboarding.js reutilise exactement la meme liste pour sa
// grille de bookmakers (etape 1), pour ne jamais diverger de la liste de creation de compte.
export const ACCOUNT_KIND_OPTIONS = [
  { kind: 'bet365', label: 'bet365' },
  { kind: 'betway', label: 'Betway' },
  { kind: 'bet99', label: 'BET99' },
  { kind: 'sports_interaction', label: 'Sports Interaction' },
  { kind: 'mise_o_jeu', label: 'Mise-o-jeu+' },
];

const inputStyle = { width: '100%', padding: '11px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
const labelStyle = { color: 'var(--c-555)', fontSize: '12px', marginBottom: '6px', fontWeight: '500' };
const primaryBtn = { padding: '12px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const secondaryBtn = { padding: '11px 20px', backgroundColor: 'transparent', color: 'var(--c-888)', border: '1px solid var(--c-333)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' };

export function AddAccountBody({ t, utilisateur, existingKinds, onCreated }) {
  const [kind, setKind] = useState(null);
  const [nomAutre, setNomAutre] = useState('');
  const [soldeDepart, setSoldeDepart] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const optionsDisponibles = ACCOUNT_KIND_OPTIONS.filter(o => !existingKinds?.has(o.kind));

  async function creer() {
    if (!kind) return;
    const nom = kind === 'other' ? (nomAutre.trim() || t('bank_account_other')) : ACCOUNT_KIND_OPTIONS.find(o => o.kind === kind)?.label;
    setSaving(true);
    setErreur('');
    try {
      const { data: compte, error } = await supabase.from('bankroll_accounts')
        .insert({ user_id: utilisateur.id, name: nom, kind }).select().single();
      if (error) throw error;
      const montant = parseFloat(soldeDepart);
      if (montant > 0) {
        const { error: errTx } = await supabase.from('bankroll_transactions')
          .insert({ user_id: utilisateur.id, account_id: compte.id, type: 'deposit', amount: montant, note: t('bank_initial_balance_note') });
        if (errTx) throw errTx;
      }
      onCreated(compte);
    } catch (e) {
      setErreur(e.message || String(e));
      setSaving(false);
    }
  }

  return !kind ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {optionsDisponibles.map(o => (
        <button key={o.kind} onClick={() => setKind(o.kind)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-0d0d0d)', color: 'var(--c-white)', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          {o.label}
        </button>
      ))}
      <button onClick={() => setKind('other')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', border: '1px dashed var(--c-333)', backgroundColor: 'transparent', color: 'var(--c-888)', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
        {t('bank_account_kind_other')}
      </button>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {kind === 'other' && (
        <div>
          <div style={labelStyle}>{t('bank_account_name_label')}</div>
          <input style={inputStyle} value={nomAutre} onChange={e => setNomAutre(e.target.value)} placeholder={t('bank_account_name_placeholder')} autoFocus />
        </div>
      )}
      <div>
        <div style={labelStyle}>{t('bank_starting_balance_label')}</div>
        <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0.00" value={soldeDepart} onChange={e => setSoldeDepart(e.target.value)} />
      </div>
      {erreur && <div style={{ color: '#ef4444', fontSize: '12px' }}>{erreur}</div>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => setKind(null)} style={secondaryBtn}>{t('back_btn')}</button>
        <button onClick={creer} disabled={saving || (kind === 'other' && !nomAutre.trim())} style={{ ...primaryBtn, flex: 1, opacity: saving ? 0.7 : 1 }}>
          {saving ? t('saving_text') : t('bank_create_account_btn')}
        </button>
      </div>
    </div>
  );
}

export default AddAccountBody;
