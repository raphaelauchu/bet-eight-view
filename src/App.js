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
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }}>Today's Props</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>Probabilities calculated L5/L10/L20</p>
      </div>
      <p style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>Loading from Analytics...</p>
    </div>
  );
}

function HomeDashboard({ utilisateur, onGoToProps, onGoToAnalytics }) {
  return (
    <div style={{ padding: '20px 20px 0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '600px', margin: '0 auto' }}>

      {/* Greeting */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ margin: '0 0 2px', color: '#444', fontSize: '13px' }}>Welcome back</p>
        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.8px', color: 'white' }}>{utilisateur?.email?.split('@')[0]}</h2>
      </div>

      {/* Bankroll card */}
      <div style={{ position: 'relative', borderRadius: '24px', padding: '24px', marginBottom: '16px', overflow: 'hidden', background: 'linear-gradient(135deg, #1a1a1a 0%, #111 100%)', border: '1px solid #222' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <p style={{ margin: 0, color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Bankroll</p>
          <div style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '20px', padding: '3px 10px' }}>
            <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600' }}>● Live</span>
          </div>
        </div>
        <h1 style={{ margin: '6px 0 20px', fontSize: '44px', fontWeight: '900', color: 'white', letterSpacing: '-2px', lineHeight: 1 }}>$1,000<span style={{ fontSize: '24px', color: '#555' }}>.00</span></h1>
        <div style={{ display: 'flex', gap: '0', borderTop: '1px solid #1f1f1f', paddingTop: '16px' }}>
          {[['ROI', '+0.0%', '#22c55e'], ['Win Rate', '0%', 'white'], ['Active', '0 bets', '#f97316']].map(([label, val, color], i) => (
            <div key={i} style={{ flex: 1, borderRight: i < 2 ? '1px solid #1f1f1f' : 'none', paddingRight: i < 2 ? '16px' : '0', paddingLeft: i > 0 ? '16px' : '0' }}>
              <p style={{ margin: '0 0 3px', color: '#444', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color }}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <div onClick={onGoToProps} style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid #161616', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; e.currentTarget.style.backgroundColor = '#111'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#161616'; e.currentTarget.style.backgroundColor = '#0d0d0d'; }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px', color: '#f97316' }}>◆</span>
          </div>
          <p style={{ margin: '0 0 3px', fontWeight: '700', fontSize: '14px', color: 'white', letterSpacing: '-0.3px' }}>Today's Props</p>
          <p style={{ margin: 0, color: '#444', fontSize: '12px' }}>Best odds today</p>
        </div>
        <div onClick={onGoToAnalytics} style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid #161616', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; e.currentTarget.style.backgroundColor = '#111'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#161616'; e.currentTarget.style.backgroundColor = '#0d0d0d'; }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px', color: '#f97316' }}>◎</span>
          </div>
          <p style={{ margin: '0 0 3px', fontWeight: '700', fontSize: '14px', color: 'white', letterSpacing: '-0.3px' }}>Analytics</p>
          <p style={{ margin: 0, color: '#444', fontSize: '12px' }}>Player & team stats</p>
        </div>
      </div>

      {/* Recent Bets */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid #161616', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>Recent Bets</h3>
          <span style={{ color: '#f97316', fontSize: '12px', cursor: 'pointer' }}>See all →</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '8px' }}>
          <span style={{ fontSize: '28px' }}>🏒</span>
          <p style={{ margin: 0, color: '#333', fontSize: '13px', textAlign: 'center' }}>No bets yet</p>
          <p style={{ margin: 0, color: '#222', fontSize: '12px' }}>Start tracking from the Bets menu</p>
        </div>
      </div>

      {/* Kelly card */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '18px', padding: '18px', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', color: '#444', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Kelly 5% · Recommended Stake</p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#22c55e', letterSpacing: '-1px' }}>$50<span style={{ fontSize: '18px', color: '#1a6b3c' }}>.00</span></p>
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
                  { icon: '◐', label: 'Bets & Bankroll', page: 'bets' },
                  { icon: '⌂', label: 'Home', page: 'home' },
                  { icon: '◎', label: 'Analytics', page: 'analyses' },
                  { icon: '◆', label: 'Props', page: 'props' },
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
          {activeTab === 'home' && <HomeDashboard utilisateur={utilisateur} onGoToProps={() => setPage('props')} onGoToAnalytics={() => setPage('analyses')} />}
          {activeTab === 'analyses' && <Analyses onLigueChange={(l) => setLigueAnalyses(l)} />}
          {activeTab === 'props' && <PropsPage />}
          {page === 'bets' && <Dashboard />}
          {page === 'admin' && <AdminPage />}
          {page === 'admin' && <AdminPage />}
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
 