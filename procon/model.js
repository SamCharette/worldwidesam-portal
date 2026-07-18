const MODE_ESTIMATED = 'estimated';
const MODE_TRUE = 'true';
const MODE_FALSE = 'false';
const VALID_MODES = new Set([MODE_ESTIMATED, MODE_TRUE, MODE_FALSE]);

export const OVERRIDE_MODES = Object.freeze({
  ESTIMATED: MODE_ESTIMATED,
  TRUE: MODE_TRUE,
  FALSE: MODE_FALSE
});

function assertPlainOverrides(overrides) {
  if (overrides === undefined) return {};

  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('Overrides must be a plain object keyed by factor id.');
  }

  const prototype = Object.getPrototypeOf(overrides);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Overrides must be a plain object keyed by factor id.');
  }

  return overrides;
}

function assertFactor(factor) {
  if (factor === null || typeof factor !== 'object' || Array.isArray(factor)) {
    throw new TypeError('A factor must be an object.');
  }
  if (typeof factor.id !== 'string' || factor.id.trim() === '') {
    throw new TypeError('A factor id must be a non-empty string.');
  }
  if (typeof factor.label !== 'string' || factor.label.trim() === '') {
    throw new TypeError(`Factor ${factor.id} must have a non-empty label.`);
  }
  if (factor.type !== 'pro' && factor.type !== 'con') {
    throw new RangeError(`Factor ${factor.id} type must be "pro" or "con".`);
  }
  if (!Number.isInteger(factor.weight) || factor.weight < 1 || factor.weight > 10) {
    throw new RangeError(`Factor ${factor.id} weight must be an integer from 1 through 10.`);
  }
  if (!Number.isInteger(factor.probability) || factor.probability < 0 || factor.probability > 100) {
    throw new RangeError(`Factor ${factor.id} probability must be an integer from 0 through 100.`);
  }
}

function assertFactors(factors) {
  if (!Array.isArray(factors)) {
    throw new TypeError('Factors must be an array.');
  }

  const ids = new Set();
  for (const factor of factors) {
    assertFactor(factor);
    if (ids.has(factor.id)) {
      throw new RangeError(`Factor ids must be unique; found duplicate ${factor.id}.`);
    }
    ids.add(factor.id);
  }
}

function assertOption(option) {
  if (option === null || typeof option !== 'object' || Array.isArray(option)) {
    throw new TypeError('An option must be an object.');
  }
  if (typeof option.id !== 'string' || option.id.trim() === '') {
    throw new TypeError('An option id must be a non-empty string.');
  }
  if (typeof option.name !== 'string' || option.name.trim() === '') {
    throw new TypeError(`Option ${option.id} must have a non-empty name.`);
  }
  assertFactors(option.factors);
}

function signFor(factor) {
  return factor.type === 'pro' ? 1 : -1;
}

function overrideModeFor(factor, overrides) {
  const mode = Object.prototype.hasOwnProperty.call(overrides, factor.id)
    ? overrides[factor.id]
    : MODE_ESTIMATED;

  if (!VALID_MODES.has(mode)) {
    throw new RangeError(
      `Override for factor ${factor.id} must be "estimated", "true", or "false".`
    );
  }
  return mode;
}

function cleanZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Return a factor's current probability as a normalized value from 0 through 1.
 * Input factor probabilities remain integer percentages from 0 through 100.
 */
export function effectiveProbability(factor, overrides = {}) {
  assertFactor(factor);
  const checkedOverrides = assertPlainOverrides(overrides);
  const mode = overrideModeFor(factor, checkedOverrides);

  if (mode === MODE_TRUE) return 1;
  if (mode === MODE_FALSE) return 0;
  return factor.probability / 100;
}

/** Return the signed expected contribution for one factor. */
export function expectedContribution(factor, overrides = {}) {
  const probability = effectiveProbability(factor, overrides);
  return cleanZero(signFor(factor) * factor.weight * probability);
}

function addMass(distribution, score, mass) {
  if (mass === 0) return;
  distribution.set(score, (distribution.get(score) ?? 0) + mass);
}

/**
 * Build the exact probability mass function for the total score.
 * The returned array is sorted by score and each probability is normalized.
 */
export function scoreDistribution(factors, overrides = {}) {
  assertFactors(factors);
  const checkedOverrides = assertPlainOverrides(overrides);
  let masses = new Map([[0, 1]]);

  // A stable processing order makes floating-point results reproducible even
  // when the UI reorders factors for presentation.
  const orderedFactors = [...factors].sort((left, right) => left.id.localeCompare(right.id));
  for (const factor of orderedFactors) {
    const probability = effectiveProbability(factor, checkedOverrides);
    const scoreWhenTrue = signFor(factor) * factor.weight;
    const next = new Map();

    for (const [score, mass] of masses) {
      addMass(next, score, mass * (1 - probability));
      addMass(next, score + scoreWhenTrue, mass * probability);
    }
    masses = next;
  }

  const totalMass = [...masses.values()].reduce((total, mass) => total + mass, 0);
  return [...masses.entries()]
    .sort(([left], [right]) => left - right)
    .map(([score, probability]) => ({ score, probability: probability / totalMass }));
}

function checkedDistribution(distribution) {
  if (!Array.isArray(distribution) || distribution.length === 0) {
    throw new TypeError('A distribution must be a non-empty array.');
  }

  const sorted = distribution.map(point => {
    if (point === null || typeof point !== 'object') {
      throw new TypeError('Each distribution point must be an object.');
    }
    if (!Number.isFinite(point.score)) {
      throw new TypeError('Each distribution score must be finite.');
    }
    if (!Number.isFinite(point.probability) || point.probability < 0) {
      throw new RangeError('Each distribution probability must be a non-negative finite number.');
    }
    return { score: point.score, probability: point.probability };
  }).sort((left, right) => left.score - right.score);

  const totalMass = sorted.reduce((total, point) => total + point.probability, 0);
  if (!(totalMass > 0)) {
    throw new RangeError('A distribution must have positive probability mass.');
  }

  return { sorted, totalMass };
}

/** Return the first score whose cumulative probability reaches q (0 through 1). */
export function scoreQuantile(distribution, q) {
  if (!Number.isFinite(q) || q < 0 || q > 1) {
    throw new RangeError('A quantile must be a number from 0 through 1.');
  }

  const { sorted, totalMass } = checkedDistribution(distribution);
  if (q === 0) return sorted.find(point => point.probability > 0).score;

  const target = q * totalMass;
  let cumulative = 0;
  for (const point of sorted) {
    cumulative += point.probability;
    if (cumulative + Number.EPSILON >= target) return point.score;
  }
  return sorted.at(-1).score;
}

export const quantile = scoreQuantile;

function outcomeProbabilities(distribution) {
  const outcomes = { negative: 0, neutral: 0, positive: 0 };
  for (const point of distribution) {
    if (point.score < 0) outcomes.negative += point.probability;
    else if (point.score > 0) outcomes.positive += point.probability;
    else outcomes.neutral += point.probability;
  }
  return outcomes;
}

function contributorFor(factor, overrides) {
  const mode = overrideModeFor(factor, overrides);
  const probability = effectiveProbability(factor, overrides);
  const contribution = cleanZero(signFor(factor) * factor.weight * probability);

  return {
    id: factor.id,
    label: factor.label,
    type: factor.type,
    sign: signFor(factor),
    weight: factor.weight,
    estimatedProbability: factor.probability / 100,
    estimatedProbabilityPercent: factor.probability,
    effectiveProbability: probability,
    effectiveProbabilityPercent: probability * 100,
    mode,
    expectedContribution: contribution,
    absoluteContribution: Math.abs(contribution)
  };
}

function sensitivityFor(contributor, expectedScore) {
  const scoreIfFalse = cleanZero(expectedScore - contributor.expectedContribution);
  const scoreIfTrue = cleanZero(scoreIfFalse + contributor.sign * contributor.weight);
  const rangeLow = Math.min(scoreIfFalse, scoreIfTrue);
  const rangeHigh = Math.max(scoreIfFalse, scoreIfTrue);
  const probability = contributor.effectiveProbability;
  const varianceContribution = contributor.weight ** 2 * probability * (1 - probability);

  return {
    id: contributor.id,
    label: contributor.label,
    type: contributor.type,
    weight: contributor.weight,
    mode: contributor.mode,
    scoreIfFalse,
    scoreIfTrue,
    deltaIfFalse: cleanZero(scoreIfFalse - expectedScore),
    deltaIfTrue: cleanZero(scoreIfTrue - expectedScore),
    rangeLow,
    rangeHigh,
    crossesNeutral: rangeLow <= 0 && rangeHigh >= 0,
    varianceContribution,
    uncertaintyInfluence: Math.sqrt(varianceContribution)
  };
}

function byContribution(left, right) {
  return right.absoluteContribution - left.absoluteContribution
    || right.weight - left.weight
    || left.label.localeCompare(right.label)
    || left.id.localeCompare(right.id);
}

function bySensitivity(left, right) {
  return Number(right.crossesNeutral) - Number(left.crossesNeutral)
    || right.uncertaintyInfluence - left.uncertaintyInfluence
    || right.weight - left.weight
    || left.label.localeCompare(right.label)
    || left.id.localeCompare(right.id);
}

/** Analyze one choice relative to the implicit zero-score baseline. */
export function analyzeOption(option, overrides = {}) {
  assertOption(option);
  const checkedOverrides = assertPlainOverrides(overrides);
  const distribution = scoreDistribution(option.factors, checkedOverrides);
  const contributors = option.factors
    .map(factor => contributorFor(factor, checkedOverrides))
    .sort(byContribution);
  const expectedScore = cleanZero(
    contributors.reduce((total, contributor) => total + contributor.expectedContribution, 0)
  );
  const variance = contributors.reduce((total, contributor) => {
    const probability = contributor.effectiveProbability;
    return total + contributor.weight ** 2 * probability * (1 - probability);
  }, 0);
  const quantiles = {
    p10: scoreQuantile(distribution, 0.1),
    p50: scoreQuantile(distribution, 0.5),
    p90: scoreQuantile(distribution, 0.9)
  };

  return {
    id: option.id,
    name: option.name,
    factorCount: option.factors.length,
    expectedScore,
    variance,
    standardDeviation: Math.sqrt(variance),
    distribution,
    quantiles,
    likelyRange: {
      low: quantiles.p10,
      high: quantiles.p90,
      coverage: 0.8
    },
    possibleRange: {
      min: distribution[0].score,
      max: distribution.at(-1).score
    },
    outcomeProbabilities: outcomeProbabilities(distribution),
    contributors,
    sensitivity: contributors
      .map(contributor => sensitivityFor(contributor, expectedScore))
      .sort(bySensitivity)
  };
}

/**
 * Analyze unchanged estimates alongside a non-mutating what-if scenario.
 */
export function analyzeBaselineVsScenario(option, overrides = {}) {
  const checkedOverrides = assertPlainOverrides(overrides);
  const baseline = analyzeOption(option);
  const scenario = analyzeOption(option, checkedOverrides);
  const baselineById = new Map(baseline.contributors.map(factor => [factor.id, factor]));
  const changedFactors = scenario.contributors
    .filter(factor => factor.mode !== MODE_ESTIMATED)
    .map(factor => ({
      id: factor.id,
      label: factor.label,
      mode: factor.mode,
      baselineContribution: baselineById.get(factor.id).expectedContribution,
      scenarioContribution: factor.expectedContribution,
      contributionDelta: cleanZero(
        factor.expectedContribution - baselineById.get(factor.id).expectedContribution
      )
    }));

  return {
    baseline,
    scenario,
    hasOverrides: changedFactors.length > 0,
    expectedScoreDelta: cleanZero(scenario.expectedScore - baseline.expectedScore),
    changedFactors
  };
}
