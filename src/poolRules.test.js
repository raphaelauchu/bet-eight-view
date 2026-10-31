import {
  validateTrade, defaultTradesForType, defaultRules, normalizeRules,
  computePicksPerMember, computeRosterQuota, computeCurrentMemberId,
  mirrorSkaterPoints, mirrorGoaliePoints, mirrorTeamPoints, mirrorGameCountsForPeriod,
} from './poolRules';

function player(id, positionGroup, salary = 0) {
  return { id, positionGroup, salary };
}

function baseRules(overrides = {}) {
  return {
    trades: { ...defaultTradesForType('fantasy'), ...overrides.trades },
    salaryCap: { enabled: false, amount: 0, source: 'capHit', ...overrides.salaryCap },
  };
}

test('valide un echange equilibre sans contrainte de plafond', () => {
  const rosterA = [player('p1', 'forward'), player('p2', 'defense')];
  const rosterB = [player('p3', 'forward'), player('p4', 'defense')];
  const result = validateTrade(baseRules(), rosterA, rosterB, [player('p1', 'forward')], [player('p3', 'forward')]);
  expect(result.ok).toBe(true);
  expect(result.errors).toEqual([]);
});

test('refuse un echange desequilibre par poste quand balanceByPosition est actif', () => {
  const rosterA = [player('p1', 'forward'), player('p2', 'defense')];
  const rosterB = [player('p3', 'forward')];
  const result = validateTrade(baseRules(), rosterA, rosterB, [player('p1', 'forward'), player('p2', 'defense')], [player('p3', 'forward')]);
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('pool_trade_error_position_imbalance');
});

test('autorise un echange desequilibre quand balanceByPosition est desactive', () => {
  const rosterA = [player('p1', 'forward'), player('p2', 'defense')];
  const rosterB = [player('p3', 'forward')];
  const rules = baseRules({ trades: { balanceByPosition: false } });
  const result = validateTrade(rules, rosterA, rosterB, [player('p1', 'forward'), player('p2', 'defense')], [player('p3', 'forward')]);
  expect(result.ok).toBe(true);
});

test('refuse un echange qui depasse le plafond salarial', () => {
  const rosterA = [player('p1', 'forward', 1000000)];
  const rosterB = [player('p2', 'forward', 9000000)];
  const rules = baseRules({ salaryCap: { enabled: true, amount: 5000000 } });
  const result = validateTrade(rules, rosterA, rosterB, [player('p1', 'forward', 1000000)], [player('p2', 'forward', 9000000)]);
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('pool_trade_error_salary_cap_a');
});

test("refuse la reprise d'un joueur deja echange quand noReacquire est actif", () => {
  const rosterA = [player('p1', 'forward')];
  const rosterB = [player('p9', 'forward')];
  const rules = baseRules({ trades: { noReacquire: true } });
  const history = { tradedAwayByA: ['p9'] };
  const result = validateTrade(rules, rosterA, rosterB, [player('p1', 'forward')], [player('p9', 'forward')], history);
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('pool_trade_error_no_reacquire_a');
});

test('refuse un echange au-dela du nombre maximum par saison', () => {
  const rosterA = [player('p1', 'forward')];
  const rosterB = [player('p2', 'forward')];
  const rules = baseRules({ trades: { maxPerSeason: 1 } });
  const history = { countA: 1 };
  const result = validateTrade(rules, rosterA, rosterB, [player('p1', 'forward')], [player('p2', 'forward')], history);
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('pool_trade_error_max_per_season_a');
});

// ===================== Scenarios miroirs des tests SQL (execute_trade/pool_trade_check) =====================
// Memes verdicts attendus que les scenarios Postgres de la migration Phase 4A
// (supabase/migrations/20261108_pool_trades_waivers.sql), exerces ici cote JS pour garantir
// que l'apercu d'interface et la validation serveur ne divergent jamais.

test('valide un echange 2 attaquants contre 2 attaquants (equilibre)', () => {
  const rosterA = [player('a1', 'forward', 500000), player('a2', 'forward', 400000), player('a3', 'defense', 600000)];
  const rosterB = [player('b1', 'forward', 450000), player('b2', 'forward', 400000), player('b3', 'defense', 550000)];
  const result = validateTrade(
    baseRules({ salaryCap: { enabled: true, amount: 3000000 } }),
    rosterA, rosterB,
    [player('a1', 'forward', 500000), player('a2', 'forward', 400000)],
    [player('b1', 'forward', 450000), player('b2', 'forward', 400000)]
  );
  expect(result.ok).toBe(true);
  expect(result.errors).toEqual([]);
});

test('refuse un echange 2 attaquants contre 1 attaquant + 1 defenseur (meme total, mauvais postes)', () => {
  const rosterA = [player('a1', 'forward'), player('a2', 'forward')];
  const rosterB = [player('b1', 'forward'), player('b2', 'defense')];
  const result = validateTrade(
    baseRules(),
    rosterA, rosterB,
    [player('a1', 'forward'), player('a2', 'forward')],
    [player('b1', 'forward'), player('b2', 'defense')]
  );
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('pool_trade_error_position_imbalance');
});

test('refuse un echange si les echanges sont desactives', () => {
  const rules = baseRules({ trades: { enabled: false } });
  const result = validateTrade(rules, [], [], [], []);
  expect(result.ok).toBe(false);
  expect(result.errors).toEqual(['pool_trade_error_disabled']);
});

test('detecte un joueur qui ne fait pas partie du roster cedant', () => {
  const rosterA = [player('p1', 'forward')];
  const rosterB = [player('p2', 'forward')];
  const result = validateTrade(baseRules(), rosterA, rosterB, [player('ghost', 'forward')], [player('p2', 'forward')]);
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('pool_trade_error_invalid_ownership');
});

test('computePicksPerMember : classique = total du roster, equipe NHL non comptee par defaut', () => {
  const rules = defaultRules('classic');
  expect(computePicksPerMember(rules)).toBe(9 + 6 + 2);
});

test('computePicksPerMember : equipe NHL comptee comme une ronde si teamPickCountsAsRound', () => {
  const rules = defaultRules('classic');
  rules.draft.teamPickCountsAsRound = true;
  expect(computePicksPerMember(rules)).toBe(9 + 6 + 2 + 1);
});

test('computeRosterQuota : postes distincts en classique', () => {
  const rules = defaultRules('classic');
  expect(computeRosterQuota(rules, 'F')).toBe(9);
  expect(computeRosterQuota(rules, 'D')).toBe(6);
  expect(computeRosterQuota(rules, 'G')).toBe(2);
  expect(computeRosterQuota(rules, 'TEAM')).toBe(1);
});

test('computeRosterQuota : F et D partagent un quota combine en fantasy', () => {
  const rules = defaultRules('fantasy');
  const combined = rules.roster.C + rules.roster.LW + rules.roster.RW + rules.roster.D + rules.roster.UTIL + rules.roster.bench + rules.roster.ir;
  expect(computeRosterQuota(rules, 'F')).toBe(combined);
  expect(computeRosterQuota(rules, 'D')).toBe(combined);
});

test('computeCurrentMemberId : ordre lineaire repete simplement l\'ordre a chaque ronde', () => {
  const order = ['a', 'b', 'c'];
  expect(computeCurrentMemberId(order, 1, 'linear')).toBe('a');
  expect(computeCurrentMemberId(order, 3, 'linear')).toBe('c');
  expect(computeCurrentMemberId(order, 4, 'linear')).toBe('a');
});

test('computeCurrentMemberId : ordre snake s\'inverse a la deuxieme ronde', () => {
  const order = ['a', 'b', 'c'];
  expect(computeCurrentMemberId(order, 3, 'snake')).toBe('c');
  expect(computeCurrentMemberId(order, 4, 'snake')).toBe('c');
  expect(computeCurrentMemberId(order, 6, 'snake')).toBe('a');
  expect(computeCurrentMemberId(order, 7, 'snake')).toBe('a');
});

test('defaultRules : pointage des gardiens inclut buts et passes a 0', () => {
  const rules = defaultRules('fantasy');
  expect(rules.scoring.goalie.goals).toBe(0);
  expect(rules.scoring.goalie.assists).toBe(0);
  expect(rules.scoring.goalie.wins).toBe(0);
});

test('defaultRules : pointage d\'equipe utilise shootoutLosses (pas shutouts) et source=capHit', () => {
  const rules = defaultRules('classic');
  expect(rules.scoring.team).toEqual({ wins: 0, overtimeLosses: 0, shootoutLosses: 0 });
  expect(rules.salaryCap.source).toBe('capHit');
});

test('normalizeRules : ajoute goals/assists aux gardiens d\'un ancien pool', () => {
  const legacy = { poolType: 'classic', scoring: { skater: { goals: 1 }, goalie: { wins: 2, shutouts: 3 } } };
  const rules = normalizeRules(legacy);
  expect(rules.scoring.goalie).toEqual({ goals: 0, assists: 0, wins: 2, shutouts: 3, saves: 0, goalsAgainst: 0, otLosses: 0 });
});

test('normalizeRules : scoring.team.shutouts devient shootoutLosses=0 (pas migre)', () => {
  const legacy = { poolType: 'classic', scoring: { team: { wins: 5, shutouts: 2 } } };
  const rules = normalizeRules(legacy);
  expect(rules.scoring.team).toEqual({ wins: 5, overtimeLosses: 0, shootoutLosses: 0 });
  expect(rules.scoring.team.shutouts).toBeUndefined();
});

test('normalizeRules : salaryCap.source nhl/manual migrent vers capHit', () => {
  const legacyNhl = normalizeRules({ salaryCap: { enabled: true, amount: 1, source: 'nhl' } });
  const legacyManual = normalizeRules({ salaryCap: { enabled: true, amount: 1, source: 'manual' } });
  const alreadyNew = normalizeRules({ salaryCap: { enabled: true, amount: 1, source: 'actualSalary' } });
  expect(legacyNhl.salaryCap.source).toBe('capHit');
  expect(legacyManual.salaryCap.source).toBe('capHit');
  expect(alreadyNew.salaryCap.source).toBe('actualSalary');
});

// ===================== Moteur de pointage (Phase 3) - miroir JS de la formule SQL =====================

function scoringRules(overrides = {}) {
  const rules = defaultRules('classic');
  rules.scoring.forward = { ...rules.scoring.forward, ...overrides.forward };
  rules.scoring.defense = { ...rules.scoring.defense, ...overrides.defense };
  rules.scoring.goalie = { ...rules.scoring.goalie, ...overrides.goalie };
  rules.scoring.team = { ...rules.scoring.team, ...overrides.team };
  return rules;
}

test('pointage : bareme different attaquants/defenseurs pour la meme ligne de stats', () => {
  const rules = scoringRules({ forward: { goals: 3, assists: 2 }, defense: { goals: 5, assists: 1 } });
  const stats = { goals: 2, assists: 1, powerPlayPoints: 0, shortHandedPoints: 0, shotsOnGoal: 0, hits: 0, blockedShots: 0, pim: 0, plusMinus: 0, gameWinningGoals: 0 };

  const forwardPoints = mirrorSkaterPoints(rules, 'F', stats);
  const defensePoints = mirrorSkaterPoints(rules, 'D', stats);

  expect(forwardPoints).toBe(2 * 3 + 1 * 2); // 8
  expect(defensePoints).toBe(2 * 5 + 1 * 1); // 11
  expect(forwardPoints).not.toBe(defensePoints);
});

test('pointage : gardien avec victoire + blanchissage + but/passe', () => {
  const rules = scoringRules({ goalie: { wins: 2, shutouts: 5, saves: 0.1, goals: 10, assists: 4, goalsAgainst: -1, otLosses: 1 } });
  const stats = { goals: 1, assists: 1, decision: 'W', shutout: true, saves: 30, goalsAgainst: 0 };

  const points = mirrorGoaliePoints(rules, stats);

  expect(points).toBeCloseTo(1 * 10 + 1 * 4 + 1 * 2 + 1 * 5 + 30 * 0.1 + 0 * -1 + 0 * 1); // 24
});

test('pointage : equipe NHL victoire vs defaite en prolongation vs defaite en tirs de barrage', () => {
  const rules = scoringRules({ team: { wins: 3, overtimeLosses: 1, shootoutLosses: 0.5 } });

  expect(mirrorTeamPoints(rules, 'W')).toBe(3);
  expect(mirrorTeamPoints(rules, 'OTL')).toBe(1);
  expect(mirrorTeamPoints(rules, 'SOL')).toBe(0.5);
  expect(mirrorTeamPoints(rules, 'L')).toBe(0); // defaite reguliere : jamais de points
});

test('pointage : un match avant from_at (debut du pointage) est ignore', () => {
  const finalGame = { state: 'FINAL', startTimeUtc: '2026-01-10T00:00:00Z' };
  const fromAt = '2026-01-15T00:00:00Z';

  expect(mirrorGameCountsForPeriod(finalGame, fromAt, null)).toBe(false);
  expect(mirrorGameCountsForPeriod({ ...finalGame, startTimeUtc: '2026-01-20T00:00:00Z' }, fromAt, null)).toBe(true);
});

test('pointage : un joueur sans match rapporte zero point', () => {
  const rules = scoringRules({ forward: { goals: 5, assists: 3 } });
  const stats = { goals: 0, assists: 0, powerPlayPoints: 0, shortHandedPoints: 0, shotsOnGoal: 0, hits: 0, blockedShots: 0, pim: 0, plusMinus: 0, gameWinningGoals: 0 };

  expect(mirrorSkaterPoints(rules, 'F', stats)).toBe(0);
});
