import React from 'react';
import { getT } from './i18n';

// ===================== Pied de page public (jeu responsable + liens legaux) =====================
// Partage par toutes les pages publiques (accueil, Pool, Tarifs, outils, guide). Contenu
// inchange depuis la landing precedente (age legal par province, ressource quebecoise "Jeu :
// aide et reference" -- 1 800 461-0140 / aidejeu.ca -- sourcee via Loto-Quebec et le repertoire
// sante.gouv.qc.ca) : NE PAS modifier le numero sans verifier a nouveau aupres d'une source
// officielle. id="jeu-responsable" sur le bloc ci-dessous : cible de scroll du lien "18+ · Jeu
// responsable" du nouveau hero (src/LandingHeroV2.js) -- reutilise cette ressource existante
// plutot que d'en dupliquer une.

export default function PublicFooter({ lang, onOpenLegal }) {
  const t = getT(lang);
  return (
    <footer className="ws-footer">
      <div className="ws-container">
        <div className="ws-footer-responsible" id="jeu-responsable">
          <p>{t('landing_footer_disclaimer')}</p>
          <p>{t('landing_footer_nhl_disclaimer')}</p>
          <p>{t('landing_footer_age')}</p>
          <p>
            {t('landing_footer_help_intro')}{' '}
            <strong>{t('landing_footer_help_name')}</strong> — {t('landing_footer_help_contact')}
          </p>
        </div>
        <div className="ws-footer-bottom">
          <div className="ws-footer-brand">
            <div className="ws-brand-static">Betrics</div>
            <div className="ws-footer-tagline">{t('landing_footer_tagline')}</div>
          </div>
          <div className="ws-footer-links">
            <button type="button" onClick={() => onOpenLegal('terms')}>{t('landing_footer_legal_terms')}</button>
            <button type="button" onClick={() => onOpenLegal('privacy')}>{t('landing_footer_legal_privacy')}</button>
            <a href="mailto:contact@betrics.ca">{t('landing_footer_contact')}</a>
          </div>
          <div className="ws-footer-copyright">{t('landing_footer_copyright')}</div>
        </div>
      </div>
    </footer>
  );
}
