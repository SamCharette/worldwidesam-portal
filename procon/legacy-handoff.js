export const LEGACY_STORAGE_KEY = "procon:prototype:v1";
export const TARGET_ORIGIN = "https://procon.worldwidesam.net";
export const TARGET_URL = `${TARGET_ORIGIN}/`;
export const READY_MESSAGE = "procon:v2:ready";
export const HANDOFF_KIND = "procon.prototype-v1";
export const HANDOFF_VERSION = 1;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;

function record(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must be a plain object.`);
  }
  return value;
}

function exactKeys(value, expected, path) {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (keys.length !== sortedExpected.length
    || keys.some((key, index) => key !== sortedExpected[index])) {
    throw new TypeError(`${path} has missing or unexpected fields.`);
  }
}

function nonemptyText(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
  return value;
}

function integer(value, minimum, maximum, path) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${path} is outside its supported range.`);
  }
  return value;
}

function validateFactor(value, path, factorIds) {
  const factor = record(value, path);
  exactKeys(factor, ["id", "label", "type", "weight", "probability"], path);
  const id = nonemptyText(factor.id, `${path}.id`);
  if (factorIds.has(id)) throw new TypeError(`Duplicate factor id ${id}.`);
  factorIds.add(id);
  nonemptyText(factor.label, `${path}.label`);
  if (factor.type !== "pro" && factor.type !== "con") {
    throw new TypeError(`${path}.type must be pro or con.`);
  }
  integer(factor.weight, 1, 10, `${path}.weight`);
  integer(factor.probability, 0, 100, `${path}.probability`);
}

function validateDecision(value) {
  const decision = record(value, "payload.decision");
  exactKeys(decision, [
    "schemaVersion",
    "id",
    "question",
    "baselineLabel",
    "weightMax",
    "selectedOptionId",
    "isStarter",
    "createdAt",
    "updatedAt",
    "options",
  ], "payload.decision");
  if (decision.schemaVersion !== 1 || decision.weightMax !== 10) {
    throw new TypeError("The saved decision is not a supported v1 decision.");
  }
  nonemptyText(decision.id, "payload.decision.id");
  nonemptyText(decision.question, "payload.decision.question");
  nonemptyText(decision.baselineLabel, "payload.decision.baselineLabel");
  const selectedOptionId = nonemptyText(
    decision.selectedOptionId,
    "payload.decision.selectedOptionId",
  );
  if (typeof decision.isStarter !== "boolean") {
    throw new TypeError("payload.decision.isStarter must be a boolean.");
  }
  for (const field of ["createdAt", "updatedAt"]) {
    const value = nonemptyText(decision[field], `payload.decision.${field}`);
    if (!Number.isFinite(Date.parse(value))) {
      throw new TypeError(`payload.decision.${field} must be a date-time.`);
    }
  }
  if (!Array.isArray(decision.options) || decision.options.length === 0) {
    throw new TypeError("payload.decision.options must contain at least one option.");
  }
  const optionIds = new Set();
  const factorIds = new Set();
  for (const [optionIndex, optionValue] of decision.options.entries()) {
    const path = `payload.decision.options[${optionIndex}]`;
    const option = record(optionValue, path);
    exactKeys(option, ["id", "name", "factors"], path);
    const id = nonemptyText(option.id, `${path}.id`);
    if (optionIds.has(id)) throw new TypeError(`Duplicate option id ${id}.`);
    optionIds.add(id);
    nonemptyText(option.name, `${path}.name`);
    if (!Array.isArray(option.factors)) throw new TypeError(`${path}.factors must be an array.`);
    option.factors.forEach((factor, factorIndex) => {
      validateFactor(factor, `${path}.factors[${factorIndex}]`, factorIds);
    });
  }
  if (!optionIds.has(selectedOptionId)) {
    throw new TypeError("payload.decision.selectedOptionId does not exist.");
  }
  return decision;
}

/**
 * Parse the only two local shapes ever written by the portal prototype. The
 * strict standalone validator remains authoritative after transfer.
 */
export function parseLegacyStorage(serialized) {
  if (typeof serialized !== "string" || !serialized) {
    throw new TypeError("No saved prototype decision was found on this device.");
  }
  const parsed = JSON.parse(serialized);
  const source = record(parsed, "payload");
  const envelope = Object.hasOwn(source, "decision")
    ? source
    : { schemaVersion: 1, decision: source };
  exactKeys(envelope, ["schemaVersion", "decision"], "payload");
  if (envelope.schemaVersion !== 1) {
    throw new TypeError("The saved decision is not a supported v1 payload.");
  }
  validateDecision(envelope.decision);
  return envelope;
}

export function parseReadyMessage(value) {
  try {
    const message = record(value, "ready message");
    exactKeys(message, ["type", "handoffVersion", "nonce"], "ready message");
    if (message.type !== READY_MESSAGE || message.handoffVersion !== HANDOFF_VERSION) return null;
    if (typeof message.nonce !== "string" || !NONCE_PATTERN.test(message.nonce)) return null;
    return message.nonce;
  } catch {
    return null;
  }
}

export function createHandoffEnvelope(payload, nonce) {
  if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) {
    throw new TypeError("The handoff nonce is invalid.");
  }
  const validatedPayload = parseLegacyStorage(JSON.stringify(payload));
  return {
    kind: HANDOFF_KIND,
    handoffVersion: HANDOFF_VERSION,
    nonce,
    payload: validatedPayload,
  };
}
