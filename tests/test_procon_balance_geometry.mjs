import assert from 'node:assert/strict';
import test from 'node:test';

import {
  armEndpoints,
  balanceAngle,
  buildBalanceScene,
  distributionCoordinates,
  importanceRadius,
  packFactorLanes,
  probabilityAnchor,
  scoreDomainMagnitude,
  scoreToX,
} from '../procon/balance-geometry.js';

const closeTo = (actual, expected, tolerance = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('importance disk area is proportional to weight', () => {
  const radiusOne = importanceRadius(1, 4);
  const radiusNine = importanceRadius(9, 4);

  assert.equal(radiusOne, 4);
  assert.equal(radiusNine, 12);
  assert.equal(radiusNine ** 2 / radiusOne ** 2, 9);
});

test('effective probability maps exactly from pivot to the matching arm end', () => {
  const pivot = { x: 100, y: 80 };
  const halfLength = 60;
  const angle = 0.2;
  const endpoints = armEndpoints(pivot, halfLength, angle);

  assert.equal(endpoints.left.x, pivot.x - halfLength);
  assert.equal(endpoints.right.x, pivot.x + halfLength);

  assert.deepEqual(probabilityAnchor(pivot, halfLength, 'pro', 0, angle), pivot);
  assert.deepEqual(probabilityAnchor(pivot, halfLength, 'con', 0, angle), pivot);
  assert.deepEqual(
    probabilityAnchor(pivot, halfLength, 'pro', 1, angle),
    endpoints.right,
  );
  assert.deepEqual(
    probabilityAnchor(pivot, halfLength, 'con', 1, angle),
    endpoints.left,
  );

  const quarter = probabilityAnchor(pivot, halfLength, 'pro', 0.25, angle);
  closeTo(quarter.x, pivot.x + (endpoints.right.x - pivot.x) * 0.25);
  closeTo(quarter.y, pivot.y + (endpoints.right.y - pivot.y) * 0.25);

  const differentlyTilted = probabilityAnchor(pivot, halfLength, 'pro', 0.25, -0.2);
  assert.equal(differentlyTilted.x, quarter.x);
});

test('score angle uses one fixed symmetric domain and has physical polarity', () => {
  assert.equal(scoreDomainMagnitude({ min: -2, max: 8 }), 8);
  assert.equal(scoreDomainMagnitude({ min: 0, max: 0 }), 1);
  assert.equal(scoreDomainMagnitude([
    { possibleRange: { min: -11, max: 3 } },
    { possibleRange: { min: -4, max: 9 } },
  ]), 11);

  const positive = balanceAngle(4, 8, 0.4);
  const negative = balanceAngle(-4, 8, 0.4);
  assert.equal(positive, 0.2);
  assert.equal(negative, -0.2);

  const pivot = { x: 0, y: 0 };
  const positiveEnds = armEndpoints(pivot, 10, positive);
  const negativeEnds = armEndpoints(pivot, 10, negative);
  assert.ok(positiveEnds.right.y > pivot.y, 'a positive score lowers the right arm');
  assert.ok(positiveEnds.left.y < pivot.y, 'a positive score raises the left arm');
  assert.ok(negativeEnds.left.y > pivot.y, 'a negative score lowers the left arm');
  assert.ok(negativeEnds.right.y < pivot.y, 'a negative score raises the right arm');
});

test('lane packing is deterministic and never shifts encoded anchor x', () => {
  const factors = [
    { id: 'middle', anchor: { x: 40, y: 50 }, radius: 10 },
    { id: 'right', anchor: { x: 48, y: 52 }, radius: 8 },
    { id: 'left', anchor: { x: 12, y: 48 }, radius: 5 },
    { id: 'far', anchor: { x: 90, y: 51 }, radius: 6 },
  ];
  const forward = packFactorLanes(factors, { gap: 2 });
  const reverse = packFactorLanes([...factors].reverse(), { gap: 2 });
  const lanes = new Map(forward.map((factor) => [factor.id, factor.lane]));

  assert.deepEqual(
    new Map(reverse.map((factor) => [factor.id, factor.lane])),
    lanes,
  );
  assert.notEqual(lanes.get('middle'), lanes.get('right'));
  for (const factor of forward) {
    assert.equal(factor.anchorX, factor.anchor.x);
    assert.equal(factor.x, factor.anchor.x);
    assert.equal(factor.center.x, factor.anchor.x);
  }
});

test('distribution and likely-range coordinates preserve exact discrete scores', () => {
  const distribution = [
    { score: -3, probability: 0.125 },
    { score: 0, probability: 0.25 },
    { score: 2, probability: 0.625 },
  ];
  const likelyRange = { low: -3, high: 2, coverage: 0.8 };
  const scale = { zeroX: 100, halfWidth: 90, domainMagnitude: 3 };
  const geometry = distributionCoordinates(distribution, likelyRange, scale);

  assert.deepEqual(geometry.points, [
    { score: -3, probability: 0.125, x: 10 },
    { score: 0, probability: 0.25, x: 100 },
    { score: 2, probability: 0.625, x: 160 },
  ]);
  assert.deepEqual(geometry.likelyRange, {
    low: -3,
    high: 2,
    coverage: 0.8,
    lowX: 10,
    highX: 160,
  });
  assert.equal(scoreToX(0.125, scale), 103.75);
  assert.deepEqual(distribution, [
    { score: -3, probability: 0.125 },
    { score: 0, probability: 0.25 },
    { score: 2, probability: 0.625 },
  ]);
});

test('buildBalanceScene composes comparison geometry without DOM state', () => {
  const baseline = {
    expectedScore: -2,
    possibleRange: { min: -7, max: 10 },
    contributors: [
      {
        id: 'upside',
        label: 'Upside',
        type: 'pro',
        sign: 1,
        weight: 9,
        effectiveProbability: 0.25,
      },
      {
        id: 'cost',
        label: 'Cost',
        type: 'con',
        sign: -1,
        weight: 4,
        effectiveProbability: 0.5,
      },
    ],
    distribution: [
      { score: -7, probability: 0.4 },
      { score: 10, probability: 0.6 },
    ],
    likelyRange: { low: -7, high: 10, coverage: 0.8 },
  };
  const scenario = {
    expectedScore: 10,
    possibleRange: { min: 10, max: 10 },
    contributors: [
      {
        id: 'upside',
        label: 'Upside',
        type: 'pro',
        sign: 1,
        weight: 9,
        effectiveProbability: 1,
        mode: 'true',
      },
      {
        id: 'cost',
        label: 'Cost',
        type: 'con',
        sign: -1,
        weight: 4,
        effectiveProbability: 0,
        mode: 'false',
      },
    ],
    distribution: [{ score: 10, probability: 1 }],
    likelyRange: { low: 10, high: 10, coverage: 0.8 },
  };
  const scene = buildBalanceScene(
    { baseline, scenario, hasOverrides: true },
    {
      width: 300,
      height: 200,
      pivotX: 150,
      pivotY: 80,
      armHalfLength: 100,
      outcomeHalfWidth: 120,
      radiusScale: 2,
      maxAngleRadians: 0.3,
    },
  );

  assert.equal(scene.domainMagnitude, 10);
  assert.equal(scene.beam.baseline.angle, -0.06);
  assert.equal(scene.beam.scenario.angle, 0.3);
  assert.equal(scene.beam.showBaseline, true);
  assert.ok(scene.beam.scenario.endpoints.right.y > scene.pivot.y);

  const upside = scene.factors.find((factor) => factor.id === 'upside');
  const cost = scene.factors.find((factor) => factor.id === 'cost');
  assert.equal(upside.radius, 6);
  assert.deepEqual(upside.anchor, scene.beam.scenario.endpoints.right);
  assert.deepEqual(cost.anchor, scene.pivot);
  assert.equal(upside.center.x, upside.anchor.x);
  assert.equal(cost.center.x, cost.anchor.x);

  assert.deepEqual(scene.distribution.points, [
    { score: 10, probability: 1, x: 270 },
  ]);
  assert.equal(scene.distribution.likelyRange.lowX, 270);
  assert.equal(scene.distribution.likelyRange.highX, 270);
  assert.ok(scene.baselineDistribution);
});

test('invalid geometry inputs fail instead of being silently clamped', () => {
  assert.throws(() => importanceRadius(0), /weight/);
  assert.throws(
    () => probabilityAnchor({ x: 0, y: 0 }, 10, 'pro', 1.01),
    /probability/,
  );
  assert.throws(
    () => distributionCoordinates([], { low: 2, high: 1 }, {
      zeroX: 0,
      halfWidth: 1,
      domainMagnitude: 1,
    }),
    /low.*high/,
  );
});
