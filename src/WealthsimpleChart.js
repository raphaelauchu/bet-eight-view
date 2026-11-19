import React, { useRef, useState } from 'react';

// Composant de graphique partage, style Wealthsimple : grande valeur (survolee ou derniere) +
// variation coloree en haut, courbe lisse (Catmull-Rom) avec degrade sous la ligne, curseur
// interactif au survol, ligne plate pointillee + message discret quand il n'y a aucune donnee,
// selecteurs de periode (gauche) + bascule de mode optionnelle (droite) sous le graphique.
// Purement presentationnel : le filtrage par periode et le calcul valeur/rendement restent
// dans l'appelant (src/Home.js, src/App.js) -- ce composant recoit juste la serie finale a
// afficher pour la periode/le mode actifs.

function cheminLisse(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function WealthsimpleChart({
  points,              // [{date, value}] ascendant, deja filtre+transforme pour la periode/le mode actifs
  periods,             // [{key, label}]
  period, onSelectPeriod,
  modeOptions,         // [{key, label}] ou null/undefined pour masquer la bascule
  mode, onSelectMode,
  isPercent = false,
  valeurActuelle = 0,
  emptyLabel,
  headerRight,
  lang = 'fr',
  gradientId,
  hauteur = 110,
  showHeader = true,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);
  const W = 600, H = hauteur;

  const valeurs = points.map(p => p.value);
  const maxVal = Math.max(...valeurs, isPercent ? 1 : 1);
  const minVal = Math.min(...valeurs, 0);
  const range = (maxVal - minVal) || 1;
  const coords = valeurs.map((v, i) => ({
    x: valeurs.length === 1 ? W / 2 : (i / (valeurs.length - 1)) * W,
    y: H - ((v - minVal) / range) * H,
  }));
  const lignePath = cheminLisse(coords);
  const airePath = coords.length > 1 ? `${lignePath} L ${coords[coords.length - 1].x},${H} L ${coords[0].x},${H} Z` : '';

  const variation = valeurs.length > 1 ? valeurs[valeurs.length - 1] - valeurs[0] : 0;
  const hausse = variation >= 0;
  const couleur = hausse ? '#22c55e' : '#ef4444';

  const pointSurvol = hoverIndex != null ? points[hoverIndex] : null;
  const valeurSurvolee = hoverIndex != null ? valeurs[hoverIndex] : (valeurs.length ? valeurs[valeurs.length - 1] : (isPercent ? 0 : valeurActuelle));
  const dateSurvolee = pointSurvol ? pointSurvol.date : points[points.length - 1]?.date;

  function onMouseMove(e) {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xSvg = ((e.clientX - rect.left) / rect.width) * W;
    let plusProche = 0, meilleureDist = Infinity;
    coords.forEach((c, i) => { const dist = Math.abs(c.x - xSvg); if (dist < meilleureDist) { meilleureDist = dist; plusProche = i; } });
    setHoverIndex(plusProche);
  }

  const formatHeader = (v) => (isPercent ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const gid = gradientId || `wsGrad${Math.random().toString(36).slice(2)}`;

  return (
    <div>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-1px' }}>{formatHeader(valeurSurvolee)}</div>
            <div style={{ fontSize: '11px', color: 'var(--c-666)', marginTop: '2px' }}>
              {dateSurvolee ? new Date(dateSurvolee).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              {valeurs.length > 1 && (
                <> · <span style={{ color: couleur, fontWeight: '700' }}>{hausse ? '+' : ''}{isPercent ? `${variation.toFixed(1)}%` : `$${variation.toFixed(2)}`}</span></>
              )}
            </div>
          </div>
          {headerRight}
        </div>
      )}

      {coords.length > 1 ? (
        <svg ref={svgRef} width="100%" height={H + 8} viewBox={`0 0 ${W} ${H + 8}`} preserveAspectRatio="none"
          onMouseMove={onMouseMove} onMouseLeave={() => setHoverIndex(null)} style={{ cursor: 'crosshair', overflow: 'visible', display: 'block' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={couleur} stopOpacity="0.22" />
              <stop offset="100%" stopColor={couleur} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={airePath} fill={`url(#${gid})`} stroke="none" />
          <path d={lignePath} fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {hoverIndex != null && coords[hoverIndex] && (
            <>
              <line x1={coords[hoverIndex].x} y1="0" x2={coords[hoverIndex].x} y2={H} stroke="var(--c-333)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={coords[hoverIndex].x} cy={coords[hoverIndex].y} r="3.5" fill={couleur} stroke="var(--c-080808)" strokeWidth="1.5" />
            </>
          )}
        </svg>
      ) : (
        <div style={{ position: 'relative', height: `${H}px` }}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--c-333)" strokeWidth="1.5" strokeDasharray="5 5" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--c-555)', fontSize: '12px', backgroundColor: 'var(--c-080808)', padding: '0 10px' }}>{emptyLabel}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => { onSelectPeriod(p.key); setHoverIndex(null); }}
              style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: period === p.key ? '#f97316' : 'var(--c-1a1a1a)', color: period === p.key ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '600' }}>
              {p.label}
            </button>
          ))}
        </div>
        {modeOptions && (
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--c-0a0a0a)', borderRadius: '10px', padding: '3px' }}>
            {modeOptions.map(m => (
              <button key={m.key} onClick={() => onSelectMode(m.key)}
                style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: mode === m.key ? '#f97316' : 'transparent', color: mode === m.key ? 'white' : 'var(--c-555)', fontSize: '11px', fontWeight: '700' }}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
