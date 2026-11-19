import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from './useIsMobile';
import { BottomSheet } from './BottomSheet';

// Meme mapping que PerformanceInsights.js (labelTypePari) -- duplique volontairement (4 lignes)
// plutot qu'importe, pour eviter une dependance circulaire (PerformanceInsights.js importe
// ShareStatsButton depuis ce fichier).
function labelTypePari(type, t) {
  if (!type) return null;
  const cle = { 'Moneyline': 'perf_type_moneyline', 'Prop joueur': 'perf_type_prop', 'Total': 'perf_type_total', 'Parlay': 'perf_type_parlay' }[type];
  return cle ? t(cle) : type;
}

// Partage "mes stats" (story Instagram/Facebook, style Wealthsimple) : feuille du bas (mobile)
// / modale centree (desktop) avec bascule masquage, selecteur de periode et carrousel de 2
// modeles, rendus sur un <canvas> 1080x1920 unique qui sert A LA FOIS d'apercu (mis a l'echelle
// via CSS, pixels reels inchanges) ET d'image exportee (canvas.toBlob) -- jamais deux dessins a
// synchroniser. Aucune donnee inventee : tout vient de `bets`/`bankroll` fournis par l'appelant
// (Home.js, PerformanceInsights.js), memes sources que le reste de l'app.

const PERIODES_PARTAGE = ['1m', '3m', '6m', '1y', 'all'];
const JOURS_PAR_PERIODE = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
const W = 1080, H = 1920;
const COULEURS_TYPE = ['#f97316', '#fb923c', '#fdba74', '#a8a29e', '#78716c'];

function filtrerParPeriode(bets, periode) {
  if (periode === 'all') return bets;
  const maintenant = new Date();
  return (bets || []).filter(b => b.date && (maintenant - new Date(b.date)) / 86400000 <= JOURS_PAR_PERIODE[periode]);
}

function calculerStats(bets, periode) {
  const periodeBets = filtrerParPeriode(bets, periode);
  const regles = periodeBets.filter(b => b.statut !== 'actif');
  const profit = regles.reduce((a, b) => a + (Number(b.profit) || 0), 0);
  const mise = regles.reduce((a, b) => a + (Number(b.mise) || 0), 0);
  const roi = mise !== 0 ? (profit / mise) * 100 : 0;
  const gagnes = regles.filter(b => b.statut === 'gagne').length;
  const perdus = regles.filter(b => b.statut === 'perdu').length;
  const winRate = regles.length ? (gagnes / regles.length) * 100 : 0;

  const parType = {};
  regles.forEach(b => {
    const ty = b.type || null;
    if (!ty) return;
    parType[ty] = (parType[ty] || 0) + 1;
  });
  const distribution = Object.entries(parType)
    .map(([type, count]) => ({ type, count, pct: regles.length ? (count / regles.length) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  const courbe = [...regles]
    .filter(b => b.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .reduce((acc, b) => {
      const prev = acc.length ? acc[acc.length - 1] : 0;
      acc.push(prev + (Number(b.profit) || 0));
      return acc;
    }, []);

  return { profit, mise, roi, gagnes, perdus, winRate, betCount: regles.length, distribution, courbe };
}

function chargerLogo() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logo192.png';
  });
}

function fmtMontant(v, hideAmounts) {
  if (hideAmounts) return '•••••';
  return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function dessinerFond(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#141414');
  grad.addColorStop(1, '#070707');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.82, H * 0.08, 0, W * 0.82, H * 0.08, 560);
  glow.addColorStop(0, 'rgba(249,115,22,0.16)');
  glow.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function dessinerPied(ctx, t) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '600 26px Inter, -apple-system, sans-serif';
  ctx.fillText('betrics.ca', W / 2, H - 110);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font = '500 22px Inter, -apple-system, sans-serif';
  ctx.fillText(t('share_footer_responsible'), W / 2, H - 70);
}

function dessinerCourbe(ctx, courbe, couleur, x, y, largeur, hauteur) {
  if (courbe.length < 2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(x, y + hauteur / 2);
    ctx.lineTo(x + largeur, y + hauteur / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  const maxV = Math.max(...courbe, 1);
  const minV = Math.min(...courbe, 0);
  const range = (maxV - minV) || 1;
  const pts = courbe.map((v, i) => ({
    x: x + (i / (courbe.length - 1)) * largeur,
    y: y + hauteur - ((v - minV) / range) * hauteur,
  }));

  const aire = new Path2D();
  aire.moveTo(pts[0].x, y + hauteur);
  pts.forEach(p => aire.lineTo(p.x, p.y));
  aire.lineTo(pts[pts.length - 1].x, y + hauteur);
  aire.closePath();
  const gradAire = ctx.createLinearGradient(0, y, 0, y + hauteur);
  gradAire.addColorStop(0, couleur + '33');
  gradAire.addColorStop(1, couleur + '00');
  ctx.fillStyle = gradAire;
  ctx.fill(aire);

  ctx.strokeStyle = couleur;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

function dessinerJaugeDemiCercle(ctx, distribution, cx, cy, rayon, t) {
  const epaisseur = 46;
  ctx.lineCap = 'butt';
  if (distribution.length === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = epaisseur;
    ctx.beginPath();
    ctx.arc(cx, cy, rayon, Math.PI, 2 * Math.PI);
    ctx.stroke();
    return;
  }
  let angle = Math.PI;
  distribution.forEach((seg, i) => {
    const portion = (seg.pct / 100) * Math.PI;
    ctx.strokeStyle = COULEURS_TYPE[i % COULEURS_TYPE.length];
    ctx.lineWidth = epaisseur;
    ctx.beginPath();
    ctx.arc(cx, cy, rayon, angle, angle + portion);
    ctx.stroke();
    angle += portion;
  });
}

// Modele 1 "Performance" : logo, bankroll (ou points si masque), variation + ROI periode,
// mini-courbe de profit cumule.
function dessinerModelePerformance(ctx, { logoImg, bankroll, stats, periode, hideAmounts, hausse, couleur, t }) {
  dessinerFond(ctx);
  if (logoImg) {
    const taille = 150;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(W / 2 - taille / 2, 150, taille, taille, 34) : ctx.rect(W / 2 - taille / 2, 150, taille, taille);
    ctx.clip();
    ctx.drawImage(logoImg, W / 2 - taille / 2, 150, taille, taille);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '700 30px Inter, -apple-system, sans-serif';
  ctx.fillText(t('home_bankroll').toUpperCase(), W / 2, 420);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 110px Inter, -apple-system, sans-serif';
  ctx.fillText(hideAmounts ? '•••••' : `$${bankroll.toFixed(2)}`, W / 2, 530);

  const suffixe = t(`home_chart_period_${periode}`);
  const texteVariation = hideAmounts
    ? `${fmtPct(stats.roi)} ${t('perf_roi')} · ${suffixe}`
    : `${fmtMontant(stats.profit, false)} (${fmtPct(stats.roi)} ${t('perf_roi')}) · ${suffixe}`;
  ctx.fillStyle = couleur;
  ctx.font = '700 44px Inter, -apple-system, sans-serif';
  ctx.fillText(texteVariation, W / 2, 610);

  dessinerCourbe(ctx, stats.courbe, couleur, 110, 760, W - 220, 420);

  dessinerPied(ctx, t);
}

// Modele 2 "Resume" : ROI, taux de reussite (W-L), nombre de paris, meilleur type de pari,
// jauge en demi-cercle de la repartition des paris par type.
function dessinerModeleResume(ctx, { logoImg, stats, periode, hideAmounts, couleur, t }) {
  dessinerFond(ctx);
  if (logoImg) {
    const taille = 96;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(W / 2 - taille / 2, 110, taille, taille, 22) : ctx.rect(W / 2 - taille / 2, 110, taille, taille);
    ctx.clip();
    ctx.drawImage(logoImg, W / 2 - taille / 2, 110, taille, taille);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '700 28px Inter, -apple-system, sans-serif';
  ctx.fillText(t(`home_chart_period_${periode}`).toUpperCase(), W / 2, 290);

  ctx.fillStyle = couleur;
  ctx.font = '900 150px Inter, -apple-system, sans-serif';
  ctx.fillText(fmtPct(stats.roi), W / 2, 460);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '700 32px Inter, -apple-system, sans-serif';
  ctx.fillText(t('perf_roi'), W / 2, 505);

  const cx = W / 2, cy = 900, rayon = 300;
  dessinerJaugeDemiCercle(ctx, stats.distribution, cx, cy, rayon, t);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 70px Inter, -apple-system, sans-serif';
  ctx.fillText(`${stats.winRate.toFixed(0)}%`, cx, cy - 20);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 30px Inter, -apple-system, sans-serif';
  ctx.fillText(`${t('home_stat_win_rate')} · ${stats.gagnes}-${stats.perdus}`, cx, cy + 30);

  const ligneY = 1320;
  const colonnes = [
    [String(stats.betCount), t('share_bet_count')],
    [stats.distribution[0] ? labelTypePari(stats.distribution[0].type, t) : '—', t('share_best_type')],
  ];
  const largeurCol = (W - 220) / colonnes.length;
  colonnes.forEach(([valeur, label], i) => {
    const x = 110 + largeurCol * i + largeurCol / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 56px Inter, -apple-system, sans-serif';
    ctx.fillText(valeur, x, ligneY);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '600 28px Inter, -apple-system, sans-serif';
    ctx.fillText(label, x, ligneY + 44);
  });

  dessinerPied(ctx, t);
}

function IconShare({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function IconEyeMini({ color = 'currentColor', size = 18, off }) {
  return off ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c6.5 0 10.5 7 10.5 7a18 18 0 0 1-3.1 3.9" />
      <path d="M6.1 6.1C3.2 8 1.5 11 1.5 11s4 7 10.5 7a10.4 10.4 0 0 0 4.1-.84" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ShareStatsButton({ t, lang, bets, bankroll }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button onClick={() => setOuvert(true)} aria-label={t('share_button_aria')} title={t('share_button_aria')}
        style={{ width: '32px', height: '32px', minHeight: '32px', borderRadius: '50%', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-111)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconShare color="var(--c-888)" size={16} />
      </button>
      {ouvert && <ShareStatsSheet t={t} lang={lang} bets={bets} bankroll={bankroll} onClose={() => setOuvert(false)} />}
    </>
  );
}

export function ShareStatsSheet({ t, lang, bets, bankroll, hideAmountsInitial = false, onClose }) {
  const isMobile = useIsMobile();
  const [hideAmounts, setHideAmounts] = useState(hideAmountsInitial);
  const [periode, setPeriode] = useState('3m');
  const [modele, setModele] = useState(0);
  const [logoImg, setLogoImg] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => { chargerLogo().then(setLogoImg); }, []);

  const stats = useMemo(() => calculerStats(bets, periode), [bets, periode]);
  const hausse = stats.profit >= 0;
  const couleur = hausse ? '#22c55e' : '#ef4444';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // jsdom (tests) n'implemente pas le contexte 2D canvas -- ctx est null, on saute simplement
    // le dessin (le composant reste testable sans mocker canvas pour chaque test).
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const dessiner = () => {
      if (modele === 0) dessinerModelePerformance(ctx, { logoImg, bankroll: bankroll || 0, stats, periode, hideAmounts, hausse, couleur, t });
      else dessinerModeleResume(ctx, { logoImg, stats, periode, hideAmounts, couleur, t });
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(dessiner).catch(dessiner);
    } else {
      dessiner();
    }
  }, [modele, stats, hideAmounts, periode, logoImg, bankroll, couleur, hausse, t]);

  function telechargerBlob(blob) {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'betrics-stats.png';
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  function partager() {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.toBlob !== 'function') return;
    canvas.toBlob(async blob => {
      if (!blob) return;
      let peutPartager = false;
      let file = null;
      try {
        file = new File([blob], 'betrics-stats.png', { type: 'image/png' });
        peutPartager = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      } catch { peutPartager = false; }
      if (peutPartager) {
        try { await navigator.share({ files: [file], title: 'Betrics' }); return; } catch { return; }
      }
      telechargerBlob(blob);
    }, 'image/png');
  }

  const modeles = [
    { label: t('share_template_performance') },
    { label: t('share_template_summary') },
  ];

  const periodesRow = (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
      {PERIODES_PARTAGE.map(p => (
        <button key={p} onClick={() => setPeriode(p)}
          style={{ padding: '6px 14px', minHeight: '32px', boxSizing: 'border-box', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: periode === p ? '#f97316' : 'var(--c-1a1a1a)', color: periode === p ? 'white' : 'var(--c-888)', fontSize: '12px', fontWeight: '700' }}>
          {t(`home_chart_period_${p}`)}
        </button>
      ))}
    </div>
  );

  const canvasEl = (
    <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', maxWidth: '280px', height: 'auto', display: 'block', margin: '0 auto', borderRadius: '18px', border: '1px solid var(--c-1a1a1a)' }} />
  );

  const carousel = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '14px 0 6px' }}>
      {modeles.map((m, i) => (
        <button key={i} onClick={() => setModele(i)} aria-label={m.label} aria-current={modele === i}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          <span style={{ fontSize: '11px', fontWeight: modele === i ? '800' : '500', color: modele === i ? 'var(--c-white)' : 'var(--c-666)' }}>{m.label}</span>
          <span style={{ width: modele === i ? '18px' : '7px', height: '7px', borderRadius: '4px', backgroundColor: modele === i ? '#f97316' : 'var(--c-333)', transition: 'all 0.2s' }} />
        </button>
      ))}
    </div>
  );

  const boutonAction = (
    <button onClick={partager} style={{ width: '100%', marginTop: '10px', padding: '15px', minHeight: '48px', boxSizing: 'border-box', borderRadius: '12px', border: 'none', backgroundColor: '#0a0a0a', color: 'white', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <IconShare color="white" size={16} />
      {isMobile ? t('share_cta_share') : t('share_cta_download')}
    </button>
  );

  const boutonOeil = (
    <button onClick={() => setHideAmounts(h => !h)} aria-label={t(hideAmounts ? 'home_show_amounts' : 'home_hide_amounts')}
      style={{ width: '36px', height: '36px', minHeight: '36px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconEyeMini color="var(--c-888)" off={hideAmounts} />
    </button>
  );

  // Feuille du bas (portail document.body, voir BottomSheet.js) sur mobile -- JAMAIS un enfant
  // DOM imbrique dans l'en-tete ou le bloc Bankroll qui a ouvert le bouton de partage.
  if (isMobile) {
    return (
      <BottomSheet onClose={onClose} ariaLabel={t('share_title')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--c-white)' }}>{t('share_title')}</span>
          {boutonOeil}
        </div>
        {periodesRow}
        {canvasEl}
        {carousel}
        {boutonAction}
      </BottomSheet>
    );
  }

  // Desktop : modale centree (pas une feuille du bas), mais toujours portee vers document.body
  // par coherence/securite (meme raisonnement que BottomSheet : jamais prisonniere d'un ancetre
  // position:sticky/filter/overflow qui casserait position:fixed).
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto',
        backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '18px', padding: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--c-white)' }}>{t('share_title')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {boutonOeil}
            <button onClick={onClose} aria-label={t('favoris_retour')} style={{ width: '36px', height: '36px', minHeight: '36px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'none', color: 'var(--c-888)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        </div>
        {periodesRow}
        {canvasEl}
        {carousel}
        {boutonAction}
      </div>
    </div>,
    document.body
  );
}
