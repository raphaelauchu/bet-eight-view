import React from 'react';
import { getT } from './i18n';
import { useIsMobile } from './useIsMobile';

// ===================== Header V2 de l'accueil public (style inspire de propsmadness.com) =====
// Structure/ergonomie proches de PropsMadness, identite 100% Betrics (logo, couleurs, police,
// textes) -- aucun texte/logo/image copie. Remplace src/Navbar.js UNIQUEMENT sur la route
// "accueil" (voir src/PublicSite.js), derriere le drapeau src/landingConfig.js:LANDING_V2_ENABLED
// -- les autres pages publiques (Pool, Tarifs, outils, guide) gardent l'ancienne Navbar complete
// (menu Outils/Pool/Tarifs/Ressources), que ce nouveau header n'a pas vocation a remplacer : il
// n'a pas de navigation de site, seulement les puces de ligue + les deux actions d'auth.
//
// Desktop/mobile geres via useIsMobile() (JS, pas seulement CSS) -- un seul jeu de boutons
// "Commencer"/"Se connecter" existe a la fois dans le DOM, jamais deux versions dupliquees et
// seulement masquees en CSS (qui genererait une ambiguite au clic comme aux tests).
export default function LandingHeaderV2({ lang, onOpenAuth }) {
  const t = getT(lang);
  const isMobile = useIsMobile();

  const liguePills = (
    <div className="landing2-league-pills">
      <span className="landing2-league-pill landing2-league-pill-active">{t('landing2_league_nhl')}</span>
      <span className="landing2-league-pill landing2-league-pill-soon" aria-disabled="true">
        {t('landing2_league_nfl')}
        <span className="ws-soon-tag">{t('tools_soon_tag')}</span>
      </span>
    </div>
  );

  const logo = (
    <div className="landing2-header-logo">
      <img src="/logo192.png" alt="Betrics" width="28" height="28" />
      <span>Betrics</span>
    </div>
  );

  if (isMobile) {
    return (
      <header className="landing2-header-wrap">
        <div className="landing2-header landing2-header-mobile">
          {logo}
          <div className="landing2-header-mobile-actions">
            <button type="button" className="landing2-link" onClick={() => onOpenAuth('login')}>{t('nav_signin')}</button>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => onOpenAuth('signup')}>{t('nav_signup')}</button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="landing2-header-wrap">
      <div className="landing2-header">
        {liguePills}
        {logo}
        <div className="landing2-header-actions">
          <button type="button" className="ws-btn ws-btn-ghost" onClick={() => onOpenAuth('login')}>{t('nav_signin')}</button>
          <button type="button" className="ws-btn ws-btn-primary" onClick={() => onOpenAuth('signup')}>{t('nav_signup')}</button>
        </div>
      </div>
    </header>
  );
}
