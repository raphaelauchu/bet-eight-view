import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import HockeyTicker from './HockeyTicker';
import Auth from './Auth';
import Pricing from './Pricing';
import Analyses from './Analyses';
import { supabase } from './supabase';
 
function MockupJoueur() {
  return (
    <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '16px', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900', color: 'white' }}>C</div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'white' }}>Cole Caufield</div>
          <div style={{ color: '#555', fontSize: '12px' }}>R · MTL · #13</div>
        </div>
        <div style={{ marginLeft: 'auto', backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '6px 12px', textAlign: 'center' }}>
          <div style={{ color: '#f97316', fontSize: '16px', fontWeight: '900' }}>1.1</div>
          <div style={{ color: '#555', fontSize: '9px' }}>PTS/G</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
        {[['51', 'GOALS'], ['37', 'AST'], ['88', 'PTS'], ['+29', '+/-']].map(([v, l], i) => (
          <div key={i} style={{ backgroundColor: '#111', borderRadius: '8px', padding: '8px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '900', color: i === 0 ? '#f97316' : i === 3 ? '#f97316' : 'white' }}>{v}</div>
            <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ backgroundColor: '#111', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {['SOG', 'GOAL', 'AST', 'PTS', 'PPP'].map((s, i) => (
            <div key={i} style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: i === 0 ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '10px', fontWeight: i === 0 ? 'bold' : 'normal' }}>{s}</div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
          {[4, 7, 2, 5, 8, 3, 6, 4, 7, 5].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h * 7}px`, backgroundColor: h >= 5 ? '#f97316' : '#ef4444', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        <div style={{ backgroundColor: '#111', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#f97316', fontWeight: 'bold', marginBottom: '4px' }}>EDGE (SOG)</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: 'white' }}>3.5</div>
        </div>
        <div style={{ backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '4px' }}>OVER EDGE</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: '#f97316' }}>80%</div>
        </div>
        <div style={{ backgroundColor: '#111', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '4px' }}>CUMUL. L10</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: 'white' }}>42</div>
        </div>
      </div>
    </div>
  );
}

function MockupBracket() {
  const series = [
    { t: 'BUF', b: 'BOS', tw: 4, bw: 2, done: true },
    { t: 'MTL', b: 'TBL', tw: 4, bw: 3, done: true },
    { t: 'CAR', b: 'OTT', tw: 4, bw: 0, done: true },
    { t: 'COL', b: 'VGK', tw: 0, bw: 0, done: false },
  ];
  return (
    <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '16px' }}>
      <div style={{ fontSize: '10px', color: '#f97316', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px' }}>🏆 PLAYOFF BRACKET · 2026</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {series.map((s, i) => (
          <div key={i} style={{ backgroundColor: '#111', borderRadius: '8px', padding: '10px 12px', border: s.done ? '1px solid #222' : '1px solid rgba(249,115,22,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', opacity: s.done && s.tw < s.bw ? 0.4 : 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: s.done && s.tw > s.bw ? '#f97316' : 'white' }}>{s.t}</span>
              <span style={{ fontSize: '16px', fontWeight: '900', color: s.done && s.tw > s.bw ? '#f97316' : 'white' }}>{s.tw}</span>
            </div>
            <div style={{ height: '1px', backgroundColor: '#1a1a1a', marginBottom: '4px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: s.done && s.bw < s.tw ? 0.4 : 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: s.done && s.bw > s.tw ? '#f97316' : 'white' }}>{s.b}</span>
              <span style={{ fontSize: '16px', fontWeight: '900', color: s.done && s.bw > s.tw ? '#f97316' : 'white' }}>{s.bw}</span>
            </div>
            {!s.done && <div style={{ textAlign: 'center', fontSize: '9px', color: '#f97316', marginTop: '4px' }}>LIVE</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingPage({ onCommencer, onVoirPricing, onVoirAnalyses, nombreMatchs }) {
  const isMobile = window.innerWidth < 768;
  return (
    <div style={{ color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .hero-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 0 50px rgba(249,115,22,0.7) !important; }
        .ghost-btn:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.2) !important; }
        .feature-card:hover { border-color: rgba(249,115,22,0.3) !important; transform: translateY(-3px) !important; }
        .nav-link:hover { color: white !important; }
      `}</style>

      {/* HERO */}
      <div style={{ padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse 100% 60% at 50% -5%, rgba(249,115,22,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', left: '5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '100px', padding: '5px 14px', marginBottom: '36px', fontSize: '12px', color: '#fdba74' }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              NHL Live · {nombreMatchs > 0 ? `${nombreMatchs} games tonight` : 'Real-time data'}
            </div>
            <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: '900', margin: '0 0 20px', lineHeight: '1.05', letterSpacing: '-2px' }}>
              Bet smarter.<br />
              <span style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Win more.</span>
            </h1>
            <p style={{ fontSize: '17px', color: '#6b7280', margin: '0 0 40px', lineHeight: '1.7', maxWidth: '420px' }}>
              Advanced NHL analytics platform built for serious bettors. Real-time stats, edge detection, and performance tracking.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button className="hero-btn" onClick={onCommencer} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 0 30px rgba(249,115,22,0.3)', transition: 'all 0.2s' }}>
                Get started free →
              </button>
              <button className="ghost-btn" onClick={onVoirAnalyses} style={{ backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #1f2937', padding: '14px 28px', borderRadius: '10px', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s' }}>
                Live demo
              </button>
            </div>
            <p style={{ color: '#374151', fontSize: '12px', margin: 0 }}>Free forever · No credit card</p>
          </div>

          {/* Right - Mockup */}
          <div style={{ animation: 'float 6s ease-in-out infinite' }}>
            <MockupJoueur />
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', padding: '28px 24px', backgroundColor: '#080808' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          {[
            { valeur: '32', label: 'NHL Teams' },
            { valeur: '3', label: 'Stat Models' },
            { valeur: '40+', label: 'Bookmakers' },
            { valeur: '99%', label: 'Uptime' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '26px', fontWeight: '800', color: 'white', letterSpacing: '-1px' }}>{stat.valeur}</div>
              <div style={{ color: '#374151', fontSize: '11px', marginTop: '3px', fontWeight: '500', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURE 1 - Player Analytics */}
      <div style={{ padding: '100px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '100px', padding: '4px 14px', marginBottom: '20px' }}>
              <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Player Analytics</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-1.5px', lineHeight: '1.1' }}>
              Every stat you need to find the edge.
            </h2>
            <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.7', margin: '0 0 28px' }}>
              SOG, Goals, Assists, Points, PPP, Hits, Blocks and TOI — all with L5/L10/L20 breakdowns and automatic edge detection against bookmaker lines.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['L5 / L10 / L20 performance trends', 'Manual edge input with % over detection', 'Real-time TOI and advanced metrics'].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '14px' }}>
                  <span style={{ color: '#f97316', fontSize: '16px' }}>◆</span> {f}
                </div>
              ))}
            </div>
          </div>
          <MockupJoueur />
        </div>
      </div>

      {/* FEATURE 2 - Playoff Bracket */}
      <div style={{ padding: '0 24px 100px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <MockupBracket />
          <div>
            <div style={{ display: 'inline-block', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '100px', padding: '4px 14px', marginBottom: '20px' }}>
              <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Playoff Mode</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-1.5px', lineHeight: '1.1' }}>
              Automatically switches to playoffs.
            </h2>
            <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.7', margin: '0 0 28px' }}>
              When the playoffs start, Betrics automatically detects the mode and switches to playoff stats and bracket view. No manual setup needed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Live bracket with series scores', 'Eastern & Western conference view', 'Playoff vs Regular Season stats toggle'].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '14px' }}>
                  <span style={{ color: '#f97316', fontSize: '16px' }}>◆</span> {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES GRID */}
      <div style={{ backgroundColor: '#080808', padding: '100px 24px', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '800', margin: '0 0 16px', letterSpacing: '-1.5px' }}>Built for every edge.</h2>
            <p style={{ color: '#6b7280', fontSize: '16px', maxWidth: '400px', margin: '0 auto' }}>Everything you need to make smarter bets.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {[
              { icon: '⬡', tag: 'Live Odds', titre: 'Real-Time Odds', desc: 'Compare odds from 40+ bookmakers instantly. Auto-detect value bets.', c: '#f97316' },
              { icon: '◈', tag: 'NHL Live', titre: 'Live Scores & Ticker', desc: 'NHL game feed with logos, live scores and start times.', c: '#22c55e' },
              { icon: '◎', tag: 'Bankroll', titre: 'Bankroll Tracking', desc: 'Profit curve, ROI, win rate with Kelly Criterion management.', c: '#a78bfa' },
              { icon: '◐', tag: 'Security', titre: 'Private & Secure', desc: 'Encrypted data. Your betting history stays completely private.', c: '#14b8a6' },
            ].map((f, i) => (
              <div className="feature-card" key={i} style={{ backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '24px', border: '1px solid #161616', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ color: f.c, fontSize: '18px' }}>{f.icon}</span>
                  <span style={{ color: f.c, fontSize: '11px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>{f.tag}</span>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: 'white', letterSpacing: '-0.3px' }}>{f.titre}</h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: '13px', lineHeight: '1.7' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '100px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(249,115,22,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: '900', margin: '0 0 16px', letterSpacing: '-2px', lineHeight: '1.05' }}>
          Ready to find your edge?
        </h2>
        <p style={{ color: '#6b7280', fontSize: '17px', marginBottom: '40px', maxWidth: '380px', margin: '0 auto 40px', lineHeight: '1.6' }}>
          Join bettors who use data to gain an edge over the house.
        </p>
        <button className="hero-btn" onClick={onCommencer} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '16px 44px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 0 40px rgba(249,115,22,0.35)', letterSpacing: '-0.2px', transition: 'all 0.2s' }}>
          Get started free →
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '24px' }}>
          {['Free forever', 'No credit card', 'Upgrade anytime'].map((t, i) => (
            <span key={i} style={{ color: '#374151', fontSize: '13px' }}><span style={{ color: '#f97316' }}>✓</span> {t}</span>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid #0f0f0f', padding: '36px 24px', backgroundColor: '#050505' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: '#f97316', fontSize: '15px', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '3px' }}>Betrics</div>
            <div style={{ color: '#1f2937', fontSize: '12px' }}>Sports betting analytics</div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span className="nav-link" onClick={onVoirAnalyses} style={{ color: '#374151', fontSize: '13px', cursor: 'pointer', transition: 'color 0.2s' }}>Analytics</span>
            <span className="nav-link" onClick={onVoirPricing} style={{ color: '#374151', fontSize: '13px', cursor: 'pointer', transition: 'color 0.2s' }}>Pricing</span>
            <span style={{ color: '#374151', fontSize: '13px' }}>Contact</span>
          </div>
          <div style={{ color: '#1a1a1a', fontSize: '12px' }}>© 2026 Betrics · 18+ · Bet responsibly</div>
        </div>
      </div>
    </div>
  );
}

function AdminPage() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: '900px', margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '4px 12px' }}>
          <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600', letterSpacing: '1px' }}>INTERNAL</span>
        </div>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: 'white' }}>Betrics · Parameters & Methodology</h1>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>01 · Prop Probability Weighting</div>
        <div style={{ fontSize: '14px', color: '#888', lineHeight: '1.7', marginBottom: '16px' }}>
          Based on backtesting of 93 simulated NHL players across 5,766 observations (2024-25 season distributions). L5 is the strongest predictor in 9/10 cases.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[['L5', '45%', 'Most recent form — strongest predictor'], ['L10', '33%', 'Medium-term trend'], ['L20', '22%', 'Season consistency']].map(([label, weight, desc], i) => (
            <div key={i} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#f97316', letterSpacing: '-1px' }}>{weight}</div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.6', borderTop: '1px solid #1a1a1a', paddingTop: '12px' }}>
          <strong style={{ color: '#888' }}>Formula:</strong> P = (L5_rate x 0.45) + (L10_rate x 0.33) + (L20_rate x 0.22)<br/>
          <strong style={{ color: '#888' }}>Exception:</strong> Offensive defensemen use L10/L20 split (36%/35%).
        </div>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>02 · Props Analyzed</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['SOG', 'Shots on Goal', '1.5, 2.5, 3.5'],
            ['Goals', 'Goal scorer', '0.5'],
            ['Assists', 'Primary/secondary assist', '0.5'],
            ['Points', 'Goals + Assists', '0.5, 1.5'],
            ['PPP', 'Power Play Points', '0.5'],
          ].map(([stat, desc, lines], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#111', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ minWidth: '60px', fontWeight: '700', color: '#f97316', fontSize: '13px' }}>{stat}</div>
              <div style={{ flex: 1, fontSize: '13px', color: '#888' }}>{desc}</div>
              <div style={{ fontSize: '12px', color: '#555', fontFamily: 'monospace' }}>Lines: {lines}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>03 · Data Sources</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['NHL Official API', 'api-web.nhle.com/v1', 'Game logs, rosters, standings, schedules'],
            ['NHL Stats API', 'api.nhle.com/stats/rest', 'Advanced stats, hits, blocked shots'],
            ['DailyFaceoff', 'GitHub raw JSON (scraped)', 'Line combinations, PP units'],
            ['Supabase', 'supabase.io', 'User data, bets, bankroll'],
          ].map(([name, url, usage], i) => (
            <div key={i} style={{ backgroundColor: '#111', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: '600', fontSize: '13px', color: 'white' }}>{name}</span>
                <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>{url}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#555' }}>{usage}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>04 · Backtesting Results</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
          {[['MAE', 'L5: 0.420 · L10: 0.433 · L20: 0.441', 'Lower is better'], ['Correlation', 'L5: 0.272 · L10: 0.271 · L20: 0.279', 'Higher is better'], ['Brier Score', 'L5: 0.254 · L10: 0.242 · L20: 0.234', 'Lower is better']].map(([metric, values, note], i) => (
            <div key={i} style={{ backgroundColor: '#111', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{metric}</div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{values}</div>
              <div style={{ fontSize: '11px', color: '#444' }}>{note}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>93 players · 5,766 observations · NHL 2024-25 distributions</div>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '24px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>05 · Changelog</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['2026-06-07', 'Added prop probability model L5/L10/L20, Admin page with email detection'],
            ['2026-05-24', 'Added Lineup tab in FicheEquipe with DailyFaceoff trios'],
            ['2026-05-18', 'Added playoff bracket with auto-detection'],
            ['2026-05-03', 'Regular Season vs Playoffs toggle in player stats'],
            ['2026-04-25', 'HITS/BLK from boxscore API, TOI average calculation'],
            ['2026-04-19', 'Initial launch — NHL player/team analytics'],
          ].map(([date, change], i) => (
            <div key={i} style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <span style={{ color: '#444', fontFamily: 'monospace', minWidth: '90px' }}>{date}</span>
              <span style={{ color: '#666' }}>{change}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ADMIN_EMAILS = ['raphael.auch@outlook.com', 'mick31laf@gmail.com'];


function PropsPage() {
  const [props, setProps] = React.useState([]);
  const [chargement, setChargement] = React.useState(true);
  const [filtre, setFiltre] = React.useState('ALL');
  const [filtreMatch, setFiltreMatch] = React.useState('ALL');
  const [matches, setMatches] = React.useState([]);

  const getDateStr = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,'0') + "-" + String(d.getDate()).padStart(2,'0');
  const getUrl = (path) => {
    const isProd = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
    return isProd ? '/api/nhl?path=' + encodeURIComponent('https://api-web.nhle.com/v1/' + path) : 'https://api-web.nhle.com/v1/' + path;
  };

  React.useEffect(() => { chargerProps(); }, []);

  async function chargerProps() {
    setChargement(true);
    try {
      const jours = Array(7).fill(null).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return getDateStr(d); });
      const resultats = {};
      await Promise.all(jours.map(async (jour) => {
        try {
          const res = await fetch(getUrl('schedule/' + jour));
          const data = await res.json();
          const games = data.gameWeek?.[0]?.games || [];
          if (games.length > 0) resultats[jour] = games;
        } catch {}
      }));
      const aujourd = getDateStr(new Date());
      const prochainJour = Object.keys(resultats).sort().find(j => resultats[j]?.length > 0) || aujourd;
      const matchsDuJour = resultats[prochainJour] || [];
      setMatches(matchsDuJour);
      if (matchsDuJour.length === 0) { setChargement(false); return; }
      const joueursDuJour = [];
      for (const match of matchsDuJour) {
        for (const abbrev of [match.awayTeam?.abbrev, match.homeTeam?.abbrev]) {
          if (!abbrev) continue;
          try {
            const res = await fetch(getUrl('roster/' + abbrev + '/20252026'));
            const data = await res.json();
            (data.forwards || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'F', matchId: match.id, away: match.awayTeam?.abbrev, home: match.homeTeam?.abbrev }));
            (data.defensemen || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'D', matchId: match.id, away: match.awayTeam?.abbrev, home: match.homeTeam?.abbrev }));
          } catch {}
        }
      }
      const resultats2 = [];
      for (let i = 0; i < Math.min(joueursDuJour.length, 80); i += 5) {
        const batch = joueursDuJour.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(async (j) => {
          try {
            const res = await fetch(getUrl('player/' + j.id + '/game-log/20252026/2'));
            const data = await res.json();
            const log = (data.gameLog || []).slice(0, 20);
            if (log.length < 5) return null;
            const l5 = log.slice(0, 5);
            const l10 = log.slice(0, Math.min(10, log.length));
            const l20 = log.slice(0, Math.min(20, log.length));
            const hit = (games, stat, line) => games.filter(g => (g[stat] || 0) > line).length / games.length;
            const candidates = [];
            for (const line of [1.5, 2.5, 3.5]) {
              const r5=hit(l5,'shots',line), r10=hit(l10,'shots',line), r20=hit(l20,'shots',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'SOG', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5, 1.5]) {
              const r5=hit(l5,'points',line), r10=hit(l10,'points',line), r20=hit(l20,'points',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'PTS', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5]) {
              const r5=hit(l5,'goals',line), r10=hit(l10,'goals',line), r20=hit(l20,'goals',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'GOAL', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5]) {
              const r5=hit(l5,'assists',line), r10=hit(l10,'assists',line), r20=hit(l20,'assists',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'AST', line, prob, r5, r10, r20 });
            }
            if (candidates.length === 0) return null;
            const nom = ((j.firstName?.default||'') + ' ' + (j.lastName?.default||'')).trim();
            return candidates.sort((a,b) => b.prob-a.prob).map(c => ({ id: j.id, nom, equipe: j.equipe, position: j.position, away: j.away, home: j.home, ...c }));
          } catch { return null; }
        }));
        batchRes.filter(Boolean).forEach(arr => resultats2.push(...arr));
      }
      setProps(resultats2.sort((a,b) => b.prob-a.prob));
    } catch {}
    setChargement(false);
  }

  const categories = ['ALL', 'SOG', 'PTS', 'GOAL', 'AST'];
  const catColors = { SOG: '#3b82f6', PTS: '#f97316', GOAL: '#22c55e', AST: '#a78bfa', ALL: '#f97316' };

  const propsFiltres = props.filter(p => {
    const catOk = filtre === 'ALL' || p.stat === filtre;
    const matchOk = filtreMatch === 'ALL' || p.equipe === filtreMatch || p.away === filtreMatch || p.home === filtreMatch;
    return catOk && matchOk;
  });

  const getColor = (prob) => prob >= 0.75 ? '#22c55e' : prob >= 0.65 ? '#f97316' : '#888';
  const getBg = (prob) => prob >= 0.75 ? 'rgba(34,197,94,0.08)' : prob >= 0.65 ? 'rgba(249,115,22,0.08)' : 'rgba(100,100,100,0.05)';
  const getBorder = (prob) => prob >= 0.75 ? 'rgba(34,197,94,0.2)' : prob >= 0.65 ? 'rgba(249,115,22,0.2)' : '#161616';

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>

      {/* Header */}
      <div style={{ padding: '20px 20px 12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }}>Props</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '13px' }}>Ranked by L5·L10·L20 model · {propsFiltres.length} props</p>
      </div>

      {/* Match filter */}
      {matches.length > 0 && (
        <div style={{ padding: '0 20px 12px', overflowX: 'auto', display: 'flex', gap: '6px', scrollbarWidth: 'none' }}>
          <button onClick={() => setFiltreMatch('ALL')} style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: filtreMatch === 'ALL' ? '#f97316' : '#0d0d0d', color: filtreMatch === 'ALL' ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>All games</button>
          {matches.map((m, i) => {
            const label = (m.awayTeam?.abbrev || '') + ' vs ' + (m.homeTeam?.abbrev || '');
            const isActive = filtreMatch === m.awayTeam?.abbrev || filtreMatch === m.homeTeam?.abbrev;
            return (
              <button key={i} onClick={() => setFiltreMatch(isActive ? 'ALL' : m.awayTeam?.abbrev)} style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: isActive ? '#f97316' : '#0d0d0d', color: isActive ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>{label}</button>
            );
          })}
        </div>
      )}

      {/* Stat categories */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '6px' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFiltre(cat)} style={{ flex: 1, padding: '8px 4px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: filtre === cat ? catColors[cat] : '#0d0d0d', color: filtre === cat ? 'white' : '#555', fontSize: '12px', fontWeight: '700', transition: 'all 0.15s' }}>{cat}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #1a1a1a', borderTop: '3px solid #f97316', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#444', fontSize: '13px', margin: 0 }}>Calculating props...</p>
          </div>
        ) : propsFiltres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#333', fontSize: '13px' }}>No props for this category today.</div>
        ) : propsFiltres.map((p, i) => (
          <div key={p.id + p.stat + p.line + i} style={{ backgroundColor: getBg(p.prob), borderRadius: '16px', padding: '14px 16px', border: '1px solid ' + getBorder(p.prob), marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Rank */}
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#333', minWidth: '24px', textAlign: 'center' }}>#{i+1}</div>

            {/* Photo */}
            <img src={'https://assets.nhle.com/mugs/' + p.id + '.png'} alt={p.nom}
              style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#1a1a1a', border: '2px solid #222', flexShrink: 0 }}
              onError={e => { e.target.style.display='none'; }} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: 'white', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>{p.equipe} · {p.away} vs {p.home}</div>
              {/* L5 L10 L20 bars */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {[['L5', p.r5], ['L10', p.r10], ['L20', p.r20]].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '9px', color: '#444', fontWeight: '600' }}>{label}</span>
                    <div style={{ width: '28px', height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: Math.round(val*100) + '%', height: '100%', backgroundColor: getColor(val), borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '9px', color: '#444' }}>{Math.round(val*100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prop badge */}
            <div style={{ textAlign: 'center', backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '8px 12px', flexShrink: 0 }}>
              <div style={{ fontSize: '10px', color: catColors[p.stat] || '#f97316', fontWeight: '700', marginBottom: '2px', letterSpacing: '0.5px' }}>{p.stat} {p.line}+</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: getColor(p.prob), letterSpacing: '-0.5px', lineHeight: 1 }}>{Math.round(p.prob * 100)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeDashboard({ utilisateur, onGoToProps, onGoToAnalytics, onGoToBets }) {
  const [firstName, setFirstName] = React.useState('');
  const [bankroll, setBankroll] = React.useState(null);
  const [paris, setParis] = React.useState([]);
  const [matchsSoir, setMatchsSoir] = React.useState([]);

  const getDateStr = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,'0') + "-" + String(d.getDate()).padStart(2,'0');
  const getUrl = (path) => {
    const isProd = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
    return isProd ? '/api/nhl?path=' + encodeURIComponent('https://api-web.nhle.com/v1/' + path) : 'https://api-web.nhle.com/v1/' + path;
  };

  const LOGOS = { BOS:'https://assets.nhle.com/logos/nhl/svg/BOS_light.svg',BUF:'https://assets.nhle.com/logos/nhl/svg/BUF_light.svg',DET:'https://assets.nhle.com/logos/nhl/svg/DET_light.svg',FLA:'https://assets.nhle.com/logos/nhl/svg/FLA_light.svg',MTL:'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg',OTT:'https://assets.nhle.com/logos/nhl/svg/OTT_light.svg',TBL:'https://assets.nhle.com/logos/nhl/svg/TBL_light.svg',TOR:'https://assets.nhle.com/logos/nhl/svg/TOR_light.svg',CAR:'https://assets.nhle.com/logos/nhl/svg/CAR_light.svg',CBJ:'https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg',NJD:'https://assets.nhle.com/logos/nhl/svg/NJD_light.svg',NYI:'https://assets.nhle.com/logos/nhl/svg/NYI_light.svg',NYR:'https://assets.nhle.com/logos/nhl/svg/NYR_light.svg',PHI:'https://assets.nhle.com/logos/nhl/svg/PHI_light.svg',WSH:'https://assets.nhle.com/logos/nhl/svg/WSH_light.svg',CHI:'https://assets.nhle.com/logos/nhl/svg/CHI_light.svg',COL:'https://assets.nhle.com/logos/nhl/svg/COL_light.svg',DAL:'https://assets.nhle.com/logos/nhl/svg/DAL_light.svg',MIN:'https://assets.nhle.com/logos/nhl/svg/MIN_light.svg',NSH:'https://assets.nhle.com/logos/nhl/svg/NSH_light.svg',STL:'https://assets.nhle.com/logos/nhl/svg/STL_light.svg',WPG:'https://assets.nhle.com/logos/nhl/svg/WPG_light.svg',ANA:'https://assets.nhle.com/logos/nhl/svg/ANA_light.svg',CGY:'https://assets.nhle.com/logos/nhl/svg/CGY_light.svg',EDM:'https://assets.nhle.com/logos/nhl/svg/EDM_light.svg',LAK:'https://assets.nhle.com/logos/nhl/svg/LAK_light.svg',SJS:'https://assets.nhle.com/logos/nhl/svg/SJS_light.svg',SEA:'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg',VGK:'https://assets.nhle.com/logos/nhl/svg/VGK_light.svg',VAN:'https://assets.nhle.com/logos/nhl/svg/VAN_light.svg',UTA:'https://assets.nhle.com/logos/nhl/svg/UTA_light.svg',PIT:'https://assets.nhle.com/logos/nhl/svg/PIT_light.svg' };

  React.useEffect(() => {
    if (utilisateur?.id) {
      supabase.from('profiles').select('first_name').eq('id', utilisateur.id).single()
        .then(({ data }) => { if (data?.first_name) setFirstName(data.first_name); });
      supabase.from('bankroll').select('montant').eq('user_id', utilisateur.id).single()
        .then(({ data }) => { if (data) setBankroll(data.montant); });
      supabase.from('paris').select('*').eq('user_id', utilisateur.id).order('date_pari', { ascending: false })
        .then(({ data }) => { if (data) setParis(data); });
    }
    // Charger matchs du soir
    const today = getDateStr(new Date());
    fetch(getUrl('schedule/' + today))
      .then(r => r.json())
      .then(data => {
        const games = data.gameWeek?.[0]?.games || [];
        setMatchsSoir(games.slice(0, 5));
      }).catch(() => {});
  }, [utilisateur?.id]);

  const displayName = firstName || utilisateur?.email?.split('@')[0] || 'there';
  const parisActifs = paris.filter(p => p.statut === 'actif');
  const parisTraites = paris.filter(p => p.statut !== 'actif');
  const profitTotal = parisTraites.reduce((acc, p) => acc + (p.profit || 0), 0);
  const parisGagnes = parisTraites.filter(p => p.statut === 'gagne').length;
  const winRate = parisTraites.length > 0 ? Math.round((parisGagnes / parisTraites.length) * 100) : 0;
  const miseTotale = parisTraites.reduce((acc, p) => acc + (p.mise || 0), 0);
  const roi = miseTotale > 0 ? ((profitTotal / miseTotale) * 100).toFixed(1) : '0.0';
  const bankrollDisplay = bankroll !== null ? bankroll.toFixed(2) : '...';
  const kellyStake = bankroll !== null ? (bankroll * 0.05).toFixed(2) : '...';
  const recentParis = paris.slice(0, 3);

  // Profit curve data
  const parisTraitesSorted = [...parisTraites].sort((a,b) => new Date(a.date_pari) - new Date(b.date_pari));
  let cumul = 0;
  const curveData = parisTraitesSorted.map(p => { cumul += (p.profit || 0); return cumul; });
  const maxVal = Math.max(...curveData, 1);
  const minVal = Math.min(...curveData, 0);
  const range = maxVal - minVal || 1;
  const H = 60;
  const W = 200;
  const points = curveData.map((v, i) => {
    const x = curveData.length === 1 ? W/2 : (i / (curveData.length - 1)) * W;
    const y = H - ((v - minVal) / range) * H;
    return x + ',' + y;
  }).join(' ');

  return (
    <div style={{ padding: '20px 20px 0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ margin: '0 0 2px', color: '#444', fontSize: '13px' }}>Welcome back</p>
        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.8px', color: 'white' }}>{displayName}</h2>
      </div>

      {/* Bankroll card */}
      <div style={{ position: 'relative', borderRadius: '24px', padding: '24px', marginBottom: '16px', overflow: 'hidden', background: 'linear-gradient(135deg, #1a1a1a 0%, #111 100%)', border: '1px solid #222' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <p style={{ margin: 0, color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Bankroll</p>
          <div style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '20px', padding: '3px 10px' }}>
            <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600' }}>● Live</span>
          </div>
        </div>
        <h1 style={{ margin: '6px 0 16px', fontSize: '44px', fontWeight: '900', color: 'white', letterSpacing: '-2px', lineHeight: 1 }}>${bankrollDisplay.split('.')[0]}<span style={{ fontSize: '24px', color: '#555' }}>.{bankrollDisplay.split('.')[1] || '00'}</span></h1>

        {/* Mini Profit Curve */}
        {curveData.length > 1 && (
          <div style={{ marginBottom: '16px', backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Profit Curve</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: profitTotal >= 0 ? '#22c55e' : '#ef4444' }}>{profitTotal >= 0 ? '+' : ''}${profitTotal.toFixed(2)}</span>
            </div>
            <svg width="100%" height={H} viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none">
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={profitTotal >= 0 ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={profitTotal >= 0 ? '#22c55e' : '#ef4444'} stopOpacity="0" />
                </linearGradient>
              </defs>
              {curveData.length > 1 && (
                <>
                  <polyline points={points} fill="none" stroke={profitTotal >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="0" y1={H - ((0 - minVal) / range) * H} x2={W} y2={H - ((0 - minVal) / range) * H} stroke="#333" strokeWidth="0.5" strokeDasharray="4,4" />
                </>
              )}
            </svg>
          </div>
        )}

        <div style={{ display: 'flex', borderTop: '1px solid #1f1f1f', paddingTop: '16px' }}>
          {[[`ROI`, `${parseFloat(roi) >= 0 ? '+' : ''}${roi}%`, parseFloat(roi) >= 0 ? '#22c55e' : '#ef4444'], ['Win Rate', `${winRate}%`, 'white'], ['Active', `${parisActifs.length} bets`, '#f97316']].map(([label, val, color], i) => (
            <div key={i} style={{ flex: 1, borderRight: i < 2 ? '1px solid #1f1f1f' : 'none', paddingRight: i < 2 ? '16px' : '0', paddingLeft: i > 0 ? '16px' : '0' }}>
              <p style={{ margin: '0 0 3px', color: '#444', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color }}>{val}</p>
            </div>
          ))}
        </div>
      </div>



      {/* Matchs du soir */}
      {matchsSoir.length > 0 && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid #161616', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>Tonight's Games</h3>
            <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600' }}>{matchsSoir.length} games</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matchsSoir.map((m, i) => {
              const away = m.awayTeam?.abbrev;
              const home = m.homeTeam?.abbrev;
              const heure = new Date(m.startTimeUTC).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
              const isLive = m.gameState === 'LIVE' || m.gameState === 'CRIT';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: i > 0 ? '1px solid #111' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <img src={LOGOS[away]} alt={away} style={{ width: '24px', height: '24px', objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>{away}</span>
                    <span style={{ fontSize: '11px', color: '#444' }}>@</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>{home}</span>
                    <img src={LOGOS[home]} alt={home} style={{ width: '24px', height: '24px', objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
                  </div>
                  {isLive ? (
                    <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>LIVE</span>
                  ) : (
                    <span style={{ color: '#555', fontSize: '12px' }}>{heure}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Bets */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid #161616', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>Recent Bets</h3>
          <span onClick={onGoToBets} style={{ color: '#f97316', fontSize: '12px', cursor: 'pointer' }}>See all →</span>
        </div>
        {recentParis.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '8px' }}>
            <span style={{ fontSize: '28px' }}>🏒</span>
            <p style={{ margin: 0, color: '#333', fontSize: '13px' }}>No bets yet</p>
            <p style={{ margin: 0, color: '#222', fontSize: '12px' }}>Start tracking from the Bets menu</p>
          </div>
        ) : recentParis.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid #111' : 'none' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '13px', color: 'white' }}>{p.match}</p>
              <p style={{ margin: 0, color: '#555', fontSize: '11px' }}>{p.bookmaker} · Odds {p.cote}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {p.statut === 'actif' ? (
                <span style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: '600' }}>Active</span>
              ) : (
                <span style={{ color: p.statut === 'gagne' ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '14px' }}>
                  {p.statut === 'gagne' ? '+' : '-'}${Math.abs(p.statut === 'gagne' ? p.profit : p.mise).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Kelly */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', color: '#444', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Kelly 5% · Recommended Stake</p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#22c55e', letterSpacing: '-1px' }}>${kellyStake.split('.')[0]}<span style={{ fontSize: '18px', color: '#1a6b3c' }}>.{kellyStake.split('.')[1] || '00'}</span></p>
          </div>
          <div style={{ backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: '14px', padding: '12px 16px', border: '1px solid rgba(34,197,94,0.15)' }}>
            <p style={{ margin: '0 0 2px', color: '#22c55e', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>Per bet</p>
            <p style={{ margin: 0, color: '#1a6b3c', fontSize: '10px', textAlign: 'center' }}>Max risk</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ utilisateur, onBack }) {
  const [username, setUsername] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [usernameStatus, setUsernameStatus] = React.useState(null); // null, 'checking', 'available', 'taken', 'invalid'
  const [originalUsername, setOriginalUsername] = React.useState('');
  const [cropModal, setCropModal] = React.useState(false);
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState({ unit: '%', width: 80, height: 80, x: 10, y: 10 });
  const [completedCrop, setCompletedCrop] = React.useState(null);
  const imgRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => { chargerProfil(); }, []);

  async function chargerProfil() {
    try {
      const { data } = await supabase.from('profiles').select('username, avatar_url, first_name, last_name').eq('id', utilisateur.id).single();
      if (data) { setUsername(data.username || ''); setOriginalUsername(data.username || ''); setAvatarUrl(data.avatar_url || null); setFirstName(data.first_name || ''); setLastName(data.last_name || ''); }
    } catch {}
  }

  async function sauvegarderProfil() {
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({ id: utilisateur.id, username, first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() });
      if (!error) { setOriginalUsername(username); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    setSaving(false);
  }

  React.useEffect(() => {
    if (cropModal) {
      const prevent = (e) => e.preventDefault();
      document.addEventListener('gesturestart', prevent, { passive: false });
      document.addEventListener('gesturechange', prevent, { passive: false });
      document.addEventListener('wheel', prevent, { passive: false });
      const meta = document.querySelector('meta[name=viewport]');
      if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
      return () => {
        document.removeEventListener('gesturestart', prevent);
        document.removeEventListener('gesturechange', prevent);
        document.removeEventListener('wheel', prevent);
        if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1');
      };
    }
  }, [cropModal]);

  const checkUsername = React.useCallback(async (val) => {
    if (!val || val.length < 3) { setUsernameStatus('invalid'); return; }
    if (val === originalUsername) { setUsernameStatus('available'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    try {
      const { data } = await supabase.from('profiles').select('username').eq('username', val).neq('id', utilisateur.id).single();
      setUsernameStatus(data ? 'taken' : 'available');
    } catch { setUsernameStatus('available'); }
  }, [originalUsername, utilisateur.id]);

  React.useEffect(() => {
    const timer = setTimeout(() => { if (username) checkUsername(username); }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  function onSelectFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result);
      setCrop({ unit: '%', width: 80, height: 80, x: 10, y: 10 });
      setCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function getCroppedBlob() {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(
      image,
      completedCrop.x * scaleX, completedCrop.y * scaleY,
      completedCrop.width * scaleX, completedCrop.height * scaleY,
      0, 0, size, size
    );
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  async function uploadCropped() {
    setUploading(true);
    setCropModal(false);
    try {
      const blob = await getCroppedBlob();
      if (!blob) return;
      const path = utilisateur.id + '/avatar.jpg';
      const { error } = await supabase.storage.from('Avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) {
        const { data } = supabase.storage.from('Avatars').getPublicUrl(path);
        const url = data.publicUrl + '?t=' + Date.now();
        setAvatarUrl(url);
        await supabase.from('profiles').upsert({ id: utilisateur.id, avatar_url: url });
      }
    } catch(e) { console.error(e); }
    setUploading(false);
  }

  const initials = (username || utilisateur?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      <style>{'.crop-container img { max-width: 100%; max-height: 60vh; } .ReactCrop { border-radius: 12px; overflow: hidden; }'}</style>

      {/* Crop Modal */}
      {cropModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <style>{`
            .crop-area { position: relative; overflow: hidden; touch-action: none; }
            .crop-img { position: absolute; cursor: grab; user-select: none; }
            .crop-img:active { cursor: grabbing; }
          `}</style>
          <h3 style={{ color: 'white', margin: '0 0 8px', fontWeight: '700', fontSize: '18px' }}>Crop your photo</h3>
          <p style={{ color: '#555', fontSize: '13px', margin: '0 0 20px' }}>Drag to reposition · Pinch to zoom</p>

          {imgSrc && (() => {
            const SIZE = Math.min(window.innerWidth - 40, 320);
            return (
              <div style={{ position: 'relative', width: SIZE, height: SIZE, marginBottom: '20px' }}>
                <CropArea imgSrc={imgSrc} size={SIZE} imgRef={imgRef} onCropChange={setCompletedCrop} />
                {/* Cercle overlay */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', border: '3px solid #f97316', pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)', zIndex: 10 }} />
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setCropModal(false)} style={{ padding: '13px 28px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', fontSize: '15px' }}>Cancel</button>
            <button onClick={uploadCropped} style={{ padding: '13px 28px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>Use this photo</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button onClick={onBack} style={{ backgroundColor: 'transparent', border: '1px solid #222', color: '#666', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>My Profile</h2>
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div onClick={() => !uploading && fileInputRef.current?.click()} style={{ position: 'relative', cursor: 'pointer', marginBottom: '12px' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f97316' }} />
          ) : (
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#1a1a1a', border: '3px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '900', color: '#f97316' }}>{initials}</div>
          )}
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: '2px solid #080808' }}>
            {uploading ? '⟳' : '✎'}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelectFile} style={{ display: 'none' }} />
        <p style={{ margin: 0, color: '#444', fontSize: '12px' }}>{uploading ? 'Uploading...' : 'Tap to change photo'}</p>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>First Name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name"
              style={{ width: '100%', padding: '12px 14px', backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '12px', color: 'white', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#f97316'}
              onBlur={e => e.target.style.borderColor = '#222'} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name"
              style={{ width: '100%', padding: '12px 14px', backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '12px', color: 'white', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#f97316'}
              onBlur={e => e.target.style.borderColor = '#222'} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. raphael_bets"
            style={{ width: '100%', padding: '12px 14px', backgroundColor: '#0d0d0d', border: '1px solid ' + (usernameStatus === 'taken' || usernameStatus === 'invalid' ? '#ef4444' : usernameStatus === 'available' ? '#22c55e' : '#222'), borderRadius: '12px', color: 'white', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: '-apple-system, sans-serif' }}
          />
          {username.length > 0 && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: usernameStatus === 'taken' ? '#ef4444' : usernameStatus === 'available' ? '#22c55e' : usernameStatus === 'invalid' ? '#ef4444' : '#555' }}>
              {usernameStatus === 'checking' && '⟳ Checking availability...'}
              {usernameStatus === 'available' && '✓ Username available!'}
              {usernameStatus === 'taken' && '✗ Username already taken'}
              {usernameStatus === 'invalid' && '✗ Only letters, numbers and _ allowed (min 3 chars)'}
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Email</label>
          <div style={{ padding: '12px 14px', backgroundColor: '#080808', border: '1px solid #161616', borderRadius: '12px', color: '#444', fontSize: '15px' }}>{utilisateur?.email}</div>
        </div>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '16px', border: '1px solid #161616', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 12px', color: '#555', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Account</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666', fontSize: '13px' }}>Member since</span>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{new Date(utilisateur?.created_at || Date.now()).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <button onClick={sauvegarderProfil} disabled={saving}
        style={{ width: '100%', padding: '14px', background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #f97316, #ea580c)', color: saved ? '#22c55e' : 'white', border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>
        {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function App() {
  const [page, setPage] = useState(window.location.search.includes('admin=betrics2026') ? 'admin' : 'home');
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [utilisateur, setUtilisateur] = useState(null);
  const isAdmin = utilisateur && ADMIN_EMAILS.includes(utilisateur.email);
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
 
  // App connectée avec bottom nav style Oura
  if (utilisateur) {
    const tabs = [
      { id: 'home', label: 'Home', icon: '⌂' },
      { id: 'analyses', label: 'Analytics', icon: '◎' },
      { id: 'props', label: 'Props', icon: '◆' },
    ];
    const activeTab = ['home', 'analyses', 'props'].includes(page) ? page : page === 'bets' || page === 'admin' ? page : 'home';

    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: '#080808', minHeight: '100vh', color: 'white', paddingBottom: '80px' }}>

        {/* Top bar connecté */}
        <div style={{ backgroundColor: 'rgba(8,8,8,0.95)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
          <button onClick={() => setMenuOuvert(true)} style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ width: '22px', height: '2px', backgroundColor: '#888', borderRadius: '2px' }} />
            <div style={{ width: '22px', height: '2px', backgroundColor: '#888', borderRadius: '2px' }} />
            <div style={{ width: '14px', height: '2px', backgroundColor: '#888', borderRadius: '2px' }} />
          </button>
          <h1 style={{ color: '#f97316', margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '-0.5px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Betrics</h1>
          <div style={{ width: '30px' }} />
        </div>

        {/* Menu hamburger overlay */}
        {menuOuvert && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500, display: 'flex' }}>
            <div style={{ width: '75%', maxWidth: '300px', backgroundColor: '#0a0a0a', height: '100%', padding: '0', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 40px rgba(0,0,0,0.8)' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#f97316', fontWeight: '900', fontSize: '18px' }}>Betrics</h2>
                <button onClick={() => setMenuOuvert(false)} style={{ backgroundColor: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '12px', flex: 1 }}>
                <div style={{ color: '#333', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 12px', marginBottom: '4px' }}>Menu</div>
                {[
                  { icon: '👤', label: 'My Profile', page: 'profile' },
                  { icon: '⌂', label: 'Home', page: 'home' },
                  { icon: '◐', label: 'Bets', page: 'bets' },
                ].map((item) => (
                  <button key={item.page} onClick={() => { setPage(item.page); setMenuOuvert(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 12px', backgroundColor: page === item.page ? 'rgba(249,115,22,0.08)' : 'transparent', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '2px' }}>
                    <span style={{ fontSize: '18px', color: page === item.page ? '#f97316' : '#555' }}>{item.icon}</span>
                    <span style={{ fontSize: '15px', fontWeight: page === item.page ? '600' : '400', color: page === item.page ? 'white' : '#888' }}>{item.label}</span>
                  </button>
                ))}
                {isAdmin && (
                  <>
                    <div style={{ color: '#333', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 12px', marginTop: '12px', marginBottom: '4px' }}>Admin</div>
                    <button onClick={() => { setPage('admin'); setMenuOuvert(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 12px', backgroundColor: 'transparent', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                      <span style={{ fontSize: '18px', color: '#555' }}>⚙</span>
                      <span style={{ fontSize: '15px', color: '#888' }}>Admin Panel</span>
                    </button>
                  </>
                )}
              </div>
              <div style={{ padding: '20px', borderTop: '1px solid #111' }}>
                <div style={{ color: '#444', fontSize: '12px', marginBottom: '12px' }}>{utilisateur?.email}</div>
                <button onClick={() => { handleDeconnexion(); setMenuOuvert(false); }} style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Sign out</button>
              </div>
            </div>
            <div onClick={() => setMenuOuvert(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          </div>
        )}

        {/* Ticker NHL */}
        {activeTab === 'analyses' && ligueAnalyses === 'nhl' && (
          <HockeyTicker onMatchsCharge={(nombre) => setNombreMatchs(nombre)} />
        )}

        {/* Contenu */}
        <div style={{ padding: '0' }}>
          {page === 'profile' ? (
            <ProfilePage utilisateur={utilisateur} onBack={() => setPage('home')} />
          ) : page === 'bets' ? (
            <Dashboard />
          ) : page === 'admin' ? (
            <AdminPage />
          ) : activeTab === 'home' ? (
            <HomeDashboard utilisateur={utilisateur} onGoToProps={() => setPage('props')} onGoToAnalytics={() => setPage('analyses')} onGoToBets={() => setPage('bets')} />
          ) : activeTab === 'analyses' ? (
            <Analyses onLigueChange={(l) => setLigueAnalyses(l)} />
          ) : activeTab === 'props' ? (
            <PropsPage />
          ) : null}
        </div>

        {/* Bottom Nav style Oura */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200 }}>
          <div style={{ margin: '0 16px 20px', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: '20px', border: '1px solid #1a1a1a', backdropFilter: 'blur(20px)', padding: '8px 0', display: 'flex', justifyContent: 'space-around', alignItems: 'center', boxShadow: '0 -4px 40px rgba(0,0,0,0.5)' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setPage(tab.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0' }}>
                <span style={{ fontSize: '20px', color: activeTab === tab.id ? '#f97316' : '#444', transition: 'color 0.2s' }}>{tab.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: activeTab === tab.id ? '600' : '400', color: activeTab === tab.id ? '#f97316' : '#444', letterSpacing: '0.3px', transition: 'color 0.2s' }}>{tab.label}</span>
                {activeTab === tab.id && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#f97316', marginTop: '1px' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // App non connectée — landing page avec navbar
  return (
    <div style={{ fontFamily: 'Arial', backgroundColor: '#0f0f0f', minHeight: '100vh', color: 'white' }}>

      {/* Navbar publique */}
      <div style={{ backgroundColor: 'rgba(10,10,10,0.95)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 100, overflowX: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <h1 onClick={() => setPage('home')} style={{ color: '#f97316', margin: 0, fontSize: '20px', cursor: 'pointer', fontWeight: '900', letterSpacing: '-0.5px' }}>Betrics</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span onClick={() => setPage('analyses')} style={{ cursor: 'pointer', color: page === 'analyses' ? '#f97316' : '#9ca3af', fontSize: '14px' }}>Analyses</span>
            <span onClick={() => setPage('pricing')} style={{ cursor: 'pointer', color: page === 'pricing' ? '#f97316' : '#9ca3af', fontSize: '14px' }}>Pricing</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setShowAuth(true)} style={{ backgroundColor: 'transparent', color: '#9ca3af', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Sign in</button>
          <button onClick={() => setShowAuth(true)} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Get started →</button>
        </div>
      </div>

      {page === 'analyses' && ligueAnalyses === 'nhl' && (
        <HockeyTicker onMatchsCharge={(nombre) => setNombreMatchs(nombre)} />
      )}

      {page === 'home' && <LandingPage onCommencer={() => setShowAuth(true)} onVoirPricing={() => setPage('pricing')} onVoirAnalyses={() => setPage('analyses')} nombreMatchs={nombreMatchs} />}
      {page === 'analyses' && <Analyses onLigueChange={(l) => setLigueAnalyses(l)} />}
      {page === 'pricing' && <Pricing onChoisirPlan={(plan) => console.log('Plan choisi:', plan)} />}
    </div>
  );
}
 
export default App;
 