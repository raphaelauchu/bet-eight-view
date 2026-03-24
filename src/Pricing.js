import React from 'react';

function PlanCard({ nom, prix, description, fonctionnalites, populaire, onChoisir }) {
  return (
    <div style={{
      backgroundColor: populaire ? '#1e1b4b' : '#1a1a1a',
      border: populaire ? '2px solid #6366f1' : '1px solid #333',
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
          backgroundColor: '#6366f1',
          color: 'white',
          padding: '4px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}>
          ⭐ Le plus populaire
        </div>
      )}

      <h3 style={{ margin: '0 0 8px', fontSize: '20px' }}>{nom}</h3>
      <p style={{ color: '#888', margin: '0 0 24px', fontSize: '14px' }}>{description}</p>

      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '48px', fontWeight: 'bold', color: populaire ? '#a5b4fc' : 'white' }}>${prix}</span>
        <span style={{ color: '#888', fontSize: '14px' }}>/mois</span>
      </div>

      <button
        onClick={onChoisir}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: populaire ? '#6366f1' : 'transparent',
          color: 'white',
          border: populaire ? 'none' : '1px solid #444',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer',
          marginBottom: '24px',
        }}
      >
        {prix === 0 ? 'Commencer gratuitement' : 'Choisir ce plan'}
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

function Pricing({ onChoisirPlan }) {
  const plans = [
    {
      nom: 'Gratuit',
      prix: 0,
      description: 'Parfait pour découvrir la plateforme',
      fonctionnalites: [
        'Matchs NHL du jour',
        'Ticker en direct',
        'Cotes de 2 bookmakers',
        'Statistiques de base',
        'Accès communauté',
      ],
      populaire: false,
    },
    {
      nom: 'Pro',
      prix: 19,
      description: 'Pour le parieur sérieux',
      fonctionnalites: [
        'Tout du plan Gratuit',
        'Cotes de tous les bookmakers',
        'Modèles statistiques avancés',
        'Alertes en temps réel',
        'Value bets automatiques',
        'Historique complet',
        'Support prioritaire',
      ],
      populaire: true,
    },
    {
      nom: 'Elite',
      prix: 49,
      description: 'Pour les professionnels',
      fonctionnalites: [
        'Tout du plan Pro',
        'Modèles IA prédictifs',
        'Backtesting de stratégies',
        'API personnelle',
        'Accès données historiques',
        'Gestionnaire de bankroll',
        'Support dédié 24/7',
      ],
      populaire: false,
    },
  ];

  return (
    <div style={{ padding: '64px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '40px', margin: '0 0 16px' }}>Choisis ton plan</h2>
        <p style={{ color: '#888', fontSize: '18px' }}>Commence gratuitement, upgrade quand tu es prêt.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {plans.map((plan, index) => (
          <PlanCard
            key={index}
            {...plan}
            onChoisir={() => onChoisirPlan(plan)}
          />
        ))}
      </div>
    </div>
  );
}

export default Pricing;