import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getT } from './i18n';
import { TOOL_GROUPS } from './toolsConfig';
import { scrollToId } from './PublicShared';

// ===================== Barre de navigation publique (sobre, consistante sur toutes les pages) =====================
// Logo a gauche, Outils (mega menu), Pool, Tarifs, Ressources (menu simple) ; a droite FR/EN,
// Se connecter, Commencer. Volontairement TOUJOURS claire (meme sur la page Pool au theme
// sombre) : le contraste voulu par la page Pool vient du CONTENU en dessous, la navigation
// reste un repere visuel stable et familier d'une page a l'autre.

function goToTarget(target, navigate) {
  if (target.type === 'anchor') {
    navigate('/');
    // Laisse le temps au DOM de la page d'accueil de se monter avant de defiler vers l'ancre.
    setTimeout(() => scrollToId(target.id), 80);
  } else {
    navigate(target.path);
  }
}

function MegaMenu({ lang, navigate, onNavigate }) {
  const t = getT(lang);
  return (
    <div className="ws-megamenu-panel" role="menu" aria-label={t('nav_tools')}>
      <div className="ws-container ws-megamenu-grid">
        {TOOL_GROUPS.map(group => (
          <div className="ws-megamenu-group" key={group.id}>
            <div className="ws-megamenu-group-title">{t(group.titleKey)}</div>
            {group.items.map(item => (
              <button
                type="button"
                key={item.id}
                role="menuitem"
                className="ws-megamenu-item"
                onClick={() => { goToTarget(item.target, navigate); onNavigate(); }}
              >
                <span className="ws-megamenu-item-title">
                  {t(item.titleKey)}
                  {item.status === 'soon' && <span className="ws-soon-tag">{t('tools_soon_tag')}</span>}
                </span>
                <span className="ws-megamenu-item-desc">{t(item.descKey)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourcesMenu({ lang, navigate, onNavigate }) {
  const t = getT(lang);
  return (
    <div className="ws-resources-panel" role="menu" aria-label={t('nav_resources')}>
      <button type="button" role="menuitem" className="ws-resources-item" onClick={() => { navigate('/guide'); onNavigate(); }}>
        {t('nav_resources_guide')}
      </button>
      <button type="button" role="menuitem" className="ws-resources-item" onClick={() => { goToTarget({ type: 'anchor', id: 'faq' }, navigate); onNavigate(); }}>
        {t('nav_resources_faq')}
      </button>
      <a role="menuitem" className="ws-resources-item" href="mailto:contact@betrics.ca" onClick={onNavigate}>
        {t('nav_resources_contact')}
      </a>
    </div>
  );
}

function MobileMenu({ lang, setLang, navigate, onOpenAuth, onClose }) {
  const t = getT(lang);
  const [openGroup, setOpenGroup] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function go(target) { goToTarget(target, navigate); onClose(); }

  // Portail vers document.body : .ws-navbar utilise backdrop-filter (voir index.css), qui cree
  // un bloc englobant pour les descendants position:fixed -- sans portail, inset:0 se
  // resoudrait contre la hauteur de la barre (72px) plutot que le viewport entier.
  return createPortal((
    <div className="ws-mobile-menu" role="dialog" aria-modal="true" aria-label={t('nav_open_menu')} ref={panelRef}>
      <div className="ws-mobile-menu-top">
        <span className="ws-brand">Betrics</span>
        <button type="button" className="ws-mobile-close" onClick={onClose} aria-label={t('nav_close_menu')}>×</button>
      </div>

      <div className="ws-mobile-menu-body">
        {TOOL_GROUPS.map(group => (
          <div className="ws-mobile-accordion" key={group.id}>
            <button
              type="button"
              className="ws-mobile-accordion-trigger"
              aria-expanded={openGroup === group.id}
              onClick={() => setOpenGroup(prev => (prev === group.id ? null : group.id))}
            >
              <span>{t(group.titleKey)}</span>
              <span aria-hidden="true">{openGroup === group.id ? '−' : '+'}</span>
            </button>
            {openGroup === group.id && (
              <div className="ws-mobile-accordion-panel">
                {group.items.map(item => (
                  <button type="button" key={item.id} className="ws-mobile-tool-link" onClick={() => go(item.target)}>
                    {t(item.titleKey)}
                    {item.status === 'soon' && <span className="ws-soon-tag">{t('tools_soon_tag')}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <button type="button" className="ws-mobile-top-link" onClick={() => go({ type: 'path', path: '/pool' })}>{t('nav_pool')}</button>
        <button type="button" className="ws-mobile-top-link" onClick={() => go({ type: 'path', path: '/tarifs' })}>{t('nav_pricing')}</button>
        <button type="button" className="ws-mobile-top-link" onClick={() => go({ type: 'path', path: '/guide' })}>{t('nav_resources_guide')}</button>
        <button type="button" className="ws-mobile-top-link" onClick={() => go({ type: 'anchor', id: 'faq' })}>{t('nav_resources_faq')}</button>
      </div>

      <div className="ws-mobile-menu-footer">
        <div className="ws-lang-switch" role="group" aria-label="Langue / Language">
          {['fr', 'en'].map(l => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button type="button" className="ws-btn ws-btn-ghost" onClick={() => { onOpenAuth('login'); onClose(); }}>{t('nav_signin')}</button>
        <button type="button" className="ws-btn ws-btn-primary" onClick={() => { onOpenAuth('signup'); onClose(); }}>{t('nav_signup')}</button>
      </div>
    </div>
  ), document.body);
}

export default function Navbar({ lang, setLang, navigate, onOpenAuth }) {
  const t = getT(lang);
  const [openPanel, setOpenPanel] = useState(null); // null | 'tools' | 'resources'
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === 'Escape') setOpenPanel(null); }
    function onClickOutside(e) { if (navRef.current && !navRef.current.contains(e.target)) setOpenPanel(null); }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  return (
    <header className="ws-navbar" ref={navRef}>
      <div className="ws-container ws-navbar-inner">
        <div className="ws-navbar-left">
          <button type="button" className="ws-brand" onClick={() => navigate('/')}>Betrics</button>
          <nav className="ws-navbar-links" aria-label={t('nav_main_label')}>
            <button type="button" aria-expanded={openPanel === 'tools'} onClick={() => setOpenPanel(p => (p === 'tools' ? null : 'tools'))}>
              {t('nav_tools')}
            </button>
            <button type="button" onClick={() => { navigate('/pool'); setOpenPanel(null); }}>{t('nav_pool')}</button>
            <button type="button" onClick={() => { navigate('/tarifs'); setOpenPanel(null); }}>{t('nav_pricing')}</button>
            <button type="button" aria-expanded={openPanel === 'resources'} onClick={() => setOpenPanel(p => (p === 'resources' ? null : 'resources'))}>
              {t('nav_resources')}
            </button>
          </nav>
        </div>
        <div className="ws-navbar-right">
          <div className="ws-lang-switch" role="group" aria-label="Langue / Language">
            {['fr', 'en'].map(l => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button type="button" className="ws-btn ws-btn-ghost ws-hide-mobile" onClick={() => onOpenAuth('login')}>{t('nav_signin')}</button>
          <button type="button" className="ws-btn ws-btn-primary ws-hide-mobile" onClick={() => onOpenAuth('signup')}>{t('nav_signup')}</button>
          <button type="button" className="ws-hamburger" onClick={() => setMobileOpen(true)} aria-label={t('nav_open_menu')}>☰</button>
        </div>
      </div>

      {openPanel === 'tools' && <MegaMenu lang={lang} navigate={navigate} onNavigate={() => setOpenPanel(null)} />}
      {openPanel === 'resources' && <ResourcesMenu lang={lang} navigate={navigate} onNavigate={() => setOpenPanel(null)} />}
      {mobileOpen && (
        <MobileMenu lang={lang} setLang={setLang} navigate={navigate} onOpenAuth={onOpenAuth} onClose={() => setMobileOpen(false)} />
      )}
    </header>
  );
}
