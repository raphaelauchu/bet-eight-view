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
        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }}>Props du jour</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>Probabilités calculees L5/L10/L20</p>
      </div>
      <p style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>Charge depuis Analytics...</p>
    </div>
  );
}

function HomeDashboard({ utilisateur, onGoToProps, onGoToAnalytics }) {
  const { useState: useS, useEffect: useE } = require('react');
  return (
    <div style={{ padding: '24px', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ marginBottom: '28px' }}>
        <p style={{ margin: '0 0 2px', color: '#555', fontSize: '13px' }}>Bon retour,</p>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>{utilisateur?.email?.split('@')[0]}</h2>
      </div>

      {/* Bankroll card */}
      <div style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', borderRadius: '20px', padding: '24px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -10, width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>Bankroll</p>
        <h1 style={{ margin: '0 0 16px', fontSize: '42px', fontWeight: '900', color: 'white', letterSpacing: '-1px' }}>$1,000.00</h1>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div>
            <p style={{ margin: '0 0 2px', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>ROI</p>
            <p style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: '700' }}>+0.0%</p>
          </div>
          <div>
            <p style={{ margin: '0 0 2px', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Win Rate</p>
            <p style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: '700' }}>0%</p>
          </div>
          <div>
            <p style={{ margin: '0 0 2px', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Paris actifs</p>
            <p style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: '700' }}>0</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div onClick={onGoToProps} style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '20px', border: '1px solid #161616', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#161616'}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>◆</div>
          <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '14px', color: 'white' }}>Props du jour</p>
          <p style={{ margin: 0, color: '#555', fontSize: '12px' }}>Voir les meilleures cotes</p>
        </div>
        <div onClick={onGoToAnalytics} style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '20px', border: '1px solid #161616', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#161616'}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>◎</div>
          <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '14px', color: 'white' }}>Analytics</p>
          <p style={{ margin: 0, color: '#555', fontSize: '12px' }}>Stats joueurs et équipes</p>
        </div>
      </div>

      {/* Paris récents */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '20px', border: '1px solid #161616', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px' }}>Paris récents</h3>
          <span style={{ color: '#555', fontSize: '12px' }}>Voir tout →</span>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: '13px' }}>
          Aucun pari pour l'instant · Commence à tracker tes bets!
        </div>
      </div>

      {/* Kelly recommandé */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '20px', border: '1px solid #161616' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px', color: '#555', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kelly 5% — Mise recommandée</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#22c55e', letterSpacing: '-0.5px' }}>$50.00</p>
          </div>
          <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '12px', padding: '12px 16px', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p style={{ margin: 0, color: '#22c55e', fontSize: '11px', fontWeight: '600' }}>Par pari</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState(window.location.search.includes('admin=betrics2026') ? 'admin' : 'home');
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
    const activeTab = ['home', 'analyses', 'props'].includes(page) ? page : 'home';

    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: '#080808', minHeight: '100vh', color: 'white', paddingBottom: '80px' }}>

        {/* Top bar connecté */}
        <div style={{ backgroundColor: 'rgba(8,8,8,0.95)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
          <h1 style={{ color: '#f97316', margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '-0.5px' }}>Betrics</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && <span onClick={() => setPage('admin')} style={{ cursor: 'pointer', color: '#555', fontSize: '12px', border: '1px solid #222', borderRadius: '6px', padding: '2px 8px' }}>Admin</span>}
            <button onClick={handleDeconnexion} style={{ backgroundColor: 'transparent', color: '#555', border: '1px solid #222', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Ticker NHL */}
        {activeTab === 'analyses' && ligueAnalyses === 'nhl' && (
          <HockeyTicker onMatchsCharge={(nombre) => setNombreMatchs(nombre)} />
        )}

        {/* Contenu */}
        <div style={{ padding: '0' }}>
          {activeTab === 'home' && <HomeDashboard utilisateur={utilisateur} onGoToProps={() => setPage('props')} onGoToAnalytics={() => setPage('analyses')} />}
          {activeTab === 'analyses' && <Analyses onLigueChange={(l) => setLigueAnalyses(l)} />}
          {activeTab === 'props' && <PropsPage />}
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
          <button onClick={() => setShowAuth(true)} style={{ backgroundColor: 'transparent', color: '#9ca3af', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Se connecter</button>
          <button onClick={() => setShowAuth(true)} style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Commencer →</button>
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
 