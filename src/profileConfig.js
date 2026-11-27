// ===================== Config de la porte d'entree "Complete ton profil" (src/ProfileSetup.js) ===
// Meme mecanisme que les autres drapeaux du projet (src/onboardingConfig.js, src/authConfig.js) :
// repasser PROFILE_SETUP_ENABLED a `false` retire entierement cette etape (voir src/App.js, seul
// endroit qui lit ce drapeau) sans rien supprimer.
export const PROFILE_SETUP_ENABLED = true;

// Format de nom d'utilisateur -- MEME regle que la contrainte DB (profiles_username_format) et la
// RPC is_username_available (voir supabase/migrations/20261127_profile_setup.sql) : 3 a 20
// caracteres, lettres (les deux casses acceptees a la saisie -- l'unicite reelle est insensible a
// la casse, voir idx_profiles_username_lower), chiffres, underscore, point.
export const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,20}$/;

// Mots reserves -- verifies cote client pour un retour instantane (avant meme le debounce de 400
// ms vers la RPC), ET cote serveur dans la RPC elle-meme (jamais seulement cote client, une
// requete directe a l'API pourrait contourner cette liste sinon). Garder les deux listes alignees.
export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'betrics', 'support', 'help', 'root', 'moderator', 'mod',
  'staff', 'official', 'system', 'security', 'null', 'undefined', 'contact', 'info',
];

// ===================== Pays + regions =====================
// `region` : code a 2 lettres, colonne profiles.region dediee (voir la migration -- PAS la
// colonne profiles.province existante, reservee au comparateur de cotes LNH). Chaque libelle
// passe par une cle i18n (src/i18n.js:profile_country_*/profile_region_*), meme convention que
// PROVINCE_OPTIONS dans src/Onboarding.js.
export const COUNTRIES = [
  { code: 'CA', labelKey: 'profile_country_ca' },
  { code: 'US', labelKey: 'profile_country_us' },
];

export const REGIONS_BY_COUNTRY = {
  CA: [
    { code: 'AB', labelKey: 'profile_region_ab' },
    { code: 'BC', labelKey: 'profile_region_bc' },
    { code: 'MB', labelKey: 'profile_region_mb' },
    { code: 'NB', labelKey: 'profile_region_nb' },
    { code: 'NL', labelKey: 'profile_region_nl' },
    { code: 'NS', labelKey: 'profile_region_ns' },
    { code: 'NT', labelKey: 'profile_region_nt' },
    { code: 'NU', labelKey: 'profile_region_nu' },
    { code: 'ON', labelKey: 'profile_region_on' },
    { code: 'PE', labelKey: 'profile_region_pe' },
    { code: 'QC', labelKey: 'profile_region_qc' },
    { code: 'SK', labelKey: 'profile_region_sk' },
    { code: 'YT', labelKey: 'profile_region_yt' },
  ],
  US: [
    { code: 'AL', labelKey: 'profile_region_al' }, { code: 'AK', labelKey: 'profile_region_ak' },
    { code: 'AZ', labelKey: 'profile_region_az' }, { code: 'AR', labelKey: 'profile_region_ar' },
    { code: 'CA', labelKey: 'profile_region_ca_us' }, { code: 'CO', labelKey: 'profile_region_co' },
    { code: 'CT', labelKey: 'profile_region_ct' }, { code: 'DE', labelKey: 'profile_region_de' },
    { code: 'FL', labelKey: 'profile_region_fl' }, { code: 'GA', labelKey: 'profile_region_ga' },
    { code: 'HI', labelKey: 'profile_region_hi' }, { code: 'ID', labelKey: 'profile_region_id' },
    { code: 'IL', labelKey: 'profile_region_il' }, { code: 'IN', labelKey: 'profile_region_in' },
    { code: 'IA', labelKey: 'profile_region_ia' }, { code: 'KS', labelKey: 'profile_region_ks' },
    { code: 'KY', labelKey: 'profile_region_ky' }, { code: 'LA', labelKey: 'profile_region_la' },
    { code: 'ME', labelKey: 'profile_region_me' }, { code: 'MD', labelKey: 'profile_region_md' },
    { code: 'MA', labelKey: 'profile_region_ma' }, { code: 'MI', labelKey: 'profile_region_mi' },
    { code: 'MN', labelKey: 'profile_region_mn' }, { code: 'MS', labelKey: 'profile_region_ms' },
    { code: 'MO', labelKey: 'profile_region_mo' }, { code: 'MT', labelKey: 'profile_region_mt' },
    { code: 'NE', labelKey: 'profile_region_ne' }, { code: 'NV', labelKey: 'profile_region_nv' },
    { code: 'NH', labelKey: 'profile_region_nh' }, { code: 'NJ', labelKey: 'profile_region_nj' },
    { code: 'NM', labelKey: 'profile_region_nm' }, { code: 'NY', labelKey: 'profile_region_ny' },
    { code: 'NC', labelKey: 'profile_region_nc' }, { code: 'ND', labelKey: 'profile_region_nd' },
    { code: 'OH', labelKey: 'profile_region_oh' }, { code: 'OK', labelKey: 'profile_region_ok' },
    { code: 'OR', labelKey: 'profile_region_or' }, { code: 'PA', labelKey: 'profile_region_pa' },
    { code: 'RI', labelKey: 'profile_region_ri' }, { code: 'SC', labelKey: 'profile_region_sc' },
    { code: 'SD', labelKey: 'profile_region_sd' }, { code: 'TN', labelKey: 'profile_region_tn' },
    { code: 'TX', labelKey: 'profile_region_tx' }, { code: 'UT', labelKey: 'profile_region_ut' },
    { code: 'VT', labelKey: 'profile_region_vt' }, { code: 'VA', labelKey: 'profile_region_va' },
    { code: 'WA', labelKey: 'profile_region_wa' }, { code: 'WV', labelKey: 'profile_region_wv' },
    { code: 'WI', labelKey: 'profile_region_wi' }, { code: 'WY', labelKey: 'profile_region_wy' },
    { code: 'DC', labelKey: 'profile_region_dc' },
  ],
};

// ===================== Age minimum legal du jeu, par pays + region =====================
// [A CONFIRMER] validation par un avocat -- valeurs fournies par la demande (18 ans en
// Alberta/Manitoba/Quebec, 19 ans dans le reste du Canada, 21 ans aux Etats-Unis par defaut, sauf
// exceptions). AUCUNE region americaine n'a d'exception codee ici pour le moment (toutes a 21 via
// le defaut ci-dessous) -- a ajuster region par region si une juridiction americaine autorise un
// age different, une fois confirme.
export const MINIMUM_AGE_BY_REGION = {
  CA: { AB: 18, MB: 18, QC: 18 }, // tout le reste du Canada retombe sur le defaut CA (19) ci-dessous.
  US: {},
};
export const DEFAULT_MINIMUM_AGE_BY_COUNTRY = { CA: 19, US: 21 };

export function minimumAgeFor(country, region) {
  const parRegion = MINIMUM_AGE_BY_REGION[country]?.[region];
  if (parRegion != null) return parRegion;
  return DEFAULT_MINIMUM_AGE_BY_COUNTRY[country] ?? 21;
}

// Age exact a une date donnee (par defaut aujourd'hui) -- tient compte du mois/jour, pas
// seulement de la difference d'annees (ex. ne de decembre, encore mineur en janvier suivant).
// `birthDateStr` : chaine 'YYYY-MM-DD' (valeur native d'un <input type="date">).
export function computeAge(birthDateStr, today = new Date()) {
  if (!birthDateStr) return null;
  const m = String(birthDateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  let age = today.getFullYear() - y;
  const aEuPasAnniversaireCetteAnnee = (today.getMonth() + 1 < mo) || (today.getMonth() + 1 === mo && today.getDate() < d);
  if (aEuPasAnniversaireCetteAnnee) age -= 1;
  return age;
}
