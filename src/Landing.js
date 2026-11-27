import React, { useState } from 'react';
import { getT } from './i18n';
import { Reveal, WindowFrame, scrollToId } from './PublicShared';
import LandingHeroV2 from './LandingHeroV2';
import { LANDING_V2_ENABLED } from './landingConfig';

// ===================== Accueil public (visiteur non connecte) =====================
// Direction visuelle "epure, style Wealthsimple" (voir docs/landing-inspiration.md pour les
// observations generiques qui ont nourri ce choix -- aucun texte/logo/image/mise en page
// copie) : fond creme, texte quasi noir, UNE seule couleur d'accent (orange existant de
// Betrics, utilisee avec parcimonie), titres en serif (Fraunces, voir index.css/index.html),
// corps en Inter, grand espace vertical, grille stricte, aucune rangee de cartes identiques a
// icones, aucun chiffre ni temoignage invente. La navigation et le pied de page vivent
// desormais dans leurs propres fichiers (src/Navbar.js, src/PublicFooter.js), reutilises par
// toutes les pages publiques -- ce fichier ne contient plus que le CONTENU de l'accueil.

function HomeHero({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <section className="ws-hero">
      <div className="ws-container">
        <Reveal className="ws-hero-copy">
          <div className="ws-kicker">{t('landing_hero_eyebrow')}</div>
          <h1 className="ws-h1">{t('landing_hero_title')}</h1>
          <p className="ws-hero-sub">{t('landing_hero_subtitle')}</p>
          <div className="ws-hero-actions">
            <button type="button" className="ws-btn ws-btn-primary ws-btn-lg" onClick={() => onOpenAuth('signup')}>
              {t('landing_hero_cta_primary')}
            </button>
            <button type="button" className="ws-link" onClick={() => scrollToId('analyses')}>
              {t('landing_hero_cta_secondary')} →
            </button>
          </div>
        </Reveal>
      </div>
      <Reveal className="ws-container ws-hero-shot-wrap">
        <WindowFrame
          src="/landing/hero-analyse.png"
          alt={t('landing_hero_shot_alt')}
          placeholderLabel={t('landing_hero_shot_alt')}
          exampleLabel={t('ws_example_tag')}
          ratio="16 / 9"
        />
      </Reveal>
    </section>
  );
}

function AlternatingBlock({ id, reverse, tag, title, desc, bullets, shot }) {
  return (
    <section id={id} className={`ws-section ws-alt-block ${reverse ? 'ws-alt-reverse' : ''}`}>
      <div className="ws-container ws-alt-inner">
        <Reveal className="ws-alt-copy">
          <div className="ws-kicker">{tag}</div>
          <h2 className="ws-h2">{title}</h2>
          <p className="ws-alt-desc">{desc}</p>
          {bullets && (
            <ul className="ws-alt-list">
              {bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </Reveal>
        <Reveal className="ws-alt-shot">
          <WindowFrame {...shot} ratio="4 / 3" />
        </Reveal>
      </div>
    </section>
  );
}

function HomeAlternating({ lang }) {
  const t = getT(lang);
  const poolTags = [1, 2, 3, 4, 5, 6, 7].map(n => t(`landing_block_pool_tag${n}`));
  return (
    <>
      <AlternatingBlock
        id="analyses"
        tag={t('landing_block_analyses_tag')}
        title={t('landing_block_analyses_title')}
        desc={t('landing_block_analyses_desc')}
        bullets={[t('landing_block_analyses_b1'), t('landing_block_analyses_b2'), t('landing_block_analyses_b3')]}
        shot={{ src: '/landing/analyses-matchup.png', alt: t('landing_block_analyses_shot_alt'), placeholderLabel: t('landing_block_analyses_shot_alt'), exampleLabel: t('ws_example_tag') }}
      />
      <AlternatingBlock
        id="pool-apercu"
        reverse
        tag={t('landing_block_pool_tag')}
        title={t('landing_block_pool_title')}
        desc={t('landing_block_pool_desc')}
        bullets={poolTags}
        shot={{ src: '/landing/pool-formation.png', alt: t('landing_block_pool_shot_alt'), placeholderLabel: t('landing_block_pool_shot_alt'), exampleLabel: t('ws_example_tag') }}
      />
      <AlternatingBlock
        id="bankroll"
        tag={t('landing_block_bankroll_tag')}
        title={t('landing_block_bankroll_title')}
        desc={t('landing_block_bankroll_desc')}
        bullets={[t('landing_block_bankroll_b1'), t('landing_block_bankroll_b2'), t('landing_block_bankroll_b3')]}
        shot={{ src: '/landing/bankroll-suivi.png', alt: t('landing_block_bankroll_shot_alt'), placeholderLabel: t('landing_block_bankroll_shot_alt'), exampleLabel: t('ws_example_tag') }}
      />
      <AlternatingBlock
        id="outils"
        tag={t('landing_block_tools_tag')}
        title={t('landing_block_tools_title')}
        desc={t('landing_block_tools_desc')}
        bullets={[t('landing_block_tools_b1'), t('landing_block_tools_b2'), t('landing_block_tools_b3')]}
        shot={{ src: '/landing/outils-modeles.png', alt: t('landing_block_tools_shot_alt'), placeholderLabel: t('landing_block_tools_shot_alt'), exampleLabel: t('ws_example_tag') }}
      />
    </>
  );
}

function ForWho({ lang }) {
  const t = getT(lang);
  const items = [1, 2, 3].map(n => ({ title: t(`ws_forwho_${n}_title`), desc: t(`ws_forwho_${n}_desc`) }));
  return (
    <section className="ws-section ws-section-alt">
      <div className="ws-container">
        <Reveal className="ws-section-head">
          <h2 className="ws-h2">{t('ws_forwho_title')}</h2>
          <p className="ws-body">{t('ws_forwho_sub')}</p>
        </Reveal>
        <div className="ws-forwho-grid">
          {items.map((item, i) => (
            <Reveal as="article" className="ws-forwho-item" key={i}>
              <h3 className="ws-h3">{item.title}</h3>
              <p className="ws-body" style={{ fontSize: '16px' }}>{item.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ id, question, answer, open, onToggle }) {
  const panelId = `${id}-panel`;
  return (
    <div className="ws-faq-item">
      <button type="button" className="ws-faq-question" aria-expanded={open} aria-controls={panelId} id={`${id}-button`} onClick={onToggle}>
        <span>{question}</span>
        <span className="ws-faq-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div id={panelId} role="region" aria-labelledby={`${id}-button`} className="ws-faq-answer" hidden={!open}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

function HomeFaq({ lang }) {
  const t = getT(lang);
  const items = [1, 2, 3, 4, 5, 6].map(n => ({ id: `faq-${n}`, q: t(`landing_faq_q${n}`), a: t(`landing_faq_a${n}`) }));
  const [openId, setOpenId] = useState(items[0].id);
  return (
    <section id="faq" className="ws-section">
      <div className="ws-container ws-faq-wrap">
        <Reveal className="ws-section-head">
          <h2 className="ws-h2">{t('landing_faq_title')}</h2>
        </Reveal>
        <Reveal className="ws-faq-list">
          {items.map(item => (
            <FaqItem key={item.id} id={item.id} question={item.q} answer={item.a} open={openId === item.id} onToggle={() => setOpenId(prev => (prev === item.id ? null : item.id))} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function HomeFinalCta({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <section className="ws-section ws-section-alt">
      <div className="ws-container">
        <Reveal className="ws-final-inner">
          <h2 className="ws-h2">{t('landing_final_title')}</h2>
          <p className="ws-body">{t('landing_final_subtitle')}</p>
          <button type="button" className="ws-btn ws-btn-primary ws-btn-lg" onClick={() => onOpenAuth('signup')}>
            {t('landing_final_cta')}
          </button>
        </Reveal>
      </div>
    </section>
  );
}

export function homePageMeta(lang) {
  const t = getT(lang);
  return { title: t('home_meta_title'), description: t('home_meta_description') };
}

export default function Landing({ lang, onOpenAuth }) {
  // LANDING_V2_ENABLED (src/landingConfig.js) ne porte QUE sur le hero (premier ecran) --
  // HomeAlternating/ForWho/HomeFaq/HomeFinalCta restent inchanges quel que soit ce drapeau,
  // demande explicite de la refonte ("aujourd'hui, uniquement le header et le premier ecran").
  const Hero = LANDING_V2_ENABLED ? LandingHeroV2 : HomeHero;
  return (
    <main className="ws-root">
      <Hero lang={lang} onOpenAuth={onOpenAuth} />
      <HomeAlternating lang={lang} />
      <ForWho lang={lang} />
      <HomeFaq lang={lang} />
      <HomeFinalCta lang={lang} onOpenAuth={onOpenAuth} />
    </main>
  );
}
