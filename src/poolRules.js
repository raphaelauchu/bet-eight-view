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
export const TEAM_STAT_KEYS = ['wins', 'overtimeLosses', 'shutouts'];

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
export function defaultScoringTeam() { return zeroMap(TEAM_STAT_KEYS); }

export function defaultRosterForType(poolType) {
  if (poolType === 'classic') return { forwards: 9, defense: 6, goalies: 2, teamPicks: 1 };
  return { C: 1, LW: 1, RW: 1, D: 2, G: 1, UTIL: 1, bench: 3, ir: 1, teamPicks: 1 };
}

// tradeDayPoints : valeur fixe (non modifiable dans l'UI pour l'instant) - le jour d'un
// echange, les deux joueurs echanges ne rapportent de points a personne ; ils comptent
// pour leur nouveau proprietaire a partir du lendemain.
export function defaultTradesForType(poolType) {
  return poolType === 'classic'
    ? { enabled: false, maxPerSeason: null, noReacquire: true, approval: 'commissioner', tradeDayPoints: 'nobody' }
    : { enabled: true, maxPerSeason: null, noReacquire: true, approval: 'commissioner', tradeDayPoints: 'nobody' };
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
      team: defaultScoringTeam(),
    },
    sameForwardDefenseScoring: true,
    roster: defaultRosterForType(poolType),
    salaryCap: { enabled: false, amount: DEFAULT_SALARY_CAP_AMOUNT, source: 'manual' },
    draft: { type: 'snake', secondsPerPick: 60, teamPickCountsAsRound: false },
    draftAssistant: { enabled: true },
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
  return sumAbs(rules?.scoring?.forward) + sumAbs(rules?.scoring?.defense) + sumAbs(rules?.scoring?.goalie) + sumAbs(rules?.scoring?.team) > 0;
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
  const team = legacyScoring.team || {};
  rules.scoring = {
    forward: { ...defaultScoringGroup(), ...forward },
    defense: { ...defaultScoringGroup(), ...defense },
    goalie: { ...defaultScoringGoalie(), ...goalie },
    team: { ...defaultScoringTeam(), ...team },
  };
  if (typeof rules.sameForwardDefenseScoring !== 'boolean') {
    rules.sameForwardDefenseScoring = !!legacySkater;
  }

  const rawRoster = rules.roster || {};
  const existingTeamPicks = Number.isFinite(Number(rawRoster.teamPicks)) ? Math.max(0, Math.floor(Number(rawRoster.teamPicks))) : null;

  if (poolType === 'classic') {
    if (rawRoster.forwards === undefined && rawRoster.defense === undefined && rawRoster.goalies === undefined) {
      const forwards = (Number(rawRoster.C) || 0) + (Number(rawRoster.LW) || 0) + (Number(rawRoster.RW) || 0);
      const defenseN = Number(rawRoster.D) || 0;
      const goalies = Number(rawRoster.G) || 0;
      rules.roster = {
        forwards: forwards || defaultRosterForType('classic').forwards,
        defense: defenseN || defaultRosterForType('classic').defense,
        goalies: goalies || defaultRosterForType('classic').goalies,
      };
    } else {
      rules.roster = { forwards: Number(rawRoster.forwards) || 0, defense: Number(rawRoster.defense) || 0, goalies: Number(rawRoster.goalies) || 0 };
    }
  } else {
    rules.roster = { ...defaultRosterForType('fantasy'), ...rawRoster };
  }
  rules.roster.teamPicks = existingTeamPicks ?? 1;

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
  delete rules.trades.deadline;
  rules.trades.tradeDayPoints = 'nobody';
  if (!rules.waivers || typeof rules.waivers.enabled !== 'boolean') {
    const legacyTx = rules.transactions;
    rules.waivers = legacyTx
      ? { ...defaultWaiversForType(poolType), enabled: !!legacyTx.waivers }
      : defaultWaiversForType(poolType);
  }
  delete rules.transactions;

  if (!rules.draft) rules.draft = { type: 'snake', secondsPerPick: 60, teamPickCountsAsRound: false };
  if (!rules.draftAssistant || typeof rules.draftAssistant.enabled !== 'boolean') rules.draftAssistant = { enabled: true };
  if (!rules.lineup) rules.lineup = poolType === 'classic' ? 'fixed' : 'weekly';
  if (poolType === 'classic') rules.lineup = 'fixed';
  if (!DISPLAY_MODES.includes(rules.display)) rules.display = 'player';

  return rules;
}
