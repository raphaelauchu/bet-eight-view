// Schema des regles d'un pool (stocke dans pools.rules en jsonb) + presets.
// Toutes les valeurs de pointage sont a 0 par defaut : un pool "vide" doit explicitement
// recevoir au moins un point attribue avant de pouvoir etre cree (voir validateRules).

export const SKATER_STAT_KEYS = [
  'goals', 'assists', 'powerPlayPoints', 'shortHandedPoints', 'shotsOnGoal',
  'hits', 'blockedShots', 'pim', 'plusMinus', 'gameWinningGoals',
];

export const GOALIE_STAT_KEYS = ['wins', 'shutouts', 'saves', 'goalsAgainst', 'otLosses'];

export const ROSTER_SLOT_KEYS = ['C', 'LW', 'RW', 'D', 'G', 'UTIL', 'bench', 'ir'];

export const DRAFT_TYPES = ['snake', 'linear'];
export const LINEUP_MODES = ['fixed', 'weekly', 'daily'];

function zeroMap(keys) {
  return Object.fromEntries(keys.map(k => [k, 0]));
}

export function defaultScoringSkater() { return zeroMap(SKATER_STAT_KEYS); }
export function defaultScoringGoalie() { return zeroMap(GOALIE_STAT_KEYS); }

export function defaultRoster() {
  return { C: 1, LW: 1, RW: 1, D: 2, G: 1, UTIL: 1, bench: 3, ir: 1 };
}

export function defaultRules() {
  return {
    scoring: { skater: defaultScoringSkater(), goalie: defaultScoringGoalie() },
    roster: defaultRoster(),
    salaryCap: { enabled: false, amount: 0, source: 'manual', mustSpendMin: null },
    draft: { type: 'snake', secondsPerPick: 60, teamPickCountsAsRound: false },
    lineup: 'weekly',
    transactions: { trades: true, waivers: true },
  };
}

export function cloneRules(rules) {
  return JSON.parse(JSON.stringify(rules));
}

// Fusion superficielle par section (suffisant ici : chaque section de rules est un objet plat
// ou un objet a un seul niveau d'imbrication connu — scoring.skater / scoring.goalie).
export function mergeRules(base, partial) {
  const merged = cloneRules(base);
  if (!partial) return merged;
  if (partial.scoring) {
    merged.scoring = merged.scoring || {};
    if (partial.scoring.skater) merged.scoring.skater = { ...merged.scoring.skater, ...partial.scoring.skater };
    if (partial.scoring.goalie) merged.scoring.goalie = { ...merged.scoring.goalie, ...partial.scoring.goalie };
  }
  if (partial.roster) merged.roster = { ...merged.roster, ...partial.roster };
  if (partial.salaryCap) merged.salaryCap = { ...merged.salaryCap, ...partial.salaryCap };
  if (partial.draft) merged.draft = { ...merged.draft, ...partial.draft };
  if (partial.lineup) merged.lineup = partial.lineup;
  if (partial.transactions) merged.transactions = { ...merged.transactions, ...partial.transactions };
  return merged;
}

export const RULE_PRESETS = [
  {
    id: 'classic',
    labelKey: 'pool_preset_classic',
    descKey: 'pool_preset_classic_desc',
    buildRules: () => mergeRules(defaultRules(), {
      scoring: {
        skater: { goals: 2, assists: 1, powerPlayPoints: 0.5 },
        goalie: { wins: 2, shutouts: 3, otLosses: 1 },
      },
    }),
  },
  {
    id: 'fantasy',
    labelKey: 'pool_preset_fantasy',
    descKey: 'pool_preset_fantasy_desc',
    buildRules: () => mergeRules(defaultRules(), {
      scoring: {
        skater: {
          goals: 3, assists: 2, powerPlayPoints: 1, shortHandedPoints: 2,
          shotsOnGoal: 0.1, hits: 0.1, blockedShots: 0.1, plusMinus: 0.2, gameWinningGoals: 1,
        },
        goalie: { wins: 4, shutouts: 5, saves: 0.2, otLosses: 1 },
      },
    }),
  },
  {
    id: 'salarycap',
    labelKey: 'pool_preset_salarycap',
    descKey: 'pool_preset_salarycap_desc',
    buildRules: () => mergeRules(defaultRules(), {
      scoring: {
        skater: { goals: 2, assists: 1, powerPlayPoints: 0.5 },
        goalie: { wins: 2, shutouts: 3, otLosses: 1 },
      },
      salaryCap: { enabled: true, amount: 95500000, source: 'nhl', mustSpendMin: null },
    }),
  },
  {
    id: 'custom',
    labelKey: 'pool_preset_custom',
    descKey: 'pool_preset_custom_desc',
    buildRules: () => defaultRules(),
  },
];

export function getPreset(id) {
  return RULE_PRESETS.find(p => p.id === id) || RULE_PRESETS[RULE_PRESETS.length - 1];
}

export function totalRosterSlots(roster) {
  return ROSTER_SLOT_KEYS.reduce((sum, k) => sum + (Number(roster?.[k]) || 0), 0);
}

export function hasAnyScoring(rules) {
  const skaterSum = Object.values(rules?.scoring?.skater || {}).reduce((s, v) => s + Math.abs(Number(v) || 0), 0);
  const goalieSum = Object.values(rules?.scoring?.goalie || {}).reduce((s, v) => s + Math.abs(Number(v) || 0), 0);
  return (skaterSum + goalieSum) > 0;
}

// Retourne un tableau de cles d'erreur i18n (vide si tout est valide).
export function validateRules(rules) {
  const errors = [];
  if (!hasAnyScoring(rules)) errors.push('pool_error_no_points');
  if (totalRosterSlots(rules?.roster) <= 0) errors.push('pool_error_empty_roster');
  if (rules?.salaryCap?.enabled && (!rules.salaryCap.amount || rules.salaryCap.amount <= 0)) errors.push('pool_error_salary_cap_amount');
  return errors;
}

export function currentSeasonLabelFromSeasonId(seasonId) {
  if (!seasonId || seasonId.length < 8) {
    const now = new Date();
    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }
  return `${seasonId.slice(0, 4)}-${seasonId.slice(4, 8)}`;
}
