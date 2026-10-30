// Schema des regles d'un pool (stocke dans pools.rules en jsonb).
// Deux types de pool (rules.poolType) avec des etapes de wizard differentes :
// - classic  : draft unique, joueurs exclusifs toute la saison, pas d'alignement a gerer.
// - fantasy  : alignement actif/banc/reserve, gestion hebdomadaire ou quotidienne, ballotage.
// Le pointage est toujours 100% personnalisable (tout a 0 par defaut) et separe par
// position (attaquants / defenseurs / gardiens).

export const POOL_TYPES = ['classic', 'fantasy'];

export const POOL_TYPE_INFO = [
  { id: 'classic', labelKey: 'pool_type_classic', descKey: 'pool_type_classic_desc' },
  { id: 'fantasy', labelKey: 'pool_type_fantasy', descKey: 'pool_type_fantasy_desc' },
];

// Stats de pointage : memes categories pour attaquants et defenseurs (values independantes),
// categories dediees pour les gardiens.
export const POSITION_STAT_KEYS = [
  'goals', 'assists', 'powerPlayPoints', 'shortHandedPoints', 'shotsOnGoal',
  'hits', 'blockedShots', 'pim', 'plusMinus', 'gameWinningGoals',
];
export const GOALIE_STAT_KEYS = ['wins', 'shutouts', 'saves', 'goalsAgainst', 'otLosses'];

// Alignement : pool classique = simples compteurs par groupe de position (nombre a repecher).
// Fantasy = postes actifs detailles + banc + reserve blesses.
export const CLASSIC_ROSTER_KEYS = ['forwards', 'defense', 'goalies'];
export const FANTASY_ROSTER_KEYS = ['C', 'LW', 'RW', 'D', 'G', 'UTIL', 'bench', 'ir'];

export const DRAFT_TYPES = ['snake', 'linear'];
export const LINEUP_MODES = ['fixed', 'weekly', 'daily'];
export const TRADE_APPROVAL_TYPES = ['none', 'commissioner', 'vote'];
export const WAIVER_CLAIM_ORDERS = ['reverse_standings', 'first_come'];
export const DISPLAY_MODES = ['player', 'team'];

export const DEFAULT_SALARY_CAP_AMOUNT = 88000000;

function zeroMap(keys) {
  return Object.fromEntries(keys.map(k => [k, 0]));
}

export function defaultScoringGroup() { return zeroMap(POSITION_STAT_KEYS); }
export function defaultScoringGoalie() { return zeroMap(GOALIE_STAT_KEYS); }

export function defaultRosterForType(poolType) {
  if (poolType === 'classic') return { forwards: 9, defense: 5, goalies: 2 };
  return { C: 1, LW: 1, RW: 1, D: 2, G: 1, UTIL: 1, bench: 3, ir: 1 };
}

export function defaultTradesForType(poolType) {
  return poolType === 'classic'
    ? { enabled: false, maxPerSeason: null, noReacquire: true, approval: 'commissioner', deadline: null }
    : { enabled: true, maxPerSeason: null, noReacquire: true, approval: 'commissioner', deadline: null };
}

export function defaultWaiversForType(poolType) {
  return poolType === 'classic'
    ? { enabled: false, maxAddsPerSeason: null, noReacquireDropped: false, claimOrder: 'first_come', waiverDays: 0 }
    : { enabled: true, maxAddsPerSeason: null, noReacquireDropped: false, claimOrder: 'first_come', waiverDays: 0 };
}

export function defaultRules(poolType = 'classic') {
  return {
    poolType,
    display: 'player',
    scoring: {
      forward: defaultScoringGroup(),
      defense: defaultScoringGroup(),
      goalie: defaultScoringGoalie(),
    },
    sameForwardDefenseScoring: true,
    roster: defaultRosterForType(poolType),
    salaryCap: { enabled: false, amount: DEFAULT_SALARY_CAP_AMOUNT, source: 'manual' },
    draft: { type: 'snake', secondsPerPick: 60, teamPickCountsAsRound: false },
    lineup: poolType === 'classic' ? 'fixed' : 'weekly',
    trades: defaultTradesForType(poolType),
    waivers: defaultWaiversForType(poolType),
  };
}

export function cloneRules(rules) {
  return JSON.parse(JSON.stringify(rules));
}

// Applique un changement de type en conservant ce qui est commun (nom/saison vivent hors
// de rules ; pointage, plafond, affichage, draft restent intacts) et en reinitialisant
// uniquement l'alignement / la gestion / les transactions propres a l'autre type.
export function applyPoolType(rules, poolType) {
  const next = cloneRules(rules);
  next.poolType = poolType;
  next.roster = defaultRosterForType(poolType);
  next.lineup = poolType === 'classic' ? 'fixed' : 'weekly';
  next.trades = defaultTradesForType(poolType);
  next.waivers = defaultWaiversForType(poolType);
  return next;
}

export function totalRosterSlots(rules) {
  const keys = rules?.poolType === 'classic' ? CLASSIC_ROSTER_KEYS : FANTASY_ROSTER_KEYS;
  return keys.reduce((sum, k) => sum + (Number(rules?.roster?.[k]) || 0), 0);
}

function sumAbs(obj) {
  return Object.values(obj || {}).reduce((s, v) => s + Math.abs(Number(v) || 0), 0);
}

export function hasAnyScoring(rules) {
  return sumAbs(rules?.scoring?.forward) + sumAbs(rules?.scoring?.defense) + sumAbs(rules?.scoring?.goalie) > 0;
}

// Retourne un tableau de cles d'erreur i18n (vide si tout est valide).
export function validateRules(rules) {
  const errors = [];
  if (!hasAnyScoring(rules)) errors.push('pool_error_no_points');
  if (totalRosterSlots(rules) <= 0) errors.push('pool_error_empty_roster');
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

// Normalise les regles d'un pool deja cree pour les rendre compatibles avec le schema
// courant (ancien schema Phase 1 : scoring.skater unique, roster C/LW/RW/D/G/..., plafond
// avec mustSpendMin, transactions.trades/waivers booleens). Toujours appeler cette fonction
// sur rules avant de les afficher/editer.
export function normalizeRules(rawRules) {
  const rules = rawRules && typeof rawRules === 'object' ? cloneRules(rawRules) : {};

  if (!POOL_TYPES.includes(rules.poolType)) {
    const legacyRoster = rules.roster || {};
    const looksFantasy = ['UTIL', 'bench', 'ir'].some(k => Number(legacyRoster[k]) > 0);
    rules.poolType = looksFantasy ? 'fantasy' : 'classic';
  }
  const poolType = rules.poolType;

  const legacyScoring = rules.scoring || {};
  const legacySkater = legacyScoring.skater || null;
  const forward = legacyScoring.forward || legacySkater || {};
  const defense = legacyScoring.defense || legacySkater || {};
  const goalie = legacyScoring.goalie || {};
  rules.scoring = {
    forward: { ...defaultScoringGroup(), ...forward },
    defense: { ...defaultScoringGroup(), ...defense },
    goalie: { ...defaultScoringGoalie(), ...goalie },
  };
  if (typeof rules.sameForwardDefenseScoring !== 'boolean') {
    rules.sameForwardDefenseScoring = !!legacySkater;
  }

  if (poolType === 'classic') {
    const legacy = rules.roster || {};
    if (legacy.forwards === undefined && legacy.defense === undefined && legacy.goalies === undefined) {
      const forwards = (Number(legacy.C) || 0) + (Number(legacy.LW) || 0) + (Number(legacy.RW) || 0);
      const defenseN = Number(legacy.D) || 0;
      const goalies = Number(legacy.G) || 0;
      rules.roster = {
        forwards: forwards || defaultRosterForType('classic').forwards,
        defense: defenseN || defaultRosterForType('classic').defense,
        goalies: goalies || defaultRosterForType('classic').goalies,
      };
    } else {
      rules.roster = { forwards: Number(legacy.forwards) || 0, defense: Number(legacy.defense) || 0, goalies: Number(legacy.goalies) || 0 };
    }
  } else {
    rules.roster = { ...defaultRosterForType('fantasy'), ...(rules.roster || {}) };
  }

  const legacyCap = rules.salaryCap || {};
  rules.salaryCap = {
    enabled: !!legacyCap.enabled,
    amount: legacyCap.amount || DEFAULT_SALARY_CAP_AMOUNT,
    source: legacyCap.source === 'nhl' ? 'nhl' : 'manual',
  };

  if (!rules.trades || typeof rules.trades.enabled !== 'boolean') {
    const legacyTx = rules.transactions;
    rules.trades = legacyTx
      ? { ...defaultTradesForType(poolType), enabled: !!legacyTx.trades }
      : defaultTradesForType(poolType);
  }
  if (!rules.waivers || typeof rules.waivers.enabled !== 'boolean') {
    const legacyTx = rules.transactions;
    rules.waivers = legacyTx
      ? { ...defaultWaiversForType(poolType), enabled: !!legacyTx.waivers }
      : defaultWaiversForType(poolType);
  }
  delete rules.transactions;

  if (!rules.draft) rules.draft = { type: 'snake', secondsPerPick: 60, teamPickCountsAsRound: false };
  if (!rules.lineup) rules.lineup = poolType === 'classic' ? 'fixed' : 'weekly';
  if (poolType === 'classic') rules.lineup = 'fixed';
  if (!DISPLAY_MODES.includes(rules.display)) rules.display = 'player';

  return rules;
}
