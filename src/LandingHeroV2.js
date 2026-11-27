import React from 'react';
import { getT } from './i18n';
import { Reveal, scrollToId } from './PublicShared';
import { PLAN_FREE_FEATURES_KEYS } from './pricingConfig';
import { PhoneMockupStack } from './LandingPhoneDemo';

// ===================== Hero V2 de l'accueil public (style inspire de propsmadness.com) =====
// Structure/ergonomie proches de PropsMadness (2 colonnes, gros titre condense en majuscules,
// mockup de telephones a droite) -- identite 100% Betrics (police Anton -- voir
// src/index.js:import '@fontsource/anton/400.css' --, couleurs, textes), aucun texte/logo/image
// copie. Remplace HomeHero UNIQUEMENT (voir src/Landing.js), derriere
// src/landingConfig.js:LANDING_V2_ENABLED -- le reste de l'accueil (blocs alternes, FAQ, CTA
// finale) est inchange.
//
// Micro-texte "Gratuit pour commencer" : affiche seulement si un palier gratuit existe reellement
// dans la config de tarifs (src/pricingConfig.js:PLAN_FREE_FEATURES_KEYS, deja la source utilisee
// par src/PricingPage.js pour afficher sa colonne "Gratuit") -- jamais un chiffre invente.
export default function LandingHeroV2({ lang, onOpenAuth }) {
  const t = getT(lang);
  const aUnPalierGratuit = PLAN_FREE_FEATURES_KEYS.length > 0;

  return (
    <section className="landing2-hero">
      <div className="ws-container landing2-hero-grid">
        <div className="landing2-hero-copy">
          <span className="ws-kicker landing2-live-badge">{t('landing2_live_badge')}</span>

          <h1 className="landing2-hero-title">
            <span className="landing2-hero-title-line">{t('landing2_hero_title_line1')}</span>
            <span className="landing2-hero-title-line">{t('landing2_hero_title_line2')}</span>
            <span className="landing2-hero-title-line landing2-hero-title-accent">{t('landing2_hero_title_accent')}</span>
          </h1>

          <p className="ws-hero-sub">{t('landing2_hero_subtitle')}</p>

          <div className="ws-hero-actions">
            <button type="button" className="ws-btn ws-btn-primary ws-btn-lg" onClick={() => onOpenAuth('signup')}>
              {t('nav_signup')}
            </button>
            <button type="button" className="ws-btn ws-btn-ghost ws-btn-lg" onClick={() => scrollToId('analyses')}>
              {t('landing_hero_cta_secondary')}
            </button>
          </div>

          {aUnPalierGratuit && <p className="landing2-free-note">{t('landing2_free_tier_note')}</p>}

          <p className="landing2-responsible">
            <a href="#jeu-responsable" onClick={(e) => { e.preventDefault(); scrollToId('jeu-responsable'); }}>{t('landing2_responsible_gambling')}</a>
          </p>
        </div>

        <Reveal className="landing2-hero-visual landing-phone-reveal">
          <PhoneMockupStack t={t} />
          <p className="landing2-demo-caption">{t('landing2_demo_data_caption')}</p>
        </Reveal>
      </div>
    </section>
  );
}
