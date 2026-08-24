import React from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';

function GmailCallback({ lang = 'en' }) {
  const t = getT(lang);
  const [statut, setStatut] = React.useState('loading'); // loading, success, error
  const [erreur, setErreur] = React.useState('');

  React.useEffect(() => { echangerCode(); }, []);

  async function echangerCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const erreurGoogle = params.get('error');
    const stateAttendu = sessionStorage.getItem('gmail_oauth_state');
    sessionStorage.removeItem('gmail_oauth_state');

    if (erreurGoogle) { setStatut('error'); setErreur(t('gmail_callback_denied')); return; }
    if (!code || !state || state !== stateAttendu) { setStatut('error'); setErreur(t('gmail_callback_invalid')); return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatut('error'); setErreur(t('gmail_callback_no_session')); return; }

      const { data, error } = await supabase.functions.invoke('gmail-oauth', {
        body: { code, redirect_uri: `${window.location.origin}/auth/gmail/callback` },
      });

      if (error || data?.error) { setStatut('error'); setErreur(data?.error || error.message); return; }

      setStatut('success');
      setTimeout(() => { window.location.href = '/?page=profile'; }, 1200);
    } catch (e) {
      setStatut('error');
      setErreur(String(e));
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080808', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: '-apple-system, sans-serif', padding: '20px', textAlign: 'center' }}>
      {statut === 'loading' && (
        <>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⟳</div>
          <p style={{ color: '#888' }}>{t('gmail_callback_loading')}</p>
        </>
      )}
      {statut === 'success' && (
        <>
          <div style={{ fontSize: '32px', marginBottom: '16px', color: '#22c55e' }}>✅</div>
          <p style={{ color: '#22c55e', fontWeight: '600' }}>{t('gmail_callback_success')}</p>
        </>
      )}
      {statut === 'error' && (
        <>
          <div style={{ fontSize: '32px', marginBottom: '16px', color: '#ef4444' }}>✗</div>
          <p style={{ color: '#ef4444', fontWeight: '600', marginBottom: '16px' }}>{erreur}</p>
          <button onClick={() => { window.location.href = '/?page=profile'; }}
            style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
            {t('back_btn')}
          </button>
        </>
      )}
    </div>
  );
}

export default GmailCallback;
