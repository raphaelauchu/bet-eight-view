import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function StatCard({ title, value, change, positive }) {
  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '12px', flex: 1 }}>
      <p style={{ color: '#888', margin: '0 0 8px', fontSize: '14px' }}>{title}</p>
      <h3 style={{ margin: '0 0 8px', fontSize: '28px' }}>{value}</h3>
      {change && <p style={{ margin: 0, color: positive ? '#22c55e' : '#ef4444', fontSize: '14px' }}>{change}</p>}
    </div>
  );
}

function Dashboard() {
  const [paris, setParis] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [nouveauPari, setNouveauPari] = useState({
    match: '', mise: '', cote: '', bookmaker: 'Bet365', sport: 'hockey'
  });
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('actifs');
  const [montantBankroll, setMontantBankroll] = useState('');
  const [filtreGraphique, setFiltreGraphique] = useState('30j');

  useEffect(() => {
    chargerParis();
  }, []);

  async function chargerParis() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('paris')
        .select('*')
        .eq('user_id', user.id)
        .order('date_pari', { ascending: false });
      if (!error) setParis(data || []);
    } catch (err) {
      console.error('Erreur chargement:', err);
    }
    setChargement(false);
  }

  async function ajouterPari() {
    if (!nouveauPari.match || !nouveauPari.mise || !nouveauPari.cote) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('paris').insert({
        user_id: user.id,
        match: nouveauPari.match,
        mise: parseFloat(nouveauPari.mise),
        cote: parseFloat(nouveauPari.cote),
        bookmaker: nouveauPari.bookmaker,
        sport: nouveauPari.sport,
        statut: 'actif',
        profit: 0,
        date_pari: new Date().toISOString(),
      });
      if (!error) {
        setBankroll(prev => prev - parseFloat(nouveauPari.mise));
        setNouveauPari({ match: '', mise: '', cote: '', bookmaker: 'Bet365', sport: 'hockey' });
        setAfficherFormulaire(false);
        chargerParis();
      } else {
        alert('Erreur: ' + error.message);
      }
    } catch (err) {
      console.error('Erreur ajout:', err);
    }
  }

  async function mettreAJourStatut(id, statut, mise, cote) {
    try {
      const profit = statut === 'gagne'
        ? parseFloat((mise * cote - mise).toFixed(2))
        : -parseFloat(mise);
      const { error } = await supabase
        .from('paris')
        .update({ statut, profit })
        .eq('id', id);
      if (error) { alert('Erreur: ' + error.message); return; }
      if (statut === 'gagne') {
        setBankroll(prev => prev + parseFloat(mise) + parseFloat((mise * cote - mise).toFixed(2)));
      }
      chargerParis();
    } catch (err) {
      console.error('Erreur update:', err);
    }
  }

  async function remettreEnActif(id, mise, statut, profit) {
    try {
      const { error } = await supabase
        .from('paris')
        .update({ statut: 'actif', profit: 0 })
        .eq('id', id);
      if (error) { alert('Erreur: ' + error.message); return; }
      if (statut === 'gagne') {
        setBankroll(prev => prev - parseFloat(mise) - parseFloat(profit));
      }
      chargerParis();
    } catch (err) {
      console.error('Erreur remise en actif:', err);
    }
  }

  async function supprimerPari(id, statut, mise) {
    try {
      const { error } = await supabase.from('paris').delete().eq('id', id);
      if (error) { alert('Erreur suppression: ' + error.message); return; }
      if (statut === 'actif') {
        setBankroll(prev => prev + parseFloat(mise));
      }
      chargerParis();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }

  // Calcul des données pour le graphique
  function getDonneesGraphique() {
    const parisTraites = paris.filter(p => p.statut !== 'actif');
    const maintenant = new Date();
    const joursFiltre = filtreGraphique === '7j' ? 7 : filtreGraphique === '30j' ? 30 : 90;
    const dateDebut = new Date(maintenant - joursFiltre * 24 * 60 * 60 * 1000);

    const parisFiltres = parisTraites
      .filter(p => new Date(p.date_pari) >= dateDebut)
      .sort((a, b) => new Date(a.date_pari) - new Date(b.date_pari));

    let profitCumulatif = 0;
    return parisFiltres.map(p => {
      profitCumulatif += p.profit || 0;
      return {
        date: new Date(p.date_pari).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' }),
        profit: parseFloat(profitCumulatif.toFixed(2)),
        match: p.match,
      };
    });
  }

  const parisActifs = paris.filter(p => p.statut === 'actif');
  const parisTraites = paris.filter(p => p.statut !== 'actif');
  const profitTotal = parisTraites.reduce((acc, p) => acc + (p.profit || 0), 0);
  const parisGagnes = parisTraites.filter(p => p.statut === 'gagne').length;
  const winRate = parisTraites.length > 0 ? Math.round((parisGagnes / parisTraites.length) * 100) : 0;
  const miseTotale = parisTraites.reduce((acc, p) => acc + (p.mise || 0), 0);
  const roi = miseTotale > 0 ? ((profitTotal / miseTotale) * 100).toFixed(1) : 0;
  const donneesGraphique = getDonneesGraphique();

  const inputStyle = {
    width: '100%', padding: '10px', backgroundColor: '#252525',
    border: '1px solid #333', borderRadius: '8px', color: 'white',
    fontSize: '14px', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '32px' }}>
      <h2 style={{ marginBottom: '24px' }}>Mon Dashboard</h2>

      {/* Stats rapides */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <StatCard title="Bankroll" value={`$${bankroll.toFixed(2)}`} />
        <StatCard title="Profit net" value={`${profitTotal >= 0 ? '+' : ''}$${profitTotal.toFixed(2)}`} positive={profitTotal >= 0} />
        <StatCard title="ROI" value={`${roi}%`} positive={parseFloat(roi) >= 0} />
        <StatCard title="Win rate" value={`${winRate}%`} change={`${parisGagnes}/${parisTraites.length} paris`} positive={winRate >= 50} />
      </div>

      {/* Courbe de profit */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>📈 Courbe de profit</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['7j', '30j', '90j'].map(f => (
              <button key={f} onClick={() => setFiltreGraphique(f)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: filtreGraphique === f ? '#6366f1' : '#252525', color: 'white', fontSize: '13px' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {donneesGraphique.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Aucun pari traité pour cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={donneesGraphique}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#888' }}
                formatter={(value) => [`$${value}`, 'Profit cumulatif']}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => setOnglet('actifs')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: onglet === 'actifs' ? '#6366f1' : '#1a1a1a', color: 'white', fontSize: '14px' }}>
          🎯 Paris actifs ({parisActifs.length})
        </button>
        <button onClick={() => setOnglet('traites')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: onglet === 'traites' ? '#6366f1' : '#1a1a1a', color: 'white', fontSize: '14px' }}>
          📋 Historique ({parisTraites.length})
        </button>
        <button onClick={() => setOnglet('bankroll')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: onglet === 'bankroll' ? '#6366f1' : '#1a1a1a', color: 'white', fontSize: '14px' }}>
          💰 Bankroll
        </button>
      </div>

      {/* Bouton ajouter pari */}
      {onglet === 'actifs' && (
        <button onClick={() => setAfficherFormulaire(!afficherFormulaire)} style={{ marginBottom: '16px', padding: '12px 24px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
          + Ajouter un pari
        </button>
      )}

      {/* Formulaire nouveau pari */}
      {afficherFormulaire && (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Nouveau pari</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Match</label>
              <input style={inputStyle} placeholder="ex: MTL vs TOR" value={nouveauPari.match} onChange={e => setNouveauPari({ ...nouveauPari, match: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Mise ($)</label>
              <input style={inputStyle} type="number" placeholder="50" value={nouveauPari.mise} onChange={e => setNouveauPari({ ...nouveauPari, mise: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Cote</label>
              <input style={inputStyle} type="number" step="0.01" placeholder="1.85" value={nouveauPari.cote} onChange={e => setNouveauPari({ ...nouveauPari, cote: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Bookmaker</label>
              <select style={inputStyle} value={nouveauPari.bookmaker} onChange={e => setNouveauPari({ ...nouveauPari, bookmaker: e.target.value })}>
                <option>Bet365</option>
                <option>Bet99</option>
                <option>Betway</option>
                <option>Mise-o-jeu</option>
                <option>DraftKings</option>
              </select>
            </div>
          </div>
          {nouveauPari.mise && nouveauPari.cote && (
            <p style={{ color: '#22c55e', margin: '12px 0 0', fontSize: '14px' }}>
              Profit potentiel: +${(parseFloat(nouveauPari.mise) * parseFloat(nouveauPari.cote) - parseFloat(nouveauPari.mise)).toFixed(2)}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button onClick={ajouterPari} style={{ padding: '10px 24px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Confirmer le pari
            </button>
            <button onClick={() => setAfficherFormulaire(false)} style={{ padding: '10px 24px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Paris actifs */}
      {onglet === 'actifs' && (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Paris en cours</h3>
          {chargement ? <p style={{ color: '#888' }}>Chargement...</p> :
           parisActifs.length === 0 ? <p style={{ color: '#888' }}>Aucun pari actif. Clique sur "+ Ajouter un pari" pour commencer!</p> :
           parisActifs.map((pari, i) => (
            <div key={pari.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #333', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>{pari.match}</p>
                <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{pari.bookmaker} · Cote {pari.cote} · Mise ${pari.mise}</p>
                <p style={{ margin: '4px 0 0', color: '#22c55e', fontSize: '13px' }}>Profit potentiel: +${(pari.mise * pari.cote - pari.mise).toFixed(2)}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => mettreAJourStatut(pari.id, 'gagne', pari.mise, pari.cote)} style={{ padding: '8px 16px', backgroundColor: '#14532d', color: '#22c55e', border: '1px solid #22c55e', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  ✓ Gagné
                </button>
                <button onClick={() => mettreAJourStatut(pari.id, 'perdu', pari.mise, pari.cote)} style={{ padding: '8px 16px', backgroundColor: '#7f1d1d', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  ✗ Perdu
                </button>
                <button onClick={() => supprimerPari(pari.id, pari.statut, pari.mise)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historique */}
      {onglet === 'traites' && (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Historique des paris</h3>
          {parisTraites.length === 0 ? <p style={{ color: '#888' }}>Aucun pari traité pour l'instant.</p> :
           parisTraites.map((pari, i) => (
            <div key={pari.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #333', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>{pari.match}</p>
                <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{pari.bookmaker} · Cote {pari.cote} · Mise ${pari.mise}</p>
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '12px' }}>{new Date(pari.date_pari).toLocaleDateString('fr-CA')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: pari.statut === 'gagne' ? '#22c55e' : '#ef4444', fontWeight: 'bold', fontSize: '18px' }}>
                  {pari.statut === 'gagne' ? `+$${parseFloat(pari.profit).toFixed(2)}` : `-$${parseFloat(pari.mise).toFixed(2)}`}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', backgroundColor: pari.statut === 'gagne' ? '#14532d' : '#7f1d1d', color: pari.statut === 'gagne' ? '#22c55e' : '#ef4444' }}>
                  {pari.statut === 'gagne' ? '✓ Gagné' : '✗ Perdu'}
                </span>
                <button onClick={() => remettreEnActif(pari.id, pari.mise, pari.statut, pari.profit)} style={{ padding: '6px 12px', backgroundColor: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  ↩ Annuler
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bankroll */}
      {onglet === 'bankroll' && (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Gestion de la bankroll</h3>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ backgroundColor: '#252525', borderRadius: '8px', padding: '20px', flex: 1 }}>
              <p style={{ color: '#888', margin: '0 0 8px', fontSize: '14px' }}>Bankroll actuelle</p>
              <h2 style={{ margin: '0 0 16px', color: '#a5b4fc' }}>${bankroll.toFixed(2)}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="Montant"
                  style={{ ...inputStyle, flex: 1 }}
                  value={montantBankroll}
                  onChange={e => setMontantBankroll(e.target.value)}
                />
                <button onClick={() => {
                  const montant = parseFloat(montantBankroll);
                  if (montant > 0) { setBankroll(prev => prev + montant); setMontantBankroll(''); }
                }} style={{ padding: '10px 16px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Dépôt
                </button>
                <button onClick={() => {
                  const montant = parseFloat(montantBankroll);
                  if (montant > 0) { setBankroll(prev => prev - montant); setMontantBankroll(''); }
                }} style={{ padding: '10px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Retrait
                </button>
              </div>
            </div>
            <div style={{ backgroundColor: '#252525', borderRadius: '8px', padding: '20px', flex: 1 }}>
              <p style={{ color: '#888', margin: '0 0 8px', fontSize: '14px' }}>Mise recommandée (Kelly 5%)</p>
              <h2 style={{ margin: '0 0 8px', color: '#22c55e' }}>${(bankroll * 0.05).toFixed(2)}</h2>
              <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>Ne jamais miser plus de 5% de ta bankroll par pari pour une gestion saine du risque.</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#252525', borderRadius: '8px', padding: '20px' }}>
            <p style={{ color: '#888', margin: '0 0 16px', fontSize: '14px' }}>Résumé financier</p>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#666', margin: '0 0 4px', fontSize: '12px' }}>Total misé</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>${miseTotale.toFixed(2)}</p>
              </div>
              <div>
                <p style={{ color: '#666', margin: '0 0 4px', fontSize: '12px' }}>Profit net</p>
                <p style={{ margin: 0, fontWeight: 'bold', color: profitTotal >= 0 ? '#22c55e' : '#ef4444' }}>{profitTotal >= 0 ? '+' : ''}${profitTotal.toFixed(2)}</p>
              </div>
              <div>
                <p style={{ color: '#666', margin: '0 0 4px', fontSize: '12px' }}>ROI</p>
                <p style={{ margin: 0, fontWeight: 'bold', color: parseFloat(roi) >= 0 ? '#22c55e' : '#ef4444' }}>{roi}%</p>
              </div>
              <div>
                <p style={{ color: '#666', margin: '0 0 4px', fontSize: '12px' }}>Paris gagnés</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{parisGagnes}/{parisTraites.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;