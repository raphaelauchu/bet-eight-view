import React from 'react';
import { getT } from './i18n';
import {
  LEGAL_ENTITY_NAME, LEGAL_ENTITY_ADDRESS, LEGAL_PRIVACY_OFFICER_NAME, LEGAL_HOSTING_REGION,
  LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED_DISPLAY, LEGAL_DRAFT_BANNER,
} from './legalConfig';

// ===================== Pages legales completes (refonte du 27 nov 2026) =====================
// Contenu reel (src/i18n.js:legal_privacy_sections / legal_terms_sections), base uniquement sur
// ce que l'application fait reellement -- voir src/legalConfig.js pour les 4 champs
// "[A CONFIRMER]" interpoles ci-dessous ({entity}/{address}/{officer}/{region}), jamais une
// valeur inventee. Accessible directement par son URL (src/App.js, routes /confidentialite,
// /conditions, /privacy, /terms -- AUCUNE connexion requise, AUCUNE redirection vers l'accueil) :
// ce composant ne depend d'aucun etat d'authentification, seulement de `page`/`lang`.

function interpolate(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

const VARS = {
  entity: LEGAL_ENTITY_NAME,
  address: LEGAL_ENTITY_ADDRESS,
  officer: LEGAL_PRIVACY_OFFICER_NAME,
  region: LEGAL_HOSTING_REGION,
  email: LEGAL_CONTACT_EMAIL,
};

function renderBlock(block, i) {
  if (typeof block === 'string') {
    return <p key={i} className="ws-legal-body">{interpolate(block, VARS)}</p>;
  }
  if (block && Array.isArray(block.list)) {
    return (
      <ul key={i} className="ws-legal-list">
        {block.list.map((item, j) => <li key={j}>{interpolate(item, VARS)}</li>)}
      </ul>
    );
  }
  return null;
}

// Titre + meta SEO d'une page legale -- meme convention que homePageMeta/poolPageMeta (voir
// src/useDocumentMeta.js), utilisee par src/App.js pour chacune des 4 routes.
export function legalPageMeta(page, lang) {
  const t = getT(lang);
  const title = page === 'terms' ? t('landing_legal_terms_title') : t('landing_legal_privacy_title');
  const sections = page === 'terms' ? t('legal_terms_sections') : t('legal_privacy_sections');
  const firstParagraph = sections?.[0]?.blocks?.find(b => typeof b === 'string') || '';
  const description = interpolate(firstParagraph, VARS).slice(0, 160);
  return { title: `${title} — Betrics`, description };
}

export default function LegalPage({ lang, page, onBack }) {
  const t = getT(lang);
  const title = page === 'terms' ? t('landing_legal_terms_title') : t('landing_legal_privacy_title');
  const sections = page === 'terms' ? t('legal_terms_sections') : t('legal_privacy_sections');
  const updated = LEGAL_LAST_UPDATED_DISPLAY[lang] || LEGAL_LAST_UPDATED_DISPLAY.fr;

  return (
    <div className="ws-root">
      {LEGAL_DRAFT_BANNER && (
        <div className="ws-legal-draft-banner">{t('legal_draft_banner_text')}</div>
      )}
      <div className="ws-legal-page ws-container">
        <div className="ws-legal-header">
          <img src="/logo192.png" alt="Betrics" width="32" height="32" className="ws-legal-logo" />
          <button type="button" className="ws-btn ws-btn-ghost" onClick={onBack}>{t('legal_back_home')}</button>
        </div>

        <h1 className="ws-h2 ws-legal-title">{title}</h1>
        <p className="ws-legal-updated">{t('legal_last_updated_label').replace('{date}', updated)}</p>

        {(sections || []).map((section, i) => (
          <section key={i} className="ws-legal-section">
            <h2 className="ws-h3 ws-legal-section-title">{i + 1}. {section.title}</h2>
            {(section.blocks || []).map((block, j) => renderBlock(block, j))}
          </section>
        ))}
      </div>
    </div>
  );
}
