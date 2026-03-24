import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import HockeyTicker from './HockeyTicker';
import Auth from './Auth';
import { supabase } from './supabase';

function App() {
  const [page, setPage] = useState('home');
  const [utilisateur, setUtilisateur] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUtilisateur(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUtilisateur(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleDeconnexion() {
    await supabase.auth.signOut();
    setUtilisateur(null);
    setPage('home');
  }

  if (showAuth && !utilisateur) {
    return (
      <div style={{ fontFamily: 'Arial', backgroundColor: '#0f0f0f', minHeight: '100vh', color: 'white' }}>
        <Auth onConnexion={() => { setShowAuth(false); setPage('dashboard'); }} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial', backgroundColor: '#0f0f0f', minHeight: '100vh', color: 'white' }}>
      
      {/* Navbar */}
      <div style={{ backgroundColor: '#1a1a1a', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 onClick={() => setPage('home')} style={{ color: '#6366f1', margin: 0, fontSize: '20px', cursor: 'pointer' }}>Bet Eight View</h1>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {utilisateur && (
            <span onClick={() => setPage('dashboard')} style={{ cursor: 'pointer', color: page === 'dashboard' ? '#6366f1' : 'white' }}>Dashboard</span>
          )}
          <span style={{ cursor: 'pointer' }}>Pricing</span>
          {utilisateur ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ color: '#888', fontSize: '14px' }}>{utilisateur.email}</span>
              <button onClick={handleDeconnexion} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                Déconnexion
              </button>
            </div>
          ) : (
            <span onClick={() => setShowAuth(true)} style={{ cursor: 'pointer', backgroundColor: '#6366f1', padding: '8px 16px', borderRadius: '8px' }}>
              Se connecter
            </span>
          )}
        </div>
      </div>

      {/* Ticker NHL */}
      <HockeyTicker />

      {/* Pages */}
      {page === 'home' && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <h2 style={{ fontSize: '48px', margin: '0 0 16px' }}>Le <span style={{ color: '#6366f1' }}>TradingView</span> du pari sportif</h2>
          <p style={{ fontSize: '18px', color: '#888', marginBottom: '32px' }}>Analyse technique, modèles statistiques et communauté — pour transformer une décision émotionnelle en pari calculé.</p>
          <button onClick={() => setShowAuth(true)} style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}>
            Commencer gratuitement
          </button>
        </div>
      )}

      {page === 'dashboard' && utilisateur && <Dashboard />}
      {page === 'dashboard' && !utilisateur && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <p style={{ color: '#888' }}>Connecte-toi pour accéder au Dashboard.</p>
          <button onClick={() => setShowAuth(true)} style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', marginTop: '16px' }}>
            Se connecter
          </button>
        </div>
      )}

    </div>
  );
}

export default App;