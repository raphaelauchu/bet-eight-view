import React, { useState, useEffect, useMemo } from 'react';
import { getUrl } from './nhlApi';
import { LOGOS_NHL, useIsMobile, useSaisonCourante } from './Analyses';

const POSITIONS = ['F', 'D', 'G'];
const POS_LABELS = { F: 'Attaquants', D: 'Défenseurs', G: 'Gardiens' };
const POS_COLORS = { F: '#f97316', D: '#3b82f6', G: '#22c55e' };

function mapPosition(posNhl) {
  if (posNhl === 'G') return 'G';
  if (posNhl === 'D') return 'D';
  return 'F';
}

function Stepper({ etape }) {
  const isMobile = useIsMobile();
  const steps = [
    { n: 1, label: 'Règles du pool' },
    { n: 2, label: 'Draft assisté' },
    { n: 3, label: 'Résumé roster' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: isMobile ? '16px 16px 0' : '24px 32px 0', maxWidth: '900px', margin: '0 auto' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? '1' : 'none' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: etape >= s.n ? '#f97316' : '#1a1a1a',
              color: etape >= s.n ? 'white' : '#555',
              fontSize: '12px', fontWeight: '800',
              border: etape === s.n ? '2px solid rgba(249,115,22,0.4)' : 'none',
            }}>{s.n}</div>
            {!isMobile && (
              <span style={{ fontSize: '13px', fontWeight: etape === s.n ? '700' : '500', color: etape >= s.n ? 'white' : '#555' }}>{s.label}</span>
            )}
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: '2px', backgroundColor: etape > s.n ? '#f97316' : '#1a1a1a', margin: '0 8px', minWidth: '16px' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const DEFAULT_REGLES = {
  nomPool: '',
  nbEquipes: 10,
  slotsF: 9,
  slotsD: 4,
  slotsG: 2,
  slotsUtil: 1,
  typeScoring: 'points',
  typeDraft: 'snake',
};

// Etape 1 : configuration des regles du pool (format roster, scoring, type de draft).
function EtapeRegles({ regles, setRegles, onSuivant }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const totalSlots = regles.slotsF + regles.slotsD + regles.slotsG + regles.slotsUtil;

  const champ = (label, key, min, max) => (
    <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '14px 16px', border: '1px solid #222' }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: '600' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => setRegles(r => ({ ...r, [key]: Math.max(min, r[key] - 1) }))}
          style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: '700' }}>−</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{regles[key]}</div>
        <button onClick={() => setRegles(r => ({ ...r, [key]: Math.min(max, r[key] + 1) }))}
          style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: '700' }}>+</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding, maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>Règles du pool</h2>
      <p style={{ margin: '0 0 20px', color: '#666', fontSize: '13px' }}>Configure le format de ton pool avant de commencer le draft assisté.</p>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Informations générales</div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '600' }}>Nom du pool</div>
          <input
            value={regles.nomPool}
            onChange={e => setRegles(r => ({ ...r, nomPool: e.target.value }))}
            placeholder="Ex. Pool des Chums 2026"
            style={{ width: '100%', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
          {champ('Nombre d\'équipes', 'nbEquipes', 2, 20)}
        </div>
      </div>

      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Format du roster</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px' }}>
          {champ('Attaquants (F)', 'slotsF', 0, 20)}
          {champ('Défenseurs (D)', 'slotsD', 0, 12)}
          {champ('Gardiens (G)', 'slotsG', 0, 6)}
          {champ('Utilitaire / réserve', 'slotsUtil', 0, 10)}
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#555' }}>Total : <strong style={{ color: 'white' }}>{totalSlots}</strong> joueurs par équipe</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Type de scoring</div>
          {[['points', 'Points (standard)'], ['categories', 'Catégories']].map(([val, label]) => (
            <button key={val} onClick={() => setRegles(r => ({ ...r, typeScoring: val }))}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', border: regles.typeScoring === val ? '1px solid #f97316' : '1px solid #222', backgroundColor: regles.typeScoring === val ? 'rgba(249,115,22,0.08)' : '#111', color: regles.typeScoring === val ? 'white' : '#888', fontSize: '13px', fontWeight: regles.typeScoring === val ? '700' : '500' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Type de draft</div>
          {[['snake', 'Snake draft'], ['auction', 'Enchères (auction)']].map(([val, label]) => (
            <button key={val} onClick={() => setRegles(r => ({ ...r, typeDraft: val }))}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', border: regles.typeDraft === val ? '1px solid #f97316' : '1px solid #222', backgroundColor: regles.typeDraft === val ? 'rgba(249,115,22,0.08)' : '#111', color: regles.typeDraft === val ? 'white' : '#888', fontSize: '13px', fontWeight: regles.typeDraft === val ? '700' : '500' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onSuivant}
        disabled={totalSlots === 0}
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: totalSlots === 0 ? 'not-allowed' : 'pointer', background: totalSlots === 0 ? '#222' : 'linear-gradient(135deg, #f97316, #ea580c)', color: totalSlots === 0 ? '#555' : 'white', fontSize: '15px', fontWeight: '700' }}>
        Commencer le draft assisté →
      </button>
    </div>
  );
}

// Etape 2 : draft assiste - liste des joueurs NHL, recherche/filtre par position, ajout au roster.
function EtapeDraft({ regles, roster, setRoster, onSuivant, onRetour }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const seasonId = useSaisonCourante();

  const [joueurs, setJoueurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [filtrePos, setFiltrePos] = useState('ALL');

  useEffect(() => {
    let annule = false;
    async function chargerJoueurs() {
      setChargement(true);
      const abbrevs = Object.keys(LOGOS_NHL);
      const tous = [];
      for (let i = 0; i < abbrevs.length; i += 6) {
        const batch = abbrevs.slice(i, i + 6);
        const resultats = await Promise.all(batch.map(async (abbrev) => {
          try {
            const res = await fetch(getUrl(`roster/${abbrev}/${seasonId}`));
            const data = await res.json();
            const tous2 = [
              ...(data.forwards || []).map(j => ({ ...j, equipe: abbrev, positionGroupe: 'F' })),
              ...(data.defensemen || []).map(j => ({ ...j, equipe: abbrev, positionGroupe: 'D' })),
              ...(data.goalies || []).map(j => ({ ...j, equipe: abbrev, positionGroupe: 'G' })),
            ];
            return tous2.map(j => ({
              id: j.id,
              nom: ((j.firstName?.default || '') + ' ' + (j.lastName?.default || '')).trim(),
              equipe: j.equipe,
              position: mapPosition(j.positionCode) || j.positionGroupe,
              numero: j.sweaterNumber || '-',
              photo: `https://assets.nhle.com/mugs/nhl/${seasonId}/${abbrev}/${j.id}.png`,
            }));
          } catch { return []; }
        }));
        resultats.forEach(arr => tous.push(...arr));
      }
      if (!annule) {
        tous.sort((a, b) => a.nom.localeCompare(b.nom));
        setJoueurs(tous);
        setChargement(false);
      }
    }
    chargerJoueurs();
    return () => { annule = true; };
  }, [seasonId]);

  const draftedIds = useMemo(() => new Set(roster.map(j => j.id)), [roster]);

  const besoinsParPosition = useMemo(() => {
    const compte = { F: 0, D: 0, G: 0 };
    roster.forEach(j => { compte[j.position] = (compte[j.position] || 0) + 1; });
    return {
      F: { pris: compte.F, total: regles.slotsF },
      D: { pris: compte.D, total: regles.slotsD },
      G: { pris: compte.G, total: regles.slotsG },
    };
  }, [roster, regles]);

  const totalSlots = regles.slotsF + regles.slotsD + regles.slotsG + regles.slotsUtil;
  const rosterPlein = roster.length >= totalSlots;

  // Position la plus prioritaire = celle dont le ratio pris/total est le plus faible (encore des trous a combler).
  const positionPrioritaire = useMemo(() => {
    let pire = null;
    let pireRatio = 2;
    POSITIONS.forEach(p => {
      const b = besoinsParPosition[p];
      if (b.total === 0) return;
      const ratio = b.pris / b.total;
      if (ratio < 1 && ratio < pireRatio) { pireRatio = ratio; pire = p; }
    });
    return pire;
  }, [besoinsParPosition]);

  const suggestions = useMemo(() => {
    if (!positionPrioritaire) return [];
    return joueurs.filter(j => j.position === positionPrioritaire && !draftedIds.has(j.id)).slice(0, 5);
  }, [joueurs, positionPrioritaire, draftedIds]);

  const joueursFiltres = joueurs.filter(j => {
    const posOk = filtrePos === 'ALL' || j.position === filtrePos;
    const rechOk = !recherche || j.nom.toLowerCase().includes(recherche.toLowerCase()) || j.equipe.toLowerCase().includes(recherche.toLowerCase());
    return posOk && rechOk;
  });

  function drafterJoueur(joueur) {
    if (draftedIds.has(joueur.id) || rosterPlein) return;
    setRoster(r => [...r, { ...joueur, pick: r.length + 1 }]);
  }

  function retirerJoueur(id) {
    setRoster(r => r.filter(j => j.id !== id).map((j, i) => ({ ...j, pick: i + 1 })));
  }

  return (
    <div style={{ padding, maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={onRetour} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>← Règles</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>Draft assisté</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>{regles.nomPool || 'Mon pool'} · {roster.length}/{totalSlots} joueurs sélectionnés</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {POSITIONS.map(p => (
            <div key={p} style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: POS_COLORS[p], fontWeight: '700', letterSpacing: '0.5px' }}>{p}</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>{besoinsParPosition[p].pris}/{besoinsParPosition[p].total}</div>
            </div>
          ))}
        </div>
      </div>

      {suggestions.length > 0 && !chargement && (
        <div style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Suggestions · besoin prioritaire : {POS_LABELS[positionPrioritaire]}
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {suggestions.map(j => (
              <button key={j.id} onClick={() => drafterJoueur(j)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', whiteSpace: 'nowrap' }}>{j.nom}</span>
                <span style={{ fontSize: '11px', color: '#666' }}>{j.equipe}</span>
                <span style={{ color: '#f97316', fontSize: '14px', fontWeight: '900' }}>+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un joueur ou une équipe..."
          style={{ flex: 1, minWidth: '200px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '13px', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', ...POSITIONS].map(p => (
            <button key={p} onClick={() => setFiltrePos(p)} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: filtrePos === p ? (POS_COLORS[p] || '#f97316') : '#111', color: filtrePos === p ? 'white' : '#555', fontSize: '12px', fontWeight: '700' }}>{p === 'ALL' ? 'Tous' : p}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '16px' }}>
        <div style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
          {chargement ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #1a1a1a', borderTop: '3px solid #f97316', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
              <p style={{ color: '#444', fontSize: '13px', margin: 0 }}>Chargement des rosters NHL...</p>
            </div>
          ) : joueursFiltres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '13px' }}>Aucun joueur trouvé</div>
          ) : joueursFiltres.map(j => {
            const drafte = draftedIds.has(j.id);
            return (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '12px', padding: '10px 12px', marginBottom: '6px', opacity: drafte ? 0.4 : 1 }}>
                <img src={j.photo} alt={j.nom} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#1a1a1a' }} onError={e => { e.target.style.visibility = 'hidden'; }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nom}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>{j.equipe} · #{j.numero}</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: POS_COLORS[j.position], backgroundColor: '#111', borderRadius: '6px', padding: '3px 8px' }}>{j.position}</span>
                <button
                  onClick={() => drafte ? retirerJoueur(j.id) : drafterJoueur(j)}
                  disabled={!drafte && rosterPlein}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: (!drafte && rosterPlein) ? 'not-allowed' : 'pointer', backgroundColor: drafte ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.12)', color: drafte ? '#ef4444' : '#f97316', fontSize: '11px', fontWeight: '700' }}>
                  {drafte ? 'Retirer' : 'Draft'}
                </button>
              </div>
            );
          })}
        </div>

        <div>
          <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '14px', padding: '14px', position: isMobile ? 'static' : 'sticky', top: '16px' }}>
            <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Mon roster · {roster.length}/{totalSlots}</div>
            {roster.length === 0 ? (
              <div style={{ color: '#333', fontSize: '12px', padding: '10px 0' }}>Aucun joueur sélectionné pour l'instant.</div>
            ) : (
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {roster.map(j => (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid #161616' }}>
                    <span style={{ fontSize: '10px', color: '#444', minWidth: '16px' }}>{j.pick}</span>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: POS_COLORS[j.position] }}>{j.position}</span>
                    <span style={{ flex: 1, fontSize: '12px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nom}</span>
                    <button onClick={() => retirerJoueur(j.id)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onSuivant}
              disabled={roster.length === 0}
              style={{ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '10px', border: 'none', cursor: roster.length === 0 ? 'not-allowed' : 'pointer', background: roster.length === 0 ? '#222' : 'linear-gradient(135deg, #f97316, #ea580c)', color: roster.length === 0 ? '#555' : 'white', fontSize: '13px', fontWeight: '700' }}>
              {rosterPlein ? 'Terminer le draft →' : 'Voir le résumé →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Etape 3 : resume final du roster, groupe par position.
function EtapeResume({ regles, roster, onRetour, onRecommencer }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const totalSlots = regles.slotsF + regles.slotsD + regles.slotsG + regles.slotsUtil;

  return (
    <div style={{ padding, maxWidth: '900px', margin: '0 auto' }}>
      <button onClick={onRetour} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>← Draft</button>

      <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>Résumé du roster</h2>
      <p style={{ margin: '0 0 20px', color: '#666', fontSize: '13px' }}>{regles.nomPool || 'Mon pool'} · {regles.nbEquipes} équipes · scoring {regles.typeScoring === 'points' ? 'points' : 'catégories'} · draft {regles.typeDraft === 'snake' ? 'snake' : 'enchères'}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[['Joueurs draftés', `${roster.length}/${totalSlots}`], ['Attaquants', roster.filter(j => j.position === 'F').length + '/' + regles.slotsF], ['Défense + Gardiens', (roster.filter(j => j.position === 'D').length + roster.filter(j => j.position === 'G').length) + '/' + (regles.slotsD + regles.slotsG)]].map(([label, val], i) => (
          <div key={i} style={{ backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{val}</div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
          </div>
        ))}
      </div>

      {POSITIONS.map(pos => {
        const joueursPos = roster.filter(j => j.position === pos).sort((a, b) => a.pick - b.pick);
        if (joueursPos.length === 0) return null;
        return (
          <div key={pos} style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: POS_COLORS[pos], fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>{POS_LABELS[pos]} · {joueursPos.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {joueursPos.map(j => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', borderRadius: '8px', padding: '8px 12px' }}>
                  <img src={j.photo} alt={j.nom} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#1a1a1a' }} onError={e => { e.target.style.visibility = 'hidden'; }} />
                  <span style={{ fontSize: '10px', color: '#444', minWidth: '18px' }}>#{j.pick}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: 'white' }}>{j.nom}</span>
                  <span style={{ fontSize: '11px', color: '#555' }}>{j.equipe}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {roster.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '13px' }}>Aucun joueur n'a encore été drafté.</div>
      )}

      <button onClick={onRecommencer} style={{ width: '100%', marginTop: '10px', padding: '14px', borderRadius: '12px', border: '1px solid #222', cursor: 'pointer', backgroundColor: '#111', color: '#888', fontSize: '13px', fontWeight: '700' }}>
        ↺ Recommencer un nouveau pool
      </button>
    </div>
  );
}

// Composant principal : Assistant Draft Pool, configuration en 3 etapes.
export default function PoolDraft() {
  const [etape, setEtape] = useState(1);
  const [regles, setRegles] = useState(DEFAULT_REGLES);
  const [roster, setRoster] = useState([]);

  function recommencer() {
    setRegles(DEFAULT_REGLES);
    setRoster([]);
    setEtape(1);
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <Stepper etape={etape} />
      {etape === 1 && (
        <EtapeRegles regles={regles} setRegles={setRegles} onSuivant={() => setEtape(2)} />
      )}
      {etape === 2 && (
        <EtapeDraft regles={regles} roster={roster} setRoster={setRoster} onSuivant={() => setEtape(3)} onRetour={() => setEtape(1)} />
      )}
      {etape === 3 && (
        <EtapeResume regles={regles} roster={roster} onRetour={() => setEtape(2)} onRecommencer={recommencer} />
      )}
    </div>
  );
}
