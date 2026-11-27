import React, { useMemo } from 'react';
import { MiniSparkline } from './Bankroll';
import { BetRow } from './BetRow';

// ===================== Mockups de telephone (hero V2, src/LandingHeroV2.js) =====================
// Cadre d'iPhone realiste en CSS pur (bordure, coins arrondis, encoche, reflet) -- voir
// src/index.css (.landing-phone*). Pas de vraie capture d'ecran Playwright (pipeline juge trop
// fragile pour ce premier jet, demande explicite de repli du cahier des charges) : les "ecrans"
// a l'interieur sont de VRAIS composants de l'app (MiniSparkline, src/Bankroll.js ; BetRow,
// src/BetRow.js) nourris de donnees d'EXEMPLE fictives, jamais une vraie donnee utilisateur, une
// photo de joueur ou un logo LNH/d'equipe (noms de joueurs et de comptes inventes ci-dessous).
//
// Les montants respectent exactement les regles de src/bankrollCalc.js (verifie manuellement,
// voir le commentaire au-dessus de chaque bloc de donnees) : computeAccountBalance = depots nets
// - TOUTES les mises (reglees + en cours) + montant retourne par les paris REGLES.

const ORANGE = '#f97316';

function IconPhoneBack({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

// ===================== Cadre CSS d'iPhone =====================

export function PhoneFrame({ children, className = '', ariaLabel }) {
  return (
    <div className={`landing-phone ${className}`} role="img" aria-label={ariaLabel}>
      <div className="landing-phone-island" aria-hidden="true" />
      <div className="landing-phone-screen">{children}</div>
      <div className="landing-phone-shine" aria-hidden="true" />
    </div>
  );
}

// ===================== Ecran 1 (telephone de devant) : accueil =====================
// Depot net 500$ ; bet1 (MTL vs TOR, 40$@1.91) gagne -> +36.40 ; bet2 (prop joueur fictif,
// 25$@2.20) perdu -> -25.00 ; bet3 (BOS vs NYR, 15$@2.05) encore en jeu. Solde =
// 500 - (40+25+15) + (40+36.40 + 25+(-25)) = 500 - 80 + 76.40 = 496.40$. ROI (decides) =
// (36.40-25)/(40+25) = 17.5%. Taux de reussite = 1/2 = 50%. Paris actifs = 1.
function HomeDemoScreen({ t }) {
  const points = useMemo(() => [480, 460, 510, 490, 496.4].map(value => ({ value })), []);
  return (
    <div style={{ padding: '14px 12px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ fontSize: '9px', color: '#666', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('onboarding_demo_balance_label')}</div>
      <div style={{ fontSize: '26px', fontWeight: '900', color: 'white', letterSpacing: '-0.5px', margin: '2px 0 8px' }}>$496.40</div>
      <MiniSparkline points={points} color={ORANGE} height={34} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', margin: '10px 0' }}>
        {[[t('home_stat_roi'), '+17.5%', '#22c55e'], [t('home_stat_win_rate'), '50%', 'white'], [t('home_stat_active_bets'), '1', ORANGE]].map(([label, val, color]) => (
          <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '7px', color: '#777', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px', color: '#888', fontWeight: '700', marginBottom: '2px' }}>{t('home_recent_bets')}</div>
      <div style={{ fontSize: '11px', transform: 'scale(0.92)', transformOrigin: 'top left', width: '108%' }}>
        <BetRow t={t} title="MTL @ TOR" bookmaker="BET99" odds={1.91} stake={40} status="won" profit={36.4} />
        <BetRow t={t} title="A. Bouchard — 2+ tirs" bookmaker="Betway" odds={2.2} stake={25} status="lost" profit={-25} bordered />
        <BetRow t={t} title="BOS @ NYR" bookmaker="bet365" odds={2.05} stake={15} status="pending" bordered />
      </div>
    </div>
  );
}

// ===================== Ecran 2 (telephone de derriere) : Bankroll =====================
// Deux comptes dont la somme egale exactement le solde global de l'ecran 1 (496.40$) :
// BET99 = 300.00$, Mise-o-jeu+ = 196.40$.
function BankrollDemoScreen({ t }) {
  const comptes = [
    { nom: 'BET99', solde: '$300.00' },
    { nom: 'Mise-o-jeu+', solde: '$196.40' },
  ];
  return (
    <div style={{ padding: '14px 12px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif' }}>
      <button type="button" disabled style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#888', fontSize: '10px', padding: 0, marginBottom: '8px', cursor: 'default' }}>
        <IconPhoneBack size={11} /> {t('back_btn').replace('← ', '')}
      </button>
      <div style={{ fontSize: '9px', color: '#666', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('onboarding_demo_balance_label')}</div>
      <div style={{ fontSize: '24px', fontWeight: '900', color: 'white', letterSpacing: '-0.5px', margin: '2px 0 12px' }}>$496.40</div>
      <div style={{ fontSize: '10px', color: '#888', fontWeight: '700', marginBottom: '6px' }}>{t('bank_accounts_section_title')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {comptes.map(c => (
          <div key={c.nom} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '9px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'white' }}>{c.nom}</span>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{c.solde}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== Pile des deux telephones =====================

export function PhoneMockupStack({ t }) {
  return (
    <div className="landing-phones-stack">
      <PhoneFrame className="landing-phone-back" ariaLabel={t('landing2_phone_back_alt')}>
        <BankrollDemoScreen t={t} />
      </PhoneFrame>
      <PhoneFrame className="landing-phone-front" ariaLabel={t('landing2_phone_front_alt')}>
        <HomeDemoScreen t={t} />
      </PhoneFrame>
    </div>
  );
}

export default PhoneMockupStack;
