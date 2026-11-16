import React from 'react';
import { getT } from './i18n';
import { Reveal } from './PublicShared';
import { CURRENCY, ELITE_MONTHLY_PRICE, PURCHASE_ENABLED, PLAN_FREE_FEATURES_KEYS, PLAN_ELITE_FEATURES_KEYS } from './pricingConfig';

// ===================== Tarifs (/tarifs) =====================
// Deux colonnes sobres (Gratuit / Elite). Pas de bascule mensuel/annuel ni d'essai gratuit
// annonce : aucun systeme de paiement n'existe encore dans le code (voir pricingConfig.js) --
// le bouton du plan Elite reste marque "Bientot" tant que l'achat n'est pas branche. Le prix
// affiche est un PLACEHOLDER a confirmer (voir pricingConfig.js, marque TODO).

export function pricingPageMeta(lang) {
  const t = getT(lang);
  return { title: `${t('pricing_page_title')} — Betrics`, description: t('pricing_page_subtitle') };
}

export default function PricingPage({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <main className="ws-root">
      <section className="ws-section">
        <div className="ws-container" style={{ maxWidth: '920px' }}>
          <Reveal className="ws-section-head">
            <h1 className="ws-h1" style={{ fontSize: 'clamp(34px, 5vw, 56px)' }}>{t('pricing_page_title')}</h1>
            <p className="ws-body">{t('pricing_page_subtitle')}</p>
          </Reveal>

          <div className="ws-pricing-grid">
            <Reveal as="article" className="ws-pricing-card">
              <h2 className="ws-h3">{t('pricing_free_name')}</h2>
              <div className="ws-pricing-amount">{t('pricing_free_amount')}</div>
              <p className="ws-body" style={{ fontSize: '15px' }}>{t('pricing_free_desc')}</p>
              <button type="button" className="ws-btn ws-btn-primary" onClick={() => onOpenAuth('signup')}>
                {t('pricing_free_cta')}
              </button>
              <ul className="ws-pricing-list">
                {PLAN_FREE_FEATURES_KEYS.map(k => <li key={k}>{t(k)}</li>)}
              </ul>
            </Reveal>

            <Reveal as="article" className="ws-pricing-card ws-pricing-card-highlight">
              <h2 className="ws-h3">{t('pricing_elite_name')}</h2>
              <div className="ws-pricing-amount">
                {ELITE_MONTHLY_PRICE} {CURRENCY}<span className="ws-pricing-period">{t('pricing_per_month')}</span>
              </div>
              <p className="ws-body" style={{ fontSize: '15px' }}>{t('pricing_elite_desc')}</p>
              <button type="button" className="ws-btn ws-btn-ghost" disabled={!PURCHASE_ENABLED} title={!PURCHASE_ENABLED ? t('pricing_soon_tooltip') : undefined}>
                {PURCHASE_ENABLED ? t('pricing_elite_cta') : t('tools_soon_tag')}
              </button>
              <ul className="ws-pricing-list">
                {PLAN_ELITE_FEATURES_KEYS.map(k => <li key={k}>{t(k)}</li>)}
              </ul>
            </Reveal>
          </div>

          <Reveal className="ws-pricing-table-wrap">
            <table className="ws-pricing-table">
              <thead>
                <tr>
                  <th>{t('pricing_table_feature')}</th>
                  <th>{t('pricing_free_name')}</th>
                  <th>{t('pricing_elite_name')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['pricing_table_analyses', true, true],
                  ['pricing_table_pool', true, true],
                  ['pricing_table_bankroll_basic', true, true],
                  ['pricing_table_models', false, true],
                  ['pricing_table_watchlist', false, true],
                  ['pricing_table_support', false, true],
                ].map(([key, free, elite]) => (
                  <tr key={key}>
                    <td>{t(key)}</td>
                    <td>{free ? '✓' : '—'}</td>
                    <td>{elite ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
