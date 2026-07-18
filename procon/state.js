const DEFAULT_WEIGHT_MAX = 10;

const starterFactors = [
  {
    id: "factor-autonomy",
    label: "More control over how I spend my working time",
    type: "pro",
    weight: 9,
    probability: 75,
  },
  {
    id: "factor-flexibility",
    label: "More flexibility in schedule and location",
    type: "pro",
    weight: 8,
    probability: 80,
  },
  {
    id: "factor-ai-work",
    label: "Work directly with AI on problems I find interesting",
    type: "pro",
    weight: 7,
    probability: 85,
  },
  {
    id: "factor-own-work",
    label: "Build a body of work and client relationships I own",
    type: "pro",
    weight: 8,
    probability: 65,
  },
  {
    id: "factor-income-upside",
    label: "Potential for higher long-term income",
    type: "pro",
    weight: 7,
    probability: 55,
  },
  {
    id: "factor-income-variance",
    label: "Unpredictable income while building a client base",
    type: "con",
    weight: 10,
    probability: 80,
  },
  {
    id: "factor-benefits",
    label: "Need to replace employer-provided benefits",
    type: "con",
    weight: 9,
    probability: 90,
  },
  {
    id: "factor-client-work",
    label: "Time spent finding and managing clients",
    type: "con",
    weight: 7,
    probability: 85,
  },
  {
    id: "factor-admin",
    label: "Administrative work such as contracts, taxes, and invoicing",
    type: "con",
    weight: 6,
    probability: 100,
  },
  {
    id: "factor-market-change",
    label: "AI services and client expectations may change quickly",
    type: "con",
    weight: 7,
    probability: 70,
  },
];

export function createSeedDecision() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: "decision-freelance-ai",
    question: "Quit my job and start working freelance, using AI?",
    baselineLabel: "No",
    weightMax: DEFAULT_WEIGHT_MAX,
    selectedOptionId: "option-yes",
    isStarter: true,
    createdAt: now,
    updatedAt: now,
    options: [
      {
        id: "option-yes",
        name: "Yes",
        factors: starterFactors.map((factor) => ({ ...factor })),
      },
    ],
  };
}

export function normalizeDecision(value) {
  if (!value || typeof value !== "object") return createSeedDecision();

  const weightMax = DEFAULT_WEIGHT_MAX;
  const options = Array.isArray(value.options)
    ? value.options.map((option, index) => normalizeOption(option, index, weightMax))
    : [];
  const usableOptions = options.length ? options : [createOption("Yes")];
  const selectedOptionId = usableOptions.some((option) => option.id === value.selectedOptionId)
    ? value.selectedOptionId
    : usableOptions[0].id;
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    id: nonemptyString(value.id, createId("decision")),
    question: nonemptyString(value.question, "What decision are you considering?"),
    baselineLabel: nonemptyString(value.baselineLabel, "No"),
    weightMax,
    selectedOptionId,
    isStarter: Boolean(value.isStarter),
    createdAt: nonemptyString(value.createdAt, now),
    updatedAt: nonemptyString(value.updatedAt, now),
    options: usableOptions,
  };
}

export function selectedOption(decision) {
  return decision.options.find((option) => option.id === decision.selectedOptionId)
    ?? decision.options[0];
}

export function updateQuestion(decision, question) {
  return touch({ ...decision, question: String(question), isStarter: false });
}

export function updateBaselineLabel(decision, baselineLabel) {
  const next = String(baselineLabel).trim();
  if (!next) return decision;
  return touch({ ...decision, baselineLabel: next, isStarter: false });
}

export function selectOption(decision, optionId) {
  if (!decision.options.some((option) => option.id === optionId)) return decision;
  return touch({ ...decision, selectedOptionId: optionId });
}

export function addOption(decision, name = `Option ${decision.options.length + 1}`) {
  const option = createOption(name);
  return touch({
    ...decision,
    isStarter: false,
    options: [...decision.options, option],
    selectedOptionId: option.id,
  });
}

export function renameOption(decision, optionId, name) {
  const nextName = String(name).trim();
  if (!nextName) return decision;
  return updateOption(decision, optionId, (option) => ({ ...option, name: nextName }));
}

export function removeOption(decision, optionId) {
  if (decision.options.length <= 1) return decision;
  const options = decision.options.filter((option) => option.id !== optionId);
  if (options.length === decision.options.length) return decision;
  const selectedOptionId = decision.selectedOptionId === optionId
    ? options[0].id
    : decision.selectedOptionId;
  return touch({ ...decision, options, selectedOptionId, isStarter: false });
}

export function addFactor(decision, optionId, type = "pro") {
  const factor = createFactor(type);
  return updateOption(decision, optionId, (option) => ({
    ...option,
    factors: [...option.factors, factor],
  }), factor.id);
}

export function updateFactor(decision, optionId, factorId, patch) {
  return updateOption(decision, optionId, (option) => ({
    ...option,
    factors: option.factors.map((factor) => (
      factor.id === factorId
        ? validateFactorPatch(factor, patch, decision.weightMax)
        : factor
    )),
  }));
}

export function removeFactor(decision, optionId, factorId) {
  return updateOption(decision, optionId, (option) => ({
    ...option,
    factors: option.factors.filter((factor) => factor.id !== factorId),
  }));
}

export function createOption(name) {
  return {
    id: createId("option"),
    name: nonemptyString(name, "Option"),
    factors: [],
  };
}

export function createFactor(type = "pro") {
  return {
    id: createId("factor"),
    label: type === "con" ? "New concern" : "New benefit",
    type: type === "con" ? "con" : "pro",
    weight: 5,
    probability: 50,
  };
}

function normalizeOption(value, index, weightMax) {
  const option = value && typeof value === "object" ? value : {};
  const factors = Array.isArray(option.factors)
    ? option.factors.map((factor) => normalizeFactor(factor, weightMax))
    : [];
  return {
    id: nonemptyString(option.id, createId("option")),
    name: nonemptyString(option.name, index === 0 ? "Yes" : `Option ${index + 1}`),
    factors,
  };
}

function normalizeFactor(value, weightMax) {
  const factor = value && typeof value === "object" ? value : {};
  return {
    id: nonemptyString(factor.id, createId("factor")),
    label: nonemptyString(factor.label, "Untitled consequence"),
    type: factor.type === "con" ? "con" : "pro",
    weight: integerInRange(factor.weight, 1, weightMax, Math.min(5, weightMax)),
    probability: integerInRange(factor.probability, 0, 100, 50),
  };
}

function validateFactorPatch(factor, patch, weightMax) {
  const next = { ...factor };
  if (Object.hasOwn(patch, "label")) next.label = String(patch.label);
  if (Object.hasOwn(patch, "type")) {
    if (!['pro', 'con'].includes(patch.type)) throw new RangeError("Factor type must be pro or con.");
    next.type = patch.type;
  }
  if (Object.hasOwn(patch, "weight")) {
    next.weight = requireInteger(patch.weight, 1, weightMax, "Weight");
  }
  if (Object.hasOwn(patch, "probability")) {
    next.probability = requireInteger(patch.probability, 0, 100, "Probability");
  }
  return next;
}

function updateOption(decision, optionId, change, addedFactorId = null) {
  let found = false;
  const options = decision.options.map((option) => {
    if (option.id !== optionId) return option;
    found = true;
    return change(option);
  });
  if (!found) return addedFactorId ? { decision, addedFactorId: null } : decision;
  const next = touch({ ...decision, options, isStarter: false });
  return addedFactorId ? { decision: next, addedFactorId } : next;
}

function touch(decision) {
  return { ...decision, updatedAt: new Date().toISOString() };
}

function requireInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${label} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return number;
}

function integerInRange(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

function nonemptyString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createId(prefix) {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
