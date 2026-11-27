import React, { useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { AUTH_GOOGLE_ENABLED, AUTH_EMAIL_ENABLED } from './authConfig';
import LegalPage from './LegalPage';

// ===================== Ecran de connexion/inscription (refonte du 27 nov 2026) =====================
// Un seul composant pour les deux (bascule "Créer un compte"/"J'ai déjà un compte", meme logique
// qu'avant) -- nouvel ecran de choix ("Continuer avec Google" / "Continuer avec courriel") avant
// le formulaire courriel+mot de passe existant (connexion par nom d'utilisateur, confirmation de
// courriel, mot de passe oublie -- logique INCHANGEE, seulement restylee/i18n'isee). Google :
// supabase.auth.signInWithOAuth (provider 'google', redirectTo = origine du site) -- redirection
// complete du navigateur, rien a attendre ici ; le listener onAuthStateChange existant de
// src/App.js recupere la session au retour et applique les reponses d'onboarding locales comme
// pour une connexion par courriel (meme chemin, voir App.js). AUTH_APPLE_ENABLED
// (src/authConfig.js) n'a encore aucun bouton/logique ici -- reserve pour plus tard.
//
// `onBackToHome` (src/App.js:goHome) : fleche retour visible en permanence (en haut, pres du
// logo) -- ramene a l'ecran de choix Google/courriel si le formulaire courriel est ouvert, sinon
// ramene a l'accueil (demande explicite, voir aussi la refonte de l'historique du navigateur dans
// src/App.js/src/Onboarding.js).

function IconBackArrow({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

// Icone standard "G" Google (4 couleurs officielles) -- asset public reutilise tel quel pour un
// bouton "Continuer avec Google", conformement aux consignes de marque de Google.
function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function Auth({ onConnexion, onBackToHome, lang = 'en', initialMode = 'login' }) {
  const t = getT(lang);
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login'); // login | signup | forgot
  const [subView, setSubView] = useState('choice'); // choice | email
  const [identifier, setIdentifier] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [email, setEmail] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [legalPage, setLegalPage] = useState(null); // null | 'terms' | 'privacy'

  const isSignup = mode === 'signup';

  async function handleGoogle() {
    setChargement(true);
    setErreur('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    // Succes : redirection complete du navigateur vers Google -- rien d'autre a faire ici. En
    // cas d'echec (config manquante, reseau...), on reste sur cet ecran avec un message clair.
    if (error) {
      setErreur(t('auth_error_oauth_generic'));
      setChargement(false);
    }
  }

  async function handleSoumission(e) {
    e.preventDefault();
    setChargement(true);
    setErreur('');

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(
        identifier.includes('@') ? identifier : email,
        { redirectTo: window.location.origin }
      );
      if (error) setErreur(error.message);
      else setResetSent(true);
      setChargement(false);
      return;
    }

    if (mode === 'signup') {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password: motDePasse });
      if (error) setErreur(error.message);
      else {
        if (signUpData?.user) {
          await supabase.from('profiles').upsert({ id: signUpData.user.id, email });
        }
        setConfirmation(true);
      }
    } else {
      let loginEmail = identifier;
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.from('profiles').select('email').eq('username', identifier).single();
        if (error || !data || !data.email) {
          setErreur(t('auth_error_username_not_found'));
          setChargement(false);
          return;
        }
        loginEmail = data.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: motDePasse });
      if (error) setErreur(t('auth_error_invalid_credentials'));
      else onConnexion();
    }
    setChargement(false);
  }

  function toggleAuthType() {
    setMode(isSignup ? 'login' : 'signup');
    setErreur('');
  }

  function handleHeaderBack() {
    if (subView === 'email') {
      setSubView('choice');
      setMode(isSignup ? 'signup' : 'login'); // sort du sous-mode "forgot" si actif
      setErreur('');
    } else {
      onBackToHome();
    }
  }

  if (legalPage) {
    return <LegalPage lang={lang} page={legalPage} onBack={() => setLegalPage(null)} />;
  }

  const inp = {
    width: '100%', padding: '13px 16px', backgroundColor: '#0d0d0d',
    border: '1px solid #222', borderRadius: '12px', color: 'white',
    fontSize: '15px', boxSizing: 'border-box', outline: 'none',
    fontFamily: '-apple-system, sans-serif',
  };

  if (confirmation) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#080808', padding: '20px' }}>
        <div style={{ backgroundColor: '#0d0d0d', padding: '40px 32px', borderRadius: '20px', textAlign: 'center', maxWidth: '380px', width: '100%', border: '1px solid #161616' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
          <h2 style={{ color: 'white', marginBottom: '12px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('auth_reset_sent_title')}</h2>
          <p style={{ color: '#555', lineHeight: '1.6', margin: 0 }}>{t('auth_check_email_sent_to')} <strong style={{ color: '#f97316' }}>{email}</strong>.</p>
        </div>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#080808', padding: '20px' }}>
        <div style={{ backgroundColor: '#0d0d0d', padding: '40px 32px', borderRadius: '20px', textAlign: 'center', maxWidth: '380px', width: '100%', border: '1px solid #161616' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
          <h2 style={{ color: 'white', marginBottom: '12px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('auth_reset_sent_title')}</h2>
          <p style={{ color: '#555', lineHeight: '1.6', marginBottom: '24px' }}>
            {t('auth_reset_sent_text')} <strong style={{ color: '#f97316' }}>{identifier || email}</strong>, {t('auth_reset_sent_text2')}
          </p>
          <button onClick={() => { setResetSent(false); setMode('login'); }}
            style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            {t('auth_back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#080808', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center', marginBottom: '24px' }}>
          <button type="button" onClick={handleHeaderBack}
            aria-label={subView === 'email' ? t('auth_back_choice_aria') : t('auth_back_home_aria')}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', display: 'flex' }}>
            <IconBackArrow />
          </button>
          <img src="/logo192.png" alt="Betrics" width="32" height="32" style={{ borderRadius: '9px', justifySelf: 'center' }} />
          <span />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'white', margin: '0 0 6px', fontSize: '26px', fontWeight: '900', letterSpacing: '-0.5px' }}>
            {isSignup ? t('auth_create_account_title') : t('auth_welcome_title')}
          </h1>
          <p style={{ color: '#555', margin: 0, fontSize: '14px' }}>
            {isSignup ? t('auth_create_account_sub') : t('auth_welcome_sub')}
          </p>
        </div>

        {subView === 'choice' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {AUTH_GOOGLE_ENABLED && (
                <button type="button" onClick={handleGoogle} disabled={chargement} aria-label={t('auth_continue_google')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', minHeight: '48px', padding: '12px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#1f1f1f', border: '1px solid #747775', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: chargement ? 'default' : 'pointer', opacity: chargement ? 0.7 : 1, fontFamily: '-apple-system, sans-serif' }}>
                  <GoogleIcon /> {t('auth_continue_google')}
                </button>
              )}

              {AUTH_GOOGLE_ENABLED && AUTH_EMAIL_ENABLED && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#1a1a1a' }} />
                  <span style={{ fontSize: '12px', color: '#555', fontWeight: '600' }}>{t('auth_or_divider')}</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#1a1a1a' }} />
                </div>
              )}

              {AUTH_EMAIL_ENABLED && (
                <button type="button" onClick={() => { setSubView('email'); setErreur(''); }}
                  style={{ width: '100%', minHeight: '48px', padding: '12px', boxSizing: 'border-box', backgroundColor: 'transparent', color: 'white', border: '1px solid #2a2a2a', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                  {t('auth_continue_email')}
                </button>
              )}
            </div>

            {erreur && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', marginTop: '16px' }}>
                <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{erreur}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {mode === 'forgot' && (
              <p style={{ color: '#555', fontSize: '14px', textAlign: 'center', marginBottom: '28px', lineHeight: '1.6' }}>{t('auth_reset_sub')}</p>
            )}

            <form onSubmit={handleSoumission} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'login' || mode === 'forgot' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('auth_username_or_email_label')}</label>
                  <input value={identifier} onChange={e => setIdentifier(e.target.value)}
                    placeholder={t('auth_username_or_email_placeholder')} required style={inp}
                    onFocus={e => e.target.style.borderColor = '#f97316'}
                    onBlur={e => e.target.style.borderColor = '#222'} />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('auth_email_label')}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth_email_placeholder')} required style={inp}
                    onFocus={e => e.target.style.borderColor = '#f97316'}
                    onBlur={e => e.target.style.borderColor = '#222'} />
                </div>
              )}

              {mode !== 'forgot' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('auth_password_label')}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} value={motDePasse}
                      onChange={e => setMotDePasse(e.target.value)} placeholder="••••••••" required
                      style={{ ...inp, paddingRight: '48px' }}
                      onFocus={e => e.target.style.borderColor = '#f97316'}
                      onBlur={e => e.target.style.borderColor = '#222'} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px' }}>
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: '-6px' }}>
                  <button type="button" onClick={() => { setMode('forgot'); setErreur(''); }}
                    style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
                    {t('auth_forgot')}
                  </button>
                </div>
              )}

              {erreur && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px' }}>
                  <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{erreur}</p>
                </div>
              )}

              <button type="submit" disabled={chargement}
                style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', opacity: chargement ? 0.7 : 1, marginTop: '4px' }}>
                {chargement ? t('auth_loading') : mode === 'forgot' ? t('auth_reset_btn') : mode === 'login' ? t('auth_signin_submit') : t('auth_signup_submit')}
              </button>
            </form>

            {mode === 'forgot' && (
              <p style={{ textAlign: 'center', marginTop: '20px' }}>
                <button onClick={() => { setMode('login'); setErreur(''); }}
                  style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
                  {t('auth_back')}
                </button>
              </p>
            )}
          </>
        )}

        {mode !== 'forgot' && (
          <p style={{ textAlign: 'center', color: '#555', fontSize: '13px', marginTop: '22px' }}>
            {isSignup ? t('auth_toggle_to_signin_prompt') : t('auth_toggle_to_signup_prompt')}{' '}
            <button type="button" onClick={toggleAuthType} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: '700', cursor: 'pointer', padding: 0, fontSize: '13px' }}>
              {isSignup ? t('auth_toggle_to_signin_cta') : t('auth_toggle_to_signup_cta')}
            </button>
          </p>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ color: '#333', fontSize: '12px', margin: '0 0 8px', lineHeight: 1.5 }}>
              {t('auth_legal_prefix')}{' '}
              <button type="button" onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', color: '#555', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', padding: 0 }}>{t('landing_footer_legal_terms')}</button>
              {' '}{t('auth_legal_and')}{' '}
              <button type="button" onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', color: '#555', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', padding: 0 }}>{t('landing_footer_legal_privacy')}</button>.
            </p>
            <p style={{ color: '#444', fontSize: '11.5px', margin: 0 }}>{t('landing2_responsible_gambling')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Auth;
