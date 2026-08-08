import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getUrl } from './nhlApi';
import { LOGOS_NHL, useIsMobile, useSaisonCourante, chargerProchaineSemaineAvecMatchs, formatSemaineDe } from './Analyses';
import { getModeles, filtrerMatchsPourModele, genererRecommandation } from './modelesData';

function CarteAccueil({ icone, titre, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: '#111', borderRadius: '16px', border: '2px solid #222', padding: '32px 20px', textAlign: 'center', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
    >
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icone}</div>
      <div style={{ fontWeight: '900', fontSize: '18px', color: 'white' }}>{titre}</div>
    </div>
  );
}

function BoutonBack({ onClick }) {
  return (
    <button onClick={onClick} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>Back</button>
  );
}

// Ecran 1 : accueil Modeles, choix Equipe / Joueur (meme pattern visuel que AnalysesFlux).
function AccueilModeles({ onSelect }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding, maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: isMobile ? '24px' : '30px', fontWeight: '900', textAlign: 'center', color: 'white' }}>Modèles</h2>
      <p style={{ margin: '0 0 24px', textAlign: 'center', color: '#666', fontSize: '13px' }}>Analyses automatisées basées sur des critères statistiques précis</p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
        <CarteAccueil icone="🏒" titre="Analyser une Équipe" onClick={() => onSelect('equipe')} />
        <CarteAccueil icone="🏃" titre="Analyser un Joueur" onClick={() => onSelect('joueur')} />
      </div>
    </div>
  );
}

// Ecran 2 : liste des modeles disponibles pour le type choisi, triee par ROI decroissant.
function ListeModeles({ type, onBack, onSelect }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const modeles = getModeles(type);

  return (
    <div style={{ padding, maxWidth: '900px', margin: '0 auto' }}>
      <BoutonBack onClick={onBack} />
      <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>
        {type === 'equipe' ? 'Modèles Équipe' : 'Modèles Joueur'}
      </h2>
      <p style={{ margin: '0 0 18px', color: '#666', fontSize: '12px' }}>{modeles.length} modèles disponibles · triés par ROI</p>
      <div>
        {modeles.map(m => {
          const positif = m.roi >= 0;
          return (
            <div
              key={m.id}
              onClick={() => onSelect(m)}
              style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{m.nom}</div>
                <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '20px', fontWeight: '900', color: positif ? '#f97316' : '#ef4444' }}>{positif ? '+' : ''}{m.roi.toFixed(1)}%</div>
                <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.3px' }}>ROI SAISON</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ecran 3 : detail d'un modele - ROI + graphique, explication, selecteur de matchs eligibles, recommandation.
function DetailModele({ modele, onBack }) {
  const isMobile = useIsMobile();
  const seasonId = useSaisonCourante();
  const padding = isMobile ? '16px' : '32px';

  const [chargement, setChargement] = useState(true);
  const [semaineDate, setSemaineDate] = useState(null);
  const [matchsSemaine, setMatchsSemaine] = useState([]);
  const [matchsEligibles, setMatchsEligibles] = useState([]);
  const [matchSelectionneId, setMatchSelectionneId] = useState('');
  const [joueurRecommande, setJoueurRecommande] = useState(null);
  const [chargementJoueur, setChargementJoueur] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    chargerProchaineSemaineAvecMatchs().then(matchsParJour => {
      if (annule) return;
      const jours = Object.keys(matchsParJour).sort();
      const matchs = jours.flatMap(j => matchsParJour[j]);
      setSemaineDate(jours[0] || null);
      setMatchsSemaine(matchs);
      const eligibles = filtrerMatchsPourModele(modele, matchs);
      setMatchsEligibles(eligibles);
      setMatchSelectionneId(eligibles[0]?.id ? String(eligibles[0].id) : '');
      setChargement(false);
    });
    return () => { annule = true; };
  }, [modele.id]);

  const matchSelectionne = matchsEligibles.find(m => String(m.id) === matchSelectionneId) || null;
  const recommandation = matchSelectionne ? genererRecommandation(modele, matchSelectionne) : null;

  // Pour un modele "joueur", on resout un joueur concret a partir du roster reel de l'equipe ciblee
  // (le choix precis du joueur reste mocke, en attendant le vrai modele).
  useEffect(() => {
    if (!matchSelectionne || modele.type !== 'joueur' || !recommandation) { setJoueurRecommande(null); return; }
    let annule = false;
    setChargementJoueur(true);
    fetch(getUrl(`roster/${recommandation.equipeCibleAbbrev}/${seasonId}`))
      .then(r => r.json())
      .then(data => {
        if (annule) return;
        const attaquants = data.forwards || [];
        if (attaquants.length === 0) { setJoueurRecommande(null); return; }
        const choisi = attaquants[recommandation.graine % attaquants.length];
        setJoueurRecommande({
          nom: `${choisi.firstName?.default || ''} ${choisi.lastName?.default || ''}`.trim(),
          numero: choisi.sweaterNumber,
          equipe: recommandation.equipeCibleAbbrev,
        });
      })
      .catch(() => { if (!annule) setJoueurRecommande(null); })
      .finally(() => { if (!annule) setChargementJoueur(false); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchSelectionneId, modele.id, seasonId]);

  const positif = modele.roi >= 0;

  return (
    <div style={{ padding, maxWidth: '900px', margin: '0 auto' }}>
      <BoutonBack onClick={onBack} />

      {/* En-tete : nom, ROI, graphique */}
      <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: isMobile ? '14px' : '20px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: 'white' }}>{modele.nom}</div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{modele.type === 'equipe' ? 'Modèle Équipe' : 'Modèle Joueur'}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '24px', fontWeight: '900', color: positif ? '#f97316' : '#ef4444' }}>{positif ? '+' : ''}{modele.roi.toFixed(1)}%</div>
            <div style={{ fontSize: '9px', color: '#555' }}>ROI CUMULATIF</div>
          </div>
        </div>
        <div style={{ width: '100%', height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={modele.historique} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="semaine" tick={{ fill: '#555', fontSize: 10 }} axisLine={{ stroke: '#222' }} tickLine={false} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: '#888' }}
                formatter={v => [`${v}%`, 'ROI']}
              />
              <Line type="monotone" dataKey="roi" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Explication */}
      <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: isMobile ? '14px' : '20px', marginBottom: '14px' }}>
        <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>PRINCIPE DU MODÈLE</div>
        <p style={{ margin: 0, color: '#ccc', fontSize: '13px', lineHeight: '1.6' }}>{modele.explication}</p>
      </div>

      {/* Selecteur de matchs eligibles */}
      <div style={{ backgroundColor: '#111', borderRadius: '14px', border: '1px solid #222', padding: isMobile ? '14px' : '20px', marginBottom: '14px' }}>
        <div style={{ color: '#555', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '10px' }}>MATCHS ÉLIGIBLES</div>
        {chargement ? (
          <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Recherche des matchs éligibles...</p>
        ) : matchsSemaine.length === 0 ? (
          <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Aucun match à venir pour le moment</p>
        ) : (
          <>
            <div style={{ color: '#666', fontSize: '12px', fontWeight: '600', marginBottom: '10px' }}>{formatSemaineDe(semaineDate)}</div>
            {matchsEligibles.length === 0 ? (
              <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Aucun match ne correspond aux critères de ce modèle pour l'instant.</p>
            ) : (
              <select
                value={matchSelectionneId}
                onChange={e => setMatchSelectionneId(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
              >
                {matchsEligibles.map(m => {
                  const date = m.startTimeUTC ? new Date(m.startTimeUTC) : null;
                  const label = date ? `${date.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}` : '';
                  return (
                    <option key={m.id} value={m.id}>
                      {m.awayTeam?.abbrev} @ {m.homeTeam?.abbrev} · {label}
                    </option>
                  );
                })}
              </select>
            )}
          </>
        )}
      </div>

      {/* Recommandation */}
      {matchSelectionne && recommandation && (
        <div style={{ backgroundColor: 'rgba(249,115,22,0.06)', borderRadius: '14px', border: '1px solid rgba(249,115,22,0.35)', padding: isMobile ? '14px' : '20px' }}>
          <div style={{ color: '#f97316', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px' }}>RECOMMANDATION DU MODÈLE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            {modele.type === 'equipe' ? (
              <>
                <img src={LOGOS_NHL[recommandation.abbrev]} alt={recommandation.abbrev} style={{ width: '44px', height: '44px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{recommandation.nom}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{recommandation.domicile ? 'À domicile' : 'À l\'étranger'} · {matchSelectionne.awayTeam?.abbrev} @ {matchSelectionne.homeTeam?.abbrev}</div>
                </div>
              </>
            ) : (
              <>
                <img src={LOGOS_NHL[recommandation.equipeCibleAbbrev]} alt={recommandation.equipeCibleAbbrev} style={{ width: '44px', height: '44px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>
                    {chargementJoueur ? 'Chargement...' : (joueurRecommande?.nom || 'Joueur indisponible')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {joueurRecommande?.numero ? `#${joueurRecommande.numero} · ` : ''}{recommandation.equipeCibleAbbrev} · {matchSelectionne.awayTeam?.abbrev} @ {matchSelectionne.homeTeam?.abbrev}
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '8px', borderRadius: '4px', backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
              <div style={{ width: `${recommandation.confiance}%`, height: '100%', backgroundColor: '#f97316' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#f97316', flexShrink: 0 }}>{recommandation.confiance}%</div>
          </div>
          <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>CONFIANCE DU MODÈLE</div>
        </div>
      )}
    </div>
  );
}

// Flux complet de l'onglet Modeles : accueil -> liste -> detail, avec bouton Back a chaque etape
// (meme pattern de navigation interne que AnalysesFlux).
function ModelesFlux() {
  const [type, setType] = useState(null); // null | 'equipe' | 'joueur'
  const [modeleSelectionne, setModeleSelectionne] = useState(null);

  if (modeleSelectionne) {
    return <DetailModele modele={modeleSelectionne} onBack={() => setModeleSelectionne(null)} />;
  }
  if (type) {
    return <ListeModeles type={type} onBack={() => setType(null)} onSelect={setModeleSelectionne} />;
  }
  return <AccueilModeles onSelect={setType} />;
}

export default ModelesFlux;
