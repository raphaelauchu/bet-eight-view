import React, { useState, useEffect, useRef } from 'react';
import BetsPage from './Bets';
import Auth from './Auth';
import PublicSite from './PublicSite';
import { AnalysesFlux, RechercheOverlay, FicheJoueurStats, FicheEquipeWS, WS_THEME, useWSTheme, useIsMobile } from './Analyses';
import { PlayerHelmet } from './BrandAssets';
import { useSaisonCourante } from './season';
import ModelesFlux from './Modeles';
import PoolHub from './Pool';
import { HomeDashboard } from './Home';
import { PerformanceInsights } from './PerformanceInsights';
import { WealthsimpleChart } from './WealthsimpleChart';
import EmailOAuthCallback from './EmailOAuthCallback';
import { BOOKMAKERS_SUPPORTES } from './bookmakers';
import { PROVINCES } from './sportsbooksConfig';
import { supabase } from './supabase';
import { getT } from './i18n';
import { BottomSheet } from './BottomSheet';
import { BankrollPage } from './Bankroll';
import { OnboardingFlow, readLocalOnboardingAnswers, clearLocalOnboardingAnswers } from './Onboarding';
import { ONBOARDING_ENABLED } from './onboardingConfig';
import { ACCOUNT_KIND_OPTIONS } from './AddAccountBody';
import LegalPage, { legalPageMeta } from './LegalPage';
import { useDocumentMeta } from './useDocumentMeta';
import ProfileSetup from './ProfileSetup';
import { PROFILE_SETUP_ENABLED } from './profileConfig';

// Icones SVG (style stroke, modernes)
function IconProfile({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7" />
    </svg>
  );
}

function IconTicket({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M9 6v12" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

function IconWallet({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function IconGear({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function IconHome({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V19a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function IconBarChart({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function IconSearch({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

// Icone de Pool : etoile (ex-icone de "Modeles", desormais fusionne dans Analyses -- voir le
// controle segmente Matchs/Modeles) -- meme icone partout ou Pool apparait dans la navigation
// (sidebar desktop/iPad, bottom nav mobile).
function IconStar({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 15.1 8.9l7.05 1.02-5.1 4.97 1.2 7.02L12 18.4l-6.25 3.5 1.2-7.02-5.1-4.97 7.05-1.02Z" />
    </svg>
  );
}

function IconChevronRight({ color = 'currentColor', size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IconAppearance({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18a9 9 0 0 0 0-18Z" fill={color} stroke="none" />
    </svg>
  );
}

function IconLanguage({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18Z" />
    </svg>
  );
}

function IconLogout({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function IconShield({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3Z" />
    </svg>
  );
}

function IconExpand({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

// Bouton avatar utilisateur + popup (nom, Apparence, Langue, Parametres, Deconnexion), style
// Wealthsimple : Apparence/Langue ouvrent un sous-menu a cote (radio sur le choix actif) plutot
// que des boutons inline. Reutilise dans la sidebar desktop (popup flottant) et, en feuille du
// bas plein ecran, par la bottom nav mobile (isMobile=true -- sous-menus en accordeon tactile,
// ouverture/fermeture au toucher, pas au survol qui n'existe pas sur mobile). `extraItems`
// (optionnel) : entrees supplementaires inserees avant "Parametres" (ex. Modeles, Admin sur
// mobile, qui n'ont pas de place dans la bottom nav a 6 icones).
export function ProfileMenuButton({ utilisateur, avatarUrl, displayName, themePref, setThemePref, lang, setLang, onGoToProfile, onLogout, t, popupPosition = 'up', isMobile = false, extraItems = [], isAdmin = false, onGoToAdmin }) {
  const [ouvert, setOuvert] = useState(false);
  const [sousMenu, setSousMenu] = useState(null); // 'apparence' | 'langue' | null
  const ref = React.useRef(null);

  useEffect(() => {
    if (!ouvert || isMobile) return; // mobile : fermeture via le fond (backdrop), pas de mousedown globale
    function onClickDehors(e) { if (ref.current && !ref.current.contains(e.target)) { setOuvert(false); setSousMenu(null); } }
    document.addEventListener('mousedown', onClickDehors);
    return () => document.removeEventListener('mousedown', onClickDehors);
  }, [ouvert, isMobile]);

  function fermer() { setOuvert(false); setSousMenu(null); }

  const nomAffiche = displayName || utilisateur?.email || '?';
  const initiale = nomAffiche.charAt(0).toUpperCase();
  const itemStyle = { width: '100%', textAlign: 'left', padding: '10px 12px', backgroundColor: 'transparent', border: 'none', color: 'var(--c-white)', fontSize: '13px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', minHeight: isMobile ? '44px' : 'auto', boxSizing: 'border-box' };
  // La sidebar ancre son popup a gauche (popupPosition="up") : le sous-menu s'ouvre a droite.
  // La top bar mobile ancre le sien a droite (popupPosition="down") : le sous-menu s'ouvre a gauche pour rester a l'ecran.
  const sousMenuAGauche = popupPosition === 'down';

  function LigneSousMenu({ cle, icon, label, children }) {
    const actif = sousMenu === cle;
    if (isMobile) {
      return (
        <div>
          <button onClick={() => setSousMenu(m => (m === cle ? null : cle))} style={itemStyle}>
            {icon}
            <span style={{ flex: 1 }}>{label}</span>
            <IconChevronRight color="var(--c-666)" size={14} style={{ transform: actif ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {actif && <div style={{ paddingLeft: '30px', display: 'flex', flexDirection: 'column', gap: '2px' }}>{children}</div>}
        </div>
      );
    }
    return (
      <div style={{ position: 'relative' }}
        onMouseEnter={() => setSousMenu(cle)}
        onMouseLeave={() => setSousMenu(m => (m === cle ? null : m))}>
        <button onClick={() => setSousMenu(m => (m === cle ? null : cle))} onFocus={() => setSousMenu(cle)} style={itemStyle}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-1a1a1a)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          {icon}
          <span style={{ flex: 1 }}>{label}</span>
          <IconChevronRight color="var(--c-666)" size={14} />
        </button>
        {actif && (
          <div style={{
            position: 'absolute', top: 0, [sousMenuAGauche ? 'right' : 'left']: 'calc(100% + 6px)',
            backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '12px', padding: '6px', minWidth: '160px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 410,
          }}>
            {children}
          </div>
        )}
      </div>
    );
  }

  function OptionRadio({ actif, label, onClick }) {
    return (
      <button onClick={onClick} style={{ ...itemStyle, justifyContent: 'space-between' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-1a1a1a)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
        <span>{label}</span>
        <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${actif ? '#f97316' : 'var(--c-444)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {actif && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f97316' }} />}
        </span>
      </button>
    );
  }

  const corpsMenu = (
    <>
      <div style={{ padding: isMobile ? '6px 44px 10px 12px' : '6px 12px 10px', borderBottom: '1px solid var(--c-1e1e1e)', marginBottom: '4px' }}>
        <div style={{ color: 'var(--c-white)', fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomAffiche}</div>
        {displayName && <div style={{ color: 'var(--c-666)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{utilisateur?.email}</div>}
      </div>

      {isAdmin && (
        <>
          <button onClick={() => { onGoToAdmin(); fermer(); }} style={itemStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-1a1a1a)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <IconShield color="var(--c-888)" size={16} />
            <span>{t('menu_admin')}</span>
          </button>
          <div style={{ height: '1px', backgroundColor: 'var(--c-1e1e1e)', margin: '4px 0' }} />
        </>
      )}

      <LigneSousMenu cle="apparence" icon={<IconAppearance color="var(--c-888)" size={16} />} label={t('menu_appearance')}>
        <OptionRadio actif={themePref === 'light'} label={t('theme_light')} onClick={() => setThemePref('light')} />
        <OptionRadio actif={themePref === 'dark'} label={t('theme_dark')} onClick={() => setThemePref('dark')} />
        <OptionRadio actif={themePref === 'system'} label={t('theme_system')} onClick={() => setThemePref('system')} />
      </LigneSousMenu>

      <LigneSousMenu cle="langue" icon={<IconLanguage color="var(--c-888)" size={16} />} label={t('menu_language')}>
        <OptionRadio actif={lang === 'fr'} label={t('lang_francais')} onClick={() => setLang('fr')} />
        <OptionRadio actif={lang === 'en'} label={t('lang_english')} onClick={() => setLang('en')} />
      </LigneSousMenu>

      {extraItems.map((item, i) => (
        <button key={i} onClick={() => { item.onClick(); fermer(); }} style={itemStyle}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-1a1a1a)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}

      <button onClick={() => { onGoToProfile(); fermer(); }} style={itemStyle}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-1a1a1a)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
        <IconGear color="var(--c-888)" size={16} />
        <span>{t('menu_settings')}</span>
      </button>

      <div style={{ height: '1px', backgroundColor: 'var(--c-1e1e1e)', margin: '4px 0' }} />
      <button onClick={() => { onLogout(); fermer(); }} style={{ ...itemStyle, color: '#ef4444' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
        <IconLogout color="#ef4444" size={16} />
        <span>{t('menu_signout')}</span>
      </button>
    </>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOuvert(o => !o)} aria-label={t('menu_settings')} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontWeight: '900', fontSize: '14px', overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initiale}
      </button>

      {ouvert && isMobile && (
        <BottomSheet onClose={fermer} ariaLabel={t('menu_settings')}>
          {corpsMenu}
        </BottomSheet>
      )}

      {ouvert && !isMobile && (
        <div style={{
          position: 'absolute', [popupPosition === 'up' ? 'bottom' : 'top']: '46px',
          left: popupPosition === 'up' ? '0' : 'auto', right: popupPosition === 'up' ? 'auto' : '0',
          backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '12px', padding: '8px', minWidth: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 400,
        }}>
          {corpsMenu}
        </div>
      )}
    </div>
  );
}

// Sidebar gauche fixe (desktop/tablette >=768px), style Wealthsimple : etroite, icones
// seulement, tooltip au survol ET au focus clavier (:focus-within) a droite de l'icone active.
export const SIDEBAR_WIDTH_COMPACT = 60;

export function AppSidebar({ tabsPrincipaux, tabsSecondaires, activeId, onSelectTab, utilisateur, avatarUrl, displayName, themePref, setThemePref, lang, setLang, onGoToProfile, onLogout, t, isAdmin, onGoToAdmin }) {
  function SidebarButton({ tab, size }) {
    const badge = tab.badge > 0 ? tab.badge : null;
    return (
      <div className="sb-item" style={{ position: 'relative' }}>
        <button onClick={() => onSelectTab(tab)} aria-label={tab.label} style={{
          width: '44px', height: '44px', borderRadius: '12px', border: 'none', cursor: 'pointer',
          backgroundColor: activeId === tab.id ? 'rgba(249,115,22,0.12)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          <tab.Icon color={activeId === tab.id ? '#f97316' : 'var(--c-777)'} size={size} />
          {badge && (
            <span style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: '#f97316', color: 'white', fontSize: '9px', fontWeight: '800', borderRadius: '10px', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{badge}</span>
          )}
        </button>
        <span className="sb-tooltip" role="tooltip">{tab.label}{badge ? ` (${badge})` : ''}</span>
      </div>
    );
  }
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: `${SIDEBAR_WIDTH_COMPACT}px`, backgroundColor: 'var(--c-111)', borderRight: '1px solid var(--c-1e1e1e)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 0 14px', zIndex: 300 }}>
      <style>{`
        .sb-item { position: relative; }
        .sb-tooltip { position: absolute; left: 62px; top: 50%; transform: translateY(-50%) translateX(-4px); background: var(--c-1a1a1a); border: 1px solid var(--c-2a2a2a); color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.15s ease, transform 0.15s ease; z-index: 400; }
        .sb-item:hover .sb-tooltip, .sb-item:focus-within .sb-tooltip { opacity: 1; transform: translateY(-50%) translateX(0); }
      `}</style>
      <button onClick={() => onSelectTab({ id: 'home' })} aria-label="Betrics" style={{ background: 'none', border: 'none', padding: 0, marginBottom: '22px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo192.png" alt="" style={{ width: '32px', height: '32px', borderRadius: '9px' }} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, alignItems: 'center' }}>
        {tabsPrincipaux.map(tab => <SidebarButton key={tab.id} tab={tab} size={20} />)}
        {tabsSecondaires.length > 0 && <div style={{ width: '28px', height: '1px', backgroundColor: 'var(--c-1e1e1e)', margin: '8px 0' }} />}
        {tabsSecondaires.map(tab => <SidebarButton key={tab.id} tab={tab} size={18} />)}
      </div>
      <div className="sb-item">
        <ProfileMenuButton utilisateur={utilisateur} avatarUrl={avatarUrl} displayName={displayName} themePref={themePref} setThemePref={setThemePref} lang={lang} setLang={setLang} onGoToProfile={onGoToProfile} onLogout={onLogout} t={t} popupPosition="up" isAdmin={isAdmin} onGoToAdmin={onGoToAdmin} />
      </div>
    </div>
  );
}

// Barre du bas mobile (<768px), style Wealthsimple : pilule flottante COMPACTE et centree
// (~80% de la largeur, max 360px, ~64px de haut) -- pas pleine largeur. 5 onglets icones
// seules (Accueil/Recherche/Analyses/Pool, puis "Plus" en dernier -- icone hamburger, voir
// IconHamburgerMenu -- qui ouvre MoreSheet avec les sections restantes, Paris/Bankroll). Onglet
// actif : grosse pastille arrondie claire derriere l'icone, animee (transition + leger "pop"
// d'echelle) au changement d'onglet -- "Plus" est actif des que la page courante est une des
// sections de MoreSheet (voir activeIdMobile dans App()), pas seulement quand la feuille est
// ouverte. Cibles tactiles >=44px, marge de 12px au-dessus de la safe-area iOS.
export function BottomNav({ tabs, activeId, onSelectTab }) {
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 250, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{
        width: '80%', maxWidth: '360px', height: '64px', boxSizing: 'border-box',
        marginBottom: 'max(12px, calc(12px + env(safe-area-inset-bottom)))',
        backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        padding: '6px', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        boxShadow: '0 8px 30px rgba(0,0,0,0.45)', pointerEvents: 'auto',
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onSelectTab(tab)} aria-label={tab.label} aria-current={activeId === tab.id ? 'page' : undefined}
            style={{ flex: 1, minHeight: '44px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>
            <span style={{
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '46px', height: '46px', borderRadius: '50%',
              backgroundColor: activeId === tab.id ? 'var(--c-white)' : 'transparent',
              transform: activeId === tab.id ? 'scale(1)' : 'scale(0.82)',
              transition: 'background-color 0.22s ease, transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <tab.Icon color={activeId === tab.id ? '#f97316' : 'var(--c-666)'} size={21} />
              {tab.badge > 0 && (
                <span style={{ position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#f97316', color: 'white', fontSize: '9px', fontWeight: '800', borderRadius: '10px', minWidth: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid var(--c-111)' }}>{tab.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Feuille du bas listant les sections secondaires (Pool/Paris/Bankroll/Admin), ouverte par le
// bouton "..." de la top bar mobile -- meme contenu que tabsSecondaires de la sidebar desktop.
export function MoreSheet({ tabs, onSelectTab, onClose, t }) {
  return (
    <BottomSheet onClose={onClose} title={t('nav_more_title')}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => { onSelectTab(tab); onClose(); }}
          style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'none', border: 'none', borderRadius: '10px', cursor: 'pointer', boxSizing: 'border-box' }}>
          <tab.Icon color="var(--c-888)" size={18} />
          <span style={{ fontSize: '14px', color: 'var(--c-white)', fontWeight: '600' }}>{tab.label}</span>
          {tab.badge > 0 && (
            <span style={{ marginLeft: 'auto', backgroundColor: '#f97316', color: 'white', fontSize: '10px', fontWeight: '800', borderRadius: '10px', minWidth: '17px', height: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{tab.badge}</span>
          )}
        </button>
      ))}
    </BottomSheet>
  );
}

// Icone hamburger (3 lignes horizontales) du dernier onglet "Plus"/"More" de la bottom nav mobile
// (voir BottomNav/tabsMobile dans App()) -- remplace l'ancien bouton "..." (3 points) qui vivait
// dans la top bar (voir MobileTopBar ci-dessous, qui ne gere plus les sections secondaires).
export function IconHamburgerMenu({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// Top bar mobile, style Wealthsimple : logo Betrics a gauche (cliquable vers l'accueil), titre
// de la page au centre, avatar de profil rond a droite (feuille du bas, voir ProfileMenuButton
// isMobile). Les sections secondaires (Paris/Bankroll) ne passent plus par un bouton "..." ici --
// elles sont accessibles depuis le dernier onglet "Plus" de la bottom nav (voir BottomNav/
// MoreSheet/tabsMobile dans App()), comme le profil n'est deja plus dans la bottom nav.
//
// position:fixed (PAS sticky) : sticky cassait par intermittence sur mobile des que cette barre
// avait un ancetre position:sticky + backdrop-filter combine a un re-render (comportement
// irregulier selon le moteur, notamment iOS Safari) -- fixed est garanti ancre au viewport quoi
// qu'il arrive. Le contenu compense avec un padding-top egal a MOBILE_TOPBAR_HEIGHT (voir App()).
export const MOBILE_TOPBAR_HEIGHT = 54;

export function MobileTopBar({ title, onGoHome, utilisateur, avatarUrl, displayName, themePref, setThemePref, lang, setLang, onGoToProfile, onLogout, t, isAdmin, onGoToAdmin }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', backgroundColor: 'rgba(8,8,8,0.95)', padding: '10px 14px', paddingTop: 'calc(10px + env(safe-area-inset-top))', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px', zIndex: 250, backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--c-161616)', boxSizing: 'border-box' }}>
      <button onClick={onGoHome} aria-label="Betrics" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifySelf: 'start' }}>
        <img src="/logo192.png" alt="" style={{ width: '30px', height: '30px', borderRadius: '8px' }} />
      </button>

      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-white)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{title}</span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', justifySelf: 'end' }}>
        <ProfileMenuButton
          utilisateur={utilisateur} avatarUrl={avatarUrl} displayName={displayName}
          themePref={themePref} setThemePref={setThemePref} lang={lang} setLang={setLang}
          onGoToProfile={onGoToProfile} onLogout={onLogout} t={t} isMobile
          isAdmin={isAdmin} onGoToAdmin={onGoToAdmin}
        />
      </div>
    </div>
  );
}

// Dernier sous-onglet utilise dans Analyses (Matchs/Modeles, voir le controle segmente dans
// App()) -- try/catch systematique, meme convention que readHideAmounts/writeHideAmounts
// (src/Home.js) : jamais bloquant si localStorage est indisponible, juste perdu pour la
// session suivante (repli silencieux sur "matchs").
const STATS_SOUS_ONGLET_KEY = 'betrics_stats_sous_onglet';

function lireStatsSousOnglet() {
  try { return window.localStorage.getItem(STATS_SOUS_ONGLET_KEY) === 'modeles' ? 'modeles' : 'matchs'; } catch { return 'matchs'; }
}

function ecrireStatsSousOnglet(valeur) {
  try { window.localStorage.setItem(STATS_SOUS_ONGLET_KEY, valeur); } catch { /* ignore */ }
}

function AdminPage() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: '900px', margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '4px 12px' }}>
          <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '600', letterSpacing: '1px' }}>INTERNAL</span>
        </div>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--c-white)' }}>Betrics · Parameters & Methodology</h1>
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', border: '1px solid var(--c-161616)', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>01 · Prop Probability Weighting</div>
        <div style={{ fontSize: '14px', color: 'var(--c-888)', lineHeight: '1.7', marginBottom: '16px' }}>
          Based on backtesting of 93 simulated NHL players across 5,766 observations (2024-25 season distributions). L5 is the strongest predictor in 9/10 cases.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[['L5', '45%', 'Most recent form — strongest predictor'], ['L10', '33%', 'Medium-term trend'], ['L20', '22%', 'Season consistency']].map(([label, weight, desc], i) => (
            <div key={i} style={{ backgroundColor: 'var(--c-111)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#f97316', letterSpacing: '-1px' }}>{weight}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-555)', marginTop: '4px' }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--c-555)', lineHeight: '1.6', borderTop: '1px solid var(--c-1a1a1a)', paddingTop: '12px' }}>
          <strong style={{ color: 'var(--c-888)' }}>Formula:</strong> P = (L5_rate x 0.45) + (L10_rate x 0.33) + (L20_rate x 0.22)<br/>
          <strong style={{ color: 'var(--c-888)' }}>Exception:</strong> Offensive defensemen use L10/L20 split (36%/35%).
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', border: '1px solid var(--c-161616)', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>02 · Props Analyzed</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['SOG', 'Shots on Goal', '1.5, 2.5, 3.5'],
            ['Goals', 'Goal scorer', '0.5'],
            ['Assists', 'Primary/secondary assist', '0.5'],
            ['Points', 'Goals + Assists', '0.5, 1.5'],
            ['PPP', 'Power Play Points', '0.5'],
          ].map(([stat, desc, lines], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--c-111)', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ minWidth: '60px', fontWeight: '700', color: '#f97316', fontSize: '13px' }}>{stat}</div>
              <div style={{ flex: 1, fontSize: '13px', color: 'var(--c-888)' }}>{desc}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-555)', fontFamily: 'monospace' }}>Lines: {lines}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', border: '1px solid var(--c-161616)', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>03 · Data Sources</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['NHL Official API', 'api-web.nhle.com/v1', 'Game logs, rosters, standings, schedules'],
            ['NHL Stats API', 'api.nhle.com/stats/rest', 'Advanced stats, hits, blocked shots'],
            ['DailyFaceoff', 'GitHub raw JSON (scraped)', 'Line combinations, PP units'],
            ['Supabase', 'supabase.io', 'User data, bets, bankroll'],
          ].map(([name, url, usage], i) => (
            <div key={i} style={{ backgroundColor: 'var(--c-111)', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--c-white)' }}>{name}</span>
                <span style={{ fontSize: '11px', color: 'var(--c-555)', fontFamily: 'monospace' }}>{url}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--c-555)' }}>{usage}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', border: '1px solid var(--c-161616)', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>04 · Backtesting Results</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
          {[['MAE', 'L5: 0.420 · L10: 0.433 · L20: 0.441', 'Lower is better'], ['Correlation', 'L5: 0.272 · L10: 0.271 · L20: 0.279', 'Higher is better'], ['Brier Score', 'L5: 0.254 · L10: 0.242 · L20: 0.234', 'Lower is better']].map(([metric, values, note], i) => (
            <div key={i} style={{ backgroundColor: 'var(--c-111)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{metric}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-888)', marginBottom: '4px' }}>{values}</div>
              <div style={{ fontSize: '11px', color: 'var(--c-444)' }}>{note}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-555)', fontStyle: 'italic' }}>93 players · 5,766 observations · NHL 2024-25 distributions</div>
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', border: '1px solid var(--c-161616)', padding: '24px' }}>
        <div style={{ fontSize: '11px', color: '#f97316', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>05 · Changelog</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['2026-06-07', 'Added prop probability model L5/L10/L20, Admin page with email detection'],
            ['2026-05-24', 'Added Lineup tab in FicheEquipe with DailyFaceoff trios'],
            ['2026-05-18', 'Added playoff bracket with auto-detection'],
            ['2026-05-03', 'Regular Season vs Playoffs toggle in player stats'],
            ['2026-04-25', 'HITS/BLK from boxscore API, TOI average calculation'],
            ['2026-04-19', 'Initial launch — NHL player/team analytics'],
          ].map(([date, change], i) => (
            <div key={i} style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <span style={{ color: 'var(--c-444)', fontFamily: 'monospace', minWidth: '90px' }}>{date}</span>
              <span style={{ color: 'var(--c-666)' }}>{change}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



function PropsPage({ lang = 'en' }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [props, setProps] = React.useState([]);
  const [chargement, setChargement] = React.useState(true);
  const [filtre, setFiltre] = React.useState('ALL');
  const [filtreMatch, setFiltreMatch] = React.useState('ALL');
  const [matches, setMatches] = React.useState([]);

  const getDateStr = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,'0') + "-" + String(d.getDate()).padStart(2,'0');
  const getUrl = (path) => {
    const isProd = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
    return isProd ? '/api/nhl?path=' + encodeURIComponent('https://api-web.nhle.com/v1/' + path) : 'https://api-web.nhle.com/v1/' + path;
  };

  React.useEffect(() => { chargerProps(); }, [seasonId]);

  async function chargerProps() {
    setChargement(true);
    try {
      const jours = Array(7).fill(null).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return getDateStr(d); });
      const resultats = {};
      await Promise.all(jours.map(async (jour) => {
        try {
          const res = await fetch(getUrl('schedule/' + jour));
          const data = await res.json();
          const games = data.gameWeek?.[0]?.games || [];
          if (games.length > 0) resultats[jour] = games;
        } catch {}
      }));
      const aujourd = getDateStr(new Date());
      const prochainJour = Object.keys(resultats).sort().find(j => resultats[j]?.length > 0) || aujourd;
      const matchsDuJour = resultats[prochainJour] || [];
      setMatches(matchsDuJour);
      if (matchsDuJour.length === 0) { setChargement(false); return; }
      const joueursDuJour = [];
      for (const match of matchsDuJour) {
        for (const abbrev of [match.awayTeam?.abbrev, match.homeTeam?.abbrev]) {
          if (!abbrev) continue;
          try {
            const res = await fetch(getUrl('roster/' + abbrev + '/' + seasonId));
            const data = await res.json();
            (data.forwards || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'F', matchId: match.id, away: match.awayTeam?.abbrev, home: match.homeTeam?.abbrev }));
            (data.defensemen || []).forEach(j => joueursDuJour.push({ ...j, equipe: abbrev, position: 'D', matchId: match.id, away: match.awayTeam?.abbrev, home: match.homeTeam?.abbrev }));
          } catch {}
        }
      }
      const resultats2 = [];
      for (let i = 0; i < Math.min(joueursDuJour.length, 80); i += 5) {
        const batch = joueursDuJour.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(async (j) => {
          try {
            const res = await fetch(getUrl('player/' + j.id + '/game-log/' + seasonId + '/2'));
            const data = await res.json();
            const log = (data.gameLog || []).slice(0, 20);
            if (log.length < 5) return null;
            const l5 = log.slice(0, 5);
            const l10 = log.slice(0, Math.min(10, log.length));
            const l20 = log.slice(0, Math.min(20, log.length));
            const hit = (games, stat, line) => games.filter(g => (g[stat] || 0) > line).length / games.length;
            const candidates = [];
            for (const line of [1.5, 2.5, 3.5]) {
              const r5=hit(l5,'shots',line), r10=hit(l10,'shots',line), r20=hit(l20,'shots',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'SOG', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5, 1.5]) {
              const r5=hit(l5,'points',line), r10=hit(l10,'points',line), r20=hit(l20,'points',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'PTS', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5]) {
              const r5=hit(l5,'goals',line), r10=hit(l10,'goals',line), r20=hit(l20,'goals',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'GOAL', line, prob, r5, r10, r20 });
            }
            for (const line of [0.5]) {
              const r5=hit(l5,'assists',line), r10=hit(l10,'assists',line), r20=hit(l20,'assists',line);
              const prob = r5*0.45 + r10*0.33 + r20*0.22;
              if (prob >= 0.55) candidates.push({ stat: 'AST', line, prob, r5, r10, r20 });
            }
            if (candidates.length === 0) return null;
            const nom = ((j.firstName?.default||'') + ' ' + (j.lastName?.default||'')).trim();
            return candidates.sort((a,b) => b.prob-a.prob).map(c => ({ id: j.id, nom, equipe: j.equipe, position: j.position, away: j.away, home: j.home, ...c }));
          } catch { return null; }
        }));
        batchRes.filter(Boolean).forEach(arr => resultats2.push(...arr));
      }
      setProps(resultats2.sort((a,b) => b.prob-a.prob));
    } catch {}
    setChargement(false);
  }

  const categories = ['ALL', 'SOG', 'PTS', 'GOAL', 'AST'];
  const catColors = { SOG: '#3b82f6', PTS: '#f97316', GOAL: '#22c55e', AST: '#a78bfa', ALL: '#f97316' };

  const propsFiltres = props.filter(p => {
    const catOk = filtre === 'ALL' || p.stat === filtre;
    const matchOk = filtreMatch === 'ALL' || p.equipe === filtreMatch || p.away === filtreMatch || p.home === filtreMatch;
    return catOk && matchOk;
  });

  const getColor = (prob) => prob >= 0.75 ? '#22c55e' : prob >= 0.65 ? '#f97316' : 'var(--c-888)';
  const getBg = (prob) => prob >= 0.75 ? 'rgba(34,197,94,0.08)' : prob >= 0.65 ? 'rgba(249,115,22,0.08)' : 'rgba(100,100,100,0.05)';
  const getBorder = (prob) => prob >= 0.75 ? 'rgba(34,197,94,0.2)' : prob >= 0.65 ? 'rgba(249,115,22,0.2)' : 'var(--c-161616)';

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>

      {/* Header */}
      <div style={{ padding: '20px 20px 12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }}>Props</h2>
        <p style={{ margin: 0, color: 'var(--c-555)', fontSize: '13px' }}>{t('props_subtitle')} · {propsFiltres.length} {t('props_unit')}</p>
      </div>

      {/* Match filter */}
      {matches.length > 0 && (
        <div style={{ padding: '0 20px 12px', overflowX: 'auto', display: 'flex', gap: '6px', scrollbarWidth: 'none' }}>
          <button onClick={() => setFiltreMatch('ALL')} style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: filtreMatch === 'ALL' ? '#f97316' : 'var(--c-0d0d0d)', color: filtreMatch === 'ALL' ? 'white' : 'var(--c-555)', fontSize: '12px', fontWeight: '600' }}>{t('props_all_games')}</button>
          {matches.map((m, i) => {
            const label = (m.awayTeam?.abbrev || '') + ' vs ' + (m.homeTeam?.abbrev || '');
            const isActive = filtreMatch === m.awayTeam?.abbrev || filtreMatch === m.homeTeam?.abbrev;
            return (
              <button key={i} onClick={() => setFiltreMatch(isActive ? 'ALL' : m.awayTeam?.abbrev)} style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: isActive ? '#f97316' : 'var(--c-0d0d0d)', color: isActive ? 'white' : 'var(--c-555)', fontSize: '12px', fontWeight: '600' }}>{label}</button>
            );
          })}
        </div>
      )}

      {/* Stat categories */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '6px' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFiltre(cat)} style={{ flex: 1, padding: '8px 4px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: filtre === cat ? catColors[cat] : 'var(--c-0d0d0d)', color: filtre === cat ? 'white' : 'var(--c-555)', fontSize: '12px', fontWeight: '700', transition: 'all 0.15s' }}>{cat}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid var(--c-1a1a1a)', borderTop: '3px solid #f97316', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--c-444)', fontSize: '13px', margin: 0 }}>{t('props_loading')}</p>
          </div>
        ) : propsFiltres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--c-333)', fontSize: '13px' }}>{t('props_none')}</div>
        ) : propsFiltres.map((p, i) => (
          <div key={p.id + p.stat + p.line + i} style={{ backgroundColor: getBg(p.prob), borderRadius: '16px', padding: '14px 16px', border: '1px solid ' + getBorder(p.prob), marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Rank */}
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-333)', minWidth: '24px', textAlign: 'center' }}>#{i+1}</div>

            {/* Photo */}
            <PlayerHelmet teamAbbrev={p.equipe} size={44} alt={p.nom} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--c-white)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
              <div style={{ fontSize: '11px', color: 'var(--c-555)', marginBottom: '6px' }}>{p.equipe} · {p.away} vs {p.home}</div>
              {/* L5 L10 L20 bars */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {[['L5', p.r5], ['L10', p.r10], ['L20', p.r20]].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--c-444)', fontWeight: '600' }}>{label}</span>
                    <div style={{ width: '28px', height: '4px', backgroundColor: 'var(--c-1a1a1a)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: Math.round(val*100) + '%', height: '100%', backgroundColor: getColor(val), borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--c-444)' }}>{Math.round(val*100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prop badge */}
            <div style={{ textAlign: 'center', backgroundColor: 'var(--c-0d0d0d)', borderRadius: '12px', padding: '8px 12px', flexShrink: 0 }}>
              <div style={{ fontSize: '10px', color: catColors[p.stat] || '#f97316', fontWeight: '700', marginBottom: '2px', letterSpacing: '0.5px' }}>{p.stat} {p.line}+</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: getColor(p.prob), letterSpacing: '-0.5px', lineHeight: 1 }}>{Math.round(p.prob * 100)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePage({ utilisateur, onBack, lang = 'en' }) {
  const t = getT(lang);
  const [username, setUsername] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [usernameStatus, setUsernameStatus] = React.useState(null); // null, 'checking', 'available', 'taken', 'invalid'
  const [originalUsername, setOriginalUsername] = React.useState('');
  const [cropModal, setCropModal] = React.useState(false);
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState({ unit: '%', width: 80, height: 80, x: 10, y: 10 });
  const [completedCrop, setCompletedCrop] = React.useState(null);
  const imgRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const [emailConnections, setEmailConnections] = React.useState([]);
  const [savingBookmakers, setSavingBookmakers] = React.useState(false);
  const [province, setProvince] = React.useState('');
  const [savingProvince, setSavingProvince] = React.useState(false);
  const connexionGmail = emailConnections.find(c => c.provider === 'gmail') || null;
  const connexionOutlook = emailConnections.find(c => c.provider === 'outlook') || null;
  const connexionPrincipale = connexionGmail || connexionOutlook || null;

  React.useEffect(() => { chargerProfil(); chargerConnexionEmail(); }, []);

  async function chargerProfil() {
    try {
      const { data } = await supabase.from('profiles').select('username, avatar_url, first_name, last_name, province').eq('id', utilisateur.id).single();
      if (data) { setUsername(data.username || ''); setOriginalUsername(data.username || ''); setAvatarUrl(data.avatar_url || null); setFirstName(data.first_name || ''); setLastName(data.last_name || ''); setProvince(data.province || ''); }
    } catch {}
  }

  async function chargerConnexionEmail() {
    try {
      const { data } = await supabase.from('user_email_connections').select('*').eq('user_id', utilisateur.id);
      setEmailConnections(data || []);
    } catch { setEmailConnections([]); }
  }

  function demarrerConnexionOAuth({ provider, clientId, authUrl, scope, extraParams = {} }) {
    if (!clientId) { alert(t('bookmakers_coming_soon')); return; }
    const redirectUri = `${window.location.origin}/auth/${provider}/callback`;
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(`${provider}_oauth_state`, state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      ...extraParams,
    });
    window.location.href = `${authUrl}?${params.toString()}`;
  }

  function connecterGmail() {
    demarrerConnexionOAuth({
      provider: 'gmail',
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      extraParams: { access_type: 'offline', prompt: 'consent' },
    });
  }

  function connecterOutlook() {
    demarrerConnexionOAuth({
      provider: 'outlook',
      clientId: process.env.REACT_APP_OUTLOOK_CLIENT_ID,
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      scope: 'Mail.Read offline_access',
      extraParams: { response_mode: 'query' },
    });
  }

  async function deconnecterProvider(provider) {
    try {
      await supabase.from('user_email_connections').update({ access_token: null, refresh_token: null, actif: false }).eq('user_id', utilisateur.id).eq('provider', provider);
      chargerConnexionEmail();
    } catch {}
  }

  async function toggleParsingActif() {
    if (emailConnections.length === 0) return;
    const nouveauStatut = !(connexionPrincipale?.actif);
    setSavingBookmakers(true);
    try {
      await supabase.from('user_email_connections').update({ actif: nouveauStatut }).eq('user_id', utilisateur.id);
      setEmailConnections(emailConnections.map(c => ({ ...c, actif: nouveauStatut })));
    } catch {}
    setSavingBookmakers(false);
  }

  async function toggleBookmaker(nom) {
    if (emailConnections.length === 0) return;
    const actuels = connexionPrincipale?.bookmakers || [];
    const maj = actuels.includes(nom) ? actuels.filter(b => b !== nom) : [...actuels, nom];
    setSavingBookmakers(true);
    try {
      await supabase.from('user_email_connections').update({ bookmakers: maj }).eq('user_id', utilisateur.id);
      setEmailConnections(emailConnections.map(c => ({ ...c, bookmakers: maj })));
    } catch {}
    setSavingBookmakers(false);
  }

  async function sauvegarderProvince(nouvelleProvince) {
    setProvince(nouvelleProvince);
    setSavingProvince(true);
    try {
      await supabase.from('profiles').upsert({ id: utilisateur.id, province: nouvelleProvince, updated_at: new Date().toISOString() });
    } catch {}
    setSavingProvince(false);
  }

  async function sauvegarderProfil() {
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({ id: utilisateur.id, username, first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() });
      if (!error) { setOriginalUsername(username); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    setSaving(false);
  }

  React.useEffect(() => {
    if (cropModal) {
      const prevent = (e) => e.preventDefault();
      document.addEventListener('gesturestart', prevent, { passive: false });
      document.addEventListener('gesturechange', prevent, { passive: false });
      document.addEventListener('wheel', prevent, { passive: false });
      const meta = document.querySelector('meta[name=viewport]');
      if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
      return () => {
        document.removeEventListener('gesturestart', prevent);
        document.removeEventListener('gesturechange', prevent);
        document.removeEventListener('wheel', prevent);
        if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1');
      };
    }
  }, [cropModal]);

  const checkUsername = React.useCallback(async (val) => {
    if (!val || val.length < 3) { setUsernameStatus('invalid'); return; }
    if (val === originalUsername) { setUsernameStatus('available'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    try {
      const { data } = await supabase.from('profiles').select('username').eq('username', val).neq('id', utilisateur.id).single();
      setUsernameStatus(data ? 'taken' : 'available');
    } catch { setUsernameStatus('available'); }
  }, [originalUsername, utilisateur.id]);

  React.useEffect(() => {
    const timer = setTimeout(() => { if (username) checkUsername(username); }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  function onSelectFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result);
      setCrop({ unit: '%', width: 80, height: 80, x: 10, y: 10 });
      setCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function getCroppedBlob() {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(
      image,
      completedCrop.x * scaleX, completedCrop.y * scaleY,
      completedCrop.width * scaleX, completedCrop.height * scaleY,
      0, 0, size, size
    );
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  async function uploadCropped() {
    setUploading(true);
    setCropModal(false);
    try {
      const blob = await getCroppedBlob();
      if (!blob) return;
      const path = utilisateur.id + '/avatar.jpg';
      const { error } = await supabase.storage.from('Avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) {
        const { data } = supabase.storage.from('Avatars').getPublicUrl(path);
        const url = data.publicUrl + '?t=' + Date.now();
        setAvatarUrl(url);
        await supabase.from('profiles').upsert({ id: utilisateur.id, avatar_url: url });
      }
    } catch(e) { console.error(e); }
    setUploading(false);
  }

  const initials = (username || utilisateur?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      <style>{'.crop-container img { max-width: 100%; max-height: 60vh; } .ReactCrop { border-radius: 12px; overflow: hidden; }'}</style>

      {/* Crop Modal */}
      {cropModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <style>{`
            .crop-area { position: relative; overflow: hidden; touch-action: none; }
            .crop-img { position: absolute; cursor: grab; user-select: none; }
            .crop-img:active { cursor: grabbing; }
          `}</style>
          <h3 style={{ color: 'var(--c-white)', margin: '0 0 8px', fontWeight: '700', fontSize: '18px' }}>{t('profile_crop_title')}</h3>
          <p style={{ color: 'var(--c-555)', fontSize: '13px', margin: '0 0 20px' }}>{t('profile_crop_sub')}</p>

          {imgSrc && (() => {
            const SIZE = Math.min(window.innerWidth - 40, 320);
            return (
              <div style={{ position: 'relative', width: SIZE, height: SIZE, marginBottom: '20px' }}>
                <CropArea imgSrc={imgSrc} size={SIZE} imgRef={imgRef} onCropChange={setCompletedCrop} />
                {/* Cercle overlay */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', border: '3px solid #f97316', pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)', zIndex: 10 }} />
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setCropModal(false)} style={{ padding: '13px 28px', backgroundColor: 'transparent', color: 'var(--c-888)', border: '1px solid var(--c-333)', borderRadius: '12px', cursor: 'pointer', fontSize: '15px' }}>{t('profile_crop_cancel')}</button>
            <button onClick={uploadCropped} style={{ padding: '13px 28px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>{t('profile_crop_use')}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button onClick={onBack} style={{ backgroundColor: 'transparent', border: '1px solid var(--c-222)', color: 'var(--c-666)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>{t('back_btn')}</button>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('profile_title')}</h2>
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div onClick={() => !uploading && fileInputRef.current?.click()} style={{ position: 'relative', cursor: 'pointer', marginBottom: '12px' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f97316' }} />
          ) : (
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--c-1a1a1a)', border: '3px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '900', color: '#f97316' }}>{initials}</div>
          )}
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: '2px solid var(--c-080808)' }}>
            {uploading ? '⟳' : '✎'}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelectFile} style={{ display: 'none' }} />
        <p style={{ margin: 0, color: 'var(--c-444)', fontSize: '12px' }}>{uploading ? t('profile_uploading') : t('profile_tap_photo')}</p>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{t('profile_first_name')}</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('profile_first_name_ph')}
              style={{ width: '100%', padding: '12px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#f97316'}
              onBlur={e => e.target.style.borderColor = 'var(--c-222)'} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{t('profile_last_name')}</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('profile_last_name_ph')}
              style={{ width: '100%', padding: '12px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#f97316'}
              onBlur={e => e.target.style.borderColor = 'var(--c-222)'} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{t('profile_username')}</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder={t('profile_username_ph')}
            style={{ width: '100%', padding: '12px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid ' + (usernameStatus === 'taken' || usernameStatus === 'invalid' ? '#ef4444' : usernameStatus === 'available' ? '#22c55e' : 'var(--c-222)'), borderRadius: '12px', color: 'var(--c-white)', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: '-apple-system, sans-serif' }}
          />
          {username.length > 0 && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: usernameStatus === 'taken' ? '#ef4444' : usernameStatus === 'available' ? '#22c55e' : usernameStatus === 'invalid' ? '#ef4444' : 'var(--c-555)' }}>
              {usernameStatus === 'checking' && t('profile_checking')}
              {usernameStatus === 'available' && t('profile_available')}
              {usernameStatus === 'taken' && t('profile_taken')}
              {usernameStatus === 'invalid' && t('profile_invalid')}
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Email</label>
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--c-080808)', border: '1px solid var(--c-161616)', borderRadius: '12px', color: 'var(--c-444)', fontSize: '15px' }}>{utilisateur?.email}</div>
        </div>
      </div>

      {/* Province — utilisee par le comparateur de cotes LNH pour determiner les sites et statuts reglementaires a afficher */}
      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '16px', border: '1px solid var(--c-161616)', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 4px', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('profile_province_title')}</p>
        <p style={{ margin: '0 0 12px', color: 'var(--c-444)', fontSize: '12px', lineHeight: '1.5' }}>{t('profile_province_sub')}</p>
        <select
          value={province}
          onChange={e => sauvegarderProvince(e.target.value)}
          disabled={savingProvince}
          style={{ width: '100%', padding: '12px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
        >
          <option value="" disabled>{t('profile_province_choisir')}</option>
          {PROVINCES.map(p => <option key={p} value={p}>{t(`comparateur_province_${p}`)}</option>)}
        </select>
      </div>

      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '16px', border: '1px solid var(--c-161616)', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 12px', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('profile_account')}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--c-666)', fontSize: '13px' }}>{t('profile_member_since')}</span>
          <span style={{ color: 'var(--c-white)', fontSize: '13px', fontWeight: '600' }}>{new Date(utilisateur?.created_at || Date.now()).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Mes Bookmakers — connexion Gmail/Outlook + parsing automatique des paris */}
      <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', padding: '16px', border: '1px solid var(--c-161616)', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 4px', color: 'var(--c-555)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('bookmakers_title')}</p>
        <p style={{ margin: '0 0 16px', color: 'var(--c-444)', fontSize: '12px', lineHeight: '1.5' }}>{t('bookmakers_sub')}</p>

        {[
          { provider: 'gmail', connexion: connexionGmail, statusLabel: t('bookmakers_gmail_status'), connecter: connecterGmail, connectLabel: t('bookmakers_connect_btn') },
          { provider: 'outlook', connexion: connexionOutlook, statusLabel: t('bookmakers_outlook_status'), connecter: connecterOutlook, connectLabel: t('bookmakers_connect_outlook_btn') },
        ].map(({ provider, connexion, statusLabel, connecter, connectLabel }) => (
          <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ color: 'var(--c-888)', fontSize: '12px', marginBottom: '4px' }}>{statusLabel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connexion?.access_token ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                <span style={{ color: connexion?.access_token ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '600' }}>
                  {connexion?.access_token ? `✅ ${t('bookmakers_connected')}` : t('bookmakers_disconnected')}
                </span>
              </div>
            </div>
            {connexion?.access_token ? (
              <button onClick={() => deconnecterProvider(provider)} style={{ padding: '9px 16px', backgroundColor: 'transparent', color: 'var(--c-888)', border: '1px solid var(--c-333)', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                {t('bookmakers_disconnect_btn')}
              </button>
            ) : (
              <button onClick={connecter} style={{ padding: '9px 16px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                {connectLabel}
              </button>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--c-161616)', marginBottom: '14px', opacity: emailConnections.length === 0 ? 0.4 : 1 }}>
          <div>
            <div style={{ color: 'var(--c-white)', fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{t('bookmakers_auto_parsing')}</div>
            <div style={{ color: 'var(--c-444)', fontSize: '11px' }}>{t('bookmakers_auto_parsing_sub')}</div>
          </div>
          <div onClick={toggleParsingActif} style={{ width: '42px', height: '24px', borderRadius: '12px', backgroundColor: connexionPrincipale?.actif ? '#f97316' : 'var(--c-222)', cursor: emailConnections.length === 0 ? 'default' : 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: connexionPrincipale?.actif ? '21px' : '3px', transition: 'left 0.2s' }} />
          </div>
        </div>

        <div style={{ opacity: emailConnections.length === 0 ? 0.4 : 1 }}>
          <div style={{ color: 'var(--c-555)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{t('bookmakers_select_title')}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {BOOKMAKERS_SUPPORTES.map(bm => {
              const actif = (connexionPrincipale?.bookmakers || []).includes(bm);
              return (
                <button key={bm} onClick={() => toggleBookmaker(bm)} disabled={savingBookmakers || emailConnections.length === 0}
                  style={{ padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: actif ? '#f97316' : 'var(--c-1a1a1a)', color: actif ? 'white' : 'var(--c-666)', fontSize: '12px', fontWeight: '600' }}>
                  {bm}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={sauvegarderProfil} disabled={saving}
        style={{ width: '100%', padding: '14px', background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #f97316, #ea580c)', color: saved ? '#22c55e' : 'white', border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>
        {saved ? t('profile_saved') : saving ? t('saving_text') : t('profile_save')}
      </button>
    </div>
  );
}

// Nombre de paris sauvegardes (saved_picks, status='saved') pour le badge sur l'onglet
// Analyses de la sidebar/bottom nav. Abonnement realtime : reste a jour quand l'espace de
// travail Analyse sauvegarde/supprime/place un pari, sans avoir a faire remonter l'etat.
function useSavedPicksCount(utilisateur) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!utilisateur?.id) { setCount(0); return; }
    function recharger() {
      supabase.from('saved_picks').select('id', { count: 'exact', head: true }).eq('user_id', utilisateur.id).eq('status', 'saved')
        .then(({ count: n }) => setCount(n || 0));
    }
    recharger();
    const channel = supabase.channel(`saved_picks_count_${utilisateur.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_picks', filter: `user_id=eq.${utilisateur.id}` }, recharger)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [utilisateur?.id]);
  return count;
}

// ===================== Historique du navigateur pour l'auth/l'onboarding (refonte du 27 nov 2026) ====
// L'ecran de connexion/inscription (src/Auth.js) et les 5 etapes d'onboarding (src/Onboarding.js,
// AVANT l'inscription) vivent chacun derriere leur propre parametre d'URL -- ?auth=signin|signup
// et ?onboarding=1&step=N -- pousse dans l'historique a chaque OUVERTURE/AVANCEE (pushState,
// jamais replaceState) pour que le bouton retour du navigateur/telephone revienne correctement a
// l'ecran precedent (accueil, ou etape precedente de l'onboarding) via l'ecouteur `popstate`
// plus bas, au lieu de quitter l'app ou de rester bloque sur l'ecran courant. Les deux etats sont
// TOUJOURS redecouverts depuis l'URL (jamais seulement mis a jour de maniere optimiste), y compris
// au premier rendu -- un rechargement de page sur une etape/un ecran d'auth retombe exactement au
// bon endroit. Ne concerne PAS ?onboarding=preview (mode apercu, inchange -- voir plus bas) ni les
// autres parametres d'URL existants (?page=, ?admin=...).
function authModeFromSearch(search) {
  const v = new URLSearchParams(search).get('auth');
  return v === 'signin' ? 'login' : v === 'signup' ? 'signup' : null;
}
function onboardingStepFromSearch(search) {
  const params = new URLSearchParams(search);
  if (params.get('onboarding') !== '1') return null;
  const step = parseInt(params.get('step'), 10);
  return step >= 1 && step <= 5 ? step : 1;
}
function pushAuthUrl(mode) {
  const param = mode === 'login' ? 'signin' : 'signup';
  window.history.pushState({}, '', `${window.location.pathname}?auth=${param}`);
}
function pushOnboardingStepUrl(step) {
  window.history.pushState({}, '', `${window.location.pathname}?onboarding=1&step=${step}`);
}
function pushHomeUrl() {
  window.history.pushState({}, '', '/');
}

// ===================== Pages legales (confidentialite/conditions, refonte du 27 nov 2026) =========
// Adresses publiques dediees, independantes de tout etat d'authentification -- exigees par Google
// pour publier la connexion Google (voir src/LegalPage.js). Chaque page existe en FR et en EN sous
// sa PROPRE adresse (jamais une bascule de langue sur une seule URL) : /confidentialite et
// /conditions affichent toujours le francais, /privacy et /terms toujours l'anglais, quel que
// soit le drapeau de langue courant de l'app -- essentiel pour que Google (et tout robot) voie un
// contenu stable par URL. Les liens internes (pied de page, ecran d'auth, onboarding), eux,
// pointent vers la version qui correspond a la langue actuellement choisie (voir openLegalRoute
// plus bas).
function legalRouteFromPath(pathname) {
  if (pathname === '/confidentialite') return { page: 'privacy', lang: 'fr' };
  if (pathname === '/conditions') return { page: 'terms', lang: 'fr' };
  if (pathname === '/privacy') return { page: 'privacy', lang: 'en' };
  if (pathname === '/terms') return { page: 'terms', lang: 'en' };
  return null;
}
function legalUrlFor(page, lang) {
  if (lang === 'fr') return page === 'privacy' ? '/confidentialite' : '/conditions';
  return page === 'privacy' ? '/privacy' : '/terms';
}

function App() {
  // Lien d'invitation /pool/join/:code — detecte une fois, utilise pour forcer l'auth
  // et atterrir directement sur l'onglet Pool (en mode "rejoindre") apres connexion.
  const poolJoinCode = /^\/pool\/join\/[A-Za-z0-9]+/i.test(window.location.pathname)
    ? window.location.pathname.match(/^\/pool\/join\/([A-Za-z0-9]+)/i)[1]
    : null;
  const [page, setPage] = useState(() => {
    if (window.location.search.includes('admin=betrics2026')) return 'admin';
    const pageParam = new URLSearchParams(window.location.search).get('page');
    if (pageParam === 'profile') return 'profile';
    // Ancienne route des Modeles (liens/signets/menus existants) : redirige vers Analyses, le
    // sous-onglet Modeles est selectionne par l'initialiseur de statsSousOnglet ci-dessous.
    if (pageParam === 'props') return 'stats';
    if (poolJoinCode) return 'pooldraft';
    return 'home';
  });
  // Analyses fusionne desormais Matchs (ex-"Analyses") et Modeles en un seul onglet de nav avec
  // un controle segmente interne (voir plus bas, pres du selecteur NHL/NFL) -- "Modeles" n'est
  // plus une page/un onglet de navigation a part entiere. ?page=props reste un alias qui ouvre
  // directement le sous-onglet Modeles (voir l'initialiseur de `page` ci-dessus).
  const [statsSousOnglet, setStatsSousOnglet] = useState(() => (
    new URLSearchParams(window.location.search).get('page') === 'props' ? 'modeles' : lireStatsSousOnglet()
  ));
  function choisirStatsSousOnglet(valeur) {
    setStatsSousOnglet(valeur);
    ecrireStatsSousOnglet(valeur);
  }
  const [utilisateur, setUtilisateur] = useState(null);
  // Verification d'admin cote base de donnees (profiles.is_admin, voir migration
  // 20261119_2_profiles_is_admin.sql) -- jamais une liste d'emails codee en dur cote client
  // (visible dans le bundle JS, ne protegeait rien reellement). Faux par defaut tant que le
  // profil n'a pas charge : un admin voit la mention Admin apparaitre apres un court instant,
  // jamais un non-admin ne la voit, meme furtivement.
  const [isAdmin, setIsAdmin] = useState(false);
  const [profilCharge, setProfilCharge] = useState(false);
  // Pages legales (src/LegalPage.js) : /confidentialite, /conditions, /privacy, /terms --
  // TOUJOURS redecouvert depuis le pathname (meme principe que authMode/onboardingStep plus bas),
  // accessible sans connexion et SANS redirection vers l'accueil, quel que soit l'etat de
  // connexion/onboarding en cours (voir le rendu tout en haut de ce composant, avant meme les
  // verifications d'auth/onboarding).
  const [legalRoute, setLegalRoute] = useState(() => legalRouteFromPath(window.location.pathname));
  // Porte d'entree "Complete ton profil" (src/ProfileSetup.js, refonte du 27 nov 2026) -- null
  // tant que le profil n'a pas charge (voir profilCharge plus bas), PUIS toujours verifiee AVANT
  // onboardingCompleted ci-dessous (ordre fixe : profil -> onboarding -> app). Un compte Google
  // n'a AUCUNE ligne `profiles` tant que ce formulaire n'a jamais ete soumis (rien ne cree cette
  // ligne automatiquement a l'inscription Google, contrairement a l'inscription par courriel qui
  // fait un upsert explicite -- voir src/Auth.js) : `data` absent de la requete ci-dessous DOIT
  // donc se traduire par profileCompleted=false, jamais true (inverse du choix fait pour
  // onboardingCompleted juste en dessous, ou l'absence de donnees retombe au contraire sur
  // "deja complete" pour ne jamais re-bloquer un compte existant derriere une erreur reseau).
  const [profileCompleted, setProfileCompleted] = useState(null);
  // Onboarding (src/Onboarding.js) : null tant que le profil n'a pas charge -- voir
  // showOnboarding plus bas, qui attend explicitement profilCharge avant de decider (jamais de
  // flash du dashboard normal avant de basculer sur l'onboarding pour un nouvel utilisateur).
  const [onboardingCompleted, setOnboardingCompleted] = useState(null);
  // MODE APERCU (?onboarding=preview) : lu une seule fois a l'etat initial (pas recalcule a
  // chaque rendu depuis window.location.search) -- a la fin de l'apercu, on le repasse a `false`
  // explicitement (voir handleOnboardingComplete plus bas). Necessaire : `page` vaut deja 'home'
  // par defaut, donc `setPage('home')` seul ne declenche aucun re-render (React ignore une mise a
  // jour d'etat vers une valeur identique) -- sans cet etat dedie, rien ne forcerait React a
  // ressortir de l'onboarding apres "Terminer" en mode apercu.
  const [onboardingPreviewActive, setOnboardingPreviewActive] = useState(
    () => new URLSearchParams(window.location.search).get('onboarding') === 'preview'
  );
  // Visiteur NON connecte qui a clique le bouton d'inscription ("Commencer"/nav_signup, voir
  // onOpenAuth plus bas) : affiche les 5 etapes AVANT l'ecran d'inscription -- voir
  // src/Onboarding.js (ecrit dans localStorage tant qu'aucun compte n'existe). `onboardingStep`
  // (1 a 5, ou null si l'onboarding n'est pas affiche) est CONTROLE et toujours redecouvert depuis
  // l'URL (?onboarding=1&step=N, voir onboardingStepFromSearch plus haut) -- source unique de
  // verite partagee avec l'ecouteur popstate plus bas, jamais un simple booleen local.
  const [onboardingStep, setOnboardingStep] = useState(() => onboardingStepFromSearch(window.location.search));
  // Noms des comptes bankroll venant d'etre crees par l'onboarding (a 0$, voir l'effet de
  // chargement du profil plus bas) -- affiche une seule fois sur l'accueil (src/Home.js:
  // DepositPromptBanner) une invitation discrete a faire un premier depot, puis se vide.
  const [pendingDepositAccounts, setPendingDepositAccounts] = useState(null);
  // `authMode` ('login'|'signup', ou null si l'ecran d'auth n'est pas affiche) : meme principe que
  // `onboardingStep` ci-dessus -- toujours redecouvert depuis l'URL (?auth=signin|signup), sauf le
  // cas special du lien d'invitation /pool/join/:code qui force l'ecran de connexion des le depart
  // (cette URL n'a pas de parametre ?auth, rien a redecouvrir).
  const [authMode, setAuthMode] = useState(() => (poolJoinCode ? 'login' : authModeFromSearch(window.location.search)));
  const [ligueAnalyses, setLigueAnalyses] = useState(null);
  const [lang, setLang] = useState('en');
  // Lu par l'effet de chargement du profil (voir plus bas), qui ne doit PAS re-executer a chaque
  // changement de langue (seulement a la connexion) -- une ref evite d'ajouter `lang` a ses
  // dependances tout en restant a jour.
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [mode, , themePref, setThemePref] = useWSTheme();
  useEffect(() => { document.documentElement.setAttribute('data-theme', mode); }, [mode]);
  const [showRecherche, setShowRecherche] = useState(false);
  const [moreSheetOuvert, setMoreSheetOuvert] = useState(false);
  const [joueurFicheGlobal, setJoueurFicheGlobal] = useState(null);
  const [equipeFicheGlobal, setEquipeFicheGlobal] = useState(null);
  const [pendingOpenPoolId, setPendingOpenPoolId] = useState(null);
  const [pendingOpenPlayer, setPendingOpenPlayer] = useState(null);
  const [pendingInsightsPeriod, setPendingInsightsPeriod] = useState('all');
  const isMobile = useIsMobile();
  // Appele sans condition (regle des hooks) : utilisateur peut passer de null a connecte entre
  // deux rendus, un hook appele seulement dans la branche "if (utilisateur)" plus bas
  // changerait d'ordre d'appel entre les rendus. Le hook lui-meme gere deja utilisateur=null.
  const savedPicksCount = useSavedPicksCount(utilisateur);
  // Titre/meta SEO d'une page legale (src/LegalPage.js) -- appele sans condition (regle des
  // hooks, meme raison que useSavedPicksCount ci-dessus) : `legalRoute` peut passer de null a une
  // valeur entre deux rendus (clic sur un lien legal) sans jamais changer l'ordre des hooks.
  // legalPageMeta/useDocumentMeta n'appliquent rien quand title/description sont absents.
  const legalMeta = legalRoute ? legalPageMeta(legalRoute.page, legalRoute.lang) : {};
  useDocumentMeta({ title: legalMeta.title, description: legalMeta.description, path: window.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUtilisateur(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUtilisateur(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Extrait en fonction nommee (plutot qu'une IIFE anonyme dans l'effet) : ProfileSetup.onComplete
  // (porte d'entree "Complete ton profil", voir plus bas) doit pouvoir RE-executer exactement ce
  // chargement une fois le profil sauvegarde -- sinon onboardingCompleted resterait bloque sur la
  // valeur calculee AVANT que la ligne `profiles` existe (un compte Google n'en a aucune tant que
  // ProfileSetup n'a jamais ete soumis, voir le commentaire de profileCompleted plus haut), ce qui
  // sauterait l'onboarding par erreur pour tout nouveau compte Google au lieu de l'afficher apres
  // le profil comme l'exige l'ordre fixe profil -> onboarding -> app.
  async function chargerProfil(isAnnule = () => false) {
    const { data } = await supabase.from('profiles')
      .select('avatar_url, username, first_name, last_name, is_admin, onboarding_completed, profile_completed_at')
      .eq('id', utilisateur.id).single();
    if (isAnnule()) return;
    setAvatarUrl(data?.avatar_url || null);
    const nomComplet = data?.username || [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
    setDisplayName(nomComplet || '');
    setIsAdmin(!!data?.is_admin);
    // `data` absent (profil introuvable) : AUCUNE ligne `profiles` n'existe encore pour ce
    // compte -- cas normal d'un tout nouveau compte Google (voir le commentaire de profileCompleted
    // plus haut) -- toujours interprete comme "profil non complete", jamais l'inverse.
    setProfileCompleted(data ? data.profile_completed_at != null : false);

    // `data` absent (profil introuvable/erreur) : jamais interprete comme "onboarding non
    // complete" -- pour ne jamais bloquer un utilisateur existant derriere une erreur reseau
    // transitoire. `dejaComplete` vaut `true` sauf si la colonne vaut explicitement `false`.
    const dejaComplete = data ? data.onboarding_completed !== false : true;

    // ===================== Application des reponses d'onboarding stockees localement =====
    // Premiere connexion apres l'inscription (voir src/Onboarding.js : les 5 etapes, remplies
    // AVANT la creation de compte, ecrivent uniquement dans localStorage) -- y compris apres un
    // rechargement complet de page (confirmation d'email, retour d'un futur OAuth) : cette
    // logique vit ici, dans la fonction appelee par l'effet qui reagit a `utilisateur?.id`, donc
    // JAMAIS dependante de l'etat React du composant Onboarding (qui peut tres bien ne plus
    // exister). Idempotente : le localStorage est vide des que les reponses ont ete appliquees.
    const reponsesLocales = readLocalOnboardingAnswers();
    if (reponsesLocales && !data) {
      // AUCUNE ligne `profiles` du tout (compte Google tout neuf, voir le commentaire de
      // profileCompleted plus haut) -- NE JAMAIS effacer les reponses locales ici : `dejaComplete`
      // vaut `true` par defaut dans ce cas precis (choix volontaire pour le reseau transitoire
      // d'un compte EXISTANT, voir plus haut), ce qui les traiterait a tort comme "deja
      // onboarde" et les effacerait avant meme que ProfileSetup ait eu la chance de creer la
      // ligne. On attend la prochaine execution de chargerProfil() (ProfileSetup.onComplete, la
      // ligne existe desormais) pour les appliquer normalement via la branche ci-dessous.
      if (!isAnnule()) setOnboardingCompleted(false);
    } else if (reponsesLocales && !dejaComplete) {
      try {
        const comptesCrees = [];
        for (const kind of (reponsesLocales.bookmakers || [])) {
          const label = kind === 'other' ? getT(langRef.current)('bank_account_other') : (ACCOUNT_KIND_OPTIONS.find(o => o.kind === kind)?.label || kind);
          const { error } = await supabase.from('bankroll_accounts').insert({ user_id: utilisateur.id, name: label, kind });
          if (!error) comptesCrees.push(label);
        }
        await supabase.from('profiles').upsert({
          id: utilisateur.id, onboarding_completed: true, onboarding_answers: reponsesLocales, onboarding_completed_at: new Date().toISOString(),
        });
        clearLocalOnboardingAnswers();
        if (!isAnnule()) {
          setOnboardingCompleted(true);
          if (comptesCrees.length > 0) setPendingDepositAccounts(comptesCrees);
        }
      } catch {
        // Echec d'ecriture (reseau, RLS...) : on laisse les reponses locales en place pour
        // reessayer a la prochaine connexion, et on retombe sur le chemin normal ci-dessous
        // (cas de secours : les 5 etapes s'affichent apres la connexion, voir plus bas).
        if (!isAnnule()) setOnboardingCompleted(dejaComplete);
      }
    } else if (reponsesLocales && dejaComplete) {
      // Compte DEJA onboarde (ex. utilisateur existant qui a rempli les 5 etapes par
      // curiosite puis s'est connecte a son compte habituel via "Se connecter") : ces reponses
      // ne lui appartiennent pas -- on les efface silencieusement, jamais appliquees.
      clearLocalOnboardingAnswers();
      if (!isAnnule()) setOnboardingCompleted(true);
    } else if (!isAnnule()) {
      setOnboardingCompleted(dejaComplete);
    }

    if (!isAnnule()) setProfilCharge(true);
  }

  useEffect(() => {
    if (!utilisateur?.id) { setAvatarUrl(null); setDisplayName(''); setIsAdmin(false); setOnboardingCompleted(null); setProfileCompleted(null); setProfilCharge(false); return; }
    let annule = false;
    setProfilCharge(false);
    chargerProfil(() => annule).catch(() => {
      if (!annule) {
        setOnboardingCompleted(true);
        // Echec total (reseau...), pas seulement "aucune ligne" (deja gere ci-dessus, qui
        // retombe correctement sur false) : on laisse passer plutot que de bloquer
        // indefiniment un compte existant derriere une panne transitoire -- un prochain
        // chargement reussi corrigera ce statut si le profil est vraiment incomplet.
        setProfileCompleted(true);
        setProfilCharge(true);
      }
    });
    return () => { annule = true; };
  }, [utilisateur?.id]);

  // Refuse l'acces direct a l'URL/au parametre admin (?admin=betrics2026) a un non-admin : des
  // que le profil a charge (profilCharge), si la page est 'admin' sans is_admin, on redirige
  // immediatement vers l'accueil -- AdminPage lui-meme n'est jamais rendu pour un non-admin (voir
  // plus bas, le rendu conditionnel exige aussi isAdmin), ceci evite seulement de rester bloque
  // sur un onglet vide.
  useEffect(() => {
    if (page === 'admin' && profilCharge && !isAdmin) setPage('home');
  }, [page, profilCharge, isAdmin]);

  // Filet de securite pour toute reference interne qui pointerait encore vers l'ancienne page
  // Modeles ('props') -- redirige vers Analyses > Modeles, jamais de rendu pour cet etat.
  useEffect(() => {
    if (page === 'props') { setStatsSousOnglet('modeles'); ecrireStatsSousOnglet('modeles'); setPage('stats'); }
  }, [page]);

  async function handleDeconnexion() {
    await supabase.auth.signOut();
    setUtilisateur(null);
    setPage('home');
  }

  // ===================== Bouton retour du navigateur/telephone : auth + onboarding =====================
  // Seule source qui met a jour `authMode`/`onboardingStep` suite a une navigation arriere/avant
  // (popstate) -- toujours redecouverts depuis l'URL (voir authModeFromSearch/
  // onboardingStepFromSearch plus haut), jamais une transition optimiste : un popstate peut aussi
  // bien venir du bouton retour physique que de `window.history.back()` appele depuis
  // src/Onboarding.js (etapes 2 a 5, voir goBack() de ce fichier).
  useEffect(() => {
    function onPopState() {
      setAuthMode(authModeFromSearch(window.location.search));
      setOnboardingStep(onboardingStepFromSearch(window.location.search));
      setLegalRoute(legalRouteFromPath(window.location.pathname));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Ouvre l'ecran de connexion/inscription (src/Auth.js) -- pushState AVANT de changer l'etat,
  // jamais replaceState : c'est cette nouvelle entree d'historique que le bouton retour doit
  // pouvoir depiler pour revenir a l'ecran precedent (accueil, ou l'etape d'onboarding depuis
  // laquelle "J'ai deja un compte" a ete cliquee).
  function openAuth(mode) {
    pushAuthUrl(mode);
    setOnboardingStep(null);
    setLegalRoute(null);
    setAuthMode(mode);
  }

  // Lance la toute premiere etape d'onboarding (depuis l'accueil, "Commencer") -- meme principe.
  function openOnboardingStep1() {
    pushOnboardingStepUrl(1);
    setAuthMode(null);
    setLegalRoute(null);
    setOnboardingStep(1);
  }

  // Chaque avancee d'etape (src/Onboarding.js:irVersEtape, passee comme `onStepChange`) pousse sa
  // propre entree -- le RECUL, lui, passe par un vrai `window.history.back()` cote Onboarding.js,
  // jamais par cette fonction (voir le commentaire de goBack() dans ce fichier).
  function goToOnboardingStep(step) {
    pushOnboardingStepUrl(step);
    setOnboardingStep(step);
  }

  // "Retour a l'accueil" garanti (etape 1 de l'onboarding, ecran d'auth, pages legales) : un
  // pushState plutot qu'un history.back(), pour rester correct meme si l'utilisateur a atterri
  // directement sur cette URL (lien partage/rechargement) sans entree d'accueil derriere dans
  // l'historique reel du navigateur -- cette fleche doit TOUJOURS ramener a l'accueil, jamais hors
  // de l'app.
  function goHome() {
    pushHomeUrl();
    setAuthMode(null);
    setOnboardingStep(null);
    setLegalRoute(null);
  }

  // Ouvre une page legale (src/LegalPage.js) depuis le pied de page public, l'ecran d'auth ou
  // l'onboarding -- toujours la version dans la langue COURANTE de l'app (voir legalUrlFor),
  // nouvelle entree d'historique : le bouton retour revient exactement a l'ecran d'ou le lien a
  // ete clique (accueil, ecran d'auth, etape d'onboarding), jamais a l'accueil directement.
  function openLegalRoute(page) {
    const target = { page, lang };
    window.history.pushState({}, '', legalUrlFor(page, lang));
    setAuthMode(null);
    setOnboardingStep(null);
    setLegalRoute(target);
  }

  // ===================== Pages legales (src/LegalPage.js) =====================
  // Verifiee EN PREMIER, avant meme les callbacks OAuth email et tout branchement connecte/non-
  // connecte : accessible sans connexion, jamais de redirection vers l'accueil, quel que soit
  // l'etat d'authentification/onboarding en cours (exigence de Google pour publier la connexion
  // Google -- adresses publiques independantes).
  if (legalRoute) {
    return <LegalPage page={legalRoute.page} lang={legalRoute.lang} onBack={goHome} />;
  }

  if (window.location.pathname === '/auth/gmail/callback') {
    return <EmailOAuthCallback provider="gmail" lang={lang} />;
  }
  if (window.location.pathname === '/auth/outlook/callback') {
    return <EmailOAuthCallback provider="outlook" lang={lang} />;
  }

  // ===================== Onboarding : MODE APERCU (src/Onboarding.js) =====================
  // Verifie TRES TOT, avant tout branchement connecte/non-connecte : ?onboarding=preview
  // fonctionne aussi bien pour un visiteur non connecte que pour un utilisateur deja onboarde,
  // sans la moindre ecriture (ni Supabase, ni localStorage -- voir OnboardingFlow). La pastille
  // "Mode apercu" reste visible sur tout le flux (carrousel si reactive + les 5 etapes).
  if (ONBOARDING_ENABLED && onboardingPreviewActive) {
    return (
      <OnboardingFlow
        utilisateur={utilisateur}
        lang={lang}
        previewMode
        onComplete={() => {
          // Ne JAMAIS modifier l'etat "complete" -- seulement retirer le parametre d'URL
          // (cosmetique) et sortir du mode apercu localement (voir onboardingPreviewActive,
          // necessaire car `page` vaut deja 'home' par defaut -- `setPage('home')` seul ne
          // declencherait aucun re-render, voir le commentaire plus haut sur cet etat).
          const url = new URL(window.location.href);
          url.searchParams.delete('onboarding');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          setOnboardingPreviewActive(false);
          setPage('home');
        }}
      />
    );
  }

  // ===================== Onboarding : les 5 etapes AVANT l'inscription =====================
  // Visiteur NON connecte qui a clique le bouton d'inscription (onOpenAuth('signup'), voir plus
  // bas -- "Commencer"/nav_signup partout dans src/PublicSite.js) : remplit les 5 etapes d'abord,
  // les reponses restent en localStorage (voir src/Onboarding.js), puis enchaine vers l'ecran
  // d'inscription existant (openAuth('signup'), nouvelle entree d'historique ?auth=signup). "J'ai
  // deja un compte" (onSignIn) vide ces reponses et bascule plutot vers la connexion -- ce sont
  // des reponses qui ne lui appartiennent pas. `step`/`onStepChange`/`onBackToHome` : etape
  // CONTROLEE par l'URL (?onboarding=1&step=N), voir le commentaire au-dessus de
  // authModeFromSearch plus haut -- bouton retour du navigateur = etape precedente.
  if (ONBOARDING_ENABLED && onboardingStep != null && !utilisateur) {
    return (
      <OnboardingFlow
        lang={lang}
        step={onboardingStep}
        onStepChange={goToOnboardingStep}
        onBackToHome={goHome}
        onOpenLegal={openLegalRoute}
        onComplete={() => openAuth('signup')}
        onSignIn={() => openAuth('login')}
      />
    );
  }

  if (authMode != null && !utilisateur) {
    return (
      <div style={{ fontFamily: 'Arial', backgroundColor: '#0f0f0f', minHeight: '100vh', color: 'white' }}>
        <Auth
          onConnexion={() => { window.history.replaceState({}, '', window.location.pathname); setAuthMode(null); setPage(poolJoinCode ? 'pooldraft' : 'home'); }}
          onBackToHome={goHome}
          onOpenLegal={openLegalRoute}
          lang={lang}
          initialMode={authMode}
        />
      </div>
    );
  }

  // App connectée : sidebar gauche fixe (desktop/tablette) ou bottom nav (mobile)
  if (utilisateur) {
    const t = getT(lang);

    // Ecran de chargement tant que le statut du profil (profileCompleted) ET de l'onboarding
    // (onboardingCompleted) ne sont pas tous les deux connus -- jamais de flash du dashboard
    // normal avant de basculer sur ProfileSetup/OnboardingFlow pour un compte qui ne les a pas
    // encore completes.
    if ((PROFILE_SETUP_ENABLED || ONBOARDING_ENABLED) && !profilCharge) {
      return <div style={{ minHeight: '100vh', backgroundColor: 'var(--c-080808)' }} />;
    }

    // ===================== Porte d'entree "Complete ton profil" (src/ProfileSetup.js) =====
    // TOUJOURS verifiee EN PREMIER, avant l'onboarding -- ordre fixe profil -> onboarding -> app,
    // identique pour une inscription Google OU courriel, et pour un compte existant (qui la
    // complete une seule fois). `onComplete` re-execute chargerProfil() (voir plus haut) plutot
    // que de se contenter d'un setProfileCompleted(true) direct : c'est ce qui permet a
    // onboardingCompleted de se mettre a jour correctement juste apres (la ligne `profiles`
    // vient d'etre creee/mise a jour par ProfileSetup, onboarding_completed y est desormais
    // visible pour la premiere fois). La deconnexion (onLogout) reste disponible sur cet ecran --
    // un visiteur qui s'est trompe de compte Google peut toujours se deconnecter.
    if (PROFILE_SETUP_ENABLED && profileCompleted === false) {
      return (
        <ProfileSetup
          utilisateur={utilisateur}
          lang={lang}
          onComplete={() => { chargerProfil(); }}
          onLogout={handleDeconnexion}
          onOpenLegal={openLegalRoute}
        />
      );
    }

    // ===================== Onboarding : chemin de repli (deja connecte) =====================
    // N'arrive ici QUE si l'effet de chargement du profil (plus haut) n'a trouve AUCUNE reponse
    // locale a appliquer -- un utilisateur deja authentifie dont l'onboarding n'est pas termine
    // (ex. compte cree avant cette refonte, ou nouveau compte Google qui vient de completer
    // ProfileSetup ci-dessus). Ecrit alors directement (voir OnboardingFlow.finalize(), chemin
    // `utilisateur` present) -- memes regles que la refonte (comptes a 0$, aucun depot invente).
    if (ONBOARDING_ENABLED && onboardingCompleted === false) {
      return (
        <OnboardingFlow
          utilisateur={utilisateur}
          lang={lang}
          onComplete={(reponses) => {
            setOnboardingCompleted(true);
            if (reponses?.bookmakers?.length > 0) {
              setPendingDepositAccounts(reponses.bookmakers.map(kind => kind === 'other' ? t('bank_account_other') : (ACCOUNT_KIND_OPTIONS.find(o => o.kind === kind)?.label || kind)));
            }
            setPage('home');
          }}
        />
      );
    }

    // Modeles n'est plus un onglet de navigation a part entiere (fusionne dans Analyses, voir le
    // controle segmente Matchs/Modeles plus bas). Pool rejoint ce premier groupe (icone etoile,
    // ex-icone de Modeles) directement sous Analyses, sans separateur entre les deux -- le
    // separateur existant (voir AppSidebar) ne s'affiche qu'entre ce groupe et tabsSecondaires,
    // donc seulement entre Pool et Paris desormais.
    const tabsPrincipaux = [
      { id: 'home', label: t('nav_tab_home'), Icon: IconHome },
      { id: 'search', label: t('nav_tab_search'), Icon: IconSearch },
      { id: 'stats', label: t('nav_tab_analyses'), Icon: IconBarChart, badge: savedPicksCount },
      { id: 'pooldraft', label: t('nav_tab_pool'), Icon: IconStar },
    ];
    // Sidebar desktop/iPad, 2e groupe (sous le separateur, maintenant juste Paris/Bankroll).
    // Reutilise tel quel pour la feuille "..." mobile (meme contenu desormais que Pool a
    // rejoint tabsPrincipaux pour les deux). Admin n'est plus dans cette liste (retire de la
    // sidebar ET de la feuille "..." mobile) -- reachable uniquement depuis le menu de profil
    // (voir ProfileMenuButton isAdmin/onGoToAdmin), tout en haut, admin seulement.
    const tabsSecondaires = [
      { id: 'bets', label: t('menu_bets'), Icon: IconTicket },
      { id: 'bankroll', label: t('menu_bankroll'), Icon: IconWallet },
    ];
    // Bottom nav mobile : tabsPrincipaux (Accueil/Recherche/Analyses/Pool) + un dernier onglet
    // "Plus" (icone hamburger) qui ouvre MoreSheet avec tabsSecondaires (Paris/Bankroll) -- ancien
    // bouton "..." de la top bar, retire (voir MobileTopBar). Id 'more' n'est jamais une page
    // reelle : intercepte dans handleSelectBottomNavTab avant d'atteindre handleSelectTab/setPage.
    const tabsMobile = [...tabsPrincipaux, { id: 'more', label: t('nav_more_title'), Icon: IconHamburgerMenu }];
    const activeId = joueurFicheGlobal || equipeFicheGlobal ? null : page;
    // "Plus" doit apparaitre actif quand la page couramment affichee est une des sections de la
    // feuille (Paris/Bankroll), meme si la feuille elle-meme n'est pas ouverte -- jamais les deux
    // onglets distincts actifs en meme temps.
    const activeIdMobile = activeId && tabsSecondaires.some(ts => ts.id === activeId) ? 'more' : activeId;

    function handleSelectTab(tab) {
      if (tab.id === 'search') { setShowRecherche(true); return; }
      setJoueurFicheGlobal(null);
      setEquipeFicheGlobal(null);
      setPage(tab.id);
    }

    function handleSelectBottomNavTab(tab) {
      if (tab.id === 'more') { setMoreSheetOuvert(true); return; }
      handleSelectTab(tab);
    }

    // Titre affiche au centre de la top bar mobile (pas d'equivalent desktop, la sidebar n'a pas
    // de titre de page -- le contenu de chaque page porte deja son propre h1/h2).
    const titresPage = {
      home: t('nav_tab_home'), stats: t('nav_tab_analyses'),
      profile: t('menu_settings'), bets: t('menu_bets'), bankroll: t('menu_bankroll'),
      performance: t('perf_title'), pooldraft: t('nav_tab_pool'), admin: t('menu_admin'),
    };
    const pageTitle = joueurFicheGlobal
      ? (joueurFicheGlobal.nom || t('nav_tab_search'))
      : equipeFicheGlobal
      ? (equipeFicheGlobal.equipe?.teamName?.default || equipeFicheGlobal.equipe?.teamAbbrev?.default || t('nav_tab_search'))
      : (titresPage[page] || t('nav_tab_home'));

    const contenuPrincipal = joueurFicheGlobal ? (
      <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '900px', margin: '0 auto' }}>
        <FicheJoueurStats
          joueur={joueurFicheGlobal}
          onBack={() => setJoueurFicheGlobal(null)}
          onAnalyser={(j) => { setPendingOpenPlayer(j); setJoueurFicheGlobal(null); setEquipeFicheGlobal(null); setPage('stats'); }}
        />
      </div>
    ) : equipeFicheGlobal ? (
      <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '900px', margin: '0 auto' }}>
        <FicheEquipeWS theme={WS_THEME[mode]} equipe={equipeFicheGlobal.equipe} skaters={equipeFicheGlobal.skaters}
          onBack={() => setEquipeFicheGlobal(null)}
          onSelectPlayer={(j) => { setEquipeFicheGlobal(null); setJoueurFicheGlobal(j); }} />
      </div>
    ) : page === 'profile' ? (
      <ProfilePage utilisateur={utilisateur} onBack={() => setPage('home')} lang={lang} />
    ) : page === 'bets' ? (
      <BetsPage lang={lang} />
    ) : page === 'bankroll' ? (
      <BankrollPage utilisateur={utilisateur} onBack={() => setPage('home')} lang={lang} />
    ) : page === 'performance' ? (
      <PerformanceInsights utilisateur={utilisateur} lang={lang} onBack={() => setPage('home')} initialPeriod={pendingInsightsPeriod} />
    ) : page === 'pooldraft' ? (
      <PoolHub utilisateur={utilisateur} lang={lang} openPoolId={pendingOpenPoolId} onConsumedOpenPoolId={() => setPendingOpenPoolId(null)} />
    ) : page === 'admin' ? (
      // isAdmin verifie cote base de donnees (profiles.is_admin) -- jamais rendu pour un
      // non-admin, meme avant que le useEffect de redirection plus haut ait eu le temps de jouer.
      isAdmin ? <AdminPage /> : null
    ) : page === 'stats' ? (
      // Analyses fusionne Matchs (contenu historique d'AnalysesFlux) et Modeles (ex-page a part,
      // ModelesFlux intact) derriere un controle segmente -- voir plus bas, pres du selecteur
      // NHL/NFL. Chaque composant reste monte/demonte entierement au changement d'onglet (pas de
      // rendu simultane), comme avant quand c'etaient deux pages separees.
      statsSousOnglet === 'modeles' ? (
        <ModelesFlux />
      ) : (
        <AnalysesFlux onLigueChange={(l) => setLigueAnalyses(l)} lang={lang} utilisateur={utilisateur}
          pendingOpenPlayer={pendingOpenPlayer} onConsumedOpenPlayer={() => setPendingOpenPlayer(null)} />
      )
    ) : (
      <HomeDashboard
        utilisateur={utilisateur} lang={lang}
        onGoToProps={() => { choisirStatsSousOnglet('modeles'); setPage('stats'); }} onGoToAnalytics={() => setPage('stats')} onGoToBets={() => setPage('bets')}
        onGoToPerformance={(periode) => { setPendingInsightsPeriod(periode || 'all'); setPage('performance'); }}
        onOpenTeamFiche={(equipe) => { if (equipe) { setJoueurFicheGlobal(null); setEquipeFicheGlobal({ equipe, skaters: [] }); } }}
        pendingDepositAccounts={pendingDepositAccounts} onDismissDepositPrompt={() => setPendingDepositAccounts(null)}
      />
    );

    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: 'var(--c-080808)', minHeight: '100vh', color: 'var(--c-white)', paddingLeft: isMobile ? 0 : `${SIDEBAR_WIDTH_COMPACT}px`, paddingTop: isMobile ? `calc(${MOBILE_TOPBAR_HEIGHT}px + env(safe-area-inset-top))` : 0, paddingBottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : 0 }}>

        {!isMobile && (
          <AppSidebar
            tabsPrincipaux={tabsPrincipaux} tabsSecondaires={tabsSecondaires} activeId={activeId} onSelectTab={handleSelectTab}
            utilisateur={utilisateur} avatarUrl={avatarUrl} displayName={displayName} themePref={themePref} setThemePref={setThemePref} lang={lang} setLang={setLang}
            onGoToProfile={() => setPage('profile')} onLogout={handleDeconnexion} t={t}
            isAdmin={isAdmin} onGoToAdmin={() => setPage('admin')}
          />
        )}

        {isMobile && (
          <MobileTopBar
            title={pageTitle} onGoHome={() => handleSelectTab({ id: 'home' })}
            utilisateur={utilisateur} avatarUrl={avatarUrl} displayName={displayName}
            themePref={themePref} setThemePref={setThemePref} lang={lang} setLang={setLang}
            onGoToProfile={() => setPage('profile')} onLogout={handleDeconnexion} t={t}
            isAdmin={isAdmin} onGoToAdmin={() => setPage('admin')}
          />
        )}

        {showRecherche && (
          <RechercheOverlay
            onClose={() => setShowRecherche(false)}
            onSelectPlayer={(j) => { setShowRecherche(false); setEquipeFicheGlobal(null); setJoueurFicheGlobal(j); }}
            onSelectTeam={(payload) => { setShowRecherche(false); setJoueurFicheGlobal(null); setEquipeFicheGlobal(payload); }}
          />
        )}

        {/* Selecteur de ligue + controle segmente Matchs/Modeles - visible sur l'onglet Analyses.
            Modeles (ex-page a part) vit desormais ici, memorise dans localStorage (voir
            statsSousOnglet) -- jamais de changement de page, juste un changement d'onglet local. */}
        {page === 'stats' && !joueurFicheGlobal && !equipeFicheGlobal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '10px 20px', borderBottom: '1px solid var(--c-161616)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ padding: '6px 16px', borderRadius: '20px', backgroundColor: '#f97316', color: 'white', fontSize: '12px', fontWeight: 'bold' }}>NHL</div>
              <div style={{ padding: '6px 16px', borderRadius: '20px', backgroundColor: 'var(--c-1a1a1a)', border: '1px solid var(--c-222)', color: 'var(--c-555)', fontSize: '12px', cursor: 'not-allowed' }}>NFL · Bientôt</div>
            </div>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--c-0d0d0d)', borderRadius: '10px', padding: '3px', border: '1px solid var(--c-161616)' }}>
              {[['matchs', t('analyses_tab_matches')], ['modeles', t('nav_tab_models')]].map(([cle, libelle]) => (
                <button key={cle} onClick={() => choisirStatsSousOnglet(cle)}
                  style={{ padding: '7px 18px', minHeight: '38px', boxSizing: 'border-box', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: statsSousOnglet === cle ? '#f97316' : 'transparent', color: statsSousOnglet === cle ? 'white' : 'var(--c-555)', fontSize: '12.5px', fontWeight: statsSousOnglet === cle ? '700' : '600' }}>
                  {libelle}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pas de ticker ici pour l'onglet Analyses : AnalysesFlux affiche desormais son
            propre bandeau de scores cliquable (ouvre l'onglet matchup), voir Analyses.js. */}

        {/* Contenu */}
        <div style={{ padding: '0' }}>
          {contenuPrincipal}
        </div>

        {isMobile && (
          <BottomNav tabs={tabsMobile} activeId={activeIdMobile} onSelectTab={handleSelectBottomNavTab} />
        )}

        {isMobile && moreSheetOuvert && (
          <MoreSheet tabs={tabsSecondaires} onSelectTab={handleSelectTab} onClose={() => setMoreSheetOuvert(false)} t={t} />
        )}
      </div>
    );
  }

  // App non connectée — site public (accueil, Pool, Tarifs, outils, guide -- voir
  // src/PublicSite.js). "Se connecter" (mode='login') va toujours directement a l'ecran de
  // connexion existant. "Commencer"/"Créer un compte" (mode='signup', tous les boutons
  // d'inscription de ces pages) lance desormais les 5 etapes d'onboarding AVANT l'inscription --
  // voir onboardingStep plus haut. Les deux cas poussent une nouvelle entree d'historique (voir
  // openAuth/openOnboardingStep1) pour que le bouton retour revienne a l'accueil.
  return (
    <PublicSite
      lang={lang}
      setLang={setLang}
      onOpenAuth={(mode) => { if (mode === 'signup') { openOnboardingStep1(); } else { openAuth(mode); } }}
      onOpenLegal={openLegalRoute}
    />
  );
}
 
export default App;
 