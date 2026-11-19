import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Feuille du bas mobile partagee, rendue via createPortal(document.body) -- JAMAIS un enfant DOM
// direct du bouton qui l'ouvre. Corrige a la racine le bug "les feuilles ne s'ouvrent pas / puis
// disparaissent" : une feuille en position:fixed imbriquee dans un ancetre position:sticky +
// backdrop-filter (ex. MobileTopBar) peut se retrouver avec un containing block/stacking context
// different du viewport selon le moteur (notamment iOS Safari, ou backdrop-filter/transform sur
// un ancetre confine les descendants position:fixed) -- la feuille se rend alors hors ecran ou
// sous d'autres elements, un appui semble ne rien faire. Un portail vers document.body echappe
// systematiquement a tout ancetre, quel qu'il soit.
//
// Fermeture : toucher le fond (backdrop), glisser vers le bas (drag tactile), bouton "X", touche
// Echap. Le fond n'est monte qu'APRES que `ouvert` devient vrai (jamais un ecouteur global
// attache pendant la capture du meme evenement d'ouverture) : le clic/toucher qui ouvre la
// feuille ne peut donc jamais la refermer aussitot.
export function BottomSheet({ onClose, title, ariaLabel, children, zIndex = 2200 }) {
  const sheetRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function onTouchStart(e) {
    startYRef.current = e.touches[0].clientY;
    draggingRef.current = true;
  }
  function onTouchMove(e) {
    if (!draggingRef.current || startYRef.current == null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  }
  function onTouchEnd() {
    if (dragY > 90) { onClose(); }
    setDragY(0);
    startYRef.current = null;
    draggingRef.current = false;
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex, display: 'flex', alignItems: 'flex-end', animation: 'bsheet-fade-in 0.15s ease' }}
      onClick={onClose}
    >
      <style>{`
        @keyframes bsheet-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bsheet-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative', width: '100%', maxHeight: '85vh', overflowY: 'auto',
          backgroundColor: 'var(--c-111)', borderRadius: '20px 20px 0 0', border: '1px solid var(--c-222)', borderBottom: 'none',
          padding: '8px 10px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box',
          transform: `translateY(${dragY}px)`,
          transition: dragY ? 'none' : 'transform 0.2s ease',
          animation: dragY ? 'none' : 'bsheet-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div style={{ width: '36px', height: '4px', borderRadius: '3px', backgroundColor: 'var(--c-333)', margin: '8px auto 10px' }} />
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', minHeight: '32px', borderRadius: '50%', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-1a1a1a)', color: 'var(--c-888)', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ✕
        </button>
        {title && <div style={{ padding: '2px 44px 12px 6px', fontSize: '14px', fontWeight: '800', color: 'var(--c-white)' }}>{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}

export default BottomSheet;
