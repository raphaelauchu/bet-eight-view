import React, { useEffect, useRef, useState } from 'react';

// ===================== Utilitaires partages par toutes les pages publiques =====================
// (accueil, page Pool, Tarifs, pages outils/guide) -- src/Landing.js, src/PoolShowcase.js,
// src/PricingPage.js, src/SimplePage.js, src/Navbar.js.

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  // scrollIntoView n'existe pas dans jsdom (tests) -- jamais absent d'un vrai navigateur.
  if (!el || typeof el.scrollIntoView !== 'function') return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// ===================== Reveal : apparition sobre au defilement (une seule fois) =====================
// Respecte prefers-reduced-motion. Filet de securite : un saut instantane (touche Fin/Debut,
// navigation directe vers une ancre) peut faire passer un bloc devant le viewport sans jamais
// declencher l'intersection -- un minuteur de secours force la visibilite apres un court delai
// dans tous les cas, pour qu'aucun contenu ne reste invisible en permanence.
export function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (visible || !ref.current) return;
    const node = ref.current;
    let observer;
    const fallback = setTimeout(() => setVisible(true), 2000);
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { setVisible(true); clearTimeout(fallback); observer.disconnect(); } });
      }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });
      observer.observe(node);
    }
    return () => { clearTimeout(fallback); if (observer) observer.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, className: visible ? 'ws-reveal ws-reveal-visible' : 'ws-reveal' };
}

export function Reveal({ as: Tag = 'div', className, children, ...rest }) {
  const { ref, className: revealClass } = useReveal();
  return (
    <Tag ref={ref} className={[revealClass, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

// ===================== WindowFrame : cadre sobre type fenetre de navigateur =====================
// Pour les captures du theme clair (accueil, tarifs, pages outils) -- jamais de halo ni de
// lueur colore ici (reserve au theme sombre de la page Pool, voir ProductShot ci-dessous) :
// juste une bordure fine, un angle legerement arrondi, une mini barre de titre à 3 points
// neutres, et une ombre tres discrete. src attendu sous /public/landing/<fichier> (liste dans
// le resume de livraison) -- absent ou en echec de chargement : emplacement propre a la place,
// jamais une icone cassee.
export function WindowFrame({ src, alt, placeholderLabel, ratio = '16 / 10', exampleLabel }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <div className="ws-window-frame">
      <div className="ws-window-bar">
        <span className="ws-window-dot" aria-hidden="true" />
        <span className="ws-window-dot" aria-hidden="true" />
        <span className="ws-window-dot" aria-hidden="true" />
      </div>
      <div className="ws-window-body" style={{ aspectRatio: ratio }}>
        {showImage ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            width="1600"
            height="1000"
            className="ws-window-img"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="ws-window-placeholder">
            <span className="ws-window-placeholder-icon" aria-hidden="true">▣</span>
            <span>{placeholderLabel}</span>
          </div>
        )}
        {exampleLabel && <span className="ws-window-example-tag">{exampleLabel}</span>}
      </div>
    </div>
  );
}

// ===================== ProductShot : cadre sombre avec halo (theme Pool, voir index.css .landing-*) ====
// Reprend telle quelle la technique deja construite pour l'ancienne landing sombre (halo radial
// oriente + ombre douce + rayons imbriques degressifs) -- reutilisee ici uniquement par la page
// Pool (src/PoolShowcase.js), le seul endroit public qui garde ce theme sombre/energique.
export function ProductShot({ src, alt, placeholderLabel, anchor = 'top-left', ratio = '16 / 10' }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <div className={`landing-shot-frame landing-shot-anchor-${anchor}`} style={{ aspectRatio: ratio }}>
      <div className="landing-shot-halo" aria-hidden="true" />
      <div className="landing-shot-panel">
        {showImage ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="landing-shot-img"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="landing-shot-placeholder">
            <span className="landing-shot-placeholder-icon" aria-hidden="true">▣</span>
            <span>{placeholderLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
