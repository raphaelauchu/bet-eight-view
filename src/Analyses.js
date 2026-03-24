import React, { useState, useEffect } from 'react';

const NHL_API = 'https://api.allorigins.win/raw?url=https://api-web.nhle.com/v1';

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
};

const ONGLETS = [
  { id: 'victoire', label: '🏆 Probabilité victoire' },
  { id: 'differentiel', label: '⚡ Différentiel de buts' },
  { id: 'total', label: '🎯 Total de buts' },
];

function StatEquipe({ nom, valeur, description }) {
  return (
    <div style={{ backgroundColor: '#252525', borderRadius: '8px', padding: '16px', flex: 1, minWidth: '140px' }}>
      <p style={{ color: '#888', margin: '0 0 4px', fontSize: '12px' }}>{nom}</p>
      <h3 style={{ margin: '0 0 4px', fontSize: '24px', color: '#a5b4fc' }}>{valeur}</h3>
      <p style={{ color: '#666', margin: 0, fontSize: '11px' }}>{description}</p>
    </div>
  );
}

function BarreProba({ equipe1, equipe2, prob1, prob2 }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', color: '#a5b4fc' }}>{equipe1}</span>
        <span style={{ fontWeight: 'bold', color: '#f9a8d4' }}>{equipe2}</span>
      </div>
      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '40px' }}>
        <div style={{ width: `${prob1}%`, backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
          {prob1}%
        </div>
        <div style={{ width: `${prob2}%`, backgroundColor: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
          {prob2}%
        </div>
      </div>
    </div>
  );
}

function ExplicationModele({ titre, contenu }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div style={{ backgroundColor: '#1e1b4b', borderRadius: '8px', padding: '16px', marginTop: '16px' }}>
      <div onClick={() => setOuvert(!ouvert)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', alignItems: 'center' }}>
        <span style={{ color: '#a5b4fc', fontWeight: 'bold', fontSize: '14px' }}>💡 {titre}</span>
        <span style={{ color: '#a5b4fc' }}>{ouvert ? '▲' : '▼'}</span>
      </div>
      {ouvert && (
        <p style={{ color: '#ccc', fontSize: '14px', marginTop: '12px', lineHeight: '1.6', marginBottom: 0 }}>
          {contenu}
        </p>
      )}
    </div>
  );
}

function CarteMatch({ match, classement, mode }) {
  const abbrev1 = match.awayTeam?.abbrev;
  const abbrev2 = match.homeTeam?.abbrev;
  const nom1 = match.awayTeam?.commonName?.default || abbrev1;
  const nom2 = match.homeTeam?.commonName?.default || abbrev2;
  const heure = new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  const e1 = classement.find(e => e.teamAbbrev?.default === abbrev1);
  const e2 = classement.find(e => e.teamAbbrev?.default === abbrev2);

  const gf1 = e1 ? e1.goalFor / (e1.gamesPlayed || 1) : 3;
  const ga1 = e1 ? e1.goalAgainst / (e1.gamesPlayed || 1) : 3;
  const gf2 = e2 ? e2.goalFor / (e2.gamesPlayed || 1) : 3;
  const ga2 = e2 ? e2.goalAgainst / (e2.gamesPlayed || 1) : 3;
  const pts1 = e1?.points || 0;
  const pts2 = e2?.points || 0;
  const total_pts = pts1 + pts2;
  const prob1 = total_pts > 0 ? Math.round((pts1 / total_pts) * 100) : 50;
  const prob2 = 100 - prob1;
  const win1 = e1 ? Math.round((e1.wins / (e1.wins + e1.losses + e1.otLosses || 1)) * 100) : 50;
  const win2 = e2 ? Math.round((e2.wins / (e2.wins + e2.losses + e2.otLosses || 1)) * 100) : 50;
  const total_buts = ((gf1 + ga2 + gf2 + ga1) / 2).toFixed(1);
  const diff = (gf1 - ga1 - gf2 + ga2).toFixed(1);
  const ligneBookmaker = 5.5;
  const recommendation = parseFloat(total_buts) > ligneBookmaker ? 'OVER' : 'UNDER';

  return (
    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>

      {/* Header avec logos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{nom1}</span>
          <span style={{ color: '#6366f1', fontWeight: 'bold' }}>@</span>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{nom2}</span>
          <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
        </div>
        <span style={{ color: '#888', fontSize: '13px' }}>{heure}</span>
      </div>

      {mode === 'victoire' && (
        <>
          <BarreProba equipe1={abbrev1} equipe2={abbrev2} prob1={prob1} prob2={prob2} />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <StatEquipe nom="Points" valeur={pts1} description={abbrev1} />
            <StatEquipe nom="Win%" valeur={`${win1}%`} description={abbrev1} />
            <StatEquipe nom="Points" valeur={pts2} description={abbrev2} />
            <StatEquipe nom="Win%" valeur={`${win2}%`} description={abbrev2} />
          </div>
        </>
      )}

      {mode === 'differentiel' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ color: '#888', margin: '0 0 4px', fontSize: '12px' }}>Différentiel prédit</p>
            <span style={{ fontSize: '32px', fontWeight: 'bold', color: parseFloat(diff) > 0 ? '#a5b4fc' : '#f9a8d4' }}>
              {parseFloat(diff) > 0 ? `${abbrev1} +${diff}` : `${abbrev2} +${Math.abs(diff)}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <StatEquipe nom="Buts/match" valeur={gf1.toFixed(2)} description={`Offensif ${abbrev1}`} />
            <StatEquipe nom="Accordés/match" valeur={ga1.toFixed(2)} description={`Défensif ${abbrev1}`} />
            <StatEquipe nom="Buts/match" valeur={gf2.toFixed(2)} description={`Offensif ${abbrev2}`} />
            <StatEquipe nom="Accordés/match" valeur={ga2.toFixed(2)} description={`Défensif ${abbrev2}`} />
          </div>
        </>
      )}

      {mode === 'total' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              <StatEquipe nom="Buts/match" valeur={gf1.toFixed(2)} description={abbrev1} />
              <StatEquipe nom="Accordés/match" valeur={ga1.toFixed(2)} description={abbrev1} />
              <StatEquipe nom="Buts/match" valeur={gf2.toFixed(2)} description={abbrev2} />
              <StatEquipe nom="Accordés/match" valeur={ga2.toFixed(2)} description={abbrev2} />
            </div>
            <div style={{ textAlign: 'center', marginLeft: '16px' }}>
              <p style={{ color: '#888', margin: '0 0 4px', fontSize: '12px' }}>Total prédit</p>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#a5b4fc' }}>{total_buts}</span>
            </div>
          </div>
          <div style={{ backgroundColor: recommendation === 'OVER' ? '#14532d' : '#7f1d1d', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px' }}>Ligne bookmaker: <strong>{ligneBookmaker}</strong></span>
            <span style={{ fontWeight: 'bold', fontSize: '18px', color: recommendation === 'OVER' ? '#22c55e' : '#ef4444' }}>
              {recommendation} recommandé
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Analyses() {
  const [onglet, setOnglet] = useState('victoire');
  const [classement, setClassement] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function charger() {
      try {
        const aujourdhui = new Date().toISOString().split('T')[0];
        const [resClassement, resMatchs] = await Promise.all([
          fetch(`${NHL_API}/standings/now`),
          fetch(`${NHL_API}/schedule/${aujourdhui}`),
        ]);
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

  const explicationVictoire = "Ce modèle utilise les points au classement et le Win% de chaque équipe pour estimer la probabilité de victoire. Plus une équipe a de points et un Win% élevé, plus sa probabilité est haute. Dans les prochaines versions on va ajouter les Expected Goals (xG), le Corsi, et les performances à domicile/extérieur.";
  const explicationDiff = "Le différentiel prédit compare la moyenne de buts marqués et accordés par match. Un résultat positif favorise l'équipe visiteuse, négatif favorise l'équipe locale.";
  const explicationTotal = "Le total prédit = (Buts pour équipe 1 + Buts contre équipe 2 + Buts pour équipe 2 + Buts contre équipe 1) ÷ 2. Si notre total est supérieur à 5.5, le modèle recommande OVER, sinon UNDER.";

  return (
    <div style={{ padding: '32px' }}>
      <h2 style={{ marginBottom: '8px' }}>Analyses & Modèles</h2>
      <p style={{ color: '#888', marginBottom: '32px', fontSize: '14px' }}>
        Modèles statistiques basés sur les données officielles NHL en temps réel.
      </p>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {ONGLETS.map(o => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: onglet === o.id ? '#6366f1' : '#1a1a1a',
              color: 'white',
              fontSize: '14px',
              fontWeight: onglet === o.id ? 'bold' : 'normal',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {chargement ? (
        <p style={{ color: '#888' }}>Chargement des données NHL...</p>
      ) : matchs.length === 0 ? (
        <p style={{ color: '#888' }}>Aucun match aujourd'hui.</p>
      ) : (
        <div>
          {matchs.map((match, i) => (
            <CarteMatch key={i} match={match} classement={classement} mode={onglet} />
          ))}
          <ExplicationModele
            titre="Comment ce modèle est calculé"
            contenu={onglet === 'victoire' ? explicationVictoire : onglet === 'differentiel' ? explicationDiff : explicationTotal}
          />
        </div>
      )}
    </div>
  );
}

export default Analyses;