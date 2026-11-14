import {
  seasonIdDepuisDate, chargerSaisonCourante, _resetCacheSaisonCourante,
  construireSaisonReg, construireSaisonPO, formatSaisonLabel, formatAnneeCourte,
} from './season';

beforeEach(() => {
  jest.clearAllMocks();
  _resetCacheSaisonCourante();
});

test('seasonIdDepuisDate : derive la saison NHL a partir de la date (repli hors API)', () => {
  expect(seasonIdDepuisDate(new Date('2026-11-14T12:00:00'))).toBe('20262027');
  expect(seasonIdDepuisDate(new Date('2027-03-01T12:00:00'))).toBe('20262027');
  expect(seasonIdDepuisDate(new Date('2026-08-15T12:00:00'))).toBe('20252026');
});

test('chargerSaisonCourante : utilise le dernier element de standings-season (source API)', async () => {
  global.fetch = jest.fn((url) => {
    expect(String(url)).toContain('standings-season');
    return Promise.resolve({ json: () => Promise.resolve({ seasons: [{ id: 20242025 }, { id: 20252026 }, { id: 20262027 }] }) });
  });
  const saison = await chargerSaisonCourante();
  expect(saison).toBe('20262027');
});

test('chargerSaisonCourante : repli sur le calcul par date si l\'API echoue', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('reseau indisponible')));
  const saison = await chargerSaisonCourante();
  expect(saison).toBe(seasonIdDepuisDate());
});

test('chargerSaisonCourante : repli sur le calcul par date si standings-season ne renvoie rien d\'exploitable', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ seasons: [] }) }));
  const saison = await chargerSaisonCourante();
  expect(saison).toBe(seasonIdDepuisDate());
});

test('chargerSaisonCourante : un seul appel reseau partage pour toute la session (promesse en cache)', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ seasons: [{ id: 20262027 }] }) }));
  await Promise.all([chargerSaisonCourante(), chargerSaisonCourante(), chargerSaisonCourante()]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('construireSaisonReg/PO : gameType et seasonId corrects, aucune saison figee', () => {
  expect(construireSaisonReg('20262027')).toEqual({ id: 'reg-20262027', seasonId: '20262027', gameType: 2, label: 'Saison régulière' });
  expect(construireSaisonPO('20262027')).toEqual({ id: 'po-20262027', seasonId: '20262027', gameType: 3, label: 'Playoffs' });
});

test('formatAnneeCourte / formatSaisonLabel : libelles UI a partir du seasonId detecte', () => {
  expect(formatAnneeCourte('20262027')).toBe('2026-27');
  expect(formatSaisonLabel('20262027')).toBe('Saison 2026-27');
  expect(formatSaisonLabel('20262027', 3)).toBe('Séries 2026-27');
  expect(formatSaisonLabel(null)).toBe('');
});

// ===================== Garde-fou : aucun seasonId NHL ecrit en dur dans src/ =====================
// La saison NHL (format AAAAAAAA, ex. 20252026) ne doit jamais apparaitre comme litteral dans le
// code applicatif -- seule source de verite : useSaisonCourante()/chargerSaisonCourante() (ce
// fichier). Ce test echoue si un futur commit reintroduit un seasonId figé (le bogue McDavid
// corrige ici : Search/Analyses affichaient toujours la saison 2025-26, meme en 2026-27).
test('aucun seasonId NHL ecrit en dur dans src/ (hors tests et ce module)', () => {
  const fs = require('fs');
  const path = require('path');
  const srcDir = __dirname;
  const fichiersIgnores = new Set(['season.js']); // seule source de verite autorisee a manipuler des annees de saison
  const motifSeasonId = /20[0-9]{2}20[0-9]{2}/; // ex. 20252026, 20262027...
  const offenses = [];

  for (const fichier of fs.readdirSync(srcDir)) {
    if (!fichier.endsWith('.js') || fichier.endsWith('.test.js') || fichiersIgnores.has(fichier)) continue;
    const contenu = fs.readFileSync(path.join(srcDir, fichier), 'utf8');
    contenu.split('\n').forEach((ligne, i) => {
      if (motifSeasonId.test(ligne)) offenses.push(`${fichier}:${i + 1}: ${ligne.trim()}`);
    });
  }

  expect(offenses).toEqual([]);
});
