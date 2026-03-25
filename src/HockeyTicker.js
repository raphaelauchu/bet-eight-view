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

function HockeyTicker({ onMatchsCharge }) {
  const [matchs, setMatchs] = useState([]);

  useEffect(() => {
    async function charger() {
      try {
        const aujourdhui = getDateAujourdhui();
        const response = await fetch(getUrl(`schedule/${aujourdhui}`));
        const data = await response.json();
        const games = data.gameWeek?.[0]?.games || [];
        setMatchs(games);
        if (onMatchsCharge) onMatchsCharge(games.length);
      } catch (err) {
        console.error('Erreur ticker:', err);
      }
    }
    charger();
    const interval = setInterval(charger, 60000);
    return () => clearInterval(interval);
  }, [onMatchsCharge]);

  if (matchs.length === 0) return null;

  const nombreDuplications = Math.max(2, Math.ceil(20 / matchs.length));
  const contenu = Array(nombreDuplications).fill(matchs).flat();
  const duree = Math.max(20, matchs.length * 8);

  return (
    <div style={{
      backgroundColor: '#111',
      borderBottom: '1px solid #222',
      overflow: 'hidden',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        animation: `ticker ${duree}s linear infinite`,
        whiteSpace: 'nowrap',
        gap: '0px',
      }}>
        {contenu.map((match, index) => {
          const domicile = match.homeTeam?.abbrev;
          const visiteur = match.awayTeam?.abbrev;
          const heure = new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const etat = match.gameState;
          const scoreDom = match.homeTeam?.score;
          const scoreVis = match.awayTeam?.score;

          return (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 32px',
              borderRight: '1px solid #222',
              height: '52px',
              cursor: 'pointer',
            }}>
              <img src={LOGOS_NHL[visiteur]} alt={visiteur} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              <span style={{ fontSize: '13px', color: '#ccc' }}>{visiteur}</span>
              {etat === 'LIVE' || etat === 'CRIT' ? (
                <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 'bold' }}>
                  {scoreVis} - {scoreDom}
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#6366f1' }}>{heure}</span>
              )}
              <span style={{ fontSize: '13px', color: '#ccc' }}>{domicile}</span>
              <img src={LOGOS_NHL[domicile]} alt={domicile} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-${100 / nombreDuplications}%); }
        }
      `}</style>
    </div>
  );
}

export default HockeyTicker;