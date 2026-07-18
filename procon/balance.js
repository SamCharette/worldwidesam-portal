import { buildBalanceScene } from "./balance-geometry.js?v=6";
import { formatPercent, formatRange, formatScore } from "./format.js?v=6";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SCORE_DISPLAY_THRESHOLD = 0.05;

const VARIANTS = Object.freeze({
  hero: {
    width: 720,
    height: 580,
    padding: 48,
    pivotY: 142,
    armHalfLength: 300,
    radiusScale: 5.5,
    connectorGap: 18,
    lanePitch: 38,
    rulerY: 58,
  },
  analysis: {
    width: 640,
    height: 440,
    padding: 40,
    pivotY: 106,
    armHalfLength: 260,
    radiusScale: 4.3,
    connectorGap: 13,
    lanePitch: 30,
    rulerY: 40,
  },
});

export function balanceKey(index) {
  const alphabetIndex = index % 26;
  const cycle = Math.floor(index / 26);
  return `${String.fromCharCode(65 + alphabetIndex)}${cycle || ""}`;
}

export function renderProbabilityBalance(container, comparison, { variant = "hero" } = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("A probability balance needs an HTML container.");
  }
  const settings = VARIANTS[variant];
  if (!settings) throw new RangeError(`Unknown probability-balance variant: ${variant}`);

  const displayComparison = comparisonForDisplay(comparison);
  const scene = buildBalanceScene(displayComparison, {
    width: settings.width,
    height: settings.height,
    padding: settings.padding,
    pivotY: settings.pivotY,
    armHalfLength: settings.armHalfLength,
    outcomeHalfWidth: settings.armHalfLength,
    radiusScale: settings.radiusScale,
    connectorGap: settings.connectorGap,
    lanePitch: settings.lanePitch,
    factorDirection: 1,
    maxAngleRadians: Math.PI / 16,
  });
  const renderSettings = settingsForScene(settings, scene);
  const state = balanceState(comparison.scenario);
  const firstRender = container.dataset.rendered !== "true";
  const svg = buildSvg(container.id, comparison, scene, renderSettings, state);
  if (firstRender) svg.classList.add("is-arriving");

  container.replaceChildren(svg);
  container.dataset.rendered = "true";
  container.dataset.state = state;
  container.dataset.balanceAngle = String(scene.beam.scenario.angle);
  container.dataset.domainMagnitude = String(scene.domainMagnitude);
  container.dataset.factorCount = String(scene.factors.length);
}

export function renderBalanceLegend(list, contributors) {
  if (!(list instanceof HTMLOListElement)) {
    throw new TypeError("A balance legend needs an ordered-list element.");
  }
  list.replaceChildren();
  if (!contributors.length) {
    const empty = document.createElement("li");
    empty.className = "balance-legend-empty";
    empty.textContent = "No weights are hanging yet.";
    list.append(empty);
    return;
  }

  contributors.forEach((contributor, index) => {
    const item = document.createElement("li");
    item.className = `balance-legend-item is-${contributor.type}`;
    item.classList.toggle("has-scenario", contributor.mode !== "estimated");
    item.dataset.factorId = contributor.id;
    item.dataset.weight = String(contributor.weight);
    item.dataset.effectiveProbability = String(contributor.effectiveProbability);
    item.dataset.contribution = String(contributor.expectedContribution);
    item.dataset.mode = contributor.mode;

    const key = document.createElement("span");
    key.className = "balance-legend-key";
    key.textContent = balanceKey(index);
    key.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "balance-legend-copy";
    const label = document.createElement("strong");
    label.textContent = contributor.label;
    const formula = document.createElement("small");
    const scenarioText = contributor.mode === "estimated"
      ? ""
      : ` · ${contributor.mode === "true" ? "assumed true" : "assumed false"}; saved ${contributor.estimatedProbabilityPercent}%`;
    formula.textContent = `Importance ${contributor.weight} · ${contributor.effectiveProbabilityPercent}% chance${scenarioText}`;
    copy.append(label, formula);

    const value = document.createElement("strong");
    value.className = "balance-legend-value";
    value.textContent = formatScore(contributor.expectedContribution);
    value.setAttribute("aria-label", `Expected contribution ${formatScore(contributor.expectedContribution)}`);

    item.append(key, copy, value);
    list.append(item);
  });
}

function buildSvg(containerId, comparison, scene, settings, state) {
  const { scenario, hasOverrides } = comparison;
  const titleId = `${containerId}-title`;
  const descriptionId = `${containerId}-description`;
  const svg = svgElement("svg", {
    viewBox: `0 0 ${settings.width} ${settings.height}`,
    role: "img",
    "aria-labelledby": `${titleId} ${descriptionId}`,
    preserveAspectRatio: "xMidYMid meet",
    focusable: "false",
    "data-state": state,
  });
  const title = svgElement("title", { id: titleId });
  title.textContent = `Probability balance for ${scenario.name}`;
  const description = svgElement("desc", { id: descriptionId });
  description.textContent = balanceDescription(comparison, state);
  svg.append(title, description);

  const artwork = svgElement("g", { "aria-hidden": "true", focusable: "false" });
  renderRuler(artwork, scene, settings);
  renderOutcomeShadow(artwork, scene, settings);
  renderBeam(artwork, scene, hasOverrides);
  renderWeights(artwork, scene);
  renderPivot(artwork, scene);
  renderStateCopy(artwork, scene, state);
  svg.append(artwork);
  return svg;
}

function renderRuler(layer, scene, settings) {
  const { pivot } = scene;
  const left = pivot.x - scene.beam.halfLength;
  const right = pivot.x + scene.beam.halfLength;
  const y = settings.rulerY;
  layer.append(
    svgElement("text", { x: left, y: 18, class: "balance-side-label", "text-anchor": "start" }, "AGAINST"),
    svgElement("text", { x: right, y: 18, class: "balance-side-label", "text-anchor": "end" }, "SUPPORTS"),
    svgElement("line", { x1: left, y1: y, x2: right, y2: y, class: "balance-ruler" }),
  );

  for (const signedPercent of [-100, -75, -50, -25, 0, 25, 50, 75, 100]) {
    const x = pivot.x + scene.beam.halfLength * (signedPercent / 100);
    layer.append(
      svgElement("line", { x1: x, y1: y - 6, x2: x, y2: y + 6, class: "balance-ruler-tick" }),
      svgElement("text", {
        x,
        y: y - 12,
        class: "balance-ruler-label",
        "text-anchor": "middle",
      }, `${Math.abs(signedPercent)}%`),
    );
  }
}

function renderBeam(layer, scene, hasOverrides) {
  if (hasOverrides) {
    const saved = scene.beam.baseline.endpoints;
    layer.append(svgElement("line", {
      x1: saved.left.x,
      y1: saved.left.y,
      x2: saved.right.x,
      y2: saved.right.y,
      class: "balance-ghost-beam",
      "data-role": "saved-beam",
    }));
  }

  const active = scene.beam.scenario.endpoints;
  layer.append(
    svgElement("line", {
      x1: active.left.x,
      y1: active.left.y,
      x2: active.right.x,
      y2: active.right.y,
      class: "balance-beam",
      "data-role": "active-beam",
      "data-angle": scene.beam.scenario.angle,
    }),
    svgElement("line", {
      x1: active.left.x,
      y1: active.left.y - 9,
      x2: active.left.x,
      y2: active.left.y + 9,
      class: "balance-beam-cap",
    }),
    svgElement("line", {
      x1: active.right.x,
      y1: active.right.y - 9,
      x2: active.right.x,
      y2: active.right.y + 9,
      class: "balance-beam-cap",
    }),
  );
}

function renderWeights(layer, scene) {
  scene.factors.forEach((factor, index) => {
    const scenarioActive = factor.mode !== "estimated";
    const group = svgElement("g", {
      class: "balance-weight",
      "data-factor-id": factor.id,
      "data-weight": factor.weight,
      "data-effective-probability": factor.effectiveProbability,
      "data-contribution": factor.expectedContribution,
      "data-anchor-x": factor.anchor.x,
      "data-radius": factor.radius,
      "data-mode": factor.mode,
    });

    if (scenarioActive) {
      group.append(
        svgElement("line", {
          x1: factor.baselineAnchor.x,
          y1: factor.baselineAnchor.y,
          x2: factor.baselineAnchor.x,
          y2: factor.y - factor.radius,
          class: "balance-saved-marker",
          "data-role": "saved-position-line",
          "data-saved-probability": factor.baselineEffectiveProbability,
        }),
        svgElement("circle", {
          cx: factor.baselineAnchor.x,
          cy: factor.y,
          r: factor.radius,
          class: "balance-saved-marker",
          "data-role": "saved-position-mass",
        }),
      );
    }

    group.append(
      svgElement("line", {
        x1: factor.anchor.x,
        y1: factor.anchor.y,
        x2: factor.x,
        y2: factor.y - factor.radius,
        class: `balance-connector${scenarioActive ? " is-scenario" : ""}`,
      }),
      svgElement("circle", {
        cx: factor.x,
        cy: factor.y,
        r: factor.radius,
        class: `balance-mass is-${factor.type}${scenarioActive ? " is-scenario" : ""}`,
      }),
      svgElement("text", {
        x: factor.x,
        y: factor.y + Math.min(5, factor.radius * 0.25),
        class: "balance-mass-key",
        style: `font-size:${Math.max(8, Math.min(16, factor.radius * 0.95))}px`,
      }, balanceKey(index)),
      svgElement("text", {
        x: factor.x,
        y: factor.y + factor.radius + 13,
        class: "balance-mass-sign",
      }, factor.type === "pro" ? "+" : "−"),
    );
    layer.append(group);
  });
}

function renderPivot(layer, scene) {
  const { x, y } = scene.pivot;
  layer.append(
    svgElement("path", {
      d: `M ${x} ${y + 5} L ${x - 27} ${y + 65} L ${x + 27} ${y + 65} Z`,
      class: "balance-pivot",
    }),
    svgElement("circle", { cx: x, cy: y, r: 10, class: "balance-pivot-pin" }),
  );
}

function renderOutcomeShadow(layer, scene, settings) {
  const baseY = settings.shadowBaseY;
  const left = scene.pivot.x - scene.outcomeScale.halfWidth;
  const right = scene.pivot.x + scene.outcomeScale.halfWidth;
  const range = scene.distribution.likelyRange;
  const points = scene.distribution.points;
  const maxProbability = Math.max(...points.map((point) => point.probability), 0.01);
  const markWidth = Math.max(3, Math.min(14, (right - left) / Math.max(points.length * 1.35, 1)));

  layer.append(
    svgElement("text", { x: left, y: baseY + 27, class: "balance-shadow-label" }, "OUTCOME SHADOW"),
    svgElement("line", { x1: left, y1: baseY, x2: right, y2: baseY, class: "balance-shadow-axis" }),
    svgElement("line", {
      x1: scene.pivot.x,
      y1: baseY - 56,
      x2: scene.pivot.x,
      y2: baseY + 7,
      class: "balance-shadow-zero",
    }),
    svgElement("rect", {
      x: Math.min(range.lowX, range.highX),
      y: baseY - 16,
      width: Math.max(3, Math.abs(range.highX - range.lowX)),
      height: 22,
      rx: 6,
      class: "balance-shadow-range",
      "data-role": "likely-range",
      "data-low": range.low,
      "data-high": range.high,
    }),
  );

  if (scene.baselineDistribution) {
    for (const point of scene.baselineDistribution.points) {
      const height = 4 + Math.sqrt(point.probability / maxProbability) * 30;
      layer.append(svgElement("rect", {
        x: point.x - markWidth / 2,
        y: baseY - 22 - height,
        width: markWidth,
        height,
        rx: markWidth / 2,
        class: "balance-saved-marker",
        "data-role": "saved-outcome",
      }));
    }
  }

  for (const point of points) {
    const height = 4 + Math.sqrt(point.probability / maxProbability) * 34;
    const kind = point.score < 0 ? "is-con" : point.score > 0 ? "is-pro" : "is-neutral";
    layer.append(svgElement("rect", {
      x: point.x - markWidth / 2,
      y: baseY - 21 - height,
      width: markWidth,
      height,
      rx: markWidth / 2,
      class: `balance-shadow-mark ${kind}`,
      "data-role": "outcome-mark",
      "data-score": point.score,
      "data-probability": point.probability,
    }));
  }

  const expectedX = scene.outcomeScale.zeroX
    + (scene.beam.scenario.score / scene.domainMagnitude) * scene.outcomeScale.halfWidth;
  layer.append(svgElement("path", {
    d: `M ${expectedX} ${baseY - 72} l 8 8 l -8 8 l -8 -8 Z`,
    class: "balance-shadow-expected",
    "data-role": "expected-marker",
    "data-score": scene.beam.scenario.score,
  }));
}

function settingsForScene(settings, scene) {
  const lowestWeight = scene.factors.reduce(
    (lowest, factor) => Math.max(lowest, factor.y + factor.radius + 13),
    scene.pivot.y + 65,
  );
  const shadowBaseY = Math.max(scene.pivot.y + 150, lowestWeight + 68);
  return {
    ...settings,
    height: shadowBaseY + 42,
    shadowBaseY,
  };
}

function renderStateCopy(layer, scene, state) {
  if (state !== "empty") return;
  layer.append(svgElement("text", {
    x: scene.pivot.x,
    y: scene.pivot.y + 94,
    class: "balance-empty-copy",
    "text-anchor": "middle",
  }, "Add your first consequence"));
}

function comparisonForDisplay(comparison) {
  const normalized = (analysis) => ({
    ...analysis,
    expectedScore: Math.abs(analysis.expectedScore) < SCORE_DISPLAY_THRESHOLD
      ? 0
      : analysis.expectedScore,
  });
  return {
    ...comparison,
    baseline: normalized(comparison.baseline),
    scenario: normalized(comparison.scenario),
  };
}

function balanceState(scenario) {
  if (scenario.factorCount === 0) return "empty";
  if (!scenario.contributors.some((item) => item.absoluteContribution > 0)) return "inactive";
  if (Math.abs(scenario.expectedScore) < SCORE_DISPLAY_THRESHOLD) return "balanced";
  return scenario.expectedScore > 0 ? "positive" : "negative";
}

function balanceDescription({ scenario, hasOverrides }, state) {
  const expected = formatScore(scenario.expectedScore);
  const aboveZero = formatPercent(scenario.outcomeProbabilities.positive);
  const likely = formatRange(scenario.likelyRange.low, scenario.likelyRange.high);
  const scenarioCopy = hasOverrides ? " A what-if assumption is active; saved estimates remain unchanged." : "";
  const stateCopy = {
    empty: "No consequences have been added.",
    inactive: "All effective probabilities are zero, so every weight is at the pivot.",
    balanced: "Expected pull is balanced at the displayed precision.",
    positive: "The supporting arm hangs lower.",
    negative: "The opposing arm hangs lower.",
  }[state];
  return `${stateCopy} Importance controls disk area, effective probability controls distance from the pivot, and tilt shows the expected balance. Expected balance ${expected}; ${aboveZero} of modeled outcomes are above zero; 10th-to-90th percentile span ${likely}.${scenarioCopy}`;
}

function svgElement(name, attributes = {}, text = null) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }
  if (text !== null) element.textContent = text;
  return element;
}
