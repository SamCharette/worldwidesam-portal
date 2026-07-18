import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, webkit } from "playwright";

const baseUrl = new URL(process.env.PROCON_BASE_URL || "http://127.0.0.1:4179/procon/");
const browserType = process.env.PROCON_BROWSER === "webkit" ? webkit : chromium;
const assetRoot = process.env.PROCON_ASSET_ROOT
  ? path.resolve(process.env.PROCON_ASSET_ROOT)
  : null;
const checks = [];
let browser;

function check(name, run) {
  checks.push({ name, run });
}

async function newPage({ width = 390, height = 844, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await routeLocalAssets(context);
  const page = await context.newPage();
  return { context, page };
}

async function routeLocalAssets(context, requestedRoot = assetRoot) {
  if (!requestedRoot) return;
  const realRoot = await realpath(requestedRoot);
  await context.route("**/procon/**", async (route) => {
    const requestPath = new URL(route.request().url()).pathname.slice("/procon/".length)
      || "index.html";
    const resolvedPath = path.resolve(realRoot, requestPath);
    let realFilePath;
    try {
      realFilePath = await realpath(resolvedPath);
    } catch {
      await route.abort("failed");
      return;
    }
    if (!realFilePath.startsWith(`${realRoot}${path.sep}`)) {
      await route.abort("accessdenied");
      return;
    }
    const contentTypes = {
      ".css": "text/css",
      ".html": "text/html",
      ".js": "text/javascript",
    };
    await route.fulfill({
      body: await readFile(realFilePath),
      contentType: contentTypes[path.extname(realFilePath)] ?? "application/octet-stream",
    });
  });
}

async function openApp(page) {
  const response = await page.goto(baseUrl.href, { waitUntil: "networkidle" });
  assert.equal(response?.ok(), true);
  await page.waitForFunction(() => document.getElementById("factor-count")?.textContent === "10 factors");
}

function factorCard(page, label) {
  return page.locator(".factor-card").filter({ hasText: label }).first();
}

function scoreNumber(text) {
  return Number(text.trim().replace("−", "-").replace("+", ""));
}

function assertClose(actual, expected, tolerance = 1e-7, label = "values") {
  assert.ok(Number.isFinite(actual), `${label}: ${actual} is not finite`);
  assert.ok(Number.isFinite(expected), `${label}: ${expected} is not finite`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

async function balanceSnapshot(container) {
  return container.evaluate((balance) => {
    const svg = balance.querySelector("svg");
    const beam = svg.querySelector('[data-role="active-beam"]');
    const pivot = svg.querySelector(".balance-pivot-pin");
    const numberAttribute = (node, name) => Number(node.getAttribute(name));
    const labelledBy = svg.getAttribute("aria-labelledby").split(/\s+/);

    return {
      state: balance.dataset.state,
      svgState: svg.dataset.state,
      angle: Number(balance.dataset.balanceAngle),
      beamAngle: Number(beam.dataset.angle),
      domainMagnitude: Number(balance.dataset.domainMagnitude),
      factorCount: Number(balance.dataset.factorCount),
      role: svg.getAttribute("role"),
      focusable: svg.getAttribute("focusable"),
      labelledBy,
      labelledByTags: labelledBy.map((id) => document.getElementById(id)?.tagName.toLowerCase()),
      title: svg.querySelector("title")?.textContent,
      description: svg.querySelector("desc")?.textContent,
      focusableDescendants: [...svg.querySelectorAll("*")]
        .filter((node) => node.getAttribute("focusable") === "true" || node.tabIndex >= 0)
        .map((node) => node.outerHTML),
      pivot: {
        x: numberAttribute(pivot, "cx"),
        y: numberAttribute(pivot, "cy"),
      },
      beam: {
        left: { x: numberAttribute(beam, "x1"), y: numberAttribute(beam, "y1") },
        right: { x: numberAttribute(beam, "x2"), y: numberAttribute(beam, "y2") },
      },
      outcomeMarks: svg.querySelectorAll('[data-role="outcome-mark"]').length,
      likelyRanges: svg.querySelectorAll('[data-role="likely-range"]').length,
      expectedMarkers: svg.querySelectorAll('[data-role="expected-marker"]').length,
      emptyCopy: svg.querySelector(".balance-empty-copy")?.textContent ?? null,
      weights: [...svg.querySelectorAll(".balance-weight")].map((group) => {
        const mass = group.querySelector(".balance-mass");
        const connector = group.querySelector(".balance-connector");
        return {
          id: group.dataset.factorId,
          type: mass.classList.contains("is-pro") ? "pro" : "con",
          weight: Number(group.dataset.weight),
          effectiveProbability: Number(group.dataset.effectiveProbability),
          contribution: Number(group.dataset.contribution),
          anchorX: Number(group.dataset.anchorX),
          radius: Number(group.dataset.radius),
          mass: {
            x: numberAttribute(mass, "cx"),
            y: numberAttribute(mass, "cy"),
            radius: numberAttribute(mass, "r"),
          },
          connector: {
            x1: numberAttribute(connector, "x1"),
            y1: numberAttribute(connector, "y1"),
            x2: numberAttribute(connector, "x2"),
            y2: numberAttribute(connector, "y2"),
          },
        };
      }),
    };
  });
}

async function waitForFocus(page, selector) {
  await page.waitForFunction(
    (focusSelector) => document.querySelector(focusSelector) === document.activeElement,
    selector,
  );
}

check("starter model renders two truthful probability balances", async () => {
  const { context, page } = await newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await openApp(page);
  assert.equal(await page.title(), "ProCon · Assumption mobile");
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow, noarchive");
  assert.equal(await page.locator("#decision-title").inputValue(), "Quit my job and start working freelance, using AI?");
  assert.equal(await page.locator(".factor-card").count(), 10);
  assert.equal(await page.locator("#mobile-brief-factor-count").textContent(), "10 weights");
  assert.equal(await page.locator("#expected-score").textContent(), "−4.8");
  assert.match(await page.locator("#chance-positive").textContent(), /%$/);
  assert.match(await page.locator("#likely-range").textContent(), /to/);
  assert.equal(await page.locator("#scenario-strip").isHidden(), true);
  assert.match(await page.locator("#model-note").textContent(), /not objective probabilities/i);

  const legend = await page.locator("#mobile-balance-legend .balance-legend-item").evaluateAll((items) =>
    items.map((item) => ({
      id: item.dataset.factorId,
      weight: Number(item.dataset.weight),
      effectiveProbability: Number(item.dataset.effectiveProbability),
      contribution: Number(item.dataset.contribution),
      mode: item.dataset.mode,
      key: item.querySelector(".balance-legend-key")?.textContent,
      label: item.querySelector(".balance-legend-copy strong")?.textContent,
      formula: item.querySelector(".balance-legend-copy small")?.textContent,
      value: item.querySelector(".balance-legend-value")?.textContent,
      valueLabel: item.querySelector(".balance-legend-value")?.getAttribute("aria-label"),
    })),
  );
  assert.equal(legend.length, 10);
  assert.deepEqual(legend.map(({ key }) => key), [..."ABCDEFGHIJ"]);
  for (const item of legend) {
    assert.ok(item.id);
    assert.ok(item.label);
    assert.equal(item.mode, "estimated");
    assert.match(item.formula, new RegExp(`^Importance ${item.weight} · .+% chance$`));
    assert.match(item.value, /^[+−]/);
    assert.equal(item.valueLabel, `Expected contribution ${item.value}`);
  }

  const support = legend
    .filter(({ contribution }) => contribution > 0)
    .reduce((total, { contribution }) => total + contribution, 0);
  const against = legend
    .filter(({ contribution }) => contribution < 0)
    .reduce((total, { contribution }) => total + contribution, 0);
  assertClose(scoreNumber(await page.locator("#mobile-support-total").textContent()), support, 0.051, "support total");
  assertClose(scoreNumber(await page.locator("#mobile-against-total").textContent()), against, 0.051, "against total");
  assertClose(scoreNumber(await page.locator("#expected-score").textContent()), support + against, 0.051, "expected total");

  const expectedDescription = "The opposing arm hangs lower. Importance controls disk area, effective probability controls distance from the pivot, and tilt shows the expected balance. Expected balance −4.8; 25.4% of modeled outcomes are above zero; 10th-to-90th percentile span −16 to +8.";
  const legendById = new Map(legend.map((item) => [item.id, item]));
  for (const selector of ["#mobile-probability-balance", "#analysis-probability-balance"]) {
    const snapshot = await balanceSnapshot(page.locator(selector));
    assert.equal(snapshot.state, "negative");
    assert.equal(snapshot.svgState, "negative");
    assert.ok(snapshot.angle < 0);
    assertClose(snapshot.beamAngle, snapshot.angle, 1e-12, `${selector} beam angle`);
    assert.ok(snapshot.domainMagnitude > 0);
    assert.equal(snapshot.factorCount, 10);
    assert.equal(snapshot.weights.length, 10);
    assert.ok(snapshot.outcomeMarks > 5);
    assert.equal(snapshot.likelyRanges, 1);
    assert.equal(snapshot.expectedMarkers, 1);
    assert.equal(snapshot.emptyCopy, null);
    assert.equal(snapshot.role, "img");
    assert.equal(snapshot.focusable, "false");
    assert.deepEqual(snapshot.labelledByTags, ["title", "desc"]);
    assert.equal(snapshot.title, "Probability balance for Yes");
    assert.equal(snapshot.description, expectedDescription);
    assert.deepEqual(snapshot.focusableDescendants, []);

    const areaPerWeight = snapshot.weights[0].mass.radius ** 2 / snapshot.weights[0].weight;
    for (const weight of snapshot.weights) {
      const legendItem = legendById.get(weight.id);
      assert.ok(legendItem, `${selector} weight ${weight.id} is represented in the legend`);
      assert.equal(weight.weight, legendItem.weight);
      assertClose(weight.effectiveProbability, legendItem.effectiveProbability, 1e-12, `${weight.id} probability`);
      assertClose(weight.contribution, legendItem.contribution, 1e-12, `${weight.id} contribution`);
      assertClose(weight.mass.radius, weight.radius, 1e-12, `${weight.id} radius data`);
      assertClose(weight.mass.radius ** 2 / weight.weight, areaPerWeight, 1e-10, `${weight.id} area per importance`);
      assertClose(
        weight.contribution,
        (weight.type === "pro" ? 1 : -1) * weight.weight * weight.effectiveProbability,
        1e-10,
        `${weight.id} encoded contribution`,
      );

      const endpoint = weight.type === "pro" ? snapshot.beam.right : snapshot.beam.left;
      const expectedAnchor = {
        x: snapshot.pivot.x + (endpoint.x - snapshot.pivot.x) * weight.effectiveProbability,
        y: snapshot.pivot.y + (endpoint.y - snapshot.pivot.y) * weight.effectiveProbability,
      };
      assertClose(weight.connector.x1, expectedAnchor.x, 1e-7, `${weight.id} anchor x`);
      assertClose(weight.connector.y1, expectedAnchor.y, 1e-7, `${weight.id} anchor y`);
      assertClose(weight.anchorX, expectedAnchor.x, 1e-7, `${weight.id} data anchor x`);
      assertClose(weight.connector.x2, expectedAnchor.x, 1e-7, `${weight.id} connector x`);
      assertClose(weight.mass.x, expectedAnchor.x, 1e-7, `${weight.id} mass x`);
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
});

check("a warm browser cache cannot mix modules from different ProCon releases", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await routeLocalAssets(context);
  await context.route("**/procon/view.js", async (route) => {
    await route.fulfill({
      body: 'throw new Error("stale unversioned view module used");',
      contentType: "text/javascript",
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  });

  const warmingPage = await context.newPage();
  await warmingPage.goto(new URL("view.js", baseUrl).href, { waitUntil: "networkidle" });
  await warmingPage.close();

  const moduleRequests = [];
  const page = await context.newPage();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/procon/") && url.pathname.endsWith(".js")) {
      moduleRequests.push({ path: url.pathname, version: url.searchParams.get("v") });
    }
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openApp(page);

  const expectedModules = [
    "app.js",
    "balance-geometry.js",
    "balance.js",
    "format.js",
    "mobile-navigation.js",
    "model.js",
    "state.js",
    "storage.js",
    "view.js",
  ];
  assert.deepEqual(
    [...new Set(moduleRequests.map(({ path: requestPath }) => path.basename(requestPath)))].sort(),
    expectedModules,
  );
  assert.deepEqual(
    moduleRequests.filter(({ version }) => version !== "6"),
    [],
    `Every loaded module must use release v6: ${JSON.stringify(moduleRequests)}`,
  );
  assert.equal(moduleRequests.some(({ path: requestPath }) => path.basename(requestPath) === "chart.js"), false);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator("#mobile-decision-brief").isVisible(), true);
  await context.close();
});

check("weights and probabilities update the tally live and persist locally", async () => {
  const { context, page } = await newPage();
  await openApp(page);
  const heroWeight = page.locator(
    '#mobile-probability-balance .balance-weight[data-factor-id="factor-autonomy"]',
  );
  const beforeGeometry = await heroWeight.evaluate((node) => ({
    anchorX: Number(node.dataset.anchorX),
    radius: Number(node.dataset.radius),
  }));
  await page.getByRole("button", { name: "Inspect the weights" }).click();
  const before = await page.locator("#expected-score").textContent();
  const autonomy = factorCard(page, "More control over how I spend my working time");
  await autonomy.locator(".factor-summary").click();
  await autonomy.locator('[data-field="weight"][data-control="number"]').fill("10");
  const afterImportance = await heroWeight.evaluate((node) => ({
    anchorX: Number(node.dataset.anchorX),
    radius: Number(node.dataset.radius),
  }));
  assertClose(afterImportance.anchorX, beforeGeometry.anchorX, 1e-10, "importance keeps chance x");
  assert.ok(afterImportance.radius > beforeGeometry.radius);
  await autonomy.locator('[data-field="probability"][data-control="number"]').fill("100");
  const afterChance = await heroWeight.evaluate((node) => ({
    anchorX: Number(node.dataset.anchorX),
    radius: Number(node.dataset.radius),
    effectiveProbability: Number(node.dataset.effectiveProbability),
  }));
  assert.equal(afterChance.effectiveProbability, 1);
  assert.ok(afterChance.anchorX > afterImportance.anchorX);
  assertClose(afterChance.radius, afterImportance.radius, 1e-10, "chance keeps importance area");

  assert.equal(await autonomy.locator('[data-field="weight"][data-control="range"]').inputValue(), "10");
  assert.equal(await autonomy.locator('[data-field="probability"][data-control="range"]').inputValue(), "100");
  assert.notEqual(await page.locator("#expected-score").textContent(), before);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("procon:prototype:v1")));
  const savedFactor = saved.decision.options[0].factors.find((factor) => factor.id === "factor-autonomy");
  assert.equal(savedFactor.weight, 10);
  assert.equal(savedFactor.probability, 100);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Inspect the weights" }).click();
  const restored = factorCard(page, "More control over how I spend my working time");
  await restored.locator(".factor-summary").click();
  assert.equal(await restored.locator('[data-field="weight"][data-control="number"]').inputValue(), "10");
  assert.equal(await restored.locator('[data-field="probability"][data-control="number"]').inputValue(), "100");
  await context.close();
});

check("what-if assumptions change outcomes without changing saved estimates", async () => {
  const { context, page } = await newPage();
  await openApp(page);
  await page.getByRole("button", { name: "Inspect the weights" }).click();
  let incomeRisk = factorCard(page, "Unpredictable income while building a client base");
  await incomeRisk.locator(".factor-summary").click();
  await incomeRisk.locator('[data-field="probability"][data-control="number"]').fill("73");
  const baselineScore = await page.locator("#expected-score").textContent();
  const serializedEstimate = await page.evaluate(() => localStorage.getItem("procon:prototype:v1"));
  const scenarioScores = [];

  for (const [mode, effectiveProbability] of [["false", 0], ["true", 1]]) {
    incomeRisk = factorCard(page, "Unpredictable income while building a client base");
    const radio = incomeRisk.getByRole("radio", { name: `Assume ${mode}` });
    await radio.check();
    assert.equal(await radio.evaluate((node) => node === document.activeElement), true);

    assert.equal(await page.locator("#scenario-strip").isVisible(), true);
    assert.match(await page.locator("#scenario-summary").textContent(), /1 assumption.*from the saved estimate/);
    assert.equal(await page.locator("#mobile-balance-scenario").isVisible(), false);
    scenarioScores.push(await page.locator("#expected-score").textContent());
    assert.notEqual(scenarioScores.at(-1), baselineScore);
    incomeRisk = factorCard(page, "Unpredictable income while building a client base");
    assert.match(await incomeRisk.locator('[data-role="scenario-note"]').textContent(), /Saved estimate remains 73%/);

    const legendItem = page.locator('#mobile-balance-legend [data-factor-id="factor-income-variance"]');
    assert.equal(await legendItem.getAttribute("data-mode"), mode);
    assert.equal(Number(await legendItem.getAttribute("data-effective-probability")), effectiveProbability);
    assert.equal(await legendItem.evaluate((item) => item.classList.contains("has-scenario")), true);
    assert.match(
      await legendItem.locator(".balance-legend-copy small").textContent(),
      new RegExp(`assumed ${mode}; saved 73%`),
    );

    for (const selector of ["#mobile-probability-balance", "#analysis-probability-balance"]) {
      const balance = page.locator(selector);
      const marker = await balance.locator('[data-factor-id="factor-income-variance"]').evaluate((group) => {
        const activeMass = group.querySelector(".balance-mass");
        const activeLine = group.querySelector(".balance-connector");
        const savedLine = group.querySelector('[data-role="saved-position-line"]');
        const savedMass = group.querySelector('[data-role="saved-position-mass"]');
        const svg = group.closest("svg");
        const pivot = svg.querySelector(".balance-pivot-pin");
        const beam = svg.querySelector('[data-role="active-beam"]');
        const numberAttribute = (node, name) => Number(node.getAttribute(name));
        return {
          mode: group.dataset.mode,
          effectiveProbability: Number(group.dataset.effectiveProbability),
          scenarioMass: activeMass.classList.contains("is-scenario"),
          scenarioConnector: activeLine.classList.contains("is-scenario"),
          activeAnchor: {
            x: numberAttribute(activeLine, "x1"),
            y: numberAttribute(activeLine, "y1"),
          },
          pivot: {
            x: numberAttribute(pivot, "cx"),
            y: numberAttribute(pivot, "cy"),
          },
          conEndpoint: {
            x: numberAttribute(beam, "x1"),
            y: numberAttribute(beam, "y1"),
          },
          savedProbability: Number(savedLine.dataset.savedProbability),
          savedLineX: numberAttribute(savedLine, "x1"),
          savedMassX: numberAttribute(savedMass, "cx"),
          activeRadius: numberAttribute(activeMass, "r"),
          savedRadius: numberAttribute(savedMass, "r"),
          ghostBeams: svg.querySelectorAll('[data-role="saved-beam"]').length,
          savedOutcomes: svg.querySelectorAll('[data-role="saved-outcome"]').length,
        };
      });
      assert.equal(marker.mode, mode);
      assert.equal(marker.effectiveProbability, effectiveProbability);
      assert.equal(marker.scenarioMass, true);
      assert.equal(marker.scenarioConnector, true);
      assertClose(marker.savedProbability, 0.73, 1e-12, `${selector} saved probability`);
      assertClose(marker.savedLineX, marker.savedMassX, 1e-10, `${selector} saved marker x`);
      assertClose(marker.activeRadius, marker.savedRadius, 1e-10, `${selector} scenario keeps mass`);
      assert.equal(marker.ghostBeams, 1);
      assert.ok(marker.savedOutcomes > 0);
      const expectedAnchor = mode === "false" ? marker.pivot : marker.conEndpoint;
      assertClose(marker.activeAnchor.x, expectedAnchor.x, 1e-7, `${selector} ${mode} anchor x`);
      assertClose(marker.activeAnchor.y, expectedAnchor.y, 1e-7, `${selector} ${mode} anchor y`);
      assert.ok(Math.abs(marker.savedLineX - marker.activeAnchor.x) > 1);
    }

    assert.equal(
      await page.evaluate(() => localStorage.getItem("procon:prototype:v1")),
      serializedEstimate,
    );
  }
  assert.notEqual(scenarioScores[0], scenarioScores[1]);

  await page.getByRole("navigation", { name: "Current section" })
    .getByRole("button", { name: /Decision overview/ })
    .click();
  assert.equal(await page.locator("#mobile-balance-scenario").isVisible(), true);
  await page.locator("#mobile-balance-scenario").getByRole("button", { name: "Clear assumptions" }).click();
  assert.equal(await page.locator("#mobile-balance-scenario").isHidden(), true);
  assert.equal(await page.locator("#scenario-strip").isHidden(), true);
  assert.equal(await page.locator("#expected-score").textContent(), baselineScore);
  assert.equal(await page.evaluate(() => localStorage.getItem("procon:prototype:v1")), serializedEstimate);

  assert.doesNotMatch(serializedEstimate, /scenario|override|assumed/i);
  const saved = JSON.parse(serializedEstimate);
  assert.equal(
    saved.decision.options[0].factors.find((factor) => factor.id === "factor-income-variance").probability,
    73,
  );

  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#scenario-strip").isHidden(), true);
  assert.equal(await page.locator("#expected-score").textContent(), baselineScore);
  await context.close();
});

check("a consequence can be added and edited from the phone flow", async () => {
  const { context, page } = await newPage();
  await openApp(page);
  await page.getByRole("button", { name: "Inspect the weights" }).click();
  await page.getByRole("button", { name: "Add a consequence" }).click();
  const dialog = page.getByRole("dialog", { name: /Add a consequence/ });
  assert.equal(await dialog.isVisible(), true);
  await dialog.getByLabel("What might happen?").fill("A client refers steady follow-on work");
  await dialog.getByRole("radio", { name: /Supports/ }).check();
  await dialog.getByLabel("Personal importance from 1 to 10").fill("9");
  await dialog.getByLabel("Probability from 0 to 100 percent").fill("60");
  await dialog.getByRole("button", { name: "Save consequence" }).click();

  await page.locator("#factor-count").filter({ hasText: "11 factors" }).waitFor();
  const added = factorCard(page, "A client refers steady follow-on work");
  assert.equal(await added.count(), 1);
  assert.equal(await added.locator('[data-field="weight"][data-control="number"]').inputValue(), "9");
  assert.equal(await added.locator('[data-field="probability"][data-control="number"]').inputValue(), "60");
  await context.close();
});

check("additional options get isolated ledgers and appear in comparison", async () => {
  const { context, page } = await newPage({ width: 1024, height: 900 });
  await openApp(page);
  await page.getByRole("button", { name: "Add an option" }).click();
  let dialog = page.getByRole("dialog", { name: "Add an option" });
  await dialog.getByLabel("Option name").fill("Freelance part-time first");
  await dialog.getByRole("button", { name: "Add option" }).click();

  assert.equal(await page.locator("#selected-option").textContent(), "Freelance part-time first");
  assert.equal(await page.locator("#factor-count").textContent(), "0 factors");
  assert.equal(await page.locator("#expected-score").textContent(), "0");
  assert.match(await page.locator("#option-comparison").textContent(), /Yes/);
  assert.match(await page.locator("#option-comparison").textContent(), /Freelance part-time first/);

  await page.getByRole("button", { name: "Rename Freelance part-time first" }).click();
  dialog = page.getByRole("dialog", { name: /Rename Freelance part-time first/ });
  await dialog.getByLabel("Option name").fill("Transition gradually");
  await dialog.getByRole("button", { name: "Save name" }).click();
  assert.equal(await page.locator("#selected-option").textContent(), "Transition gradually");

  await page.getByRole("button", { name: /Rename baseline option No/ }).click();
  dialog = page.getByRole("dialog", { name: "Rename the baseline" });
  await dialog.getByLabel("Option name").fill("Stay employed");
  await dialog.getByRole("button", { name: "Save baseline" }).click();
  assert.match(await page.locator("#baseline-option").textContent(), /Stay employed is the baseline/);
  await context.close();
});

check("phone, iPad, and desktop widths stay within the viewport", async () => {
  for (const [width, height] of [[320, 760], [390, 844], [768, 1024], [1024, 900], [1440, 1000]]) {
    const { context, page } = await newPage({ width, height });
    await openApp(page);
    if (width < 760) await page.locator(".balance-manifest summary").click();
    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      regions: [
        ".app-header",
        ".assumption-mobile",
        ".balance-stage",
        "#mobile-probability-balance svg",
        "#mobile-balance-legend",
        ".decision-region",
        ".analysis-panel",
        ".factors-panel",
      ]
        .map((selector) => document.querySelector(selector).getBoundingClientRect())
        .map((rect) => ({ left: rect.left, right: rect.right })),
    }));
    assert.equal(geometry.viewport, width);
    assert.ok(geometry.documentWidth <= width + 1, `${width}px document width ${geometry.documentWidth}`);
    assert.ok(geometry.bodyWidth <= width + 1, `${width}px body width ${geometry.bodyWidth}`);
    for (const region of geometry.regions) {
      assert.ok(region.left >= -1, `${width}px region starts at ${region.left}`);
      assert.ok(region.right <= width + 1, `${width}px region ends at ${region.right}`);
    }

    if (width === 320) {
      assert.equal(
        await page.locator(".factor-summary-copy strong").first().evaluate((node) => getComputedStyle(node).whiteSpace),
        "normal",
      );
      await page.getByRole("button", { name: "Inspect the weights" }).click();
      await page.getByRole("button", { name: "Add a consequence" }).click();
      const rect = await page.getByRole("dialog", { name: /Add a consequence/ }).evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      });
      assert.ok(rect.left >= -1);
      assert.ok(rect.right <= width + 1);
    }
    await context.close();
  }
});

check("phone Assumption Mobile explains the model and opens focused editors", async () => {
  const { context, page } = await newPage({ width: 390, height: 844 });
  await openApp(page);

  const brief = page.locator("#mobile-decision-brief");
  const nav = page.getByRole("navigation", { name: "Current section" });
  assert.equal(await brief.isVisible(), true);
  assert.equal(await nav.isHidden(), true);
  assert.match(await brief.locator("#mobile-brief-question").textContent(), /Quit my job/);
  assert.match(await brief.locator("#mobile-brief-comparison").textContent(), /Yes.*No/);
  assert.match(await brief.locator("#mobile-brief-reading").textContent(), /side against Yes hangs lower/);
  assert.equal(await brief.locator("#mobile-probability-balance").getAttribute("data-state"), "negative");
  assert.equal(await brief.locator("#mobile-probability-balance .balance-weight").count(), 10);
  assert.equal(await brief.locator("#mobile-balance-legend .balance-legend-item").count(), 10);
  assert.equal(await brief.locator(".balance-manifest").getAttribute("open"), null);
  assert.match(await brief.locator("#mobile-support-total").textContent(), /^\+/);
  assert.match(await brief.locator("#mobile-against-total").textContent(), /^−/);
  assert.equal(await page.locator("#decision-region").isVisible(), false);
  assert.equal(await page.locator("#analysis-panel").isVisible(), false);

  await brief.getByRole("button", { name: "Change the decision" }).click();
  assert.equal(await nav.isVisible(), true);
  assert.match(await page.locator("#mobile-view-title").textContent(), /Change the decision/);
  await waitForFocus(page, "#decision-heading");
  assert.equal(await page.locator("#decision-region").isVisible(), true);
  assert.equal(await page.locator("#factors-panel").isVisible(), false);
  await page.locator("#decision-title").fill("Should I make the change?");

  await nav.getByRole("button", { name: /Decision overview/ }).click();
  await waitForFocus(page, "#mobile-brief-question");
  assert.equal(await brief.locator("#mobile-brief-question").textContent(), "Should I make the change?");
  const supportBefore = await page.locator("#mobile-support-total").textContent();
  await brief.getByRole("button", { name: "Inspect the weights" }).click();
  await waitForFocus(page, "#factors-heading");
  const first = page.locator(".factor-card").first();
  await first.locator(".factor-summary").click();
  await first.locator('[data-field="weight"][data-control="number"]').fill("10");
  await first.locator('[data-field="probability"][data-control="number"]').fill("100");
  await nav.getByRole("button", { name: /Decision overview/ }).click();
  assert.notEqual(await page.locator("#mobile-support-total").textContent(), supportBefore);

  await brief.getByRole("button", { name: "See every outcome" }).click();
  await waitForFocus(page, "#analysis-heading");
  assert.equal(await page.locator("#analysis-panel").isVisible(), true);
  assert.equal(await page.locator("#decision-region").isVisible(), false);

  await page.setViewportSize({ width: 1024, height: 900 });
  assert.equal(await nav.isVisible(), false);
  assert.equal(await brief.isVisible(), true);
  assert.equal(await page.locator("#decision-region").isVisible(), true);
  assert.equal(await page.locator("#factors-panel").isVisible(), true);
  assert.equal(await page.locator("#analysis-panel").isVisible(), true);
  await context.close();
});

check("Assumption Mobile distinguishes empty, inactive, balanced, and tilted states", async () => {
  const cases = [
    {
      name: "empty",
      factors: [],
      reading: /beam is empty/i,
      score: "0",
      state: "empty",
    },
    {
      name: "inactive",
      factors: [
        { id: "parked", label: "A possible upside", type: "pro", weight: 5, probability: 0 },
      ],
      reading: /parked at the pivot/,
      score: "0",
      state: "inactive",
    },
    {
      name: "balanced",
      factors: [
        { id: "plus-one", label: "A small upside", type: "pro", weight: 1, probability: 10 },
        { id: "plus-two", label: "Another upside", type: "pro", weight: 1, probability: 20 },
        { id: "minus-three", label: "An equal downside", type: "con", weight: 1, probability: 30 },
      ],
      reading: /machine holds level/,
      score: "0",
      state: "balanced",
    },
    {
      name: "positive",
      factors: [
        { id: "positive", label: "A likely upside", type: "pro", weight: 2, probability: 50 },
      ],
      reading: /Yes side hangs lower/,
      score: "+1",
      state: "positive",
    },
    {
      name: "negative",
      factors: [
        { id: "negative", label: "A likely downside", type: "con", weight: 2, probability: 50 },
      ],
      reading: /side against Yes hangs lower/,
      score: "−1",
      state: "negative",
    },
  ];

  for (const testCase of cases) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await routeLocalAssets(context);
    await context.addInitScript(({ factors }) => {
      localStorage.setItem("procon:prototype:v1", JSON.stringify({
        schemaVersion: 1,
        decision: {
          schemaVersion: 1,
          id: "decision-brief-state",
          question: "Should I choose this?",
          baselineLabel: "No",
          selectedOptionId: "option-yes",
          options: [{ id: "option-yes", name: "Yes", factors }],
        },
      }));
    }, { factors: testCase.factors });
    const page = await context.newPage();
    await page.goto(baseUrl.href, { waitUntil: "networkidle" });
    assert.match(
      await page.locator("#mobile-brief-reading").textContent(),
      testCase.reading,
      `${testCase.name} reading`,
    );
    assert.equal(await page.locator("#expected-score").textContent(), testCase.score);
    const snapshot = await balanceSnapshot(page.locator("#mobile-probability-balance"));
    assert.equal(snapshot.state, testCase.state);
    assert.equal(snapshot.svgState, testCase.state);
    assert.equal(snapshot.weights.length, testCase.factors.length);
    assert.equal(
      await page.locator("#mobile-balance-legend .balance-legend-item").count(),
      testCase.factors.length,
    );
    if (testCase.name === "empty") {
      assert.equal(snapshot.angle, 0);
      assert.equal(snapshot.emptyCopy, "Add your first consequence");
      assert.equal(await page.locator("#mobile-balance-legend .balance-legend-empty").count(), 1);
    }
    if (testCase.name === "inactive") {
      assert.equal(snapshot.angle, 0);
      assert.equal(snapshot.emptyCopy, null);
      assertClose(snapshot.weights[0].connector.x1, snapshot.pivot.x, 1e-10, "inactive pivot x");
      assertClose(snapshot.weights[0].connector.y1, snapshot.pivot.y, 1e-10, "inactive pivot y");
    }
    if (testCase.name === "balanced") {
      assert.equal(snapshot.angle, 0);
      assert.equal(await page.locator("#mobile-support-total").textContent(), "+0.3");
      assert.equal(await page.locator("#mobile-against-total").textContent(), "−0.3");
    }
    if (testCase.name === "positive") {
      assert.ok(snapshot.angle > 0);
      assert.ok(snapshot.beam.right.y > snapshot.pivot.y);
    }
    if (testCase.name === "negative") {
      assert.ok(snapshot.angle < 0);
      assert.ok(snapshot.beam.left.y > snapshot.pivot.y);
    }
    await context.close();
  }
});

check("keyboard, labels, reduced motion, and mobile analysis controls remain usable", async () => {
  const { context, page } = await newPage({ reducedMotion: "reduce" });
  await openApp(page);
  await page.waitForTimeout(20);
  assert.equal(await page.evaluate(() => document.getAnimations()
    .filter((animation) => animation.playState === "running"
      && animation.effect?.target?.closest?.(".probability-balance")).length), 0);
  const duplicateIds = await page.locator("[id]").evaluateAll((nodes) => {
    const counts = new Map();
    for (const node of nodes) counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
    return [...counts].filter(([, count]) => count > 1);
  });
  assert.deepEqual(duplicateIds, []);

  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".skip-link").evaluate((node) => node === document.activeElement), true);
  assert.equal(await page.locator(".skip-link").isVisible(), true);

  const unnamedButtons = await page.locator("button").evaluateAll((buttons) => buttons
    .filter((button) => !button.hidden && getComputedStyle(button).display !== "none")
    .filter((button) => !(button.getAttribute("aria-label") || button.textContent.trim()))
    .map((button) => button.outerHTML));
  assert.deepEqual(unnamedButtons, []);

  await page.getByRole("button", { name: "Inspect the weights" }).click();
  const first = page.locator(".factor-card").first();
  await first.locator(".factor-summary").click();
  const unlabeledInputs = await first.locator("input").evaluateAll((inputs) => inputs
    .filter((input) => input.labels.length === 0 && !input.getAttribute("aria-label"))
    .map((input) => input.outerHTML));
  assert.deepEqual(unlabeledInputs, []);

  await first.getByRole("radio", { name: /Counts against/ }).click();
  const moved = factorCard(page, "More control over how I spend my working time");
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll(".factor-card")]
      .find((candidate) => candidate.dataset.factorId === "factor-autonomy");
    return card?.querySelector('[data-field="type"][value="con"]') === document.activeElement;
  });
  assert.equal(await moved.getByRole("radio", { name: /Counts against/ }).isChecked(), true);

  const toggle = page.locator("#analysis-toggle");
  await page.getByRole("navigation", { name: "Current section" })
    .getByRole("button", { name: /Decision overview/ })
    .click();
  await page.getByRole("button", { name: "See every outcome" }).click();
  assert.equal((await toggle.textContent()).trim(), "Open full analysis");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#analysis-details-content").isVisible(), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
  await page.waitForTimeout(20);
  assert.equal(await page.evaluate(() => document.getAnimations()
    .filter((animation) => animation.playState === "running"
      && animation.effect?.target?.closest?.(".probability-balance")).length), 0);
  await context.close();
});

check("ProCon stays absent from visible portal navigation", async () => {
  const { context, page } = await newPage({ width: 1024, height: 900 });
  const root = new URL("/", baseUrl);
  await page.goto(root.href, { waitUntil: "networkidle" });
  assert.equal(await page.locator('a[href*="procon"]').count(), 0);
  const catalog = await page.evaluate(async () => (await fetch("/wonderlab/catalog.js")).text());
  assert.doesNotMatch(catalog, /procon/i);
  await context.close();
});

check("local asset routing rejects symlink escapes", async () => {
  if (!assetRoot) return;
  const temporaryParent = await mkdtemp(path.join(os.tmpdir(), "procon-assets-"));
  const temporaryRoot = path.join(temporaryParent, "root");
  const outsideFile = path.join(temporaryParent, "outside.txt");
  await mkdir(temporaryRoot);
  await writeFile(outsideFile, "outside the declared asset root", "utf8");
  await symlink(outsideFile, path.join(temporaryRoot, "escape.txt"));

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await routeLocalAssets(context, temporaryRoot);
    const page = await context.newPage();
    await assert.rejects(
      page.goto(new URL("escape.txt", baseUrl).href),
      /ERR_(?:ACCESS_DENIED|FAILED)/,
    );
  } finally {
    await context.close();
    await rm(temporaryParent, { recursive: true, force: true });
  }
});

check("unavailable or failed browser storage never produces a false saved status", async () => {
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await routeLocalAssets(context);
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    const page = await context.newPage();
    await page.goto(baseUrl.href, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#storage-status").textContent(), "Browser storage unavailable");

    await page.getByRole("button", { name: "Change the decision" }).click();
    await page.getByRole("button", { name: "Add an option" }).click();
    const dialog = page.getByRole("dialog", { name: "Add an option" });
    await dialog.getByLabel("Option name").fill("Storage test");
    await dialog.getByRole("button", { name: "Add option" }).click();
    assert.equal(await page.locator("#storage-status").textContent(), "Could not save on this device");
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await routeLocalAssets(context);
    await context.addInitScript(() => {
      Storage.prototype.setItem = function setItem() {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    const page = await context.newPage();
    await page.goto(baseUrl.href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Change the decision" }).click();
    await page.locator("#decision-title").fill("This cannot be stored");
    assert.equal(await page.locator("#storage-status").textContent(), "Could not save on this device");

    await page.getByRole("button", { name: "Add an option" }).click();
    const dialog = page.getByRole("dialog", { name: "Add an option" });
    await dialog.getByLabel("Option name").fill("Still not stored");
    await dialog.getByRole("button", { name: "Add option" }).click();
    assert.equal(await page.locator("#storage-status").textContent(), "Could not save on this device");
    await context.close();
  }
});

async function run() {
  browser = await browserType.launch({ headless: true });
  let failures = 0;
  for (const { name, run: execute } of checks) {
    const started = performance.now();
    try {
      await execute();
      console.log(`PASS ${name} (${Math.round(performance.now() - started)}ms)`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error?.stack ?? error);
    }
  }
  await browser.close();
  console.log(`\n${checks.length - failures}/${checks.length} ProCon browser checks passed at ${baseUrl.href}`);
  if (failures) process.exitCode = 1;
}

run().catch(async (error) => {
  console.error(error?.stack ?? error);
  await browser?.close();
  process.exitCode = 1;
});
