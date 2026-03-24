import React, { useState } from 'react';
import { supabase } from './supabase';

function Auth({ onConnexion }) {
  const [mode, setMode] = useState('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  async function handleSoumission(e) {
    e.preventDefault();
    setChargement(true);
    setErreur('');

    if (mode === 'inscription') {
      const { error } = await supabase.auth.signUp({ email, password: motDePasse });
      if (error) {
        setErreur(error.message);
      } else {
        setConfirmation(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
      if (error) {
        setErreur('Email ou mot de passe incorrect.');
      } else {
        onConnexion();
      }
    }
    setChargement(false);
  }

  if (confirmation) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ backgroundColor: '#1a1a1a', padding: '48px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ color: '#6366f1', marginBottom: '16px' }}>Vérifie ton email!</h2>
          <p style={{ color: '#888' }}>On t'a envoyé un lien de confirmation à <strong style={{ color: 'white' }}>{email}</strong>. Clique dessus pour activer ton compte.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ backgroundColor: '#1a1a1a', padding: '48px', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
        
        {/* Logo */}
        <h1 style={{ color: '#6366f1', textAlign: 'center', marginBottom: '8px' }}>Bet Eight View</h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: '32px' }}>
          {mode === 'connexion' ? 'Connecte-toi à ton compte' : 'Crée ton compte gratuitement'}
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '24px', backgroundColor: '#252525', borderRadius: '8px', padding: '4px' }}>
          <button
            onClick={() => setMode('connexion')}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: mode === 'connexion' ? '#6366f1' : 'transparent', color: 'white', fontSize: '14px' }}
          >
            Connexion
          </button>
          <button
            onClick={() => setMode('inscription')}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: mode === 'inscription' ? '#6366f1' : 'transparent', color: 'white', fontSize: '14px' }}
          >
            Inscription
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSoumission}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '14px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              style={{ width: '100%', padding: '12px', backgroundColor: '#252525', border: '1px solid #333', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '14px' }}>Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '12px', backgroundColor: '#252525', border: '1px solid #333', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {erreur && (
            <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{erreur}</p>
          )}

          <button
            type="submit"
            disabled={chargement}
            style={{ width: '100%', padding: '14px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', opacity: chargement ? 0.7 : 1 }}
          >
            {chargement ? 'Chargement...' : mode === 'connexion' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;