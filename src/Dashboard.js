import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
 
const BET_TYPES = [
  { value: 'moneyline', label: 'Money Line' },
  { value: 'spread', label: 'Puck Line' },
  { value: 'total', label: 'Total Goals' },
  { value: 'prop', label: 'Player Prop' },
  { value: 'parlay', label: 'Parlay' },
];
 
function Dashboard() {
  const [paris, setParis] = useState([]);
  const [bankroll, setBankrollState] = useState(1000);
  const [nouveauPari, setNouveauPari] = useState({ match: '', mise: '', cote: '', bookmaker: 'Bet365', sport: 'hockey', type_pari: 'moneyline', selection: '', joueur: '', stat: 'SOG', ligne: '', overunder: 'over', handicap: '-1.5', total: '' });
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('actifs');
  const [montantBankroll, setMontantBankroll] = useState('');
  const [filtreGraphique, setFiltreGraphique] = useState('30d');
  const [filtrePeriode, setFiltrePeriode] = useState('all');
  const [filtreAnnee, setFiltreAnnee] = useState('all');
  const [filtreCustomDebut, setFiltreCustomDebut] = useState('');
  const [filtreCustomFin, setFiltreCustomFin] = useState('');
  const [filtreRecherche, setFiltreRecherche] = useState('');
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);
 
  useEffect(() => { chargerDonnees(); }, []);
 
  async function chargerDonnees() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: dataParis, error: errorParis } = await supabase.from('paris').select('*').eq('user_id', user.id).order('date_pari', { ascending: false });
      if (!errorParis) setParis(dataParis || []);
      const { data: dataBankroll } = await supabase.from('bankroll').select('*').eq('user_id', user.id).single();
      if (dataBankroll) { setBankrollState(dataBankroll.montant); }
      else { await supabase.from('bankroll').insert({ user_id: user.id, montant: 1000 }); setBankrollState(1000); }
    } catch (err) { console.error(err); }
    setChargement(false);
  }
 
  async function mettreAJourBankroll(nouveauMontant) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setBankrollState(nouveauMontant);
      await supabase.from('bankroll').update({ montant: nouveauMontant, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    } catch (err) { console.error(err); }
  }
 
  async function ajouterPari() {
    if (!nouveauPari.match || !nouveauPari.mise || !nouveauPari.cote) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('paris').insert({ user_id: user.id, match: nouveauPari.match, mise: parseFloat(nouveauPari.mise), cote: parseFloat(nouveauPari.cote), bookmaker: nouveauPari.bookmaker, sport: nouveauPari.sport, statut: 'actif', profit: 0, date_pari: new Date().toISOString(), type_pari: nouveauPari.type_pari, selection: nouveauPari.selection });
      if (!error) {
        await mettreAJourBankroll(bankroll - parseFloat(nouveauPari.mise));
        setNouveauPari({ match: '', mise: '', cote: '', bookmaker: 'Bet365', sport: 'hockey', type_pari: 'moneyline', selection: '', joueur: '', stat: 'SOG', ligne: '', overunder: 'over', handicap: '-1.5', total: '' });
        setAfficherFormulaire(false);
        chargerDonnees();
      }
    } catch (err) { console.error(err); }
  }
 
  async function mettreAJourStatut(id, statut, mise, cote) {
    try {
      const profit = statut === 'gagne' ? parseFloat((mise * cote - mise).toFixed(2)) : -parseFloat(mise);
      await supabase.from('paris').update({ statut, profit }).eq('id', id);
      if (statut === 'gagne') await mettreAJourBankroll(bankroll + parseFloat(mise) + parseFloat((mise * cote - mise).toFixed(2)));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }
 
  async function remettreEnActif(id, mise, statut, profit) {
    try {
      await supabase.from('paris').update({ statut: 'actif', profit: 0 }).eq('id', id);
      if (statut === 'gagne') await mettreAJourBankroll(bankroll - parseFloat(mise) - parseFloat(profit));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }
 
  async function supprimerPari(id, statut, mise) {
    try {
      await supabase.from('paris').delete().eq('id', id);
      if (statut === 'actif') await mettreAJourBankroll(bankroll + parseFloat(mise));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }
 
  function getDonneesGraphique() {
    const parisTraites = paris.filter(p => p.statut !== 'actif');
    const jours = filtreGraphique === '7d' ? 7 : filtreGraphique === '30d' ? 30 : 90;
    const dateDebut = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
    let profitCumulatif = 0;
    return parisTraites.filter(p => new Date(p.date_pari) >= dateDebut).sort((a, b) => new Date(a.date_pari) - new Date(b.date_pari)).map(p => {
      profitCumulatif += p.profit || 0;
      return { date: new Date(p.date_pari).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), profit: parseFloat(profitCumulatif.toFixed(2)) };
    });
  }
 
  const maintenant = new Date();
  const periodeJours = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 99999 };
  const parisActifs = paris.filter(p => p.statut === 'actif');
  const anneesDisponibles = [...new Set(paris.filter(p => p.statut !== 'actif' && p.date_pari).map(p => new Date(p.date_pari).getFullYear()))].sort((a,b) => b-a);

  const parisHistorique = paris.filter(p => {
    if (p.statut === 'actif') return false;
    if (!p.date_pari) return true;
    const datePari = new Date(p.date_pari);
    const diff = (maintenant - datePari) / (1000 * 60 * 60 * 24);

    // Filtre custom date
    if (filtreCustomDebut && filtreCustomFin) {
      const debut = new Date(filtreCustomDebut);
      const fin = new Date(filtreCustomFin);
      fin.setHours(23,59,59);
      if (datePari < debut || datePari > fin) return false;
    } else if (filtreAnnee !== 'all') {
      if (datePari.getFullYear() !== parseInt(filtreAnnee)) return false;
    } else if (filtrePeriode !== 'all') {
      if (diff > periodeJours[filtrePeriode]) return false;
    }

    // Filtre recherche
    if (filtreRecherche) {
      const q = filtreRecherche.toLowerCase();
      return (p.match || '').toLowerCase().includes(q) ||
             (p.selection || '').toLowerCase().includes(q) ||
             (p.bookmaker || '').toLowerCase().includes(q) ||
             (p.joueur || '').toLowerCase().includes(q);
    }
    return true;
  });
  const parisTraites = paris.filter(p => p.statut !== 'actif');
  const profitTotal = parisTraites.reduce((acc, p) => acc + (p.profit || 0), 0);
  const parisGagnes = parisTraites.filter(p => p.statut === 'gagne').length;
  const winRate = parisTraites.length > 0 ? Math.round((parisGagnes / parisTraites.length) * 100) : 0;
  const miseTotale = parisTraites.reduce((acc, p) => acc + (p.mise || 0), 0);
  const roi = miseTotale > 0 ? ((profitTotal / miseTotale) * 100).toFixed(1) : '0.0';
  const donneesGraphique = getDonneesGraphique();
 
  const inp = { width: '100%', padding: '10px 12px', backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
 
  if (chargement) return <div style={{ padding: '80px', textAlign: 'center', color: '#555' }}>Loading...</div>;
 
  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>My Bets</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>Track and manage your wagers</p>
      </div>
 

 
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
        {[{ id: 'actifs', label: `Active (${parisActifs.length})` }, { id: 'traites', label: `History (${parisTraites.length})` }].map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: onglet === t.id ? '#f97316' : 'transparent', color: onglet === t.id ? 'white' : '#555', fontSize: '13px', fontWeight: onglet === t.id ? '600' : 'normal' }}>{t.label}</button>
        ))}
      </div>
 
      {onglet === 'actifs' && (
        <button onClick={() => setAfficherFormulaire(!afficherFormulaire)} style={{ marginBottom: '16px', padding: '10px 20px', background: afficherFormulaire ? 'transparent' : 'linear-gradient(135deg, #f97316, #ea580c)', color: afficherFormulaire ? '#555' : 'white', border: afficherFormulaire ? '1px solid #333' : 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          {afficherFormulaire ? 'Cancel' : '+ New Bet'}
        </button>
      )}
 
      {afficherFormulaire && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #1a1a1a' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>New Bet</div>

          {/* Bet Type selector - toujours visible */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#555', fontSize: '12px', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Bet Type</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {BET_TYPES.map(t => (
                <button key={t.value} onClick={() => setNouveauPari({ ...nouveauPari, type_pari: t.value, selection: '', match: '' })}
                  style={{ padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: nouveauPari.type_pari === t.value ? '#f97316' : '#1a1a1a', color: nouveauPari.type_pari === t.value ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Champs dynamiques selon le type */}
          {nouveauPari.type_pari === 'moneyline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Match</div>
                <input style={inp} placeholder="e.g. MTL vs TOR" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
              </div>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Team to win</div>
                <input style={inp} placeholder="e.g. Canadiens" value={nouveauPari.selection} onChange={e => setNouveauPari({ ...nouveauPari, selection: e.target.value })} />
              </div>
            </div>
          )}

          {nouveauPari.type_pari === 'spread' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Match</div>
                <input style={inp} placeholder="e.g. MTL vs TOR" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Team</div>
                  <input style={inp} placeholder="e.g. Canadiens" value={nouveauPari.selection} onChange={e => setNouveauPari({ ...nouveauPari, selection: e.target.value })} />
                </div>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Puck Line</div>
                  <select style={inp} value={nouveauPari.handicap || '-1.5'} onChange={e => setNouveauPari({ ...nouveauPari, handicap: e.target.value })}>
                    <option value="-1.5">-1.5</option>
                    <option value="+1.5">+1.5</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {nouveauPari.type_pari === 'total' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Match</div>
                <input style={inp} placeholder="e.g. MTL vs TOR" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Over / Under</div>
                  <select style={inp} value={nouveauPari.overunder || 'over'} onChange={e => setNouveauPari({ ...nouveauPari, overunder: e.target.value })}>
                    <option value="over">Over</option>
                    <option value="under">Under</option>
                  </select>
                </div>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Total Goals</div>
                  <input style={inp} type="number" step="0.5" placeholder="5.5" value={nouveauPari.total || ''} onChange={e => setNouveauPari({ ...nouveauPari, total: e.target.value, selection: (nouveauPari.overunder || 'Over') + ' ' + e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {nouveauPari.type_pari === 'prop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Match</div>
                <input style={inp} placeholder="e.g. MTL vs TOR" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
              </div>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Player</div>
                <input style={inp} placeholder="e.g. Cole Caufield" value={nouveauPari.joueur || ''} onChange={e => setNouveauPari({ ...nouveauPari, joueur: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Stat</div>
                  <select style={inp} value={nouveauPari.stat || 'SOG'} onChange={e => setNouveauPari({ ...nouveauPari, stat: e.target.value })}>
                    {['SOG', 'Goals', 'Assists', 'Points'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Line</div>
                  <input style={inp} type="number" step="0.5" placeholder="2.5" value={nouveauPari.ligne || ''} onChange={e => setNouveauPari({ ...nouveauPari, ligne: e.target.value })} />
                </div>
                <div>
                  <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Over/Under</div>
                  <select style={inp} value={nouveauPari.overunder || 'over'} onChange={e => setNouveauPari({ ...nouveauPari, overunder: e.target.value })}>
                    <option value="over">Over</option>
                    <option value="under">Under</option>
                  </select>
                </div>
              </div>
              <div style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: '8px', padding: '8px 12px' }}>
                <span style={{ color: '#f97316', fontSize: '12px', fontWeight: '600' }}>
                  {nouveauPari.joueur || 'Player'} — {nouveauPari.overunder === 'under' ? 'Under' : 'Over'} {nouveauPari.ligne || '?'} {nouveauPari.stat || 'SOG'}
                </span>
              </div>
            </div>
          )}

          {nouveauPari.type_pari === 'parlay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Parlay Description</div>
                <input style={inp} placeholder="e.g. MTL ML + EDM -1.5 + Over 6.5" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
              </div>
              <div>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Selections</div>
                <input style={inp} placeholder="e.g. 3-leg parlay" value={nouveauPari.selection} onChange={e => setNouveauPari({ ...nouveauPari, selection: e.target.value })} />
              </div>
            </div>
          )}

          {/* Mise, Cote, Bookmaker - toujours visible */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Stake ($)</div>
              <input style={inp} type="number" placeholder="50" value={nouveauPari.mise} onChange={e => setNouveauPari({ ...nouveauPari, mise: e.target.value })} />
            </div>
            <div>
              <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Odds</div>
              <input style={inp} type="number" step="0.01" placeholder="1.85" value={nouveauPari.cote} onChange={e => setNouveauPari({ ...nouveauPari, cote: e.target.value })} />
            </div>
            <div>
              <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Bookmaker</div>
              <select style={inp} value={nouveauPari.bookmaker} onChange={e => setNouveauPari({ ...nouveauPari, bookmaker: e.target.value })}>
                {['Bet365', 'Bet99', 'Betway', 'Mise-o-jeu', 'DraftKings'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {nouveauPari.mise && nouveauPari.cote && (
            <div style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#22c55e' }}>
              Potential profit: +${(parseFloat(nouveauPari.mise) * parseFloat(nouveauPari.cote) - parseFloat(nouveauPari.mise)).toFixed(2)}
            </div>
          )}
          <button onClick={ajouterPari} style={{ padding: '11px 24px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Confirm Bet</button>
        </div>
      )}
 
      {onglet === 'actifs' && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>Active Bets</div>
          {parisActifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '14px' }}>No active bets · Click "+ New Bet" to start</div>
          ) : parisActifs.map((pari, i) => (
            <div key={pari.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #111', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.3px' }}>{pari.match}</div>
                <div style={{ color: '#f97316', fontSize: '12px', fontWeight: '500', marginBottom: '2px' }}>{BET_TYPES.find(t => t.value === pari.type_pari)?.label || pari.type_pari}</div>
                {pari.selection && <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>→ {pari.selection}</div>}
                <div style={{ color: '#444', fontSize: '12px' }}>{pari.bookmaker} · Odds {pari.cote} · Stake ${pari.mise}</div>
                <div style={{ color: '#22c55e', fontSize: '12px', marginTop: '3px' }}>Potential: +${(pari.mise * pari.cote - pari.mise).toFixed(2)}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => mettreAJourStatut(pari.id, 'gagne', pari.mise, pari.cote)} style={{ padding: '7px 14px', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Won</button>
                <button onClick={() => mettreAJourStatut(pari.id, 'perdu', pari.mise, pari.cote)} style={{ padding: '7px 14px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Lost</button>
                <button onClick={() => supprimerPari(pari.id, pari.statut, pari.mise)} style={{ padding: '7px 14px', backgroundColor: 'transparent', color: '#444', border: '1px solid #1a1a1a', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
 
      {onglet === 'traites' && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['all', 'All']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltrePeriode(val)}
              style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: filtrePeriode === val ? '#f97316' : '#0d0d0d', color: filtrePeriode === val ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {onglet === 'traites' && showFiltresAvances && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '16px', border: '1px solid #1a1a1a', marginBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Recherche */}
            <div>
              <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Search</div>
              <input value={filtreRecherche} onChange={e => setFiltreRecherche(e.target.value)}
                placeholder="Match, player, bookmaker..."
                style={{ width: '100%', padding: '9px 12px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = '#f97316'}
                onBlur={e => e.target.style.borderColor = '#222'} />
            </div>
            {/* Filtre par année */}
            {anneesDisponibles.length > 0 && (
              <div>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>By Year</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => { setFiltreAnnee('all'); setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
                    style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: filtreAnnee === 'all' ? '#f97316' : '#1a1a1a', color: filtreAnnee === 'all' ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>All years</button>
                  {anneesDisponibles.map(yr => (
                    <button key={yr} onClick={() => { setFiltreAnnee(String(yr)); setFiltrePeriode('all'); setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
                      style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: filtreAnnee === String(yr) ? '#f97316' : '#1a1a1a', color: filtreAnnee === String(yr) ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Filtre custom date */}
            <div>
              <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Custom Range</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="date" value={filtreCustomDebut} onChange={e => { setFiltreCustomDebut(e.target.value); setFiltrePeriode('all'); setFiltreAnnee('all'); }}
                  style={{ flex: 1, padding: '9px 12px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <span style={{ color: '#444' }}>→</span>
                <input type="date" value={filtreCustomFin} onChange={e => { setFiltreCustomFin(e.target.value); setFiltrePeriode('all'); setFiltreAnnee('all'); }}
                  style={{ flex: 1, padding: '9px 12px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                {(filtreCustomDebut || filtreCustomFin) && (
                  <button onClick={() => { setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
                    style={{ padding: '9px 12px', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '10px', color: '#555', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                )}
              </div>
            </div>
            {/* Stats de la période */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '12px', display: 'flex', gap: '16px' }}>
              <div><span style={{ color: '#444', fontSize: '11px' }}>Results </span><span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{parisHistorique.length} bets</span></div>
              <div><span style={{ color: '#444', fontSize: '11px' }}>Profit </span><span style={{ color: parisHistorique.reduce((a,p) => a+(p.profit||0),0) >= 0 ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '700' }}>{parisHistorique.reduce((a,p) => a+(p.profit||0),0) >= 0 ? '+' : ''}${parisHistorique.reduce((a,p) => a+(p.profit||0),0).toFixed(2)}</span></div>
              <div><span style={{ color: '#444', fontSize: '11px' }}>Win Rate </span><span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{parisHistorique.length > 0 ? Math.round(parisHistorique.filter(p=>p.statut==='gagne').length/parisHistorique.length*100) : 0}%</span></div>
            </div>
          </div>
        </div>
      )}
      {onglet === 'traites' && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>Bet History</div>
          {parisHistorique.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '14px' }}>No settled bets yet</div>
          ) : parisHistorique.map((pari, i) => (
            <div key={pari.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #111', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.3px' }}>{pari.match}</div>
                {pari.selection && <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>→ {pari.selection}</div>}
                <div style={{ color: '#444', fontSize: '12px' }}>{pari.bookmaker} · Odds {pari.cote} · ${pari.mise}</div>
                <div style={{ color: '#333', fontSize: '11px', marginTop: '3px' }}>{new Date(pari.date_pari).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: pari.statut === 'gagne' ? '#22c55e' : '#ef4444', letterSpacing: '-0.5px' }}>
                  {pari.statut === 'gagne' ? `+$${parseFloat(pari.profit).toFixed(2)}` : `-$${parseFloat(pari.mise).toFixed(2)}`}
                </div>
                <div style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: pari.statut === 'gagne' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: pari.statut === 'gagne' ? '#22c55e' : '#ef4444', border: `1px solid ${pari.statut === 'gagne' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {pari.statut === 'gagne' ? 'Won' : 'Lost'}
                </div>
                <button onClick={() => remettreEnActif(pari.id, pari.mise, pari.statut, pari.profit)} style={{ padding: '5px 10px', backgroundColor: 'transparent', color: '#333', border: '1px solid #1a1a1a', borderRadius: '7px', cursor: 'pointer', fontSize: '11px' }}>Undo</button>
              </div>
            </div>
          ))}
        </div>
      )}
 
      {onglet === 'bankroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>Bankroll Management</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#111', borderRadius: '10px', padding: '20px' }}>
                <div style={{ color: '#555', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Current Bankroll</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#f97316', letterSpacing: '-1px', marginBottom: '16px' }}>${bankroll.toFixed(2)}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" placeholder="Amount" style={{ ...inp, flex: 1 }} value={montantBankroll} onChange={e => setMontantBankroll(e.target.value)} />
                  <button onClick={async () => { const m = parseFloat(montantBankroll); if (m > 0) { await mettreAJourBankroll(bankroll + m); setMontantBankroll(''); } }} style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Deposit</button>
                  <button onClick={async () => { const m = parseFloat(montantBankroll); if (m > 0) { await mettreAJourBankroll(bankroll - m); setMontantBankroll(''); } }} style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Withdraw</button>
                </div>
              </div>
              <div style={{ backgroundColor: '#111', borderRadius: '10px', padding: '20px' }}>
                <div style={{ color: '#555', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Kelly (5%) Rec. Stake</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#22c55e', letterSpacing: '-1px', marginBottom: '8px' }}>${(bankroll * 0.05).toFixed(2)}</div>
                <div style={{ color: '#333', fontSize: '12px', lineHeight: '1.6' }}>Never bet more than 5% of your bankroll per bet for healthy risk management.</div>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', letterSpacing: '-0.3px' }}>Financial Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Total Staked', value: `$${miseTotale.toFixed(2)}`, color: 'white' },
                { label: 'Net Profit', value: `${profitTotal >= 0 ? '+' : ''}$${profitTotal.toFixed(2)}`, color: profitTotal >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'ROI', value: `${roi}%`, color: parseFloat(roi) >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'Bets Won', value: `${parisGagnes}/${parisTraites.length}`, color: 'white' },
              ].map((s, i) => (
                <div key={i} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: '#444', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 
export default Dashboard;