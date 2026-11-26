import React, { useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { ACCOUNT_KIND_OPTIONS } from './AddAccountBody';
import { MiniSparkline } from './Bankroll';

// ===================== Onboarding des nouveaux utilisateurs =====================
// Structure inspiree d'OddsJam (carrousel de 3 diapos PUIS 5 etapes de configuration) -- aucun
// texte, graphique, logo ni couleur copie : design system Betrics (fond sombre, accent orange
// #f97316), copie et donnees d'exemple propres a Betrics. Voir src/onboardingConfig.js (drapeau
// ONBOARDING_ENABLED) et src/App.js (seul endroit qui decide de l'afficher -- apres la premiere
// connexion, tant que `profiles.onboarding_completed` est false, ou en MODE APERCU via
// ?onboarding=preview, voir plus bas).
//
// `previewMode` (true quand l'URL contient ?onboarding=preview) : AUCUNE ecriture Supabase nulle
// part dans ce fichier ne doit s'executer quand previewMode est vrai -- ni compte bankroll, ni
// transaction, ni mise a jour de profiles. `finalize()` ci-dessous court-circuite explicitement
// avant le moindre appel reseau dans ce cas. Une pastille "Mode apercu" (PreviewBadge) reste
// visible sur toutes les diapos/etapes pour que ce soit toujours evident a l'ecran.
//
// Toutes les ecritures reelles (comptes bankroll + depot initial + profil) n'ont lieu qu'UNE
// SEULE FOIS, a la toute fin (bouton "Terminer" de l'etape 5) -- les etapes 1 a 4 se contentent
// d'accumuler les reponses dans l'etat local de ce composant. Ce choix evite les comptes
// dupliques/orphelins si l'utilisateur revient en arriere et change ses reponses (navigation
// libre demandee entre les etapes 1 a 4).

const ORANGE = '#f97316';
const TOTAL_STEPS = 5;

const carteStyle = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '20px', border: '1px solid var(--c-161616)', padding: '20px', width: '100%', maxWidth: '300px', boxSizing: 'border-box' };
const primaryBtnStyle = { width: '100%', padding: '15px', minHeight: '50px', boxSizing: 'border-box', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' };
const inputStyle = { width: '100%', padding: '12px 14px', backgroundColor: 'var(--c-0d0d0d)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };

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

// Pastille persistante en MODE APERCU (jamais en navigation normale) -- voir le commentaire de
// tete de fichier : rappelle visuellement, sur chaque diapo/etape, qu'aucune donnee n'est ecrite.
function PreviewBadge({ t }) {
  return (
    <div style={{ position: 'fixed', top: 'calc(10px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.45)', color: ORANGE, fontSize: '10.5px', fontWeight: '800', padding: '5px 14px', borderRadius: '20px', zIndex: 3000, letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {t('onboarding_preview_badge')}
    </div>
  );
}

// ===================== Cartes de demonstration (carrousel) =====================
// Construites avec de vrais composants/elements de l'app (MiniSparkline -- src/Bankroll.js --
// memes libelles "En jeu"/"Disponible" que la page de compte) et des donnees d'EXEMPLE
// clairement etiquetees, jamais un vrai compte/pari/pool de l'utilisateur. Aucune photo de
// joueur ni logo de ligue (demande explicite pour la diapo stats).

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
    <div style={carteStyle}>
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
    <div style={carteStyle}>
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

// Prenoms inventes (pas de vraie personne) -- classement de pool fictif, voir la demande.
const POOL_DEMO_ROWS = [
  { rank: 1, nom: 'Alex', pts: 142 },
  { rank: 2, nom: 'Sam', pts: 138 },
  { rank: 3, nom: 'Jordan', pts: 121 },
];

function PoolDemoCard({ t }) {
  return (
    <div style={carteStyle}>
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

// ===================== Partie A : carrousel de presentation =====================

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

// ===================== Partie B : en-tete + barre de progression partagees =====================

function StepHeader({ t, step, onBack, previewMode }) {
  return (
    <div>
      {previewMode && <PreviewBadge t={t} />}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px', alignItems: 'center', padding: '14px 16px 0', paddingTop: 'calc(14px + env(safe-area-inset-top))' }}>
        <div>
          {step > 1 && (
            <button onClick={onBack} aria-label={t('onboarding_back_aria')} style={{ background: 'none', border: 'none', color: 'var(--c-white)', cursor: 'pointer', padding: '8px', display: 'flex' }}>
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
    </div>
  );
}

function ChoiceCard({ label, selected, onClick, multi = true }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        padding: '15px 16px', minHeight: '52px', boxSizing: 'border-box', borderRadius: '14px',
        border: selected ? `2px solid ${ORANGE}` : '1px solid var(--c-222)',
        backgroundColor: selected ? 'rgba(249,115,22,0.08)' : 'var(--c-0d0d0d)',
        color: 'var(--c-white)', cursor: 'pointer', fontSize: '14px', fontWeight: '700', textAlign: 'left', width: '100%',
      }}
    >
      <span>{label}</span>
      {multi ? (
        <span style={{ width: '20px', height: '20px', borderRadius: '6px', border: selected ? 'none' : '1.5px solid var(--c-333)', backgroundColor: selected ? ORANGE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {selected && <IconCheck />}
        </span>
      ) : (
        <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: selected ? `6px solid ${ORANGE}` : '1.5px solid var(--c-333)', flexShrink: 0 }} />
      )}
    </button>
  );
}

// ===================== Etape 1 : bookmakers =====================

function Step1Bookmakers({ t, selectedKinds, onToggle, onSkip }) {
  const [recherche, setRecherche] = useState('');
  const optionsFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return ACCOUNT_KIND_OPTIONS.filter(o => !q || o.label.toLowerCase().includes(q));
  }, [recherche]);

  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step1_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step1_sub')}</p>
      <input
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder={t('onboarding_step1_search_placeholder')}
        style={{ ...inputStyle, marginBottom: '16px' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {optionsFiltrees.map(o => (
          <ChoiceCard key={o.kind} label={o.label} selected={selectedKinds.includes(o.kind)} onClick={() => onToggle(o.kind)} />
        ))}
        {(!recherche || t('bank_account_kind_other').toLowerCase().includes(recherche.trim().toLowerCase())) && (
          <ChoiceCard key="other" label={t('bank_account_kind_other')} selected={selectedKinds.includes('other')} onClick={() => onToggle('other')} />
        )}
      </div>
      <button onClick={onSkip} style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '6px' }}>
        {t('onboarding_step1_no_account')}
      </button>
    </>
  );
}

// ===================== Etape 2 : bankroll de depart =====================

function Step2Bankroll({ t, kindsAConfigurer, amounts, onAmountChange }) {
  const aucunChoisi = kindsAConfigurer.length === 0;
  const lignes = aucunChoisi
    ? [{ kind: 'other', label: t('onboarding_step2_other_account_name') }]
    : kindsAConfigurer.map(kind => ({ kind, label: kind === 'other' ? t('bank_account_kind_other') : (ACCOUNT_KIND_OPTIONS.find(o => o.kind === kind)?.label || kind) }));

  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step2_title')}</h1>
      <p style={sousTitreStyle}>{aucunChoisi ? t('onboarding_step2_other_sub') : t('onboarding_step2_sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {lignes.map(l => (
          <div key={l.kind}>
            <div style={{ color: 'var(--c-888)', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>{l.label}</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-555)', fontSize: '14px', pointerEvents: 'none' }}>$</span>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={amounts[l.kind] ?? ''}
                onChange={e => onAmountChange(l.kind, e.target.value)}
                placeholder={t('onboarding_step2_amount_placeholder')}
                style={{ ...inputStyle, paddingLeft: '26px' }}
              />
            </div>
          </div>
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
  ['beginner', 'onboarding_exp_beginner'],
  ['intermediate', 'onboarding_exp_intermediate'],
  ['advanced', 'onboarding_exp_advanced'],
];

function Step4Experience({ t, experience, onSelect }) {
  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step4_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step4_sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {EXPERIENCE_KEYS.map(([key, labelKey]) => (
          <ChoiceCard key={key} label={t(labelKey)} selected={experience === key} onClick={() => onSelect(key)} multi={false} />
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

function Step5Source({ t, source, onSelect, why, onWhyChange, ageConfirmed, onAgeChange }) {
  return (
    <>
      <h1 style={titreStyle}>{t('onboarding_step5_title')}</h1>
      <p style={sousTitreStyle}>{t('onboarding_step5_sub')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
        {SOURCE_KEYS.map(([key, labelKey]) => (
          <ChoiceCard key={key} label={t(labelKey)} selected={source === key} onClick={() => onSelect(key)} multi={false} />
        ))}
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
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', borderRadius: '14px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-0d0d0d)', cursor: 'pointer' }}>
        <input type="checkbox" checked={ageConfirmed} onChange={e => onAgeChange(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0, accentColor: ORANGE }} />
        <span style={{ fontSize: '13px', color: 'var(--c-ccc)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--c-white)' }}>{t('onboarding_age_checkbox')}</strong>
          <br />
          <span style={{ color: 'var(--c-666)' }}>
            {t('onboarding_age_gambling_note')} {t('landing_footer_help_name')} — {t('landing_footer_help_contact')}
          </span>
        </span>
      </label>
    </>
  );
}

const titreStyle = { margin: '4px 0 8px', fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-0.5px', lineHeight: 1.2 };
const sousTitreStyle = { margin: '0 0 24px', fontSize: '14px', color: 'var(--c-666)', lineHeight: 1.5 };

// ===================== Composant principal =====================

// `utilisateur` : l'utilisateur authentifie (src/App.js). `previewMode` : voir le commentaire de
// tete de fichier -- gate TOUTE ecriture Supabase. `onComplete` : appele une fois a la toute fin
// (bouton "Terminer"), aussi bien en navigation normale (apres ecriture reussie) qu'en mode
// apercu (aucune ecriture) -- c'est App.js qui decide quoi faire ensuite dans les deux cas
// (marquer l'onboarding complete localement vs simplement retirer ?onboarding=preview de l'URL).
export function OnboardingFlow({ utilisateur, lang = 'fr', previewMode = false, onComplete }) {
  const t = getT(lang);
  const [phase, setPhase] = useState('carousel'); // 'carousel' | 'steps'
  const [step, setStep] = useState(1);

  const [selectedKinds, setSelectedKinds] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [goals, setGoals] = useState([]);
  const [experience, setExperience] = useState(null);
  const [source, setSource] = useState(null);
  const [why, setWhy] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState('');

  function toggleKind(kind) {
    setSelectedKinds(prev => prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]);
  }

  function skipStep1() {
    setSelectedKinds([]);
    setStep(2);
  }

  function setAmount(kind, valeur) {
    setAmounts(prev => ({ ...prev, [kind]: valeur }));
  }

  function toggleGoal(key) {
    setGoals(prev => prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]);
  }

  // Etapes 1 a 4 : toujours possible d'avancer SAUF a l'etape 1 sans aucun bookmaker choisi (le
  // lien "Je n'ai aucun compte" contourne cette exigence via skipStep1, jamais le bouton
  // Continuer lui-meme). Etape 5 : la case 18+ est la SEULE exigence, voir ageConfirmed.
  const peutContinuer = step === 1 ? selectedKinds.length > 0 : step === 5 ? ageConfirmed : true;

  async function finalize() {
    // MODE APERCU : aucune ecriture, jamais -- voir le commentaire de tete de fichier.
    if (previewMode) { onComplete(); return; }
    setSubmitting(true);
    setErreur('');
    try {
      const kindsACreer = selectedKinds.length > 0 ? selectedKinds : ['other'];
      for (const kind of kindsACreer) {
        const label = kind === 'other' ? t('bank_account_other') : (ACCOUNT_KIND_OPTIONS.find(o => o.kind === kind)?.label || kind);
        const { data: compte, error } = await supabase.from('bankroll_accounts')
          .insert({ user_id: utilisateur.id, name: label, kind }).select().single();
        if (error) throw error;
        const montant = parseFloat(amounts[kind]);
        if (montant > 0) {
          const { error: errTx } = await supabase.from('bankroll_transactions')
            .insert({ user_id: utilisateur.id, account_id: compte.id, type: 'deposit', amount: montant, note: t('bank_initial_balance_note') });
          if (errTx) throw errTx;
        }
      }

      const reponses = {
        bookmakers: kindsACreer,
        amounts,
        goals,
        experience,
        source,
        whyTryBetrics: why.trim() || null,
        ageConfirmed: true,
      };
      const { error: errProfil } = await supabase.from('profiles').upsert({
        id: utilisateur.id,
        onboarding_completed: true,
        onboarding_answers: reponses,
        onboarding_completed_at: new Date().toISOString(),
      });
      if (errProfil) throw errProfil;

      onComplete();
    } catch (e) {
      setErreur(e.message || String(e));
      setSubmitting(false);
    }
  }

  if (phase === 'carousel') {
    return <OnboardingCarousel t={t} previewMode={previewMode} onDone={() => setPhase('steps')} />;
  }

  function goBack() {
    if (step > 1) setStep(step - 1);
  }

  function goNext() {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else finalize();
  }

  const contenuEtape = step === 1
    ? <Step1Bookmakers t={t} selectedKinds={selectedKinds} onToggle={toggleKind} onSkip={skipStep1} />
    : step === 2
    ? <Step2Bankroll t={t} kindsAConfigurer={selectedKinds} amounts={amounts} onAmountChange={setAmount} />
    : step === 3
    ? <Step3Goals t={t} goals={goals} onToggle={toggleGoal} />
    : step === 4
    ? <Step4Experience t={t} experience={experience} onSelect={setExperience} />
    : <Step5Source t={t} source={source} onSelect={setSource} why={why} onWhyChange={setWhy} ageConfirmed={ageConfirmed} onAgeChange={setAgeConfirmed} />;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--c-080808)', color: 'var(--c-white)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <StepHeader t={t} step={step} onBack={goBack} previewMode={previewMode} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {contenuEtape}
        {erreur && <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '16px' }}>{erreur}</div>}
      </div>
      <div style={{ padding: '16px 20px calc(16px + env(safe-area-inset-bottom))', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <button onClick={goNext} disabled={!peutContinuer || submitting} style={{ ...primaryBtnStyle, opacity: (!peutContinuer || submitting) ? 0.45 : 1, cursor: (!peutContinuer || submitting) ? 'default' : 'pointer' }}>
          {submitting ? t('saving_text') : step === TOTAL_STEPS ? t('onboarding_finish') : t('onboarding_continue')}
        </button>
      </div>
    </div>
  );
}

export default OnboardingFlow;
