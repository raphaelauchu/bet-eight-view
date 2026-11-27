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
  expect(computeAge('2008-11-28', aujourdHui)).toBe(17); // anniversaire demain -> pas encore 18
  expect(computeAge('2008-11-26', aujourdHui)).toBe(18); // anniversaire hier -> deja 18
  expect(computeAge('2008-01-01', aujourdHui)).toBe(18);
  expect(computeAge('', aujourdHui)).toBeNull();
  expect(computeAge(null, aujourdHui)).toBeNull();
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
