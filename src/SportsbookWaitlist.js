import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from './useIsMobile';
import { BottomSheet } from './BottomSheet';
import { SPORTSBOOKS } from './sportsbooksConfig';
import { supabase } from './supabase';

// "Ajouter un sportsbook" (style Wealthsimple "Add account") : AUCUNE connexion reelle n'existe
// encore (pas d'API officielle de bet365/Betway/BET99/Sports Interaction, pas de scraping,
// jamais de mot de passe sportsbook demande ici) -- cette feuille/modale permet seulement
// d'enregistrer l'interet de l'utilisateur (table sportsbook_waitlist, voir la migration SQL
// 20261119_sportsbook_waitlist.sql) pour qu'on le previenne quand une integration automatique
// sera disponible. Reutilise SPORTSBOOKS (src/sportsbooksConfig.js, deja la source unique de
// verite pour le comparateur de cotes) plutot que de dupliquer une nouvelle liste de sites.

function IconPlus({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

// Bouton d'ouverture : pilule "+ Ajouter un sportsbook" sur desktop, rond "+" seul sur mobile --
// style Wealthsimple "Add account". Place dans GreetingBanner (meme ligne que "Good morning").
export function AddSportsbookButton({ t, mobile, onClick }) {
  if (mobile) {
    return (
      <button onClick={onClick} aria-label={t('sportsbook_add_cta')} title={t('sportsbook_add_cta')}
        style={{ width: '38px', height: '38px', minHeight: '38px', borderRadius: '50%', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-111)', color: 'var(--c-white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconPlus size={18} />
      </button>
    );
  }
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', minHeight: '44px', boxSizing: 'border-box', borderRadius: '24px', border: '1px solid var(--c-222)', backgroundColor: 'var(--c-111)', color: 'var(--c-white)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <IconPlus size={15} />
      <span>{t('sportsbook_add_cta')}</span>
    </button>
  );
}

function LigneSportsbook({ t, utilisateur, sb, dejaInscrit, onInscrit }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);

  async function mePrevenir() {
    if (!utilisateur?.id || enCours || dejaInscrit) return;
    setEnCours(true);
    setErreur(false);
    const { error } = await supabase.from('sportsbook_waitlist')
      .upsert({ user_id: utilisateur.id, sportsbook: sb.id }, { onConflict: 'user_id,sportsbook', ignoreDuplicates: true });
    setEnCours(false);
    if (error) { setErreur(true); return; }
    onInscrit(sb.id);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 4px', borderTop: '1px solid var(--c-111)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--c-white)' }}>{sb.nom}</div>
        <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{t('sportsbook_coming_soon')}</div>
        {erreur && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>{t('sportsbook_error')}</div>}
      </div>
      <button onClick={mePrevenir} disabled={enCours || dejaInscrit}
        style={{
          flexShrink: 0, padding: '9px 16px', minHeight: '38px', boxSizing: 'border-box', borderRadius: '20px', border: 'none',
          backgroundColor: dejaInscrit ? 'rgba(34,197,94,0.12)' : '#f97316', color: dejaInscrit ? '#22c55e' : 'white',
          fontSize: '12.5px', fontWeight: '700', cursor: dejaInscrit ? 'default' : 'pointer', opacity: enCours ? 0.6 : 1,
        }}>
        {dejaInscrit ? t('sportsbook_notified') : t('sportsbook_notify_me')}
      </button>
    </div>
  );
}

export function SportsbookWaitlistSheet({ t, utilisateur, onClose }) {
  const isMobile = useIsMobile();
  const [inscrits, setInscrits] = useState(new Set());
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!utilisateur?.id) { setChargement(false); return; }
    let annule = false;
    supabase.from('sportsbook_waitlist').select('sportsbook').eq('user_id', utilisateur.id)
      .then(({ data }) => { if (!annule) { setInscrits(new Set((data || []).map(r => r.sportsbook))); setChargement(false); } })
      .catch(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [utilisateur?.id]);

  function marquerInscrit(id) {
    setInscrits(prev => new Set(prev).add(id));
  }

  const corps = (
    <>
      <p style={{ fontSize: '13px', color: 'var(--c-666)', margin: '0 0 8px', lineHeight: '1.5' }}>{t('sportsbook_intro')}</p>
      {chargement ? (
        <p style={{ color: 'var(--c-555)', fontSize: '13px', padding: '12px 4px' }}>{t('favoris_chargement')}</p>
      ) : (
        SPORTSBOOKS.map(sb => (
          <LigneSportsbook key={sb.id} t={t} utilisateur={utilisateur} sb={sb} dejaInscrit={inscrits.has(sb.id)} onInscrit={marquerInscrit} />
        ))
      )}
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet onClose={onClose} title={t('sportsbook_add_title')}>
        {corps}
      </BottomSheet>
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', maxHeight: '85vh', overflowY: 'auto', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '18px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--c-white)' }}>{t('sportsbook_add_title')}</span>
          <button onClick={onClose} aria-label={t('favoris_retour')} style={{ width: '32px', height: '32px', minHeight: '32px', borderRadius: '50%', border: '1px solid var(--c-222)', background: 'none', color: 'var(--c-888)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
        </div>
        {corps}
      </div>
    </div>,
    document.body
  );
}
