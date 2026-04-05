import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import HockeyTicker from './HockeyTicker';
import Auth from './Auth';
import Pricing from './Pricing';
import Analyses from './Analyses';
import { supabase } from './supabase';

function LandingPage({ onCommencer, onVoirPricing, onVoirAnalyses, nombreMatchs }) {
  return (
    <div style={{ color: 'white', fontFamily: 'Arial' }}>

      {/* Hero */}
      <div style={{ padding: '120px 32px 100px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '20px', padding: '6px 16px', marginBottom: '32px', fontSize: '13px', color: '#fed7aa' }}>
          <span style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Données NHL en temps réel · {nombreMatchs > 0 ? `${nombreMatchs} matchs ce soir` : 'Matchs en direct'}
        </div>
        <h1 style={{ fontSize: '64px', fontWeight: '900', margin: '0 0 24px', lineHeight: '1.1', letterSpacing: '-2px' }}>
          Analyse. Calcule.<br />
          <span style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Parie mieux.</span>
        </h1>
        <p style={{ fontSize: '20px', color: '#9ca3af', marginBottom: '48px', maxWidth: '560px', margin: '0 auto 48px', lineHeight: '1.6' }}>
          La première plateforme d'analyse technique pour les paris sportifs. Modèles statistiques avancés, cotes en temps réel et suivi de performance.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onCommencer} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 30px rgba(249,115,22,0.4)' }}>
            Commencer gratuitement →
          </button>
          <button onClick={onVoirAnalyses} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', padding: '16px 36px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}>
            Voir les analyses
          </button>
        </div>
        <p style={{ color: '#4b5563', fontSize: '13px', marginTop: '20px' }}>Gratuit pour commencer · Aucune carte de crédit</p>
      </div>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid #1f2937', borderBottom: '1px solid #1f2937', padding: '28px 32px', backgroundColor: '#111827' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap', maxWidth: '900px', margin: '0 auto' }}>
          {[
            { valeur: '3', label: 'Modèles statistiques', couleur: '#f97316' },
            { valeur: '32', label: 'Équipes NHL', couleur: '#22c55e' },
            { valeur: '40+', label: 'Bookmakers comparés', couleur: '#f59e0b' },
            { valeur: nombreMatchs > 0 ? `${nombreMatchs}` : '—', label: 'Matchs ce soir', couleur: '#ec4899' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: stat.couleur, letterSpacing: '-1px' }}>{stat.valeur}</div>
              <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature principale - Dashboard mockup */}
      <div style={{ padding: '80px 32px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{ color: '#f97316', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>Dashboard</span>
          <h2 style={{ fontSize: '40px', fontWeight: '800', margin: '12px 0 16px', letterSpacing: '-1px' }}>Ton centre de contrôle</h2>
          <p style={{ color: '#9ca3af', fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>Suis tes paris, visualise ta performance et gère ta bankroll comme un professionnel.</p>
        </div>
        <div style={{ backgroundColor: '#111827', borderRadius: '16px', border: '1px solid #1f2937', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Bankroll', valeur: '$1,840', couleur: '#fed7aa' },
              { label: 'Profit net', valeur: '+$340', couleur: '#22c55e' },
              { label: 'ROI', valeur: '+12.4%', couleur: '#22c55e' },
              { label: 'Win rate', valeur: '58%', couleur: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px 20px', flex: 1, minWidth: '120px' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: s.couleur }}>{s.valeur}</div>
              </div>
            ))}
          </div>
          <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '20px', marginBottom: '16px', height: '120px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px', marginRight: '8px', alignSelf: 'center' }}>📈 Courbe de profit</div>
            {[30, 45, 35, 60, 55, 75, 65, 85, 70, 90, 80, 95].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg, #f97316, #ea580c)', borderRadius: '4px 4px 0 0', opacity: 0.7 + i * 0.02 }} />
            ))}
          </div>
          <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '12px' }}>🎯 Paris actifs</div>
            {[
              { match: 'MTL vs TOR', type: 'Moneyline', cote: '2.10', mise: '$50', profit: '+$55' },
              { match: 'EDM vs CGY', type: 'Total buts Over 5.5', cote: '1.85', mise: '$75', profit: '+$63.75' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid #374151' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{p.match}</div>
                  <div style={{ color: '#f97316', fontSize: '12px' }}>{p.type} · Cote {p.cote}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>Mise {p.mise}</div>
                  <div style={{ color: '#22c55e', fontWeight: 'bold' }}>{p.profit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ backgroundColor: '#111827', padding: '80px 32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ color: '#f97316', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>Fonctionnalités</span>
            <h2 style={{ fontSize: '40px', fontWeight: '800', margin: '12px 0 16px', letterSpacing: '-1px' }}>Tout pour parier intelligemment</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {[
              { emoji: '📊', tag: 'Analyses', titre: 'Modèles statistiques NHL', description: 'Probabilités de victoire, différentiel de buts et total de buts calculés avec les données officielles NHL.', couleur: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
              { emoji: '💰', tag: 'Cotes', titre: 'Comparateur en temps réel', description: 'Compare les cotes de Bet365, Betway, DraftKings et plus. Notre algorithme détecte automatiquement les value bets.', couleur: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
              { emoji: '🏒', tag: 'NHL Live', titre: 'Ticker et scores en direct', description: 'Fil de matchs NHL en temps réel avec logos des équipes, scores en direct et heures de départ.', couleur: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
              { emoji: '📈', tag: 'Performance', titre: 'Suivi de bankroll avancé', description: 'Courbe de profit, ROI, win rate et gestion de bankroll avec la méthode Kelly.', couleur: '#ec4899', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)' },
              { emoji: '🎯', tag: 'Value Bets', titre: 'Détection automatique', description: 'Quand notre modèle voit une différence entre nos probabilités et les cotes des bookmakers, il te le signale.', couleur: '#ea580c', bg: 'rgba(234,88,12,0.1)', border: 'rgba(234,88,12,0.3)' },
              { emoji: '🔒', tag: 'Sécurité', titre: 'Données privées et sécurisées', description: 'Authentification sécurisée, données chiffrées. Ton historique de paris reste privé.', couleur: '#14b8a6', bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.3)' },
            ].map((f, i) => (
              <div key={i} style={{ backgroundColor: f.bg, borderRadius: '14px', padding: '28px', border: `1px solid ${f.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '24px' }}>{f.emoji}</span>
                  <span style={{ backgroundColor: f.bg, border: `1px solid ${f.border}`, color: f.couleur, fontSize: '11px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>{f.tag}</span>
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: '700', color: 'white' }}>{f.titre}</h3>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px', lineHeight: '1.7' }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment ça marche */}
      <div style={{ padding: '80px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{ color: '#f97316', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>Simple</span>
          <h2 style={{ fontSize: '40px', fontWeight: '800', margin: '12px 0 16px', letterSpacing: '-1px' }}>En 3 étapes</h2>
        </div>
        <div style={{ display: 'flex', gap: '0', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '28px', left: '16.66%', right: '16.66%', height: '2px', backgroundColor: '#1f2937', zIndex: 0 }} />
          {[
            { numero: '01', titre: 'Crée ton compte', description: 'Inscription gratuite en 30 secondes. Aucune carte de crédit requise.', emoji: '👤' },
            { numero: '02', titre: 'Analyse les matchs', description: 'Consulte les modèles statistiques et compare les cotes en temps réel.', emoji: '📊' },
            { numero: '03', titre: 'Track tes résultats', description: 'Enregistre tes paris et suis ta progression dans le Dashboard.', emoji: '📈' },
          ].map((e, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '22px' }}>
                {e.emoji}
              </div>
              <div style={{ color: '#4b5563', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>{e.numero}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '700' }}>{e.titre}</h3>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>{e.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Final */}
      <div style={{ margin: '0 32px 80px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(234,88,12,0.2) 100%)', border: '1px solid rgba(249,115,22,0.3)', padding: '64px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '44px', fontWeight: '900', margin: '0 0 16px', letterSpacing: '-1px' }}>
          Prêt à parier<br />plus intelligemment?
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '18px', marginBottom: '36px' }}>Rejoins les parieurs qui utilisent les données pour gagner.</p>
        <button onClick={onCommencer} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '18px 48px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 40px rgba(249,115,22,0.5)' }}>
          Commencer gratuitement →
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '24px', flexWrap: 'wrap' }}>
          {['✓ Gratuit pour toujours', '✓ Aucune carte de crédit', '✓ Upgrade quand tu veux'].map((t, i) => (
            <span key={i} style={{ color: '#6b7280', fontSize: '13px' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1f2937', padding: '32px', textAlign: 'center', backgroundColor: '#0a0a0a' }}>
        <h3 style={{ color: '#f97316', margin: '0 0 8px', fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px' }}>Betrics</h3>
        <p style={{ color: '#4b5563', fontSize: '13px', margin: '0 0 16px' }}>La plateforme d'analyse de paris sportifs</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '16px' }}>
          <span onClick={onVoirAnalyses} style={{ color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>Analyses</span>
          <span onClick={onVoirPricing} style={{ color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>Pricing</span>
          <span style={{ color: '#6b7280', fontSize: '13px' }}>Contact</span>
        </div>
        <p style={{ color: '#374151', fontSize: '12px', margin: 0 }}>© 2025 Betrics · Jouer comporte des risques · 18+</p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function App() {
  const [page, setPage] = useState('home');
  const [utilisateur, setUtilisateur] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [nombreMatchs, setNombreMatchs] = useState(0);

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
      <div style={{ backgroundColor: 'rgba(10,10,10,0.95)', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <h1 onClick={() => setPage('home')} style={{ color: '#f97316', margin: 0, fontSize: '20px', cursor: 'pointer', fontWeight: '900', letterSpacing: '-0.5px' }}>
            Betrics
          </h1>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span onClick={() => setPage('analyses')} style={{ cursor: 'pointer', color: page === 'analyses' ? '#f97316' : '#9ca3af', fontSize: '14px' }}>Analyses</span>
            <span onClick={() => setPage('pricing')} style={{ cursor: 'pointer', color: page === 'pricing' ? '#f97316' : '#9ca3af', fontSize: '14px' }}>Pricing</span>
            {utilisateur && (
              <span onClick={() => setPage('dashboard')} style={{ cursor: 'pointer', color: page === 'dashboard' ? '#f97316' : '#9ca3af', fontSize: '14px' }}>Dashboard</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {utilisateur ? (
            <>
              <span style={{ color: '#4b5563', fontSize: '13px' }}>{utilisateur.email}</span>
              <button onClick={handleDeconnexion} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowAuth(true)} style={{ backgroundColor: 'transparent', color: '#9ca3af', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                Se connecter
              </button>
              <button onClick={() => setShowAuth(true)} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                Commencer →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ticker NHL */}
      <HockeyTicker onMatchsCharge={(nombre) => setNombreMatchs(nombre)} />

      {/* Pages */}
      {page === 'home' && (
        <LandingPage
          onCommencer={() => setShowAuth(true)}
          onVoirPricing={() => setPage('pricing')}
          onVoirAnalyses={() => setPage('analyses')}
          nombreMatchs={nombreMatchs}
        />
      )}
      {page === 'analyses' && <Analyses />}
      {page === 'pricing' && <Pricing onChoisirPlan={(plan) => console.log('Plan choisi:', plan)} />}
      {page === 'dashboard' && utilisateur && <Dashboard />}
      {page === 'dashboard' && !utilisateur && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <p style={{ color: '#888' }}>Connecte-toi pour accéder au Dashboard.</p>
          <button onClick={() => setShowAuth(true)} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', marginTop: '16px' }}>
            Se connecter
          </button>
        </div>
      )}
    </div>
  );
}

export default App;