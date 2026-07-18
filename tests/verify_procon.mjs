import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const baseUrl = new URL(process.env.PROCON_BASE_URL || "http://127.0.0.1:4179/procon/");
const browserType = process.env.PROCON_BROWSER === "webkit" ? webkit : chromium;
const checks = [];
let browser;

function check(name, run) {
  checks.push({ name, run });
}

async function newPage({ width = 390, height = 844, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  const page = await context.newPage();
  return { context, page };
}

async function openApp(page) {
  const response = await page.goto(baseUrl.href, { waitUntil: "networkidle" });
  assert.equal(response?.ok(), true);
  await page.locator("#factor-count").filter({ hasText: "10 factors" }).waitFor();
}

function factorCard(page, label) {
  return page.locator(".factor-card").filter({ hasText: label }).first();
}

check("starter model renders a truthful live probability map", async () => {
  const { context, page } = await newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await openApp(page);
  assert.equal(await page.title(), "ProCon · Decision workbench");
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow, noarchive");
  assert.equal(await page.locator("#decision-title").inputValue(), "Quit my job and start working freelance, using AI?");
  assert.equal(await page.locator(".factor-card").count(), 10);
  assert.equal(await page.locator("#expected-score").textContent(), "−4.8");
  assert.match(await page.locator("#chance-positive").textContent(), /%$/);
  assert.match(await page.locator("#likely-range").textContent(), /to/);
  assert.ok(await page.locator("#trace-distribution-layer rect").count() > 5);
  assert.equal(await page.locator("#trace-empty-label").isVisible(), false);
  assert.equal(await page.locator("#scenario-strip").isHidden(), true);
  assert.match(await page.locator("#model-note").textContent(), /not objective probabilities/i);
  assert.deepEqual(errors, []);
  await context.close();
});

check("weights and probabilities update the tally live and persist locally", async () => {
  const { context, page } = await newPage();
  await openApp(page);
  const before = await page.locator("#expected-score").textContent();
  const autonomy = factorCard(page, "More control over how I spend my working time");
  await autonomy.locator(".factor-summary").click();
  await autonomy.locator('[data-field="weight"][data-control="number"]').fill("10");
  await autonomy.locator('[data-field="probability"][data-control="number"]').fill("100");

  assert.equal(await autonomy.locator('[data-field="weight"][data-control="range"]').inputValue(), "10");
  assert.equal(await autonomy.locator('[data-field="probability"][data-control="range"]').inputValue(), "100");
  assert.notEqual(await page.locator("#expected-score").textContent(), before);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("procon:prototype:v1")));
  const savedFactor = saved.decision.options[0].factors.find((factor) => factor.id === "factor-autonomy");
  assert.equal(savedFactor.weight, 10);
  assert.equal(savedFactor.probability, 100);

  await page.reload({ waitUntil: "networkidle" });
  const restored = factorCard(page, "More control over how I spend my working time");
  await restored.locator(".factor-summary").click();
  assert.equal(await restored.locator('[data-field="weight"][data-control="number"]').inputValue(), "10");
  assert.equal(await restored.locator('[data-field="probability"][data-control="number"]').inputValue(), "100");
  await context.close();
});

check("what-if assumptions change outcomes without changing saved estimates", async () => {
  const { context, page } = await newPage();
  await openApp(page);
  let incomeRisk = factorCard(page, "Unpredictable income while building a client base");
  await incomeRisk.locator(".factor-summary").click();
  await incomeRisk.locator('[data-field="probability"][data-control="number"]').fill("73");
  const baselineScore = await page.locator("#expected-score").textContent();
  await incomeRisk.getByRole("radio", { name: "Assume false" }).check();
  assert.equal(
    await incomeRisk.getByRole("radio", { name: "Assume false" }).evaluate((node) => node === document.activeElement),
    true,
  );

  assert.equal(await page.locator("#scenario-strip").isVisible(), true);
  assert.match(await page.locator("#scenario-summary").textContent(), /1 assumption.*from the saved estimate/);
  assert.notEqual(await page.locator("#expected-score").textContent(), baselineScore);
  incomeRisk = factorCard(page, "Unpredictable income while building a client base");
  assert.match(await incomeRisk.locator('[data-role="scenario-note"]').textContent(), /Saved estimate remains 73%/);

  const serialized = await page.evaluate(() => localStorage.getItem("procon:prototype:v1"));
  assert.doesNotMatch(serialized, /scenario|override|assumed/i);
  const saved = JSON.parse(serialized);
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
    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      regions: [".app-header", ".decision-region", ".analysis-panel", ".factors-panel"]
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

check("keyboard, labels, reduced motion, and mobile analysis controls remain usable", async () => {
  const { context, page } = await newPage({ reducedMotion: "reduce" });
  await openApp(page);
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

  const first = page.locator(".factor-card").first();
  await first.locator(".factor-summary").click();
  const unlabeledInputs = await first.locator("input").evaluateAll((inputs) => inputs
    .filter((input) => input.labels.length === 0 && !input.getAttribute("aria-label"))
    .map((input) => input.outerHTML));
  assert.deepEqual(unlabeledInputs, []);

  await first.getByRole("radio", { name: /Counts against/ }).click();
  const moved = factorCard(page, "More control over how I spend my working time");
  assert.equal(
    await moved.getByRole("radio", { name: /Counts against/ }).evaluate((node) => node === document.activeElement),
    true,
  );

  const toggle = page.locator("#analysis-toggle");
  assert.equal((await toggle.textContent()).trim(), "Open full analysis");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#analysis-details-content").isVisible(), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
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
