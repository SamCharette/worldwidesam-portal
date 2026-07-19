import assert from "node:assert/strict";
import test from "node:test";

import {
  HANDOFF_KIND,
  HANDOFF_VERSION,
  LEGACY_STORAGE_KEY,
  READY_MESSAGE,
  TARGET_ORIGIN,
  TARGET_URL,
  createHandoffEnvelope,
  parseLegacyStorage,
  parseReadyMessage,
} from "../procon/legacy-handoff.js";
import { createSeedDecision } from "../procon/state.js";

function payload() {
  const decision = createSeedDecision();
  decision.isStarter = false;
  decision.question = "Should I make the change?";
  return { schemaVersion: 1, decision };
}

test("the legacy bridge constants exactly match the standalone receiver", () => {
  assert.equal(LEGACY_STORAGE_KEY, "procon:prototype:v1");
  assert.equal(TARGET_ORIGIN, "https://procon.worldwidesam.net");
  assert.equal(TARGET_URL, "https://procon.worldwidesam.net/");
  assert.equal(READY_MESSAGE, "procon:v2:ready");
  assert.equal(HANDOFF_KIND, "procon.prototype-v1");
  assert.equal(HANDOFF_VERSION, 1);
});

test("stored v1 envelopes and the earliest raw decision shape are parsed without mutation", () => {
  const expected = payload();
  assert.deepEqual(parseLegacyStorage(JSON.stringify(expected)), expected);
  assert.deepEqual(
    parseLegacyStorage(JSON.stringify(expected.decision)),
    expected,
  );
});

test("legacy storage parsing rejects unknown fields, invalid ranges, and duplicate ids", () => {
  const unknown = payload();
  unknown.advice = "AI-generated answer";
  assert.throws(() => parseLegacyStorage(JSON.stringify(unknown)), /unexpected fields/);

  const badRange = payload();
  badRange.decision.options[0].factors[0].probability = 101;
  assert.throws(() => parseLegacyStorage(JSON.stringify(badRange)), /supported range/);

  const duplicate = payload();
  duplicate.decision.options[0].factors[1].id = duplicate.decision.options[0].factors[0].id;
  assert.throws(() => parseLegacyStorage(JSON.stringify(duplicate)), /Duplicate factor id/);
});

test("only the exact ready shape and a bounded URL-safe nonce are accepted", () => {
  const nonce = "abcdefghijklmnop";
  assert.equal(parseReadyMessage({
    type: READY_MESSAGE,
    handoffVersion: HANDOFF_VERSION,
    nonce,
  }), nonce);
  assert.equal(parseReadyMessage({
    type: READY_MESSAGE,
    handoffVersion: HANDOFF_VERSION,
    nonce,
    extra: true,
  }), null);
  assert.equal(parseReadyMessage({ type: READY_MESSAGE, handoffVersion: 2, nonce }), null);
  assert.equal(parseReadyMessage({ type: READY_MESSAGE, handoffVersion: 1, nonce: "short" }), null);
});

test("the outgoing handoff has the receiver's exact nonce-bound envelope", () => {
  const saved = payload();
  const nonce = "abcdefghijklmnop";
  assert.deepEqual(createHandoffEnvelope(saved, nonce), {
    kind: HANDOFF_KIND,
    handoffVersion: HANDOFF_VERSION,
    nonce,
    payload: saved,
  });
  assert.throws(() => createHandoffEnvelope(saved, "short"), /nonce/);
});
