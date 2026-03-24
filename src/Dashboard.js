import React, { useState, useEffect } from 'react';
import { getMatchsAujourdhui } from './hockey';
import { getCotesHockey } from './cotes';

function StatCard({ title, value, change, positive }) {
  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '12px', flex: 1 }}>
      <p style={{ color: '#888', margin: '0 0 8px', fontSize: '14px' }}>{title}</p>
      <h3 style={{ margin: '0 0 8px', fontSize: '28px' }}>{value}</h3>
      <p style={{ margin: 0, color: positive ? '#22c55e' : '#ef4444', fontSize: '14px' }}>{change}</p>
    </div>
  );
}

function Dashboard() {
  const [matchs, setMatchs] = useState([]);
  const [cotes, setCotes] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function chargerDonnees() {
      try {
        const [dataMatchs, dataCotes] = await Promise.all([
          getMatchsAujourdhui(),
          getCotesHockey(),
        ]);
        setMatchs(dataMatchs);
        setCotes(dataCotes);
      } catch (err) {
        console.error('Erreur:', err);
      } finally {
        setChargement(false);
      }
    }
    chargerDonnees();
  }, []);

  return (
    <div style={{ padding: '32px' }}>
      <h2 style={{ marginBottom: '24px' }}>Mon Dashboard</h2>

      {/* Cartes de stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <StatCard title="Mises totales" value="142" change="+12 ce mois" positive={true} />
        <StatCard title="Taux de réussite" value="58%" change="+3% vs mois dernier" positive={true} />
        <StatCard title="Profit net" value="+$840" change="-$120 cette semaine" positive={false} />
        <StatCard title="ROI moyen" value="7.2%" change="+1.1% vs mois dernier" positive={true} />
      </div>

      {/* Matchs NHL avec cotes */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>🏒 Matchs NHL — Cotes en direct</h3>
        {chargement ? (
          <p style={{ color: '#888' }}>Chargement...</p>
        ) : cotes.length === 0 ? (
          <p style={{ color: '#888' }}>Aucune cote disponible.</p>
        ) : (
          cotes.map((match, index) => (
            <div key={index} style={{ borderTop: index === 0 ? 'none' : '1px solid #333', padding: '16px 0' }}>
              
              {/* Nom du match */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold' }}>{match.away_team} @ {match.home_team}</span>
                <span style={{ color: '#888', fontSize: '13px' }}>
                  {new Date(match.commence_time).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Cotes par bookmaker */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {match.bookmakers?.slice(0, 4).map((bookmaker, i) => (
                  <div key={i} style={{ backgroundColor: '#252525', borderRadius: '8px', padding: '10px 16px', minWidth: '140px' }}>
                    <p style={{ color: '#6366f1', fontSize: '12px', margin: '0 0 8px', fontWeight: 'bold' }}>
                      {bookmaker.title}
                    </p>
                    {bookmaker.markets?.[0]?.outcomes?.map((outcome, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#ccc' }}>{outcome.name}</span>
                        <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 'bold' }}>{outcome.price}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>



      {/* Paris récents */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Paris récents</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#888', fontSize: '14px', textAlign: 'left' }}>
              <th style={{ paddingBottom: '12px' }}>Match</th>
              <th style={{ paddingBottom: '12px' }}>Mise</th>
              <th style={{ paddingBottom: '12px' }}>Cote</th>
              <th style={{ paddingBottom: '12px' }}>Résultat</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid #333' }}>
              <td style={{ padding: '12px 0' }}>Canadiens vs Maple Leafs</td>
              <td style={{ padding: '12px 0' }}>$50</td>
              <td style={{ padding: '12px 0' }}>1.85</td>
              <td style={{ padding: '12px 0', color: '#22c55e' }}>✓ Gagné</td>
            </tr>
            <tr style={{ borderTop: '1px solid #333' }}>
              <td style={{ padding: '12px 0' }}>Oilers vs Flames</td>
              <td style={{ padding: '12px 0' }}>$100</td>
              <td style={{ padding: '12px 0' }}>2.10</td>
              <td style={{ padding: '12px 0', color: '#ef4444' }}>✗ Perdu</td>
            </tr>
            <tr style={{ borderTop: '1px solid #333' }}>
              <td style={{ padding: '12px 0' }}>Bruins vs Rangers</td>
              <td style={{ padding: '12px 0' }}>$75</td>
              <td style={{ padding: '12px 0' }}>1.65</td>
              <td style={{ padding: '12px 0', color: '#22c55e' }}>✓ Gagné</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;