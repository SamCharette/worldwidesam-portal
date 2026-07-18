import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
  analyzeBaselineVsScenario,
  analyzeOption,
  effectiveProbability,
  expectedContribution,
  quantile,
  scoreDistribution,
  scoreQuantile
} from '../procon/model.js';

const closeTo = (actual, expected, tolerance = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

const factor = (id, type, weight, probability, label = id) => ({
  id,
  label,
  type,
  weight,
  probability
});

const option = factors => ({ id: 'yes', name: 'Yes', factors });

function moment(distribution, order, center = 0) {
  return distribution.reduce(
    (total, point) => total + (point.score - center) ** order * point.probability,
    0
  );
}

test('one 50% pro has the exact two-point distribution and expected score', () => {
  const choice = option([factor('freedom', 'pro', 10, 50)]);
  const analysis = analyzeOption(choice);

  assert.deepEqual(analysis.distribution, [
    { score: 0, probability: 0.5 },
    { score: 10, probability: 0.5 }
  ]);
  assert.equal(analysis.expectedScore, 5);
  assert.equal(analysis.variance, 25);
  assert.equal(analysis.outcomeProbabilities.positive, 0.5);
  assert.equal(analysis.outcomeProbabilities.neutral, 0.5);
  assert.deepEqual(analysis.likelyRange, { low: 0, high: 10, coverage: 0.8 });
});

test('one 25% con is signed negatively', () => {
  const cost = factor('benefits', 'con', 4, 25);

  assert.equal(effectiveProbability(cost), 0.25);
  assert.equal(expectedContribution(cost), -1);
  assert.deepEqual(scoreDistribution([cost]), [
    { score: -4, probability: 0.25 },
    { score: 0, probability: 0.75 }
  ]);
});

test('independent pro and con probabilities combine into the exact score map', () => {
  const analysis = analyzeOption(option([
    factor('upside', 'pro', 2, 50),
    factor('downside', 'con', 1, 50)
  ]));

  assert.deepEqual(analysis.distribution, [
    { score: -1, probability: 0.25 },
    { score: 0, probability: 0.25 },
    { score: 1, probability: 0.25 },
    { score: 2, probability: 0.25 }
  ]);
  assert.equal(analysis.expectedScore, 0.5);
  assert.deepEqual(analysis.outcomeProbabilities, {
    negative: 0.25,
    neutral: 0.25,
    positive: 0.5
  });
});

test('scenario overrides change effective outcomes without mutating estimates', () => {
  const steadyWork = factor('steady-work', 'pro', 8, 70, 'Steady client work');
  const choice = option([steadyWork]);
  const saved = structuredClone(choice);

  assert.equal(expectedContribution(steadyWork), 5.6);
  assert.equal(expectedContribution(steadyWork, { 'steady-work': 'true' }), 8);
  assert.equal(expectedContribution(steadyWork, { 'steady-work': 'false' }), 0);
  assert.equal(effectiveProbability(steadyWork, { 'steady-work': 'estimated' }), 0.7);

  const comparison = analyzeBaselineVsScenario(choice, { 'steady-work': 'true' });
  closeTo(comparison.baseline.expectedScore, 5.6);
  assert.equal(comparison.scenario.expectedScore, 8);
  closeTo(comparison.expectedScoreDelta, 2.4);
  assert.equal(comparison.hasOverrides, true);
  assert.deepEqual(comparison.changedFactors, [{
    id: 'steady-work',
    label: 'Steady client work',
    mode: 'true',
    baselineContribution: 5.6,
    scenarioContribution: 8,
    contributionDelta: 2.4000000000000004
  }]);
  assert.deepEqual(choice, saved);
});

test('multiple overrides compose and an explicit estimated mode preserves the input', () => {
  const choice = option([
    factor('freedom', 'pro', 8, 30),
    factor('income-risk', 'con', 7, 60),
    factor('admin', 'con', 2, 100)
  ]);
  const scenario = analyzeBaselineVsScenario(choice, {
    freedom: 'true',
    'income-risk': 'false',
    admin: 'estimated'
  });

  closeTo(scenario.baseline.expectedScore, -3.8);
  assert.equal(scenario.scenario.expectedScore, 6);
  closeTo(scenario.expectedScoreDelta, 9.8);
  assert.deepEqual(
    scenario.changedFactors.map(change => [change.id, change.mode]),
    [['freedom', 'true'], ['income-risk', 'false']]
  );
  assert.deepEqual(scenario.scenario.distribution, [{ score: 6, probability: 1 }]);
});

test('distribution mass, mean, and variance match independent-factor formulas', () => {
  const factors = [
    factor('a', 'pro', 9, 33),
    factor('b', 'con', 6, 81),
    factor('c', 'pro', 3, 47),
    factor('d', 'con', 2, 12)
  ];
  const analysis = analyzeOption(option(factors));
  const mass = analysis.distribution.reduce((total, point) => total + point.probability, 0);
  const distributionMean = moment(analysis.distribution, 1);
  const distributionVariance = moment(analysis.distribution, 2, distributionMean);
  const formulaMean = factors.reduce(
    (total, item) => total + (item.type === 'pro' ? 1 : -1) * item.weight * item.probability / 100,
    0
  );
  const formulaVariance = factors.reduce((total, item) => {
    const probability = item.probability / 100;
    return total + item.weight ** 2 * probability * (1 - probability);
  }, 0);

  closeTo(mass, 1);
  closeTo(analysis.expectedScore, formulaMean);
  closeTo(distributionMean, formulaMean);
  closeTo(analysis.variance, formulaVariance);
  closeTo(distributionVariance, formulaVariance);
});

test('deterministic probabilities and all-con lists retain their real ranges', () => {
  const analysis = analyzeOption(option([
    factor('certain-loss', 'con', 5, 100),
    factor('impossible-loss', 'con', 10, 0),
    factor('possible-loss', 'con', 3, 50)
  ]));

  assert.deepEqual(analysis.distribution, [
    { score: -8, probability: 0.5 },
    { score: -5, probability: 0.5 }
  ]);
  assert.deepEqual(analysis.possibleRange, { min: -8, max: -5 });
  assert.deepEqual(analysis.outcomeProbabilities, { negative: 1, neutral: 0, positive: 0 });
});

test('an empty option is a neutral deterministic analysis', () => {
  const analysis = analyzeOption(option([]));

  assert.equal(analysis.expectedScore, 0);
  assert.equal(analysis.variance, 0);
  assert.deepEqual(analysis.distribution, [{ score: 0, probability: 1 }]);
  assert.deepEqual(analysis.quantiles, { p10: 0, p50: 0, p90: 0 });
  assert.deepEqual(analysis.possibleRange, { min: 0, max: 0 });
});

test('quantiles use the first score reaching the requested cumulative mass', () => {
  const distribution = [
    { score: 5, probability: 0.5 },
    { score: -2, probability: 0.2 },
    { score: 1, probability: 0.3 }
  ];

  assert.equal(scoreQuantile(distribution, 0), -2);
  assert.equal(scoreQuantile(distribution, 0.2), -2);
  assert.equal(scoreQuantile(distribution, 0.20001), 1);
  assert.equal(quantile(distribution, 0.5), 1);
  assert.equal(scoreQuantile(distribution, 1), 5);
});

test('contributors and sensitivity expose signed endpoints and neutral crossings', () => {
  const analysis = analyzeOption(option([
    factor('large-upside', 'pro', 8, 70, 'Large upside'),
    factor('small-cost', 'con', 2, 50, 'Small cost')
  ]));
  const contributor = analysis.contributors.find(item => item.id === 'large-upside');
  const sensitivity = analysis.sensitivity.find(item => item.id === 'large-upside');

  closeTo(contributor.expectedContribution, 5.6);
  assert.equal(contributor.mode, 'estimated');
  closeTo(sensitivity.scoreIfFalse, -1);
  closeTo(sensitivity.scoreIfTrue, 7);
  closeTo(sensitivity.deltaIfFalse, -5.6);
  closeTo(sensitivity.deltaIfTrue, 2.4);
  assert.equal(sensitivity.crossesNeutral, true);
  closeTo(sensitivity.varianceContribution, 13.44);
  closeTo(sensitivity.uncertaintyInfluence, Math.sqrt(13.44));
  assert.equal(analysis.sensitivity[0].id, 'large-upside');
});

test('factor order does not affect the distribution or totals', () => {
  const factors = [
    factor('one', 'pro', 4, 20),
    factor('two', 'con', 7, 65),
    factor('three', 'pro', 2, 90)
  ];
  const forward = analyzeOption(option(factors));
  const reverse = analyzeOption(option([...factors].reverse()));

  assert.deepEqual(reverse.distribution, forward.distribution);
  assert.equal(reverse.expectedScore, forward.expectedScore);
  assert.equal(reverse.variance, forward.variance);
});

test('options are analyzed independently against the same zero baseline', () => {
  const freelance = analyzeOption({
    id: 'freelance',
    name: 'Freelance',
    factors: [factor('freelance-freedom', 'pro', 9, 80)]
  });
  const employment = analyzeOption({
    id: 'employment',
    name: 'Employment',
    factors: [factor('employment-stability', 'pro', 6, 100)]
  });

  closeTo(freelance.expectedScore, 7.2);
  assert.equal(employment.expectedScore, 6);
  assert.equal(freelance.possibleRange.min, 0);
  assert.equal(employment.possibleRange.min, 6);
});

test('invalid inputs fail instead of being silently clamped or ignored', () => {
  assert.throws(() => analyzeOption(option([factor('bad-weight', 'pro', 0, 50)])), /weight/);
  assert.throws(() => analyzeOption(option([factor('bad-probability', 'pro', 5, 101)])), /probability/);
  assert.throws(() => analyzeOption(option([factor('fraction', 'pro', 5, 50.5)])), /probability/);
  assert.throws(() => analyzeOption(option([
    factor('duplicate', 'pro', 5, 50),
    factor('duplicate', 'con', 4, 50)
  ])), /unique/);
  assert.throws(
    () => effectiveProbability(factor('x', 'pro', 5, 50), { x: 'maybe' }),
    /estimated.*true.*false/
  );
  assert.throws(() => scoreQuantile([{ score: 0, probability: 1 }], 1.1), /quantile/);
});

test('the exact DP handles 100 factors quickly without enumerating combinations', () => {
  const factors = Array.from({ length: 100 }, (_, index) => factor(
    `factor-${index}`,
    index % 2 === 0 ? 'pro' : 'con',
    10,
    50
  ));
  const started = performance.now();
  const analysis = analyzeOption(option(factors));
  const elapsed = performance.now() - started;

  closeTo(analysis.distribution.reduce((total, point) => total + point.probability, 0), 1);
  closeTo(analysis.expectedScore, 0);
  assert.equal(analysis.distribution.length, 101);
  assert.deepEqual(analysis.possibleRange, { min: -500, max: 500 });
  assert.ok(elapsed < 1_000, `expected analysis under 1 second, took ${elapsed.toFixed(1)}ms`);
});
