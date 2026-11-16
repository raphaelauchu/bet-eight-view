// ===================== Config des tarifs (src/PricingPage.js) =====================
// Source UNIQUE des prix affiches publiquement. Aucun systeme de paiement (Stripe ou autre)
// n'existe encore dans le code (verifie : aucune reference a Stripe/subscription/checkout/
// billing ailleurs que l'objet `subscription` de supabase.auth, qui n'a rien a voir) -- donc
// pas de bascule mensuel/annuel, pas d'essai gratuit annonce, et le bouton du plan payant
// reste marque "Bientot" tant que l'achat n'est pas branche. Les montants ci-dessous sont des
// PLACEHOLDERS a confirmer avant publication (TODO).

export const CURRENCY = 'CAD';

// TODO(raphael): confirmer le prix reel du plan Elite avant publication (placeholder).
export const ELITE_MONTHLY_PRICE = 19;

export const PURCHASE_ENABLED = false; // passe a true quand le paiement sera branche.

export const PLAN_FREE_FEATURES_KEYS = [
  'pricing_free_feat_analyses',
  'pricing_free_feat_pool',
  'pricing_free_feat_bankroll_basic',
  'pricing_free_feat_lang',
];

// TODO(raphael): confirmer la liste reelle des avantages Elite avant publication.
export const PLAN_ELITE_FEATURES_KEYS = [
  'pricing_elite_feat_all_free',
  'pricing_elite_feat_models',
  'pricing_elite_feat_watchlist',
  'pricing_elite_feat_bankroll_advanced',
  'pricing_elite_feat_support',
];
