import React, { useEffect, useRef, useState } from 'react';
import { getT } from './i18n';

// ===================== Landing publique (visiteur non connecte) =====================
// Remplace l'ancienne landing codee en dur dans App.js (anglais uniquement, chiffres et
// mockups fictifs). Design sombre + orange inspire des observations generiques de
// docs/landing-inspiration.md (aucun texte/code/logo copie -- uniquement des valeurs et
// idees de mise en page). Choix de design tranches : conteneur ~1240px, fond quasi noir
// (coherent avec le reste de l'app Betrics, deja sombre), accent orange existant de la
// marque utilise avec parcimonie (halo radial derriere les captures, jamais en aplat
// partout), un seul style de bouton plein (pas de capsule complete, coherent avec les
// rayons ~8-10px deja utilises ailleurs dans l'app), nav fixe opaque simple (pas de flou,
// pas de retrecissement au defilement), animations d'apparition sobres au defilement.

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function scrollToId(id) {
  const el = document.getElementById(id);
  // scrollIntoView n'existe pas dans jsdom (tests) -- jamais absent d'un vrai navigateur.
  if (!el || typeof el.scrollIntoView !== 'function') return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// ===================== Reveal : apparition sobre au defilement (une seule fois) =====================
// Respecte prefers-reduced-motion : si l'utilisateur le demande, le contenu est visible
// immediatement, sans observer ni transition. Filet de securite : un saut instantane (touche
// Fin/Debut, navigation directe vers une ancre #faq, etc.) peut faire passer un bloc devant le
// viewport sans jamais declencher l'intersection -- un minuteur de secours force la visibilite
// apres un court delai dans tous les cas, pour qu'aucun contenu ne reste invisible en
// permanence (seul l'instant de l'apparition est affecte, jamais sa presence).

function useReveal() {
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

  return { ref, className: visible ? 'landing-reveal landing-reveal-visible' : 'landing-reveal' };
}

function Reveal({ as: Tag = 'div', className, children, ...rest }) {
  const { ref, className: revealClass } = useReveal();
  return (
    <Tag ref={ref} className={[revealClass, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

// ===================== ProductShot : capture encadree (halo + ombre + rayons imbriques) =====================
// src attendu sous /public/landing/<fichier>.png (voir liste dans le resume de livraison).
// Si l'image est absente ou echoue a charger, un emplacement propre (cadre + halo, sans
// image) prend sa place -- jamais une icone cassee. anchor fait varier le coin du halo pour
// un peu de rythme visuel entre les sections, toujours dans la meme teinte (orange, seul
// accent de couleur de la marque).

function ProductShot({ src, alt, placeholderLabel, anchor = 'top-left', ratio = '16 / 10' }) {
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

// ===================== Navigation =====================

function LandingNav({ lang, setLang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <header className="landing-nav">
      <div className="landing-container landing-nav-inner">
        <div className="landing-nav-left">
          <button type="button" className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}>
            Betrics
          </button>
          <nav className="landing-nav-links" aria-label="Navigation principale">
            <button type="button" onClick={() => scrollToId('fonctions')}>{t('landing_nav_features')}</button>
            <button type="button" onClick={() => scrollToId('pool')}>{t('landing_nav_pool')}</button>
            <button type="button" onClick={() => scrollToId('faq')}>{t('landing_nav_faq')}</button>
          </nav>
        </div>
        <div className="landing-nav-right">
          <div className="landing-lang-switch" role="group" aria-label="Langue / Language">
            {['fr', 'en'].map(l => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="landing-btn landing-btn-ghost" onClick={() => onOpenAuth('login')}>
            {t('landing_nav_signin')}
          </button>
          <button type="button" className="landing-btn landing-btn-primary" onClick={() => onOpenAuth('signup')}>
            {t('landing_nav_signup')}
          </button>
        </div>
      </div>
    </header>
  );
}

// ===================== Hero =====================

function LandingHero({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <section className="landing-hero">
      <div className="landing-container landing-hero-inner">
        <Reveal className="landing-hero-copy">
          <div className="landing-eyebrow">{t('landing_hero_eyebrow')}</div>
          <h1 className="landing-h1">{t('landing_hero_title')}</h1>
          <p className="landing-hero-sub">{t('landing_hero_subtitle')}</p>
          <div className="landing-hero-actions">
            <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => onOpenAuth('signup')}>
              {t('landing_hero_cta_primary')}
            </button>
            <button type="button" className="landing-btn landing-btn-ghost landing-btn-lg" onClick={() => scrollToId('fonctions')}>
              {t('landing_hero_cta_secondary')}
            </button>
          </div>
        </Reveal>
      </div>
      <Reveal className="landing-container landing-hero-shot-wrap">
        <ProductShot
          src="/landing/hero-analyse.png"
          alt={t('landing_hero_shot_alt')}
          placeholderLabel={t('landing_hero_shot_alt')}
          anchor="top-left"
          ratio="16 / 9"
        />
      </Reveal>
    </section>
  );
}

// ===================== Bande de confiance (honnete : aucun chiffre invente) =====================

function LandingTrustBar({ lang }) {
  const t = getT(lang);
  const items = [t('landing_trust_data'), t('landing_trust_free'), t('landing_trust_bilingual')];
  return (
    <div className="landing-trust-bar">
      <div className="landing-container landing-trust-inner">
        {items.map((label, i) => (
          <div className="landing-trust-item" key={i}>
            <span className="landing-trust-dot" aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== Fonctions (grille de cartes) =====================

function FeatureCard({ title, desc, bullets }) {
  return (
    <Reveal as="article" className="landing-feature-card">
      <h3 className="landing-h3">{title}</h3>
      <p className="landing-feature-desc">{desc}</p>
      <ul className="landing-feature-list">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </Reveal>
  );
}

function LandingFeatures({ lang }) {
  const t = getT(lang);
  const features = [
    { title: t('landing_feature_analyses_title'), desc: t('landing_feature_analyses_desc'), bullets: [t('landing_feature_analyses_b1'), t('landing_feature_analyses_b2'), t('landing_feature_analyses_b3')] },
    { title: t('landing_feature_pool_title'), desc: t('landing_feature_pool_desc'), bullets: [t('landing_feature_pool_b1'), t('landing_feature_pool_b2'), t('landing_feature_pool_b3')] },
    { title: t('landing_feature_bankroll_title'), desc: t('landing_feature_bankroll_desc'), bullets: [t('landing_feature_bankroll_b1'), t('landing_feature_bankroll_b2'), t('landing_feature_bankroll_b3')] },
    { title: t('landing_feature_models_title'), desc: t('landing_feature_models_desc'), bullets: [t('landing_feature_models_b1'), t('landing_feature_models_b2'), t('landing_feature_models_b3')] },
  ];
  return (
    <section id="fonctions" className="landing-section">
      <div className="landing-container">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('landing_features_title')}</h2>
          <p className="landing-section-sub">{t('landing_features_subtitle')}</p>
        </Reveal>
        <div className="landing-feature-grid">
          {features.map((f, i) => <FeatureCard key={i} {...f} />)}
        </div>
      </div>
    </section>
  );
}

// ===================== Blocs alternes image + texte =====================

function AlternatingBlock({ id, reverse, tag, title, desc, bullets, shot }) {
  return (
    <section id={id} className={`landing-section landing-alt-block ${reverse ? 'landing-alt-reverse' : ''}`}>
      <div className="landing-container landing-alt-inner">
        <Reveal className="landing-alt-copy">
          <div className="landing-tag">{tag}</div>
          <h2 className="landing-h2">{title}</h2>
          <p className="landing-alt-desc">{desc}</p>
          {bullets && (
            <ul className="landing-alt-tags">
              {bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </Reveal>
        <Reveal className="landing-alt-shot">
          <ProductShot {...shot} anchor={reverse ? 'top-left' : 'top-right'} ratio="4 / 3" />
        </Reveal>
      </div>
    </section>
  );
}

function LandingAlternating({ lang }) {
  const t = getT(lang);
  const poolTags = [1, 2, 3, 4, 5, 6, 7].map(n => t(`landing_block_pool_tag${n}`));
  return (
    <>
      <AlternatingBlock
        id="pool"
        tag={t('landing_block_pool_tag')}
        title={t('landing_block_pool_title')}
        desc={t('landing_block_pool_desc')}
        bullets={poolTags}
        shot={{ src: '/landing/pool-formation.png', alt: t('landing_block_pool_shot_alt'), placeholderLabel: t('landing_block_pool_shot_alt') }}
      />
      <AlternatingBlock
        id="analyses"
        reverse
        tag={t('landing_block_analyses_tag')}
        title={t('landing_block_analyses_title')}
        desc={t('landing_block_analyses_desc')}
        bullets={[t('landing_block_analyses_b1'), t('landing_block_analyses_b2'), t('landing_block_analyses_b3')]}
        shot={{ src: '/landing/analyses-matchup.png', alt: t('landing_block_analyses_shot_alt'), placeholderLabel: t('landing_block_analyses_shot_alt') }}
      />
      <AlternatingBlock
        id="bankroll"
        tag={t('landing_block_bankroll_tag')}
        title={t('landing_block_bankroll_title')}
        desc={t('landing_block_bankroll_desc')}
        bullets={[t('landing_block_bankroll_b1'), t('landing_block_bankroll_b2'), t('landing_block_bankroll_b3')]}
        shot={{ src: '/landing/bankroll-suivi.png', alt: t('landing_block_bankroll_shot_alt'), placeholderLabel: t('landing_block_bankroll_shot_alt') }}
      />
    </>
  );
}

// ===================== Pour commencer =====================

function LandingStart({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <section className="landing-section landing-section-alt">
      <div className="landing-container">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('landing_start_title')}</h2>
          <p className="landing-section-sub">{t('landing_start_subtitle')}</p>
        </Reveal>
        <div className="landing-start-grid">
          <Reveal as="article" className="landing-start-card">
            <h3 className="landing-h3">{t('landing_start_account_title')}</h3>
            <p className="landing-feature-desc">{t('landing_start_account_desc')}</p>
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => onOpenAuth('signup')}>
              {t('landing_start_account_cta')}
            </button>
          </Reveal>
          <Reveal as="article" className="landing-start-card">
            <h3 className="landing-h3">{t('landing_start_pool_title')}</h3>
            <p className="landing-feature-desc">{t('landing_start_pool_desc')}</p>
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => onOpenAuth('signup')}>
              {t('landing_start_pool_cta')}
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ===================== Bientot (aucun prix, clairement marque "a venir") =====================

function LandingSoon({ lang }) {
  const t = getT(lang);
  const items = [
    { title: t('landing_soon_odds_title'), desc: t('landing_soon_odds_desc') },
    { title: t('landing_soon_ev_title'), desc: t('landing_soon_ev_desc') },
  ];
  return (
    <section className="landing-section">
      <div className="landing-container">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('landing_soon_title')}</h2>
          <p className="landing-section-sub">{t('landing_soon_subtitle')}</p>
        </Reveal>
        <div className="landing-soon-grid">
          {items.map((item, i) => (
            <Reveal as="article" className="landing-soon-card" key={i}>
              <span className="landing-soon-badge">{t('landing_soon_badge')}</span>
              <h3 className="landing-h3">{item.title}</h3>
              <p className="landing-feature-desc">{item.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== FAQ (accordeon accessible) =====================

function FaqItem({ id, question, answer, open, onToggle }) {
  const panelId = `${id}-panel`;
  return (
    <div className="landing-faq-item">
      <button
        type="button"
        className="landing-faq-question"
        aria-expanded={open}
        aria-controls={panelId}
        id={`${id}-button`}
        onClick={onToggle}
      >
        <span>{question}</span>
        <span className="landing-faq-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div id={panelId} role="region" aria-labelledby={`${id}-button`} className="landing-faq-answer" hidden={!open}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

function LandingFaq({ lang }) {
  const t = getT(lang);
  const items = [1, 2, 3, 4, 5, 6].map(n => ({ id: `faq-${n}`, q: t(`landing_faq_q${n}`), a: t(`landing_faq_a${n}`) }));
  const [openId, setOpenId] = useState(items[0].id);

  return (
    <section id="faq" className="landing-section landing-section-alt">
      <div className="landing-container landing-faq-wrap">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('landing_faq_title')}</h2>
        </Reveal>
        <Reveal className="landing-faq-list">
          {items.map(item => (
            <FaqItem
              key={item.id}
              id={item.id}
              question={item.q}
              answer={item.a}
              open={openId === item.id}
              onToggle={() => setOpenId(prev => (prev === item.id ? null : item.id))}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ===================== Appel a l'action final =====================

function LandingFinalCta({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <section className="landing-section landing-final-cta">
      <div className="landing-container">
        <Reveal className="landing-final-inner">
          <h2 className="landing-h2">{t('landing_final_title')}</h2>
          <p className="landing-section-sub">{t('landing_final_subtitle')}</p>
          <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => onOpenAuth('signup')}>
            {t('landing_final_cta')}
          </button>
        </Reveal>
      </div>
    </section>
  );
}

// ===================== Pied de page (jeu responsable + liens legaux) =====================

function LandingFooter({ lang, onOpenLegal }) {
  const t = getT(lang);
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-responsible">
          <p>{t('landing_footer_disclaimer')}</p>
          <p>{t('landing_footer_age')}</p>
          <p>
            {t('landing_footer_help_intro')}{' '}
            <strong>{t('landing_footer_help_name')}</strong> — {t('landing_footer_help_contact')}
          </p>
        </div>
        <div className="landing-footer-bottom">
          <div className="landing-footer-brand">
            <div className="landing-brand-static">Betrics</div>
            <div className="landing-footer-tagline">{t('landing_footer_tagline')}</div>
          </div>
          <div className="landing-footer-links">
            <button type="button" onClick={() => onOpenLegal('terms')}>{t('landing_footer_legal_terms')}</button>
            <button type="button" onClick={() => onOpenLegal('privacy')}>{t('landing_footer_legal_privacy')}</button>
            <a href="mailto:contact@betrics.app">{t('landing_footer_contact')}</a>
          </div>
          <div className="landing-footer-copyright">{t('landing_footer_copyright')}</div>
        </div>
      </div>
    </footer>
  );
}

// ===================== Pages legales simples (pas de contenu juridique invente) =====================

function LegalPage({ lang, page, onBack }) {
  const t = getT(lang);
  const title = page === 'terms' ? t('landing_legal_terms_title') : t('landing_legal_privacy_title');
  const body = page === 'terms' ? t('landing_legal_terms_body') : t('landing_legal_privacy_body');
  return (
    <div className="landing-root">
      <div className="landing-legal-page landing-container">
        <button type="button" className="landing-btn landing-btn-ghost" onClick={onBack}>{t('landing_legal_back')}</button>
        <h1 className="landing-h2" style={{ marginTop: '24px' }}>{title}</h1>
        <p className="landing-legal-body">{body}</p>
      </div>
    </div>
  );
}

// ===================== Composant principal =====================
// onOpenAuth(mode) : 'login' | 'signup' -- l'ecran de connexion/inscription lui-meme
// (src/Auth.js) n'est pas touche, seul le mode initial est transmis par le parent (App.js).

export default function Landing({ lang, setLang, onOpenAuth }) {
  const [legalPage, setLegalPage] = useState(null);

  if (legalPage) {
    return <LegalPage lang={lang} page={legalPage} onBack={() => setLegalPage(null)} />;
  }

  return (
    <div className="landing-root">
      <LandingNav lang={lang} setLang={setLang} onOpenAuth={onOpenAuth} />
      <LandingHero lang={lang} onOpenAuth={onOpenAuth} />
      <LandingTrustBar lang={lang} />
      <LandingFeatures lang={lang} />
      <LandingAlternating lang={lang} />
      <LandingStart lang={lang} onOpenAuth={onOpenAuth} />
      <LandingSoon lang={lang} />
      <LandingFaq lang={lang} />
      <LandingFinalCta lang={lang} onOpenAuth={onOpenAuth} />
      <LandingFooter lang={lang} onOpenLegal={setLegalPage} />
    </div>
  );
}
