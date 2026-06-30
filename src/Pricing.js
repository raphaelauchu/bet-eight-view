import React from 'react';
import { getT } from './i18n';

function PlanCard({ nom, prix, description, fonctionnalites, populaire, onChoisir, labelPopular, labelMonth, labelChoose, labelFree }) {
  return (
    <div style={{
      backgroundColor: populaire ? '#1e1b4b' : '#1a1a1a',
      border: populaire ? '2px solid #f97316' : '1px solid #333',
      borderRadius: '16px',
      padding: '32px',
      flex: 1,
      position: 'relative',
      maxWidth: '320px',
    }}>
      {populaire && (
        <div style={{
          position: 'absolute',
          top: '-14px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f97316',
          color: 'white',
          padding: '4px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}>
          {labelPopular}
        </div>
      )}

      <h3 style={{ margin: '0 0 8px', fontSize: '20px' }}>{nom}</h3>
      <p style={{ color: '#888', margin: '0 0 24px', fontSize: '14px' }}>{description}</p>

      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '48px', fontWeight: 'bold', color: populaire ? '#fdba74' : 'white' }}>${prix}</span>
        <span style={{ color: '#888', fontSize: '14px' }}>{labelMonth}</span>
      </div>

      <button
        onClick={onChoisir}
        style={{
          width: '100%',
          padding: '14px',
          background: populaire ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'transparent',
          color: 'white',
          border: populaire ? 'none' : '1px solid #444',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer',
          marginBottom: '24px',
        }}
      >
        {prix === 0 ? labelFree : labelChoose}
      </button>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {fonctionnalites.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '14px', color: '#ccc' }}>
            <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pricing({ onChoisirPlan, lang = 'en' }) {
  const t = getT(lang);
  const plans = t('plans');

  return (
    <div style={{ padding: '64px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '40px', margin: '0 0 16px' }}>{t('pricing_title')}</h2>
        <p style={{ color: '#888', fontSize: '18px' }}>{t('pricing_sub')}</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {plans.map((plan, index) => (
          <PlanCard
            key={index}
            {...plan}
            onChoisir={() => onChoisirPlan(plan)}
            labelPopular={t('pricing_popular')}
            labelMonth={t('pricing_month')}
            labelChoose={t('pricing_choose')}
            labelFree={t('pricing_free_btn')}
          />
        ))}
      </div>
    </div>
  );
}

export default Pricing;
