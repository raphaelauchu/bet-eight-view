import React, { useState, useEffect, useRef } from 'react';
import { getUrl, getSOGParPeriode, calcSOGPeriode, getGameLogJoueur, calcStatsPeriode, getHitsBlocksParMatch, getShotChartData } from './nhlApi';
 
const NHL_ABBREV_TO_SLUG = {
  'ANA': 'anaheim-ducks', 'BOS': 'boston-bruins', 'BUF': 'buffalo-sabres',
  'CGY': 'calgary-flames', 'CAR': 'carolina-hurricanes', 'CHI': 'chicago-blackhawks',
  'COL': 'colorado-avalanche', 'CBJ': 'columbus-blue-jackets', 'DAL': 'dallas-stars',
  'DET': 'detroit-red-wings', 'EDM': 'edmonton-oilers', 'FLA': 'florida-panthers',
  'LAK': 'los-angeles-kings', 'MIN': 'minnesota-wild', 'MTL': 'montreal-canadiens',
  'NSH': 'nashville-predators', 'NJD': 'new-jersey-devils', 'NYI': 'new-york-islanders',
  'NYR': 'new-york-rangers', 'OTT': 'ottawa-senators', 'PHI': 'philadelphia-flyers',
  'PIT': 'pittsburgh-penguins', 'SJS': 'san-jose-sharks', 'SEA': 'seattle-kraken',
  'STL': 'st-louis-blues', 'TBL': 'tampa-bay-lightning', 'TOR': 'toronto-maple-leafs',
  'UTA': 'utah-mammoth', 'VAN': 'vancouver-canucks', 'VGK': 'vegas-golden-knights',
  'WSH': 'washington-capitals', 'WPG': 'winnipeg-jets',
};

function useLineupsDailyFaceoff() {
  const [lineups, setLineups] = useState(null);
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/raphaelauchu/bet-eight-view/main/nhl_lineups.json')
      .then(r => r.json())
      .then(data => setLineups(data.teams))
      .catch(err => console.error('Lineups fetch error:', err));
  }, []);
  return lineups;
}
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
 
const LIGUES = [
  { id: 'nhl', label: 'NHL', disponible: true, logo: 'https://assets.nhle.com/logos/nhl/svg/NHL_light.svg', description: 'Ligue nationale de hockey' },
  { id: 'nfl', label: 'NFL', disponible: false, logo: 'https://static.www.nfl.com/image/upload/v1554321393/league/nvfr7ogywskqrfaiu38m.svg', description: 'Ligue nationale de football' },
];

const SAISON_REG_2526 = { id: 'reg2526', seasonId: '20252026', gameType: 2, label: 'Saison régulière 25-26' };
const SAISON_PO_2526 = { id: 'po2526', seasonId: '20252026', gameType: 3, label: 'Playoffs 25-26' };
const SAISONS_2526 = [SAISON_REG_2526, SAISON_PO_2526];

// Les stats "featuredStats" de player/landing ne reflètent pas forcement la saison choisie.
// On va plutot chercher dans seasonTotals l'entree qui correspond au seasonId + gameType choisis.
function extraireStatsSaisonJoueur(data, seasonId, gameType) {
  const entries = data.seasonTotals || [];
  return entries.find(s => String(s.season) === String(seasonId) && s.gameTypeId === gameType) || null;
}

const ABBREV_TO_TEAM_ID = {
  'ANA': 24, 'BOS': 6, 'BUF': 7, 'CGY': 20, 'CAR': 12, 'CHI': 16, 'COL': 21, 'CBJ': 29,
  'DAL': 25, 'DET': 17, 'EDM': 22, 'FLA': 13, 'LAK': 26, 'MIN': 30, 'MTL': 8, 'NSH': 18,
  'NJD': 1, 'NYI': 2, 'NYR': 3, 'OTT': 9, 'PHI': 4, 'PIT': 5, 'SJS': 28, 'SEA': 55,
  'STL': 19, 'TBL': 14, 'TOR': 10, 'UTA': 68, 'VAN': 23, 'VGK': 54, 'WSH': 15, 'WPG': 52,
};

function getStatsRestUrl(fullUrl) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  if (estEnProduction) return `/api/nhl?path=${encodeURIComponent(fullUrl)}`;
  return `https://corsproxy.io/?${encodeURIComponent(fullUrl)}`;
}

function buildCayenneExp({ gameType, teamAbbrev, positionCode }) {
  let exp = `seasonId=20252026 and gameTypeId=${gameType}`;
  if (teamAbbrev && teamAbbrev !== 'ALL') exp += ` and teamId=${ABBREV_TO_TEAM_ID[teamAbbrev]}`;
  if (positionCode && positionCode !== 'ALL') exp += ` and positionCode="${positionCode}"`;
  return exp;
}

function SelecteurSaisonDiscret({ saison, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
      {SAISONS_2526.map(s => (
        <button
          key={s.id}
          onClick={() => onChange(s)}
          style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: saison.id === s.id ? '#f97316' : '#1a1a1a', color: saison.id === s.id ? 'white' : '#888', fontSize: '11px', fontWeight: saison.id === s.id ? 'bold' : 'normal' }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
 
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isMobile;
}
 
function getDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
 
function PointsIndicateur({ total, actif }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '16px' }}>
      {Array(total).fill(null).map((_, i) => (
        <div key={i} style={{ width: i === actif ? '24px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: i === actif ? '#f97316' : '#333', transition: 'all 0.3s' }} />
      ))}
    </div>
  );
}
 
function CarrouselDivisions({ classement }) {
  const [indexActif, setIndexActif] = useState(0);
  const [visible, setVisible] = useState(true);
  const divisions = {};
  classement.forEach(e => {
    const div = e.divisionName || 'Autre';
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(e);
  });
  const listeDivisions = Object.entries(divisions);
  useEffect(() => {
    if (listeDivisions.length === 0) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIndexActif(prev => (prev + 1) % listeDivisions.length); setVisible(true); }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, [listeDivisions.length]);
  if (listeDivisions.length === 0) return <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#666' }}>Chargement...</p></div>;
  const [nomDiv, equipes] = listeDivisions[indexActif];
  return (
    <div>
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#f97316' }}>Division {nomDiv}</h3>
          <span style={{ color: '#666', fontSize: '12px' }}>{indexActif + 1} / {listeDivisions.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {equipes.slice(0, 10).map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: i === 0 ? 'rgba(249,115,22,0.1)' : '#1a1a1a', borderRadius: '8px', padding: '5px 12px', border: i === 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
              <span style={{ color: i < 3 ? '#f97316' : '#555', fontWeight: 'bold', fontSize: '13px', width: '18px', textAlign: 'center' }}>{i + 1}</span>
              <img src={LOGOS_NHL[e.teamAbbrev?.default]} alt={e.teamAbbrev?.default} style={{ width: '24px', height: '24px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
              <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>{e.teamAbbrev?.default}</span>
              <span style={{ fontSize: '16px', fontWeight: '900', color: '#f97316' }}>{e.points} pts</span>
            </div>
          ))}
        </div>
      </div>
      <PointsIndicateur total={listeDivisions.length} actif={indexActif} />
    </div>
  );
}
 
function CarrouselMeneurs({ meneurs }) {
  const [indexActif, setIndexActif] = useState(0);
  const [visible, setVisible] = useState(true);
  const categories = [
   { label: 'Top 10 Goals', data: meneurs.buts?.slice(0, 10) || [] },
    { label: 'Top 10 Assists', data: meneurs.passes?.slice(0, 10) || [] },
    { label: 'Top 10 Points', data: meneurs.points?.slice(0, 10) || [] },
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIndexActif(prev => (prev + 1) % 3); setVisible(true); }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  const cat = categories[indexActif];
  return (
    <div>
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#f97316' }}>{cat.label}</h3>
          <span style={{ color: '#666', fontSize: '12px' }}>{indexActif + 1} / 3</span>
        </div>
        {cat.data.length === 0 ? <p style={{ color: '#666' }}>Chargement...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {cat.data.map((j, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: i === 0 ? 'rgba(249,115,22,0.1)' : '#1a1a1a', borderRadius: '8px', padding: '5px 12px', border: i === 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
                <span style={{ color: i === 0 ? '#f97316' : '#555', fontWeight: 'bold', fontSize: '13px', width: '18px', textAlign: 'center' }}>{i + 1}</span>
                <img src={LOGOS_NHL[j.equipe]} alt={j.equipe} style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{j.nom}</div>
                  <div style={{ color: '#666', fontSize: '11px' }}>{j.equipe} · {j.position}</div>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '900', color: '#f97316' }}>{j.valeur}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <PointsIndicateur total={3} actif={indexActif} />
    </div>
  );
}
 
function CarteJoueurLigne({ joueur, onSelect, estChaud, isMobile }) {
  const taille = isMobile ? '36px' : '44px';
  return (
    <div
      onClick={() => onSelect(joueur)}
      style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', border: estChaud ? '1px solid #f97316' : '1px solid #222', padding: isMobile ? '8px 4px' : '10px 8px', textAlign: 'center', cursor: 'pointer', position: 'relative', flex: 1, minWidth: isMobile ? '60px' : '80px' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
      onMouseLeave={e => e.currentTarget.style.borderColor = estChaud ? '#f97316' : '#222'}
    >
      {estChaud && (
        <div style={{ position: 'absolute', top: '-7px', right: '-3px', backgroundColor: '#f97316', borderRadius: '8px', padding: '1px 5px', fontSize: '8px', fontWeight: 'bold', color: 'white' }}>HOT</div>
      )}
      <img src={LOGOS_NHL[joueur.equipe]} alt={joueur.equipe} style={{ width: taille, height: taille, objectFit: 'contain', marginBottom: '4px' }} onError={e => { e.target.style.display = 'none'; }} />
      <div style={{ fontSize: isMobile ? '9px' : '11px', fontWeight: 'bold', color: 'white', marginBottom: '2px', lineHeight: '1.2' }}>{joueur.nom.split(' ').pop()}</div>
      <div style={{ fontSize: '9px', color: '#666', marginBottom: '4px' }}>#{joueur.numero}</div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '900', color: joueur.goals != null ? '#f97316' : '#444' }}>{joueur.goals ?? '-'}</div>
          <div style={{ fontSize: '8px', color: '#555' }}>B</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '900', color: joueur.assists != null ? 'white' : '#444' }}>{joueur.assists ?? '-'}</div>
          <div style={{ fontSize: '8px', color: '#555' }}>A</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '900', color: joueur.points != null ? 'white' : '#444' }}>{joueur.points ?? '-'}</div>
          <div style={{ fontSize: '8px', color: '#555' }}>PTS</div>
        </div>
      </div>
    </div>
  );
}
 
function SectionGardien({ gardien, onSelect }) {
  if (!gardien) return null;
  return (
    <div onClick={() => onSelect(gardien)} style={{ backgroundColor: 'rgba(249,115,22,0.05)', borderRadius: '12px', border: '1px solid rgba(249,115,22,0.2)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
      <img src={LOGOS_NHL[gardien.equipe]} alt={gardien.equipe} style={{ width: '50px', height: '50px', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: '#f97316', fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>Gardien partant</div>
        <div style={{ fontSize: '15px', fontWeight: '900', color: 'white', marginBottom: '2px' }}>{gardien.nom}</div>
        <div style={{ fontSize: '11px', color: '#666' }}>#{gardien.numero}</div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{gardien.gaa ?? '-'}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>GAA</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{gardien.svp ?? '-'}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>SV%</div>
        </div>
      </div>
      <span style={{ color: '#f97316', fontSize: '12px' }}>→</span>
    </div>
  );
}
 
function AlignementEquipe({ abbrev, nom, logo, joueurs, onSelect, isMobile, lineupDF }) {
  const forwards = joueurs.filter(j => ['L', 'C', 'R', 'LW', 'RW', 'F'].includes(j.position));
  const defenseurs = joueurs.filter(j => ['D', 'LD', 'RD'].includes(j.position));
  const gardiens = joueurs.filter(j => j.position === 'G');
  const gardienPartant = gardiens[0] || null;
  // Matching Daily Faceoff
  const slug = NHL_ABBREV_TO_SLUG[abbrev];
  const dfData = lineupDF?.[slug];

  const trouverJoueur = (nomDF) => {
  if (!nomDF) return null;
  const nomLower = nomDF.toLowerCase();
  const parties = nomDF.toLowerCase().split(' ');
  const prenomDF = parties[0];
  const nomFamilleDF = parties[parties.length - 1];
  
  // 1. Match exact complet
  let trouve = joueurs.find(j => j.nom.toLowerCase() === nomLower);
  if (trouve) return trouve;
  
  // 2. Match nom de famille seul d'abord
  trouve = joueurs.find(j => j.nom.toLowerCase().includes(nomFamilleDF));
  if (trouve) return trouve;

  // 3. Match prénom seul (si > 4 lettres)
  if (prenomDF.length > 4) {
    trouve = joueurs.find(j => j.nom.toLowerCase().includes(prenomDF));
    if (trouve) return trouve;
  }
  
  // 3. Match nom de famille seulement (si > 4 lettres)
  if (nomFamilleDF.length > 4) {
    trouve = joueurs.find(j => j.nom.toLowerCase().includes(nomFamilleDF));
    if (trouve) return trouve;
  }
  
  return null;
};

  const lignesDF = dfData?.forwards ?
    Object.entries(dfData.forwards).map(([key, line]) => [
      trouverJoueur(line.LW),
      trouverJoueur(line.C),
      trouverJoueur(line.RW),
    ].filter(Boolean)).filter(l => l.length > 0) : null;

  const gardienDF = dfData?.goalies?.[0] ?
    trouverJoueur(dfData.goalies[0]) || gardienPartant : gardienPartant;
 
  const lignes = [];
  if (forwards.some(j => j.ligne)) {
    const parLigne = {};
    forwards.forEach(j => { const l = j.ligne || 99; if (!parLigne[l]) parLigne[l] = []; parLigne[l].push(j); });
    Object.keys(parLigne).sort((a, b) => Number(a) - Number(b)).forEach(l => lignes.push(parLigne[l]));
  } else {
    for (let i = 0; i < Math.min(forwards.length, 12); i += 3) lignes.push(forwards.slice(i, i + 3));
  }
 const pairesDF = dfData?.defence ?
    Object.entries(dfData.defence).map(([key, pair]) => [
      trouverJoueur(pair.LD),
      trouverJoueur(pair.RD),
    ].filter(Boolean)).filter(p => p.length > 0) : null;
  const paires = [];
  if (defenseurs.some(j => j.ligne)) {
    const parPaire = {};
    defenseurs.forEach(j => { const l = j.ligne || 99; if (!parPaire[l]) parPaire[l] = []; parPaire[l].push(j); });
    Object.keys(parPaire).sort((a, b) => Number(a) - Number(b)).forEach(l => paires.push(parPaire[l]));
  } else {
    for (let i = 0; i < Math.min(defenseurs.length, 6); i += 2) paires.push(defenseurs.slice(i, i + 2));
  }
 
  const joueurChaud = forwards.reduce((max, j) => (j.points || 0) > (max?.points || 0) ? j : max, null);
 
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #f97316' }}>
        <img src={logo} alt={abbrev} style={{ width: '32px', height: '32px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'white' }}>{nom}</h3>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <SectionGardien gardien={gardienDF} onSelect={onSelect} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Attaquants</div>
          {(lignesDF || lignes).map((ligne, li) => (
            <div key={li} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Line {li + 1} · {ligne.reduce((s, j) => s + (j.points || 0), 0)} pts</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {ligne.map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={joueurChaud?.id === j.id && (j.points || 0) > 0} isMobile={isMobile} />)}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Defenseurs</div>
          {(pairesDF || paires).map((paire, pi) => (
            <div key={pi} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Paire {pi + 1}</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {paire.map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={false} isMobile={isMobile} />)}
              </div>
            </div>
          ))}
          {forwards.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Power Play</div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '9px', color: '#f97316', marginBottom: '4px' }}>PP1</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                  {(dfData?.pp_units?.PP1?.slice(0,3) || forwards.slice(0, 3)).filter(Boolean).map((j, i) => { const joueur = typeof j === 'string' ? trouverJoueur(j) : j; return joueur ? <CarteJoueurLigne key={i} joueur={joueur} onSelect={onSelect} estChaud={false} isMobile={isMobile} /> : null; })}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(dfData?.pp_units?.PP1?.slice(3) || [defenseurs[0], defenseurs[1]]).filter(Boolean).map((j, i) => { const joueur = typeof j === 'string' ? trouverJoueur(j) : j; return joueur ? <CarteJoueurLigne key={i} joueur={joueur} onSelect={onSelect} estChaud={false} isMobile={isMobile} /> : null; })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#f97316', marginBottom: '4px' }}>PP2</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                  {(dfData?.pp_units?.PP2?.slice(0,3) || forwards.slice(3, 6)).filter(Boolean).map((j, i) => { const joueur = typeof j === 'string' ? trouverJoueur(j) : j; return joueur ? <CarteJoueurLigne key={i} joueur={joueur} onSelect={onSelect} estChaud={false} isMobile={isMobile} /> : null; })}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(dfData?.pp_units?.PP2?.slice(3) || [defenseurs[2], defenseurs[3]]).filter(Boolean).map((j, i) => { const joueur = typeof j === 'string' ? trouverJoueur(j) : j; return joueur ? <CarteJoueurLigne key={i} joueur={joueur} onSelect={onSelect} estChaud={false} isMobile={isMobile} /> : null; })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
 
function CarteMatchJoueurs({ match, filtre, onSelectJoueur, lineupDF }) {
  const isMobile = useIsMobile();
  const [ouvert, setOuvert] = useState(false);
  const [roster1, setRoster1] = useState([]);
  const [roster2, setRoster2] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [ongletEquipe, setOngletEquipe] = useState(0);
  const [sourceData, setSourceData] = useState('');
  const chargementLance = useRef(false);
   
  const abbrev1 = match.awayTeam?.abbrev;
  const abbrev2 = match.homeTeam?.abbrev;
  const nom1 = match.awayTeam?.commonName?.default || abbrev1;
  const nom2 = match.homeTeam?.commonName?.default || abbrev2;
  const heure = new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const etat = match.gameState;
 
  useEffect(() => {
    if (filtre && filtre.length >= 2) {
      const f = filtre.toLowerCase();
      const correspond = abbrev1.toLowerCase().includes(f) || abbrev2.toLowerCase().includes(f) || nom1.toLowerCase().includes(f) || nom2.toLowerCase().includes(f);
      if (correspond) { setOuvert(true); if (!chargementLance.current) chargerRosters(); }
    }
  }, [filtre]);
 
  async function chargerStatsEnBatch(joueurs, setRoster) {
    const batchSize = 5;
    const result = [...joueurs];
    for (let i = 0; i < joueurs.length; i += batchSize) {
      const batch = joueurs.slice(i, i + batchSize);
      const stats = await Promise.all(batch.map(async (j) => {
        try {
          const res = await fetch(getUrl(`player/${j.id}/landing`));
          const data = await res.json();
          const saisonJoueur = data.featuredStats?.regularSeason?.subSeason;
          const isGardien = j.position === 'G';
          return { ...j, goals: isGardien ? null : (saisonJoueur?.goals ?? 0), assists: isGardien ? null : (saisonJoueur?.assists ?? 0), points: isGardien ? null : (saisonJoueur?.points ?? 0), gaa: isGardien ? (saisonJoueur?.goalsAgainstAvg?.toFixed(2) ?? '-') : null, svp: isGardien ? (saisonJoueur?.savePctg ? (saisonJoueur.savePctg * 100).toFixed(1) + '%' : '-') : null };
        } catch { return j; }
      }));
      stats.forEach((s, idx) => { result[i + idx] = s; });
      setRoster([...result]);
    }
  }
 
  async function chargerDepuisRoster() {
    const [r1, r2] = await Promise.all([fetch(getUrl(`roster/${abbrev1}/current`)), fetch(getUrl(`roster/${abbrev2}/current`))]);
    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
    const fmt = (data, equipe) => [...(data.forwards || []), ...(data.defensemen || []), ...(data.goalies || [])].map(j => ({ id: j.id, nom: `${j.firstName?.default || ''} ${j.lastName?.default || ''}`.trim(), numero: j.sweaterNumber || '', position: j.positionCode || '', equipe, ligne: null, goals: null, assists: null, points: null, gaa: null, svp: null }));
    return { j1: fmt(d1, abbrev1), j2: fmt(d2, abbrev2) };
  }
 
  async function chargerRosters() {
    if (chargementLance.current) return;
    chargementLance.current = true;
    setChargement(true);
    try {
      const gameId = match.id;
      let joueurs1 = [], joueurs2 = [], utiliséBoxscore = false;
      try {
        const res = await fetch(getUrl(`gamecenter/${gameId}/boxscore`));
        const data = await res.json();
        const awayRaw = [...(data.playerByGameStats?.awayTeam?.forwards || []), ...(data.playerByGameStats?.awayTeam?.defense || []), ...(data.playerByGameStats?.awayTeam?.goalies || [])];
        const homeRaw = [...(data.playerByGameStats?.homeTeam?.forwards || []), ...(data.playerByGameStats?.homeTeam?.defense || []), ...(data.playerByGameStats?.homeTeam?.goalies || [])];
        if (awayRaw.length > 0) {
          const fmt = (joueurs, equipe) => joueurs.map(j => ({ id: j.playerId || j.id, nom: j.name?.default || `${j.firstName?.default || j.firstName || ''} ${j.lastName?.default || j.lastName || ''}`.trim() || 'Joueur', numero: j.sweaterNumber || j.jerseyNumber || '', position: j.position || j.positionCode || '', equipe, ligne: j.lineNumber || null, goals: null, assists: null, points: null, gaa: null, svp: null })).filter(j => j.id && j.nom !== 'Joueur');
          joueurs1 = fmt(awayRaw, abbrev1);
          joueurs2 = fmt(homeRaw, abbrev2);
          utiliséBoxscore = true;
        }
      } catch (e) { }
      if (joueurs1.length === 0) { const fallback = await chargerDepuisRoster(); joueurs1 = fallback.j1; joueurs2 = fallback.j2; }
      setSourceData(utiliséBoxscore ? 'live' : 'roster');
      setRoster1(joueurs1); setRoster2(joueurs2);
      setChargement(false);
      chargerStatsEnBatch(joueurs1, setRoster1);
      chargerStatsEnBatch(joueurs2, setRoster2);
    } catch (err) {
      console.error(err);
      try { const fallback = await chargerDepuisRoster(); setRoster1(fallback.j1); setRoster2(fallback.j2); chargerStatsEnBatch(fallback.j1, setRoster1); chargerStatsEnBatch(fallback.j2, setRoster2); } catch (e) { }
      setChargement(false);
    }
  }
 
  function handleOuvrir() {
    const nouvelEtat = !ouvert;
    setOuvert(nouvelEtat);
    if (nouvelEtat && !chargementLance.current) chargerRosters();
  }
 
  const filtrerJoueurs = (joueurs) => {
    if (!filtre || filtre.length < 2) return joueurs;
    const f = filtre.toLowerCase();
    if (abbrev1.toLowerCase().includes(f) || nom1.toLowerCase().includes(f) || abbrev2.toLowerCase().includes(f) || nom2.toLowerCase().includes(f)) return joueurs;
    return joueurs.filter(j => j.nom.toLowerCase().includes(f));
  };
 
  return (
    <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', overflow: 'hidden', marginBottom: '10px' }}>
      <div onClick={handleOuvrir} style={{ padding: isMobile ? '12px 14px' : '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 'bold', fontSize: isMobile ? '13px' : '14px' }}>{isMobile ? abbrev1 : nom1}</span>
          </div>
          <span style={{ color: '#444', fontWeight: 'bold', fontSize: '13px' }}>@</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: isMobile ? '13px' : '14px' }}>{isMobile ? abbrev2 : nom2}</span>
            <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {etat === 'LIVE' || etat === 'CRIT'
            ? <span style={{ backgroundColor: '#1a0000', color: '#ef4444', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>LIVE</span>
            : <span style={{ color: '#666', fontSize: '12px' }}>{heure}</span>}
          <span style={{ color: ouvert ? '#f97316' : '#444', fontSize: '11px' }}>{ouvert ? '▲' : '▼'}</span>
        </div>
      </div>
      {ouvert && (
        <div style={{ borderTop: '1px solid #222', padding: isMobile ? '14px' : '20px' }}>
          {chargement ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>Chargement...</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ abbrev: abbrev1, logo: LOGOS_NHL[abbrev1] }, { abbrev: abbrev2, logo: LOGOS_NHL[abbrev2] }].map((eq, i) => (
                    <button key={i} onClick={() => setOngletEquipe(i)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: ongletEquipe === i ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '12px', fontWeight: ongletEquipe === i ? 'bold' : 'normal' }}>
                      <img src={eq.logo} alt={eq.abbrev} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                      {eq.abbrev}
                    </button>
                  ))}
                </div>
                {sourceData === 'live' && <span style={{ fontSize: '10px', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', padding: '3px 8px', borderRadius: '20px' }}>En direct</span>}
              </div>
              {ongletEquipe === 0 && filtrerJoueurs(roster1).length > 0 && <AlignementEquipe abbrev={abbrev1} nom={nom1} logo={LOGOS_NHL[abbrev1]} joueurs={filtrerJoueurs(roster1)} onSelect={onSelectJoueur} isMobile={isMobile} lineupDF={lineupDF} />}
              {ongletEquipe === 1 && filtrerJoueurs(roster2).length > 0 && <AlignementEquipe abbrev={abbrev2} nom={nom2} logo={LOGOS_NHL[abbrev2]} joueurs={filtrerJoueurs(roster2)} onSelect={onSelectJoueur} isMobile={isMobile} lineupDF={lineupDF} />}
              {((ongletEquipe === 0 && filtrerJoueurs(roster1).length === 0) || (ongletEquipe === 1 && filtrerJoueurs(roster2).length === 0)) && <p style={{ color: '#666', textAlign: 'center' }}>Aucun joueur trouve.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
 
function FiltreSelect({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: 'white', fontSize: '12px', outline: 'none', minWidth: '140px' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const OPTIONS_EQUIPES = [{ value: 'ALL', label: 'All Franchises' }, ...Object.keys(LOGOS_NHL).sort().map(a => ({ value: a, label: a }))];
const OPTIONS_TYPE = [{ value: 'reg', label: 'Saison régulière' }, { value: 'playoffs', label: 'Playoffs' }];
const OPTIONS_POSITION = [{ value: 'ALL', label: 'Tous' }, { value: 'C', label: 'Centre' }, { value: 'L', label: 'Ailier gauche' }, { value: 'R', label: 'Ailier droit' }, { value: 'D', label: 'Défenseur' }];

function ListeMeneurs({ titre, joueurs, statKey, onSelectJoueur }) {
  if (!joueurs || joueurs.length === 0) return <p style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>Aucune donnee.</p>;
  const [premier, ...reste] = joueurs;
  return (
    <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: '16px', marginBottom: '14px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '900', color: '#f97316' }}>{titre}</h3>
      <div
        onClick={() => onSelectJoueur({ id: premier.id, nom: premier.nom, position: premier.position, equipe: premier.equipe, numero: '' })}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', padding: '12px', cursor: 'pointer', marginBottom: '8px' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
      >
        <img src={LOGOS_NHL[premier.equipe]} alt={premier.equipe} style={{ width: '56px', height: '56px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '900', fontSize: '15px', color: 'white' }}>{premier.nom}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{premier.equipe}</div>
        </div>
        <div style={{ fontSize: '24px', fontWeight: '900', color: '#f97316' }}>{premier[statKey]}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {reste.map(j => (
          <div
            key={j.id}
            onClick={() => onSelectJoueur({ id: j.id, nom: j.nom, position: j.position, equipe: j.equipe, numero: '' })}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1a1a1a'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span style={{ width: '18px', color: '#555', fontSize: '12px', fontWeight: 'bold' }}>{j.rang}</span>
            <span style={{ flex: 1, fontSize: '13px', color: 'white' }}>{j.nom} <span style={{ color: '#666' }}>· {j.equipe}</span></span>
            <span style={{ fontWeight: '900', fontSize: '13px', color: '#f97316' }}>{j[statKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OngletHomeStats({ onSelectJoueur }) {
  const [filtreType, setFiltreType] = useState('reg');
  const [filtreEquipe, setFiltreEquipe] = useState('ALL');
  const [chargement, setChargement] = useState(false);
  const [meneurs, setMeneurs] = useState({ points: [], goals: [], assists: [] });

  useEffect(() => { chargerMeneurs(); }, []);

  async function chargerMeneurs() {
    setChargement(true);
    try {
      const gameType = filtreType === 'playoffs' ? 3 : 2;
      const cayenneExp = buildCayenneExp({ gameType, teamAbbrev: filtreEquipe });
      const fetchCat = (sort) => fetch(getStatsRestUrl(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=${encodeURIComponent(cayenneExp)}&sort=${sort}&dir=DESC&start=0&limit=10`)).then(r => r.json());
      const [dPoints, dGoals, dAssists] = await Promise.all([fetchCat('points'), fetchCat('goals'), fetchCat('assists')]);
      const fmt = (d) => (d.data || []).map((j, i) => ({ rang: i + 1, id: j.playerId, nom: j.skaterFullName, equipe: j.teamAbbrevs, position: j.positionCode, points: j.points, goals: j.goals, assists: j.assists }));
      setMeneurs({ points: fmt(dPoints), goals: fmt(dGoals), assists: fmt(dAssists) });
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '18px' }}>
        <FiltreSelect label="Année" value="2025-26" onChange={() => {}} options={[{ value: '2025-26', label: '2025-26' }]} disabled />
        <FiltreSelect label="Type" value={filtreType} onChange={setFiltreType} options={OPTIONS_TYPE} />
        <FiltreSelect label="Équipe" value={filtreEquipe} onChange={setFiltreEquipe} options={OPTIONS_EQUIPES} />
        <button onClick={chargerMeneurs} style={{ padding: '9px 18px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Get Stats</button>
      </div>
      {chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : (
        <>
          <ListeMeneurs titre="Points" joueurs={meneurs.points} statKey="points" onSelectJoueur={onSelectJoueur} />
          <ListeMeneurs titre="Buts" joueurs={meneurs.goals} statKey="goals" onSelectJoueur={onSelectJoueur} />
          <ListeMeneurs titre="Passes" joueurs={meneurs.assists} statKey="assists" onSelectJoueur={onSelectJoueur} />
        </>
      )}
    </div>
  );
}

function OngletSkatersStats({ onSelectJoueur }) {
  const isMobile = useIsMobile();
  const [filtreType, setFiltreType] = useState('reg');
  const [filtreEquipe, setFiltreEquipe] = useState('ALL');
  const [filtrePosition, setFiltrePosition] = useState('ALL');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [joueurs, setJoueurs] = useState([]);
  const [chargement, setChargement] = useState(false);

  useEffect(() => { chargerSkaters(0); }, []);

  async function chargerSkaters(nouvellePage) {
    setChargement(true);
    try {
      const gameType = filtreType === 'playoffs' ? 3 : 2;
      const cayenneExp = buildCayenneExp({ gameType, teamAbbrev: filtreEquipe, positionCode: filtrePosition });
      const start = nouvellePage * 50;
      const res = await fetch(getStatsRestUrl(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=${encodeURIComponent(cayenneExp)}&sort=points&dir=DESC&start=${start}&limit=50`));
      const data = await res.json();
      setJoueurs((data.data || []).map((j, i) => ({ rang: start + i + 1, id: j.playerId, nom: j.skaterFullName, equipe: j.teamAbbrevs, position: j.positionCode, gp: j.gamesPlayed, goals: j.goals, assists: j.assists, points: j.points })));
      setTotal(data.total || 0);
      setPage(nouvellePage);
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  const colonnes = isMobile ? '30px 32px 1fr 40px 34px 34px' : '36px 36px 1fr 56px 56px 40px 40px 40px 48px';

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '18px' }}>
        <FiltreSelect label="Année" value="2025-26" onChange={() => {}} options={[{ value: '2025-26', label: '2025-26' }]} disabled />
        <FiltreSelect label="Type" value={filtreType} onChange={setFiltreType} options={OPTIONS_TYPE} />
        <FiltreSelect label="Équipe" value={filtreEquipe} onChange={setFiltreEquipe} options={OPTIONS_EQUIPES} />
        <FiltreSelect label="Position" value={filtrePosition} onChange={setFiltrePosition} options={OPTIONS_POSITION} />
        <button onClick={() => chargerSkaters(0)} style={{ padding: '9px 18px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Get Stats</button>
      </div>
      {chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : (
        <>
          <div style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #222', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colonnes, gap: '6px', padding: '10px 12px', backgroundColor: '#0d0d0d', borderBottom: '1px solid #222', fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>
              <span>#</span><span></span><span>Nom</span><span>Équipe</span>{!isMobile && <span>Pos</span>}<span>PJ</span><span>B</span><span>A</span><span>PTS</span>
            </div>
            {joueurs.map(j => (
              <div
                key={j.id}
                onClick={() => onSelectJoueur({ id: j.id, nom: j.nom, position: j.position, equipe: j.equipe, numero: '' })}
                style={{ display: 'grid', gridTemplateColumns: colonnes, gap: '6px', padding: '8px 12px', alignItems: 'center', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontSize: '12px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ color: '#555' }}>{j.rang}</span>
                <img src={LOGOS_NHL[j.equipe]} alt={j.equipe} style={{ width: '26px', height: '26px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <span style={{ color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nom}</span>
                <span style={{ color: '#888' }}>{j.equipe}</span>
                {!isMobile && <span style={{ color: '#888' }}>{j.position}</span>}
                <span style={{ color: '#888' }}>{j.gp}</span>
                <span style={{ color: '#888' }}>{j.goals}</span>
                <span style={{ color: '#888' }}>{j.assists}</span>
                <span style={{ color: '#f97316', fontWeight: '900' }}>{j.points}</span>
              </div>
            ))}
            {joueurs.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>Aucune donnee.</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
            <button onClick={() => page > 0 && chargerSkaters(page - 1)} disabled={page === 0} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: page === 0 ? 'default' : 'pointer', backgroundColor: '#1a1a1a', color: page === 0 ? '#444' : 'white', fontSize: '12px' }}>Page précédente</button>
            <span style={{ color: '#666', fontSize: '12px' }}>{total > 0 ? `${page * 50 + 1}-${Math.min((page + 1) * 50, total)} / ${total}` : ''}</span>
            <button onClick={() => (page + 1) * 50 < total && chargerSkaters(page + 1)} disabled={(page + 1) * 50 >= total} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: (page + 1) * 50 >= total ? 'default' : 'pointer', backgroundColor: '#1a1a1a', color: (page + 1) * 50 >= total ? '#444' : 'white', fontSize: '12px' }}>Page suivante</button>
          </div>
        </>
      )}
    </div>
  );
}

function OngletGoaliesStats({ onSelectJoueur }) {
  const [filtreType, setFiltreType] = useState('reg');
  const [filtreEquipe, setFiltreEquipe] = useState('ALL');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [gardiens, setGardiens] = useState([]);
  const [chargement, setChargement] = useState(false);

  useEffect(() => { chargerGoalies(0); }, []);

  async function chargerGoalies(nouvellePage) {
    setChargement(true);
    try {
      const gameType = filtreType === 'playoffs' ? 3 : 2;
      const cayenneExp = buildCayenneExp({ gameType, teamAbbrev: filtreEquipe });
      const start = nouvellePage * 50;
      const res = await fetch(getStatsRestUrl(`https://api.nhle.com/stats/rest/en/goalie/summary?cayenneExp=${encodeURIComponent(cayenneExp)}&sort=goalsAgainstAverage&dir=ASC&start=${start}&limit=50`));
      const data = await res.json();
      setGardiens((data.data || []).map((j, i) => ({ rang: start + i + 1, id: j.playerId, nom: j.goalieFullName, equipe: j.teamAbbrevs, gp: j.gamesPlayed, gaa: j.goalsAgainstAverage?.toFixed(2), svp: j.savePct != null ? (j.savePct * 100).toFixed(1) + '%' : '-' })));
      setTotal(data.total || 0);
      setPage(nouvellePage);
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  const colonnes = '36px 36px 1fr 56px 40px 56px 56px';

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '18px' }}>
        <FiltreSelect label="Année" value="2025-26" onChange={() => {}} options={[{ value: '2025-26', label: '2025-26' }]} disabled />
        <FiltreSelect label="Type" value={filtreType} onChange={setFiltreType} options={OPTIONS_TYPE} />
        <FiltreSelect label="Équipe" value={filtreEquipe} onChange={setFiltreEquipe} options={OPTIONS_EQUIPES} />
        <button onClick={() => chargerGoalies(0)} style={{ padding: '9px 18px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Get Stats</button>
      </div>
      {chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : (
        <>
          <div style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #222', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colonnes, gap: '6px', padding: '10px 12px', backgroundColor: '#0d0d0d', borderBottom: '1px solid #222', fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>
              <span>#</span><span></span><span>Nom</span><span>Équipe</span><span>PJ</span><span>GAA</span><span>SV%</span>
            </div>
            {gardiens.map(j => (
              <div
                key={j.id}
                onClick={() => onSelectJoueur({ id: j.id, nom: j.nom, position: 'G', equipe: j.equipe, numero: '' })}
                style={{ display: 'grid', gridTemplateColumns: colonnes, gap: '6px', padding: '8px 12px', alignItems: 'center', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontSize: '12px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ color: '#555' }}>{j.rang}</span>
                <img src={LOGOS_NHL[j.equipe]} alt={j.equipe} style={{ width: '26px', height: '26px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <span style={{ color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nom}</span>
                <span style={{ color: '#888' }}>{j.equipe}</span>
                <span style={{ color: '#888' }}>{j.gp}</span>
                <span style={{ color: '#f97316', fontWeight: '900' }}>{j.gaa}</span>
                <span style={{ color: '#888' }}>{j.svp}</span>
              </div>
            ))}
            {gardiens.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>Aucune donnee.</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
            <button onClick={() => page > 0 && chargerGoalies(page - 1)} disabled={page === 0} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: page === 0 ? 'default' : 'pointer', backgroundColor: '#1a1a1a', color: page === 0 ? '#444' : 'white', fontSize: '12px' }}>Page précédente</button>
            <span style={{ color: '#666', fontSize: '12px' }}>{total > 0 ? `${page * 50 + 1}-${Math.min((page + 1) * 50, total)} / ${total}` : ''}</span>
            <button onClick={() => (page + 1) * 50 < total && chargerGoalies(page + 1)} disabled={(page + 1) * 50 >= total} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: (page + 1) * 50 >= total ? 'default' : 'pointer', backgroundColor: '#1a1a1a', color: (page + 1) * 50 >= total ? '#444' : 'white', fontSize: '12px' }}>Page suivante</button>
          </div>
        </>
      )}
    </div>
  );
}

function PageStatsJoueurs({ onSelectJoueur }) {
  const [matchsParJour, setMatchsParJour] = useState({});
  const [jourActif, setJourActif] = useState('');
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');
  const [recherchJoueurs, setRechercheJoueurs] = useState([]);
  const lineupDF = useLineupsDailyFaceoff();
  const [ongletSaisonMorte, setOngletSaisonMorte] = useState('home');
  const [ongletJoueurs, setOngletJoueurs] = useState('lineups');
  const [props, setProps] = useState([]);
  const [chargementProps, setChargementProps] = useState(false);

  useEffect(() => { chargerSemaine(); }, []);

  useEffect(() => {
    if (ongletJoueurs === 'props' && Object.keys(matchsParJour).length > 0) chargerProps();
  }, [ongletJoueurs, matchsParJour]);

  async function chargerSemaine() {
    setChargement(true);
    const aujourdhui = new Date();
    const jours = Array(7).fill(null).map((_, i) => { const d = new Date(aujourdhui); d.setDate(d.getDate() + i); return getDateStr(d); });
    const resultats = {};
    await Promise.all(jours.map(async (jour) => {
      try {
        const res = await fetch(getUrl(`schedule/${jour}`));
        const data = await res.json();
        const games = data.gameWeek?.[0]?.games || [];
        if (games.length > 0) resultats[jour] = games;
      } catch (err) { }
    }));
    setMatchsParJour(resultats);
    setJourActif(Object.keys(resultats).sort()[0] || jours[0]);
    setChargement(false);
  }

  async function chargerProps() {
    setChargementProps(true);
    try {
      const aujourd = getDateStr(new Date());
      const prochainJour = Object.keys(matchsParJour).sort().find(j => matchsParJour[j]?.length > 0) || aujourd;
      const matchsDuJour = matchsParJour[prochainJour] || [];
      if (matchsDuJour.length === 0) { setChargementProps(false); return; }
      const joueursDuJour = [];
      for (const match of matchsDuJour) {
        for (const abbrev of [match.awayTeam?.abbrev, match.homeTeam?.abbrev]) {
          if (!abbrev) continue;
          try {
            const res = await fetch(getUrl('roster/' + abbrev + '/' + SAISON_REG_2526.seasonId));
            const data = await res.json();
            (data.forwards || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'F' }));
            (data.defensemen || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'D' }));
          } catch {}
        }
      }
      const resultats = [];
      for (let i = 0; i < Math.min(joueursDuJour.length, 80); i += 5) {
        const batch = joueursDuJour.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(async (j) => {
          try {
            const res = await fetch(getUrl('player/' + j.id + '/game-log/' + SAISON_REG_2526.seasonId + '/' + SAISON_REG_2526.gameType));
            const data = await res.json();
            const log = (data.gameLog || []).slice(0, 20);
            if (log.length < 5) return null;
            const l5 = log.slice(0, 5);
            const l10 = log.slice(0, Math.min(10, log.length));
            const l20 = log.slice(0, Math.min(20, log.length));
            const hit = (games, stat, line) => games.filter(g => (g[stat] || 0) > line).length / games.length;
            const candidates = [];
            for (const line of [1.5, 2.5, 3.5]) {
              const r5=hit(l5,'shots',line), r10=hit(l10,'shots',line), r20=hit(l20,'shots',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'SOG', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5, 1.5]) {
              const r5=hit(l5,'points',line), r10=hit(l10,'points',line), r20=hit(l20,'points',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'PTS', line, prob, r5, r10, r20 });
            }
            const r5g=hit(l5,'goals',0.5), r10g=hit(l10,'goals',0.5), r20g=hit(l20,'goals',0.5);
            const probG = r5g*0.45 + r10g*0.33 + r20g*0.22;
            if (probG >= 0.55) candidates.push({ stat: 'GOAL', line: 0.5, prob: probG, r5: r5g, r10: r10g, r20: r20g });
            if (candidates.length === 0) return null;
            const best = candidates.sort((a,b) => b.prob-a.prob)[0];
            const nom = ((j.firstName?.default||'') + ' ' + (j.lastName?.default||'')).trim();
            return { id: j.id, nom, equipe: j.equipe, position: j.position, ...best };
          } catch { return null; }
        }));
        resultats.push(...batchRes.filter(Boolean));
      }
      setProps(resultats.sort((a,b) => b.prob-a.prob));
    } catch (err) { console.error(err); }
    setChargementProps(false);
  }

  async function rechercherJoueur(query) {
    if (query.length < 2) { setRechercheJoueurs([]); return; }
    try {
      const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=fr-CA&limit=10&q=${encodeURIComponent(query)}&active=true`);
      const data = await res.json();
      setRechercheJoueurs(data || []);
    } catch { setRechercheJoueurs([]); }
  }

  const jours = Object.keys(matchsParJour).sort();
  const aucunMatch = !chargement && jours.length === 0;

  return (
    <div>
      <div style={{ marginBottom: '14px', position: 'relative' }}>
        <input
          style={{ width: '100%', padding: '11px 14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          placeholder="Search players..."
          value={filtre}
          onChange={e => { setFiltre(e.target.value); rechercherJoueur(e.target.value); }}
        />
        {recherchJoueurs.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1a1a', borderRadius: '10px', border: '1px solid #333', marginTop: '4px', overflow: 'hidden', zIndex: 100 }}>
            {recherchJoueurs.map((j, i) => (
              <div key={i}
                onClick={() => { onSelectJoueur({ id: j.playerId, nom: j.name, position: j.positionCode, equipe: j.teamAbbrev || '', numero: j.sweaterNumber || '' }); setRechercheJoueurs([]); setFiltre(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: i < recherchJoueurs.length - 1 ? '1px solid #222' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#222'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <img src={LOGOS_NHL[j.teamAbbrev]} alt={j.teamAbbrev} style={{ width: '36px', height: '36px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'white' }}>{j.name}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{j.teamAbbrev} · {j.positionCode}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : aucunMatch ? (
        <>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
            <button onClick={() => setOngletSaisonMorte('home')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletSaisonMorte === 'home' ? '#f97316' : 'transparent', color: ongletSaisonMorte === 'home' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletSaisonMorte === 'home' ? '600' : 'normal' }}>Home</button>
            <button onClick={() => setOngletSaisonMorte('skaters')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletSaisonMorte === 'skaters' ? '#f97316' : 'transparent', color: ongletSaisonMorte === 'skaters' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletSaisonMorte === 'skaters' ? '600' : 'normal' }}>Skaters</button>
            <button onClick={() => setOngletSaisonMorte('goalies')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletSaisonMorte === 'goalies' ? '#f97316' : 'transparent', color: ongletSaisonMorte === 'goalies' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletSaisonMorte === 'goalies' ? '600' : 'normal' }}>Goalies</button>
          </div>
          {ongletSaisonMorte === 'home' && <OngletHomeStats onSelectJoueur={onSelectJoueur} />}
          {ongletSaisonMorte === 'skaters' && <OngletSkatersStats onSelectJoueur={onSelectJoueur} />}
          {ongletSaisonMorte === 'goalies' && <OngletGoaliesStats onSelectJoueur={onSelectJoueur} />}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
            <button onClick={() => setOngletJoueurs('props')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletJoueurs === 'props' ? '#f97316' : 'transparent', color: ongletJoueurs === 'props' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletJoueurs === 'props' ? '600' : 'normal' }}>Props</button>
            <button onClick={() => setOngletJoueurs('lineups')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletJoueurs === 'lineups' ? '#f97316' : 'transparent', color: ongletJoueurs === 'lineups' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletJoueurs === 'lineups' ? '600' : 'normal' }}>Lineups</button>
          </div>

          {ongletJoueurs === 'props' && (
            <div>
              {chargementProps ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Calculating props...</p>
              ) : props.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>No props available for today.</p>
              ) : props.map((p, i) => (
                <div key={p.id} onClick={() => onSelectJoueur({ id: p.id, nom: p.nom, position: p.position, equipe: p.equipe, numero: '' })}
                  style={{ backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '14px 16px', border: '1px solid #161616', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#161616'}
                >
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#555', minWidth: '28px' }}>#{i+1}</div>
                  <img src={'https://assets.nhle.com/mugs/' + p.id + '.png'} alt={p.nom} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#1a1a1a' }} onError={e => e.target.style.display='none'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'white', marginBottom: '2px' }}>{p.nom}</div>
                    <div style={{ fontSize: '12px', color: '#555' }}>{p.equipe} · {p.position}</div>
                  </div>
                  <div style={{ textAlign: 'center', backgroundColor: '#111', borderRadius: '8px', padding: '8px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>Over {p.line} {p.stat}</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: p.prob >= 0.75 ? '#22c55e' : p.prob >= 0.65 ? '#f97316' : '#888', letterSpacing: '-0.5px' }}>{Math.round(p.prob * 100)}%</div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>L5:{Math.round(p.r5*100)}% L10:{Math.round(p.r10*100)}% L20:{Math.round(p.r20*100)}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {ongletJoueurs === 'lineups' && (
            <>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
                {jours.map(jour => {
                  const d = new Date(jour + 'T12:00:00');
                  const estAujourdhui = jour === getDateStr(new Date());
                  const label = estAujourdhui ? "Today" : d.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' });
                  const nb = matchsParJour[jour]?.length || 0;
                  return (
                    <button key={jour} onClick={() => setJourActif(jour)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: jourActif === jour ? '#f97316' : '#1a1a1a', color: jourActif === jour ? 'white' : '#888', fontSize: '12px', fontWeight: jourActif === jour ? 'bold' : 'normal' }}>
                      {label}
                      <span style={{ display: 'block', fontSize: '10px', color: jourActif === jour ? 'rgba(255,255,255,0.8)' : '#555' }}>{nb}G</span>
                    </button>
                  );
                })}
              </div>
              {(matchsParJour[jourActif] || []).map((match, i) => <CarteMatchJoueurs key={`${jourActif}-${i}`} match={match} filtre={filtre} onSelectJoueur={onSelectJoueur} lineupDF={lineupDF} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

// Detecte automatiquement si les matchs disponibles sont en saison reguliere (gameType 2) ou en playoffs (gameType 3).
function detecterSaisonMatchs(matchsParJour) {
  const premierMatch = Object.values(matchsParJour).flat()[0];
  return premierMatch?.gameType === 3 ? SAISON_PO_2526 : SAISON_REG_2526;
}

// Version de PageStatsJoueurs dediee a l'onglet Analyses : onglet Props restaure, detection auto saison/playoffs,
// pas de fallback Home/Skaters/Goalies (les onglets jours/matchs restent affiches meme vides en morte-saison).
function PageStatsJoueursAnalyses({ onSelectJoueur }) {
  const [matchsParJour, setMatchsParJour] = useState({});
  const [jourActif, setJourActif] = useState('');
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');
  const [recherchJoueurs, setRechercheJoueurs] = useState([]);
  const lineupDF = useLineupsDailyFaceoff();
  const [ongletJoueurs, setOngletJoueurs] = useState('matchups');
  const [props, setProps] = useState([]);
  const [chargementProps, setChargementProps] = useState(false);

  useEffect(() => { chargerSemaine(); }, []);

  useEffect(() => {
    if (Object.keys(matchsParJour).length > 0) chargerProps();
  }, [matchsParJour]);

  async function chargerSemaine() {
    setChargement(true);
    const aujourdhui = new Date();
    const jours = Array(7).fill(null).map((_, i) => { const d = new Date(aujourdhui); d.setDate(d.getDate() + i); return getDateStr(d); });
    const resultats = {};
    await Promise.all(jours.map(async (jour) => {
      try {
        const res = await fetch(getUrl(`schedule/${jour}`));
        const data = await res.json();
        const games = data.gameWeek?.[0]?.games || [];
        if (games.length > 0) resultats[jour] = games;
      } catch (err) { }
    }));
    setMatchsParJour(resultats);
    setJourActif(Object.keys(resultats).sort()[0] || jours[0]);
    setChargement(false);
  }

  async function chargerProps() {
    setChargementProps(true);
    try {
      const saisonDetectee = detecterSaisonMatchs(matchsParJour);
      const aujourd = getDateStr(new Date());
      const prochainJour = Object.keys(matchsParJour).sort().find(j => matchsParJour[j]?.length > 0) || aujourd;
      const matchsDuJour = matchsParJour[prochainJour] || [];
      if (matchsDuJour.length === 0) { setChargementProps(false); return; }
      const joueursDuJour = [];
      for (const match of matchsDuJour) {
        for (const abbrev of [match.awayTeam?.abbrev, match.homeTeam?.abbrev]) {
          if (!abbrev) continue;
          try {
            const res = await fetch(getUrl('roster/' + abbrev + '/' + saisonDetectee.seasonId));
            const data = await res.json();
            (data.forwards || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'F' }));
            (data.defensemen || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'D' }));
          } catch {}
        }
      }
      const resultats = [];
      for (let i = 0; i < Math.min(joueursDuJour.length, 80); i += 5) {
        const batch = joueursDuJour.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(async (j) => {
          try {
            const res = await fetch(getUrl('player/' + j.id + '/game-log/' + saisonDetectee.seasonId + '/' + saisonDetectee.gameType));
            const data = await res.json();
            const log = (data.gameLog || []).slice(0, 20);
            if (log.length < 5) return null;
            const l5 = log.slice(0, 5);
            const l10 = log.slice(0, Math.min(10, log.length));
            const l20 = log.slice(0, Math.min(20, log.length));
            const hit = (games, stat, line) => games.filter(g => (g[stat] || 0) > line).length / games.length;
            const candidates = [];
            for (const line of [1.5, 2.5, 3.5]) {
              const r5=hit(l5,'shots',line), r10=hit(l10,'shots',line), r20=hit(l20,'shots',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'SOG', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5, 1.5]) {
              const r5=hit(l5,'points',line), r10=hit(l10,'points',line), r20=hit(l20,'points',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'PTS', line, prob, r5, r10, r20 });
            }
            const r5g=hit(l5,'goals',0.5), r10g=hit(l10,'goals',0.5), r20g=hit(l20,'goals',0.5);
            const probG = r5g*0.45 + r10g*0.33 + r20g*0.22;
            if (probG >= 0.55) candidates.push({ stat: 'GOAL', line: 0.5, prob: probG, r5: r5g, r10: r10g, r20: r20g });
            if (candidates.length === 0) return null;
            const best = candidates.sort((a,b) => b.prob-a.prob)[0];
            const nom = ((j.firstName?.default||'') + ' ' + (j.lastName?.default||'')).trim();
            return { id: j.id, nom, equipe: j.equipe, position: j.position, ...best };
          } catch { return null; }
        }));
        resultats.push(...batchRes.filter(Boolean));
      }
      setProps(resultats.sort((a,b) => b.prob-a.prob));
    } catch (err) { console.error(err); }
    setChargementProps(false);
  }

  async function rechercherJoueur(query) {
    if (query.length < 2) { setRechercheJoueurs([]); return; }
    try {
      const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=fr-CA&limit=10&q=${encodeURIComponent(query)}&active=true`);
      const data = await res.json();
      setRechercheJoueurs(data || []);
    } catch { setRechercheJoueurs([]); }
  }

  return (
    <div>
      <div style={{ marginBottom: '14px', position: 'relative' }}>
        <input
          style={{ width: '100%', padding: '11px 14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          placeholder="Search players..."
          value={filtre}
          onChange={e => { setFiltre(e.target.value); rechercherJoueur(e.target.value); }}
        />
        {recherchJoueurs.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1a1a', borderRadius: '10px', border: '1px solid #333', marginTop: '4px', overflow: 'hidden', zIndex: 100 }}>
            {recherchJoueurs.map((j, i) => (
              <div key={i}
                onClick={() => { onSelectJoueur({ id: j.playerId, nom: j.name, position: j.positionCode, equipe: j.teamAbbrev || '', numero: j.sweaterNumber || '' }); setRechercheJoueurs([]); setFiltre(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: i < recherchJoueurs.length - 1 ? '1px solid #222' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#222'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <img src={LOGOS_NHL[j.teamAbbrev]} alt={j.teamAbbrev} style={{ width: '36px', height: '36px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'white' }}>{j.name}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{j.teamAbbrev} · {j.positionCode}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
        <button onClick={() => setOngletJoueurs('matchups')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletJoueurs === 'matchups' ? '#f97316' : 'transparent', color: ongletJoueurs === 'matchups' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletJoueurs === 'matchups' ? '600' : 'normal' }}>Matchups</button>
        <button onClick={() => setOngletJoueurs('props')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletJoueurs === 'props' ? '#f97316' : 'transparent', color: ongletJoueurs === 'props' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletJoueurs === 'props' ? '600' : 'normal' }}>Props</button>
      </div>

      {ongletJoueurs === 'props' && (
        <div>
          {chargement ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
          ) : chargementProps ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Calculating props...</p>
          ) : props.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>No props available for today.</p>
          ) : props.map((p, i) => (
            <div key={p.id} onClick={() => onSelectJoueur({ id: p.id, nom: p.nom, position: p.position, equipe: p.equipe, numero: '' })}
              style={{ backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '14px 16px', border: '1px solid #161616', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#161616'}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#555', minWidth: '28px' }}>#{i+1}</div>
              <img src={'https://assets.nhle.com/mugs/' + p.id + '.png'} alt={p.nom} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#1a1a1a' }} onError={e => e.target.style.display='none'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: 'white', marginBottom: '2px' }}>{p.nom}</div>
                <div style={{ fontSize: '12px', color: '#555' }}>{p.equipe} · {p.position}</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: '#111', borderRadius: '8px', padding: '8px 14px' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>Over {p.line} {p.stat}</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: p.prob >= 0.75 ? '#22c55e' : p.prob >= 0.65 ? '#f97316' : '#888', letterSpacing: '-0.5px' }}>{Math.round(p.prob * 100)}%</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>L5:{Math.round(p.r5*100)}% L10:{Math.round(p.r10*100)}% L20:{Math.round(p.r20*100)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ongletJoueurs === 'matchups' && (
        chargement ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
              {Object.keys(matchsParJour).sort().map(jour => {
                const d = new Date(jour + 'T12:00:00');
                const estAujourdhui = jour === getDateStr(new Date());
                const label = estAujourdhui ? "Today" : d.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' });
                const nb = matchsParJour[jour]?.length || 0;
                return (
                  <button key={jour} onClick={() => setJourActif(jour)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: jourActif === jour ? '#f97316' : '#1a1a1a', color: jourActif === jour ? 'white' : '#888', fontSize: '12px', fontWeight: jourActif === jour ? 'bold' : 'normal' }}>
                    {label}
                    <span style={{ display: 'block', fontSize: '10px', color: jourActif === jour ? 'rgba(255,255,255,0.8)' : '#555' }}>{nb}G</span>
                  </button>
                );
              })}
            </div>
            {(matchsParJour[jourActif] || []).map((match, i) => <CarteMatchJoueurs key={`${jourActif}-${i}`} match={match} filtre={filtre} onSelectJoueur={onSelectJoueur} lineupDF={lineupDF} />)}
          </>
        )
      )}
    </div>
  );
}

function EquipesParDivision({ classement, onSelectEquipe }) {
  const divisions = {};
  classement.forEach(e => {
    const div = e.divisionName || 'Autre';
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(e);
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {Object.entries(divisions).map(([nomDiv, equipes]) => (
        <div key={nomDiv}>
          <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '900', color: '#f97316' }}>Division {nomDiv}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {equipes.map((e, i) => (
              <div
                key={i}
                onClick={() => onSelectEquipe(e)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', borderRadius: '8px', padding: '8px 12px', border: '1px solid #222', cursor: 'pointer' }}
                onMouseEnter={ev => ev.currentTarget.style.borderColor = '#f97316'}
                onMouseLeave={ev => ev.currentTarget.style.borderColor = '#222'}
              >
                <img src={LOGOS_NHL[e.teamAbbrev?.default]} alt={e.teamAbbrev?.default} style={{ width: '28px', height: '28px', objectFit: 'contain' }} onError={ev => ev.target.style.display = 'none'} />
                <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>{e.teamAbbrev?.default}</span>
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#f97316' }}>{e.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PageStatsEquipes({ classement, onSelectJoueur, lineupDF }) {
  const isMobile = useIsMobile();
  const [matchsParJour, setMatchsParJour] = useState({});
  const [jourActif, setJourActif] = useState('');
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');
  const [recherchJoueurs, setRechercheJoueurs] = useState([]);
const [chargementRecherche, setChargementRecherche] = useState(false);

async function rechercherJoueur(query) {
  if (query.length < 2) { setRechercheJoueurs([]); return; }
  setChargementRecherche(true);
  try {
    const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=fr-CA&limit=10&q=${encodeURIComponent(query)}&active=true`);
    const data = await res.json();
    setRechercheJoueurs(data || []);
  } catch { setRechercheJoueurs([]); }
  setChargementRecherche(false);
}
  const [equipeSelectionnee, setEquipeSelectionnee] = useState(null);
  const [saisonEquipes, setSaisonEquipes] = useState(SAISON_REG_2526);

  useEffect(() => { chargerSemaine(); }, []);

  async function chargerSemaine() {
    setChargement(true);
    const aujourdhui = new Date();
    const jours = Array(7).fill(null).map((_, i) => {
      const d = new Date(aujourdhui);
      d.setDate(d.getDate() + i);
      return getDateStr(d);
    });
    const resultats = {};
    await Promise.all(jours.map(async (jour) => {
      try {
        const res = await fetch(getUrl(`schedule/${jour}`));
        const data = await res.json();
        const games = data.gameWeek?.[0]?.games || [];
        if (games.length > 0) resultats[jour] = games;
      } catch (err) { }
    }));
    setMatchsParJour(resultats);
    setJourActif(Object.keys(resultats).sort()[0] || jours[0]);
    setChargement(false);
  }

  if (equipeSelectionnee) {
    const matchActif = Object.values(matchsParJour).flat().find(m =>
      m.awayTeam?.abbrev === equipeSelectionnee?.teamAbbrev?.default ||
      m.homeTeam?.abbrev === equipeSelectionnee?.teamAbbrev?.default
    );
    const abbrevEq = equipeSelectionnee?.teamAbbrev?.default;
    const equipeAdverse = matchActif
      ? classement.find(e => e.teamAbbrev?.default === (matchActif.awayTeam?.abbrev === abbrevEq ? matchActif.homeTeam?.abbrev : matchActif.awayTeam?.abbrev))
      : null;
    return <FicheEquipe equipe={equipeSelectionnee} equipeAdverse={equipeAdverse} classement={classement} onBack={() => setEquipeSelectionnee(null)} onSelectJoueur={onSelectJoueur} lineupDF={lineupDF} saison={saisonEquipes} />;
  }

  const jours = Object.keys(matchsParJour).sort();
  const aucunMatch = !chargement && jours.length === 0;
  const matchsFiltres = filtre.length >= 2
    ? (matchsParJour[jourActif] || []).filter(m =>
      m.awayTeam?.abbrev?.toLowerCase().includes(filtre.toLowerCase()) ||
      m.homeTeam?.abbrev?.toLowerCase().includes(filtre.toLowerCase()) ||
      m.awayTeam?.commonName?.default?.toLowerCase().includes(filtre.toLowerCase()) ||
      m.homeTeam?.commonName?.default?.toLowerCase().includes(filtre.toLowerCase())
    )
    : (matchsParJour[jourActif] || []);

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <input
          style={{ width: '100%', padding: '11px 14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          placeholder="Search a team..."
          value={filtre}
          onChange={e => setFiltre(e.target.value)}
        />
      </div>
      {chargement ? <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p> : aucunMatch ? (
        <>
          <SelecteurSaisonDiscret saison={saisonEquipes} onChange={setSaisonEquipes} />
          <EquipesParDivision classement={classement} onSelectEquipe={setEquipeSelectionnee} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
            {jours.map(jour => {
              const d = new Date(jour + 'T12:00:00');
              const estAujourdhui = jour === getDateStr(new Date());
              const label = estAujourdhui ? "Today" : d.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' });
              const nb = matchsParJour[jour]?.length || 0;
              return (
                <button key={jour} onClick={() => setJourActif(jour)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: jourActif === jour ? '#f97316' : '#1a1a1a', color: jourActif === jour ? 'white' : '#888', fontSize: '12px', fontWeight: jourActif === jour ? 'bold' : 'normal' }}>
                  {label}
                  <span style={{ display: 'block', fontSize: '10px', color: jourActif === jour ? 'rgba(255,255,255,0.8)' : '#555' }}>{nb}G</span>
                </button>
              );
            })}
          </div>
          {matchsFiltres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', backgroundColor: '#111', borderRadius: '16px' }}>
              <p style={{ color: '#666' }}>Aucun match trouve.</p>
            </div>
          ) : matchsFiltres.map((match, i) => (
            <CarteMatchEquipesDetaille key={i} match={match} classement={classement} onSelectEquipe={setEquipeSelectionnee} />
          ))}
        </>
      )}
    </div>
  );
}

// Version de PageStatsEquipes dediee a l'onglet Analyses : detection auto saison/playoffs (pas de selecteur manuel),
// pas de fallback intersaison (les onglets jours/matchs restent affiches meme vides).
function PageStatsEquipesAnalyses({ classement, onSelectJoueur, lineupDF }) {
  const [matchsParJour, setMatchsParJour] = useState({});
  const [jourActif, setJourActif] = useState('');
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');
  const [equipeSelectionnee, setEquipeSelectionnee] = useState(null);

  useEffect(() => { chargerSemaine(); }, []);

  async function chargerSemaine() {
    setChargement(true);
    const aujourdhui = new Date();
    const jours = Array(7).fill(null).map((_, i) => {
      const d = new Date(aujourdhui);
      d.setDate(d.getDate() + i);
      return getDateStr(d);
    });
    const resultats = {};
    await Promise.all(jours.map(async (jour) => {
      try {
        const res = await fetch(getUrl(`schedule/${jour}`));
        const data = await res.json();
        const games = data.gameWeek?.[0]?.games || [];
        if (games.length > 0) resultats[jour] = games;
      } catch (err) { }
    }));
    setMatchsParJour(resultats);
    setJourActif(Object.keys(resultats).sort()[0] || jours[0]);
    setChargement(false);
  }

  const saisonDetectee = detecterSaisonMatchs(matchsParJour);

  if (equipeSelectionnee) {
    const matchActif = Object.values(matchsParJour).flat().find(m =>
      m.awayTeam?.abbrev === equipeSelectionnee?.teamAbbrev?.default ||
      m.homeTeam?.abbrev === equipeSelectionnee?.teamAbbrev?.default
    );
    const abbrevEq = equipeSelectionnee?.teamAbbrev?.default;
    const equipeAdverse = matchActif
      ? classement.find(e => e.teamAbbrev?.default === (matchActif.awayTeam?.abbrev === abbrevEq ? matchActif.homeTeam?.abbrev : matchActif.awayTeam?.abbrev))
      : null;
    return <FicheEquipe equipe={equipeSelectionnee} equipeAdverse={equipeAdverse} classement={classement} onBack={() => setEquipeSelectionnee(null)} onSelectJoueur={onSelectJoueur} lineupDF={lineupDF} saison={saisonDetectee} />;
  }

  const jours = Object.keys(matchsParJour).sort();
  const matchsFiltres = filtre.length >= 2
    ? (matchsParJour[jourActif] || []).filter(m =>
      m.awayTeam?.abbrev?.toLowerCase().includes(filtre.toLowerCase()) ||
      m.homeTeam?.abbrev?.toLowerCase().includes(filtre.toLowerCase()) ||
      m.awayTeam?.commonName?.default?.toLowerCase().includes(filtre.toLowerCase()) ||
      m.homeTeam?.commonName?.default?.toLowerCase().includes(filtre.toLowerCase())
    )
    : (matchsParJour[jourActif] || []);

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <input
          style={{ width: '100%', padding: '11px 14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          placeholder="Search a team..."
          value={filtre}
          onChange={e => setFiltre(e.target.value)}
        />
      </div>
      {chargement ? <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p> : (
        <>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
            {jours.map(jour => {
              const d = new Date(jour + 'T12:00:00');
              const estAujourdhui = jour === getDateStr(new Date());
              const label = estAujourdhui ? "Today" : d.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' });
              const nb = matchsParJour[jour]?.length || 0;
              return (
                <button key={jour} onClick={() => setJourActif(jour)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: jourActif === jour ? '#f97316' : '#1a1a1a', color: jourActif === jour ? 'white' : '#888', fontSize: '12px', fontWeight: jourActif === jour ? 'bold' : 'normal' }}>
                  {label}
                  <span style={{ display: 'block', fontSize: '10px', color: jourActif === jour ? 'rgba(255,255,255,0.8)' : '#555' }}>{nb}G</span>
                </button>
              );
            })}
          </div>
          {matchsFiltres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', backgroundColor: '#111', borderRadius: '16px' }}>
              <p style={{ color: '#666' }}>Aucun match trouve.</p>
            </div>
          ) : matchsFiltres.map((match, i) => (
            <CarteMatchEquipesDetaille key={i} match={match} classement={classement} onSelectEquipe={setEquipeSelectionnee} />
          ))}
        </>
      )}
    </div>
  );
}

function CarteMatchEquipesDetaille({ match, classement, onSelectEquipe }) {
  const isMobile = useIsMobile();
  const [ouvert, setOuvert] = useState(false);
 
  const abbrev1 = match.awayTeam?.abbrev;
  const abbrev2 = match.homeTeam?.abbrev;
  const nom1 = match.awayTeam?.commonName?.default || abbrev1;
  const nom2 = match.homeTeam?.commonName?.default || abbrev2;
  const heure = new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const etat = match.gameState;
 
  const e1 = classement.find(e => e.teamAbbrev?.default === abbrev1);
  const e2 = classement.find(e => e.teamAbbrev?.default === abbrev2);
 
  const pts1 = e1?.points || 0; const pts2 = e2?.points || 0;
  const wins1 = e1?.wins || 0; const wins2 = e2?.wins || 0;
  const losses1 = e1?.losses || 0; const losses2 = e2?.losses || 0;
  const otl1 = e1?.otLosses || 0; const otl2 = e2?.otLosses || 0;
  const gf1 = e1 ? e1.goalFor / (e1.gamesPlayed || 1) : 3;
  const ga1 = e1 ? e1.goalAgainst / (e1.gamesPlayed || 1) : 3;
  const gf2 = e2 ? e2.goalFor / (e2.gamesPlayed || 1) : 3;
  const ga2 = e2 ? e2.goalAgainst / (e2.gamesPlayed || 1) : 3;
  const total_pts = pts1 + pts2;
  const prob1 = total_pts > 0 ? Math.round((pts1 / total_pts) * 100) : 50;
  const prob2 = 100 - prob1;
  const favori = prob1 > prob2 ? abbrev1 : abbrev2;
  const total_buts = ((gf1 + ga2 + gf2 + ga1) / 2).toFixed(1);
  const overUnder = parseFloat(total_buts) > 5.5 ? 'OVER' : 'UNDER';
  const genT = (w) => Array(5).fill(null).map(() => Math.random() * 100 < w ? 'W' : 'L');
  const win1 = Math.round((wins1 / (wins1 + losses1 + otl1 || 1)) * 100);
  const win2 = Math.round((wins2 / (wins2 + losses2 + otl2 || 1)) * 100);
 
  return (
    <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', overflow: 'hidden', marginBottom: '10px' }}>
      <div onClick={() => setOuvert(!ouvert)} style={{ padding: isMobile ? '12px 14px' : '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '32px', height: '32px', objectFit: 'contain', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onSelectEquipe(e1); }} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: isMobile ? '13px' : '14px' }}>{isMobile ? abbrev1 : nom1}</div>
              <div style={{ color: '#666', fontSize: '10px' }}>{wins1}W-{losses1}L-{otl1}OT</div>
            </div>
          </div>
          <span style={{ color: '#444', fontWeight: 'bold', fontSize: '13px' }}>@</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: isMobile ? '13px' : '14px' }}>{isMobile ? abbrev2 : nom2}</div>
              <div style={{ color: '#666', fontSize: '10px' }}>{wins2}W-{losses2}L-{otl2}OT</div>
            </div>
            <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '32px', height: '32px', objectFit: 'contain', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onSelectEquipe(e2); }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {etat === 'LIVE' || etat === 'CRIT'
              ? <span style={{ backgroundColor: '#1a0000', color: '#ef4444', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>LIVE</span>
              : <span style={{ color: '#666', fontSize: '12px' }}>{heure}</span>}
          </div>
          <div style={{ color: '#f97316', fontSize: '11px' }}>{favori} {Math.max(prob1, prob2)}% · {overUnder}</div>
          <span style={{ color: ouvert ? '#f97316' : '#444', fontSize: '11px' }}>{ouvert ? '▲' : '▼'}</span>
        </div>
      </div>
 
      <div style={{ padding: '0 14px 8px' }}>
        <span style={{ fontSize: '10px', color: '#444' }}>Click on a logo to view the team stats</span>
      </div>
 
      {ouvert && (
        <div style={{ borderTop: '1px solid #222' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr' }}>
            <div onClick={e => { e.stopPropagation(); if (e1) onSelectEquipe(e1); }} style={{ padding: isMobile ? '14px' : '20px', cursor: 'pointer', backgroundColor: '#111' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1a1a1a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#111'}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>{isMobile ? abbrev1 : nom1}</div>
                  <div style={{ color: '#666', fontSize: '11px' }}>{wins1}V · {losses1}D · {otl1}DP</div>
                </div>
              </div>
              {[['Points', pts1, '#f97316'], ['Win%', `${win1}%`, 'white'], ['Goals/G', gf1.toFixed(2), 'white'], ['GA/G', ga1.toFixed(2), 'white']].map(([l, v, c], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ color: '#666', fontSize: '11px' }}>{l}</span>
                  <span style={{ fontWeight: 'bold', color: c, fontSize: '12px' }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: '10px' }}>
                <div style={{ color: '#666', fontSize: '9px', marginBottom: '4px' }}>Form</div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {genT(win1).map((r, i) => <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: r === 'W' ? '#f97316' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: 'white' }}>{r}</div>)}
                </div>
              </div>
              <div style={{ marginTop: '12px', textAlign: 'center' }}><span style={{ fontSize: '10px', color: '#f97316' }}>View stats →</span></div>
            </div>
 
            <div style={{ backgroundColor: '#222', width: '1px' }} />
 
            <div onClick={e => { e.stopPropagation(); if (e2) onSelectEquipe(e2); }} style={{ padding: isMobile ? '14px' : '20px', cursor: 'pointer', backgroundColor: '#111' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1a1a1a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#111'}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>{isMobile ? abbrev2 : nom2}</div>
                  <div style={{ color: '#666', fontSize: '11px' }}>{wins2}V · {losses2}D · {otl2}DP</div>
                </div>
              </div>
              {[['Points', pts2, '#f97316'], ['Win%', `${win2}%`, 'white'], ['Goals/G', gf2.toFixed(2), 'white'], ['GA/G', ga2.toFixed(2), 'white']].map(([l, v, c], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ color: '#666', fontSize: '11px' }}>{l}</span>
                  <span style={{ fontWeight: 'bold', color: c, fontSize: '12px' }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: '10px' }}>
                <div style={{ color: '#666', fontSize: '9px', marginBottom: '4px' }}>Form</div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {genT(win2).map((r, i) => <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: r === 'W' ? '#f97316' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: 'white' }}>{r}</div>)}
                </div>
              </div>
              <div style={{ marginTop: '12px', textAlign: 'center' }}><span style={{ fontSize: '10px', color: '#f97316' }}>View stats →</span></div>
            </div>
          </div>
 
          <div style={{ padding: isMobile ? '10px 14px' : '12px 20px', borderTop: '1px solid #222' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ color: '#f97316', fontWeight: 'bold', fontSize: '11px' }}>{abbrev1} {prob1}%</span>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '11px' }}>{prob2}% {abbrev2}</span>
            </div>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '22px' }}>
              <div style={{ width: `${prob1}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', color: 'white' }}>{prob1}%</div>
              <div style={{ width: `${prob2}%`, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', color: 'white' }}>{prob2}%</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '10px' }}>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: '9px', marginBottom: '2px' }}>Favorite</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f97316' }}>{favori} {Math.max(prob1, prob2)}%</div>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: '9px', marginBottom: '2px' }}>Predicted Total</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{total_buts} buts</div>
              </div>
              <div style={{ backgroundColor: overUnder === 'OVER' ? 'rgba(249,115,22,0.15)' : '#1a1a1a', border: overUnder === 'OVER' ? '1px solid rgba(249,115,22,0.4)' : '1px solid #222', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: '9px', marginBottom: '2px' }}>Rec.</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: overUnder === 'OVER' ? '#f97316' : 'white' }}>{overUnder}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 
function fanX(x, y, cx = 220, minY = 15, maxY = 405, spread = 0.22) {
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const dx = x - cx;
  const val = cx + dx * (1 + t * spread);
  return Math.max(8, Math.min(432, val));
}

function orangeRed(pct) {
  const stops = [
    { p: 0,    c: [255, 229, 180] },
    { p: 0.15, c: [255, 224, 178] },
    { p: 0.4,  c: [255, 176, 90]  },
    { p: 0.7,  c: [237, 108, 42]  },
    { p: 1,    c: [166, 26, 20]   },
  ];
  const v = Math.max(0, Math.min(1, pct || 0));
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].p && v <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = (v - a.p) / ((b.p - a.p) || 1);
  const rgb = a.c.map((ch, i) => Math.round(ch + (b.c[i] - ch) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// Couleur du shot chart FicheJoueur basee sur le nombre brut de tirs (pas un pourcentage).
function orangeParTirs(val) {
  const v = Number(val) || 0;
  if (v === 0) return '#FFFFFF';
  if (v <= 20) return '#FFCC80';
  if (v <= 40) return '#FF8C00';
  return '#E65100';
}

function roundedPolyPath(pts, radius = 9) {
  const n = pts.length;
  const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  const norm = (v) => { const m = Math.hypot(v[0], v[1]) || 1; return [v[0]/m, v[1]/m]; };
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const toPrev = norm([prev[0]-curr[0], prev[1]-curr[1]]);
    const toNext = norm([next[0]-curr[0], next[1]-curr[1]]);
    const rr = Math.min(radius, dist(curr, prev)/2, dist(curr, next)/2);
    const p1 = [curr[0] + toPrev[0]*rr, curr[1] + toPrev[1]*rr];
    const p2 = [curr[0] + toNext[0]*rr, curr[1] + toNext[1]*rr];
    d += (i === 0 ? `M${p1[0]},${p1[1]} ` : `L${p1[0]},${p1[1]} `);
    d += `Q${curr[0]},${curr[1]} ${p2[0]},${p2[1]} `;
  }
  return d + 'Z';
}

function zoneRectPath(r) {
  const yTop = r.y, yBot = r.y + r.h;
  const xTL = fanX(r.x, yTop), xTR = fanX(r.x + r.w, yTop);
  const xBL = fanX(r.x, yBot), xBR = fanX(r.x + r.w, yBot);
  if (r.curveTop || r.curveBottom) {
    const arcY = (x, baseY, amt) => baseY + (amt || 0) * Math.pow((x - 220) / 220, 2);
    const yTL = arcY(xTL, yTop, r.curveTop), yTR = arcY(xTR, yTop, r.curveTop);
    const yBL = arcY(xBL, yBot, r.curveBottom), yBR = arcY(xBR, yBot, r.curveBottom);
    return `M${xTL},${yTL} Q220,${yTop + (r.curveTop||0)*0} ${xTR},${yTR} L${xBR},${yBR} Q220,${yBot} ${xBL},${yBL} Z`;
  }
  return roundedPolyPath([[xTL,yTop],[xTR,yTop],[xBR,yBot],[xBL,yBot]], 9);
}

const CIRCLE_Y_TOP = 100, CIRCLE_Y_MID = 180, CIRCLE_Y_BOT = 260, CIRCLE_BULGE = 26;
const L_P0 = [fanX(160, CIRCLE_Y_TOP), CIRCLE_Y_TOP];
const L_CTRL = [fanX(160, CIRCLE_Y_MID) - CIRCLE_BULGE, CIRCLE_Y_MID];
const L_P2 = [fanX(160, CIRCLE_Y_BOT), CIRCLE_Y_BOT];
const R_P0 = [fanX(280, CIRCLE_Y_TOP), CIRCLE_Y_TOP];
const R_CTRL = [fanX(280, CIRCLE_Y_MID) + CIRCLE_BULGE, CIRCLE_Y_MID];
const R_P2 = [fanX(280, CIRCLE_Y_BOT), CIRCLE_Y_BOT];

const FULL_SLOT_PATH = `M${L_P0[0]},${L_P0[1]} L${R_P0[0]},${R_P0[1]} Q${R_CTRL[0]},${R_CTRL[1]} ${R_P2[0]},${R_P2[1]} L${L_P2[0]},${L_P2[1]} Q${L_CTRL[0]},${L_CTRL[1]} ${L_P0[0]},${L_P0[1]} Z`;
const L_CIRCLE_PATH = `M${fanX(60,CIRCLE_Y_TOP)},${CIRCLE_Y_TOP} L${L_P0[0]},${L_P0[1]} Q${L_CTRL[0]},${L_CTRL[1]} ${L_P2[0]},${L_P2[1]} L${fanX(60,CIRCLE_Y_BOT)},${CIRCLE_Y_BOT} Z`;
const R_CIRCLE_PATH = `M${fanX(380,CIRCLE_Y_TOP)},${CIRCLE_Y_TOP} L${R_P0[0]},${R_P0[1]} Q${R_CTRL[0]},${R_CTRL[1]} ${R_P2[0]},${R_P2[1]} L${fanX(380,CIRCLE_Y_BOT)},${CIRCLE_Y_BOT} Z`;

const BOARD_D = `M${fanX(20,405)},405 L${fanX(20,50)},50 Q${fanX(20,25)},15 220,15 Q${fanX(420,25)},15 ${fanX(420,50)},50 L${fanX(420,405)},405`;

function FicheEquipe({ equipe, equipeAdverse, classement, onBack, onSelectJoueur, lineupDF, saison = SAISON_REG_2526 }) {
  const isMobile = useIsMobile();
  const [ongletPeriode, setOngletPeriode] = useState('SZN');
  const [ongletShot, setOngletShot] = useState('SZN');
  const [typeShot, setTypeShot] = useState('POUR');
  const [chargement, setChargement] = useState(true);
  const [statsEquipe, setStatsEquipe] = useState(null);
  const [statsAdverse, setStatsAdverse] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [ongletFiche, setOngletFiche] = useState('stats');
  const [rosterEquipe, setRosterEquipe] = useState([]);
  const [chargementRoster, setChargementRoster] = useState(false);
 
  const abbrev = equipe?.teamAbbrev?.default || '';
  const abbrevAdv = equipeAdverse?.teamAbbrev?.default || '';
  const nom = equipe?.teamName?.default || equipe?.teamCommonName?.default || abbrev;
  const division = equipe?.divisionName || '';
  const pts = equipe?.points || 0;
  const wins = equipe?.wins || 0;
  const losses = equipe?.losses || 0;
  const otl = equipe?.otLosses || 0;
  const gp = equipe?.gamesPlayed || 1;
  const gf = equipe?.goalFor || 0;
  const ga = equipe?.goalAgainst || 0;
  const rang = equipe?.leagueSequence || (classement.findIndex(e => e.teamAbbrev?.default === abbrev) + 1);
 
  useEffect(() => { chargerStats(); }, [abbrev, saison]);

  useEffect(() => {
    if (ongletFiche === 'lineup') chargerRoster();
  }, [ongletFiche, saison]);

  async function chargerRoster() {
    setChargementRoster(true);
    try {
      const res = await fetch(getUrl('roster/' + abbrev + '/' + saison.seasonId));
      const data = await res.json();
      const fmt = (joueurs, pos) => (joueurs || []).map(j => ({
        id: j.id,
        nom: ((j.firstName && j.firstName.default) || '') + ' ' + ((j.lastName && j.lastName.default) || ''),
        numero: j.sweaterNumber || '',
        position: j.positionCode || pos,
        equipe: abbrev,
        ligne: null, goals: null, assists: null, points: null,
      }));
      const tous = [...fmt(data.forwards, 'F'), ...fmt(data.defensemen, 'D'), ...fmt(data.goalies, 'G')];
      setRosterEquipe(tous);
      // Charger stats en batch
      const batchSize = 5;
      const result = [...tous];
      for (let i = 0; i < tous.length; i += batchSize) {
        const batch = tous.slice(i, i + batchSize);
        const stats = await Promise.all(batch.map(async (j) => {
          try {
            const r = await fetch(getUrl('player/' + j.id + '/landing'));
            const d = await r.json();
            const s = extraireStatsSaisonJoueur(d, saison.seasonId, saison.gameType);
            const isG = j.position === 'G';
            if (isG) {
              return { ...j, gaa: s?.goalsAgainstAvg?.toFixed(2) ?? '-', svp: s?.savePctg ? (s.savePctg * 100).toFixed(1) + '%' : '-' };
            }
            return { ...j, goals: s?.goals ?? 0, assists: s?.assists ?? 0, points: s?.points ?? 0 };
          } catch { return j; }
        }));
        stats.forEach((s, idx) => { result[i + idx] = s; });
        setRosterEquipe([...result]);
      }
    } catch (err) { console.error(err); }
    setChargementRoster(false);
  }

  async function chargerStats() {
    setChargement(true);
    try {
      const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
      const statsPath = `https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId%3D${saison.seasonId}%20and%20gameTypeId%3D${saison.gameType}`;
      const urlStats = estEnProduction ? `/api/nhl?path=${encodeURIComponent(statsPath)}` : statsPath;
      const resStats = await fetch(urlStats);
      const dataStats = await resStats.json();
      const teamStats = dataStats.data?.find(t =>
        t.teamFullName?.toLowerCase().includes(nom.split(' ').pop().toLowerCase()) ||
        t.teamFullName?.toLowerCase().includes((equipe?.placeName?.default || '').toLowerCase())
      );
      setStatsEquipe(teamStats || null);

      if (abbrevAdv) {
        const nomAdv = equipeAdverse?.teamName?.default || equipeAdverse?.teamCommonName?.default || abbrevAdv;
        const teamStatsAdv = dataStats.data?.find(t =>
          t.teamFullName?.toLowerCase().includes(nomAdv.split(' ').pop().toLowerCase()) ||
          t.teamFullName?.toLowerCase().includes((equipeAdverse?.placeName?.default || '').toLowerCase())
        );
        setStatsAdverse(teamStatsAdv || null);
      }

      const res2 = await fetch(getUrl(`club-schedule-season/${abbrev}/${saison.seasonId}`));
      const data2 = await res2.json();
      const matchsJoues = (data2.games || []).filter(g => (g.gameState === 'OFF' || g.gameState === 'FINAL') && g.gameType === saison.gameType).slice(-20);
      const matchsAvecSog = await getSOGParPeriode(matchsJoues, abbrev);
      setGameLog(matchsAvecSog);
    } catch (err) { console.error(err); }
    setChargement(false);
  }
 
  const getMatchsPeriode = (periode) => {
    switch (periode) {
      case 'L5': return gameLog.slice(-5);
      case 'L10': return gameLog.slice(-10);
      case 'L20': return gameLog.slice(-20);
      default: return null;
    }
  };
 
  const matchsPeriode = getMatchsPeriode(ongletPeriode);
 
  const getStatsPeriode = (matchs) => {
    if (!matchs || matchs.length === 0) return null;
    const nb = matchs.length;
    const bp = matchs.reduce((s, m) => { const dom = m.homeTeam?.abbrev === abbrev; return s + (dom ? (m.homeTeam?.score || 0) : (m.awayTeam?.score || 0)); }, 0);
    const bc = matchs.reduce((s, m) => { const dom = m.homeTeam?.abbrev === abbrev; return s + (dom ? (m.awayTeam?.score || 0) : (m.homeTeam?.score || 0)); }, 0);
    const victoires = matchs.filter(m => { const dom = m.homeTeam?.abbrev === abbrev; return (dom ? m.homeTeam?.score : m.awayTeam?.score) > (dom ? m.awayTeam?.score : m.homeTeam?.score); }).length;
    return { bp, bc, bpMoy: (bp / nb).toFixed(2), bcMoy: (bc / nb).toFixed(2), victoires, nb };
  };
 
  const statsPeriode = getStatsPeriode(matchsPeriode);
 
  const ppPct = statsEquipe?.powerPlayPct ? (statsEquipe.powerPlayPct * 100).toFixed(1) : '-';
  const pkPct = statsEquipe?.penaltyKillPct ? (statsEquipe.penaltyKillPct * 100).toFixed(1) : '-';
  const sogPour = statsEquipe?.shotsForPerGame?.toFixed(1) ?? '-';
  const sogContre = statsEquipe?.shotsAgainstPerGame?.toFixed(1) ?? '-';
  const sogPourNum = statsEquipe?.shotsForPerGame ?? 0;
  const sogContreNum = statsEquipe?.shotsAgainstPerGame ?? 0;
  const faceoffPct = statsEquipe?.faceoffWinPct ? (statsEquipe.faceoffWinPct * 100).toFixed(1) : '-';
  const ptsPct = statsEquipe?.pointPct ? (statsEquipe.pointPct * 100).toFixed(1) : ((pts / (gp * 2)) * 100).toFixed(1);
 
  const toutesEquipesSorted = [...classement].sort((a, b) => (b.goalFor / (b.gamesPlayed || 1)) - (a.goalFor / (a.gamesPlayed || 1)));
  const rangOff = toutesEquipesSorted.findIndex(e => e.teamAbbrev?.default === abbrev) + 1;
  const toutesEquipesDefSorted = [...classement].sort((a, b) => (a.goalAgainst / (a.gamesPlayed || 1)) - (b.goalAgainst / (b.gamesPlayed || 1)));
  const rangDef = toutesEquipesDefSorted.findIndex(e => e.teamAbbrev?.default === abbrev) + 1;
 
  const streak = equipe?.streakCode && equipe?.streakCount ? `${equipe.streakCode}${equipe.streakCount}` : '-';
  const l10Wins = equipe?.l10Wins || 0;
  const l10Losses = equipe?.l10Losses || 0;
  const l10Gf = equipe?.l10GoalsFor || 0;
  const l10Ga = equipe?.l10GoalsAgainst || 0;
 
  const getMatchsShotPeriode = () => {
    if (ongletShot === 'SZN') return null;
    switch (ongletShot) {
      case 'L5': return gameLog.slice(-5);
      case 'L10': return gameLog.slice(-10);
      case 'L20': return gameLog.slice(-20);
      default: return null;
    }
  };
 
  const matchsShotPeriode = getMatchsShotPeriode();
  const sogPourPeriode = matchsShotPeriode ? calcSOGPeriode(matchsShotPeriode, 'POUR') : sogPour;
  const sogContrePeriode = matchsShotPeriode ? calcSOGPeriode(matchsShotPeriode, 'CONTRE') : sogContre;
  const sogBase = typeShot === 'POUR' ? parseFloat(sogPourPeriode) || sogPourNum : parseFloat(sogContrePeriode) || sogContreNum;
 
  const zonesEquipe = [
    { label: 'LOW LEFT', pct: 0.18 }, { label: 'LOW', pct: 0.22 }, { label: 'LOW RIGHT', pct: 0.16 },
    { label: 'BOARDS', pct: 0.12 }, { label: 'SLOT', pct: typeShot === 'POUR' ? 0.35 : 0.28 }, { label: 'BOARDS', pct: 0.08 },
    { label: 'LEFT', pct: 0.05 }, { label: 'POINT', pct: 0.04 }, { label: 'RIGHT', pct: 0.05 },
  ].map(z => ({ ...z, moy: (sogBase * z.pct).toFixed(1) }));
 
  const ZONE_RECTS_EQUIPE = [
    { idx: 0, x: 60,  y: 50,  w: 115, h: 50, hatch: false, curveTop: 22 },
    { idx: 1, x: 175, y: 50,  w: 90,  h: 50, hatch: false, curveTop: 22 },
    { idx: 2, x: 265, y: 50,  w: 115, h: 50, hatch: false, curveTop: 22 },
    { idx: 6, x: 20,  y: 260, w: 140, h: 70, hatch: false },
    { idx: 7, x: 160, y: 260, w: 120, h: 70, hatch: false },
    { idx: 8, x: 280, y: 260, w: 140, h: 70, hatch: false },
  ];
  const attenduEquipe = 1 / zonesEquipe.length;
  const pctEquipe = (i) => Math.max(0, Math.min(1, zonesEquipe[i].pct / (attenduEquipe * 2)));
 
  const getTendanceZone = (z) => {
    const attendu = 1 / zonesEquipe.length;
    if (z.pct > attendu * 1.15) return 'haut';
    if (z.pct < attendu * 0.85) return 'bas';
    return 'neutre';
  };
 
  const getAnalyseMatchup = () => {
    if (!abbrevAdv || !equipeAdverse) return null;
    const gfEq = gf / gp; const gaEq = ga / gp;
    const gfAdv = equipeAdverse.goalFor / (equipeAdverse.gamesPlayed || 1);
    const gaAdv = equipeAdverse.goalAgainst / (equipeAdverse.gamesPlayed || 1);
    const sogEq = sogPourNum; const sogContreEq = sogContreNum;
    const sogEqAdv = statsAdverse?.shotsForPerGame ?? 0;
    const sogContreAdv = statsAdverse?.shotsAgainstPerGame ?? 0;
    const ppEq = statsEquipe?.powerPlayPct ?? 0; const pkEq = statsEquipe?.penaltyKillPct ?? 0;
    const ppAdv = statsAdverse?.powerPlayPct ?? 0; const pkAdv = statsAdverse?.penaltyKillPct ?? 0;
    let scoreEq = 0, scoreAdv = 0, raisonsEq = [], raisonsAdv = [];
    if (gfEq > gaAdv + 0.2) { scoreEq += 2; raisonsEq.push(`efficient offense (${gfEq.toFixed(2)} B/m) vs weak defense (${gaAdv.toFixed(2)} GA/G)`); }
    else if (gaAdv < gfEq - 0.2) { scoreAdv += 2; raisonsAdv.push(`defense solide (${gaAdv.toFixed(2)} GA/G)`); }
    else { scoreEq += 1; scoreAdv += 1; }
    if (gaEq < gfAdv - 0.2) { scoreEq += 2; raisonsEq.push(`defense forte (${gaEq.toFixed(2)} GA/G)`); }
    else if (gfAdv > gaEq + 0.2) { scoreAdv += 2; raisonsAdv.push(`attaque dangereuse (${gfAdv.toFixed(2)} B/m)`); }
    else { scoreEq += 1; scoreAdv += 1; }
    if (sogEq > 0 && sogContreAdv > 0) {
      if (sogEq > sogContreAdv + 1) { scoreEq += 1; raisonsEq.push(`plus de tirs (${sogEq.toFixed(1)}/m)`); }
      else if (sogContreAdv > sogEq + 1) { scoreAdv += 1; raisonsAdv.push(`accorde peu de tirs (${sogContreAdv.toFixed(1)}/m)`); }
    }
    if (sogContreEq > 0 && sogEqAdv > 0) {
      if (sogContreEq < sogEqAdv - 1) { scoreEq += 1; raisonsEq.push(`defense solide en tirs (${sogContreEq.toFixed(1)}/m)`); }
      else if (sogEqAdv > sogContreEq + 1) { scoreAdv += 1; raisonsAdv.push(`genere plus de tirs (${sogEqAdv.toFixed(1)}/m)`); }
    }
    if (ppEq > 0.22 && pkAdv < 0.80) { scoreEq += 1; raisonsEq.push(`PP puissant (${(ppEq * 100).toFixed(1)}%)`); }
    if (ppAdv > 0.22 && pkEq < 0.80) { scoreAdv += 1; raisonsAdv.push(`PP adverse efficace (${(ppAdv * 100).toFixed(1)}%)`); }
    const favorable = scoreEq >= scoreAdv;
    const marge = Math.abs(scoreEq - scoreAdv);
    let niveau = marge >= 4 ? 'tres favorable' : marge >= 2 ? 'favorable' : 'legerement favorable';
    if (marge === 0) niveau = 'equilibre';
    const equipeGagnante = scoreEq > scoreAdv ? abbrev : scoreAdv > scoreEq ? abbrevAdv : null;
    const raisonsFinales = favorable ? raisonsEq : raisonsAdv;
    const conclusion = equipeGagnante
      ? `Matchup ${niveau} pour ${equipeGagnante} — ${raisonsFinales.slice(0, 2).join(', et ')}.`
      : `Matchup equilibre entre ${abbrev} et ${abbrevAdv}.`;
    return { conclusion, favorable, scoreEq, scoreAdv, equipeGagnante };
  };
 
  const analyseMatchup = getAnalyseMatchup();
  const matchsGraphe = matchsPeriode || gameLog.slice(-10);
  const maxButs = Math.max(...(matchsGraphe.length > 0 ? matchsGraphe.map(m => { const dom = m.homeTeam?.abbrev === abbrev; return Math.max(dom ? (m.homeTeam?.score || 0) : (m.awayTeam?.score || 0), dom ? (m.awayTeam?.score || 0) : (m.homeTeam?.score || 0)); }) : [1]), 1);
  const pad = isMobile ? '14px' : '20px';
 
  return (
    <div>
      <button onClick={onBack} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>Back</button>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
        <button onClick={() => setOngletFiche('stats')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletFiche === 'stats' ? '#f97316' : 'transparent', color: ongletFiche === 'stats' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletFiche === 'stats' ? '600' : 'normal' }}>Stats</button>
        <button onClick={() => setOngletFiche('lineup')} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletFiche === 'lineup' ? '#f97316' : 'transparent', color: ongletFiche === 'lineup' ? 'white' : '#555', fontSize: '13px', fontWeight: ongletFiche === 'lineup' ? '600' : 'normal' }}>Lineup</button>
      </div>
 
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: '16px' }}>
        <img src={LOGOS_NHL[abbrev]} alt={abbrev} style={{ width: isMobile ? '60px' : '72px', height: isMobile ? '60px' : '72px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: 'white' }}>{nom}</h2>
          <div style={{ color: '#666', fontSize: '12px', marginBottom: '6px' }}>Division {division}</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#f97316', fontWeight: 'bold', fontSize: '14px' }}>{pts} pts</span>
            <span style={{ color: '#888', fontSize: '13px' }}>{wins}W · {losses}L · {otl}OT</span>
            <span style={{ backgroundColor: equipe?.streakCode === 'W' ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)', color: equipe?.streakCode === 'W' ? '#f97316' : '#ef4444', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: 'bold' }}>{streak}</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '10px 14px', border: '1px solid #222' }}>
          <div style={{ color: '#666', fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>RANK</div>
          <div style={{ color: '#f97316', fontSize: '22px', fontWeight: '900' }}>#{rang}</div>
          <div style={{ color: '#555', fontSize: '9px' }}>classement</div>
        </div>
      </div>
 
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '16px' }}>
        {['SZN', 'L5', 'L10', 'L20'].map(p => (
          <button key={p} onClick={() => setOngletPeriode(p)} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #222', cursor: 'pointer', backgroundColor: ongletPeriode === p ? '#f97316' : '#111', color: ongletPeriode === p ? 'white' : '#666', fontSize: '13px', fontWeight: ongletPeriode === p ? 'bold' : 'normal' }}>{p}</button>
        ))}
      </div>
 
      {ongletFiche === 'lineup' ? (
        <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: '20px' }}>
          {chargementRoster ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Loading lineup...</p>
          ) : (
            <AlignementEquipe abbrev={abbrev} nom={nom} logo={LOGOS_NHL[abbrev]} joueurs={rosterEquipe} onSelect={onSelectJoueur || (() => {})} isMobile={isMobile} lineupDF={lineupDF} />
          )}
        </div>
      ) : chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : (
        <>
          <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, marginBottom: '14px' }}>
            <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '10px' }}>SOMMAIRE {ongletPeriode}</div>
            {ongletPeriode === 'SZN' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  {[['Pts%', `${ptsPct}%`, '#f97316'], ['Goals/G', (gf / gp).toFixed(2), 'white'], ['GA/G', (ga / gp).toFixed(2), 'white'], ['Diff.', gf - ga > 0 ? `+${gf - ga}` : `${gf - ga}`, gf - ga >= 0 ? '#f97316' : '#ef4444']].map(([l, v, c], i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '10px 4px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: c }}>{v}</div>
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[['Face-off%', `${faceoffPct}%`, 'white'], ['Home', `${equipe?.homeWins || 0}W-${equipe?.homeLosses || 0}L`, 'white'], ['Away', `${equipe?.roadWins || 0}W-${equipe?.roadLosses || 0}L`, 'white']].map(([l, v, c], i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '10px 4px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: c }}>{v}</div>
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : ongletPeriode === 'L10' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[[`${l10Wins}V-${l10Losses}D`, 'L10 Record', '#f97316'], [(l10Gf / 10).toFixed(2), 'Goals/G', 'white'], [(l10Ga / 10).toFixed(2), 'GA/G', 'white'], [l10Gf - l10Ga > 0 ? `+${l10Gf - l10Ga}` : `${l10Gf - l10Ga}`, 'Diff', l10Gf - l10Ga >= 0 ? '#f97316' : '#ef4444']].map(([v, l, c], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '10px 4px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: c }}>{v}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
            ) : statsPeriode ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[[`${statsPeriode.victoires}/${statsPeriode.nb}`, 'Wins', '#f97316'], [statsPeriode.bpMoy, 'Goals/G', 'white'], [statsPeriode.bcMoy, 'GA/G', 'white'], [statsPeriode.bp - statsPeriode.bc > 0 ? `+${statsPeriode.bp - statsPeriode.bc}` : `${statsPeriode.bp - statsPeriode.bc}`, 'Diff', statsPeriode.bp - statsPeriode.bc >= 0 ? '#f97316' : '#ef4444']].map(([v, l, c], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '10px 4px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: c }}>{v}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
 
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad }}>
              <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>POWER PLAY</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#f97316', marginBottom: '4px' }}>{ppPct}%</div>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${ppPct !== '-' ? Math.min(parseFloat(ppPct), 30) / 30 * 100 : 0}%`, height: '100%', backgroundColor: '#f97316', borderRadius: '6px' }} />
              </div>
            </div>
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad }}>
              <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>PENALTY KILL</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{pkPct}%</div>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${pkPct !== '-' ? Math.min(parseFloat(pkPct), 100) / 100 * 100 : 0}%`, height: '100%', backgroundColor: '#888', borderRadius: '6px' }} />
              </div>
            </div>
          </div>
 
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, textAlign: 'center' }}>
              <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>OFFENSIVE RANK</div>
              <div style={{ fontSize: '36px', fontWeight: '900', color: '#f97316' }}>#{rangOff}</div>
              <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>{(gf / gp).toFixed(2)} goals/G</div>
            </div>
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, textAlign: 'center' }}>
              <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>DEFENSIVE RANK</div>
              <div style={{ fontSize: '36px', fontWeight: '900', color: 'white' }}>#{rangDef}</div>
              <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>{(ga / gp).toFixed(2)} GA/G</div>
            </div>
          </div>
 
          {matchsGraphe.length > 0 && (
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, marginBottom: '14px' }}>
              <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px' }}>RECENT RESULTS</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '90px', marginBottom: '4px' }}>
                {matchsGraphe.map((m, i) => {
                  const dom = m.homeTeam?.abbrev === abbrev;
                  const bp = dom ? (m.homeTeam?.score || 0) : (m.awayTeam?.score || 0);
                  const bc = dom ? (m.awayTeam?.score || 0) : (m.homeTeam?.score || 0);
                  const v = bp > bc;
                  const h = Math.max((bp / maxButs) * 70, 4);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', height: '90px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '8px', color: v ? '#f97316' : '#ef4444', fontWeight: 'bold' }}>{bp}-{bc}</span>
                      <div style={{ width: '100%', height: `${h}px`, backgroundColor: v ? '#f97316' : '#ef4444', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
                      <div style={{ fontSize: '7px', color: '#555', marginTop: '2px' }}>{m.homeTeam?.abbrev === abbrev ? m.awayTeam?.abbrev : m.homeTeam?.abbrev}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '6px' }}>
                {matchsGraphe.map((m, i) => {
                  const dom = m.homeTeam?.abbrev === abbrev;
                  const bp = dom ? (m.homeTeam?.score || 0) : (m.awayTeam?.score || 0);
                  const bc = dom ? (m.awayTeam?.score || 0) : (m.homeTeam?.score || 0);
                  const v = bp > bc;
                  return <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: v ? '#f97316' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: 'white' }}>{v ? 'W' : 'L'}</div>;
                })}
              </div>
            </div>
          )}
 
          <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, marginBottom: '14px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '900', color: 'white' }}>Shots on Goal</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>SHOTS FOR / GAME</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#f97316' }}>{sogPourPeriode}</div>
                <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>{ongletShot !== 'SZN' ? ongletShot : 'Season'}</div>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>SHOTS AGAINST / GAME</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: 'white' }}>{sogContrePeriode}</div>
                <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>{ongletShot !== 'SZN' ? ongletShot : 'Season'}</div>
              </div>
            </div>
 
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
              {['SZN', 'L5', 'L10', 'L20'].map(p => (
                <button key={p} onClick={() => setOngletShot(p)} style={{ padding: '7px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletShot === p ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '11px', fontWeight: ongletShot === p ? 'bold' : 'normal' }}>{p}</button>
              ))}
            </div>
 
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '14px' }}>
              {[['POUR', 'Shots For'], ['CONTRE', 'Shots Against']].map(([t, label]) => (
                <button key={t} onClick={() => setTypeShot(t)} style={{ padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: typeShot === t ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '12px', fontWeight: typeShot === t ? 'bold' : 'normal' }}>{label}</button>
              ))}
            </div>
 
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              <svg viewBox="0 0 440 415" style={{ width: isMobile ? '85%' : '70%', display: 'block', margin: '0 auto' }}>
                <defs>
                  <radialGradient id="iceGradientEq" cx="50%" cy="8%" r="95%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#e9f1f8" />
                  </radialGradient>
                  <pattern id="iceTextureEq" width="140" height="140" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
                    <path d="M-10,20 Q30,8 70,22 T150,10" stroke="#cfe0ee" strokeWidth="1" fill="none" opacity="0.5" />
                    <path d="M-10,60 Q40,45 80,63 T170,50" stroke="#dbe8f2" strokeWidth="1" fill="none" opacity="0.4" />
                  </pattern>
                  <clipPath id="boardClipEq"><path d={`${BOARD_D} Z`} /></clipPath>
                </defs>
                <rect x="0" y="0" width="440" height="415" fill="#0a0f1a" />
                <g clipPath="url(#boardClipEq)">
                  <rect x="0" y="0" width="440" height="415" fill="url(#iceGradientEq)" />
                  <rect x="0" y="0" width="440" height="415" fill="url(#iceTextureEq)" />
                  {ZONE_RECTS_EQUIPE.map((r, i) => {
                    const path = zoneRectPath(r);
                    const cx = fanX(r.x + r.w / 2, r.y + r.h / 2);
                    const cy = r.y + r.h / 2;
                    return (
                      <g key={i}>
                        <path d={path} fill={orangeRed(pctEquipe(r.idx))} stroke="#7a1f0f" strokeWidth="1.4" strokeOpacity="0.45" strokeLinejoin="round" />
                        <text x={cx} y={cy + 7} textAnchor="middle" fill="#3a1208" fontSize="21" fontWeight="900">{zonesEquipe[r.idx].moy}</text>
                      </g>
                    );
                  })}
                  <path d={FULL_SLOT_PATH} fill={orangeRed(pctEquipe(4))} stroke="#7a1f0f" strokeWidth="1.4" strokeOpacity="0.45" strokeLinejoin="round" />
                  <text x={(L_P0[0]+R_P0[0]+R_P2[0]+L_P2[0])/4} y={CIRCLE_Y_MID + 7} textAnchor="middle" fill="#3a1208" fontSize="21" fontWeight="900">{zonesEquipe[4].moy}</text>
                  <path d={L_CIRCLE_PATH} fill={orangeRed(pctEquipe(3))} stroke="#7a1f0f" strokeWidth="1.4" strokeOpacity="0.45" strokeLinejoin="round" />
                  <text x={L_CTRL[0] - 20} y={CIRCLE_Y_MID + 7} textAnchor="middle" fill="#3a1208" fontSize="21" fontWeight="900">{zonesEquipe[3].moy}</text>
                  <path d={R_CIRCLE_PATH} fill={orangeRed(pctEquipe(5))} stroke="#7a1f0f" strokeWidth="1.4" strokeOpacity="0.45" strokeLinejoin="round" />
                  <text x={R_CTRL[0] + 20} y={CIRCLE_Y_MID + 7} textAnchor="middle" fill="#3a1208" fontSize="21" fontWeight="900">{zonesEquipe[5].moy}</text>
                </g>
                <path d={BOARD_D} fill="none" stroke="#0f2942" strokeWidth="3" />
                <rect x="185" y="16" width="70" height="30" rx="3" fill="#f7fafc" stroke="#0f2942" strokeWidth="2.5" />
              </svg>
            </div>
 
            {analyseMatchup && abbrevAdv && (
              <div style={{ backgroundColor: analyseMatchup.favorable ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${analyseMatchup.favorable ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: analyseMatchup.favorable ? '#f97316' : '#ef4444', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: analyseMatchup.favorable ? '#f97316' : '#ef4444', textTransform: 'uppercase' }}>Matchup Analysis vs {abbrevAdv}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#666' }}>{abbrev} {analyseMatchup.scoreEq} — {analyseMatchup.scoreAdv} {abbrevAdv}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#ccc', lineHeight: '1.6' }}>{analyseMatchup.conclusion}</p>
              </div>
            )}
          </div>
 
          <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad }}>
            <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '10px' }}>HOME VS AWAY</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Home', w: equipe?.homeWins || 0, l: (equipe?.homeLosses || 0) + (equipe?.homeOtLosses || 0), gf: equipe?.homeGoalsFor || 0, ga: equipe?.homeGoalsAgainst || 0 },
                { label: 'Away', w: equipe?.roadWins || 0, l: (equipe?.roadLosses || 0) + (equipe?.roadOtLosses || 0), gf: equipe?.roadGoalsFor || 0, ga: equipe?.roadGoalsAgainst || 0 },
              ].map((eq, i) => (
                <div key={i} style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ color: '#666', fontSize: '10px', marginBottom: '8px', fontWeight: 'bold' }}>{eq.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{eq.w}V · {eq.l}D</div>
                  <div style={{ color: '#666', fontSize: '11px' }}>{eq.gf} BP · {eq.ga} BC</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FicheJoueur({ joueur, onBack }) {
  const isMobile = useIsMobile();
  const [statsAvancees, setStatsAvancees] = useState(null);
  const [dernierMatchs, setDernierMatchs] = useState([]);
  const [ongletStat, setOngletStat] = useState('PTS');
  const [ongletPeriode, setOngletPeriode] = useState('L10');
  const [ongletChart, setOngletChart] = useState('SZN');
  const [shotChartData, setShotChartData] = useState(null);
  const [chargementShotChart, setChargementShotChart] = useState(false);
  const [typeChart, setTypeChart] = useState('SOG');
  const [chargement, setChargement] = useState(true);
  const [edgeValue, setEdgeValue] = useState('');
  const [modeStats, setModeStats] = useState('regular');
  const seasonId = '20252026';

  useEffect(() => {
    setShotChartData(null);
    setChargementShotChart(true);
    getShotChartData(joueur.id, null, ongletChart, modeStats).then(data => {
      setShotChartData({ [ongletChart]: data });
      setChargementShotChart(false);
    });
  }, [ongletChart, modeStats]);

  useEffect(() => { chargerStats(); }, [joueur.id, modeStats]);

  async function chargerStats() {
    setChargement(true);
    try {
      const gameType = modeStats === 'playoffs' ? 3 : 2;
      const res = await fetch(getUrl(`player/${joueur.id}/landing`));
      const data = await res.json();
      const statsSaison = extraireStatsSaisonJoueur(data, seasonId, gameType);
      const isGardien = joueur.position === 'G';

      if (isGardien) {
        setStatsAvancees({
          gp: statsSaison?.gamesPlayed ?? 0,
          gaa: statsSaison?.goalsAgainstAvg?.toFixed(2) ?? '-',
          svp: statsSaison?.savePctg ? (statsSaison.savePctg * 100).toFixed(1) + '%' : '-',
          wins: statsSaison?.wins ?? 0,
          losses: statsSaison?.losses ?? 0,
          shutouts: statsSaison?.shutouts ?? 0,
          gamesStarted: statsSaison?.gamesStarted ?? 0,
        });
      } else {
        const statsBase = {
          gp: statsSaison?.gamesPlayed ?? 0,
          goals: statsSaison?.goals ?? 0,
          assists: statsSaison?.assists ?? 0,
          points: statsSaison?.points ?? 0,
          plusMinus: statsSaison?.plusMinus ?? 0,
          ppp: statsSaison?.powerPlayPoints ?? 0,
          sog: statsSaison?.shots ?? 0,
          toi: statsSaison?.avgToi ?? '-',
          hits: 0,
          blocks: 0,
        };

        try {
          const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
          const realtimePath = `https://api.nhle.com/stats/rest/en/skater/realtime?cayenneExp=playerId%3D${joueur.id}%20and%20seasonId%3D${seasonId}%20and%20gameTypeId%3D${gameType}`;
          const urlRealtime = estEnProduction ? `/api/nhl?path=${encodeURIComponent(realtimePath)}` : realtimePath;
          const resRealtime = await fetch(urlRealtime);
          const dataRealtime = await resRealtime.json();
          const rt = dataRealtime.data?.[0];
          statsBase.hits = rt?.hits ?? 0;
          statsBase.blocks = rt?.blockedShots ?? 0;
        } catch { }

        setStatsAvancees({ ...statsBase });
      }

      const log = await getGameLogJoueur(joueur.id, gameType, seasonId);
      const logAvecHits = await getHitsBlocksParMatch(joueur.id, log);
      setDernierMatchs(logAvecHits);

      if (log.length > 0) {
        const toiEnSecondes = log.map(m => {
          const parts = (m.toi || '0:00').split(':');
          return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
        });
        const moyenneSecondes = Math.round(toiEnSecondes.reduce((a, b) => a + b, 0) / toiEnSecondes.length);
        const minutes = Math.floor(moyenneSecondes / 60);
        const secondes = String(moyenneSecondes % 60).padStart(2, '0');
        setStatsAvancees(prev => ({ ...prev, toi: `${minutes}:${secondes}` }));
      }

      

    } catch (err) { console.error(err); }
    setChargement(false);
  }

  const isGardien = joueur.position === 'G';
  const gp = statsAvancees?.gp || 1;
  const sogSaison = statsAvancees?.sog || 0;

const getMatchsChart = () => {
  switch (ongletChart) {
    case 'L5': return dernierMatchs.slice(0, 5);
    case 'L10': return dernierMatchs.slice(0, 10);
    case 'L20': return dernierMatchs.slice(0, 20);
    default: return null;
  }
}
 
  const ongletsDef = isGardien
    ? [{ id: 'GAA', label: 'GAA' }, { id: 'SVP', label: 'SV%' }]
    : [{ id: 'SOG', label: 'SOG' }, { id: 'GOAL', label: 'GOAL' }, { id: 'AST', label: 'AST' }, { id: 'PTS', label: 'PTS' }, { id: 'PPP', label: 'PPP' }, { id: 'BLK', label: 'BLK' }, { id: 'HITS', label: 'HITS' }, { id: 'TOI', label: 'TOI' }];
 
  const getValeurMatch = (m, stat) => {
    switch (stat) {
      case 'PTS': return m.points ?? ((m.goals || 0) + (m.assists || 0));
      case 'SOG': return m.shots ?? m.sog ?? 0;
      case 'GOAL': return m.goals ?? 0;
      case 'AST': return m.assists ?? 0;
      case 'PPP': return m.powerPlayPoints ?? 0;
     case 'TOI': {
  const parts = (m.toi || '0:00').split(':');
  return parseFloat((parseInt(parts[0]) + parseInt(parts[1] || 0) / 60).toFixed(2));
}
      case 'BLK': return m.blockedShots ?? 0;
      case 'HITS': return m.hits ?? 0;
      default: return 0;
    }
  };
 
  const getMoyenneSaison = (stat) => {
    if (!statsAvancees || gp === 0) return 0;
    switch (stat) {
      case 'PTS': return parseFloat((statsAvancees.points / gp).toFixed(1));
      case 'SOG': return parseFloat((statsAvancees.sog / gp).toFixed(1));
      case 'GOAL': return parseFloat((statsAvancees.goals / gp).toFixed(1));
      case 'AST': return parseFloat((statsAvancees.assists / gp).toFixed(1));
      case 'PPP': return parseFloat((statsAvancees.ppp / gp).toFixed(1));
      case 'TOI': {
  const parts = (statsAvancees.toi || '0:00').split(':');
  return parseFloat((parseInt(parts[0]) + parseInt(parts[1] || 0) / 60).toFixed(2));
}
      case 'BLK': return parseFloat((statsAvancees.blocks / gp).toFixed(1));
      case 'HITS': return parseFloat((statsAvancees.hits / gp).toFixed(1));
      default: return 0;
    }
  };
 
  const getPeriodeMatchs = () => {
    switch (ongletPeriode) {
      case 'L5': return dernierMatchs.slice(0, 5);
      case 'L10': return dernierMatchs.slice(0, 10);
      case 'L20': return dernierMatchs.slice(0, 20);
      default: return dernierMatchs.slice(0, 10);
    }
  };
 
  const matchsFiltres = getPeriodeMatchs();
  const moyenne = getMoyenneSaison(ongletStat);
  const valeurs = matchsFiltres.map(m => getValeurMatch(m, ongletStat));
  const maxVal = Math.max(...valeurs, moyenne * 1.5, 1);
  const getPctAuDessus = () => valeurs.length === 0 ? 0 : Math.round((valeurs.filter(v => v >= moyenne).length / valeurs.length) * 100);
  const getPctAuDessusEdge = () => {
    if (!edgeValue || valeurs.length === 0) return 0;
    const edge = parseFloat(edgeValue);
    return Math.round((valeurs.filter(v => v > edge).length / valeurs.length) * 100);
  };
 
  const matchsChart = getMatchsChart();
  const currentShotData = shotChartData?.[ongletChart] || shotChartData?.['SZN'];
 const sog = currentShotData?.totals?.all?.shotsOnGoal
  ?? (matchsChart && matchsChart.length > 0
    ? matchsChart.reduce((s, m) => s + (m.shots || 0), 0)
    : sogSaison);

  const ZONE_KEYS = [
    'LOW SLOT', 'CREASE', 'HIGH SLOT',
    'L CIRCLE', 'R CIRCLE',
    'L NET SIDE', 'L CORNER',
    'R NET SIDE', 'R CORNER',
    'L POINT', 'R POINT', 'C POINT',
    'OUTSIDE L', 'OUTSIDE R', 'NEUTRAL ZONE',
  ];
  const zones = currentShotData
  ? ZONE_KEYS.map(label => ({
      label,
      sog:      currentShotData.zones[label]     ?? 0,
      goals:    currentShotData.goals[label]     ?? 0,
      sogPct:   currentShotData.sogPct?.[label]  ?? 0,
      goalsPct: currentShotData.goalsPct?.[label] ?? 0,
    }))
  : ZONE_KEYS.map(label => ({ label, sog: 0, goals: 0, sogPct: 0, goalsPct: 0 }));
 
  const totalShotsChart = zones.reduce((s, z) => s + z.sog, 0);
  const getValeurZone = (z) => {
    if (typeChart === 'SOG')   return z.sog;
    if (typeChart === 'Goals') return z.goals;
    return totalShotsChart > 0 ? `${Math.round((z.sog / totalShotsChart) * 100)}%` : '0%';
  };
  const getTendanceZone = (z) => {
  const pct = typeChart === 'Goals' ? z.goalsPct : z.sogPct;
  if (pct >= 0.80) return 'haut';
  if (pct <= 0.40) return 'bas';
  return 'neutre';
};
 
  // Zones du shot chart copiées telles quelles du code NHL EDGE (viewBox 0 0 204 214).
  // tx/ty = offset du <svg> local EDGE (translate), d = path local exact, lx/ly = position du label.
  const EDGE_ZONES = [
    { idx: 12, tx: 2,   ty: 33,  lx: 25,  ly: 75,
      d: 'M9.40101 1.57176C9.55325 1.27053 9.73045 0.982587 9.93075 0.710938H32.3784C32.4446 0.975807 32.5108 1.30689 32.577 1.57176C36.2857 14.6735 43.7983 26.3803 54.1638 35.2101C54.6935 35.6737 55.2895 36.1372 55.8854 36.6007C56.1413 36.7829 56.3846 36.982 56.6138 37.1967L26.9486 76.927L0.726569 112.022V33.8196C0.721648 22.4932 3.71446 11.3672 9.40101 1.57176Z' },
    { idx: 5, tx: 34, ty: 34, lx: 58, ly: 52,
      d: 'M0.931572 0.930176H51.8242L24.8811 36.3554C24.8811 36.3554 17.3968 31.366 10.4116 20.8881C3.42631 10.4102 0.931572 0.930176 0.931572 0.930176Z' },
    { idx: 0, tx: 59, ty: 33, lx: 101, ly: 69,
      d: 'M57.7579 0.932373H28.8189L0.378906 38.3534C2.10057 39.6116 3.87154 42.345 10.3579 45.3387C16.8442 48.3324 33.8084 53.8208 46.781 52.8229C59.7537 51.825 69.2945 48.2524 75.72 44.3408C82.1454 40.4292 82.8163 39.8126 84.701 38.3534L57.7579 0.932373Z' },
    { idx: 1, tx: 85, ty: 33, lx: 101, ly: 44,
      d: 'M1.89018 0.909912C1.83305 1.26 1.81087 1.61491 1.82396 1.96939V3.02887C2.08446 6.65021 3.71573 10.036 6.38546 12.4966C9.05519 14.9572 12.5626 16.3075 16.1931 16.2723C17.3087 16.2749 18.4206 16.1414 19.5039 15.875C22.4491 15.2211 25.1117 13.6517 27.1101 11.3916C29.1084 9.13151 30.3401 6.29681 30.6284 3.29374C30.6284 2.89643 30.6946 2.56535 30.6946 2.16804V1.96939C30.7036 1.61497 30.6814 1.26045 30.6284 0.909912 Z' },
    { idx: 7, tx: 117, ty: 33, lx: 145, ly: 52,
      d: 'M51.6466 0.930176H0.753906L27.6971 36.3554C27.6971 36.3554 35.1813 31.366 42.1665 20.8881C49.1518 10.4102 51.6466 0.930176 51.6466 0.930176Z' },
    { idx: 13, tx: 145, ty: 34, lx: 180, ly: 75,
      d: 'M47.2385 1.8369C47.1061 1.57203 46.9074 1.30716 46.775 0.976074H24.7247C24.6585 1.24094 24.5923 1.57203 24.526 1.8369C20.8929 14.8168 13.4966 26.4297 3.27034 35.2104C2.74061 35.6739 2.14465 36.1375 1.5487 36.601C1.28383 36.7996 1.08518 36.9983 0.820312 37.1969L29.9559 76.5962L55.7143 111.36V33.8198C55.7227 22.6026 52.801 11.5778 47.2385 1.8369Z' },
    { idx: 3, tx: 27, ty: 72, lx: 57, ly: 105,
      d: 'M54.3228 11.6458L37.7023 62.6331L37.4374 63.4277C23.5318 58.7263 11.1492 50.4491 0.488281 40.9138L31.2793 0.190186C38.2132 5.35669 46.0181 9.23673 54.3228 11.6458Z' },
    { idx: 2, tx: 65, ty: 82, lx: 101, ly: 116,
      d: 'M74.7334 51.3679C62.8805 55.8045 49.1735 57.3937 35.7314 57.3937C23.7477 57.4086 11.8443 55.4396 0.503721 51.5666H0.4375L17.0581 0.645453C23.2847 2.40487 29.7245 3.29618 36.1949 3.29414C43.3121 3.29822 50.3889 2.22665 57.1858 0.115723L74.7334 51.3679Z' },
    { idx: 4, tx: 122, ty: 70, lx: 145, ly: 105,
      d: 'M0.246094 11.8293L15.9465 61.8497L16.2124 62.7219C30.118 58.0205 41.2368 50.9193 51.8977 41.4503L21.1068 0.925293C14.182 6.07599 8.55463 9.49463 0.246094 11.8293Z' },
    { idx: 9, tx: 2, ty: 114, lx: 30, ly: 155,
      d: 'M63.2888 21.6135L60.1104 31.4137L59.8456 32.1421L47.7419 68.5814L47.6095 68.9125H2.51622C1.65541 68.3166 0.860811 67.7206 0 67.1247V36.4661L22.1592 6.49746L22.2254 6.43124L26.7281 0.47168C31.7535 4.21383 38.9179 9.74545 42.9095 12.2402C46.9011 14.7349 56.8503 19.8388 63.2888 21.6135Z' },
    { idx: 11, tx: 50, ty: 133, lx: 101, ly: 165,
      d: 'M106.178 48.6473L89.7131 0.223145C89.7131 0.223145 75.2436 7.20841 52.7909 7.20841C30.3383 7.20841 16.8667 1.71999 16.8667 1.71999L0.900391 48.6473H106.178Z' },
    { idx: 10, tx: 138, ty: 113, lx: 170, ly: 155,
      d: 'M0.711205 21.6155L3.88959 31.4157L4.15445 32.144L16.2581 68.5834L16.3905 68.9145H61.4838C62.3446 68.3185 63.1392 67.7226 64 67.1266V36.468L41.8408 6.49941L41.7746 6.43319L37.2719 0.473633C32.2465 4.21578 25.0821 9.74741 21.0905 12.2421C17.0989 14.7369 7.14973 19.8408 0.711205 21.6155Z' },
    { idx: 14, tx: 3, ty: 180, lx: 101, ly: 201,
      d: 'M199.578 0.846191V30.7102L0.0664062 31.0413V0.846191H199.578Z' },
    { idx: 6, tx: 13, ty: 3, lx: 44.95, ly: 20.5,
      d: 'M49.713 29.9225V0.19458C39.0746 0.871745 28.7801 4.22718 19.7861 9.94905C14.1774 13.5278 9.16226 17.9608 4.92212 23.0877C4.32491 23.8177 3.79406 24.4812 3.2632 25.2112C2.40709 26.3187 1.6097 27.4705 0.874357 28.6617C0.60893 29.1262 0.277146 29.5244 0.0117188 29.9889H49.713V29.9225Z' },
    { idx: 8, tx: 141, ty: 3, lx: 159.05, ly: 20.5,
      d: 'M0.332031 29.9894H49.5314C49.2679 29.5331 48.9806 29.091 48.6705 28.665C47.9367 27.4763 47.1411 26.327 46.2867 25.2217C45.7719 24.4873 45.2194 23.78 44.6313 23.1028C40.4477 17.9899 35.4872 13.5657 29.9311 9.99175C21.0524 4.28415 10.8653 0.934027 0.332031 0.257812V29.9894Z' },
  ];
  // Zone "Behind the Net" : décorative, hachurée, sans stat associée (absente de nhlApi.js).
  const BEHIND_NET_D = 'M63.38,2.13 L140.33,2.13 L140.33,33.98 L63.38,33.98 Z';
  // Lignes de séparation exactes du code NHL EDGE, tracées par-dessus les zones colorées (sans stroke propre).
  const EDGE_BORDER_PATHS = [
    'M201.243 181.978H2.32703',
    'M2.06226 77.0239V212.041L201.574 211.71V147.612L201.243 147.214L174.756 111.788C174.663 111.896 174.551 111.986 174.425 112.053L172.637 113.642C169.399 116.471 165.994 119.102 162.44 121.522C161.712 121.985 160.983 122.515 160.321 122.979L158.136 124.369C157.407 124.833 156.679 125.23 155.951 125.694C155.222 126.091 154.494 126.554 153.766 126.952C152.044 127.879 150.322 128.806 148.534 129.667C148.269 129.799 148.071 129.865 147.806 129.998C147.409 130.196 147.011 130.395 146.548 130.594C145.753 130.991 144.959 131.322 144.164 131.653C142.972 132.183 141.846 132.646 140.655 133.11C138.712 133.722 139.674 133.589 139.21 133.722M139.463 134.368V134.434L144.628 150.393L154.825 181.647L154.891 181.846L154.957 181.978V182.045',
    'M2.06226 148.141L28.4163 112.781C39.233 122.483 51.8876 129.914 65.6299 134.633',
    'M50.3319 182.045L65.6282 134.633C89.5741 142.84 115.628 142.465 139.328 133.573',
    'M201.574 73.5144V147.612L174.69 111.788',
    'M65.6269 134.699C51.8845 129.98 39.2297 122.549 28.4129 112.848L59.2038 71.7267C71.3582 80.9416 86.1977 85.9192 101.45 85.8972C116.977 85.8948 132.066 80.7487 144.359 71.2632L174.753 111.854C164.445 121.315 151.805 128.293 138.711 133.223M65.6269 134.699L82.1811 83.381M65.6269 134.699C89.5726 142.906 115.012 142.115 138.711 133.223M138.711 133.223L123.103 83.3147',
    'M63.3829 33.9166H33.7177C33.7839 34.1814 33.8501 34.5125 33.9163 34.7774C37.7986 48.4321 45.7152 60.5955 56.6288 69.6739L58.4166 71.0645C58.6815 71.2631 58.8802 71.3955 59.145 71.5942L87.4198 33.8503H63.3829',
    'M140.323 33.9165H116.352L144.296 71.1968L145.091 70.6009C145.687 70.1374 146.283 69.6738 146.879 69.1441C157.498 60.1377 165.197 48.1742 168.995 34.7773C169.061 34.5125 169.127 34.1814 169.194 33.9165H140.323Z',
    'M174.695 111.788L144.302 71.1968L145.096 70.6009C145.692 70.1374 146.288 69.6738 146.884 69.1441C157.504 60.1377 165.203 48.1742 169.001 34.7773C169.067 34.5125 169.133 34.1814 169.199 33.9165H192.177C192.375 34.1814 192.508 34.5125 192.706 34.7773C198.528 44.7915 201.59 56.1703 201.579 67.7535V73.5144',
    'M11.3983 33.9164H63.3788V2.13208C51.9534 2.90187 40.9278 6.64555 31.3959 12.9917C25.7999 16.7484 20.7999 21.3243 16.5633 26.5663C15.9673 27.2947 15.3713 28.0893 14.8416 28.8176C13.9808 30.0096 13.12 31.2677 12.3254 32.5258L11.3983 33.9164Z',
    'M140.329 33.9166H192.177C191.912 33.4531 191.581 32.9896 191.316 32.5261C190.522 31.2679 189.661 30.0098 188.8 28.8179C188.204 28.0233 187.674 27.2949 187.012 26.5665C182.618 21.101 177.389 16.3633 171.517 12.5284C162.188 6.43841 151.446 2.85769 140.329 2.13232V33.9166Z',
    'M140.327 2.13219C139.467 2.06597 138.539 1.99976 137.679 1.99976H65.9642C65.1034 1.99976 64.2426 2.06597 63.3817 2.13219V33.9827H87.4852',
    'M2.06228 77.024V67.7535C2.05214 56.1703 5.1139 44.7915 10.9354 34.7773L11.4651 33.9165H33.7803C33.8465 34.1814 33.9127 34.5125 33.9789 34.7773C37.8613 48.432 45.7779 60.5955 56.6914 69.6738L58.4793 71.0644C58.7441 71.2631 58.9428 71.3955 59.2077 71.5941L28.4167 112.715',
    'M63.38 2.13 L63.38 33.98',
    'M140.33 2.13 L140.33 33.98',
  ];

  const pad = isMobile ? '14px' : '20px';
 
  return (
    <div>
      <button onClick={onBack} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>Back</button>
 <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
  <button onClick={() => setModeStats('regular')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: modeStats === 'regular' ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '12px', fontWeight: modeStats === 'regular' ? 'bold' : 'normal' }}>Saison régulière 25-26</button>
  <button onClick={() => setModeStats('playoffs')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: modeStats === 'playoffs' ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '12px', fontWeight: modeStats === 'playoffs' ? 'bold' : 'normal' }}>Playoffs 25-26</button>
</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: '14px' }}>
        <img src={LOGOS_NHL[joueur.equipe]} alt={joueur.equipe} style={{ width: isMobile ? '60px' : '72px', height: isMobile ? '60px' : '72px', objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 3px', fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{joueur.nom}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <img src={LOGOS_NHL[joueur.equipe]} alt={joueur.equipe} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span style={{ color: '#666', fontSize: '12px' }}>{joueur.position} · {joueur.equipe} · #{joueur.numero}</span>
          </div>
        </div>
        {!isGardien && statsAvancees && (
          <div style={{ textAlign: 'center', backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '8px 12px', border: '1px solid #222', flexShrink: 0 }}>
            <div style={{ color: '#666', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '2px' }}>AVG</div>
            <div style={{ color: '#f97316', fontSize: '18px', fontWeight: '900' }}>
  {ongletStat === 'TOI' ? statsAvancees?.toi ?? '-' : getMoyenneSaison(ongletStat)}
</div>
           <div style={{ color: '#555', fontSize: '9px' }}>{ongletStat}/G</div>
          </div>
        )}
      </div>
 
      {chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : (
        <>
          {/* 1. STATS SAISON COMPLÈTE EN PREMIER */}
          {!isGardien && statsAvancees && (
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, marginBottom: '14px' }}>
             <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>{modeStats === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'}</div>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {[['GOALS', statsAvancees.goals, '#f97316'], ['AST', statsAvancees.assists, 'white'], ['PTS', statsAvancees.points, 'white'], ['+/-', (statsAvancees.plusMinus ?? 0) >= 0 ? `+${statsAvancees.plusMinus}` : statsAvancees.plusMinus, (statsAvancees.plusMinus ?? 0) >= 0 ? '#f97316' : '#ef4444']].map(([l, v, c], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', backgroundColor: '#1a1a1a', borderRadius: '7px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: c }}>{v ?? '-'}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {[['PPP', statsAvancees.ppp], ['SOG', statsAvancees.sog], ['HITS', statsAvancees.hits], ['BLK', statsAvancees.blocks]].map(([l, v], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', backgroundColor: '#1a1a1a', borderRadius: '7px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{v ?? '-'}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {[['TOI/G', statsAvancees.toi], ['GAMES', statsAvancees.gp]].map(([l, v], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', backgroundColor: '#1a1a1a', borderRadius: '7px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{v ?? '-'}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
 
          {isGardien && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {[['GAA', statsAvancees?.gaa, '#f97316'], ['SV%', statsAvancees?.svp, '#f97316'], ['Wins', statsAvancees?.wins, 'white'], ['Losses', statsAvancees?.losses, 'white'], ['Shutouts', statsAvancees?.shutouts, 'white'], ['GP', statsAvancees?.gamesStarted, '#666']].map(([l, v, c], i) => (
                <div key={i} style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #222', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: c }}>{v ?? '-'}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>{l}</div>
                </div>
              ))}
            </div>
          )}
 
          {/* 2. ONGLETS STATS PAR PÉRIODE */}
          {!isGardien && (
            <div style={{ display: 'flex', gap: '3px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
              {ongletsDef.map(o => (
                <button key={o.id} onClick={() => setOngletStat(o.id)} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: ongletStat === o.id ? '#f97316' : '#111', color: ongletStat === o.id ? 'white' : '#666', fontSize: '12px', fontWeight: ongletStat === o.id ? 'bold' : 'normal' }}>{o.label}</button>
              ))}
            </div>
          )}
 
          {/* 3. GRAPHIQUE DERNIERS MATCHS */}
          {!isGardien && (
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {['L5', 'L10', 'L20'].map(p => (
                    <button key={p} onClick={() => setOngletPeriode(p)} style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: ongletPeriode === p ? '#f97316' : '#1a1a1a', color: ongletPeriode === p ? 'white' : '#666', fontSize: '11px', fontWeight: ongletPeriode === p ? 'bold' : 'normal' }}>{p}</button>
                  ))}
                </div>
                <div style={{ backgroundColor: '#1a1a1a', borderRadius: '6px', padding: '3px 8px' }}>
                  <span style={{ color: '#f97316', fontSize: '12px', fontWeight: 'bold' }}>{getPctAuDessus()}%</span>
                  <span style={{ color: '#555', fontSize: '10px' }}> over avg. season</span>
                </div>
              </div>
 
              {matchsFiltres.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center', fontSize: '12px' }}>Donnees non disponibles</p>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '22px' }}>
                    <span style={{ color: '#555', fontSize: '9px' }}>{Math.ceil(maxVal)}</span>
                    <span style={{ color: '#888', fontSize: '9px' }}>
  {ongletStat === 'TOI' ? (() => {
    const min = Math.floor(moyenne);
    const sec = String(Math.round((moyenne - min) * 60)).padStart(2, '0');
    return `${min}:${sec}`;
  })() : moyenne}
</span>
                    <span style={{ color: '#555', fontSize: '9px' }}>0</span>
                  </div>
                  <div style={{ marginLeft: '26px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${24 + (moyenne / maxVal) * 110}px`, height: '1px', backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 1 }} />
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '134px' }}>
                      {matchsFiltres.map((m, i) => {
                        const val = getValeurMatch(m, ongletStat);
                        const h = maxVal > 0 ? Math.max((val / maxVal) * 110, val > 0 ? 7 : 3) : 3;
                        const estAuDessus = val >= moyenne;
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', height: '134px', justifyContent: 'flex-end' }}>
                           <span style={{ fontSize: '8px', color: estAuDessus ? '#f97316' : '#ef4444', fontWeight: 'bold' }}>
  {ongletStat === 'TOI' ? (() => {
    const min = Math.floor(val);
    const sec = String(Math.round((val - min) * 60)).padStart(2, '0');
    return `${min}:${sec}`;
  })() : val}
</span>
                            <div style={{ width: '100%', height: `${h}px`, backgroundColor: estAuDessus ? '#f97316' : '#ef4444', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
                            <div style={{ width: '100%', height: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '7px', color: '#555' }}>{m.gameDate ? m.gameDate.slice(5) : ''}</span>
                              <span style={{ fontSize: '7px', color: '#444' }}>{m.opponentAbbrev || ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
 
             <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #1a1a1a' }}>
                {ongletStat === 'TOI' ? (
  <div style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
    <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px' }}>TOI AVG. · {ongletPeriode === 'L5' ? 'LAST 5' : ongletPeriode === 'L10' ? 'LAST 10' : 'LAST 20'}</div>
    <div style={{ fontSize: '28px', fontWeight: '900', color: 'white' }}>{valeurs.length > 0 ? (() => {
      const avgMin = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
      const minutes = Math.floor(avgMin);
      const secondes = String(Math.round((avgMin - minutes) * 60)).padStart(2, '0');
      return `${minutes}:${secondes}`;
    })() : '-'}</div>
    <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>per game</div>
  </div>
) : ongletStat === 'HITS' ? (
  <div style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
    <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px' }}>HITS AVG. · {ongletPeriode === 'L5' ? 'LAST 5' : ongletPeriode === 'L10' ? 'LAST 10' : 'LAST 20'}</div>
    <div style={{ fontSize: '28px', fontWeight: '900', color: 'white' }}>{valeurs.length > 0 ? (valeurs.reduce((a, b) => a + b, 0) / valeurs.length).toFixed(1) : '-'}</div>
    <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>per game</div>
  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#f97316', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px' }}>EDGE ({ongletStat})</div>
                      <input type="number" step="0.5" placeholder="ex: 1.5" value={edgeValue} onChange={e => setEdgeValue(e.target.value)} style={{ width: '80px', backgroundColor: '#111', border: '1px solid #f97316', borderRadius: '6px', color: 'white', fontSize: '16px', fontWeight: '900', textAlign: 'center', padding: '4px', outline: 'none' }} />
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>Betting line</div>
                    </div>
                    <div style={{ backgroundColor: edgeValue && getPctAuDessusEdge() >= 70 ? 'rgba(249,115,22,0.15)' : '#1a1a1a', border: edgeValue && getPctAuDessusEdge() >= 70 ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px' }}>OVER EDGE</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: edgeValue ? (getPctAuDessusEdge() >= 70 ? '#f97316' : getPctAuDessusEdge() >= 50 ? 'white' : '#ef4444') : '#444' }}>{edgeValue ? `${getPctAuDessusEdge()}%` : '-'}</div>
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>{ongletPeriode === 'L5' ? 'LAST 5' : ongletPeriode === 'L10' ? 'LAST 10' : 'LAST 20'}</div>
                    </div>
                    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px' }}>CUMUL. {ongletPeriode === 'L5' ? 'LAST 5' : ongletPeriode === 'L10' ? 'LAST 10' : 'LAST 20'}</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: 'white' }}>{valeurs.reduce((a, b) => a + b, 0)}</div>
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>{ongletStat} total</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* 4. SHOT CHART */}
          {!isGardien && (
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '900', color: 'white' }}>Shot Chart</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '6px' }}>
                {['SZN', 'L5', 'L10', 'L20'].map(n => (
                  <button key={n} onClick={() => setOngletChart(n)} style={{ padding: '7px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletChart === n ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '11px', fontWeight: ongletChart === n ? 'bold' : 'normal' }}>{n}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                {[['SOG', 'Shots on Goal'], ['Goals', 'Goals']].map(([t, label]) => (
                  <button key={t} onClick={() => setTypeChart(t)} style={{ padding: '7px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: typeChart === t ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '11px', fontWeight: typeChart === t ? 'bold' : 'normal' }}>{label}</button>
                ))}
              </div>
              <div style={{ backgroundColor: '#0a0f1a', borderRadius: '10px', overflow: 'hidden' }}>
                <svg viewBox="0 0 204 214" style={{ width: '100%', display: 'block' }}>
                  <defs>
                    <radialGradient id="iceGradientP" cx="50%" cy="8%" r="95%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#e9f1f8" />
                    </radialGradient>
                  </defs>
                  <rect x="0" y="0" width="204" height="214" fill="url(#iceGradientP)" />
                  {EDGE_ZONES.map((z) => {
                    const data = zones[z.idx];
                    const val = getValeurZone(data);
                    return (
                      <g key={z.idx} transform={`translate(${z.tx},${z.ty})`}>
                        <path d={z.d} fill={orangeParTirs(val)} stroke="none" />
                      </g>
                    );
                  })}
                  <path d={BEHIND_NET_D} fill={orangeParTirs(0)} stroke="none" />
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 4" width="33" height="4" x="85" y="32">
                    <path d="M0.823242 0.435547L32.7559 0.435547V3.42923H0.823242V0.435547Z" fill="black" />
                  </svg>
                  {EDGE_BORDER_PATHS.map((d, i) => (
                    <path key={`border-${i}`} d={d} fill="none" stroke="black" strokeWidth="2.99369" strokeMiterlimit="10" />
                  ))}
                  {EDGE_ZONES.map((z) => {
                    const data = zones[z.idx];
                    const val = getValeurZone(data);
                    return (
                      <text key={`label-${z.idx}`} x={z.lx} y={z.ly + 3} textAnchor="middle" fill="#3a1208" fontSize="10" fontWeight="900">{val}</text>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function BracketPlayoffs({ bracket }) {
  const [indexConf, setIndexConf] = useState(0);
  const [visible, setVisible] = useState(true);
  const [rondeActive, setRondeActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIndexConf(prev => (prev + 1) % 2); setVisible(true); }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!bracket) return <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Chargement...</div>;
  
  const rounds = bracket.rounds || [];
  const r1 = rounds.find(r => r.roundNumber === 1)?.series || [];
  const r2 = rounds.find(r => r.roundNumber === 2)?.series || [];
  const r3 = rounds.find(r => r.roundNumber === 3)?.series || [];
  const r4 = rounds.find(r => r.roundNumber === 4)?.series || [];

  const rondes = [
    { label: 'R1', est: r1.filter(s => ['A','B','C','D'].includes(s.seriesLetter)), ouest: r1.filter(s => ['E','F','G','H'].includes(s.seriesLetter)) },
    { label: 'R2', est: r2.filter(s => ['I','J'].includes(s.seriesLetter)), ouest: r2.filter(s => ['K','L'].includes(s.seriesLetter)) },
    { label: 'CF', est: r3.filter(s => s.seriesLetter === 'M'), ouest: r3.filter(s => s.seriesLetter === 'N') },
    { label: 'SCF', est: r4, ouest: [] },
  ].filter(r => r.est.length > 0 || r.ouest.length > 0);

  const ronde = rondes[rondeActive];
  const series = rondeActive === rondes.length - 1 && ronde?.label === 'SCF' 
    ? ronde.est 
    : indexConf === 0 ? ronde?.est : ronde?.ouest;

  const SerieItem = ({ serie }) => {
    if (!serie) return null;
    const top = serie.topSeed;
    const bot = serie.bottomSeed;
    const gagne = serie.winningTeamId;
    return (
      <div style={{ backgroundColor: '#111', borderRadius: '8px', padding: '8px 12px', border: '1px solid #333', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', opacity: gagne && gagne !== top?.id ? 0.4 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src={top?.logo} alt={top?.abbrev} style={{ width: '20px', height: '20px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <span style={{ fontWeight: 'bold', fontSize: '13px', color: gagne === top?.id ? '#f97316' : 'white' }}>{top?.abbrev}</span>
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: gagne === top?.id ? '#f97316' : 'white' }}>{top?.wins}</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#222', marginBottom: '4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: gagne && gagne !== bot?.id ? 0.4 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src={bot?.logo} alt={bot?.abbrev} style={{ width: '20px', height: '20px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <span style={{ fontWeight: 'bold', fontSize: '13px', color: gagne === bot?.id ? '#f97316' : 'white' }}>{bot?.abbrev}</span>
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: gagne === bot?.id ? '#f97316' : 'white' }}>{bot?.wins}</span>
        </div>
        {gagne && <div style={{ textAlign: 'center', fontSize: '9px', color: '#f97316', marginTop: '4px' }}>✓ {gagne === top?.id ? top?.abbrev : bot?.abbrev} wins</div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '12px' }}>
        {rondes.map((r, i) => (
          <button key={i} onClick={() => { setRondeActive(i); setIndexConf(0); }} style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: rondeActive === i ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '11px', fontWeight: rondeActive === i ? 'bold' : 'normal' }}>{r.label}</button>
        ))}
      </div>
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#f97316' }}>
            {ronde?.label === 'SCF' ? '🏆 Stanley Cup Final' : indexConf === 0 ? 'Eastern Conference' : 'Western Conference'}
          </h3>
          {ronde?.label !== 'SCF' && <span style={{ color: '#666', fontSize: '12px' }}>{indexConf + 1} / 2</span>}
        </div>
        {(series || []).map((s, i) => <SerieItem key={i} serie={s} />)}
      </div>
      {ronde?.label !== 'SCF' && <PointsIndicateur total={2} actif={indexConf} />}
    </div>
  );
}
function Analyses({ onLigueChange }) {
  const isMobile = useIsMobile();
  const [ligue] = useState('nhl');
  const [categorie, setCategorie] = useState(null);
  const [classement, setClassement] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [meneurs, setMeneurs] = useState({ buts: [], passes: [], points: [] });
  const [joueurSelectionne, setJoueurSelectionne] = useState(null);
  const lineupDF = useLineupsDailyFaceoff();
  const [playoffBracket, setPlayoffBracket] = useState(null);
  const [estPlayoffs, setEstPlayoffs] = useState(false);

  useEffect(() => { if (onLigueChange) onLigueChange('nhl'); }, []);
  useEffect(() => { if (ligue === 'nhl' && !categorie) chargerPreview(); }, [ligue, categorie]);
  useEffect(() => { if (ligue === 'nhl' && categorie === 'equipes') chargerDonneesNHL(); }, [ligue, categorie]);

 async function chargerPreview() {
    try {
      const res = await fetch(getUrl('standings/now'));
      const data = await res.json();
      setClassement(data.standings || []);
      await chargerMeneurs();
      await detecterEtChargerPlayoffs();
    } catch (err) { console.error(err); }
  }

  async function chargerDonneesNHL() {
    setChargement(true);
    try {
      const res = await fetch(getUrl('standings/now'));
      const data = await res.json();
      setClassement(data.standings || []);
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  async function chargerMeneurs() {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(getUrl('skater-stats-leaders/current?categories=goals&limit=10')),
        fetch(getUrl('skater-stats-leaders/current?categories=assists&limit=10')),
        fetch(getUrl('skater-stats-leaders/current?categories=points&limit=10')),
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      const fmt = (data, cat) => (data[cat] || []).map((j, i) => ({ rang: i + 1, nom: `${j.firstName?.default || ''} ${j.lastName?.default || ''}`.trim(), equipe: j.teamAbbrevs || j.teamAbbrev || '', position: j.position || '', valeur: j.value || 0, playerId: j.playerId || j.id || '' }));
      setMeneurs({ buts: fmt(d1, 'goals'), passes: fmt(d2, 'assists'), points: fmt(d3, 'points') });
    } catch (err) { console.error(err); }
  }

  async function detecterEtChargerPlayoffs() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const resSchedule = await fetch(getUrl(`schedule/${today}`));
      const dataSchedule = await resSchedule.json();
      const allGames = (dataSchedule.gameWeek || []).flatMap(w => w.games || []);
      const enPlayoffs = allGames.some(g => g.gameType === 3);
      setEstPlayoffs(enPlayoffs);
      if (enPlayoffs) {
        const resBracket = await fetch(getUrl('playoff-series/carousel/20252026'));
        const dataBracket = await resBracket.json();
        setPlayoffBracket(dataBracket);
      }
    } catch (err) { console.error(err); }
  }
  const padding = isMobile ? '16px' : '32px';
  const maxWidth = isMobile ? '100%' : '1000px';

  if (joueurSelectionne) {
    return (
      <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
        <FicheJoueur joueur={joueurSelectionne} onBack={() => setJoueurSelectionne(null)} />
      </div>
    );
  }
 
  if (!categorie) {
    const ligueInfo = LIGUES.find(l => l.id === ligue);
    return (
      <div style={{ minHeight: '85vh', padding: padding, maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={ligueInfo.logo} alt={ligueInfo.label} style={{ height: '32px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <h2 style={{ margin: '0 0 2px', fontSize: isMobile ? '22px' : '28px', fontWeight: '900', color: 'white' }}>{ligueInfo.label}</h2>
              <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>Choisis une categorie</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '22px', display: 'flex', flexDirection: 'column', height: '720px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '900', color: 'white' }}>Team Statistics</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>{estPlayoffs ? 'Playoff Bracket' : 'Classement par division · Top 10'}</p>
            </div>
            <div style={{ flex: 1 }}>{estPlayoffs ? <BracketPlayoffs bracket={playoffBracket} /> : <CarrouselDivisions classement={classement} />}</div>
            <button onClick={() => setCategorie('equipes')} style={{ marginTop: '16px', background: '#f97316', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' }}>View Statistics</button>
          </div>
          <div style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '22px', display: 'flex', flexDirection: 'column', height: '720px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '900', color: 'white' }}>Player Statistics</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>{estPlayoffs ? 'Playoff Leaders' : 'Goals, assists and points · Top 10'}</p>
            </div>
            <div style={{ flex: 1 }}><CarrouselMeneurs meneurs={meneurs} /></div>
            <button onClick={() => setCategorie('joueurs')} style={{ marginTop: '16px', background: '#f97316', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' }}>View Statistics</button>
          </div>
        </div>
      </div>
    );
  }

  const ligueInfo = LIGUES.find(l => l.id === ligue);
  return (
    <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setCategorie(null)} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={ligueInfo.logo} alt={ligueInfo.label} style={{ height: '26px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <div>
            <h2 style={{ margin: '0 0 1px', fontSize: isMobile ? '16px' : '20px', fontWeight: '900', color: 'white' }}>
              {ligueInfo.label} · {categorie === 'equipes' ? 'Teams' : 'Players'}
            </h2>
            <p style={{ color: '#666', margin: 0, fontSize: '11px' }}>
              {categorie === 'equipes' ? "Click on a match to analyze" : "Click on a player"}
            </p>
          </div>
        </div>
      </div>
      {categorie === 'equipes' && <PageStatsEquipes classement={classement} onSelectJoueur={setJoueurSelectionne} lineupDF={lineupDF} />}
      {categorie === 'joueurs' && <PageStatsJoueurs onSelectJoueur={setJoueurSelectionne} />}
    </div>
  );
}

// Flux dedie a l'onglet Analyses : page d'accueil avec 2 cartes (Equipe / Joueur), pas de
// choix de ligue/categorie. "Analyser une Equipe" va direct aux matchups d'equipes,
// "Analyser un Joueur" va a une page recherche + Props/Matchups joueurs.
function AnalysesFlux({ onLigueChange }) {
  const isMobile = useIsMobile();
  const [vue, setVue] = useState(null); // null = accueil, 'equipes' | 'joueurs'
  const [classement, setClassement] = useState([]);
  const [joueurSelectionne, setJoueurSelectionne] = useState(null);
  const lineupDF = useLineupsDailyFaceoff();

  useEffect(() => { if (onLigueChange) onLigueChange('nhl'); }, []);
  useEffect(() => { chargerClassement(); }, []);

  async function chargerClassement() {
    try {
      const res = await fetch(getUrl('standings/now'));
      const data = await res.json();
      setClassement(data.standings || []);
    } catch (err) { console.error(err); }
  }

  const padding = isMobile ? '16px' : '32px';
  const maxWidth = isMobile ? '100%' : '1000px';

  if (joueurSelectionne) {
    return (
      <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
        <FicheJoueur joueur={joueurSelectionne} onBack={() => setJoueurSelectionne(null)} />
      </div>
    );
  }

  if (!vue) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: padding, maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: isMobile ? '24px' : '30px', fontWeight: '900', textAlign: 'center', color: 'white' }}>Analyses</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div onClick={() => setVue('equipes')} style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '32px 20px', textAlign: 'center', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏒</div>
            <div style={{ fontWeight: '900', fontSize: '18px', color: 'white' }}>Analyser une Équipe</div>
          </div>
          <div onClick={() => setVue('joueurs')} style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '32px 20px', textAlign: 'center', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏃</div>
            <div style={{ fontWeight: '900', fontSize: '18px', color: 'white' }}>Analyser un Joueur</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
      <button onClick={() => setVue(null)} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>Back</button>
      {vue === 'equipes' && <PageStatsEquipesAnalyses classement={classement} onSelectJoueur={setJoueurSelectionne} lineupDF={lineupDF} />}
      {vue === 'joueurs' && <PageStatsJoueursAnalyses onSelectJoueur={setJoueurSelectionne} />}
    </div>
  );
}

function AnalysesRecherche() {
  const isMobile = useIsMobile();
  const [joueurSelectionne, setJoueurSelectionne] = useState(null);
  const padding = isMobile ? '16px' : '32px';
  const maxWidth = isMobile ? '100%' : '1000px';

  return (
    <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
      {joueurSelectionne ? (
        <FicheJoueur joueur={joueurSelectionne} onBack={() => setJoueurSelectionne(null)} />
      ) : (
        <PageStatsJoueurs onSelectJoueur={setJoueurSelectionne} />
      )}
    </div>
  );
}

export { AnalysesRecherche, AnalysesFlux };
export default Analyses;
 