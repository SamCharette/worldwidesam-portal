import { formatPercent, formatRange, formatScore } from "./format.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const LEFT = 28;
const RIGHT = 612;
const TOP = 18;
const BASELINE_Y = 116;
const RANGE_Y = 126;

export function renderTallyTrace({ baseline, scenario, hasOverrides }) {
  const svg = document.getElementById("tally-trace");
  const baselineLayer = document.getElementById("trace-baseline-layer");
  const distributionLayer = document.getElementById("trace-distribution-layer");
  const rangeLayer = document.getElementById("trace-range-layer");
  const expectedLayer = document.getElementById("trace-expected-layer");
  const emptyLabel = document.getElementById("trace-empty-label");
  const description = document.getElementById("tally-trace-description");
  const zeroLine = svg.querySelector(".trace-zero");

  baselineLayer.replaceChildren();
  distributionLayer.replaceChildren();
  rangeLayer.replaceChildren();
  expectedLayer.replaceChildren();

  const factorCount = scenario.factorCount;
  emptyLabel.hidden = factorCount > 0;
  emptyLabel.style.display = factorCount > 0 ? "none" : "";
  if (!factorCount) {
    zeroLine.setAttribute("x1", "320");
    zeroLine.setAttribute("x2", "320");
    description.textContent = "No consequences have been added, so the modeled balance is zero.";
    return;
  }

  const scores = [
    0,
    ...baseline.distribution.map((point) => point.score),
    ...scenario.distribution.map((point) => point.score),
  ];
  let domainMin = Math.min(...scores);
  let domainMax = Math.max(...scores);
  if (domainMin === domainMax) {
    domainMin -= 1;
    domainMax += 1;
  }

  const x = (score) => LEFT + ((score - domainMin) / (domainMax - domainMin)) * (RIGHT - LEFT);
  const probabilities = [
    ...baseline.distribution.map((point) => point.probability),
    ...scenario.distribution.map((point) => point.probability),
  ];
  const maxProbability = Math.max(...probabilities, 0.01);
  const y = (probability) => BASELINE_Y - (probability / maxProbability) * (BASELINE_Y - TOP);
  const scoreStep = (RIGHT - LEFT) / Math.max(1, domainMax - domainMin + 1);
  const barWidth = Math.max(2.2, Math.min(18, scoreStep * 0.72));

  const zeroX = x(0);
  zeroLine.setAttribute("x1", String(zeroX));
  zeroLine.setAttribute("x2", String(zeroX));

  if (hasOverrides) {
    baselineLayer.append(svgElement("path", {
      d: steppedPath(baseline.distribution, x, y),
      fill: "none",
    }));
  }

  for (const point of scenario.distribution) {
    const height = Math.max(1.5, BASELINE_Y - y(point.probability));
    const className = point.score < 0
      ? "trace-bar-negative"
      : point.score > 0
        ? "trace-bar-positive"
        : "trace-bar-neutral";
    distributionLayer.append(svgElement("rect", {
      x: x(point.score) - barWidth / 2,
      y: BASELINE_Y - height,
      width: barWidth,
      height,
      class: className,
      rx: Math.min(1.5, barWidth / 4),
    }));
  }

  const rangeStart = x(scenario.likelyRange.low);
  const rangeEnd = x(scenario.likelyRange.high);
  rangeLayer.append(svgElement("rect", {
    x: Math.min(rangeStart, rangeEnd),
    y: RANGE_Y,
    width: Math.max(3, Math.abs(rangeEnd - rangeStart)),
    height: 8,
    rx: 3,
  }));

  const expectedX = x(scenario.expectedScore);
  expectedLayer.append(
    svgElement("line", { x1: expectedX, y1: 14, x2: expectedX, y2: 123 }),
    svgElement("path", {
      d: `M ${expectedX - 6} 14 L ${expectedX + 6} 14 L ${expectedX} 22 Z`,
    }),
  );

  const aboveZero = formatPercent(scenario.outcomeProbabilities.positive);
  const expected = formatScore(scenario.expectedScore);
  const likely = formatRange(scenario.likelyRange.low, scenario.likelyRange.high);
  description.textContent = `Expected balance ${expected}. ${aboveZero} of modeled outcome combinations are above zero. The middle 80 percent runs from ${likely}.`;
}

function steppedPath(distribution, x, y) {
  if (!distribution.length) return "";
  const points = distribution.map((point) => ({ x: x(point.score), y: y(point.probability) }));
  const commands = [`M ${points[0].x} ${BASELINE_Y}`, `L ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middle = (previous.x + current.x) / 2;
    commands.push(`L ${middle} ${previous.y}`, `L ${middle} ${current.y}`, `L ${current.x} ${current.y}`);
  }
  commands.push(`L ${points.at(-1).x} ${BASELINE_Y}`);
  return commands.join(" ");
}

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }
  return element;
}
