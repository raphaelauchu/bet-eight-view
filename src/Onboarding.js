import React, { useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { ACCOUNT_KIND_OPTIONS } from './AddAccountBody';
import { MiniSparkline } from './Bankroll';
import { ONBOARDING_INTRO_SLIDES_ENABLED } from './onboardingConfig';

// ===================== Onboarding des nouveaux utilisateurs =====================
// Mise en page et ergonomie tres proches d'OddsJam (header retour/logo/"N SUR 5" + barre de
// progression en 5 segments, grandes cartes arrondies, bouton plein largeur fixe en bas) --
// AUCUN texte, logo, image ni couleur d'OddsJam copie : design system Betrics (fond noir/tres
// sombre, accent orange #f97316), copie et visuels propres a Betrics. Voir
// src/onboardingConfig.js (drapeaux ONBOARDING_ENABLED / ONBOARDING_INTRO_SLIDES_ENABLED) et
// src/App.js (seul endroit qui decide quand afficher ce composant).
//
// ===================== Parcours (refonte du 26 nov 2026) =====================
// Les 5 etapes passent desormais AVANT la creation de compte : un visiteur NON connecte peut les
// remplir, puis atterrit sur l'ecran d'inscription existant (src/Auth.js). Tant qu'aucun compte
// n'existe, les reponses vivent uniquement dans localStorage (voir LOCAL_STORAGE_KEY plus bas --
// cle versionnee, lecture/ecriture toujours en try/catch) : ce composant n'ecrit JAMAIS dans
// Supabase lui-meme quand `utilisateur` est absent (ni compte bankroll, ni profil). C'est
// App.js, au moment ou l'utilisateur devient authentifie (y compris apres un rechargement complet
// de page -- confirmation d'email, retour d'un futur OAuth -- jamais une dependance a l'etat React
// de ce composant, qui peut tres bien ne plus exister a ce moment-la), qui lit ces reponses
// locales et les applique une seule fois (comptes bankroll a 0$ + profil), puis vide le
// localStorage. Voir ce fichier pour ce mecanisme.
//
// Ce composant garde neanmoins un chemin de repli "ecrit directement" (utilisateur deja connecte,
// onboarding pas termine, AUCUNE reponse locale trouvee -- ex. l'utilisateur avait deja un compte
// avant cette refonte) : finalize() ci-dessous choisit entre les deux selon la presence
// d'`utilisateur`.
//
// `previewMode` (true quand l'URL contient ?onboarding=preview, connecte ou non) : AUCUNE
// ecriture nulle part (ni Supabase, ni localStorage) ne doit s'executer -- voir finalize().

export const LOCAL_STORAGE_KEY = 'betrics_onboarding_pending_v1';

export function readLocalOnboardingAnswers() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveLocalOnboardingAnswers(reponses) {
  try { window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reponses)); } catch { /* ignore */ }
}

export function clearLocalOnboardingAnswers() {
  try { window.localStorage.removeItem(LOCAL_STORAGE_KEY); } catch { /* ignore */ }
}

const ORANGE = '#f97316';
const TOTAL_STEPS = 5;
// Bleu-gris tres sombre (distinct du gris neutre utilise ailleurs dans l'app) -- demande
// explicite pour le fond des cartes de cette refonte.
const CARD_BG = '#121824';
const CARD_BG_SELECTED = 'rgba(249,115,22,0.10)';
const CARD_BORDER = '1px solid #232b3a';

const primaryBtnStyle = { width: '100%', padding: '16px', minHeight: '52px', boxSizing: 'border-box', backgroundColor: ORANGE, color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' };
const inputStyle = { width: '100%', padding: '13px 14px', backgroundColor: CARD_BG, border: CARD_BORDER, borderRadius: '14px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };

function IconBackArrow({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconCheck({ color = 'white', size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PreviewBadge({ t }) {
  return (
    <div style={{ position: 'fixed', top: 'calc(10px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.45)', color: ORANGE, fontSize: '10.5px', fontWeight: '800', padding: '5px 14px', borderRadius: '20px', zIndex: 3000, letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {t('onboarding_preview_badge')}
    </div>
  );
}

// ===================== En-tete + barre de progression (chaque etape) =====================

function StepHeader({ t, step, onBack, previewMode, onSignIn, showBackAtStep1 }) {
  const afficherRetour = step > 1 || showBackAtStep1;
  return (
    <div>
      {previewMode && <PreviewBadge t={t} />}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px', alignItems: 'center', padding: '14px 16px 0', paddingTop: 'calc(14px + env(safe-area-inset-top))' }}>
        <div>
          {afficherRetour && (
            <button onClick={onBack} aria-label={step > 1 ? t('onboarding_back_aria') : t('onboarding_back_home_aria')} style={{ background: 'none', border: 'none', color: 'var(--c-white)', cursor: 'pointer', padding: '8px', display: 'flex' }}>
              <IconBackArrow />
            </button>
          )}
        </div>
        <img src="/logo192.png" alt="Betrics" style={{ width: '28px', height: '28px', borderRadius: '8px', justifySelf: 'center' }} />
        <div style={{ justifySelf: 'end', fontSize: '11px', fontWeight: '800', color: 'var(--c-555)', letterSpacing: '0.4px' }}>
          {t('onboarding_step_indicator').replace('{n}', step).replace('{total}', TOTAL_STEPS)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', padding: '14px 16px 0' }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: i < step ? ORANGE : 'var(--c-1a1a1a)', transition: 'background-color 0.2s' }} />
        ))}
      </div>
      {onSignIn && (
        <div style={{ textAlign: 'center', padding: '10px 16px 0' }}>
          <button onClick={onSignIn} style={{ background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>
            {t('onboarding_already_have_account')} <span style={{ color: ORANGE, fontWeight: '700' }}>{t('nav_signin')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== Cartes de choix =====================

// `multi` : coche carree (choix multiple, ex. etape 3) vs pastille radio (choix unique).
// `sub` (optionnel) : libelle gris sous le titre, pour les cartes empilees a 2 lignes.
function ChoiceCard({ label, sub, selected, onClick, multi = true, center = false }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'space-between', gap: '10px',
        padding: '18px 18px', minHeight: '58px', boxSizing: 'border-box', borderRadius: '18px',
        border: selected ? `2px solid ${ORANGE}` : CARD_BORDER,
        backgroundColor: selected ? CARD_BG_SELECTED : CARD_BG,
        color: 'var(--c-white)', cursor: 'pointer', textAlign: center ? 'center' : 'left', width: '100%',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: center ? 'center' : 'flex-start' }}>
        <span style={{ fontSize: '15px', fontWeight: '800' }}>{label}</span>
        {sub && <span style={{ fontSize: '12.5px', color: 'var(--c-666)', fontWeight: '500' }}>{sub}</span>}
      </span>
      {!center && (multi ? (
        <span style={{ width: '22px', height: '22px', borderRadius: '7px', border: selected ? 'none' : '1.5px solid #333', backgroundColor: selected ? ORANGE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {selected && <IconCheck />}
        </span>
      ) : (
        <span style={{ width: '22px', height: '22px', borderRadius: '50%', border: selected ? `6px solid ${ORANGE}` : '1.5px solid #333', flexShrink: 0 }} />
      ))}
    </button>
  );
}

// Visuel genere (initiales sur une couleur deterministe par bookmaker) -- Betrics n'a de licence
// d'aucun logo de sportsbook, voir src/brandAssetsConfig.js pour la meme convention appliquee aux
// visuels LNH. Jamais un vrai logo/trademark copie.
const BOOKMAKER_COLORS = {
  bet365: '#027b5b', betway: '#111111', bet99: '#caa13a', sports_interaction: '#0057b8', mise_o_jeu: '#c8102e', other: '#4b5563',
};

function initialesBookmaker(label) {
  const mots = (label || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

function BookmakerIcon({ kind, label, size = 40 }) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '12px', backgroundColor: BOOKMAKER_COLORS[kind] || '#333', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: `${Math.round(size * 0.36)}px`, flexShrink: 0 }}>
      {initialesBookmaker(label)}
    </div>
  );
}

function BookmakerCard({ kind, label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 10px',
        borderRadius: '18px', border: selected ? `2px solid ${ORANGE}` : CARD_BORDER,
        backgroundColor: selected ? CARD_BG_SELECTED : CARD_BG, cursor: 'pointer', position: 'relative',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {selected && (
        <span style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={11} />
        </span>
      )}
      <BookmakerIcon kind={kind} label={label} />
      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-white)', textAlign: 'center' }}>{label}</span>
    </button>
  );
}

const titreStyle = { margin: '4px 0 6px', fontSize: 'clamp(24px, 6vw, 30px)', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-0.5px', lineHeight: 1.2 };
const sousTitreStyle = { margin: '0 0 24px', fontSize: '14px', color: 'var(--c-666)', lineHeight: 1.5 };

// ===================== Etape 1 : bookmakers + region =====================

const PROVINCE_OPTIONS = [
  ['CA-QC', 'onboarding_province_qc'],
  ['CA-ON', 'onboarding_province_on'],
  ['CA-AB', 'onboarding_province_ab'],
  ['CA-BC', 'onboarding_province_bc'],
  ['CA-OTHER', 'onboarding_province_other'],
];

function Step1Bookmakers({ t, selectedKinds, onToggle, onSkip, province, onProvinceChange }) {
  const [recherche, setRecherche] = useState('');
  const toutesOptions = useMemo(() => [...ACCOUNT_KIND_OPTIONS, { kind: 'other', label: t('bank_account_kind_other') }], [t]);
  const optionsFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return toutesOptions.filter(o => !q || o.label.toLowerCase().includes(q));
  }, [toutesOptions, recherche]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <h1 style={{ ...titreStyle, marginBottom: '6px' }}>{t('onboarding_step1_title')}</h1>
        <select
          aria-label={t('onboarding_region_label')}
          value={province}
          onChange={e => onProvinceChange(e.target.value)}
          style={{ flexShrink: 0, marginTop: '4px', padding: '6px 10px', borderRadius: '20px', border: CARD_BORDER, backgroundColor: CARD_BG, color: 'var(--c-white)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
        >
          {PROVINCE_OPTIONS.map(([code, labelKey]) => <option key={code} value={code}>{t(labelKey)}</option>)}
        </select>
      </div>
      <p style={sousTitreStyle}>{t('onboarding_step1_sub')}</p>
      <input
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder={t('onboarding_step1_search_placeholder')}
        style={{ ...inputStyle, marginBottom: '16px' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {optionsFiltrees.map(o => (
          <BookmakerCard key={o.kind} kind={o.kind} label={o.label} selected={selectedKinds.includes(o.kind)} onClick={() => onToggle(o.kind)} />
        ))}
      </div>
      <button onClick={onSkip} style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '6px' }}>
        {t('onboarding_step1_no_account')}
      </button>
    </>
  );
}

// ===================== Etape 2 : volume de mise =====================

const BET_SIZE_KEYS = [
  ['under_100', 'onboarding_betsize_under100', 'onboarding_betsize_under100_sub'],
  ['100_500', 'onboarding_betsize_100_500', 'onboarding_betsize_100_500_sub'],
  ['500_2000', 'onboarding_betsize_500_2000', 'onboarding_betsize_500_2000_sub'],
  ['2000_plus', 'onboarding_betsize_2000plus', 'onboarding_betsize_2000plus_sub'],
];

function Step2BetSize({ t, betSize, onSelect }) {
  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step2_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step2_sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {BET_SIZE_KEYS.map(([key, labelKey, subKey]) => (
          <ChoiceCard key={key} label={t(labelKey)} sub={t(subKey)} selected={betSize === key} onClick={() => onSelect(key)} multi={false} center />
        ))}
      </div>
    </>
  );
}

// ===================== Etape 3 : objectifs =====================

const GOAL_KEYS = [
  ['track', 'onboarding_goal_track'],
  ['choose', 'onboarding_goal_choose'],
  ['compare', 'onboarding_goal_compare'],
  ['pool', 'onboarding_goal_pool'],
];

function Step3Goals({ t, goals, onToggle }) {
  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step3_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step3_sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {GOAL_KEYS.map(([key, labelKey]) => (
          <ChoiceCard key={key} label={t(labelKey)} selected={goals.includes(key)} onClick={() => onToggle(key)} />
        ))}
      </div>
    </>
  );
}

// ===================== Etape 4 : experience =====================

const EXPERIENCE_KEYS = [
  ['beginner', 'onboarding_exp_beginner', 'onboarding_exp_beginner_sub'],
  ['intermediate', 'onboarding_exp_intermediate', 'onboarding_exp_intermediate_sub'],
  ['advanced', 'onboarding_exp_advanced', 'onboarding_exp_advanced_sub'],
];

function Step4Experience({ t, experience, onSelect }) {
  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step4_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step4_sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {EXPERIENCE_KEYS.map(([key, labelKey, subKey]) => (
          <ChoiceCard key={key} label={t(labelKey)} sub={t(subKey)} selected={experience === key} onClick={() => onSelect(key)} multi={false} />
        ))}
      </div>
    </>
  );
}

// ===================== Etape 5 : decouverte + age =====================

const SOURCE_KEYS = [
  ['x', 'onboarding_source_x'],
  ['google', 'onboarding_source_google'],
  ['reddit', 'onboarding_source_reddit'],
  ['instagram', 'onboarding_source_instagram'],
  ['tiktok', 'onboarding_source_tiktok'],
  ['word_of_mouth', 'onboarding_source_word_of_mouth'],
  ['youtube', 'onboarding_source_youtube'],
  ['other', 'onboarding_source_other'],
];

function Step5Source({ t, source, onSelect, why, onWhyChange, ageConfirmed, onAgeChange, onOpenLegal }) {
  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step5_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step5_sub')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '22px' }}>
        {SOURCE_KEYS.map(([key, labelKey]) => (
          <ChoiceCard key={key} label={t(labelKey)} selected={source === key} onClick={() => onSelect(key)} multi={false} center />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 18px' }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--c-1a1a1a)' }} />
        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-555)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{t('onboarding_optional_divider')}</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--c-1a1a1a)' }} />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: 'var(--c-888)', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>{t('onboarding_why_label')}</div>
        <textarea
          value={why}
          onChange={e => onWhyChange(e.target.value)}
          placeholder={t('onboarding_why_placeholder')}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', borderRadius: '16px', border: CARD_BORDER, backgroundColor: CARD_BG, cursor: 'pointer' }}>
        <input type="checkbox" checked={ageConfirmed} onChange={e => onAgeChange(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0, accentColor: ORANGE }} />
        <span style={{ fontSize: '13px', color: 'var(--c-ccc)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--c-white)' }}>{t('onboarding_age_checkbox')}</strong>
          <br />
          <span style={{ color: 'var(--c-666)' }}>
            {t('onboarding_age_gambling_note')} {t('landing_footer_help_name')} — {t('landing_footer_help_contact')}
          </span>
        </span>
      </label>
      {onOpenLegal && (
        <p style={{ color: 'var(--c-444)', fontSize: '11.5px', textAlign: 'center', margin: '16px 0 0', lineHeight: 1.5 }}>
          {t('auth_legal_prefix')}{' '}
          <button type="button" onClick={() => onOpenLegal('terms')} style={{ background: 'none', border: 'none', color: 'var(--c-666)', textDecoration: 'underline', cursor: 'pointer', fontSize: '11.5px', padding: 0 }}>{t('landing_footer_legal_terms')}</button>
          {' '}{t('auth_legal_and')}{' '}
          <button type="button" onClick={() => onOpenLegal('privacy')} style={{ background: 'none', border: 'none', color: 'var(--c-666)', textDecoration: 'underline', cursor: 'pointer', fontSize: '11.5px', padding: 0 }}>{t('landing_footer_legal_privacy')}</button>.
        </p>
      )}
    </>
  );
}

// ===================== Carrousel de presentation (Partie A, derriere ONBOARDING_INTRO_SLIDES_ENABLED) =====================
// Code conserve tel quel (voir onboardingConfig.js) -- non supprime, simplement non monte par
// defaut. ExampleBadge/BankrollDemoCard/StatsDemoCard/PoolDemoCard : cartes de demonstration
// construites avec de vrais composants (MiniSparkline) et des donnees d'EXEMPLE etiquetees,
// jamais un vrai compte/pari/pool de l'utilisateur.

const carteDemoStyle = { backgroundColor: CARD_BG, borderRadius: '20px', border: CARD_BORDER, padding: '20px', width: '100%', maxWidth: '300px', boxSizing: 'border-box' };

function ExampleBadge({ t }) {
  return (
    <span style={{ display: 'inline-block', marginBottom: '10px', padding: '3px 10px', borderRadius: '20px', backgroundColor: 'var(--c-1a1a1a)', color: 'var(--c-666)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
      {t('onboarding_example_badge')}
    </span>
  );
}

function BankrollDemoCard({ t }) {
  const points = useMemo(() => [420, 460, 430, 505, 482].map(value => ({ value })), []);
  return (
    <div style={carteDemoStyle}>
      <ExampleBadge t={t} />
      <div style={{ fontSize: '11px', color: 'var(--c-555)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{t('onboarding_demo_balance_label')}</div>
      <div style={{ fontSize: '30px', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-1px', marginBottom: '8px' }}>$482.00</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--c-666)', marginBottom: '14px' }}>
        <span>{t('bank_at_risk_label')}</span>
        <span style={{ color: 'var(--c-white)', fontWeight: '700' }}>$65.00</span>
      </div>
      <MiniSparkline points={points} color={ORANGE} height={46} />
    </div>
  );
}

function StatsDemoCard({ t }) {
  const barres = [
    [t('onboarding_demo_stat_l5'), 80],
    [t('onboarding_demo_stat_l10'), 65],
    [t('onboarding_demo_stat_l20'), 58],
  ];
  return (
    <div style={carteDemoStyle}>
      <ExampleBadge t={t} />
      <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--c-white)', marginBottom: '2px' }}>{t('onboarding_demo_player_name')}</div>
      <div style={{ fontSize: '12px', color: 'var(--c-666)', marginBottom: '14px' }}>{t('onboarding_demo_stat_market')}</div>
      {barres.map(([label, pct]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-555)', width: '66px', flexShrink: 0, textAlign: 'left' }}>{label}</span>
          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--c-1a1a1a)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: ORANGE, borderRadius: '3px' }} />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--c-888)', width: '28px', textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
        </div>
      ))}
    </div>
  );
}

const POOL_DEMO_ROWS = [
  { rank: 1, nom: 'Alex', pts: 142 },
  { rank: 2, nom: 'Sam', pts: 138 },
  { rank: 3, nom: 'Jordan', pts: 121 },
];

function PoolDemoCard({ t }) {
  return (
    <div style={carteDemoStyle}>
      <ExampleBadge t={t} />
      <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--c-white)', marginBottom: '8px' }}>{t('onboarding_demo_pool_title')}</div>
      {POOL_DEMO_ROWS.map(r => (
        <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: r.rank > 1 ? '1px solid var(--c-111)' : 'none' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: r.rank === 1 ? ORANGE : 'var(--c-1a1a1a)', color: r.rank === 1 ? 'white' : 'var(--c-888)', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{r.rank}</div>
          <div style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: 'var(--c-white)', textAlign: 'left' }}>{r.nom}</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-888)' }}>{r.pts} pts</div>
        </div>
      ))}
    </div>
  );
}

function OnboardingCarousel({ t, previewMode, onDone }) {
  const [index, setIndex] = useState(0);
  const startXRef = useRef(null);

  const slides = [
    { titre1: t('onboarding_slide1_title_1'), titre2: t('onboarding_slide1_title_2'), description: t('onboarding_slide1_desc'), Demo: BankrollDemoCard },
    { titre1: t('onboarding_slide2_title_1'), titre2: t('onboarding_slide2_title_2'), description: t('onboarding_slide2_desc'), Demo: StatsDemoCard },
    { titre1: t('onboarding_slide3_title_1'), titre2: t('onboarding_slide3_title_2'), description: t('onboarding_slide3_desc'), Demo: PoolDemoCard },
  ];
  const slide = slides[index];
  const Demo = slide.Demo;

  function onTouchStart(e) { startXRef.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (startXRef.current == null) return;
    const delta = e.changedTouches[0].clientX - startXRef.current;
    if (delta < -40 && index < slides.length - 1) setIndex(index + 1);
    else if (delta > 40 && index > 0) setIndex(index - 1);
    startXRef.current = null;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--c-080808)', color: 'var(--c-white)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {previewMode && <PreviewBadge t={t} />}
      <div
        role="group"
        aria-roledescription="carousel"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px 16px', textAlign: 'center', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
      >
        <h1 style={{ margin: '0 0 26px', fontSize: 'clamp(26px, 6vw, 34px)', fontWeight: '900', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
          <span style={{ display: 'block', color: 'var(--c-666)' }}>{slide.titre1}</span>
          <span style={{ display: 'block', color: 'var(--c-white)' }}>{slide.titre2}</span>
        </h1>
        <Demo t={t} />
        <p style={{ margin: '22px 0 0', color: 'var(--c-666)', fontSize: '14px', lineHeight: 1.5, maxWidth: '340px' }}>{slide.description}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '7px', padding: '18px 0' }}>
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            style={{ width: i === index ? '20px' : '7px', height: '7px', borderRadius: '4px', border: 'none', padding: 0, cursor: 'pointer', backgroundColor: i === index ? ORANGE : 'var(--c-333)', transition: 'all 0.2s ease' }}
          />
        ))}
      </div>

      <div style={{ padding: '0 20px calc(20px + env(safe-area-inset-bottom))', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button onClick={onDone} style={primaryBtnStyle}>{t('onboarding_get_started')}</button>
        <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '6px', minHeight: '32px' }}>{t('onboarding_skip')}</button>
      </div>
    </div>
  );
}

// ===================== Composant principal =====================

// `utilisateur` : nullable desormais -- null tant qu'aucun compte n'existe (visiteur en train de
// repondre aux 5 etapes avant inscription). `previewMode` : voir le commentaire de tete de
// fichier -- bloque TOUTE ecriture (Supabase ET localStorage). `onComplete(reponses)` : appele
// une seule fois a la toute fin -- c'est App.js qui decide de la suite (enchainer vers
// l'inscription si `utilisateur` est absent, retourner a l'accueil sinon/en apercu).
// `onSignIn` (optionnel) : "J'ai deja un compte" -- vide les reponses locales et bascule vers la
// connexion, jamais vers l'inscription.
// `step`/`onStepChange`/`onBackToHome` (tous optionnels, lies entre eux -- voir src/App.js) :
// etape CONTROLEE par le parent pour brancher chaque etape sur l'historique du navigateur (bouton
// retour du navigateur/telephone recule d'une etape, voir la refonte du 27 nov 2026). Sans ces
// props (mode apercu, ?onboarding=preview -- voir src/App.js), l'etape reste un etat interne
// classique, AUCUNE interaction avec l'historique : comportement du carrousel/des etapes en
// apercu totalement inchange.
export function OnboardingFlow({ utilisateur, lang = 'fr', previewMode = false, onComplete, onSignIn, step: controlledStep, onStepChange, onBackToHome, onOpenLegal }) {
  const t = getT(lang);
  const [phase, setPhase] = useState(ONBOARDING_INTRO_SLIDES_ENABLED ? 'carousel' : 'steps');
  const [internalStep, setInternalStep] = useState(1);
  const estControlee = controlledStep != null;
  const step = estControlee ? controlledStep : internalStep;

  const [province, setProvince] = useState('CA-QC');
  const [selectedKinds, setSelectedKinds] = useState([]);
  const [betSize, setBetSize] = useState(null);
  const [goals, setGoals] = useState([]);
  const [experience, setExperience] = useState(null);
  const [source, setSource] = useState(null);
  const [why, setWhy] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState('');

  // Avance vers l'etape `n` -- toujours une transition AVANT (y compris "Je n'ai aucun compte",
  // qui saute l'etape 1 sans repondre) : en mode controle, c'est le parent (src/App.js) qui fait
  // le pushState (nouvelle entree d'historique), jamais ce composant directement.
  function irVersEtape(n) {
    if (estControlee) onStepChange(n);
    else setInternalStep(n);
  }

  function toggleKind(kind) {
    setSelectedKinds(prev => prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]);
  }

  function skipStep1() {
    setSelectedKinds([]);
    irVersEtape(2);
  }

  function toggleGoal(key) {
    setGoals(prev => prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]);
  }

  // Etape 1 : au moins un bookmaker OU le lien "Je n'ai aucun compte" (court-circuite cette
  // exigence, jamais le bouton Continuer lui-meme). Etapes 2 a 4 : une reponse est requise
  // (tranche de mise / au moins un objectif / niveau d'experience). Etape 5 : case 18+ ET une
  // source choisie, les deux a la fois (demande explicite).
  const peutContinuer = step === 1 ? selectedKinds.length > 0
    : step === 2 ? betSize != null
    : step === 3 ? goals.length > 0
    : step === 4 ? experience != null
    : ageConfirmed && source != null;

  async function finalize() {
    const reponses = {
      province, bookmakers: selectedKinds, betSize, goals, experience, source,
      whyTryBetrics: why.trim() || null, ageConfirmed: true,
    };

    // MODE APERCU : aucune ecriture nulle part, jamais -- ni Supabase, ni localStorage.
    if (previewMode) { onComplete(reponses); return; }

    if (!utilisateur) {
      // Pas encore de compte : on garde les reponses en localStorage, App.js enchaine vers
      // l'inscription puis les appliquera au premier login (voir le commentaire de tete de
      // fichier) -- aucune ecriture Supabase ici.
      saveLocalOnboardingAnswers(reponses);
      onComplete(reponses);
      return;
    }

    // Chemin de repli : utilisateur deja connecte, onboarding pas termine, aucune reponse locale
    // trouvee par App.js (sinon App.js les aurait deja appliquees sans jamais monter ce
    // composant) -- ecrit directement, memes regles (comptes a 0$, aucun depot invente).
    setSubmitting(true);
    setErreur('');
    try {
      for (const kind of selectedKinds) {
        const label = kind === 'other' ? t('bank_account_other') : (ACCOUNT_KIND_OPTIONS.find(o => o.kind === kind)?.label || kind);
        const { error } = await supabase.from('bankroll_accounts').insert({ user_id: utilisateur.id, name: label, kind });
        if (error) throw error;
      }
      const { error: errProfil } = await supabase.from('profiles').upsert({
        id: utilisateur.id,
        onboarding_completed: true,
        onboarding_answers: reponses,
        onboarding_completed_at: new Date().toISOString(),
      });
      if (errProfil) throw errProfil;
      onComplete(reponses);
    } catch (e) {
      setErreur(e.message || String(e));
      setSubmitting(false);
    }
  }

  if (phase === 'carousel') {
    return <OnboardingCarousel t={t} previewMode={previewMode} onDone={() => setPhase('steps')} />;
  }

  // Recule d'une etape : en mode controle, un vrai `history.back()` -- le parent (src/App.js)
  // ecoute `popstate` et redescend la prop `step` en consequence, jamais un nouveau pushState ici
  // (ce serait une entree d'historique AVANT, pas un retour). Etape 1 : pas de precedente, bascule
  // vers `onBackToHome` si fourni (nouvelle fleche retour "accueil", demande explicite).
  function goBack() {
    if (step > 1) {
      if (estControlee) window.history.back();
      else setInternalStep(step - 1);
    } else if (onBackToHome) {
      onBackToHome();
    }
  }

  function goNext() {
    if (step < TOTAL_STEPS) irVersEtape(step + 1);
    else finalize();
  }

  const contenuEtape = step === 1
    ? <Step1Bookmakers t={t} selectedKinds={selectedKinds} onToggle={toggleKind} onSkip={skipStep1} province={province} onProvinceChange={setProvince} />
    : step === 2
    ? <Step2BetSize t={t} betSize={betSize} onSelect={setBetSize} />
    : step === 3
    ? <Step3Goals t={t} goals={goals} onToggle={toggleGoal} />
    : step === 4
    ? <Step4Experience t={t} experience={experience} onSelect={setExperience} />
    : <Step5Source t={t} source={source} onSelect={setSource} why={why} onWhyChange={setWhy} ageConfirmed={ageConfirmed} onAgeChange={setAgeConfirmed} onOpenLegal={onOpenLegal} />;

  function handleSignIn() {
    clearLocalOnboardingAnswers();
    onSignIn();
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--c-080808)', color: 'var(--c-white)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        @keyframes onboarding-step-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        .onboarding-step-content { animation: onboarding-step-in 0.2s ease; }
      `}</style>
      <StepHeader t={t} step={step} onBack={goBack} previewMode={previewMode} onSignIn={!utilisateur && onSignIn ? handleSignIn : null} showBackAtStep1={!!onBackToHome} />
      <div key={step} className="onboarding-step-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {contenuEtape}
        {erreur && <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '16px' }}>{erreur}</div>}
      </div>
      <div style={{ padding: '16px 20px calc(16px + env(safe-area-inset-bottom))', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <button onClick={goNext} disabled={!peutContinuer || submitting} style={{ ...primaryBtnStyle, opacity: (!peutContinuer || submitting) ? 0.4 : 1, cursor: (!peutContinuer || submitting) ? 'default' : 'pointer' }}>
          {submitting ? t('saving_text') : step === TOTAL_STEPS ? t('onboarding_create_account_btn') : t('onboarding_continue')}
        </button>
      </div>
    </div>
  );
}

export default OnboardingFlow;
