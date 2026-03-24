import React, { useState } from 'react';
import Dashboard from './Dashboard';

function App() {
  const [page, setPage] = useState('home');

  return (
    <div style={{ fontFamily: 'Arial', backgroundColor: '#0f0f0f', minHeight: '100vh', color: 'white' }}>
      
      {/* Navbar */}
      <div style={{ backgroundColor: '#1a1a1a', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 onClick={() => setPage('home')} style={{ color: '#6366f1', margin: 0, fontSize: '20px', cursor: 'pointer' }}>Bet Eight View</h1>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span onClick={() => setPage('dashboard')} style={{ cursor: 'pointer', color: page === 'dashboard' ? '#6366f1' : 'white' }}>Dashboard</span>
          <span style={{ cursor: 'pointer' }}>Pricing</span>
          <span style={{ cursor: 'pointer', backgroundColor: '#6366f1', padding: '8px 16px', borderRadius: '8px' }}>Se connecter</span>
        </div>
      </div>

      {/* Pages */}
      {page === 'home' && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <h2 style={{ fontSize: '48px', margin: '0 0 16px' }}>Le <span style={{ color: '#6366f1' }}>TradingView</span> du pari sportif</h2>
          <p style={{ fontSize: '18px', color: '#888', marginBottom: '32px' }}>Analyse technique, modèles statistiques et communauté — pour transformer une décision émotionnelle en pari calculé.</p>
          <button onClick={() => setPage('dashboard')} style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}>
            Commencer gratuitement
          </button>
        </div>
      )}

      {page === 'dashboard' && <Dashboard />}

    </div>
  );
}

export default App;