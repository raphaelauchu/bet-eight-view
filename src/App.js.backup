import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import HockeyTicker from './HockeyTicker';
import Auth from './Auth';
import Pricing from './Pricing';
import Analyses from './Analyses';
import { supabase } from './supabase';
 
function LandingPage({ onCommencer, onVoirPricing, onVoirAnalyses, nombreMatchs }) {
  return (
    <div style={{ color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .hero-btn:hover { transform: translateY(-1px); box-shadow: 0 0 40px rgba(249,115,22,0.6) !important; }
        .ghost-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .feature-card:hover { border-color: rgba(249,115,22,0.4) !important; transform: translateY(-2px); }
        * { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s; }
      `}</style>

      {/* HERO */}
      <div style={{ padding: '140px 24px 120px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(249,115,22,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '100px', padding: '6px 16px', marginBottom: '40px', fontSize: '13px', color: '#fdba74' }}>
          <span style={{ width: '7px', height: '7px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          NHL Live Data · {nombreMatchs > 0 ? `${nombreMatchs} games tonight` : 'Real-time updates'}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: '900', margin: '0 0 24px', lineHeight: '1.05', letterSpacing: '-2.5px', maxWidth: '820px', marginLeft: 'auto', marginRight: 'auto' }}>
          The smarter way to<br />
          <span style={{ background: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #ea580c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>bet on hockey.</span>
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '500px', margin: '0 auto 52px', lineHeight: '1.7', fontWeight: '400' }}>
          Advanced NHL analytics, real-time odds comparison, and performance tracking — built for serious bettors.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
          <button className="hero-btn" onClick={onCommencer} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '15px 32px', borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 0 30px rgba(249,115,22,0.35)', letterSpacing: '-0.2px' }}>
            Get started free →
          </button>
          <button className="ghost-btn" onClick={onVoirAnalyses} style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.1)', padding: '15px 32px', borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontWeight: '500' }}>
            View analytics
          </button>
        </div>
        <p style={{ color: '#374151', fontSize: '13px', margin: 0 }}>Free to start · No credit card required</p>
      </div>

      {/* STATS BAR */}
      <div style={{ borderTop: '1px solid #161616', borderBottom: '1px solid #161616', padding: '32px 24px', backgroundColor: '#0d0d0d' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '64px', flexWrap: 'wrap', maxWidth: '800px', margin: '0 auto' }}>
          {[
            { valeur: '32', label: 'NHL Teams' },
            { valeur: '3', label: 'Stat Models' },
            { valeur: '40+', label: 'Bookmakers' },
            { valeur: nombreMatchs > 0 ? `${nombreMatchs}` : 'Live', label: 'Games Tonight' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', letterSpacing: '-1px' }}>{stat.valeur}</div>
              <div style={{ color: '#4b5563', fontSize: '12px', marginTop: '4px', fontWeight: '500', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ padding: '100px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '100px', padding: '4px 14px', marginBottom: '20px' }}>
            <span style={{ color: '#f97316', fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Features</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-1.5px' }}>Everything you need to win.</h2>
          <p style={{ color: '#6b7280', fontSize: '16px', maxWidth: '460px', margin: '0 auto', lineHeight: '1.7' }}>From raw data to actionable insights — all in one place.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {[
            { icon: '◈', tag: 'Analytics', titre: 'NHL Statistical Models', description: 'Win probability, goal differential, and total goals calculated from official NHL data updated in real-time.', couleur: '#f97316' },
            { icon: '◎', tag: 'Live Odds', titre: 'Real-Time Odds Comparison', description: 'Compare odds from Bet365, Betway, DraftKings and more. Our algorithm automatically detects value bets.', couleur: '#22c55e' },
            { icon: '▸', tag: 'NHL Live', titre: 'Live Scores & Ticker', description: 'Real-time NHL game feed with team logos, live scores, and start times — always up to date.', couleur: '#f59e0b' },
            { icon: '⬡', tag: 'Performance', titre: 'Advanced Bankroll Tracking', description: 'Profit curve, ROI, win rate and bankroll management using the Kelly Criterion method.', couleur: '#a78bfa' },
            { icon: '◐', tag: 'Value Bets', titre: 'Automatic Edge Detection', description: 'When our model spots a gap between our probabilities and bookmaker odds, you get notified instantly.', couleur: '#ec4899' },
            { icon: '◉', tag: 'Security', titre: 'Private & Secure', description: 'Secure authentication and encrypted data. Your betting history stays completely private.', couleur: '#14b8a6' },
          ].map((f, i) => (
            <div className="feature-card" key={i} style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '28px', border: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <span style={{ color: f.couleur, fontSize: '20px', fontWeight: '300' }}>{f.icon}</span>
                <span style={{ color: f.couleur, fontSize: '11px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>{f.tag}</span>
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: '700', color: 'white', letterSpacing: '-0.3px' }}>{f.titre}</h3>
              <p style={{ margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: '1.7' }}>{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ padding: '0 24px 100px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '100px', padding: '4px 14px', marginBottom: '20px' }}>
            <span style={{ color: '#f97316', fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>How it works</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '800', margin: '0', letterSpacing: '-1.5px' }}>Up and running in minutes.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { numero: '01', titre: 'Create your account', description: 'Free signup in 30 seconds. No credit card required.', },
            { numero: '02', titre: 'Analyze the games', description: 'Browse statistical models and compare real-time odds.' },
            { numero: '03', titre: 'Track your results', description: 'Log your bets and monitor your progress in the Dashboard.' },
          ].map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', padding: '28px', borderRadius: '14px', backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              <div style={{ color: '#f97316', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', minWidth: '28px', paddingTop: '2px' }}>{e.numero}</div>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', letterSpacing: '-0.3px' }}>{e.titre}</h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: '1.6' }}>{e.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{ margin: '0 24px 100px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(234,88,12,0.08) 100%)', border: '1px solid rgba(249,115,22,0.2)', padding: '80px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: '900', margin: '0 0 16px', letterSpacing: '-2px', lineHeight: '1.05' }}>
          Ready to bet smarter?
        </h2>
        <p style={{ color: '#6b7280', fontSize: '17px', marginBottom: '40px', maxWidth: '400px', margin: '0 auto 40px', lineHeight: '1.6' }}>
          Join bettors who use data to gain an edge.
        </p>
        <button className="hero-btn" onClick={onCommencer} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '16px 44px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 0 40px rgba(249,115,22,0.4)', letterSpacing: '-0.2px' }}>
          Get started free →
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginTop: '28px', flexWrap: 'wrap' }}>
          {['Free forever', 'No credit card', 'Upgrade anytime'].map((t, i) => (
            <span key={i} style={{ color: '#374151', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#f97316' }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid #111', padding: '40px 24px', backgroundColor: '#0a0a0a' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ color: '#f97316', margin: '0 0 4px', fontSize: '16px', fontWeight: '900', letterSpacing: '-0.5px' }}>Betrics</h3>
            <p style={{ color: '#374151', fontSize: '12px', margin: 0 }}>Sports betting analytics platform</p>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <span onClick={onVoirAnalyses} style={{ color: '#4b5563', fontSize: '13px', cursor: 'pointer' }}>Analytics</span>
            <span onClick={onVoirPricing} style={{ color: '#4b5563', fontSize: '13px', cursor: 'pointer' }}>Pricing</span>
            <span style={{ color: '#4b5563', fontSize: '13px' }}>Contact</span>
          </div>
          <p style={{ color: '#1f2937', fontSize: '12px', margin: 0 }}>© 2026 Betrics · Gambling involves risk · 18+</p>
        </div>
      </div>
    </div>
  );
}
function App() {
  const [page, setPage] = useState('home');
  const [utilisateur, setUtilisateur] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [nombreMatchs, setNombreMatchs] = useState(0);
  const [ligueAnalyses, setLigueAnalyses] = useState(null);
 
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
 
      {/* Ticker NHL - visible seulement quand NHL est sélectionné dans Analyses */}
      {page === 'analyses' && ligueAnalyses === 'nhl' && (
        <HockeyTicker onMatchsCharge={(nombre) => setNombreMatchs(nombre)} />
      )}
 
      {/* Pages */}
      {page === 'home' && (
        <LandingPage
          onCommencer={() => setShowAuth(true)}
          onVoirPricing={() => setPage('pricing')}
          onVoirAnalyses={() => setPage('analyses')}
          nombreMatchs={nombreMatchs}
        />
      )}
      {page === 'analyses' && <Analyses onLigueChange={(l) => setLigueAnalyses(l)} />}
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
 