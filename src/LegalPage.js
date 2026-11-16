import React from 'react';
import { getT } from './i18n';

// ===================== Pages legales simples (pas de contenu juridique invente) =====================

export default function LegalPage({ lang, page, onBack }) {
  const t = getT(lang);
  const title = page === 'terms' ? t('landing_legal_terms_title') : t('landing_legal_privacy_title');
  const body = page === 'terms' ? t('landing_legal_terms_body') : t('landing_legal_privacy_body');
  return (
    <div className="ws-root">
      <div className="ws-legal-page ws-container">
        <button type="button" className="ws-btn ws-btn-ghost" onClick={onBack}>{t('landing_legal_back')}</button>
        <h1 className="ws-h2" style={{ marginTop: '24px' }}>{title}</h1>
        <p className="ws-legal-body">{body}</p>
      </div>
    </div>
  );
}
