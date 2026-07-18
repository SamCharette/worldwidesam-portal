import { createSeedDecision, normalizeDecision } from "./state.js?v=6";

export const STORAGE_KEY = "procon:prototype:v1";

export function loadDecision(storage = browserStorage()) {
  if (!storage) return { decision: createSeedDecision(), status: "unavailable" };

  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (!serialized) return { decision: createSeedDecision(), status: "seeded" };
    const payload = JSON.parse(serialized);
    return {
      decision: normalizeDecision(payload?.decision ?? payload),
      status: "restored",
    };
  } catch {
    return { decision: createSeedDecision(), status: "recovered" };
  }
}

export function saveDecision(decision, storage = browserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      decision: normalizeDecision(decision),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedDecision(storage = browserStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
