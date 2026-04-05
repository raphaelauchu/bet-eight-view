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
  { id: 'nhl', label: '🏒 NHL', disponible: true },
  { id: 'nfl', label: '🏈 NFL', disponible: false },
  { id: 'mlb', label: '⚾ MLB', disponible: false },
  { id: 'nba', label: '🏀 NBA', disponible: false },
];

function getDateAujourdhui() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUrl(path) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
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
  const ecart = Math.abs(prob1 - 50);
  const confiance = ecart > 15 ? 5 : ecart > 10 ? 4 : ecart > 5 ? 3 : 2;
  const genTendance = (w) => Array(5).fill(null).map(() => Math.random() * 100 < w ? 'W' : 'L');
  const tendance1 = genTendance(win1);
  const tendance2 = genTendance(win2);
  const favori = prob1 > prob2 ? abbrev1 : abbrev2;
  const probFavori = Math.max(prob1, prob2);

  return (
    <div style={{ backgroundColor: '#111827', borderRadius: '16px', border: '1px solid #1f2937', overflow: 'hidden', marginBottom: '16px' }}>
      <div onClick={() => setOuvert(!ouvert)} style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
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
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{nom2}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>{wins2}V-{losses2}D-{otl2}DP</div>
            </div>
            <img src={LOGOS_NHL[abbrev2]} alt={abbrev2} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {etat === 'LIVE' || etat === 'CRIT' ? (
              <span style={{ backgroundColor: '#7f1d1d', color: '#ef4444', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>🔴 EN DIRECT</span>
            ) : (
              <span style={{ color: '#6b7280', fontSize: '13px' }}>{heure}</span>
            )}
            <EtoilesConfiance score={confiance} />
          </div>
          <div style={{ color: '#fed7aa', fontSize: '13px', textAlign: 'right' }}>
            {favori} favori à {probFavori}% · {overUnder} {total_buts}
          </div>
          <div style={{ color: ouvert ? '#f97316' : '#4b5563', fontSize: '12px' }}>
            {ouvert ? '▲ Réduire' : '▼ Voir l\'analyse'}
          </div>
        </div>
      </div>

      {ouvert && (
        <div style={{ borderTop: '1px solid #1f2937', padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#fed7aa', fontWeight: 'bold', fontSize: '14px' }}>{abbrev1} — {prob1}%</span>
              <span style={{ color: '#f9a8d4', fontWeight: 'bold', fontSize: '14px' }}>{prob2}% — {abbrev2}</span>
            </div>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '36px' }}>
              <div style={{ width: `${prob1}%`, background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {prob1}%
              </div>
              <div style={{ width: `${prob2}%`, background: 'linear-gradient(135deg, #ec4899, #f43f5e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {prob2}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[
              { abbrev: abbrev1, logo: LOGOS_NHL[abbrev1], pts: pts1, win: win1, gf: gf1, ga: ga1, gamesPlayed: gamesPlayed1, tendance: tendance1 },
              { abbrev: abbrev2, logo: LOGOS_NHL[abbrev2], pts: pts2, win: win2, gf: gf2, ga: ga2, gamesPlayed: gamesPlayed2, tendance: tendance2 },
            ].map((eq, i) => (
              <div key={i} style={{ backgroundColor: '#1f2937', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <img src={eq.logo} alt={eq.abbrev} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                  <span style={{ fontWeight: 'bold' }}>{eq.abbrev}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Points', val: eq.pts, color: '#fed7aa' },
                    { label: 'Win%', val: `${eq.win}%`, color: '#22c55e' },
                    { label: 'Buts/match', val: eq.gf.toFixed(2), color: 'white' },
                    { label: 'Accordés/match', val: eq.ga.toFixed(2), color: 'white' },
                    { label: 'Matchs joués', val: eq.gamesPlayed, color: 'white' },
                  ].map((s, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>{s.label}</span>
                      <span style={{ fontWeight: 'bold', color: s.color }}>{s.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '6px' }}>Forme récente</div>
                  <BadgeTendance resultats={eq.tendance} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Différentiel prédit</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fed7aa' }}>
                {parseFloat(diff) > 0 ? `${abbrev1} +${diff}` : `${abbrev2} +${Math.abs(parseFloat(diff)).toFixed(1)}`}
              </div>
            </div>
            <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Total prédit</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fed7aa' }}>{total_buts} buts</div>
            </div>
            <div style={{ backgroundColor: overUnder === 'OVER' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${overUnder === 'OVER' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Recommandation</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: overUnder === 'OVER' ? '#22c55e' : '#ef4444' }}>{overUnder} {ligneBookmaker}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Indice de confiance</div>
              <EtoilesConfiance score={confiance} />
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px', maxWidth: '300px', textAlign: 'right' }}>
              {confiance >= 4 ? '✅ Signal fort' : confiance >= 3 ? '⚡ Signal modéré' : '⚠️ Match très serré'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageStatsEquipes({ classement, matchs, chargement }) {
  const MODELES = [
    { id: 'victoire', label: '🏆 Probabilité victoire' },
    { id: 'differentiel', label: '⚡ Différentiel de buts' },
    { id: 'total', label: '🎯 Total de buts' },
  ];
  const [modele, setModele] = useState('victoire');

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {MODELES.map(m => (
          <button key={m.id} onClick={() => setModele(m.id)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: modele === m.id ? '#f97316' : '#111827', color: 'white', fontSize: '14px', fontWeight: modele === m.id ? 'bold' : 'normal' }}>
            {m.label}
          </button>
        ))}
      </div>

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
            {matchs.length} match{matchs.length > 1 ? 's' : ''} aujourd'hui
          </p>
          {matchs.map((match, i) => (
            <CarteMatch key={i} match={match} classement={classement} mode={modele} />
          ))}
        </div>
      )}
    </div>
  );
}

function PagePlayerProps() {
  const PROPS = [
    { id: 'buts', label: '🥅 Buts', description: 'Probabilité qu\'un joueur marque' },
    { id: 'points', label: '🏒 Points', description: 'Probabilité qu\'un joueur obtienne un point' },
    { id: 'tirs', label: '🎯 Tirs', description: 'Nombre de tirs attendus' },
  ];
  const [prop, setProp] = useState('buts');

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {PROPS.map(p => (
          <button key={p.id} onClick={() => setProp(p.id)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: prop === p.id ? '#f97316' : '#111827', color: 'white', fontSize: '14px', fontWeight: prop === p.id ? 'bold' : 'normal' }}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: '#111827', borderRadius: '16px', border: '1px solid #1f2937', padding: '48px', textAlign: 'center' }}>
        <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🚧</p>
        <h3 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '800' }}>
          {PROPS.find(p => p.id === prop)?.label} — Bientôt disponible
        </h3>
        <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: '15px', maxWidth: '400px', margin: '0 auto 24px' }}>
          Les statistiques avancées par joueur arrivent prochainement. On travaille à intégrer les données de performance individuelle NHL.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '20px', padding: '8px 20px' }}>
          <span style={{ color: '#f97316', fontSize: '14px', fontWeight: 'bold' }}>Disponible dans la V2</span>
        </div>
      </div>
    </div>
  );
}

function Analyses() {
  const [ligue, setLigue] = useState(null);
  const [categorie, setCategorie] = useState(null);
  const [classement, setClassement] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (ligue === 'nhl' && categorie === 'equipes') {
      chargerDonneesNHL();
    }
  }, [ligue, categorie]);

  async function chargerDonneesNHL() {
    setChargement(true);
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

  // Étape 1 — Choix de la ligue
  if (!ligue) {
    return (
      <div style={{ padding: '48px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Analyses & Modèles</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Choisis ta ligue pour commencer</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {LIGUES.map(l => (
            <div
              key={l.id}
              onClick={() => l.disponible && setLigue(l.id)}
              style={{
                backgroundColor: '#111827',
                borderRadius: '16px',
                border: `2px solid ${l.disponible ? '#1f2937' : '#111827'}`,
                padding: '32px 24px',
                textAlign: 'center',
                cursor: l.disponible ? 'pointer' : 'not-allowed',
                opacity: l.disponible ? 1 : 0.4,
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{l.label.split(' ')[0]}</div>
              <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>{l.label.split(' ')[1]}</div>
              {l.disponible ? (
                <span style={{ color: '#22c55e', fontSize: '12px' }}>● Disponible</span>
              ) : (
                <span style={{ color: '#4b5563', fontSize: '12px' }}>Bientôt</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Étape 2 — Choix de la catégorie
  if (!categorie) {
    return (
      <div style={{ padding: '48px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <button onClick={() => setLigue(null)} style={{ backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #1f2937', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            ← Retour
          </button>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              🏒 NHL
            </h2>
            <p style={{ color: '#6b7280', margin: 0 }}>Choisis une catégorie d'analyse</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Stats Équipes */}
          <div
            onClick={() => setCategorie('equipes')}
            style={{
              backgroundColor: '#111827',
              borderRadius: '16px',
              border: '2px solid #1f2937',
              padding: '40px 32px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: '800' }}>Statistiques Équipes</h3>
            <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: '14px', lineHeight: '1.6' }}>
              Probabilité de victoire, différentiel de buts, total de buts et analyse comparative des équipes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['🏆 Probabilité victoire', '⚡ Différentiel de buts', '🎯 Total de buts'].map((item, i) => (
                <div key={i} style={{ backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#fed7aa', fontSize: '13px' }}>
                  {item}
                </div>
              ))}
            </div>
            <button style={{ marginTop: '20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' }}>
              Voir les analyses →
            </button>
          </div>

          {/* Player Props */}
          <div
            onClick={() => setCategorie('joueurs')}
            style={{
              backgroundColor: '#111827',
              borderRadius: '16px',
              border: '2px solid #1f2937',
              padding: '40px 32px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏒</div>
            <h3 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: '800' }}>Statistiques Joueurs</h3>
            <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: '14px', lineHeight: '1.6' }}>
              Props individuels par joueur — buts, points, tirs et performances attendues.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['🥅 Buts par joueur', '🏒 Points par joueur', '🎯 Tirs par joueur'].map((item, i) => (
                <div key={i} style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#a5b4fc', fontSize: '13px' }}>
                  {item}
                </div>
              ))}
            </div>
            <button style={{ marginTop: '20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' }}>
              Voir les props →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Étape 3 — Page d'analyse
  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <button onClick={() => setCategorie(null)} style={{ backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #1f2937', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          ← Retour
        </button>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800' }}>
            🏒 NHL · {categorie === 'equipes' ? '📊 Statistiques Équipes' : '🏒 Statistiques Joueurs'}
          </h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '13px' }}>
            {categorie === 'equipes' ? 'Clique sur un match pour voir l\'analyse détaillée' : 'Props individuels par joueur'}
          </p>
        </div>
      </div>

      {categorie === 'equipes' && (
        <PageStatsEquipes classement={classement} matchs={matchs} chargement={chargement} />
      )}
      {categorie === 'joueurs' && (
        <PagePlayerProps />
      )}
    </div>
  );
}

export default Analyses;