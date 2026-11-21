import { useState, useEffect } from 'react';

// Seuil mobile unique (<768px) partage par toute l'app (nav, DropdownPill, Analyses, Home...).
// Extrait dans son propre module (plutot que defini dans src/Analyses.js comme avant) pour que
// src/DropdownPill.js puisse l'utiliser sans creer de dependance circulaire avec Analyses.js
// (qui importe lui-meme DropdownPill pour ses filtres).
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isMobile;
}

// >= 1200px ("web" dans la grille responsive de l'accueil) : voir Analyses.js pour le detail de
// son usage (choix sidebar compacte vs large).
export function useIsDesktopWide() {
  const [isDesktopWide, setIsDesktopWide] = useState(window.innerWidth >= 1200);
  useEffect(() => {
    const handle = () => setIsDesktopWide(window.innerWidth >= 1200);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isDesktopWide;
}

// Seuil de largeur generique (meme pattern que useIsMobile/useIsDesktopWide ci-dessus) pour les
// pages qui ont besoin d'un point de bascule different du seuil mobile standard (768px) --
// ex. src/Bankroll.js:AccountDetail, dont la grille 2 colonnes n'a assez de place qu'a partir de
// 1024px (iPad portrait reste donc en une seule colonne pour cette page precise).
export function useMinWidth(px) {
  const [ok, setOk] = useState(window.innerWidth >= px);
  useEffect(() => {
    const handle = () => setOk(window.innerWidth >= px);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [px]);
  return ok;
}
