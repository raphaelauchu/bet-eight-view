import { minimumAgeFor, computeAge, USERNAME_REGEX, RESERVED_USERNAMES, REGIONS_BY_COUNTRY, COUNTRIES } from './profileConfig';

// ===================== Config de la porte d'entree "Complete ton profil" =====================
// Fonctions pures uniquement -- voir src/AppProfileSetup.test.js pour l'integration de la porte
// d'entree a travers App(), et src/ProfileSetup.test.js pour le formulaire isole.

test('minimumAgeFor : 18 ans en Alberta/Manitoba/Quebec, 19 ans dans le reste du Canada, 21 ans aux Etats-Unis par defaut', () => {
  expect(minimumAgeFor('CA', 'AB')).toBe(18);
  expect(minimumAgeFor('CA', 'MB')).toBe(18);
  expect(minimumAgeFor('CA', 'QC')).toBe(18);
  expect(minimumAgeFor('CA', 'ON')).toBe(19);
  expect(minimumAgeFor('CA', 'BC')).toBe(19);
  expect(minimumAgeFor('CA', 'YT')).toBe(19);
  expect(minimumAgeFor('US', 'NY')).toBe(21);
  expect(minimumAgeFor('US', 'CA')).toBe(21);
  expect(minimumAgeFor('FR', 'XX')).toBe(21); // pays inconnu -> repli le plus prudent
});

test('computeAge : annees completes, tient compte du mois/jour (pas seulement la difference d\'annees)', () => {
  const aujourdHui = new Date('2026-11-27T12:00:00');
  expect(computeAge('2008-11-27', aujourdHui)).toBe(18); // anniversaire exactement aujourd'hui
  expect(computeAge('2008-11-28', aujourdHui)).toBe(17); // anniversaire demain -> pas encore 18 (veille de l'anniversaire)
  expect(computeAge('2008-11-26', aujourdHui)).toBe(18); // anniversaire hier -> deja 18
  expect(computeAge('2008-01-01', aujourdHui)).toBe(18);
  expect(computeAge('', aujourdHui)).toBeNull();
  expect(computeAge(null, aujourdHui)).toBeNull();
});

test('computeAge : 29 fevrier (annee bissextile) -- age correct avant et apres l\'anniversaire', () => {
  // Ne le 29 fevrier 2008 (annee bissextile) : 18 ans tombent le 29 fevrier 2026 -- 2026 N'EST
  // PAS bissextile, le mois de fevrier s'arrete au 28 cette annee-la, mais le mois (2) et le jour
  // (29) de la date de naissance restent compares directement, sans normalisation de calendrier.
  const veilleAnniversaire = new Date('2026-02-28T12:00:00');
  const lendemain = new Date('2026-03-01T12:00:00');
  expect(computeAge('2008-02-29', veilleAnniversaire)).toBe(17); // pas encore 18 le 28 fevrier
  expect(computeAge('2008-02-29', lendemain)).toBe(18); // 18 ans passes le 1er mars
});

test('computeAge : date de naissance future -> age negatif (jamais un blocage silencieux, jamais NaN)', () => {
  const aujourdHui = new Date('2026-11-27T12:00:00');
  expect(computeAge('2030-01-01', aujourdHui)).toBe(-4);
  expect(Number.isNaN(computeAge('2030-01-01', aujourdHui))).toBe(false);
});

test('computeAge : date invalide -> null, jamais une exception', () => {
  const aujourdHui = new Date('2026-11-27T12:00:00');
  expect(computeAge('pas-une-date', aujourdHui)).toBeNull();
  expect(computeAge('2026', aujourdHui)).toBeNull();
  expect(computeAge(undefined, aujourdHui)).toBeNull();
});

test('minimumAgeFor : exhaustif, chaque province/territoire canadien (13)', () => {
  const attendu = { AB: 18, BC: 19, MB: 18, NB: 19, NL: 19, NS: 19, NT: 19, NU: 19, ON: 19, PE: 19, QC: 18, SK: 19, YT: 19 };
  Object.entries(attendu).forEach(([region, age]) => {
    expect(minimumAgeFor('CA', region)).toBe(age);
  });
});

test('minimumAgeFor : exhaustif, chaque Etat americain (51, incluant DC) -> 21 par defaut', () => {
  const tousLesCodes = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
    'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
    'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
    'WI', 'WY', 'DC',
  ];
  expect(tousLesCodes.length).toBe(51);
  tousLesCodes.forEach(region => expect(minimumAgeFor('US', region)).toBe(21));
});

test('minimumAgeFor : region non selectionnee (vide/indefinie) -> repli le plus prudent (21), jamais une exception', () => {
  expect(minimumAgeFor('CA', '')).toBe(19); // defaut CA, pas d'exception sur chaine vide
  expect(minimumAgeFor('CA', undefined)).toBe(19);
  expect(minimumAgeFor(undefined, undefined)).toBe(21);
  expect(minimumAgeFor('', '')).toBe(21);
});

test('USERNAME_REGEX : 3 a 20 caracteres, lettres/chiffres/underscore/point seulement', () => {
  expect(USERNAME_REGEX.test('ab')).toBe(false); // trop court
  expect(USERNAME_REGEX.test('a'.repeat(21))).toBe(false); // trop long
  expect(USERNAME_REGEX.test('abc')).toBe(true);
  expect(USERNAME_REGEX.test('a'.repeat(20))).toBe(true);
  expect(USERNAME_REGEX.test('alex_01.pro')).toBe(true);
  expect(USERNAME_REGEX.test('alex!')).toBe(false);
  expect(USERNAME_REGEX.test('alex 01')).toBe(false);
  expect(USERNAME_REGEX.test('Alex_01')).toBe(true); // casse acceptee a la saisie (unicite insensible a la casse cote DB)
});

test('RESERVED_USERNAMES : contient les mots explicitement demandes', () => {
  ['admin', 'betrics', 'support'].forEach(m => expect(RESERVED_USERNAMES).toContain(m));
});

test('COUNTRIES/REGIONS_BY_COUNTRY : Canada (13 provinces/territoires) et Etats-Unis (50 etats + DC), aucun code en double', () => {
  expect(COUNTRIES.map(c => c.code).sort()).toEqual(['CA', 'US']);
  expect(REGIONS_BY_COUNTRY.CA.length).toBe(13);
  expect(REGIONS_BY_COUNTRY.US.length).toBe(51);
  const codesCA = REGIONS_BY_COUNTRY.CA.map(r => r.code);
  const codesUS = REGIONS_BY_COUNTRY.US.map(r => r.code);
  expect(new Set(codesCA).size).toBe(codesCA.length);
  expect(new Set(codesUS).size).toBe(codesUS.length);
});
