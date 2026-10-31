import {
  validateTrade, defaultTradesForType, defaultRules,
  computePicksPerMember, computeRosterQuota, computeCurrentMemberId,
} from './poolRules';

function player(id, positionGroup, salary = 0) {
  return { id, positionGroup, salary };
}

function baseRules(overrides = {}) {
  return {
    trades: { ...defaultTradesForType('fantasy'), ...overrides.trades },
    salaryCap: { enabled: false, amount: 0, source: 'manual', ...overrides.salaryCap },
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
