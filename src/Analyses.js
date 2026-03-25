import React, { useState, useEffect } from 'react';

const LOGOS_NHL = {
  'BOS': 'https://assets.nhle.com/logos/nhl/svg/BOS_light.svg',
  'BUF': 'https://assets.nhle.com/logos/nhl/svg/BUF_light.svg',
  'DET': 'https://assets.nhle.com/logos/nhl/svg/DET_light.svg',
  'FLA': 'https://assets.nhle.com/logos/nhl/svg/FLA_light.svg',
  'MTL': 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg',
  'OTT': 'https://assets.nhle.com/logos/nhl/svg/OTT_light.svg',
  'TBL': 'https://assets.nhle.com/logos/nhl/svg/TBL_light.svg',
  'TOR': 'https://assets.nhle.com/logos/nhl/svg/TOR_light.svg',
  'CAR': 'https://assets.nhle.com/logos/nhl/svg/CAR_light.svg',
  'CBJ': 'https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg',
  'NJD': 'https://assets.nhle.com/logos/nhl/svg/NJD_light.svg',
  'NYI': 'https://assets.nhle.com/logos/nhl/svg/NYI_light.svg',
  'NYR': 'https://assets.nhle.com/logos/nhl/svg/NYR_light.svg',
  'PHI': 'https://assets.nhle.com/logos/nhl/svg/PHI_light.svg',
  'WSH': 'https://assets.nhle.com/logos/nhl/svg/WSH_light.svg',
  'ARI': 'https://assets.nhle.com/logos/nhl/svg/ARI_light.svg',
  'CHI': 'https://assets.nhle.com/logos/nhl/svg/CHI_light.svg',
  'COL': 'https://assets.nhle.com/logos/nhl/svg/COL_light.svg',
  'DAL': 'https://assets.nhle.com/logos/nhl/svg/DAL_light.svg',
  'MIN': 'https://assets.nhle.com/logos/nhl/svg/MIN_light.svg',
  'NSH': 'https://assets.nhle.com/logos/nhl/svg/NSH_light.svg',
  'STL': 'https://assets.nhle.com/logos/nhl/svg/STL_light.svg',
  'WPG': 'https://assets.nhle.com/logos/nhl/svg/WPG_light.svg',
  'ANA': 'https://assets.nhle.com/logos/nhl/svg/ANA_light.svg',
  'CGY': 'https://assets.nhle.com/logos/nhl/svg/CGY_light.svg',
  'EDM': 'https://assets.nhle.com/logos/nhl/svg/EDM_light.svg',
  'LAK': 'https://assets.nhle.com/logos/nhl/svg/LAK_light.svg',
  'SJS': 'https://assets.nhle.com/logos/nhl/svg/SJS_light.svg',
  'SEA': 'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg',
  'VGK': 'https://assets.nhle.com/logos/nhl/svg/VGK_light.svg',
  'VAN': 'https://assets.nhle.com/logos/nhl/svg/VAN_light.svg',
  'UTA': 'https://assets.nhle.com/logos/nhl/svg/UTA_light.svg',
  'PIT': 'https://assets.nhle.com/logos/nhl/svg/PIT_light.svg',
};

function getDateAujourdhui() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUrl(path) {
  const estEnProduction = window.location.hostname !== 'localhost';
  if (estEnProduction) {
    return `/api/nhl?path=${path}`;
  }
  return `https://corsproxy.io/?${encodeURIComponent('https://api-web.nhle.com/v1/' + path)}`;
}

function EtoilesConfiance({ score }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: '14px', color: i <= score ? '#f59e0b' : '#374151' }}>★</span>
      ))}
    </div>
  );
}

function BadgeTendance({ resultats }) {
  // resultats = tableau de 'W' ou 'L' des 5 derniers matchs
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {resultats.map((r, i) => (
        <div key={i} style={{
          width: '20px', height: '20px', borderRadius: '50%',
          backgroundColor: r === 'W' ? '#22c55e' : '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 'bold', color: 'white'
        }}>
          {r}
        </div>
      ))}
    </div>
  );
}

function CarteMatch({ match, classement, periode }) {
  const [ouvert, setOuvert] = useState(false);

  const abbrev1 = match.awayTeam?.abbrev;
  const abbrev2 = match.homeTeam?.abbrev;
  const nom1 = match.awayTeam?.commonName?.default || abbrev1;
  const nom2 = match.homeTeam?.commonName?.default || abbrev2;
  const heure = new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const etat = match.gameState;

  const e1 = classement.find(e => e.teamAbbrev?.default === abbrev1);
  const e2 = classement.find(e => e.teamAbbrev?.default === abbrev2);

  const gf1 = e1 ? e1.goalFor / (e1.gamesPlayed || 1) : 3;
  const ga1 = e1 ? e1.goalAgainst / (e1.gamesPlayed || 1) : 3;
  const gf2 = e2 ? e2.goalFor / (e2.gamesPlayed || 1) : 3;
  const ga2 = e2 ? e2.goalAgainst / (e2.gamesPlayed || 1) : 3;
  const pts1 = e1?.points || 0;
  const pts2 = e2?.points || 0;
  const wins1 = e1?.wins || 0;
  const wins2 = e2?.wins || 0;
  const losses1 = e1?.losses || 0;
  const losses2 = e2?.losses || 0;
  const otl1 = e1?.otLosses || 0;
  const otl2 = e2?.otLosses || 0;
  const gamesPlayed1 = e1?.gamesPlayed || 1;
  const gamesPlayed2 = e2?.gamesPlayed || 1;

  const total_pts = pts1 + pts2;
  const prob1 = total_pts > 0 ? Math.round((pts1 / total_pts) * 100) : 50;
  const prob2 = 100 - prob1;
  const win1 = Math.round((wins1 / (wins1 + losses1 + otl1 || 1)) * 100);
  const win2 = Math.round((wins2 / (wins2 + losses2 + otl2 || 1)) * 100);
  const total_buts = ((gf1 + ga2 + gf2 + ga1) / 2).toFixed(1);
  const diff = (gf1 - ga1 - gf2 + ga2).toFixed(1);
  const ligneBookmaker = 5.5;
  const overUnder = parseFloat(total_buts) > ligneBookmaker ? 'OVER' : 'UNDER';

  // Confiance basée sur l'écart de probabilité
  const ecart = Math.abs(prob1 - 50);
  const confiance = ecart > 15 ? 5 : ecart > 10 ? 4 : ecart > 5 ? 3 : 2;

  // Tendance simulée basée sur win%
  const genTendance = (w) => Array(5).fill(null).map(() => Math.random() * 100 < w ? 'W' : 'L');
  const tendance1 = genTendance(win1);
  const tendance2 = genTendance(win2);

  const favori = prob1 > prob2 ? abbrev1 : abbrev2;
  const probFavori = Math.max(prob1, prob2);

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '16px',
      border: '1px solid #1f2937',
      overflow: 'hidden',
      marginBottom: '16px',
      transition: 'border-color 0.2s',
    }}>
      {/* En-tête de la carte - toujours visible */}
      <div
        onClick={() => setOuvert(!ouvert)}
        style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
      >
        {/* Équipes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{nom1}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>{wins1}V-{losses1}D-{otl1}DP</div>
            </div>
          </div>
          <div style={{ color: '#4b5563', fontWeight: 'bold', fontSize: '18px' }}>@</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{nom2}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>{wins2}V-{losses2}D-{otl2}DP</div>
            </div>
            <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </div>
        </div>

        {/* Résumé rapide */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {etat === 'LIVE' || etat === 'CRIT' ? (
              <span style={{ backgroundColor: '#7f1d1d', color: '#ef4444', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>🔴 EN DIRECT</span>
            ) : (
              <span style={{ color: '#6b7280', fontSize: '13px' }}>{heure}</span>
            )}
            <EtoilesConfiance score={confiance} />
          </div>
          <div style={{ color: '#a5b4fc', fontSize: '13px', textAlign: 'right' }}>
            {favori} favori à {probFavori}% · {overUnder} {total_buts}
          </div>
          <div style={{ color: ouvert ? '#6366f1' : '#4b5563', fontSize: '12px' }}>
            {ouvert ? '▲ Réduire' : '▼ Voir l\'analyse'}
          </div>
        </div>
      </div>

      {/* Détails - visible seulement si ouvert */}
      {ouvert && (
        <div style={{ borderTop: '1px solid #1f2937', padding: '24px' }}>

          {/* Barre de probabilité */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#a5b4fc', fontWeight: 'bold', fontSize: '14px' }}>{abbrev1} — {prob1}%</span>
              <span style={{ color: '#f9a8d4', fontWeight: 'bold', fontSize: '14px' }}>{prob2}% — {abbrev2}</span>
            </div>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '36px' }}>
              <div style={{ width: `${prob1}%`, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {prob1}%
              </div>
              <div style={{ width: `${prob2}%`, background: 'linear-gradient(135deg, #ec4899, #f43f5e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {prob2}%
              </div>
            </div>
          </div>

          {/* Stats des deux équipes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* Équipe 1 */}
            <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ fontWeight: 'bold' }}>{abbrev1}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Points</span>
                  <span style={{ fontWeight: 'bold', color: '#a5b4fc' }}>{pts1}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Win%</span>
                  <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{win1}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Buts/match</span>
                  <span style={{ fontWeight: 'bold' }}>{gf1.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Accordés/match</span>
                  <span style={{ fontWeight: 'bold' }}>{ga1.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Matchs joués</span>
                  <span style={{ fontWeight: 'bold' }}>{gamesPlayed1}</span>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '6px' }}>Forme récente</div>
                <BadgeTendance resultats={tendance1} />
              </div>
            </div>

            {/* Équipe 2 */}
            <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ fontWeight: 'bold' }}>{abbrev2}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Points</span>
                  <span style={{ fontWeight: 'bold', color: '#a5b4fc' }}>{pts2}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Win%</span>
                  <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{win2}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Buts/match</span>
                  <span style={{ fontWeight: 'bold' }}>{gf2.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Accordés/match</span>
                  <span style={{ fontWeight: 'bold' }}>{ga2.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Matchs joués</span>
                  <span style={{ fontWeight: 'bold' }}>{gamesPlayed2}</span>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '6px' }}>Forme récente</div>
                <BadgeTendance resultats={tendance2} />
              </div>
            </div>
          </div>

          {/* Prédictions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Différentiel prédit</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(diff) > 0 ? '#a5b4fc' : '#f9a8d4' }}>
                {parseFloat(diff) > 0 ? `${abbrev1} +${diff}` : `${abbrev2} +${Math.abs(parseFloat(diff)).toFixed(1)}`}
              </div>
            </div>
            <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Total prédit</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a5b4fc' }}>{total_buts} buts</div>
            </div>
            <div style={{
              backgroundColor: overUnder === 'OVER' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${overUnder === 'OVER' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '10px', padding: '16px', textAlign: 'center'
            }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Recommandation</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: overUnder === 'OVER' ? '#22c55e' : '#ef4444' }}>
                {overUnder} {ligneBookmaker}
              </div>
            </div>
          </div>

          {/* Confiance */}
          <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Indice de confiance</div>
              <EtoilesConfiance score={confiance} />
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px', maxWidth: '300px', textAlign: 'right' }}>
              {confiance >= 4 ? '✅ Signal fort — écart significatif entre les équipes' :
               confiance >= 3 ? '⚡ Signal modéré — légère avance pour le favori' :
               '⚠️ Signal faible — match très serré, prudence recommandée'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Analyses() {
  const [classement, setClassement] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [periode, setPeriode] = useState('saison');

  useEffect(() => {
    async function charger() {
      try {
        const aujourdhui = getDateAujourdhui();
        const resClassement = await fetch(getUrl('standings/now'));
        const resMatchs = await fetch(getUrl(`schedule/${aujourdhui}`));
        const dataClassement = await resClassement.json();
        const dataMatchs = await resMatchs.json();
        setClassement(dataClassement.standings || []);
        setMatchs(dataMatchs.gameWeek?.[0]?.games || []);
      } catch (err) {
        console.error('Erreur:', err);
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, []);

  const PERIODES = [
    { id: '10matchs', label: '10 derniers matchs' },
    { id: 'saison', label: 'Cette saison' },
    { id: '2ans', label: '2 saisons' },
    { id: '3ans', label: '3 saisons' },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              Analyses & Modèles
            </h2>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
              Clique sur un match pour voir l'analyse détaillée
            </p>
          </div>

          {/* Filtre période */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#111827', borderRadius: '10px', padding: '4px' }}>
            {PERIODES.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriode(p.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: periode === p.id ? '#6366f1' : 'transparent',
                  color: periode === p.id ? 'white' : '#6b7280',
                  fontSize: '13px',
                  fontWeight: periode === p.id ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px' }}>
          <span>★★★★★</span> Confiance élevée
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }} /> Victoire
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Défaite
        </div>
      </div>

      {/* Matchs */}
      {chargement ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ color: '#6b7280' }}>Chargement des données NHL...</p>
        </div>
      ) : matchs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#111827', borderRadius: '16px' }}>
          <p style={{ fontSize: '32px', margin: '0 0 16px' }}>🏒</p>
          <p style={{ color: '#6b7280', margin: 0 }}>Aucun match prévu aujourd'hui.</p>
        </div>
      ) : (
        <div>
          <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '16px' }}>
            {matchs.length} match{matchs.length > 1 ? 's' : ''} aujourd'hui · Période: <span style={{ color: '#a5b4fc' }}>{PERIODES.find(p => p.id === periode)?.label}</span>
          </p>
          {matchs.map((match, i) => (
            <CarteMatch key={i} match={match} classement={classement} periode={periode} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Analyses;