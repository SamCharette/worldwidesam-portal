import { analyzeBaselineVsScenario } from "./model.js";
import {
  addFactor,
  addOption,
  removeFactor,
  removeOption,
  renameOption,
  selectOption,
  selectedOption,
  updateBaselineLabel,
  updateFactor,
  updateQuestion,
} from "./state.js";
import { loadDecision, saveDecision } from "./storage.js";
import {
  announce,
  renderAnalysis,
  renderDecisionHeader,
  renderFactorLedger,
  renderOptionRail,
  resizeDecisionTitle,
  setStorageStatus,
  updateFactorCard,
} from "./view.js";

const loaded = loadDecision();
let decision = loaded.decision;
let scenarios = {};
let factorFilter = "all";
const expandedFactors = new Set();

const factorDialog = document.getElementById("factor-dialog");
const factorForm = document.getElementById("factor-form");
const optionDialog = document.getElementById("option-dialog");
const optionForm = document.getElementById("option-form");

bindDecisionEvents();
bindOptionEvents();
bindFactorEvents();
bindDialogEvents();
renderEverything(loaded.status);

function bindDecisionEvents() {
  const title = document.getElementById("decision-title");
  title.addEventListener("input", () => {
    decision = updateQuestion(decision, title.value);
    persistDecision();
    resizeDecisionTitle();
    document.getElementById("decision-help").textContent =
      "Weights express personal importance. Probabilities estimate what happens if you choose an option.";
  });

  document.getElementById("clear-scenarios").addEventListener("click", () => {
    scenarios = {};
    renderLedgerAndAnalysis();
    announce("What-if assumptions cleared. Saved probability estimates were not changed.");
  });
}

function bindOptionEvents() {
  document.getElementById("add-option-button").addEventListener("click", () => {
    openOptionDialog("add");
  });

  document.getElementById("option-rail").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const optionId = button.dataset.optionId;

    if (button.dataset.action === "select-option") {
      decision = selectOption(decision, optionId);
      expandedFactors.clear();
      persistDecision();
      renderEverything();
      announce(`${selectedOption(decision).name} selected.`);
      return;
    }
    if (button.dataset.action === "rename-option") {
      const option = decision.options.find((candidate) => candidate.id === optionId);
      if (option) openOptionDialog("rename", option);
      return;
    }
    if (button.dataset.action === "rename-baseline") {
      openOptionDialog("baseline");
      return;
    }
    if (button.dataset.action === "remove-option") {
      const option = decision.options.find((candidate) => candidate.id === optionId);
      if (!option || !window.confirm(`Remove ${option.name} and its consequences?`)) return;
      for (const factor of option.factors) delete scenarios[factor.id];
      decision = removeOption(decision, option.id);
      expandedFactors.clear();
      persistDecision();
      renderEverything();
      announce(`${option.name} removed.`);
    }
  });
}

function bindFactorEvents() {
  document.getElementById("factor-filter-region").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    factorFilter = button.dataset.filter;
    renderLedger();
  });

  document.getElementById("add-factor-button").addEventListener("click", openFactorDialog);

  const ledger = document.getElementById("factor-ledger");
  ledger.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const context = factorContext(action);
    if (!context) return;

    if (action.dataset.action === "toggle-factor") {
      const editor = context.card.querySelector('[data-role="factor-editor"]');
      const isOpen = !editor.hidden;
      editor.hidden = isOpen;
      action.setAttribute("aria-expanded", String(!isOpen));
      if (isOpen) expandedFactors.delete(context.factor.id);
      else expandedFactors.add(context.factor.id);
      return;
    }

    if (action.dataset.action === "remove-factor") {
      if (!window.confirm(`Remove “${context.factor.label}”?`)) return;
      decision = removeFactor(decision, context.option.id, context.factor.id);
      delete scenarios[context.factor.id];
      expandedFactors.delete(context.factor.id);
      persistDecision();
      renderLedgerAndAnalysis();
      announce("Consequence removed.");
    }
  });

  ledger.addEventListener("input", (event) => {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    const context = factorContext(input);
    if (!context) return;

    if (input.dataset.field === "label") {
      if (!input.value.trim()) return;
      decision = updateFactor(decision, context.option.id, context.factor.id, {
        label: input.value,
      });
      persistDecision();
      refreshFactorAndAnalysis(context.factor.id);
      return;
    }

    if (["weight", "probability"].includes(input.dataset.field)) {
      updateNumericFactorInput(input, context);
    }
  });

  ledger.addEventListener("change", (event) => {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    const context = factorContext(input);
    if (!context) return;

    if (input.dataset.field === "label" && !input.value.trim()) {
      input.value = context.factor.label;
      input.setCustomValidity("Describe the consequence.");
      input.reportValidity();
      input.setCustomValidity("");
      return;
    }

    if (input.dataset.field === "type") {
      decision = updateFactor(decision, context.option.id, context.factor.id, {
        type: input.value,
      });
      persistDecision();
      renderLedgerAndAnalysis();
      announce(`Consequence now ${input.value === "pro" ? "supports" : "counts against"} ${context.option.name}.`);
      return;
    }

    if (input.dataset.field === "scenario") {
      if (input.value === "estimated") delete scenarios[context.factor.id];
      else scenarios[context.factor.id] = input.value;
      renderLedgerAndAnalysis();
      const description = input.value === "estimated" ? "uses its saved estimate" : `is assumed ${input.value}`;
      announce(`${context.factor.label} ${description}.`);
      return;
    }

    if (["weight", "probability"].includes(input.dataset.field)) {
      const latest = currentFactor(context.factor.id);
      if (!validNumericInput(input)) {
        input.value = String(latest[input.dataset.field]);
        input.setCustomValidity(input.dataset.field === "weight"
          ? "Use a whole number from 1 to 10."
          : "Use a whole percentage from 0 to 100.");
        input.reportValidity();
        input.setCustomValidity("");
      }
    }
  });
}

function bindDialogEvents() {
  document.getElementById("close-factor-dialog").addEventListener("click", () => factorDialog.close());
  document.getElementById("cancel-factor-button").addEventListener("click", () => factorDialog.close());
  document.getElementById("close-option-dialog").addEventListener("click", () => optionDialog.close());
  document.getElementById("cancel-option-button").addEventListener("click", () => optionDialog.close());

  bindMirroredDialogInputs("factor-weight-input", "factor-weight-range");
  bindMirroredDialogInputs("factor-probability-input", "factor-probability-range");

  factorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!factorForm.reportValidity()) return;
    const option = selectedOption(decision);
    const type = factorForm.elements["factor-kind"].value;
    const result = addFactor(decision, option.id, type);
    decision = updateFactor(result.decision, option.id, result.addedFactorId, {
      label: document.getElementById("factor-name").value.trim(),
      type,
      weight: Number(document.getElementById("factor-weight-input").value),
      probability: Number(document.getElementById("factor-probability-input").value),
    });
    expandedFactors.add(result.addedFactorId);
    persistDecision();
    factorDialog.close();
    renderLedgerAndAnalysis();
    focusFactor(result.addedFactorId);
    announce("Consequence added.");
  });

  optionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!optionForm.reportValidity()) return;
    const name = document.getElementById("option-name").value.trim();
    const mode = optionForm.dataset.mode;
    if (mode === "rename") {
      decision = renameOption(decision, optionForm.dataset.optionId, name);
    } else if (mode === "baseline") {
      decision = updateBaselineLabel(decision, name);
    } else {
      decision = addOption(decision, name);
      expandedFactors.clear();
    }
    persistDecision();
    optionDialog.close();
    renderEverything();
    announce(mode === "add" ? `${name} added.` : `${name} saved.`);
  });

  document.getElementById("analysis-toggle").addEventListener("click", (event) => {
    const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
    event.currentTarget.setAttribute("aria-expanded", String(!expanded));
    event.currentTarget.textContent = expanded ? "Open full analysis" : "Close full analysis";
  });
}

function openFactorDialog() {
  factorForm.reset();
  const initialType = factorFilter === "con" ? "con" : "pro";
  document.getElementById(`factor-kind-${initialType}`).checked = true;
  setMirroredValues("factor-weight-input", "factor-weight-range", 5);
  setMirroredValues("factor-probability-input", "factor-probability-range", 50);
  document.getElementById("factor-dialog-title").textContent =
    `Add a consequence for ${selectedOption(decision).name}`;
  factorDialog.showModal();
  document.getElementById("factor-name").focus();
}

function openOptionDialog(mode, option = null) {
  optionForm.reset();
  optionForm.dataset.mode = mode;
  optionForm.dataset.optionId = option?.id ?? "";
  const input = document.getElementById("option-name");
  const heading = document.getElementById("option-dialog-title");
  const save = document.getElementById("save-option-button");

  if (mode === "rename") {
    heading.textContent = `Rename ${option.name}`;
    save.textContent = "Save name";
    input.value = option.name;
  } else if (mode === "baseline") {
    heading.textContent = "Rename the baseline";
    save.textContent = "Save baseline";
    input.value = decision.baselineLabel;
  } else {
    heading.textContent = "Add an option";
    save.textContent = "Add option";
  }
  optionDialog.showModal();
  input.focus();
  input.select();
}

function updateNumericFactorInput(input, context) {
  if (!validNumericInput(input)) return;
  const value = Number(input.value);
  const patch = { [input.dataset.field]: value };
  decision = updateFactor(decision, context.option.id, context.factor.id, patch);
  for (const peer of context.card.querySelectorAll(`[data-field="${input.dataset.field}"]`)) {
    if (peer !== input) peer.value = String(value);
  }
  persistDecision();
  refreshFactorAndAnalysis(context.factor.id);
}

function validNumericInput(input) {
  const value = Number(input.value);
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  return input.value !== ""
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum;
}

function bindMirroredDialogInputs(numberId, rangeId) {
  const number = document.getElementById(numberId);
  const range = document.getElementById(rangeId);
  range.addEventListener("input", () => {
    number.value = range.value;
  });
  number.addEventListener("input", () => {
    if (validNumericInput(number)) range.value = number.value;
  });
}

function setMirroredValues(numberId, rangeId, value) {
  document.getElementById(numberId).value = String(value);
  document.getElementById(rangeId).value = String(value);
}

function renderEverything(loadStatus = "restored") {
  renderDecisionHeader(decision, loadStatus);
  renderOptionRail(decision);
  renderLedgerAndAnalysis();
}

function renderLedgerAndAnalysis() {
  renderLedger();
  renderCurrentAnalysis();
}

function renderLedger() {
  const option = selectedOption(decision);
  renderFactorLedger({
    option,
    comparison: analyzeBaselineVsScenario(option, scenarios),
    scenarios,
    filter: factorFilter,
    expandedFactors,
  });
}

function renderCurrentAnalysis() {
  const option = selectedOption(decision);
  const optionComparisons = decision.options.map((candidate) => ({
    option: candidate,
    comparison: analyzeBaselineVsScenario(candidate, scenarios),
  }));
  renderAnalysis({
    decision,
    option,
    comparison: optionComparisons.find((entry) => entry.option.id === option.id).comparison,
    optionComparisons,
    totalOverrideCount: activeOverrideCount(),
  });
}

function refreshFactorAndAnalysis(factorId) {
  const option = selectedOption(decision);
  const comparison = analyzeBaselineVsScenario(option, scenarios);
  const factor = option.factors.find((candidate) => candidate.id === factorId);
  const contributor = comparison.scenario.contributors.find((candidate) => candidate.id === factorId);
  if (factor && contributor) {
    updateFactorCard(factor, contributor, scenarios[factorId] ?? "estimated");
  }
  renderCurrentAnalysis();
}

function persistDecision() {
  const saved = saveDecision(decision);
  setStorageStatus(saved ? "saved" : "failed");
}

function activeOverrideCount() {
  const factorIds = new Set(
    decision.options.flatMap((option) => option.factors.map((factor) => factor.id)),
  );
  return Object.entries(scenarios)
    .filter(([factorId, mode]) => factorIds.has(factorId) && mode !== "estimated")
    .length;
}

function factorContext(target) {
  const card = target.closest(".factor-card");
  if (!card) return null;
  const option = selectedOption(decision);
  const factor = option.factors.find((candidate) => candidate.id === card.dataset.factorId);
  return factor ? { card, option, factor } : null;
}

function currentFactor(factorId) {
  return selectedOption(decision).factors.find((factor) => factor.id === factorId);
}

function focusFactor(factorId) {
  window.requestAnimationFrame(() => {
    const card = [...document.querySelectorAll(".factor-card")]
      .find((candidate) => candidate.dataset.factorId === factorId);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    card?.querySelector('[data-field="label"]')?.focus({ preventScroll: true });
  });
}
