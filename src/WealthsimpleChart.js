import React, { useRef, useState } from 'react';

// Composant de graphique partage, style Wealthsimple : courbe lisse (Catmull-Rom) avec degrade
// sous la ligne, curseur interactif au survol (ligne verticale + point + date au-dessus,
// JAMAIS de montant affiche ici), ligne plate pointillee + message discret quand il n'y a
// aucune donnee, selecteurs de periode (gauche) + bascule de mode optionnelle (droite) sous le
// graphique. Purement presentationnel : le filtrage par periode, le calcul valeur/rendement et
// la grande valeur/variation affichees restent dans l'appelant (src/Home.js, src/App.js) --
// ce composant recoit la serie finale pour la periode/le mode actifs et previent l'appelant du
// point survole via onHoverChange, pour que son propre texte de variation puisse reagir.

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
  emptyLabel,
  lang = 'fr',
  gradientId,
  hauteur = 110,
  color = '#f97316',   // vert/rouge selon hausse/baisse : calcule par l'appelant (seule source de verite partagee avec son propre texte de variation)
  onHoverChange,       // (point|null) => void -- l'appelant met a jour sa propre valeur/variation affichee
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);
  const W = 600, H = hauteur;

  const valeurs = points.map(p => p.value);
  const maxVal = Math.max(...valeurs, 1);
  const minVal = Math.min(...valeurs, 0);
  const range = (maxVal - minVal) || 1;
  const coords = valeurs.map((v, i) => ({
    x: valeurs.length === 1 ? W / 2 : (i / (valeurs.length - 1)) * W,
    y: H - ((v - minVal) / range) * H,
  }));
  const lignePath = cheminLisse(coords);
  const airePath = coords.length > 1 ? `${lignePath} L ${coords[coords.length - 1].x},${H} L ${coords[0].x},${H} Z` : '';

  function signalerSurvol(index) {
    setHoverIndex(index);
    onHoverChange?.(index != null ? points[index] : null);
  }

  function onMouseMove(e) {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xSvg = ((e.clientX - rect.left) / rect.width) * W;
    let plusProche = 0, meilleureDist = Infinity;
    coords.forEach((c, i) => { const dist = Math.abs(c.x - xSvg); if (dist < meilleureDist) { meilleureDist = dist; plusProche = i; } });
    signalerSurvol(plusProche);
  }

  const gid = gradientId || `wsGrad${Math.random().toString(36).slice(2)}`;
  const dateSurvolee = hoverIndex != null ? points[hoverIndex]?.date : null;
  const dateLabel = dateSurvolee ? new Date(dateSurvolee).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' }) : '';

  return (
    <div>
      {coords.length > 1 ? (
        <svg ref={svgRef} width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none"
          onMouseMove={onMouseMove} onMouseLeave={() => signalerSurvol(null)} style={{ cursor: 'crosshair', overflow: 'visible', display: 'block' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform="translate(0, 14)">
            <path d={airePath} fill={`url(#${gid})`} stroke="none" />
            <path d={lignePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {hoverIndex != null && coords[hoverIndex] && (
              <>
                <line x1={coords[hoverIndex].x} y1="0" x2={coords[hoverIndex].x} y2={H} stroke="var(--c-333)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={coords[hoverIndex].x} cy={coords[hoverIndex].y} r="3.5" fill={color} stroke="var(--c-080808)" strokeWidth="1.5" />
                <text x={coords[hoverIndex].x} y={Math.max(coords[hoverIndex].y - 10, 8)} textAnchor="middle" fontSize="10" fill="var(--c-888)">{dateLabel}</text>
              </>
            )}
          </g>
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
            <button key={p.key} onClick={() => { onSelectPeriod(p.key); signalerSurvol(null); }}
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
