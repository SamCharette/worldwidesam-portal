const DEFAULT_MAX_ANGLE_RADIANS = Math.PI / 12;

function finiteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return value;
}

function positiveNumber(value, name) {
  finiteNumber(value, name);
  if (!(value > 0)) throw new RangeError(`${name} must be greater than zero.`);
  return value;
}

function nonNegativeNumber(value, name) {
  finiteNumber(value, name);
  if (value < 0) throw new RangeError(`${name} must not be negative.`);
  return value;
}

function checkedPoint(point, name = 'point') {
  if (point === null || typeof point !== 'object' || Array.isArray(point)) {
    throw new TypeError(`${name} must be an object with x and y coordinates.`);
  }
  return {
    x: finiteNumber(point.x, `${name}.x`),
    y: finiteNumber(point.y, `${name}.y`),
  };
}

function sideSign(side) {
  if (side === 'pro' || side === 'right' || side === 1) return 1;
  if (side === 'con' || side === 'left' || side === -1) return -1;
  throw new RangeError('side must be "pro", "con", "right", "left", 1, or -1.');
}

function rangeFrom(source) {
  if (source?.possibleRange) return rangeFrom(source.possibleRange);
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('A score range must be an object with finite min and max values.');
  }

  const min = finiteNumber(source.min, 'score range min');
  const max = finiteNumber(source.max, 'score range max');
  if (min > max) throw new RangeError('A score range min must not exceed its max.');
  return { min, max };
}

/**
 * Radius for a factor disk. Because r = sqrt(weight) * scale, disk area is
 * exactly proportional to importance weight.
 */
export function importanceRadius(weight, scale = 1) {
  positiveNumber(weight, 'weight');
  positiveNumber(scale, 'radius scale');
  return Math.sqrt(weight) * scale;
}

/**
 * One symmetric score magnitude shared by every rendered state. It is based
 * on possible score ranges, never on separate pro/con totals.
 */
export function scoreDomainMagnitude(...sources) {
  const pending = sources.length === 1 && Array.isArray(sources[0])
    ? sources[0]
    : sources;
  let magnitude = 1;

  for (const source of pending) {
    if (Array.isArray(source)) {
      magnitude = Math.max(magnitude, scoreDomainMagnitude(source));
      continue;
    }
    const range = rangeFrom(source);
    magnitude = Math.max(magnitude, Math.abs(range.min), Math.abs(range.max));
  }
  return magnitude;
}

/**
 * SVG-style coordinates have y increasing downwards, so a positive angle is
 * clockwise. Positive scores therefore lower the right arm.
 */
export function balanceAngle(
  score,
  domainMagnitude,
  maxAngleRadians = DEFAULT_MAX_ANGLE_RADIANS,
) {
  finiteNumber(score, 'score');
  positiveNumber(domainMagnitude, 'score domain magnitude');
  nonNegativeNumber(maxAngleRadians, 'maximum angle');
  return (score / domainMagnitude) * maxAngleRadians;
}

/**
 * Return beam endpoints around a fixed pivot while preserving the calibrated
 * horizontal chance scale. The half length is the visible 0–100% arm span;
 * tilt changes only y, so editing another property never shifts chance x.
 */
export function armEndpoints(pivot, halfLength, angleRadians = 0) {
  const origin = checkedPoint(pivot, 'pivot');
  positiveNumber(halfLength, 'arm half length');
  finiteNumber(angleRadians, 'angle');

  const xOffset = halfLength;
  const yOffset = Math.tan(angleRadians) * halfLength;
  return {
    left: { x: origin.x - xOffset, y: origin.y - yOffset },
    right: { x: origin.x + xOffset, y: origin.y + yOffset },
  };
}

/**
 * Locate a factor's lever anchor. Probability zero is exactly the pivot and
 * probability one is exactly the appropriate arm endpoint.
 */
export function probabilityAnchor(
  pivot,
  halfLength,
  side,
  effectiveProbability,
  angleRadians = 0,
) {
  const origin = checkedPoint(pivot, 'pivot');
  positiveNumber(halfLength, 'arm half length');
  finiteNumber(effectiveProbability, 'effective probability');
  if (effectiveProbability < 0 || effectiveProbability > 1) {
    throw new RangeError('effective probability must be from zero through one.');
  }

  const endpoints = armEndpoints(origin, halfLength, angleRadians);
  const endpoint = sideSign(side) === 1 ? endpoints.right : endpoints.left;
  if (effectiveProbability === 0) return { ...origin };
  if (effectiveProbability === 1) return { ...endpoint };
  return {
    x: origin.x + (endpoint.x - origin.x) * effectiveProbability,
    y: origin.y + (endpoint.y - origin.y) * effectiveProbability,
  };
}

function packingItem(item, index) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError('Each packed factor must be an object.');
  }
  const anchor = item.anchor
    ? checkedPoint(item.anchor, `factor ${item.id ?? index} anchor`)
    : checkedPoint(
      { x: item.anchorX, y: item.anchorY ?? 0 },
      `factor ${item.id ?? index} anchor`,
    );
  const radius = positiveNumber(item.radius, `factor ${item.id ?? index} radius`);
  const id = typeof item.id === 'string' ? item.id : String(index);
  return { item, index, id, anchor, radius };
}

/**
 * Assign the first available vertical lane to each factor. Packing is sorted
 * by geometry and id, so the result does not depend on input order. Only y is
 * displaced: both the encoded anchor and disk center keep the exact anchor x.
 */
export function packFactorLanes(items, options = {}) {
  if (!Array.isArray(items)) throw new TypeError('Packed factors must be an array.');

  const gap = nonNegativeNumber(options.gap ?? 2, 'lane gap');
  const connectorGap = nonNegativeNumber(options.connectorGap ?? 2, 'connector gap');
  const direction = options.direction ?? -1;
  if (direction !== 1 && direction !== -1) {
    throw new RangeError('lane direction must be 1 or -1.');
  }

  const normalized = items.map(packingItem);
  const maxRadius = normalized.reduce((largest, factor) => Math.max(largest, factor.radius), 0);
  const lanePitch = options.lanePitch === undefined
    ? maxRadius * 2 + gap
    : positiveNumber(options.lanePitch, 'lane pitch');
  const laneEnds = [];
  const lanesByIndex = new Map();

  const sorted = [...normalized].sort((left, right) => {
    const leftStart = left.anchor.x - left.radius;
    const rightStart = right.anchor.x - right.radius;
    return leftStart - rightStart
      || (left.anchor.x + left.radius) - (right.anchor.x + right.radius)
      || left.id.localeCompare(right.id);
  });

  for (const factor of sorted) {
    const intervalStart = factor.anchor.x - factor.radius;
    const intervalEnd = factor.anchor.x + factor.radius;
    let lane = laneEnds.findIndex((end) => intervalStart >= end + gap);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = intervalEnd;
    lanesByIndex.set(factor.index, lane);
  }

  return normalized.map(({ item, index, anchor, radius }) => {
    const lane = lanesByIndex.get(index);
    const y = anchor.y + direction * (connectorGap + radius + lane * lanePitch);
    return {
      ...item,
      radius,
      anchor,
      anchorX: anchor.x,
      anchorY: anchor.y,
      lane,
      x: anchor.x,
      y,
      center: { x: anchor.x, y },
    };
  });
}

function checkedScoreScale(scale) {
  if (scale === null || typeof scale !== 'object' || Array.isArray(scale)) {
    throw new TypeError('A score scale must be an object.');
  }
  return {
    zeroX: finiteNumber(scale.zeroX, 'score scale zeroX'),
    halfWidth: positiveNumber(scale.halfWidth, 'score scale halfWidth'),
    domainMagnitude: positiveNumber(scale.domainMagnitude, 'score scale domain magnitude'),
  };
}

/** Map a score linearly without rounding, clamping, binning, or jitter. */
export function scoreToX(score, scale) {
  finiteNumber(score, 'score');
  const checked = checkedScoreScale(scale);
  return checked.zeroX + (score / checked.domainMagnitude) * checked.halfWidth;
}

/**
 * Preserve every exact distribution score and discrete likely-range endpoint
 * while adding renderer-ready x coordinates.
 */
export function distributionCoordinates(distribution, likelyRange, scale) {
  if (!Array.isArray(distribution)) throw new TypeError('A distribution must be an array.');
  if (likelyRange === null || typeof likelyRange !== 'object' || Array.isArray(likelyRange)) {
    throw new TypeError('A likely range must be an object.');
  }
  const low = finiteNumber(likelyRange.low, 'likely range low');
  const high = finiteNumber(likelyRange.high, 'likely range high');
  if (low > high) throw new RangeError('A likely range low must not exceed its high.');

  const points = distribution.map((point) => {
    if (point === null || typeof point !== 'object' || Array.isArray(point)) {
      throw new TypeError('Each distribution point must be an object.');
    }
    const score = finiteNumber(point.score, 'distribution score');
    const probability = nonNegativeNumber(point.probability, 'distribution probability');
    return { ...point, score, probability, x: scoreToX(score, scale) };
  });

  return {
    points,
    likelyRange: {
      ...likelyRange,
      low,
      high,
      lowX: scoreToX(low, scale),
      highX: scoreToX(high, scale),
    },
  };
}

function checkedAnalysis(analysis, name) {
  if (analysis === null || typeof analysis !== 'object' || Array.isArray(analysis)) {
    throw new TypeError(`${name} analysis must be an object.`);
  }
  finiteNumber(analysis.expectedScore, `${name} expected score`);
  rangeFrom(analysis);
  if (!Array.isArray(analysis.contributors)) {
    throw new TypeError(`${name} contributors must be an array.`);
  }
  if (!Array.isArray(analysis.distribution)) {
    throw new TypeError(`${name} distribution must be an array.`);
  }
  return analysis;
}

function beamState(analysis, pivot, halfLength, domainMagnitude, maxAngleRadians) {
  const angle = balanceAngle(analysis.expectedScore, domainMagnitude, maxAngleRadians);
  return {
    score: analysis.expectedScore,
    angle,
    endpoints: armEndpoints(pivot, halfLength, angle),
  };
}

/**
 * Build all geometry needed by a balance renderer without touching the DOM.
 * Options accept width/height directly or under a dimensions property.
 */
export function buildBalanceScene(
  { baseline, scenario, hasOverrides = false },
  options = {},
) {
  const checkedBaseline = checkedAnalysis(baseline, 'baseline');
  const checkedScenario = checkedAnalysis(scenario, 'scenario');
  const settings = { ...options, ...(options.dimensions ?? {}) };
  const width = positiveNumber(settings.width ?? 640, 'scene width');
  const height = positiveNumber(settings.height ?? 360, 'scene height');
  const padding = nonNegativeNumber(settings.padding ?? 32, 'scene padding');
  const pivot = checkedPoint({
    x: settings.pivotX ?? width / 2,
    y: settings.pivotY ?? height * 0.42,
  }, 'pivot');
  const halfLength = positiveNumber(
    settings.armHalfLength ?? Math.max(1, width / 2 - padding),
    'arm half length',
  );
  const radiusScale = positiveNumber(settings.radiusScale ?? 4, 'radius scale');
  const maxAngleRadians = nonNegativeNumber(
    settings.maxAngleRadians ?? DEFAULT_MAX_ANGLE_RADIANS,
    'maximum angle',
  );
  const domainMagnitude = scoreDomainMagnitude(checkedBaseline, checkedScenario);
  const baselineBeam = beamState(
    checkedBaseline,
    pivot,
    halfLength,
    domainMagnitude,
    maxAngleRadians,
  );
  const scenarioBeam = beamState(
    checkedScenario,
    pivot,
    halfLength,
    domainMagnitude,
    maxAngleRadians,
  );
  const baselineById = new Map(
    checkedBaseline.contributors.map((factor) => [factor.id, factor]),
  );

  const unpackedFactors = checkedScenario.contributors.map((factor) => {
    const probability = finiteNumber(
      factor.effectiveProbability,
      `factor ${factor.id} effective probability`,
    );
    const anchor = probabilityAnchor(
      pivot,
      halfLength,
      factor.sign ?? factor.type,
      probability,
      scenarioBeam.angle,
    );
    const baselineFactor = baselineById.get(factor.id) ?? factor;
    const baselineProbability = finiteNumber(
      baselineFactor.effectiveProbability,
      `baseline factor ${factor.id} effective probability`,
    );

    return {
      ...factor,
      radius: importanceRadius(factor.weight, radiusScale),
      anchor,
      baselineEffectiveProbability: baselineProbability,
      baselineAnchor: probabilityAnchor(
        pivot,
        halfLength,
        factor.sign ?? factor.type,
        baselineProbability,
        baselineBeam.angle,
      ),
    };
  });
  const factors = packFactorLanes(unpackedFactors, {
    gap: settings.factorGap ?? 2,
    connectorGap: settings.connectorGap ?? 2,
    direction: settings.factorDirection ?? -1,
    lanePitch: settings.lanePitch,
  });

  const outcomeScale = {
    zeroX: settings.outcomeZeroX ?? pivot.x,
    halfWidth: positiveNumber(
      settings.outcomeHalfWidth ?? Math.max(1, width / 2 - padding),
      'outcome half width',
    ),
    domainMagnitude,
  };
  const scenarioDistribution = distributionCoordinates(
    checkedScenario.distribution,
    checkedScenario.likelyRange,
    outcomeScale,
  );
  const baselineDistribution = hasOverrides
    ? distributionCoordinates(
      checkedBaseline.distribution,
      checkedBaseline.likelyRange,
      outcomeScale,
    )
    : null;

  return {
    dimensions: { width, height },
    pivot,
    domainMagnitude,
    beam: {
      halfLength,
      maxAngleRadians,
      showBaseline: Boolean(hasOverrides),
      baseline: baselineBeam,
      scenario: scenarioBeam,
    },
    factors,
    outcomeScale,
    distribution: scenarioDistribution,
    baselineDistribution,
  };
}
