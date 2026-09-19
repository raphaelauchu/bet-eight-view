import React, { useState, useEffect, useMemo } from 'react';
import { useIsMobile, useSaisonCourante, LOGOS_NHL } from './Analyses';

const POS_ORDER = ['F', 'D', 'G'];
const POS_LABELS = { F: 'Attaquants', D: 'Défenseurs', G: 'Gardiens' };
const POS_COLORS = { F: '#f97316', D: '#3b82f6', G: '#22c55e' };

// Position groupee (F/D/G) utilisee pour la composition du roster et le systeme de points.
function mapPositionCode(code) {
  return code === 'D' ? 'D' : 'F';
}

// Position reelle (C/LW/RW/D/G) utilisee pour les filtres detailles a l'etape draft.
const POS_REEL_ORDER = ['C', 'LW', 'RW', 'D', 'G'];
const POS_REEL_LABELS = { C: 'Centre', LW: 'Ailier gauche', RW: 'Ailier droit', D: 'Défenseur', G: 'Gardien' };
const POS_REEL_COLORS = { C: '#f97316', LW: '#fb923c', RW: '#eab308', D: '#3b82f6', G: '#22c55e' };

function mapPosReel(code) {
  if (code === 'L') return 'LW';
  if (code === 'R') return 'RW';
  if (code === 'D') return 'D';
  return 'C';
}

// Comparaison tolerante avec le champ brut positionCode retourne par l'API NHL
// (skater/summary : 'C'|'L'|'R'|'D' ; goalie/summary : pas de positionCode, on force 'G').
function joueurCorrespondFiltre(positionCode, filtre) {
  if (filtre === 'ALL') return true;
  if (filtre === 'C') return positionCode === 'C';
  if (filtre === 'LW') return positionCode === 'L' || positionCode === 'LW';
  if (filtre === 'RW') return positionCode === 'R' || positionCode === 'RW';
  if (filtre === 'D') return positionCode === 'D';
  if (filtre === 'G') return positionCode === 'G';
  return false;
}

// En prod on passe par le proxy /api/nhl (qui accepte une URL complete), en dev on fetch directement.
function getStatsUrl(fullUrl) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  return estEnProduction ? `/api/nhl?path=${encodeURIComponent(fullUrl)}` : fullUrl;
}

function clonePoints(p) { return JSON.parse(JSON.stringify(p)); }

const POINTS_DEFAUT = {
  F: { but: 0, passe: 0, ppb: 0, ppp: 0, tirs: 0, plusMinus: 0 },
  D: { but: 0, passe: 0, ppb: 0, ppp: 0, tirs: 0, plusMinus: 0 },
  G: { victoire: 0, blanchissage: 0, but: 0, arrets: 0 },
  equipe: { victoire: 0, defaiteOT: 0, blanchissageEquipe: 0, butsEquipe: 0 },
};

const EQUIPE_COLOR = '#a78bfa';

const POOL_TYPES = [
  { id: 'classique', label: 'Draft classique', desc: 'Tour par tour. Chaque joueur choisi devient exclusif à une équipe.', exclusif: true, tourParTour: true, salaryCap: false, roster: { F: 6, D: 4, G: 2, bench: 3 } },
  { id: 'box', label: 'Box Pool', desc: 'Boîtes de joueurs, choix multiples permis : plusieurs participants peuvent avoir le même joueur.', exclusif: false, tourParTour: false, salaryCap: false, roster: { F: 6, D: 4, G: 2, bench: 2 } },
  { id: 'grand', label: 'Grand Pool', desc: 'Choix libre par rondes, rosters plus généreux, tour par tour.', exclusif: true, tourParTour: true, salaryCap: false, roster: { F: 9, D: 5, G: 3, bench: 5 } },
  { id: 'keeper', label: 'Keeper', desc: 'Conservation de joueurs pour la saison suivante. Tour par tour comme un draft classique.', exclusif: true, tourParTour: true, salaryCap: false, keeper: true, roster: { F: 6, D: 4, G: 2, bench: 3 } },
  { id: 'h2h', label: 'Head-to-Head', desc: 'Affrontements hebdomadaires entre participants pendant la saison. Tour par tour.', exclusif: true, tourParTour: true, salaryCap: false, roster: { F: 6, D: 4, G: 2, bench: 3 } },
  { id: 'salarycap', label: 'Salary Cap', desc: 'Plafond salarial basé sur les vrais contrats NHL. Salaires à entrer manuellement (aucune source de salaires n\'est légalement redistribuable via API). Tour par tour.', exclusif: true, tourParTour: true, salaryCap: true, plafond: 0, roster: { F: 6, D: 4, G: 2, bench: 3 } },
];

function getTypeInfo(id) { return POOL_TYPES.find(t => t.id === id) || POOL_TYPES[0]; }

// Projection de points selon le systeme de points du pool :
// Patineurs : (buts x But) + (passes x Passe) + (PPB x PPB) + (PPP x PPP) + (+/- x +/-) + (tirs x Tirs)
// Gardiens  : (victoires x Victoire) + (blanchissages x Blanchissage) + (arrets x Arrets)
function calculerValeurIA(j, points) {
  if (j.posGroupe === 'G') {
    const p = points.G;
    return Math.round((j.wins * p.victoire + j.shutouts * p.blanchissage + j.saves * p.arrets) * 10) / 10;
  }
  const p = j.posGroupe === 'D' ? points.D : points.F;
  return Math.round((j.goals * p.but + j.assists * p.passe + j.ppGoals * p.ppb + j.ppPoints * p.ppp + j.plusMinus * p.plusMinus + j.shots * p.tirs) * 10) / 10;
}

const DEFAULT_CONFIG = {
  nomPool: '',
  typePool: 'classique',
  participants: [
    { id: 1, nom: 'Moi', estMoi: true, equipe: '' },
    { id: 2, nom: 'Participant 2', estMoi: false, equipe: '' },
  ],
  roster: { F: 6, D: 4, G: 2, bench: 3 },
  points: clonePoints(POINTS_DEFAUT),
  salaryCapActif: false,
  plafond: 0,
  ordreType: 'snake',
};

function totalRosterSlots(roster) {
  return (roster.F || 0) + (roster.D || 0) + (roster.G || 0) + (roster.bench || 0);
}

const ORDRE_TYPES = [
  { id: 'lineaire', label: 'Linéaire', desc: 'Même ordre à chaque ronde (1,2,3,4 / 1,2,3,4 / ...)' },
  { id: 'snake', label: 'Snake', desc: 'Ordre inversé à chaque ronde (1,2,3,4 / 4,3,2,1 / 1,2,3,4 / ...)' },
];

// Ordre de pick complet pour tout le draft, selon le type (lineaire ou snake) et l'ordre des participants.
function calculerOrdreDraft(participants, totalRondes, ordreType) {
  const o = [];
  for (let r = 0; r < totalRondes; r++) {
    const inverser = ordreType === 'snake' && r % 2 === 1;
    o.push(...(inverser ? [...participants].reverse() : participants));
  }
  return o;
}

function Stepper({ etape }) {
  const isMobile = useIsMobile();
  const steps = [
    { n: 1, label: 'Configuration du pool' },
    { n: 2, label: 'Draft assisté' },
    { n: 3, label: 'Résumé' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: isMobile ? '16px 16px 0' : '24px 32px 0', maxWidth: '1100px', margin: '0 auto' }}>
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

function ChampNombre({ label, value, onChange, min = 0, max = 20 }) {
  return (
    <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '12px 14px', border: '1px solid #222' }}>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: '600' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>−</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '16px', fontWeight: '900', color: '#f97316' }}>{value}</div>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>+</button>
      </div>
    </div>
  );
}

function ChampPoint({ label, value, onChange }) {
  return (
    <div style={{ backgroundColor: '#111', borderRadius: '10px', padding: '8px 10px', border: '1px solid #222' }}>
      <div style={{ fontSize: '10px', color: '#777', marginBottom: '6px', fontWeight: '600' }}>{label}</div>
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: '100%', backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '8px', padding: '6px 8px', color: '#f97316', fontSize: '14px', fontWeight: '800', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ===================== ETAPE 1 : CONFIGURATION DU POOL =====================
function EtapeConfig({ config, setConfig, onSuivant }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const typeInfo = getTypeInfo(config.typePool);
  const totalSlots = totalRosterSlots(config.roster);
  const [dragIndex, setDragIndex] = useState(null);

  function reordonnerParticipants(depuis, vers) {
    if (depuis === null || depuis === vers) return;
    setConfig(c => {
      const liste = [...c.participants];
      const [retire] = liste.splice(depuis, 1);
      liste.splice(vers, 0, retire);
      return { ...c, participants: liste };
    });
  }

  function appliquerType(typeId) {
    const t = getTypeInfo(typeId);
    setConfig(c => ({
      ...c,
      typePool: typeId,
      roster: { ...t.roster },
      salaryCapActif: t.salaryCap,
      plafond: t.salaryCap ? (t.plafond ?? c.plafond ?? 0) : c.plafond,
    }));
  }

  function setNbParticipants(n) {
    setConfig(c => {
      let participants = [...c.participants];
      if (n > participants.length) {
        for (let i = participants.length; i < n; i++) {
          participants.push({ id: Date.now() + i, nom: `Participant ${i + 1}`, estMoi: false, equipe: '' });
        }
      } else if (n < participants.length) {
        const retires = participants.slice(n);
        participants = participants.slice(0, n);
        if (retires.some(p => p.estMoi) && !participants.some(p => p.estMoi)) participants[0].estMoi = true;
      }
      return { ...c, participants };
    });
  }

  function renommer(id, nom) {
    setConfig(c => ({ ...c, participants: c.participants.map(p => p.id === id ? { ...p, nom } : p) }));
  }

  function definirMoi(id) {
    setConfig(c => ({ ...c, participants: c.participants.map(p => ({ ...p, estMoi: p.id === id })) }));
  }

  function setPoints(groupe, cle, val) {
    setConfig(c => ({ ...c, points: { ...c.points, [groupe]: { ...c.points[groupe], [cle]: val } } }));
  }

  function setRoster(cle, val) {
    setConfig(c => ({ ...c, roster: { ...c.roster, [cle]: val } }));
  }

  const rosterFields = [['F', 'Attaquants'], ['D', 'Défenseurs'], ['G', 'Gardiens'], ['bench', 'Remplaçants']];

  const labelsF = { but: 'But', passe: 'Passe', ppb: 'PPB', ppp: 'PPP', tirs: 'Tirs', plusMinus: '+/-' };
  const labelsD = { but: 'But', passe: 'Passe', ppb: 'PPB', ppp: 'PPP', tirs: 'Tirs', plusMinus: '+/-' };
  const labelsG = { victoire: 'Victoire', blanchissage: 'Blanchissage', but: 'But', arrets: 'Arrêts' };
  const labelsEquipe = { victoire: 'Victoire', defaiteOT: 'Défaite en prolongation', blanchissageEquipe: 'Blanchissage équipe', butsEquipe: 'Buts équipe' };

  return (
    <div style={{ padding, maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>Configuration du pool</h2>
      <p style={{ margin: '0 0 20px', color: '#666', fontSize: '13px' }}>Configure les règles de ton pool de hockey avant de commencer le draft assisté.</p>

      {/* Infos generales */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Nom du pool</div>
        <input
          value={config.nomPool}
          onChange={e => setConfig(c => ({ ...c, nomPool: e.target.value }))}
          placeholder="Ex. Pool des Chums 2026-27"
          style={{ width: '100%', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      {/* Participants */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Participants</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setNbParticipants(Math.max(2, config.participants.length - 1))}
              style={{ width: '26px', height: '26px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>−</button>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#f97316', minWidth: '18px', textAlign: 'center' }}>{config.participants.length}</span>
            <button onClick={() => setNbParticipants(Math.min(20, config.participants.length + 1))}
              style={{ width: '26px', height: '26px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>+</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
          {config.participants.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '8px 10px' }}>
              <button onClick={() => definirMoi(p.id)} title="C'est moi"
                style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: p.estMoi ? '#f97316' : '#1a1a1a', color: 'white', fontSize: '13px' }}>
                {p.estMoi ? '★' : '☆'}
              </button>
              <input
                value={p.nom}
                onChange={e => renommer(p.id, e.target.value)}
                style={{ flex: 1, minWidth: 0, backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '13px', fontWeight: p.estMoi ? '700' : '500', outline: 'none' }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', fontSize: '11px', color: '#555' }}>★ = c'est toi dans le pool (utilisé pour les suggestions IA à l'étape suivante) · l'équipe NHL favorite de chacun se choisit pendant le draft</div>
      </div>

      {/* Type de pool */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Type de pool</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px' }}>
          {POOL_TYPES.map(t => (
            <button key={t.id} onClick={() => appliquerType(t.id)}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', border: config.typePool === t.id ? '1px solid #f97316' : '1px solid #222', backgroundColor: config.typePool === t.id ? 'rgba(249,115,22,0.08)' : '#111' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: config.typePool === t.id ? 'white' : '#ccc', marginBottom: '4px' }}>{t.label}</div>
              <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.5' }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Systeme de points */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Système de points personnalisable</div>
        <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#555' }}>Ajusté selon le type de pool sélectionné · sert aussi à calculer le score de valeur IA à l'étape 2</p>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: POS_COLORS.F, marginBottom: '8px' }}>Attaquants</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: '8px' }}>
            {Object.keys(labelsF).map(k => (
              <ChampPoint key={k} label={labelsF[k]} value={config.points.F[k]} onChange={v => setPoints('F', k, v)} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: POS_COLORS.D, marginBottom: '8px' }}>Défenseurs</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: '8px' }}>
            {Object.keys(labelsD).map(k => (
              <ChampPoint key={k} label={labelsD[k]} value={config.points.D[k]} onChange={v => setPoints('D', k, v)} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: POS_COLORS.G, marginBottom: '8px' }}>Gardiens</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
            {Object.keys(labelsG).map(k => (
              <ChampPoint key={k} label={labelsG[k]} value={config.points.G[k]} onChange={v => setPoints('G', k, v)} />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: EQUIPE_COLOR, marginBottom: '8px' }}>Équipe</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
            {Object.keys(labelsEquipe).map(k => (
              <ChampPoint key={k} label={labelsEquipe[k]} value={config.points.equipe[k]} onChange={v => setPoints('equipe', k, v)} />
            ))}
          </div>
        </div>
      </div>

      {/* Salary cap */}
      {(config.salaryCapActif || typeInfo.salaryCap) && (
        <div style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '14px', padding: '18px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Salary Cap</div>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#888', lineHeight: '1.6' }}>
            Aucune API publique ne redistribue légalement les vrais salaires NHL (vérifié : NHL officiel, PuckPedia, CapFriendly, Spotrac, CapWages, marqueur.com — tous interdisent la redistribution ou n'ont pas ces données). Les salaires se saisissent donc manuellement pendant le draft — réfère-toi à PuckPedia ou CapWages pour les vrais chiffres.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888', cursor: 'pointer' }}>
              <input type="checkbox" checked={config.salaryCapActif} onChange={e => setConfig(c => ({ ...c, salaryCapActif: e.target.checked }))} />
              Activer le plafond salarial
            </label>
            {config.salaryCapActif && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Plafond ($) :</span>
                <input type="number" step="500000" value={config.plafond} onChange={e => setConfig(c => ({ ...c, plafond: parseInt(e.target.value) || 0 }))}
                  style={{ width: '140px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '6px 10px', color: '#f97316', fontSize: '13px', fontWeight: '800' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Composition roster */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Composition du roster</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
          {rosterFields.map(([cle, label]) => (
            <ChampNombre key={cle} label={label} value={config.roster[cle]} onChange={v => setRoster(cle, v)} min={0} max={cle === 'bench' ? 15 : cle === 'F' ? 20 : 12} />
          ))}
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#555' }}>Total : <strong style={{ color: 'white' }}>{totalSlots}</strong> joueurs + <strong style={{ color: 'white' }}>1</strong> équipe par participant · <strong style={{ color: 'white' }}>{totalSlots + 1}</strong> rondes de draft</div>
      </div>

      {/* Ordre du draft */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '18px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Ordre du draft</div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#ccc', marginBottom: '8px' }}>Type d'ordre</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px' }}>
            {ORDRE_TYPES.map(o => (
              <button key={o.id} onClick={() => setConfig(c => ({ ...c, ordreType: o.id }))}
                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', border: config.ordreType === o.id ? '1px solid #f97316' : '1px solid #222', backgroundColor: config.ordreType === o.id ? 'rgba(249,115,22,0.08)' : '#111' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: config.ordreType === o.id ? 'white' : '#ccc', marginBottom: '4px' }}>{o.label}</div>
                <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.5' }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#ccc', marginBottom: '8px' }}>Ordre des participants</div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#555' }}>Glisse les participants (icône ≡) pour réorganiser l'ordre de la 1ʳᵉ ronde.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {config.participants.map((p, i) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { reordonnerParticipants(dragIndex, i); setDragIndex(null); }}
                onDragEnd={() => setDragIndex(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: dragIndex === i ? 'rgba(249,115,22,0.08)' : '#111', border: dragIndex === i ? '1px solid #f97316' : '1px solid #222', borderRadius: '10px', padding: '9px 12px', cursor: 'grab' }}>
                <span style={{ color: '#555', fontSize: '16px', fontWeight: '700', lineHeight: 1 }}>≡</span>
                <span style={{ fontSize: '11px', color: '#444', minWidth: '18px' }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: p.estMoi ? '700' : '500', color: 'white' }}>{p.estMoi ? '★ ' : ''}{p.nom}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#ccc', marginBottom: '8px' }}>Aperçu complet</div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#555' }}>Le choix de l'équipe NHL compte comme une ronde complète, comme un joueur.</p>
          <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 12px', maxHeight: '260px', overflowY: 'auto' }}>
            {totalSlots === 0 ? (
              <div style={{ fontSize: '12px', color: '#444' }}>Ajoute des joueurs au roster pour voir l'aperçu.</div>
            ) : (() => {
              const nbParticipants = config.participants.length;
              const totalRondes = totalSlots + 1;
              const ordreComplet = calculerOrdreDraft(config.participants, totalRondes, config.ordreType);
              return Array.from({ length: totalRondes }).map((_, r) => {
                const debut = r * nbParticipants;
                const joueursRonde = ordreComplet.slice(debut, debut + nbParticipants);
                return (
                  <div key={r} style={{ fontSize: '12px', color: '#888', padding: '3px 0' }}>
                    <strong style={{ color: 'white' }}>Ronde {r + 1}</strong> : {joueursRonde.map(p => p.nom).join(' → ')}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      <button
        onClick={onSuivant}
        disabled={totalSlots === 0 || config.participants.length < 2}
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: totalSlots === 0 ? 'not-allowed' : 'pointer', background: totalSlots === 0 ? '#222' : 'linear-gradient(135deg, #f97316, #ea580c)', color: totalSlots === 0 ? '#555' : 'white', fontSize: '15px', fontWeight: '700' }}>
        Commencer le draft assisté →
      </button>
    </div>
  );
}

// Choix de l'equipe NHL favorite du participant courant, assignee pour toute la saison (persiste dans config.participants).
function SelecteurEquipe({ participant, onChoisir }) {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => { setOuvert(false); }, [participant?.id]);

  if (!participant) return null;

  if (participant.equipe) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '6px 10px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>Équipe :</span>
        <span style={{ fontSize: '12px', fontWeight: '800', color: '#f97316' }}>{participant.equipe}</span>
      </div>
    );
  }

  if (ouvert) {
    return (
      <select
        autoFocus
        defaultValue=""
        onChange={e => { if (e.target.value) { onChoisir(participant.id, e.target.value); setOuvert(false); } }}
        onBlur={() => setOuvert(false)}
        style={{ backgroundColor: '#111', border: '1px solid #f97316', borderRadius: '8px', padding: '6px 10px', color: 'white', fontSize: '12px', fontWeight: '700' }}>
        <option value="">Choisir...</option>
        {Object.keys(LOGOS_NHL).sort().map(abbrev => (
          <option key={abbrev} value={abbrev}>{abbrev}</option>
        ))}
      </select>
    );
  }

  return (
    <button onClick={() => setOuvert(true)}
      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #f97316', backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', cursor: 'pointer', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
      Choisir mon équipe NHL
    </button>
  );
}

// ===================== ETAPE 2 : DRAFT ASSISTE =====================
function EtapeDraft({ config, setConfig, draftPicks, setDraftPicks, pickIndex, setPickIndex, salaires, setSalaires, participantActifBox, setParticipantActifBox, onSuivant, onRetour }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const seasonId = useSaisonCourante();
  const typeInfo = getTypeInfo(config.typePool);

  const [joueurs, setJoueurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [resultatsRecherche, setResultatsRecherche] = useState([]);
  const [dropdownRechercheOuvert, setDropdownRechercheOuvert] = useState(false);
  const [filtrePos, setFiltrePos] = useState('ALL');
  const [nbAffiches, setNbAffiches] = useState(50);
  const [participantVu, setParticipantVu] = useState(() => config.participants.find(p => p.estMoi)?.id || config.participants[0]?.id);

  useEffect(() => {
    let annule = false;
    async function charger() {
      setChargement(true);
      setErreur(false);
      try {
        const [resSum, resGoal] = await Promise.all([
          fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=${seasonId}&limit=-1`)),
          fetch(getStatsUrl(`https://api.nhle.com/stats/rest/en/goalie/summary?cayenneExp=seasonId=${seasonId}&limit=-1`)),
        ]);
        const [dataSum, dataGoal] = await Promise.all([resSum.json(), resGoal.json()]);

        // Diagnostic : verifie dans la console le nom exact du champ position renvoye par l'API NHL.
        if (dataSum.data?.[0]) console.log('[PoolDraft] Exemple joueur brut (skater/summary) :', dataSum.data[0]);
        if (dataGoal.data?.[0]) console.log('[PoolDraft] Exemple gardien brut (goalie/summary) :', dataGoal.data[0]);
        if (dataSum.data?.length) console.log('[PoolDraft] Valeurs distinctes de positionCode :', [...new Set(dataSum.data.map(s => s.positionCode))]);

        const skaters = (dataSum.data || []).map(s => ({
          id: s.playerId,
          nom: s.skaterFullName,
          equipe: s.teamAbbrevs,
          positionCode: s.positionCode,
          posGroupe: mapPositionCode(s.positionCode),
          posReel: mapPosReel(s.positionCode),
          gamesPlayed: s.gamesPlayed || 0,
          goals: s.goals || 0,
          assists: s.assists || 0,
          points: s.points || 0,
          plusMinus: s.plusMinus || 0,
          shots: s.shots || 0,
          ppGoals: s.ppGoals || 0,
          ppPoints: s.ppPoints || 0,
        }));

        const goalies = (dataGoal.data || []).map(g => ({
          id: g.playerId,
          nom: g.goalieFullName,
          equipe: g.teamAbbrevs,
          positionCode: 'G',
          posGroupe: 'G',
          posReel: 'G',
          gamesPlayed: g.gamesPlayed || 0,
          wins: g.wins || 0,
          shutouts: g.shutouts || 0,
          goals: g.goals || 0,
          saves: g.saves || 0,
          savePct: g.savePct || 0,
        }));

        const tous = [...skaters, ...goalies].sort((a, b) => a.nom.localeCompare(b.nom));
        if (!annule) { setJoueurs(tous); setChargement(false); }
      } catch {
        if (!annule) { setErreur(true); setChargement(false); }
      }
    }
    charger();
    return () => { annule = true; };
  }, [seasonId]);

  // Meme endpoint et meme logique de recherche que PageStatsJoueurs dans Analyses.js :
  // recherche NHL en temps reel des que 2 caracteres sont tapes.
  async function rechercherJoueur(query) {
    if (query.trim().length < 2) { setResultatsRecherche([]); return; }
    try {
      const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=fr-CA&limit=10&q=${encodeURIComponent(query)}&active=true`);
      const data = await res.json();
      setResultatsRecherche(data || []);
      setDropdownRechercheOuvert(true);
    } catch { setResultatsRecherche([]); }
  }

  const idsRecherche = useMemo(() => new Set(resultatsRecherche.map(r => Number(r.playerId))), [resultatsRecherche]);

  const joueursAvecValeur = useMemo(() => joueurs.map(j => ({ ...j, valeurIA: calculerValeurIA(j, config.points) })), [joueurs, config.points]);

  const totalSlots = totalRosterSlots(config.roster);
  // Le choix de l'equipe NHL favorite compte comme une ronde complete, comme un joueur.
  const totalRondes = totalSlots + 1;
  const nbParticipants = config.participants.length;

  // Ordre de draft (lineaire ou snake selon config.ordreType) pour les types tour-par-tour.
  const ordre = useMemo(() => {
    if (!typeInfo.tourParTour) return [];
    return calculerOrdreDraft(config.participants, totalRondes, config.ordreType);
  }, [config.participants, totalRondes, typeInfo.tourParTour, config.ordreType]);

  const draftTermine = typeInfo.tourParTour ? pickIndex >= ordre.length : config.participants.every(p => draftPicks.filter(d => d.participantId === p.id).length >= totalRondes);
  const participantCourant = typeInfo.tourParTour ? (ordre[pickIndex] || null) : config.participants.find(p => p.id === participantActifBox) || config.participants[0];
  const rondeCourante = typeInfo.tourParTour ? Math.min(Math.floor(pickIndex / nbParticipants) + 1, totalRondes) : null;

  function rosterDe(participantId) {
    return draftPicks.filter(p => p.participantId === participantId);
  }

  // Choisir son equipe NHL pendant le draft consomme une ronde complete, exactement comme un joueur.
  function choisirEquipeParticipant(participantId, equipe) {
    const participant = config.participants.find(p => p.id === participantId);
    if (!participant || participant.equipe) return;
    setConfig(c => ({ ...c, participants: c.participants.map(p => p.id === participantId ? { ...p, equipe } : p) }));
    setDraftPicks(dp => [...dp, {
      type: 'equipe', equipe, nom: null, posGroupe: null, posReel: null, valeurIA: 0,
      participantId,
      pick: dp.length + 1, ronde: rondeCourante || Math.floor(dp.length / nbParticipants) + 1,
    }]);
    if (typeInfo.tourParTour) setPickIndex(i => i + 1);
  }

  function budgetRestant(participantId) {
    if (!config.salaryCapActif) return null;
    const utilise = rosterDe(participantId).reduce((s, j) => s + (salaires[j.joueurId] || 0), 0);
    return config.plafond - utilise;
  }

  const estDisponible = (joueurId) => typeInfo.exclusif
    ? !draftPicks.some(p => p.joueurId === joueurId)
    : !draftPicks.some(p => p.joueurId === joueurId && p.participantId === (participantCourant?.id));

  function drafter(joueur) {
    if (!participantCourant) return;
    if (!estDisponible(joueur.id)) return;
    setDraftPicks(dp => [...dp, {
      joueurId: joueur.id, nom: joueur.nom, equipe: joueur.equipe, posGroupe: joueur.posGroupe, posReel: joueur.posReel,
      valeurIA: joueur.valeurIA, participantId: participantCourant.id,
      pick: dp.length + 1, ronde: rondeCourante || Math.floor(dp.length / nbParticipants) + 1,
    }]);
    if (typeInfo.tourParTour) setPickIndex(i => i + 1);
  }

  function retirer(pickPos) {
    const pick = draftPicks[pickPos];
    if (pick?.type === 'equipe') {
      setConfig(c => ({ ...c, participants: c.participants.map(p => p.id === pick.participantId ? { ...p, equipe: '' } : p) }));
    }
    setDraftPicks(dp => dp.filter((_, i) => i !== pickPos));
    if (typeInfo.tourParTour) setPickIndex(i => Math.max(0, i - 1));
  }

  const moiParticipant = config.participants.find(p => p.estMoi);
  const suggestions = useMemo(() => {
    const estTourDeMoi = typeInfo.tourParTour ? (participantCourant?.estMoi) : (participantActifBox === moiParticipant?.id);
    if (!estTourDeMoi || !moiParticipant) return [];
    const monRoster = rosterDe(moiParticipant.id);
    const besoins = POS_ORDER.filter(pos => monRoster.filter(j => j.posGroupe === pos).length < (config.roster[pos] || 0));
    const restant = config.salaryCapActif ? budgetRestant(moiParticipant.id) : Infinity;

    let candidats = joueursAvecValeur.filter(j => {
      if (!estDisponible(j.id)) return false;
      if (config.salaryCapActif && restant != null) {
        const sal = salaires[j.id] || 0;
        if (sal > 0 && sal > restant) return false;
      }
      return true;
    });
    const parBesoin = besoins.length > 0 ? candidats.filter(j => besoins.includes(j.posGroupe)) : candidats;
    const pool = parBesoin.length >= 3 ? parBesoin : candidats;
    return [...pool].sort((a, b) => b.valeurIA - a.valeurIA).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joueursAvecValeur, draftPicks, participantCourant, participantActifBox, config, salaires]);

  // Recherche active des 2 caracteres tapes : ne garde que les joueurs renvoyes par l'API de recherche NHL,
  // combine avec le filtre de position (les deux s'appliquent ensemble, comme un AND).
  const rechercheActive = recherche.trim().length >= 2;
  const joueursFiltres = useMemo(() => {
    return joueursAvecValeur
      .filter(j => {
        if (!joueurCorrespondFiltre(j.positionCode, filtrePos)) return false;
        if (rechercheActive && !idsRecherche.has(j.id)) return false;
        return true;
      })
      .sort((a, b) => b.valeurIA - a.valeurIA);
  }, [joueursAvecValeur, filtrePos, rechercheActive, idsRecherche]);

  const rosterVu = rosterDe(participantVu);
  const besoinsVu = POS_ORDER.map(pos => ({ pos, pris: rosterVu.filter(j => j.posGroupe === pos).length, total: config.roster[pos] || 0 }));

  return (
    <div style={{ padding, maxWidth: '1200px', margin: '0 auto' }}>
      <button onClick={onRetour} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>← Configuration</button>

      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>Draft assisté</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>{config.nomPool || 'Mon pool'} · {typeInfo.label} · {draftPicks.length} choix effectués</p>
      </div>

      {/* Bandeau tour actuel */}
      {typeInfo.tourParTour ? (
        draftTermine ? (
          <div style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '14px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>Draft terminé — {draftPicks.length} choix effectués</div>
          </div>
        ) : (
          <div style={{ background: participantCourant?.estMoi ? 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08))' : 'rgba(249,115,22,0.04)', border: participantCourant?.estMoi ? '1px solid #f97316' : '1px solid rgba(249,115,22,0.2)', borderRadius: '14px', padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>C'est au tour de</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: 'white' }}>{participantCourant?.estMoi ? '🎯 ' : ''}{participantCourant?.nom}</div>
            </div>
            <SelecteurEquipe participant={participantCourant} onChoisir={choisirEquipeParticipant} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#888' }}>Ronde {rondeCourante}/{totalRondes}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Choix global #{pickIndex + 1}</div>
            </div>
          </div>
        )
      ) : (
        <div style={{ backgroundColor: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Choix multiples permis · Piocher pour :</span>
          <select value={participantActifBox} onChange={e => setParticipantActifBox(parseInt(e.target.value))}
            style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '6px 10px', color: 'white', fontSize: '13px', fontWeight: '700' }}>
            {config.participants.map(p => <option key={p.id} value={p.id}>{p.estMoi ? '★ ' : ''}{p.nom}{p.equipe ? ` (${p.equipe})` : ''}</option>)}
          </select>
          <SelecteurEquipe participant={participantCourant} onChoisir={choisirEquipeParticipant} />
        </div>
      )}

      {/* Suggestions IA */}
      {suggestions.length > 0 && !chargement && (
        <div style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Top 3 suggestions IA (positions manquantes · budget · meilleure valeur)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px' }}>
            {suggestions.map((j, i) => (
              <div key={j.id} style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: POS_REEL_COLORS[j.posReel] }}>#{i + 1} · {j.posReel}</span>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#f97316' }}>{j.valeurIA}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'white', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nom}</div>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>{j.equipe}</div>
                <button onClick={() => drafter(j)} style={{ width: '100%', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '11px', fontWeight: '700' }}>Choisir</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recherche / filtres */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <input
            value={recherche}
            onChange={e => { setRecherche(e.target.value); setNbAffiches(50); rechercherJoueur(e.target.value); }}
            placeholder="Rechercher un joueur (dès 2 lettres)..."
            style={{ width: '100%', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '13px', boxSizing: 'border-box' }}
          />
          {dropdownRechercheOuvert && resultatsRecherche.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1a1a', borderRadius: '10px', border: '1px solid #333', marginTop: '4px', overflow: 'hidden', zIndex: 100 }}>
              {resultatsRecherche.map((r, i) => (
                <div key={r.playerId ?? i}
                  onClick={() => { setRecherche(r.name); setDropdownRechercheOuvert(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: i < resultatsRecherche.length - 1 ? '1px solid #222' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#222'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <img src={`https://assets.nhle.com/mugs/nhl/${seasonId}/${r.teamAbbrev}/${r.playerId}.png`} alt={r.name}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#111', flexShrink: 0 }}
                    onError={e => { e.target.onerror = null; e.target.style.objectFit = 'contain'; e.target.style.borderRadius = '0'; e.target.style.backgroundColor = 'transparent'; e.target.src = LOGOS_NHL[r.teamAbbrev]; }} />
                  <img src={LOGOS_NHL[r.teamAbbrev]} alt={r.teamAbbrev} style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'white' }}>{r.name}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{r.teamAbbrev} · {r.positionCode}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['ALL', ...POS_REEL_ORDER].map(p => (
            <button key={p} onClick={() => { setFiltrePos(p); setNbAffiches(50); }} title={p === 'ALL' ? 'Tous' : POS_REEL_LABELS[p]}
              style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: filtrePos === p ? (POS_REEL_COLORS[p] || '#f97316') : '#111', color: filtrePos === p ? 'white' : '#555', fontSize: '11px', fontWeight: '700' }}>{p === 'ALL' ? 'Tous' : p}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '16px' }}>
        <div>
          {chargement ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #1a1a1a', borderTop: '3px solid #f97316', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
              <p style={{ color: '#444', fontSize: '13px', margin: 0 }}>Chargement des joueurs NHL ({seasonId})...</p>
            </div>
          ) : erreur ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef4444', fontSize: '13px' }}>Impossible de charger les joueurs NHL pour l'instant.</div>
          ) : joueursFiltres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '13px' }}>Aucun joueur trouvé</div>
          ) : (
            <>
              {joueursFiltres.slice(0, nbAffiches).map(j => {
                const disponible = estDisponible(j.id);
                return (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '12px', padding: '10px 12px', marginBottom: '6px', opacity: disponible ? 1 : 0.4, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <img src={`https://assets.nhle.com/mugs/nhl/${seasonId}/${j.equipe}/${j.id}.png`} alt={j.nom}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#111', flexShrink: 0 }}
                      onError={e => { e.target.onerror = null; e.target.style.objectFit = 'contain'; e.target.style.borderRadius = '0'; e.target.style.backgroundColor = 'transparent'; e.target.src = LOGOS_NHL[j.equipe]; }} />
                    <span style={{ fontSize: '10px', fontWeight: '700', color: POS_REEL_COLORS[j.posReel], backgroundColor: '#111', borderRadius: '6px', padding: '3px 7px', flexShrink: 0 }}>{j.posReel}</span>
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '700', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <img src={LOGOS_NHL[j.equipe]} alt={j.equipe} style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                        {j.nom}
                      </div>
                      <div style={{ fontSize: '10px', color: '#555' }}>
                        {j.equipe} · {j.posGroupe === 'G'
                          ? `${j.wins}V · ${(j.savePct * 100).toFixed(1)}% arrêts`
                          : `${j.points} PTS (${j.goals}B-${j.assists}P) · ${j.gamesPlayed} PJ`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#f97316' }}>{j.valeurIA}</div>
                      <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.3px' }}>PROJECTION</div>
                    </div>
                    {config.salaryCapActif && (
                      <input
                        type="number"
                        placeholder="Salaire $"
                        value={salaires[j.id] || ''}
                        onChange={e => setSalaires(s => ({ ...s, [j.id]: parseInt(e.target.value) || 0 }))}
                        style={{ width: '90px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '6px 8px', color: 'white', fontSize: '11px', flexShrink: 0 }}
                      />
                    )}
                    <button
                      onClick={() => drafter(j)}
                      disabled={!disponible}
                      style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: disponible ? 'pointer' : 'not-allowed', backgroundColor: disponible ? 'rgba(249,115,22,0.15)' : '#1a1a1a', color: disponible ? '#f97316' : '#444', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                      {disponible ? 'Marquer comme choisi' : 'Déjà pris'}
                    </button>
                  </div>
                );
              })}
              {nbAffiches < joueursFiltres.length && (
                <button onClick={() => setNbAffiches(n => n + 50)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #222', backgroundColor: '#111', color: '#888', cursor: 'pointer', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>
                  Voir plus ({joueursFiltres.length - nbAffiches} restants)
                </button>
              )}
            </>
          )}
        </div>

        {/* Roster en construction */}
        <div>
          <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '14px', padding: '14px', position: isMobile ? 'static' : 'sticky', top: '16px' }}>
            <select value={participantVu} onChange={e => setParticipantVu(parseInt(e.target.value))}
              style={{ width: '100%', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '8px 10px', color: 'white', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
              {config.participants.map(p => <option key={p.id} value={p.id}>{p.estMoi ? '★ ' : ''}{p.nom}{p.equipe ? ` (${p.equipe})` : ''}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {besoinsVu.map(b => (
                <div key={b.pos} style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '5px 8px', textAlign: 'center', flex: 1, minWidth: '48px' }}>
                  <div style={{ fontSize: '9px', color: POS_COLORS[b.pos], fontWeight: '700' }}>{b.pos}</div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{b.pris}/{b.total}</div>
                </div>
              ))}
            </div>

            {config.salaryCapActif && (
              <div style={{ backgroundColor: '#111', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', color: '#666' }}>BUDGET RESTANT</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: (budgetRestant(participantVu) || 0) < 0 ? '#ef4444' : '#22c55e' }}>
                  {(budgetRestant(participantVu) || 0).toLocaleString('fr-CA')} $
                </div>
              </div>
            )}

            {rosterVu.length === 0 ? (
              <div style={{ color: '#333', fontSize: '12px', padding: '10px 0' }}>Aucun joueur sélectionné pour l'instant.</div>
            ) : (
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {rosterVu.map((j) => {
                  const idxGlobal = draftPicks.indexOf(j);
                  if (j.type === 'equipe') {
                    return (
                      <div key={idxGlobal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid #161616' }}>
                        <span style={{ fontSize: '10px', color: '#444', minWidth: '18px' }}>{j.pick}</span>
                        <img src={LOGOS_NHL[j.equipe]} alt={j.equipe} style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '12px', color: 'white', fontWeight: '700' }}>Équipe : {j.equipe}</span>
                        <button onClick={() => retirer(idxGlobal)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </div>
                    );
                  }
                  return (
                    <div key={idxGlobal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid #161616' }}>
                      <span style={{ fontSize: '10px', color: '#444', minWidth: '18px' }}>{j.pick}</span>
                      <span style={{ fontSize: '9px', fontWeight: '700', color: POS_REEL_COLORS[j.posReel] }}>{j.posReel}</span>
                      <span style={{ flex: 1, fontSize: '12px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nom}</span>
                      <button onClick={() => retirer(idxGlobal)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={onSuivant}
              disabled={draftPicks.length === 0}
              style={{ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '10px', border: 'none', cursor: draftPicks.length === 0 ? 'not-allowed' : 'pointer', background: draftPicks.length === 0 ? '#222' : 'linear-gradient(135deg, #f97316, #ea580c)', color: draftPicks.length === 0 ? '#555' : 'white', fontSize: '13px', fontWeight: '700' }}>
              {draftTermine ? 'Voir le résumé →' : 'Voir le résumé (draft en cours) →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== ETAPE 3 : RESUME =====================
function EtapeResume({ config, draftPicks, salaires, onRetour, onRecommencer }) {
  const isMobile = useIsMobile();
  const padding = isMobile ? '16px' : '32px';
  const totalSlots = totalRosterSlots(config.roster);
  // Le choix de l'equipe NHL favorite compte comme une ronde complete, comme un joueur.
  const totalRondes = totalSlots + 1;
  const [participantVu, setParticipantVu] = useState(() => config.participants.find(p => p.estMoi)?.id || config.participants[0]?.id);

  function rosterDe(participantId) { return draftPicks.filter(p => p.participantId === participantId); }

  function analyser(participantId) {
    return POS_ORDER.map(pos => {
      const mesJoueurs = rosterDe(participantId).filter(j => j.posGroupe === pos);
      const total = config.roster[pos] || 0;
      const valeurMoyenneMoi = mesJoueurs.length ? mesJoueurs.reduce((s, j) => s + j.valeurIA, 0) / mesJoueurs.length : 0;
      const tousAPos = draftPicks.filter(j => j.posGroupe === pos);
      const valeurMoyennePool = tousAPos.length ? tousAPos.reduce((s, j) => s + j.valeurIA, 0) / tousAPos.length : 0;
      let statut = 'neutre';
      if (mesJoueurs.length < total) statut = 'faiblesse';
      else if (valeurMoyennePool > 0 && valeurMoyenneMoi >= valeurMoyennePool * 1.1) statut = 'force';
      else if (valeurMoyennePool > 0 && valeurMoyenneMoi <= valeurMoyennePool * 0.9) statut = 'faiblesse';
      return { pos, pris: mesJoueurs.length, total, valeurMoyenneMoi: Math.round(valeurMoyenneMoi * 10) / 10, statut };
    });
  }

  const roster = rosterDe(participantVu);
  const projection = Math.round(roster.reduce((s, j) => s + j.valeurIA, 0) * 10) / 10;
  const budgetUtilise = roster.reduce((s, j) => s + (salaires[j.joueurId] || 0), 0);
  const analyse = analyser(participantVu);
  const participant = config.participants.find(p => p.id === participantVu);

  const STATUT_STYLE = {
    force: { color: '#22c55e', label: 'Force' },
    faiblesse: { color: '#ef4444', label: 'Faiblesse' },
    neutre: { color: '#666', label: 'Neutre' },
  };

  return (
    <div style={{ padding, maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={onRetour} style={{ backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '16px' }}>← Draft</button>

      <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'white' }}>Résumé du roster</h2>
      <p style={{ margin: '0 0 16px', color: '#666', fontSize: '13px' }}>{config.nomPool || 'Mon pool'} · {getTypeInfo(config.typePool).label} · {config.participants.length} participants</p>

      <select value={participantVu} onChange={e => setParticipantVu(parseInt(e.target.value))}
        style={{ width: '100%', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>
        {config.participants.map(p => <option key={p.id} value={p.id}>{p.estMoi ? '★ ' : ''}{p.nom}{p.equipe ? ` (${p.equipe})` : ''} — {rosterDe(p.id).length}/{totalRondes}</option>)}
      </select>

      <div style={{ display: 'grid', gridTemplateColumns: config.salaryCapActif ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{roster.length}/{totalRondes}</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rondes complétées</div>
        </div>
        <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#f97316' }}>{projection}</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Projection de points</div>
        </div>
        {config.salaryCapActif && (
          <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #161616', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '900', color: budgetUtilise > config.plafond ? '#ef4444' : '#22c55e' }}>{budgetUtilise.toLocaleString('fr-CA')} $</div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>sur {config.plafond.toLocaleString('fr-CA')} $</div>
          </div>
        )}
      </div>

      {/* Forces / faiblesses */}
      <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Analyse forces / faiblesses</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {analyse.map(a => (
            <div key={a.pos} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: POS_COLORS[a.pos], minWidth: '28px' }}>{a.pos}</span>
              <span style={{ flex: 1, fontSize: '12px', color: '#888' }}>{POS_LABELS[a.pos]} · {a.pris}/{a.total} · valeur moy. {a.valeurMoyenneMoi}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: STATUT_STYLE[a.statut].color }}>{STATUT_STYLE[a.statut].label}</span>
            </div>
          ))}
        </div>
      </div>

      {roster.filter(j => j.type === 'equipe').map(j => (
        <div key={j.pick} style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: EQUIPE_COLOR, fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Équipe favorite</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', borderRadius: '8px', padding: '8px 12px' }}>
            <span style={{ fontSize: '10px', color: '#444', minWidth: '20px' }}>#{j.pick}</span>
            <img src={LOGOS_NHL[j.equipe]} alt={j.equipe} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: 'white' }}>{j.equipe}</span>
          </div>
        </div>
      ))}

      {POS_ORDER.map(pos => {
        const joueursPos = roster.filter(j => j.posGroupe === pos).sort((a, b) => a.pick - b.pick);
        if (joueursPos.length === 0) return null;
        return (
          <div key={pos} style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', border: '1px solid #161616', padding: '16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: POS_COLORS[pos], fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>{POS_LABELS[pos]} · {joueursPos.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {joueursPos.map(j => (
                <div key={j.joueurId} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', borderRadius: '8px', padding: '8px 12px' }}>
                  <span style={{ fontSize: '10px', color: '#444', minWidth: '20px' }}>#{j.pick}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: 'white' }}>{j.nom}</span>
                  <span style={{ fontSize: '11px', color: '#555' }}>{j.equipe}</span>
                  {config.salaryCapActif && <span style={{ fontSize: '11px', color: '#888' }}>{(salaires[j.joueurId] || 0).toLocaleString('fr-CA')} $</span>}
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#f97316' }}>{j.valeurIA}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {roster.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '13px' }}>{participant?.nom} n'a encore aucun joueur drafté.</div>
      )}

      <button onClick={onRecommencer} style={{ width: '100%', marginTop: '10px', padding: '14px', borderRadius: '12px', border: '1px solid #222', cursor: 'pointer', backgroundColor: '#111', color: '#888', fontSize: '13px', fontWeight: '700' }}>
        ↺ Recommencer un nouveau pool
      </button>
    </div>
  );
}

// ===================== COMPOSANT PRINCIPAL =====================
export default function PoolDraft() {
  const [etape, setEtape] = useState(1);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [draftPicks, setDraftPicks] = useState([]);
  const [pickIndex, setPickIndex] = useState(0);
  const [salaires, setSalaires] = useState({});
  const [participantActifBox, setParticipantActifBox] = useState(() => DEFAULT_CONFIG.participants.find(p => p.estMoi)?.id);

  function recommencer() {
    setConfig(DEFAULT_CONFIG);
    setDraftPicks([]);
    setPickIndex(0);
    setSalaires({});
    setParticipantActifBox(DEFAULT_CONFIG.participants.find(p => p.estMoi)?.id);
    setEtape(1);
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <Stepper etape={etape} />
      {etape === 1 && (
        <EtapeConfig config={config} setConfig={setConfig} onSuivant={() => {
          setParticipantActifBox(config.participants.find(p => p.estMoi)?.id || config.participants[0]?.id);
          setEtape(2);
        }} />
      )}
      {etape === 2 && (
        <EtapeDraft
          config={config}
          setConfig={setConfig}
          draftPicks={draftPicks}
          setDraftPicks={setDraftPicks}
          pickIndex={pickIndex}
          setPickIndex={setPickIndex}
          salaires={salaires}
          setSalaires={setSalaires}
          participantActifBox={participantActifBox}
          setParticipantActifBox={setParticipantActifBox}
          onSuivant={() => setEtape(3)}
          onRetour={() => setEtape(1)}
        />
      )}
      {etape === 3 && (
        <EtapeResume config={config} draftPicks={draftPicks} salaires={salaires} onRetour={() => setEtape(2)} onRecommencer={recommencer} />
      )}
    </div>
  );
}
