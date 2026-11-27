import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import {
  COUNTRIES, REGIONS_BY_COUNTRY, USERNAME_REGEX, RESERVED_USERNAMES, minimumAgeFor, computeAge,
} from './profileConfig';

// ===================== Porte d'entree "Complete ton profil" (refonte du 27 nov 2026) =====
// Meme style visuel que src/Onboarding.js (fond quasi noir, cartes bleu-gris tres sombre, accent
// orange, bouton plein largeur fixe en bas) -- etape OBLIGATOIRE juste apres l'authentification
// (Google OU courriel), AVANT l'onboarding des 5 etapes, voir src/App.js (seul endroit qui decide
// quand l'afficher, selon profiles.profile_completed_at IS NULL). Corrige le trou ou un compte
// cree via Google arrivait directement dans l'app sans jamais remplir de profil ni repondre a
// l'onboarding.
//
// `utilisateur` est TOUJOURS present ici (contrairement a src/Onboarding.js, qui peut s'afficher
// avant meme la creation du compte) -- cette etape n'existe qu'APRES authentification, jamais
// avant. Ecrit directement dans Supabase (jamais dans localStorage comme l'onboarding pre-compte).

const ORANGE = '#f97316';
const CARD_BG = '#121824';
const CARD_BORDER = '1px solid #232b3a';

const inputStyle = { width: '100%', padding: '13px 14px', backgroundColor: CARD_BG, border: CARD_BORDER, borderRadius: '14px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--c-888)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' };
const primaryBtnStyle = { width: '100%', padding: '16px', minHeight: '52px', boxSizing: 'border-box', backgroundColor: ORANGE, color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' };
const titreStyle = { margin: '4px 0 6px', fontSize: 'clamp(24px, 6vw, 30px)', fontWeight: '900', color: 'var(--c-white)', letterSpacing: '-0.5px', lineHeight: 1.2 };
const sousTitreStyle = { margin: '0 0 24px', fontSize: '14px', color: 'var(--c-666)', lineHeight: 1.5 };

// Google (via Supabase) peuple generalement given_name/family_name ; a defaut, decoupe
// full_name/name sur le premier espace -- jamais invente si rien n'est fourni.
function nomsDepuisMetadata(utilisateur) {
  const meta = utilisateur?.user_metadata || {};
  if (meta.given_name || meta.family_name) {
    return { prenom: meta.given_name || '', nom: meta.family_name || '' };
  }
  const full = (meta.full_name || meta.name || '').trim();
  if (!full) return { prenom: '', nom: '' };
  const mots = full.split(/\s+/);
  return { prenom: mots[0] || '', nom: mots.slice(1).join(' ') };
}

export default function ProfileSetup({ utilisateur, lang = 'fr', onComplete, onLogout, onOpenLegal }) {
  const t = getT(lang);
  const prefill = useMemo(() => nomsDepuisMetadata(utilisateur), [utilisateur]);

  const [firstName, setFirstName] = useState(prefill.prenom);
  const [lastName, setLastName] = useState(prefill.nom);
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const [country, setCountry] = useState('CA');
  const [region, setRegion] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargementProfil, setChargementProfil] = useState(true);

  // Precharge un profil existant mais incomplet (compte cree avant cette refonte) -- ne remplace
  // les valeurs deduites de user_metadata que si la base a deja quelque chose de plus precis.
  useEffect(() => {
    let annule = false;
    if (!utilisateur?.id) { setChargementProfil(false); return undefined; }
    (async () => {
      const { data } = await supabase.from('profiles').select('first_name, last_name, username').eq('id', utilisateur.id).single();
      if (annule) return;
      if (data?.first_name) setFirstName(data.first_name);
      if (data?.last_name) setLastName(data.last_name);
      if (data?.username) { setUsername(data.username); setOriginalUsername(data.username); }
      setChargementProfil(false);
    })();
    return () => { annule = true; };
  }, [utilisateur?.id]);

  // Validation de forme instantanee + verification de disponibilite avec debounce de 400 ms
  // (RPC is_username_available, voir supabase/migrations/20261127_profile_setup.sql) -- jamais
  // appelee pour le nom d'utilisateur DEJA enregistre et inchange (sinon la RPC le signalerait
  // "deja pris" puisqu'il appartient bien a une ligne existante -- la sienne).
  useEffect(() => {
    if (!username) { setUsernameStatus('idle'); return undefined; }
    if (originalUsername && username === originalUsername) { setUsernameStatus('available'); return undefined; }
    if (!USERNAME_REGEX.test(username) || RESERVED_USERNAMES.includes(username.toLowerCase())) {
      setUsernameStatus('invalid');
      return undefined;
    }
    setUsernameStatus('checking');
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
      setUsernameStatus(error ? 'invalid' : (data ? 'available' : 'taken'));
    }, 400);
    return () => clearTimeout(handle);
  }, [username, originalUsername]);

  const regionsDisponibles = REGIONS_BY_COUNTRY[country] || [];
  const age = useMemo(() => computeAge(birthDate), [birthDate]);
  const ageMinimum = minimumAgeFor(country, region);
  const sousAgeMinimum = !!(birthDate && region && age != null && age < ageMinimum);

  const peutContinuer = !!(
    firstName.trim() && lastName.trim() && usernameStatus === 'available' &&
    country && region && birthDate && !sousAgeMinimum && accepted && !submitting
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!peutContinuer) return;
    setSubmitting(true);
    setErreur('');
    const { error } = await supabase.from('profiles').upsert({
      id: utilisateur.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username,
      country,
      region,
      birth_date: birthDate,
      profile_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setErreur(t('auth_error_generic'));
      setSubmitting(false);
      return;
    }
    onComplete();
  }

  if (chargementProfil) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--c-080808)' }} />;
  }

  const usernameMessage = usernameStatus === 'checking' ? t('profile_setup_username_checking')
    : usernameStatus === 'available' ? t('profile_setup_username_available')
    : usernameStatus === 'taken' ? t('profile_setup_username_taken')
    : usernameStatus === 'invalid' ? t('profile_setup_username_invalid')
    : null;
  const usernameColor = usernameStatus === 'available' ? '#22c55e' : (usernameStatus === 'taken' || usernameStatus === 'invalid') ? '#ef4444' : 'var(--c-666)';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--c-080808)', color: 'var(--c-white)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', paddingTop: 'calc(16px + env(safe-area-inset-top))', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <img src="/logo192.png" alt="Betrics" width="28" height="28" style={{ borderRadius: '8px' }} />
        {onLogout && (
          <button type="button" onClick={onLogout} style={{ background: 'none', border: 'none', color: 'var(--c-666)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '6px' }}>
            {t('profile_setup_logout')}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={titreStyle}>{t('profile_setup_title')}</h1>
          <p style={sousTitreStyle}>{t('profile_setup_sub')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('profile_first_name')}</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('profile_first_name_ph')} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('profile_last_name')}</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('profile_last_name_ph')} required style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t('profile_username')}</label>
          <input value={username} onChange={e => setUsername(e.target.value.trim())} placeholder={t('profile_username_ph')} required style={inputStyle} maxLength={20} />
          {usernameMessage && <div style={{ marginTop: '6px', fontSize: '12.5px', fontWeight: '600', color: usernameColor }}>{usernameMessage}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('profile_setup_country_label')}</label>
            <select value={country} onChange={e => { setCountry(e.target.value); setRegion(''); }} style={selectStyle}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{t(c.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('profile_setup_region_label')}</label>
            <select value={region} onChange={e => setRegion(e.target.value)} required style={selectStyle}>
              <option value="" disabled>{t('profile_setup_select_placeholder')}</option>
              {regionsDisponibles.map(r => <option key={r.code} value={r.code}>{t(r.labelKey)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t('profile_setup_birthdate_label')}</label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required style={inputStyle} />
          {sousAgeMinimum && (
            <div style={{ marginTop: '8px', padding: '12px 14px', borderRadius: '12px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{t('profile_setup_age_blocked').replace('{age}', ageMinimum)}</p>
            </div>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', borderRadius: '16px', border: CARD_BORDER, backgroundColor: CARD_BG, cursor: 'pointer' }}>
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0, accentColor: ORANGE }} />
          <span style={{ fontSize: '13px', color: 'var(--c-ccc)', lineHeight: 1.5 }}>
            {t('profile_setup_legal_checkbox_prefix')}{' '}
            <button type="button" onClick={() => onOpenLegal && onOpenLegal('terms')} style={{ background: 'none', border: 'none', color: ORANGE, textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 }}>{t('landing_footer_legal_terms')}</button>
            {' '}{t('profile_setup_legal_and')}{' '}
            <button type="button" onClick={() => onOpenLegal && onOpenLegal('privacy')} style={{ background: 'none', border: 'none', color: ORANGE, textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 }}>{t('landing_footer_legal_privacy')}</button>.
          </span>
        </label>

        {erreur && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{erreur}</p>
          </div>
        )}

        <button type="submit" disabled={!peutContinuer} style={{ ...primaryBtnStyle, opacity: peutContinuer ? 1 : 0.4, cursor: peutContinuer ? 'pointer' : 'default', marginTop: '4px' }}>
          {submitting ? t('saving_text') : t('profile_setup_submit')}
        </button>
      </form>
    </div>
  );
}
