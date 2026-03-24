import React, { useState, useEffect } from 'react';
import { getMatchsAujourdhui } from './hockey';

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
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function chargerMatchs() {
      try {
        const data = await getMatchsAujourdhui();
        setMatchs(data);
      } catch (err) {
        console.error('Erreur NHL API:', err);
      } finally {
        setChargement(false);
      }
    }
    chargerMatchs();
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

      {/* Matchs NHL du jour */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>🏒 Matchs NHL aujourd'hui</h3>
        {chargement ? (
          <p style={{ color: '#888' }}>Chargement des matchs...</p>
        ) : matchs.length === 0 ? (
          <p style={{ color: '#888' }}>Aucun match aujourd'hui.</p>
        ) : (
          matchs.map((match, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: index === 0 ? 'none' : '1px solid #333' }}>
              <span>{match.awayTeam?.placeName?.default} {match.awayTeam?.commonName?.default}</span>
              <span style={{ color: '#6366f1', fontWeight: 'bold' }}>VS</span>
              <span>{match.homeTeam?.placeName?.default} {match.homeTeam?.commonName?.default}</span>
              <span style={{ color: '#888', fontSize: '14px' }}>
                {new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Tableau de paris récents */}
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