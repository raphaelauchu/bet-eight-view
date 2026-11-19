import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from './useIsMobile';
import { BottomSheet } from './BottomSheet';

// Composant de filtre/selecteur reutilisable, style Wealthsimple : bouton pilule (bordure fine,
// fond sombre legerement releve, texte gras moyen, chevron fin) + menu flottant arrondi au clic
// (bouton radio a droite de l'option active) sur desktop/tablette, feuille du bas plein ecran sur
// mobile (<768px, meme seuil que useIsMobile partout ailleurs dans l'app). Remplace les <select>
// natifs et les DropdownFlottant locaux (ex-PerformanceInsights.js) -- UN SEUL visuel pour tous
// les filtres/periodes de l'app (Aperçu de la performance, Recherche, comparateur de cotes, etc.).
//
// API : soit `options` (liste plate [{value,label}]), soit `groups` ([{titre?, options}]) pour
// des sections avec en-tete (ex. "Bookmaker"/"Sport"/"Type de pari" dans Aperçu de la performance).

function IconChevronDown({ color = 'currentColor', size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RadioPuce({ actif }) {
  return (
    <span className={`ddp-radio${actif ? ' ddp-radio-actif' : ''}`}><span /></span>
  );
}

export function DropdownPill({
  label,
  ariaLabel,
  groups,
  options,
  value,
  onChange,
  align = 'left', // 'left' | 'right' : cote d'ancrage du panneau flottant (desktop uniquement)
  fullWidth = false,
  disabled = false,
}) {
  const isMobile = useIsMobile();
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(-1);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const groupesResolus = groups || (options ? [{ options }] : []);
  const optionsAplaties = groupesResolus.flatMap(g => g.options);
  const optionActive = optionsAplaties.find(o => o.value === value);

  useEffect(() => {
    // Mobile : la feuille du bas (BottomSheet, portail) gere deja sa propre fermeture (fond,
    // glissement, Echap, X) -- pas d'ecouteur global ici.
    if (!ouvert || isMobile) return;
    function onClicExterieur(e) {
      if (wrapRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOuvert(false);
    }
    function onEchap(e) {
      if (e.key === 'Escape') { setOuvert(false); btnRef.current?.focus(); }
    }
    document.addEventListener('mousedown', onClicExterieur);
    document.addEventListener('keydown', onEchap);
    return () => {
      document.removeEventListener('mousedown', onClicExterieur);
      document.removeEventListener('keydown', onEchap);
    };
  }, [ouvert, isMobile]);

  useEffect(() => {
    if (!ouvert) return;
    const idx = optionsAplaties.findIndex(o => o.value === value);
    setIndexActif(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const el = panelRef.current?.querySelector(`[data-ddp-idx="${indexActif}"]`);
    el?.focus();
  }, [ouvert, indexActif]);

  function choisir(v) {
    onChange(v);
    setOuvert(false);
    btnRef.current?.focus();
  }

  function onBoutonKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOuvert(true);
    }
  }

  function onListeKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndexActif(i => Math.min(i + 1, optionsAplaties.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndexActif(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setIndexActif(0); }
    else if (e.key === 'End') { e.preventDefault(); setIndexActif(optionsAplaties.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = optionsAplaties[indexActif];
      if (opt) choisir(opt.value);
    } else if (e.key === 'Tab') {
      setOuvert(false);
    }
  }

  let compteur = -1;
  function rendreGroupes(classeOption) {
    return groupesResolus.map((g, gi) => (
      <div key={gi}>
        {g.titre && <div className="ddp-titre">{g.titre}</div>}
        {g.options.map(opt => {
          compteur += 1;
          const idx = compteur;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              data-ddp-idx={idx}
              tabIndex={ouvert ? (idx === indexActif ? 0 : -1) : -1}
              className={classeOption}
              onMouseEnter={() => setIndexActif(idx)}
              onClick={() => choisir(opt.value)}
              onKeyDown={onListeKeyDown}
            >
              <span>{opt.label}</span>
              <RadioPuce actif={opt.value === value} />
            </button>
          );
        })}
      </div>
    ));
  }

  return (
    <div ref={wrapRef} className="ddp-wrap" style={fullWidth ? { width: '100%' } : undefined}>
      <style>{`
        .ddp-wrap { position: relative; display: inline-block; }
        .ddp-btn {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 9px 14px; background-color: var(--c-0d0d0d); border: 1px solid var(--c-222);
          border-radius: 20px; color: var(--c-ccc); font-size: 12.5px; font-weight: 600;
          cursor: pointer; min-height: 44px; box-sizing: border-box;
        }
        .ddp-btn:hover { border-color: var(--c-333); }
        .ddp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ddp-btn span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ddp-panel {
          position: absolute; top: calc(100% + 6px); z-index: 420; min-width: 210px; max-width: 320px;
          max-height: 60vh; overflow-y: auto; background-color: var(--c-111); border: 1px solid var(--c-222);
          border-radius: 14px; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        }
        .ddp-titre { padding: 8px 10px 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--c-666); }
        .ddp-option {
          display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;
          padding: 10px 10px; background: none; border: none; border-radius: 9px; color: var(--c-ccc);
          font-size: 13px; cursor: pointer; text-align: left; min-height: 44px; box-sizing: border-box;
        }
        .ddp-option:hover, .ddp-option:focus-visible { background-color: var(--c-1a1a1a); outline: none; }
        .ddp-radio { width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--c-444); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ddp-radio span { width: 7px; height: 7px; border-radius: 50%; background: none; }
        .ddp-radio-actif { border-color: #f97316; }
        .ddp-radio-actif span { background-color: #f97316; }
        .ddp-option-lg { padding: 13px 12px; font-size: 14.5px; }
      `}</style>

      <button
        ref={btnRef}
        type="button"
        className="ddp-btn"
        style={fullWidth ? { width: '100%' } : undefined}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={ariaLabel || label}
        onClick={() => setOuvert(o => !o)}
        onKeyDown={onBoutonKeyDown}
      >
        <span>{optionActive ? optionActive.label : label}</span>
        <IconChevronDown color="var(--c-666)" />
      </button>

      {ouvert && !isMobile && (
        <div ref={panelRef} role="listbox" aria-label={ariaLabel || label} className="ddp-panel" style={{ ...(align === 'right' ? { right: 0 } : { left: 0 }), ...(fullWidth ? { width: '100%' } : {}) }}>
          {rendreGroupes('ddp-option')}
        </div>
      )}

      {ouvert && isMobile && (
        <BottomSheet onClose={() => setOuvert(false)} title={label} ariaLabel={ariaLabel || label}>
          <div ref={panelRef} role="listbox" aria-label={ariaLabel || label}>
            {rendreGroupes('ddp-option ddp-option-lg')}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

export default DropdownPill;
