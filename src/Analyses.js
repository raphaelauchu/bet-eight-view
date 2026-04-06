import React, { useState, useEffect, useRef } from 'react';

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
  { id: 'mlb', label: 'MLB', disponible: false, logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg', description: 'Ligue majeure de baseball' },
  { id: 'nba', label: 'NBA', disponible: false, logo: 'https://cdn.nba.com/logos/leagues/logo-nba.svg', description: 'Association nationale de basketball' },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isMobile;
}

function getUrl(path) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  if (estEnProduction) return `/api/nhl?path=${path}`;
  return `https://corsproxy.io/?${encodeURIComponent('https://api-web.nhle.com/v1/' + path)}`;
}

function getPhotoJoueur(playerId) {
  return `https://assets.nhle.com/mugs/${playerId}.png`;
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
          {equipes.slice(0, 8).map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: i === 0 ? 'rgba(249,115,22,0.1)' : '#1a1a1a', borderRadius: '8px', padding: '8px 12px', border: i === 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
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
    { label: 'Top 8 Buteurs', data: meneurs.buts?.slice(0, 8) || [] },
    { label: 'Top 8 Passeurs', data: meneurs.passes?.slice(0, 8) || [] },
    { label: 'Top 8 Pointeurs', data: meneurs.points?.slice(0, 8) || [] },
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
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: i === 0 ? 'rgba(249,115,22,0.1)' : '#1a1a1a', borderRadius: '8px', padding: '8px 12px', border: i === 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
                <span style={{ color: i === 0 ? '#f97316' : '#555', fontWeight: 'bold', fontSize: '13px', width: '18px', textAlign: 'center' }}>{i + 1}</span>
                <img src={getPhotoJoueur(j.playerId)} alt={j.nom} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#222', border: '2px solid #333' }} onError={e => { e.target.src = LOGOS_NHL[j.equipe] || ''; }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{j.nom}</div>
                  <div style={{ color: '#666', fontSize: '11px' }}>{j.equipe} · {j.position}</div>
                </div>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{j.valeur}</span>
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
      <img src={getPhotoJoueur(joueur.id)} alt={joueur.nom} style={{ width: taille, height: taille, borderRadius: '50%', objectFit: 'cover', backgroundColor: '#222', border: '2px solid #333', marginBottom: '4px' }} onError={e => { e.target.style.display = 'none'; }} />
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
      <img src={getPhotoJoueur(gardien.id)} alt={gardien.nom} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#222', border: '3px solid #f97316' }} onError={e => { e.target.style.display = 'none'; }} />
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

function AlignementEquipe({ abbrev, nom, logo, joueurs, onSelect, isMobile }) {
  const forwards = joueurs.filter(j => ['L', 'C', 'R', 'LW', 'RW', 'F'].includes(j.position));
  const defenseurs = joueurs.filter(j => ['D', 'LD', 'RD'].includes(j.position));
  const gardiens = joueurs.filter(j => j.position === 'G');
  const gardienPartant = gardiens[0] || null;

  const lignes = [];
  if (forwards.some(j => j.ligne)) {
    const parLigne = {};
    forwards.forEach(j => { const l = j.ligne || 99; if (!parLigne[l]) parLigne[l] = []; parLigne[l].push(j); });
    Object.keys(parLigne).sort((a, b) => Number(a) - Number(b)).forEach(l => lignes.push(parLigne[l]));
  } else {
    for (let i = 0; i < Math.min(forwards.length, 12); i += 3) lignes.push(forwards.slice(i, i + 3));
  }

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
        <SectionGardien gardien={gardienPartant} onSelect={onSelect} />
      </div>

      {/* Sur mobile: colonne unique, sur desktop: côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Attaquants</div>
          {lignes.map((ligne, li) => (
            <div key={li} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Ligne {li + 1} · {ligne.reduce((s, j) => s + (j.points || 0), 0)} pts</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {ligne.map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={joueurChaud?.id === j.id && (j.points || 0) > 0} isMobile={isMobile} />)}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Defenseurs</div>
          {paires.map((paire, pi) => (
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
                  {forwards.slice(0, 3).filter(Boolean).map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={false} isMobile={isMobile} />)}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[defenseurs[0], defenseurs[1]].filter(Boolean).map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={false} isMobile={isMobile} />)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#f97316', marginBottom: '4px' }}>PP2</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                  {forwards.slice(3, 6).filter(Boolean).map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={false} isMobile={isMobile} />)}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[defenseurs[2], defenseurs[3]].filter(Boolean).map((j, i) => <CarteJoueurLigne key={i} joueur={j} onSelect={onSelect} estChaud={false} isMobile={isMobile} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CarteMatchJoueurs({ match, filtre, onSelectJoueur }) {
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
          const saison = data.featuredStats?.regularSeason?.subSeason;
          const isGardien = j.position === 'G';
          return { ...j, goals: isGardien ? null : (saison?.goals ?? 0), assists: isGardien ? null : (saison?.assists ?? 0), points: isGardien ? null : (saison?.points ?? 0), gaa: isGardien ? (saison?.goalsAgainstAvg?.toFixed(2) ?? '-') : null, svp: isGardien ? (saison?.savePctg ? (saison.savePctg * 100).toFixed(1) + '%' : '-') : null };
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
              {ongletEquipe === 0 && filtrerJoueurs(roster1).length > 0 && <AlignementEquipe abbrev={abbrev1} nom={nom1} logo={LOGOS_NHL[abbrev1]} joueurs={filtrerJoueurs(roster1)} onSelect={onSelectJoueur} isMobile={isMobile} />}
              {ongletEquipe === 1 && filtrerJoueurs(roster2).length > 0 && <AlignementEquipe abbrev={abbrev2} nom={nom2} logo={LOGOS_NHL[abbrev2]} joueurs={filtrerJoueurs(roster2)} onSelect={onSelectJoueur} isMobile={isMobile} />}
              {((ongletEquipe === 0 && filtrerJoueurs(roster1).length === 0) || (ongletEquipe === 1 && filtrerJoueurs(roster2).length === 0)) && <p style={{ color: '#666', textAlign: 'center' }}>Aucun joueur trouve.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PageStatsJoueurs({ onSelectJoueur }) {
  const isMobile = useIsMobile();
  const [matchsParJour, setMatchsParJour] = useState({});
  const [jourActif, setJourActif] = useState('');
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');

  useEffect(() => { chargerSemaine(); }, []);

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

  const jours = Object.keys(matchsParJour).sort();

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <input
          style={{ width: '100%', padding: '11px 14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          placeholder="Rechercher un joueur ou une equipe..."
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
              const label = estAujourdhui ? "Auj." : d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric' });
              const nb = matchsParJour[jour]?.length || 0;
              return (
                <button key={jour} onClick={() => setJourActif(jour)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: jourActif === jour ? '#f97316' : '#1a1a1a', color: jourActif === jour ? 'white' : '#888', fontSize: '12px', fontWeight: jourActif === jour ? 'bold' : 'normal' }}>
                  {label}
                  <span style={{ display: 'block', fontSize: '10px', color: jourActif === jour ? 'rgba(255,255,255,0.8)' : '#555' }}>{nb}m</span>
                </button>
              );
            })}
          </div>
          {(matchsParJour[jourActif] || []).map((match, i) => <CarteMatchJoueurs key={i} match={match} filtre={filtre} onSelectJoueur={onSelectJoueur} />)}
        </>
      )}
    </div>
  );
}

function EtoilesConfiance({ score }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: '13px', color: i <= score ? '#f97316' : '#333' }}>★</span>)}
    </div>
  );
}

function BadgeTendance({ resultats }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {resultats.map((r, i) => <div key={i} style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: r === 'W' ? '#f97316' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', color: 'white' }}>{r}</div>)}
    </div>
  );
}

function CarteMatchEquipes({ match, classement }) {
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
  const gf1 = e1 ? e1.goalFor / (e1.gamesPlayed || 1) : 3;
  const ga1 = e1 ? e1.goalAgainst / (e1.gamesPlayed || 1) : 3;
  const gf2 = e2 ? e2.goalFor / (e2.gamesPlayed || 1) : 3;
  const ga2 = e2 ? e2.goalAgainst / (e2.gamesPlayed || 1) : 3;
  const pts1 = e1?.points || 0; const pts2 = e2?.points || 0;
  const wins1 = e1?.wins || 0; const wins2 = e2?.wins || 0;
  const losses1 = e1?.losses || 0; const losses2 = e2?.losses || 0;
  const otl1 = e1?.otLosses || 0; const otl2 = e2?.otLosses || 0;
  const gp1 = e1?.gamesPlayed || 1; const gp2 = e2?.gamesPlayed || 1;
  const total_pts = pts1 + pts2;
  const prob1 = total_pts > 0 ? Math.round((pts1 / total_pts) * 100) : 50;
  const prob2 = 100 - prob1;
  const win1 = Math.round((wins1 / (wins1 + losses1 + otl1 || 1)) * 100);
  const win2 = Math.round((wins2 / (wins2 + losses2 + otl2 || 1)) * 100);
  const total_buts = ((gf1 + ga2 + gf2 + ga1) / 2).toFixed(1);
  const diff = (gf1 - ga1 - gf2 + ga2).toFixed(1);
  const overUnder = parseFloat(total_buts) > 5.5 ? 'OVER' : 'UNDER';
  const confiance = Math.abs(prob1 - 50) > 15 ? 5 : Math.abs(prob1 - 50) > 10 ? 4 : Math.abs(prob1 - 50) > 5 ? 3 : 2;
  const genT = (w) => Array(5).fill(null).map(() => Math.random() * 100 < w ? 'W' : 'L');
  const favori = prob1 > prob2 ? abbrev1 : abbrev2;

  return (
    <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', overflow: 'hidden', marginBottom: '10px' }}>
      <div onClick={() => setOuvert(!ouvert)} style={{ padding: isMobile ? '12px 14px' : '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: isMobile ? '13px' : '14px' }}>{isMobile ? abbrev1 : nom1}</div>
              <div style={{ color: '#666', fontSize: '10px' }}>{wins1}V-{losses1}D</div>
            </div>
          </div>
          <span style={{ color: '#444', fontWeight: 'bold', fontSize: '13px' }}>@</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: isMobile ? '13px' : '14px' }}>{isMobile ? abbrev2 : nom2}</div>
              <div style={{ color: '#666', fontSize: '10px' }}>{wins2}V-{losses2}D</div>
            </div>
            <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {etat === 'LIVE' || etat === 'CRIT' ? <span style={{ backgroundColor: '#1a0000', color: '#ef4444', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>LIVE</span> : <span style={{ color: '#666', fontSize: '12px' }}>{heure}</span>}
            <EtoilesConfiance score={confiance} />
          </div>
          <div style={{ color: '#f97316', fontSize: '11px' }}>{favori} {Math.max(prob1, prob2)}% · {overUnder}</div>
        </div>
      </div>

      {ouvert && (
        <div style={{ borderTop: '1px solid #222', padding: isMobile ? '12px 14px' : '20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#f97316', fontWeight: 'bold', fontSize: '12px' }}>{abbrev1} {prob1}%</span>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{prob2}% {abbrev2}</span>
            </div>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '26px' }}>
              <div style={{ width: `${prob1}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', color: 'white' }}>{prob1}%</div>
              <div style={{ width: `${prob2}%`, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', color: 'white' }}>{prob2}%</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[
              { abbrev: abbrev1, logo: LOGOS_NHL[abbrev1], pts: pts1, win: win1, gf: gf1, ga: ga1, gp: gp1, t: genT(win1) },
              { abbrev: abbrev2, logo: LOGOS_NHL[abbrev2], pts: pts2, win: win2, gf: gf2, ga: ga2, gp: gp2, t: genT(win2) },
            ].map((eq, i) => (
              <div key={i} style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <img src={eq.logo} alt={eq.abbrev} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{eq.abbrev}</span>
                </div>
                {[['Points', eq.pts, '#f97316'], ['Win%', `${eq.win}%`, 'white'], ['Buts/m', eq.gf.toFixed(2), 'white'], ['Acc./m', eq.ga.toFixed(2), 'white']].map(([l, v, c], j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: '#666', fontSize: '10px' }}>{l}</span>
                    <span style={{ fontWeight: 'bold', color: c, fontSize: '11px' }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: '6px' }}>
                  <div style={{ color: '#666', fontSize: '9px', marginBottom: '3px' }}>Forme</div>
                  <BadgeTendance resultats={eq.t} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '9px', marginBottom: '2px' }}>Diff.</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{parseFloat(diff) > 0 ? `${abbrev1} +${diff}` : `${abbrev2} +${Math.abs(parseFloat(diff)).toFixed(1)}`}</div>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '9px', marginBottom: '2px' }}>Total</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{total_buts} buts</div>
            </div>
            <div style={{ backgroundColor: overUnder === 'OVER' ? 'rgba(249,115,22,0.15)' : '#1a1a1a', border: overUnder === 'OVER' ? '1px solid rgba(249,115,22,0.4)' : '1px solid #222', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '9px', marginBottom: '2px' }}>Rec.</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: overUnder === 'OVER' ? '#f97316' : 'white' }}>{overUnder}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FicheJoueur({ joueur, onRetour }) {
  const isMobile = useIsMobile();
  const [statsAvancees, setStatsAvancees] = useState(null);
  const [dernierMatchs, setDernierMatchs] = useState([]);
  const [ongletStat, setOngletStat] = useState('PTS');
  const [ongletPeriode, setOngletPeriode] = useState('L10');
  const [ongletChart, setOngletChart] = useState('SZN');
  const [typeChart, setTypeChart] = useState('SOG');
  const [chargement, setChargement] = useState(true);

  useEffect(() => { chargerStats(); }, [joueur.id]);

  async function chargerStats() {
    setChargement(true);
    try {
      const res = await fetch(getUrl(`player/${joueur.id}/landing`));
      const data = await res.json();
      const saison = data.featuredStats?.regularSeason?.subSeason;
      const isGardien = joueur.position === 'G';
      if (isGardien) {
        setStatsAvancees({ gaa: saison?.goalsAgainstAvg?.toFixed(2) ?? '-', svp: saison?.savePctg ? (saison.savePctg * 100).toFixed(1) + '%' : '-', wins: saison?.wins ?? '-', losses: saison?.losses ?? '-', shutouts: saison?.shutouts ?? '-', gamesStarted: saison?.gamesStarted ?? '-' });
      } else {
        setStatsAvancees({ goals: saison?.goals ?? 0, assists: saison?.assists ?? 0, points: saison?.points ?? 0, plusMinus: saison?.plusMinus ?? 0, ppp: saison?.powerPlayPoints ?? 0, sog: saison?.shots ?? 0, hits: saison?.hits ?? 0, blocks: saison?.blockedShots ?? 0, fow: saison?.faceoffWinningPctg ? (saison.faceoffWinningPctg * 100).toFixed(1) + '%' : '-', fowPct: saison?.faceoffWinningPctg ?? 0, gp: saison?.gamesPlayed ?? 1, toi: saison?.avgToi ?? '-' });
      }
      const gameLog = data.last5Games || data.recentGameResults || [];
      setDernierMatchs(gameLog.slice(0, 20));
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  const isGardien = joueur.position === 'G';
  const gp = statsAvancees?.gp || 1;
  const sog = statsAvancees?.sog || 0;

  const ongletsDef = isGardien
    ? [{ id: 'GAA', label: 'GAA' }, { id: 'SVP', label: 'SV%' }]
    : [{ id: 'PTS', label: 'PTS' }, { id: 'SOG', label: 'SOG' }, { id: 'GOAL', label: 'GOAL' }, { id: 'AST', label: 'AST' }, { id: 'PPP', label: 'PPP' }, { id: 'FOW', label: 'FOW' }, { id: 'BLK', label: 'BLK' }, { id: 'HITS', label: 'HITS' }];

  const getValeurMatch = (m, stat) => {
    switch (stat) {
      case 'PTS': return m.points ?? ((m.goals || 0) + (m.assists || 0));
      case 'SOG': return m.shots ?? m.sog ?? 0;
      case 'GOAL': return m.goals ?? 0;
      case 'AST': return m.assists ?? 0;
      case 'PPP': return m.powerPlayPoints ?? 0;
      case 'FOW': return m.faceoffWins ?? 0;
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
      case 'FOW': return parseFloat(((statsAvancees.fowPct || 0) * 10).toFixed(1));
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

  const zones = [
    { label: 'LOW LEFT', sog: Math.round(sog * 0.18) },
    { label: 'LOW', sog: Math.round(sog * 0.22) },
    { label: 'LOW RIGHT', sog: Math.round(sog * 0.16) },
    { label: 'BOARDS', sog: Math.round(sog * 0.12) },
    { label: 'SLOT', sog: Math.round(sog * 0.35) },
    { label: 'BOARDS', sog: Math.round(sog * 0.08) },
    { label: 'LEFT', sog: Math.round(sog * 0.05) },
    { label: 'POINT', sog: Math.round(sog * 0.04) },
    { label: 'RIGHT', sog: Math.round(sog * 0.05) },
  ];

  const pctZones = zones.map(z => ({ ...z, pct: sog > 0 ? Math.round((z.sog / sog) * 100) : 0 }));
  const getValeurZone = (z) => typeChart === 'SOG' ? z.sog : `${z.pct}%`;
  const getTendanceZone = (z) => {
    if (sog === 0) return 'neutre';
    const pct = z.sog / sog;
    const attendu = 1 / zones.length;
    if (pct > attendu * 1.15) return 'haut';
    if (pct < attendu * 0.85) return 'bas';
    return 'neutre';
  };

  const positionsZones = [
    { x: 75, y: 130 }, { x: 220, y: 110 }, { x: 365, y: 130 },
    { x: 50, y: 225 }, { x: 220, y: 210 }, { x: 390, y: 225 },
    { x: 75, y: 335 }, { x: 220, y: 335 }, { x: 365, y: 335 },
  ];

  const pad = isMobile ? '14px' : '20px';

  return (
    <div style={{ padding: isMobile ? '0' : '0' }}>
      <button onClick={onRetour} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>Retour</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: '14px' }}>
        <img src={getPhotoJoueur(joueur.id)} alt={joueur.nom} style={{ width: isMobile ? '60px' : '72px', height: isMobile ? '60px' : '72px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#222', border: '3px solid #f97316' }} onError={e => { e.target.src = LOGOS_NHL[joueur.equipe] || ''; }} />
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
            <div style={{ color: '#f97316', fontSize: '18px', fontWeight: '900' }}>{getMoyenneSaison(ongletStat)}</div>
            <div style={{ color: '#555', fontSize: '9px' }}>{ongletStat}/m</div>
          </div>
        )}
      </div>

      {chargement ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Chargement...</p>
      ) : (
        <>
          {/* Onglets stats */}
          {!isGardien && (
            <div style={{ display: 'flex', gap: '3px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
              {ongletsDef.map(o => (
                <button key={o.id} onClick={() => setOngletStat(o.id)} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: ongletStat === o.id ? '#f97316' : '#111', color: ongletStat === o.id ? 'white' : '#666', fontSize: '12px', fontWeight: ongletStat === o.id ? 'bold' : 'normal' }}>{o.label}</button>
              ))}
            </div>
          )}

          {/* Graphique derniers matchs */}
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
                  <span style={{ color: '#555', fontSize: '10px' }}> au dessus</span>
                </div>
              </div>

              {matchsFiltres.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center', fontSize: '12px' }}>Donnees non disponibles</p>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '22px' }}>
                    <span style={{ color: '#555', fontSize: '9px' }}>{Math.ceil(maxVal)}</span>
                    <span style={{ color: '#888', fontSize: '9px' }}>{moyenne}</span>
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
                            <span style={{ fontSize: '8px', color: estAuDessus ? '#f97316' : '#ef4444', fontWeight: 'bold' }}>{val}</span>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #1a1a1a' }}>
                {[['Buts', matchsFiltres.reduce((s, m) => s + (m.goals || 0), 0), '#f97316'], ['Passes', matchsFiltres.reduce((s, m) => s + (m.assists || 0), 0), 'white'], ['Points', matchsFiltres.reduce((s, m) => s + (m.points ?? ((m.goals || 0) + (m.assists || 0))), 0), 'white'], ['Tirs', matchsFiltres.reduce((s, m) => s + (m.shots || 0), 0), 'white']].map(([l, v, c], i) => (
                  <div key={i} style={{ backgroundColor: '#1a1a1a', borderRadius: '7px', padding: '8px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: c }}>{v}</div>
                    <div style={{ fontSize: '9px', color: '#555' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats gardien */}
          {isGardien && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {[['GAA', statsAvancees?.gaa, '#f97316'], ['SV%', statsAvancees?.svp, '#f97316'], ['Victoires', statsAvancees?.wins, 'white'], ['Defaites', statsAvancees?.losses, 'white'], ['Blanchiss.', statsAvancees?.shutouts, 'white'], ['Matchs', statsAvancees?.gamesStarted, '#666']].map(([l, v, c], i) => (
                <div key={i} style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #222', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: c }}>{v ?? '-'}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stats saison attaquant */}
          {!isGardien && statsAvancees && (
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad, marginBottom: '14px' }}>
              <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>SAISON COMPLETE</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {[['Buts', statsAvancees.goals, '#f97316'], ['Passes', statsAvancees.assists, 'white'], ['Points', statsAvancees.points, 'white'], ['+/-', (statsAvancees.plusMinus ?? 0) >= 0 ? `+${statsAvancees.plusMinus}` : statsAvancees.plusMinus, (statsAvancees.plusMinus ?? 0) >= 0 ? '#f97316' : '#ef4444']].map(([l, v, c], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', backgroundColor: '#1a1a1a', borderRadius: '7px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: c }}>{v ?? '-'}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {[['PPP', statsAvancees.ppp], ['Tirs', statsAvancees.sog], ['Hits', statsAvancees.hits], ['Blocs', statsAvancees.blocks]].map(([l, v], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', backgroundColor: '#1a1a1a', borderRadius: '7px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{v ?? '-'}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[['Face-off %', statsAvancees.fow], ['Tps glace', statsAvancees.toi], ['Matchs', statsAvancees.gp]].map(([l, v], i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', backgroundColor: '#1a1a1a', borderRadius: '7px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: 'white' }}>{v ?? '-'}</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shot Chart */}
          {!isGardien && (
            <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: pad }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '900', color: 'white' }}>Shot Chart</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '6px' }}>
                {['SZN', 'L5', 'L10', 'L20'].map(n => (
                  <button key={n} onClick={() => setOngletChart(n)} style={{ padding: '7px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: ongletChart === n ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '11px', fontWeight: ongletChart === n ? 'bold' : 'normal' }}>{n}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                {[['SOG', 'Shots on Goal'], ['Buts', 'Goals']].map(([t, label]) => (
                  <button key={t} onClick={() => setTypeChart(t)} style={{ padding: '7px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: typeChart === t ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '11px', fontWeight: typeChart === t ? 'bold' : 'normal' }}>{label}</button>
                ))}
              </div>

              <div style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', overflow: 'hidden' }}>
                <svg viewBox="0 0 440 420" style={{ width: '100%', display: 'block' }}>
                  <rect x="0" y="0" width="440" height="420" fill="#1a1a1a" />
                  <rect x="0" y="0" width="440" height="420" rx="10" fill="none" stroke="#2a2a2a" strokeWidth="2" />
                  <rect x="175" y="8" width="90" height="40" rx="3" fill="none" stroke="#888" strokeWidth="2" />
                  <line x1="190" y1="8" x2="190" y2="48" stroke="#444" strokeWidth="0.7" />
                  <line x1="205" y1="8" x2="205" y2="48" stroke="#444" strokeWidth="0.7" />
                  <line x1="220" y1="8" x2="220" y2="48" stroke="#444" strokeWidth="0.7" />
                  <line x1="235" y1="8" x2="235" y2="48" stroke="#444" strokeWidth="0.7" />
                  <line x1="250" y1="8" x2="250" y2="48" stroke="#444" strokeWidth="0.7" />
                  <line x1="265" y1="8" x2="265" y2="48" stroke="#444" strokeWidth="0.7" />
                  <line x1="175" y1="22" x2="265" y2="22" stroke="#444" strokeWidth="0.7" />
                  <line x1="175" y1="36" x2="265" y2="36" stroke="#444" strokeWidth="0.7" />
                  <line x1="50" y1="55" x2="390" y2="55" stroke="#ef4444" strokeWidth="1.5" opacity="0.5" />
                  <path d="M175 55 Q175 100 220 100 Q265 100 265 55" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" />
                  <line x1="145" y1="55" x2="115" y2="8" stroke="#555" strokeWidth="1" />
                  <line x1="295" y1="55" x2="325" y2="8" stroke="#555" strokeWidth="1" />
                  <circle cx="120" cy="220" r="65" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="120" cy="220" r="3" fill="#333" />
                  <line x1="103" y1="220" x2="109" y2="220" stroke="#444" strokeWidth="1" />
                  <line x1="131" y1="220" x2="137" y2="220" stroke="#444" strokeWidth="1" />
                  <line x1="120" y1="203" x2="120" y2="209" stroke="#444" strokeWidth="1" />
                  <line x1="120" y1="231" x2="120" y2="237" stroke="#444" strokeWidth="1" />
                  <circle cx="320" cy="220" r="65" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="320" cy="220" r="3" fill="#333" />
                  <line x1="303" y1="220" x2="309" y2="220" stroke="#444" strokeWidth="1" />
                  <line x1="331" y1="220" x2="337" y2="220" stroke="#444" strokeWidth="1" />
                  <line x1="320" y1="203" x2="320" y2="209" stroke="#444" strokeWidth="1" />
                  <line x1="320" y1="231" x2="320" y2="237" stroke="#444" strokeWidth="1" />
                  <line x1="0" y1="360" x2="440" y2="360" stroke="#3b82f6" strokeWidth="2" opacity="0.4" />
                  <path d="M170 360 Q220 325 270 360" fill="none" stroke="#444" strokeWidth="1.2" />
                  <circle cx="120" cy="388" r="4" fill="#333" />
                  <circle cx="320" cy="388" r="4" fill="#333" />
                  {pctZones.map((z, i) => {
                    const pos = positionsZones[i];
                    const tendance = getTendanceZone(z);
                    const val = getValeurZone(z);
                    return (
                      <g key={i}>
                        <text x={pos.x} y={pos.y - 14} textAnchor="middle" fill="#777" fontSize="9" fontWeight="bold" letterSpacing="0.8">{z.label}</text>
                        {tendance === 'haut' && <polygon points={`${pos.x},${pos.y-7} ${pos.x-5},${pos.y} ${pos.x+5},${pos.y}`} fill="#f97316" />}
                        {tendance === 'bas' && <polygon points={`${pos.x},${pos.y} ${pos.x-5},${pos.y-7} ${pos.x+5},${pos.y-7}`} fill="#ef4444" />}
                        {tendance === 'neutre' && <circle cx={pos.x} cy={pos.y - 4} r="4" fill="#555" />}
                        <text x={pos.x + 10} y={pos.y + 4} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{val}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="10" height="8"><polygon points="5,0 0,8 10,8" fill="#f97316" /></svg>
                  <span style={{ fontSize: '10px', color: '#888' }}>Au dessus moy.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="10" height="8"><polygon points="5,8 0,0 10,0" fill="#ef4444" /></svg>
                  <span style={{ fontSize: '10px', color: '#888' }}>En dessous moy.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill="#555" /></svg>
                  <span style={{ fontSize: '10px', color: '#888' }}>Dans la moy.</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Analyses() {
  const isMobile = useIsMobile();
  const [ligue, setLigue] = useState(null);
  const [categorie, setCategorie] = useState(null);
  const [classement, setClassement] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [meneurs, setMeneurs] = useState({ buts: [], passes: [], points: [] });
  const [joueurSelectionne, setJoueurSelectionne] = useState(null);

  useEffect(() => { if (ligue === 'nhl' && !categorie) chargerPreview(); }, [ligue, categorie]);
  useEffect(() => { if (ligue === 'nhl' && categorie === 'equipes') chargerDonneesNHL(); }, [ligue, categorie]);

  async function chargerPreview() {
    try {
      const res = await fetch(getUrl('standings/now'));
      const data = await res.json();
      setClassement(data.standings || []);
      await chargerMeneurs();
    } catch (err) { console.error(err); }
  }

  async function chargerDonneesNHL() {
    setChargement(true);
    try {
      const aujourdhui = getDateStr(new Date());
      const [r1, r2] = await Promise.all([fetch(getUrl('standings/now')), fetch(getUrl(`schedule/${aujourdhui}`))]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setClassement(d1.standings || []);
      setMatchs(d2.gameWeek?.[0]?.games || []);
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  async function chargerMeneurs() {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(getUrl('skater-stats-leaders/current?categories=goals&limit=8')),
        fetch(getUrl('skater-stats-leaders/current?categories=assists&limit=8')),
        fetch(getUrl('skater-stats-leaders/current?categories=points&limit=8')),
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      const fmt = (data, cat) => (data[cat] || []).map((j, i) => ({ rang: i + 1, nom: `${j.firstName?.default || ''} ${j.lastName?.default || ''}`.trim(), equipe: j.teamAbbrevs || j.teamAbbrev || '', position: j.position || '', valeur: j.value || 0, playerId: j.playerId || j.id || '' }));
      setMeneurs({ buts: fmt(d1, 'goals'), passes: fmt(d2, 'assists'), points: fmt(d3, 'points') });
    } catch (err) { console.error(err); }
  }

  const padding = isMobile ? '16px' : '32px';
  const maxWidth = isMobile ? '100%' : '1000px';

  if (joueurSelectionne) {
    return (
      <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
        <FicheJoueur joueur={joueurSelectionne} onRetour={() => setJoueurSelectionne(null)} />
      </div>
    );
  }

  if (!ligue) {
    return (
      <div style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: padding }}>
        <h2 style={{ margin: '0 0 10px', fontSize: isMobile ? '28px' : '36px', fontWeight: '900', letterSpacing: '-1px', textAlign: 'center', color: 'white' }}>Analyses et Modeles</h2>
        <p style={{ color: '#666', margin: '0 0 40px', fontSize: '15px', textAlign: 'center' }}>Choisis ta ligue pour commencer</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', width: '100%', maxWidth: '900px' }}>
          {LIGUES.map(l => (
            <div key={l.id} onClick={() => l.disponible && setLigue(l.id)} style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: isMobile ? '24px 16px' : '40px 24px', textAlign: 'center', cursor: l.disponible ? 'pointer' : 'not-allowed', opacity: l.disponible ? 1 : 0.35 }}>
              <div style={{ height: isMobile ? '50px' : '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <img src={l.logo} alt={l.label} style={{ maxHeight: isMobile ? '50px' : '80px', maxWidth: '100px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
              </div>
              <div style={{ fontWeight: '900', fontSize: isMobile ? '18px' : '22px', marginBottom: '4px', color: 'white' }}>{l.label}</div>
              {!isMobile && <div style={{ color: '#666', fontSize: '13px', marginBottom: '10px' }}>{l.description}</div>}
              {l.disponible
                ? <span style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Disponible</span>
                : <span style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#555', fontSize: '11px', padding: '3px 10px', borderRadius: '20px' }}>Bientot</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!categorie) {
    const ligueInfo = LIGUES.find(l => l.id === ligue);
    return (
      <div style={{ minHeight: '85vh', padding: padding, maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <button onClick={() => setLigue(null)} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Retour</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={ligueInfo.logo} alt={ligueInfo.label} style={{ height: '32px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <h2 style={{ margin: '0 0 2px', fontSize: isMobile ? '22px' : '28px', fontWeight: '900', color: 'white' }}>{ligueInfo.label}</h2>
              <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>Choisis une categorie</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '900', color: 'white' }}>Statistiques Equipes</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>Classement par division</p>
            </div>
            <div style={{ flex: 1 }}><CarrouselDivisions classement={classement} /></div>
            <button onClick={() => setCategorie('equipes')} style={{ marginTop: '16px', background: '#f97316', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' }}>Voir les analyses</button>
          </div>
          <div style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '900', color: 'white' }}>Statistiques Joueurs</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>Meneurs buts, passes et points</p>
            </div>
            <div style={{ flex: 1 }}><CarrouselMeneurs meneurs={meneurs} /></div>
            <button onClick={() => setCategorie('joueurs')} style={{ marginTop: '16px', background: '#f97316', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' }}>Voir les matchs</button>
          </div>
        </div>
      </div>
    );
  }

  const ligueInfo = LIGUES.find(l => l.id === ligue);
  return (
    <div style={{ padding: padding, maxWidth: maxWidth, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setCategorie(null)} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Retour</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={ligueInfo.logo} alt={ligueInfo.label} style={{ height: '26px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <div>
            <h2 style={{ margin: '0 0 1px', fontSize: isMobile ? '16px' : '20px', fontWeight: '900', color: 'white' }}>
              {ligueInfo.label} · {categorie === 'equipes' ? 'Equipes' : 'Joueurs'}
            </h2>
            <p style={{ color: '#666', margin: 0, fontSize: '11px' }}>
              {categorie === 'equipes' ? "Clique pour voir l'analyse" : "Clique sur un joueur"}
            </p>
          </div>
        </div>
      </div>

      {categorie === 'equipes' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {['Probabilite victoire', 'Differentiel', 'Total buts'].map((m, i) => (
              <button key={i} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: i === 0 ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{m}</button>
            ))}
          </div>
          {chargement ? <p style={{ color: '#666', textAlign: 'center', padding: '60px 0' }}>Chargement...</p>
            : matchs.length === 0 ? <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#111', borderRadius: '16px' }}><p style={{ color: '#666' }}>Aucun match aujourd'hui.</p></div>
            : matchs.map((match, i) => <CarteMatchEquipes key={i} match={match} classement={classement} />)}
        </div>
      )}

      {categorie === 'joueurs' && <PageStatsJoueurs onSelectJoueur={setJoueurSelectionne} />}
    </div>
  );
}

export default Analyses;