import React from 'react';
import { getT } from './i18n';
import { Reveal } from './PublicShared';
import LandingPlayerPropCard from './LandingPlayerPropCard';
import LandingBankrollCard from './LandingBankrollCard';
import LandingOddsCard from './LandingOddsCard';

// ===================== Section "Fonctions" de l'accueil (sous le hero V2) =====================
// Structure/ergonomie proches de la section "The tools" de propsmadness.com (3 blocs qui
// alternent texte/carte), identite 100% Betrics -- aucun texte/image copie. Derriere
// src/landingConfig.js:LANDING_V2_ENABLED (meme drapeau que le hero, voir src/Landing.js) : ce
// fichier n'est jamais rendu quand ce drapeau est a `false`. id="fonctions" = cible du bouton
// "Voir comment ça marche" du hero (src/LandingHeroV2.js).

function SectionDivider({ label }) {
  return (
    <div className="landing2-divider">
      <span className="landing2-divider-label">{label}</span>
    </div>
  );
}

function FeatureBlock({ reverse, eyebrow, title, desc, children }) {
  return (
    <Reveal as="section" className={`landing2-feature-block landing2-feature-reveal ${reverse ? 'landing2-feature-reverse' : ''}`}>
      <div className="landing2-feature-inner">
        <div className="landing2-feature-copy">
          <div className="ws-kicker">{eyebrow}</div>
          <h2 className="landing2-feature-title">{title}</h2>
          <p className="ws-alt-desc">{desc}</p>
        </div>
        <div className="landing2-feature-card-wrap">
          {children}
        </div>
      </div>
    </Reveal>
  );
}

export default function LandingFeaturesV2({ lang, onOpenAuth }) {
  const t = getT(lang);

  return (
    <div className="landing2-features" id="fonctions">
      <div className="ws-container">
        <SectionDivider label={t('landing2_features_eyebrow')} />
      </div>

      <div className="ws-container">
        <FeatureBlock
          eyebrow={t('landing2_feat1_eyebrow')}
          title={t('landing2_feat1_title')}
          desc={t('landing2_feat1_desc')}
        >
          <LandingPlayerPropCard t={t} />
        </FeatureBlock>

        <FeatureBlock
          reverse
          eyebrow={t('landing2_feat2_eyebrow')}
          title={t('landing2_feat2_title')}
          desc={t('landing2_feat2_desc')}
        >
          <LandingBankrollCard t={t} />
        </FeatureBlock>

        <FeatureBlock
          eyebrow={t('landing2_feat3_eyebrow')}
          title={t('landing2_feat3_title')}
          desc={t('landing2_feat3_desc')}
        >
          <LandingOddsCard t={t} />
        </FeatureBlock>
      </div>

      <div className="ws-container">
        <SectionDivider label={t('landing2_cta_divider_label')} />
        <Reveal className="landing2-features-cta landing2-feature-reveal">
          <button type="button" className="ws-btn ws-btn-primary ws-btn-lg" onClick={() => onOpenAuth('signup')}>{t('nav_signup')}</button>
          <button type="button" className="ws-btn ws-btn-ghost ws-btn-lg" onClick={() => onOpenAuth('login')}>{t('nav_signin')}</button>
        </Reveal>
      </div>
    </div>
  );
}
