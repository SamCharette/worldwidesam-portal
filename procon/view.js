import { renderTallyTrace } from "./chart.js?v=5";
import { formatPercent, formatRange, formatScore, pluralize } from "./format.js?v=5";

export function renderDecisionHeader(decision, loadStatus = "restored") {
  const title = document.getElementById("decision-title");
  title.value = decision.question;
  resizeDecisionTitle();

  const status = document.getElementById("storage-status");
  const messages = {
    saved: "Saved on this device",
    restored: "Saved on this device",
    seeded: "Starter model · saves as you edit",
    recovered: "Starter restored · saves as you edit",
    unavailable: "Browser storage unavailable",
    failed: "Could not save on this device",
  };
  status.textContent = messages[loadStatus] ?? messages.restored;
  status.dataset.state = loadStatus;

  document.getElementById("decision-help").textContent = decision.isStarter
    ? "Starter weights and probabilities are illustrative. Change everything to match your judgment."
    : "Weights express personal importance. Probabilities estimate what happens if you choose an option.";
}

export function setStorageStatus(status) {
  const element = document.getElementById("storage-status");
  const message = status === "failed"
    ? "Could not save on this device"
    : "Saved on this device";
  if (element.dataset.state === status && element.textContent === message) return;
  element.textContent = message;
  element.dataset.state = status;
}

export function resizeDecisionTitle() {
  const title = document.getElementById("decision-title");
  title.style.height = "auto";
  title.style.height = `${Math.max(title.scrollHeight, 52)}px`;
}

export function renderOptionRail(decision) {
  const rail = document.getElementById("option-rail");
  rail.replaceChildren();

  for (const option of decision.options) {
    const selected = option.id === decision.selectedOptionId;
    const group = element("span", "option-control");
    const button = element("button", `option-chip${selected ? " is-selected" : ""}`);
    button.type = "button";
    button.dataset.action = "select-option";
    button.dataset.optionId = option.id;
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = option.name;
    if (selected) button.id = "selected-option";
    group.append(button);

    if (selected) {
      const rename = element("button", "option-manage-button");
      rename.type = "button";
      rename.dataset.action = "rename-option";
      rename.dataset.optionId = option.id;
      rename.setAttribute("aria-label", `Rename ${option.name}`);
      rename.textContent = "Edit";
      group.append(rename);

      if (decision.options.length > 1) {
        const remove = element("button", "option-manage-button option-remove-button");
        remove.type = "button";
        remove.dataset.action = "remove-option";
        remove.dataset.optionId = option.id;
        remove.setAttribute("aria-label", `Remove ${option.name}`);
        remove.textContent = "Remove";
        group.append(remove);
      }
    }
    rail.append(group);
  }

  const baseline = element("button", "baseline-chip");
  baseline.id = "baseline-option";
  baseline.type = "button";
  baseline.dataset.action = "rename-baseline";
  baseline.setAttribute("aria-label", `Rename baseline option ${decision.baselineLabel}`);
  baseline.textContent = `${decision.baselineLabel} is the baseline`;
  rail.append(baseline);

  const option = decision.options.find((candidate) => candidate.id === decision.selectedOptionId)
    ?? decision.options[0];
  document.getElementById("option-context").textContent =
    `The factors below describe what may happen if you choose ${option.name}. ${decision.baselineLabel} stays at zero.`;
  document.getElementById("pro-heading").lastChild.textContent = ` Supports ${option.name}`;
  document.getElementById("con-heading").lastChild.textContent = ` Counts against ${option.name}`;
}

export function renderFactorLedger({ option, comparison, scenarios, filter, expandedFactors }) {
  const proList = document.getElementById("pro-list");
  const conList = document.getElementById("con-list");
  proList.replaceChildren();
  conList.replaceChildren();

  const contributors = new Map(
    comparison.scenario.contributors.map((contributor) => [contributor.id, contributor]),
  );

  option.factors.forEach((factor, index) => {
    const card = factorCard(
      factor,
      index,
      contributors.get(factor.id),
      scenarios[factor.id] ?? "estimated",
      expandedFactors.has(factor.id),
    );
    (factor.type === "pro" ? proList : conList).append(card);
  });

  const proCount = option.factors.filter((factor) => factor.type === "pro").length;
  const conCount = option.factors.length - proCount;
  document.getElementById("pro-factors-region").hidden = filter === "con" || proCount === 0;
  document.getElementById("con-factors-region").hidden = filter === "pro" || conCount === 0;
  const visibleCount = filter === "pro" ? proCount : filter === "con" ? conCount : option.factors.length;
  const emptyState = document.getElementById("factor-empty-state");
  emptyState.hidden = visibleCount > 0;
  emptyState.textContent = option.factors.length === 0
    ? "Start with one possible upside or downside. ProCon will map how your estimates add up without turning them into a verdict."
    : `No consequences are in the ${filter === "pro" ? "Supports" : "Against"} view yet.`;
  document.getElementById("factor-count").textContent = pluralize(option.factors.length, "factor");

  for (const button of document.querySelectorAll("[data-filter]")) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  }
}

export function updateFactorCard(factor, contributor, mode) {
  const card = [...document.querySelectorAll(".factor-card")]
    .find((candidate) => candidate.dataset.factorId === factor.id);
  if (!card) return;

  card.dataset.kind = factor.type;
  card.classList.toggle("is-pro", factor.type === "pro");
  card.classList.toggle("is-con", factor.type === "con");
  card.classList.toggle("has-scenario", mode !== "estimated");
  card.querySelector('[data-role="polarity"]').textContent = factor.type === "pro" ? "+" : "−";
  card.querySelector('[data-role="factor-name"]').textContent = factor.label || "Untitled consequence";
  card.querySelector('[data-role="factor-formula"]').textContent = factorFormula(factor);
  card.querySelector('[data-role="factor-contribution"]').textContent = formatScore(contributor.expectedContribution);
  card.querySelector('[data-role="scenario-state"]').textContent = scenarioLabel(mode);
  const note = card.querySelector('[data-role="scenario-note"]');
  if (note) note.textContent = scenarioNote(factor, mode);
}

export function renderAnalysis({ decision, option, comparison, optionComparisons, totalOverrideCount }) {
  const { baseline, scenario, hasOverrides, expectedScoreDelta } = comparison;
  const expected = document.getElementById("expected-score");
  expected.textContent = formatScore(scenario.expectedScore);
  expected.classList.toggle("is-positive", scenario.expectedScore > 0);
  expected.classList.toggle("is-negative", scenario.expectedScore < 0);
  expected.setAttribute(
    "aria-label",
    `Expected modeled balance for ${option.name}: ${formatScore(scenario.expectedScore)}`,
  );

  document.getElementById("chance-positive").textContent =
    formatPercent(scenario.outcomeProbabilities.positive);
  document.getElementById("chance-positive").title =
    "Share of modeled outcome combinations above zero—not the chance this decision is correct.";
  document.getElementById("likely-range").textContent =
    formatRange(scenario.likelyRange.low, scenario.likelyRange.high);
  document.getElementById("possible-range").textContent =
    formatRange(scenario.possibleRange.min, scenario.possibleRange.max);

  renderTallyTrace({ baseline, scenario, hasOverrides });
  renderContributors(scenario.contributors);
  renderSensitivity(scenario.sensitivity);
  renderOptionComparison(decision, optionComparisons);
  renderScenarioStrip({
    option,
    currentOverrideCount: comparison.changedFactors.length,
    totalOverrideCount,
    expectedScoreDelta,
  });
  renderMobileDecisionBrief(decision, option, scenario);

  document.getElementById("model-note").textContent =
    "These figures reflect your inputs, not objective probabilities. The prototype treats consequences as independent and can overstate a reason if overlapping factors double-count it.";
}

function renderMobileDecisionBrief(decision, option, scenario) {
  document.getElementById("mobile-brief-question").textContent = decision.question;
  document.getElementById("mobile-brief-comparison").textContent =
    `Comparing ${option.name} with ${decision.baselineLabel}`;

  const support = scenario.contributors
    .filter((item) => item.expectedContribution > 0)
    .reduce((total, item) => total + item.expectedContribution, 0);
  const against = Math.abs(scenario.contributors
    .filter((item) => item.expectedContribution < 0)
    .reduce((total, item) => total + item.expectedContribution, 0));
  document.getElementById("mobile-support-total").textContent = formatScore(support);
  document.getElementById("mobile-against-total").textContent = formatScore(-against);
  document.getElementById("mobile-support-label").textContent = `For ${option.name}`;
  document.getElementById("mobile-against-label").textContent = `Against ${option.name}`;

  const reading = document.getElementById("mobile-brief-reading");
  const displayedScore = formatScore(scenario.expectedScore, { alwaysSign: false });
  if (!option.factors.length) {
    reading.textContent = `Nothing is pulling ${option.name} in either direction yet.`;
  } else if (displayedScore === "0") {
    reading.textContent = `Right now, the modeled pull is evenly balanced.`;
  } else if (scenario.expectedScore > 0) {
    reading.textContent = `Right now, your estimates lean toward ${option.name}.`;
  } else {
    reading.textContent = `Right now, your estimates lean away from ${option.name}.`;
  }

  document.getElementById("mobile-brief-factor-count").textContent =
    pluralize(option.factors.length, "reason");
  const reasons = document.getElementById("mobile-force-reasons");
  reasons.replaceChildren();
  const contributing = scenario.contributors.filter((item) => item.absoluteContribution > 0);
  reasons.classList.toggle("is-empty", contributing.length === 0);
  if (!contributing.length) {
    const empty = emptyItem("Add one possible upside or downside to begin.");
    empty.classList.add("mobile-force-empty");
    reasons.append(empty);
    return;
  }
  const leading = contributing.slice(0, 5);
  const remainder = contributing.slice(5);
  const groupedRemainders = ["con", "pro"].flatMap((type) => {
    const grouped = remainder.filter((item) => item.type === type);
    if (!grouped.length) return [];
    const expectedContribution = grouped.reduce(
      (total, item) => total + item.expectedContribution,
      0,
    );
    return [{
      type,
      label: `${pluralize(grouped.length, "other reason")} combined`,
      expectedContribution,
      absoluteContribution: Math.abs(expectedContribution),
      isGroup: true,
    }];
  });
  const forces = [...leading, ...groupedRemainders];
  const reasonScale = Math.max(...forces.map((item) => item.absoluteContribution), 1);
  for (const contributor of forces) {
    const supports = contributor.expectedContribution >= 0;
    const item = element(
      "li",
      `${supports ? "is-pro" : "is-con"}${contributor.isGroup ? " is-group" : ""}`,
    );
    item.dataset.forceContribution = String(contributor.expectedContribution);
    item.style.setProperty(
      "--force-reach",
      `${(contributor.absoluteContribution / reasonScale) * 100}%`,
    );
    const card = element("div", "mobile-force-card");
    const fill = element("span", "mobile-force-fill");
    fill.setAttribute("aria-hidden", "true");
    const copy = element("span", "mobile-force-copy");
    const label = element("span", "mobile-force-label");
    label.textContent = contributor.label;
    const value = element("strong", "mobile-force-value");
    value.textContent = formatScore(contributor.expectedContribution);
    copy.append(label, value);
    card.append(fill, copy);
    const node = element("span", "mobile-force-node");
    node.textContent = supports ? "+" : "−";
    node.setAttribute("aria-hidden", "true");
    item.append(card, node);
    reasons.append(item);
  }
}

export function announce(message) {
  const region = document.getElementById("live-region");
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 20);
}

function factorCard(factor, index, contributor, mode, expanded) {
  const template = document.getElementById("factor-card-template");
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".factor-card");
  const summary = fragment.querySelector(".factor-summary");
  const editor = fragment.querySelector('[data-role="factor-editor"]');

  card.dataset.factorId = factor.id;
  card.dataset.kind = factor.type;
  card.classList.add(factor.type === "pro" ? "is-pro" : "is-con");
  card.classList.toggle("has-scenario", mode !== "estimated");
  summary.dataset.factorId = factor.id;
  summary.setAttribute("aria-expanded", String(expanded));
  summary.setAttribute("aria-controls", `factor-editor-${index}`);
  editor.id = `factor-editor-${index}`;
  editor.hidden = !expanded;

  fragment.querySelector('[data-role="polarity"]').textContent = factor.type === "pro" ? "+" : "−";
  fragment.querySelector('[data-role="factor-name"]').textContent = factor.label;
  fragment.querySelector('[data-role="factor-formula"]').textContent = factorFormula(factor);
  fragment.querySelector('[data-role="factor-contribution"]').textContent =
    formatScore(contributor.expectedContribution);
  fragment.querySelector('[data-role="scenario-state"]').textContent = scenarioLabel(mode);
  buildFactorEditor(editor, factor, index, mode);
  return fragment;
}

function buildFactorEditor(editor, factor, index, mode) {
  const labelId = `factor-label-${index}`;
  const weightRangeId = `factor-weight-range-${index}`;
  const probabilityRangeId = `factor-probability-range-${index}`;
  editor.innerHTML = `
    <div class="inline-editor-grid">
      <label class="field-stack" for="${labelId}">
        <span>What might happen?</span>
        <input id="${labelId}" data-field="label" type="text" maxlength="120" autocomplete="off" />
      </label>
      <fieldset class="choice-fieldset factor-type-fieldset">
        <legend>How does it count?</legend>
        <label><input type="radio" name="factor-type-${index}" data-field="type" value="pro" /><span><strong>Supports</strong> this option</span></label>
        <label><input type="radio" name="factor-type-${index}" data-field="type" value="con" /><span><strong>Counts against</strong> this option</span></label>
      </fieldset>
      <div class="measure-field">
        <div class="measure-heading">
          <label for="${weightRangeId}">Personal importance</label>
          <input class="number-input" data-field="weight" data-control="number" type="number" min="1" max="10" step="1" inputmode="numeric" aria-label="Personal importance from 1 to 10" />
        </div>
        <input id="${weightRangeId}" data-field="weight" data-control="range" type="range" min="1" max="10" step="1" />
        <p class="field-note">1 is a nudge; 10 is pivotal.</p>
      </div>
      <div class="measure-field">
        <div class="measure-heading">
          <label for="${probabilityRangeId}">Chance if I choose this option</label>
          <div class="number-suffix">
            <input class="number-input" data-field="probability" data-control="number" type="number" min="0" max="100" step="1" inputmode="decimal" aria-label="Probability from 0 to 100 percent" />
            <span aria-hidden="true">%</span>
          </div>
        </div>
        <input id="${probabilityRangeId}" data-field="probability" data-control="range" type="range" min="0" max="100" step="1" />
        <p class="field-note">Your estimate of whether the full consequence occurs.</p>
      </div>
      <fieldset class="choice-fieldset scenario-fieldset">
        <legend>For this what-if</legend>
        <label><input type="radio" name="scenario-${index}" data-field="scenario" value="estimated" /><span>Use estimate</span></label>
        <label><input type="radio" name="scenario-${index}" data-field="scenario" value="true" /><span>Assume true</span></label>
        <label><input type="radio" name="scenario-${index}" data-field="scenario" value="false" /><span>Assume false</span></label>
      </fieldset>
      <p class="scenario-note" data-role="scenario-note"></p>
      <div class="inline-editor-actions">
        <button class="secondary-button destructive-button" type="button" data-action="remove-factor">Remove consequence</button>
      </div>
    </div>`;

  editor.querySelector('[data-field="label"]').value = factor.label;
  for (const input of editor.querySelectorAll('[data-field="weight"]')) input.value = String(factor.weight);
  for (const input of editor.querySelectorAll('[data-field="probability"]')) input.value = String(factor.probability);
  editor.querySelector(`[data-field="type"][value="${factor.type}"]`).checked = true;
  editor.querySelector(`[data-field="scenario"][value="${mode}"]`).checked = true;
  editor.querySelector('[data-role="scenario-note"]').textContent = scenarioNote(factor, mode);
}

function renderContributors(contributors) {
  const list = document.getElementById("contributors-list");
  list.replaceChildren();
  const visible = contributors.filter((item) => item.absoluteContribution > 0).slice(0, 5);
  if (!visible.length) {
    list.append(emptyItem("Add factors to see what carries the balance."));
    return;
  }
  for (const contributor of visible) {
    const item = element("li", contributor.type === "pro" ? "is-pro" : "is-con");
    const label = element("span", "analysis-item-label");
    label.textContent = contributor.label;
    const value = element("strong", "analysis-item-value");
    value.textContent = formatScore(contributor.expectedContribution);
    item.append(label, value);
    list.append(item);
  }
}

function renderSensitivity(sensitivity) {
  const list = document.getElementById("sensitivity-list");
  list.replaceChildren();
  const visible = sensitivity
    .filter((item) => item.mode === "estimated" && item.uncertaintyInfluence > 0)
    .slice(0, 5);
  if (!visible.length) {
    list.append(emptyItem("No uncertain estimates remain in this what-if."));
    return;
  }
  for (const assumption of visible) {
    const item = element("li", assumption.crossesNeutral ? "crosses-neutral" : "");
    const copy = element("span", "analysis-item-label");
    copy.textContent = assumption.label;
    const value = element("strong", "sensitivity-range");
    value.textContent = `${formatScore(assumption.scoreIfFalse)} ↔ ${formatScore(assumption.scoreIfTrue)}`;
    value.title = "Total balance if this consequence is false versus true";
    item.append(copy, value);
    list.append(item);
  }
}

function renderOptionComparison(decision, comparisons) {
  const container = document.getElementById("option-comparison");
  container.replaceChildren();
  if (decision.options.length < 2) {
    container.textContent = "Add another option to compare modeled balances against the same baseline.";
    return;
  }

  for (const { option, comparison } of comparisons) {
    const row = element("div", "option-comparison-row");
    if (option.id === decision.selectedOptionId) row.classList.add("is-selected");
    const name = element("span");
    name.textContent = option.name;
    const score = element("strong");
    score.textContent = formatScore(comparison.scenario.expectedScore);
    row.append(name, score);
    container.append(row);
  }
  const baseline = element("div", "option-comparison-row is-baseline");
  baseline.append(elementWithText("span", decision.baselineLabel), elementWithText("strong", "0"));
  container.append(baseline);
}

function renderScenarioStrip({ option, currentOverrideCount, totalOverrideCount, expectedScoreDelta }) {
  const strip = document.getElementById("scenario-strip");
  const summary = document.getElementById("scenario-summary");
  const clear = document.getElementById("clear-scenarios");
  strip.hidden = totalOverrideCount === 0;
  strip.classList.toggle("is-active", totalOverrideCount > 0);
  clear.disabled = totalOverrideCount === 0;

  if (currentOverrideCount > 0) {
    summary.textContent = `${pluralize(currentOverrideCount, "assumption")} for ${option.name} · ${formatScore(expectedScoreDelta)} from the saved estimate`;
  } else if (totalOverrideCount > 0) {
    summary.textContent = `Using saved estimates for ${option.name} · assumptions are active on another option`;
  } else {
    summary.textContent = "Using your saved estimates";
  }
}

function factorFormula(factor) {
  return `Importance ${factor.weight} × ${factor.probability}% chance`;
}

function scenarioLabel(mode) {
  if (mode === "true") return "Assumed true";
  if (mode === "false") return "Assumed false";
  return "Estimate";
}

function scenarioNote(factor, mode) {
  if (mode === "true") return `Treated as certain here. Saved estimate remains ${factor.probability}%.`;
  if (mode === "false") return `Treated as absent here. Saved estimate remains ${factor.probability}%.`;
  return `Using the saved ${factor.probability}% estimate.`;
}

function emptyItem(text) {
  const item = element("li", "empty-list-item");
  item.dataset.placeholder = "true";
  item.textContent = text;
  return item;
}

function element(tag, className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function elementWithText(tag, text) {
  const node = element(tag);
  node.textContent = text;
  return node;
}
