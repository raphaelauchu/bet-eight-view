import React from 'react';
import { getT } from './i18n';
import { Reveal, WindowFrame } from './PublicShared';

// ===================== Pages "outils" generiques + Guide (theme clair) =====================
// Une page courte par outil du mega menu qui n'a pas deja sa propre section sur l'accueil
// (Analyses et Bankroll, eux, renvoient vers une ancre de l'accueil -- voir toolsConfig.js).
// slug determine le contenu ; aucune promesse ni capture pour un outil marque "bientot".

const TOOL_CONTENT = {
  'stats-joueurs': { titleKey: 'simplepage_statsjoueurs_title', descKey: 'simplepage_statsjoueurs_desc', bodyKey: 'simplepage_statsjoueurs_body', shotAltKey: 'simplepage_statsjoueurs_shot_alt', shot: '/landing/stats-joueurs.png', status: 'available' },
  'modeles': { titleKey: 'simplepage_modeles_title', descKey: 'simplepage_modeles_desc', bodyKey: 'simplepage_modeles_body', shotAltKey: 'simplepage_modeles_shot_alt', shot: '/landing/modeles.png', status: 'available' },
  'watchlist': { titleKey: 'simplepage_watchlist_title', descKey: 'simplepage_watchlist_desc', bodyKey: 'simplepage_watchlist_body', shotAltKey: 'simplepage_watchlist_shot_alt', shot: '/landing/watchlist.png', status: 'available' },
  'comparateur-cotes': { titleKey: 'simplepage_oddscompare_title', descKey: 'simplepage_oddscompare_desc', bodyKey: 'simplepage_oddscompare_body', status: 'soon' },
  'plus-ev': { titleKey: 'simplepage_plusev_title', descKey: 'simplepage_plusev_desc', bodyKey: 'simplepage_plusev_body', status: 'soon' },
};

export function toolPageMeta(slug, lang) {
  const t = getT(lang);
  const c = TOOL_CONTENT[slug];
  if (!c) return null;
  return { title: `${t(c.titleKey)} — Betrics`, description: t(c.descKey) };
}

function ToolPage({ slug, lang, onOpenAuth }) {
  const t = getT(lang);
  const c = TOOL_CONTENT[slug];
  if (!c) return null;
  return (
    <main className="ws-root">
      <section className="ws-section ws-tool-page">
        <div className="ws-container ws-tool-inner">
          <Reveal className="ws-tool-copy">
            {c.status === 'soon' && <span className="ws-soon-tag ws-soon-tag-lg">{t('tools_soon_tag')}</span>}
            <h1 className="ws-h1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>{t(c.titleKey)}</h1>
            <p className="ws-body">{t(c.bodyKey)}</p>
            {c.status === 'soon' ? (
              <p className="ws-tool-soon-notice">{t('simplepage_soon_notice')}</p>
            ) : (
              <button type="button" className="ws-btn ws-btn-primary" onClick={() => onOpenAuth('signup')}>{t('simplepage_cta')}</button>
            )}
          </Reveal>
          {c.status !== 'soon' && (
            <Reveal className="ws-tool-shot">
              <WindowFrame src={c.shot} alt={t(c.shotAltKey)} placeholderLabel={t(c.shotAltKey)} exampleLabel={t('ws_example_tag')} ratio="4 / 3" />
            </Reveal>
          )}
        </div>
      </section>
    </main>
  );
}

// ===================== Guide =====================

export function guidePageMeta(lang) {
  const t = getT(lang);
  return { title: `${t('guide_title')} — Betrics`, description: t('guide_subtitle') };
}

function GuidePage({ lang }) {
  const t = getT(lang);
  const steps = [1, 2, 3, 4].map(n => ({ title: t(`guide_step${n}_title`), desc: t(`guide_step${n}_desc`) }));
  return (
    <main className="ws-root">
      <section className="ws-section">
        <div className="ws-container" style={{ maxWidth: '720px' }}>
          <Reveal>
            <h1 className="ws-h1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>{t('guide_title')}</h1>
            <p className="ws-body">{t('guide_subtitle')}</p>
          </Reveal>
          <ol className="ws-guide-list">
            {steps.map((s, i) => (
              <Reveal as="li" className="ws-guide-step" key={i}>
                <span className="ws-guide-step-number">{i + 1}</span>
                <div>
                  <h3 className="ws-h3">{s.title}</h3>
                  <p className="ws-body" style={{ fontSize: '16px' }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

export default function SimplePage({ slug, lang, onOpenAuth }) {
  if (slug === 'guide') return <GuidePage lang={lang} />;
  return <ToolPage slug={slug} lang={lang} onOpenAuth={onOpenAuth} />;
}
