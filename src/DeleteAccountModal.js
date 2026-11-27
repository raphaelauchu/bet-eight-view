import React, { useState } from 'react';
import { getT } from './i18n';

// ===================== Modale de suppression de compte (Loi 25, droit a l'effacement) ===========
// Reutilisee a deux endroits : src/App.js:ProfilePage (section "Zone dangereuse") et
// src/ProfileSetup.js (lien discret, utile a une personne bloquee par la verification d'age --
// voir src/profileConfig.js). Confirmation en 2 temps (avertissement -> mot-cle tape avant
// d'activer le bouton rouge final), jamais un simple "OK" -- demande explicite. `onConfirm`
// (fourni par App.js:handleDeleteAccount) fait l'appel RPC + la deconnexion + le nettoyage du
// localStorage + la redirection ; cette modale se contente d'attendre sa Promise et d'afficher
// une erreur SANS se fermer ni deconnecter si elle echoue (l'utilisateur garde son compte intact
// et peut reessayer).

const RED = '#ef4444';

export default function DeleteAccountModal({ lang = 'en', onConfirm, onClose }) {
  const t = getT(lang);
  const [step, setStep] = useState('warn'); // warn | confirm
  const [texteConfirmation, setTexteConfirmation] = useState('');
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState('');

  const motAttendu = t('delete_account_confirm_word');
  const peutSupprimer = texteConfirmation.trim().toUpperCase() === motAttendu.toUpperCase() && !suppression;

  async function handleConfirmerSuppression() {
    if (!peutSupprimer) return;
    setSuppression(true);
    setErreur('');
    try {
      await onConfirm();
      // Succes : onConfirm redirige deja la page entiere (voir App.js:handleDeleteAccount) --
      // rien de plus a faire ici, ce composant est de toute facon sur le point d'etre demonte.
    } catch (e) {
      setErreur(t('delete_account_error'));
      setSuppression(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('delete_account_modal_title')}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '20px', padding: '28px 24px', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
        {step === 'warn' ? (
          <>
            <h2 style={{ margin: '0 0 12px', color: 'white', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>{t('delete_account_modal_title')}</h2>
            <p style={{ color: '#999', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>{t('delete_account_modal_body')}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose}
                style={{ flex: 1, padding: '13px', backgroundColor: 'transparent', color: 'white', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                {t('delete_account_cancel')}
              </button>
              <button type="button" onClick={() => setStep('confirm')}
                style={{ flex: 1, padding: '13px', backgroundColor: RED, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
                {t('delete_account_continue')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 12px', color: 'white', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>{t('delete_account_confirm_title')}</h2>
            <p style={{ color: '#999', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {(() => {
                const [avant, apres] = t('delete_account_confirm_instruction').split('{mot}');
                return <>{avant}<strong style={{ color: 'white' }}>{motAttendu}</strong>{apres}</>;
              })()}
            </p>
            <input
              value={texteConfirmation}
              onChange={e => setTexteConfirmation(e.target.value)}
              placeholder={t('delete_account_confirm_placeholder')}
              disabled={suppression}
              autoFocus
              style={{ width: '100%', padding: '13px 14px', backgroundColor: '#161616', border: '1px solid #333', borderRadius: '12px', color: 'white', fontSize: '15px', boxSizing: 'border-box', outline: 'none', marginBottom: '16px', textTransform: 'uppercase' }}
            />
            {erreur && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
                <p style={{ color: RED, fontSize: '13px', margin: 0 }}>{erreur}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} disabled={suppression}
                style={{ flex: 1, padding: '13px', backgroundColor: 'transparent', color: 'white', border: '1px solid #333', borderRadius: '12px', cursor: suppression ? 'default' : 'pointer', fontSize: '14px', fontWeight: '600', opacity: suppression ? 0.5 : 1 }}>
                {t('delete_account_cancel')}
              </button>
              <button type="button" onClick={handleConfirmerSuppression} disabled={!peutSupprimer}
                style={{ flex: 1, padding: '13px', backgroundColor: RED, color: 'white', border: 'none', borderRadius: '12px', cursor: peutSupprimer ? 'pointer' : 'default', fontSize: '14px', fontWeight: '700', opacity: peutSupprimer ? 1 : 0.4 }}>
                {suppression ? t('delete_account_deleting') : erreur ? t('delete_account_retry') : t('delete_account_final_btn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
