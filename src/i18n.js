const translations = {
  fr: {
    auth_forgot: 'Mot de passe oublié?',
    auth_reset_sub: 'Entre ton email pour recevoir un lien de réinitialisation.',
    auth_reset_btn: 'Envoyer le lien',
    auth_reset_sent_title: 'Lien envoyé!',
    auth_reset_sent_text: 'Si un compte existe avec',
    auth_reset_sent_text2: 'tu recevras un email dans quelques minutes.',
    auth_back: '← Retour à la connexion',
    pricing_title: 'Choisis ton plan',
    pricing_sub: 'Commence gratuitement, upgrade quand tu es prêt.',
    pricing_popular: '⭐ Le plus populaire',
    pricing_month: '/mois',
    pricing_choose: 'Choisir ce plan',
    pricing_free_btn: 'Commencer gratuitement',
    plans: [
      {
        nom: 'Gratuit', prix: 0,
        description: 'Parfait pour découvrir la plateforme',
        fonctionnalites: ['Matchs NHL du jour', 'Ticker en direct', 'Cotes de 2 bookmakers', 'Statistiques de base', 'Accès communauté'],
      },
      {
        nom: 'Pro', prix: 19, populaire: true,
        description: 'Pour le parieur sérieux',
        fonctionnalites: ['Tout du plan Gratuit', 'Cotes de tous les bookmakers', 'Modèles statistiques avancés', 'Alertes en temps réel', 'Value bets automatiques', 'Historique complet', 'Support prioritaire'],
      },
      {
        nom: 'Elite', prix: 49,
        description: 'Pour les professionnels',
        fonctionnalites: ['Tout du plan Pro', 'Modèles IA prédictifs', 'Backtesting de stratégies', 'API personnelle', 'Accès données historiques', 'Gestionnaire de bankroll', 'Support dédié 24/7'],
      },
    ],
  },
  en: {
    auth_forgot: 'Forgot password?',
    auth_reset_sub: 'Enter your email to receive a reset link.',
    auth_reset_btn: 'Send link',
    auth_reset_sent_title: 'Link sent!',
    auth_reset_sent_text: 'If an account exists with',
    auth_reset_sent_text2: "you'll receive an email in a few minutes.",
    auth_back: '← Back to login',
    pricing_title: 'Choose your plan',
    pricing_sub: "Start free, upgrade when you're ready.",
    pricing_popular: '⭐ Most popular',
    pricing_month: '/mo',
    pricing_choose: 'Choose plan',
    pricing_free_btn: 'Get started free',
    plans: [
      {
        nom: 'Free', prix: 0,
        description: 'Perfect to discover the platform',
        fonctionnalites: ["Today's NHL games", 'Live ticker', 'Odds from 2 bookmakers', 'Basic statistics', 'Community access'],
      },
      {
        nom: 'Pro', prix: 19, populaire: true,
        description: 'For the serious bettor',
        fonctionnalites: ['Everything in Free', 'Odds from all bookmakers', 'Advanced statistical models', 'Real-time alerts', 'Automatic value bets', 'Full history', 'Priority support'],
      },
      {
        nom: 'Elite', prix: 49,
        description: 'For professionals',
        fonctionnalites: ['Everything in Pro', 'Predictive AI models', 'Strategy backtesting', 'Personal API', 'Historical data access', 'Bankroll manager', '24/7 dedicated support'],
      },
    ],
  },
};

export function getT(lang) {
  const dict = translations[lang] || translations.en;
  return (key) => (dict[key] !== undefined ? dict[key] : key);
}

export default translations;
