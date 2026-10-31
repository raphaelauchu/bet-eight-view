import { validateTrade, defaultTradesForType } from './poolRules';

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
