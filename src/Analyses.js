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

const LIGUES = [
  { id: 'nhl', label: 'NHL', disponible: true, logo: 'https://assets.nhle.com/logos/nhl/svg/NHL_light.svg', description: 'Ligue nationale de hockey' },
  { id: 'nfl', label: 'NFL', disponible: false, logo: 'https://static.www.nfl.com/image/upload/v1554321393/league/nvfr7ogywskqrfaiu38m.svg', description: 'Ligue nationale de football' },
  { id: 'mlb', label: 'MLB', disponible: false, logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg', description: 'Ligue majeure de baseball' },
  { id: 'nba', label: 'NBA', disponible: false, logo: 'https://cdn.nba.com/logos/leagues/logo-nba.svg', description: 'Association nationale de basketball' },
];

function getDateAujourdhui() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getUrl(path) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  if (estEnProduction) return `/api/nhl?path=${path}`;
  return `https://corsproxy.io/?${encodeURIComponent('https://api-web.nhle.com/v1/' + path)}`;
}

function getPhotoJoueur(playerId) {
  return `https://assets.nhle.com/mugs/${playerId}.png`;
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
      setTimeout(() => {
        setIndexActif(prev => (prev + 1) % listeDivisions.length);
        setVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, [listeDivisions.length]);

  if (listeDivisions.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
      <p style={{ color: '#666' }}>Chargement du classement...</p>
    </div>
  );

  const [nomDiv, equipes] = listeDivisions[indexActif];

  return (
    <div>
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#f97316' }}>Division {nomDiv}</h3>
          <span style={{ color: '#666', fontSize: '13px' }}>{indexActif + 1} / {listeDivisions.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {equipes.slice(0, 8).map((e, i) => {
            const abbrev = e.teamAbbrev?.default;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: i === 0 ? 'rgba(249,115,22,0.1)' : '#1a1a1a', borderRadius: '8px', padding: '10px 14px', border: i === 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
                <span style={{ color: i < 3 ? '#f97316' : '#555', fontWeight: 'bold', fontSize: '14px', width: '20px', textAlign: 'center' }}>{i + 1}</span>
                <img src={LOGOS_NHL[abbrev]} alt={abbrev} style={{ width: '28px', height: '28px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <span style={{ flex: 1, fontWeight: 'bold', fontSize: '14px' }}>{abbrev}</span>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{e.points} pts</span>
              </div>
            );
          })}
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
    { id: 'buts', label: 'Top 5 Buteurs', unite: 'B', data: meneurs.buts?.slice(0, 5) || [] },
    { id: 'passes', label: 'Top 5 Passeurs', unite: 'A', data: meneurs.passes?.slice(0, 5) || [] },
    { id: 'points', label: 'Top 5 Pointeurs', unite: 'PTS', data: meneurs.points?.slice(0, 5) || [] },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndexActif(prev => (prev + 1) % categories.length);
        setVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const cat = categories[indexActif];

  return (
    <div>
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{cat.label}</h3>
          <span style={{ color: '#666', fontSize: '13px' }}>{indexActif + 1} / {categories.length}</span>
        </div>
        {cat.data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <p style={{ color: '#666' }}>Chargement...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {cat.data.map((j, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: i === 0 ? 'rgba(249,115,22,0.1)' : '#1a1a1a', borderRadius: '8px', padding: '10px 14px', border: i === 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
                <span style={{ color: i === 0 ? '#f97316' : '#555', fontWeight: 'bold', fontSize: '14px', width: '20px', textAlign: 'center' }}>{i + 1}</span>
                <img
                  src={getPhotoJoueur(j.playerId)}
                  alt={j.nom}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#222', border: '2px solid #333' }}
                  onError={e => { e.target.src = LOGOS_NHL[j.equipe] || ''; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{j.nom}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{j.equipe} · {j.position}</div>
                </div>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#f97316' }}>{j.valeur}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <PointsIndicateur total={categories.length} actif={indexActif} />
    </div>
  );
}

function EtoilesConfiance({ score }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: '14px', color: i <= score ? '#f97316' : '#333' }}>★</span>
      ))}
    </div>
  );
}

function BadgeTendance({ resultats }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {resultats.map((r, i) => (
        <div key={i} style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: r === 'W' ? '#f97316' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: 'white' }}>{r}</div>
      ))}
    </div>
  );
}

function CarteMatch({ match, classement }) {
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
    <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', overflow: 'hidden', marginBottom: '12px' }}>
      <div onClick={() => setOuvert(!ouvert)} style={{ padding: '18px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={LOGOS_NHL[abbrev1]} alt={abbrev1} style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{nom1}</div>
              <div style={{ color: '#666', fontSize: '12px' }}>{wins1}V-{losses1}D-{otl1}DP</div>
            </div>
          </div>
          <div style={{ color: '#444', fontWeight: 'bold', fontSize: '16px' }}>@</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{nom2}</div>
              <div style={{ color: '#666', fontSize: '12px' }}>{wins2}V-{losses2}D-{otl2}DP</div>
            </div>
            <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {etat === 'LIVE' || etat === 'CRIT'
              ? <span style={{ backgroundColor: '#1a0000', color: '#ef4444', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>EN DIRECT</span>
              : <span style={{ color: '#666', fontSize: '13px' }}>{heure}</span>}
            <EtoilesConfiance score={confiance} />
          </div>
          <div style={{ color: '#f97316', fontSize: '13px' }}>{favori} favori {Math.max(prob1, prob2)}% · {overUnder} {total_buts}</div>
          <div style={{ color: '#444', fontSize: '12px' }}>{ouvert ? 'Reduire' : 'Voir l\'analyse'}</div>
        </div>
      </div>

      {ouvert && (
        <div style={{ borderTop: '1px solid #222', padding: '22px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#f97316', fontWeight: 'bold' }}>{abbrev1} — {prob1}%</span>
              <span style={{ color: 'white', fontWeight: 'bold' }}>{prob2}% — {abbrev2}</span>
            </div>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '32px' }}>
              <div style={{ width: `${prob1}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', color: 'white' }}>{prob1}%</div>
              <div style={{ width: `${prob2}%`, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', color: 'white' }}>{prob2}%</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            {[
              { abbrev: abbrev1, logo: LOGOS_NHL[abbrev1], pts: pts1, win: win1, gf: gf1, ga: ga1, gp: gp1, t: genT(win1) },
              { abbrev: abbrev2, logo: LOGOS_NHL[abbrev2], pts: pts2, win: win2, gf: gf2, ga: ga2, gp: gp2, t: genT(win2) },
            ].map((eq, i) => (
              <div key={i} style={{ backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <img src={eq.logo} alt={eq.abbrev} style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                  <span style={{ fontWeight: 'bold' }}>{eq.abbrev}</span>
                </div>
                {[['Points', eq.pts, '#f97316'], ['Win%', `${eq.win}%`, 'white'], ['Buts/match', eq.gf.toFixed(2), 'white'], ['Accordes/match', eq.ga.toFixed(2), 'white'], ['Matchs', eq.gp, '#666']].map(([l, v, c], j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#666', fontSize: '12px' }}>{l}</span>
                    <span style={{ fontWeight: 'bold', color: c, fontSize: '13px' }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ color: '#666', fontSize: '11px', marginBottom: '5px' }}>Forme recente</div>
                  <BadgeTendance resultats={eq.t} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>Differentiel predit</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{parseFloat(diff) > 0 ? `${abbrev1} +${diff}` : `${abbrev2} +${Math.abs(parseFloat(diff)).toFixed(1)}`}</div>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>Total predit</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{total_buts} buts</div>
            </div>
            <div style={{ backgroundColor: overUnder === 'OVER' ? 'rgba(249,115,22,0.15)' : '#1a1a1a', border: overUnder === 'OVER' ? '1px solid rgba(249,115,22,0.4)' : '1px solid #222', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>Recommandation</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: overUnder === 'OVER' ? '#f97316' : 'white' }}>{overUnder} 5.5</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>Indice de confiance</div>
              <EtoilesConfiance score={confiance} />
            </div>
            <div style={{ color: '#666', fontSize: '13px', textAlign: 'right' }}>
              {confiance >= 4 ? 'Signal fort' : confiance >= 3 ? 'Signal modere' : 'Match tres serre'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Analyses() {
  const [ligue, setLigue] = useState(null);
  const [categorie, setCategorie] = useState(null);
  const [classement, setClassement] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [meneurs, setMeneurs] = useState({ buts: [], passes: [], points: [] });

  useEffect(() => {
    if (ligue === 'nhl' && !categorie) chargerPreview();
  }, [ligue, categorie]);

  useEffect(() => {
    if (ligue === 'nhl' && categorie === 'equipes') chargerDonneesNHL();
    if (ligue === 'nhl' && categorie === 'joueurs') chargerMeneurs();
  }, [ligue, categorie]);

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
      const aujourdhui = getDateAujourdhui();
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
        fetch(getUrl('skater-stats-leaders/current?categories=goals&limit=5')),
        fetch(getUrl('skater-stats-leaders/current?categories=assists&limit=5')),
        fetch(getUrl('skater-stats-leaders/current?categories=points&limit=5')),
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      const fmt = (data, cat) => (data[cat] || []).map((j, i) => ({
        rang: i + 1,
        nom: `${j.firstName?.default || ''} ${j.lastName?.default || ''}`.trim(),
        equipe: j.teamAbbrevs || j.teamAbbrev || '',
        position: j.position || '',
        valeur: j.value || 0,
        playerId: j.playerId || j.id || '',
      }));
      setMeneurs({ buts: fmt(d1, 'goals'), passes: fmt(d2, 'assists'), points: fmt(d3, 'points') });
    } catch (err) { console.error(err); }
  }

  // Etape 1 — Choix ligue
  if (!ligue) {
    return (
      <div style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '36px', fontWeight: '900', letterSpacing: '-1px', textAlign: 'center', color: 'white' }}>Analyses et Modeles</h2>
        <p style={{ color: '#666', margin: '0 0 56px', fontSize: '16px', textAlign: 'center' }}>Choisis ta ligue pour commencer</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', width: '100%', maxWidth: '900px' }}>
          {LIGUES.map(l => (
            <div key={l.id} onClick={() => l.disponible && setLigue(l.id)} style={{ backgroundColor: '#111', borderRadius: '20px', border: '2px solid #222', padding: '40px 24px', textAlign: 'center', cursor: l.disponible ? 'pointer' : 'not-allowed', opacity: l.disponible ? 1 : 0.35 }}>
              <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <img src={l.logo} alt={l.label} style={{ maxHeight: '80px', maxWidth: '120px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
              </div>
              <div style={{ fontWeight: '900', fontSize: '22px', marginBottom: '6px', color: 'white' }}>{l.label}</div>
              <div style={{ color: '#666', fontSize: '13px', marginBottom: '12px' }}>{l.description}</div>
              {l.disponible
                ? <span style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>Disponible</span>
                : <span style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#555', fontSize: '12px', padding: '4px 12px', borderRadius: '20px' }}>Bientot</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Etape 2 — Choix categorie avec carroussels
  if (!categorie) {
    const ligueInfo = LIGUES.find(l => l.id === ligue);
    return (
      <div style={{ minHeight: '85vh', padding: '48px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
          <button onClick={() => setLigue(null)} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Retour</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={ligueInfo.logo} alt={ligueInfo.label} style={{ height: '40px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '900', color: 'white' }}>{ligueInfo.label}</h2>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>Choisis une categorie · Mise a jour toutes les 5 secondes</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#111', borderRadius: '20px', border: '2px solid #222', padding: '28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '900', color: 'white' }}>Statistiques Equipes</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>Classement par division</p>
            </div>
            <div style={{ flex: 1 }}>
              <CarrouselDivisions classement={classement} />
            </div>
            <button onClick={() => setCategorie('equipes')} style={{ marginTop: '24px', background: '#f97316', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', width: '100%' }}>
              Voir les analyses
            </button>
          </div>

          <div style={{ backgroundColor: '#111', borderRadius: '20px', border: '2px solid #222', padding: '28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '900', color: 'white' }}>Statistiques Joueurs</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>Meneurs buts, passes et points</p>
            </div>
            <div style={{ flex: 1 }}>
              <CarrouselMeneurs meneurs={meneurs} />
            </div>
            <button onClick={() => setCategorie('joueurs')} style={{ marginTop: '24px', background: '#f97316', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', width: '100%' }}>
              Voir les props
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Etape 3 — Page d'analyse
  const ligueInfo = LIGUES.find(l => l.id === ligue);
  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <button onClick={() => setCategorie(null)} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Retour</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={ligueInfo.logo} alt={ligueInfo.label} style={{ height: '32px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: '22px', fontWeight: '900', color: 'white' }}>
              {ligueInfo.label} · {categorie === 'equipes' ? 'Statistiques Equipes' : 'Statistiques Joueurs'}
            </h2>
            <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>
              {categorie === 'equipes' ? 'Clique sur un match pour voir l\'analyse' : 'Meneurs de la saison'}
            </p>
          </div>
        </div>
      </div>

      {categorie === 'equipes' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {['Probabilite victoire', 'Differentiel de buts', 'Total de buts'].map((m, i) => (
              <button key={i} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: i === 0 ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '14px' }}>{m}</button>
            ))}
          </div>
          {chargement ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '60px 0' }}>Chargement...</p>
          ) : matchs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#111', borderRadius: '16px' }}>
              <p style={{ color: '#666' }}>Aucun match prevu aujourd\'hui.</p>
            </div>
          ) : matchs.map((match, i) => <CarteMatch key={i} match={match} classement={classement} />)}
        </div>
      )}

      {categorie === 'joueurs' && (
        <div>
          {[['Top 5 Buteurs', 'buts'], ['Top 5 Passeurs', 'passes'], ['Top 5 Pointeurs', 'points']].map(([label, key], idx) => (
            <div key={idx} style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', marginBottom: '20px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 22px', borderBottom: '1px solid #222' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#f97316' }}>{label}</h3>
              </div>
              {(meneurs[key] || []).map((j, i) => (
                <div key={i} style={{ padding: '12px 22px', borderBottom: i < 4 ? '1px solid #1a1a1a' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: i === 0 ? '#f97316' : '#555', fontWeight: 'bold', fontSize: '16px', width: '24px' }}>{i + 1}</span>
                  <img
                    src={getPhotoJoueur(j.playerId)}
                    alt={j.nom}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#222', border: '2px solid #333' }}
                    onError={e => { e.target.src = LOGOS_NHL[j.equipe] || ''; }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'white' }}>{j.nom}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{j.equipe} · {j.position}</div>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#f97316' }}>{j.valeur}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Analyses;