import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
 
const BET_TYPES = [
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'differentiel', label: 'Spread' },
  { value: 'total_buts', label: 'Over/Under' },
  { value: 'but_joueur', label: 'Player Prop' },
  { value: 'periode', label: 'Period Result' },
  { value: 'parlay', label: 'Parlay' },
];
 
function Dashboard() {
  const [paris, setParis] = useState([]);
  const [bankroll, setBankrollState] = useState(1000);
  const [nouveauPari, setNouveauPari] = useState({ match: '', mise: '', cote: '', bookmaker: 'Bet365', sport: 'hockey', type_pari: 'moneyline', selection: '' });
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('actifs');
  const [montantBankroll, setMontantBankroll] = useState('');
  const [filtreGraphique, setFiltreGraphique] = useState('30d');
 
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
        setNouveauPari({ match: '', mise: '', cote: '', bookmaker: 'Bet365', sport: 'hockey', type_pari: 'moneyline', selection: '' });
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
 
  const parisActifs = paris.filter(p => p.statut === 'actif');
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
        <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>Dashboard</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>Track your bets and manage your bankroll</p>
      </div>
 
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Bankroll', value: `$${bankroll.toFixed(2)}`, color: '#f97316' },
          { label: 'Net Profit', value: `${profitTotal >= 0 ? '+' : ''}$${profitTotal.toFixed(2)}`, color: profitTotal >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'ROI', value: `${roi}%`, color: parseFloat(roi) >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Win Rate', value: `${winRate}%`, sub: `${parisGagnes}/${parisTraites.length} bets`, color: winRate >= 50 ? '#22c55e' : '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '20px', border: '1px solid #161616' }}>
            <div style={{ color: '#555', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
            {s.sub && <div style={{ color: '#444', fontSize: '12px', marginTop: '4px' }}>{s.sub}</div>}
          </div>
        ))}
      </div>
 
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', marginBottom: '24px', border: '1px solid #161616' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.3px' }}>Profit Curve</div>
            <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>Cumulative performance</div>
          </div>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#111', borderRadius: '8px', padding: '3px' }}>
            {['7d', '30d', '90d'].map(f => (
              <button key={f} onClick={() => setFiltreGraphique(f)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: filtreGraphique === f ? '#f97316' : 'transparent', color: filtreGraphique === f ? 'white' : '#555', fontSize: '12px', fontWeight: filtreGraphique === f ? 'bold' : 'normal' }}>{f}</button>
            ))}
          </div>
        </div>
        {donneesGraphique.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '14px' }}>No settled bets for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={donneesGraphique}>
              <XAxis dataKey="date" stroke="#222" fontSize={11} tick={{ fill: '#444' }} axisLine={false} tickLine={false} />
              <YAxis stroke="#222" fontSize={11} tick={{ fill: '#444' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', fontSize: '13px' }} labelStyle={{ color: '#888' }} formatter={(v) => [`$${v}`, 'Profit']} />
              <Line type="monotone" dataKey="profit" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
 
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
        {[{ id: 'actifs', label: `Active (${parisActifs.length})` }, { id: 'traites', label: `History (${parisTraites.length})` }, { id: 'bankroll', label: 'Bankroll' }].map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: onglet === t.id ? '#f97316' : 'transparent', color: onglet === t.id ? 'white' : '#555', fontSize: '13px', fontWeight: onglet === t.id ? '600' : 'normal' }}>{t.label}</button>
        ))}
      </div>
 
      {onglet === 'actifs' && (
        <button onClick={() => setAfficherFormulaire(!afficherFormulaire)} style={{ marginBottom: '16px', padding: '10px 20px', background: afficherFormulaire ? 'transparent' : 'linear-gradient(135deg, #f97316, #ea580c)', color: afficherFormulaire ? '#555' : 'white', border: afficherFormulaire ? '1px solid #333' : 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          {afficherFormulaire ? 'Cancel' : '+ New Bet'}
        </button>
      )}
 
      {afficherFormulaire && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', marginBottom: '20px', border: '1px solid #1a1a1a' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>New Bet</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Match</div>
              <input style={inp} placeholder="e.g. MTL vs TOR" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
            </div>
            <div>
              <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Bet Type</div>
              <select style={inp} value={nouveauPari.type_pari} onChange={e => setNouveauPari({ ...nouveauPari, type_pari: e.target.value })}>
                {BET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#555', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Selection</div>
            <input style={inp} placeholder="e.g. Canadiens win" value={nouveauPari.selection} onChange={e => setNouveauPari({ ...nouveauPari, selection: e.target.value })} />
          </div>
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
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>Bet History</div>
          {parisTraites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '14px' }}>No settled bets yet</div>
          ) : parisTraites.map((pari, i) => (
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