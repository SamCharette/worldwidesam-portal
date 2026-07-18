import test from "node:test";
import assert from "node:assert/strict";

import {
  addFactor,
  addOption,
  createSeedDecision,
  normalizeDecision,
  removeOption,
  selectedOption,
  updateFactor,
} from "../procon/state.js";
import { loadDecision, saveDecision, STORAGE_KEY } from "../procon/storage.js";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("the starter decision is a yes option against a no baseline", () => {
  const decision = createSeedDecision();
  assert.equal(decision.baselineLabel, "No");
  assert.equal(selectedOption(decision).name, "Yes");
  assert.ok(selectedOption(decision).factors.some((factor) => factor.type === "pro"));
  assert.ok(selectedOption(decision).factors.some((factor) => factor.type === "con"));
});

test("additional options keep their factor ledgers isolated", () => {
  const original = createSeedDecision();
  const withAlternative = addOption(original, "Ease into freelancing");
  const alternative = selectedOption(withAlternative);
  const result = addFactor(withAlternative, alternative.id, "pro");

  assert.equal(original.options.length, 1);
  assert.equal(result.decision.options.length, 2);
  assert.equal(result.decision.options[0].factors.length, original.options[0].factors.length);
  assert.equal(result.decision.options[1].factors.length, 1);
});

test("factor updates validate the configured weight and probability scales", () => {
  const decision = createSeedDecision();
  const option = selectedOption(decision);
  const factor = option.factors[0];
  const changed = updateFactor(decision, option.id, factor.id, { weight: 10, probability: 42 });

  assert.equal(selectedOption(changed).factors[0].weight, 10);
  assert.equal(selectedOption(changed).factors[0].probability, 42);
  assert.throws(
    () => updateFactor(decision, option.id, factor.id, { weight: 400 }),
    /whole number from 1 to 10/,
  );
  assert.throws(
    () => updateFactor(decision, option.id, factor.id, { probability: 101 }),
    /whole number from 0 to 100/,
  );
});

test("the final option cannot be removed", () => {
  const decision = createSeedDecision();
  assert.equal(removeOption(decision, decision.options[0].id), decision);
});

test("storage persists only the decision model and restores normalized data", () => {
  const storage = new MemoryStorage();
  const decision = createSeedDecision();
  assert.equal(saveDecision(decision, storage), true);

  const serialized = storage.getItem(STORAGE_KEY);
  assert.doesNotMatch(serialized, /scenario|override/i);
  const restored = loadDecision(storage);
  assert.equal(restored.status, "restored");
  assert.equal(restored.decision.question, decision.question);
  assert.equal(restored.decision.options[0].factors[0].probability, 75);
});

test("invalid saved data recovers to a usable starter decision", () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, "not-json");
  const restored = loadDecision(storage);
  assert.equal(restored.status, "recovered");
  assert.equal(restored.decision.options.length, 1);

  const normalized = normalizeDecision({ options: [], weightMax: 4000 });
  assert.equal(normalized.weightMax, 10);
  assert.equal(normalized.options.length, 1);
});

test("normalization repairs duplicate option and factor identities", () => {
  const normalized = normalizeDecision({
    selectedOptionId: "duplicate-option",
    options: [
      {
        id: "duplicate-option",
        name: "One",
        factors: [{ id: "duplicate-factor", label: "One", type: "pro", weight: 5, probability: 50 }],
      },
      {
        id: "duplicate-option",
        name: "Two",
        factors: [{ id: "duplicate-factor", label: "Two", type: "con", weight: 5, probability: 50 }],
      },
    ],
  });

  assert.equal(new Set(normalized.options.map((option) => option.id)).size, 2);
  assert.equal(new Set(normalized.options.flatMap((option) => option.factors.map((factor) => factor.id))).size, 2);
  assert.equal(normalized.selectedOptionId, normalized.options[0].id);
});
