import React, { useState } from 'react';
import { supabase } from './supabase';

function Auth({ onConnexion }) {
  const [mode, setMode] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [email, setEmail] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSoumission(e) {
    e.preventDefault();
    setChargement(true);
    setErreur('');

    if (mode === 'signup') {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password: motDePasse });
      if (error) setErreur(error.message);
      else {
        if (signUpData?.user) {
          await supabase.from('profiles').upsert({ id: signUpData.user.id, email: email });
        }
        setConfirmation(true);
      }
    } else {
      let loginEmail = identifier;
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.from('profiles').select('email').eq('username', identifier).single();
        if (error || !data || !data.email) {
          setErreur('Username not found or no email associated. Try signing in with your email.');
          setChargement(false);
          return;
        }
        loginEmail = data.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: motDePasse });
      if (error) setErreur('Incorrect email/username or password.');
      else onConnexion();
    }
    setChargement(false);
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
          <h2 style={{ color: 'white', marginBottom: '12px', fontWeight: '800', letterSpacing: '-0.5px' }}>Check your email!</h2>
          <p style={{ color: '#555', lineHeight: '1.6', margin: 0 }}>We sent a confirmation link to <strong style={{ color: '#f97316' }}>{email}</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#080808', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ color: '#f97316', margin: '0 0 6px', fontSize: '32px', fontWeight: '900', letterSpacing: '-1px' }}>Betrics</h1>
          <p style={{ color: '#444', margin: 0, fontSize: '14px' }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        <div style={{ display: 'flex', marginBottom: '28px', backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '4px', border: '1px solid #161616' }}>
          {[['login', 'Sign in'], ['signup', 'Sign up']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setErreur(''); }}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '9px', cursor: 'pointer', backgroundColor: mode === m ? '#f97316' : 'transparent', color: mode === m ? 'white' : '#555', fontSize: '14px', fontWeight: mode === m ? '700' : '400' }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSoumission} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'login' ? (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email or Username</label>
              <input value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder="your@email.com or username" required style={inp}
                onFocus={e => e.target.style.borderColor = '#f97316'}
                onBlur={e => e.target.style.borderColor = '#222'} />
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required style={inp}
                onFocus={e => e.target.style.borderColor = '#f97316'}
                onBlur={e => e.target.style.borderColor = '#222'} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} value={motDePasse}
                onChange={e => setMotDePasse(e.target.value)} placeholder="••••••••" required
                style={{ ...inp, paddingRight: '48px' }}
                onFocus={e => e.target.style.borderColor = '#f97316'}
                onBlur={e => e.target.style.borderColor = '#222'} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px' }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {erreur && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px' }}>
              <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{erreur}</p>
            </div>
          )}

          <button type="submit" disabled={chargement}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', opacity: chargement ? 0.7 : 1, marginTop: '4px' }}>
            {chargement ? 'Loading...' : mode === 'login' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#333', fontSize: '12px', marginTop: '24px' }}>
          By continuing you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

export default Auth;
