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
  await page.getByRole("button", { name: "Review what matters" }).click();
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
  await page.getByRole("button", { name: "Review what matters" }).click();
  const restored = factorCard(page, "More control over how I spend my working time");
  await restored.locator(".factor-summary").click();
  assert.equal(await restored.locator('[data-field="weight"][data-control="number"]').inputValue(), "10");
  assert.equal(await restored.locator('[data-field="probability"][data-control="number"]').inputValue(), "100");
  await context.close();
});

check("what-if assumptions change outcomes without changing saved estimates", async () => {
  const { context, page } = await newPage();
  await openApp(page);
  await page.getByRole("button", { name: "Review what matters" }).click();
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
  await page.getByRole("button", { name: "Review what matters" }).click();
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
      await page.getByRole("button", { name: "Review what matters" }).click();
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

check("phone decision brief explains the model and opens focused editors", async () => {
  const { context, page } = await newPage({ width: 390, height: 844 });
  await openApp(page);

  const brief = page.locator("#mobile-decision-brief");
  const nav = page.getByRole("navigation", { name: "Current section" });
  assert.equal(await brief.isVisible(), true);
  assert.equal(await nav.isHidden(), true);
  assert.match(await brief.locator("#mobile-brief-question").textContent(), /Quit my job/);
  assert.match(await brief.locator("#mobile-brief-comparison").textContent(), /Yes.*No/);
  assert.match(await brief.locator("#mobile-brief-reading").textContent(), /lean away from Yes/);
  assert.equal(await brief.locator("#mobile-brief-reasons li").count(), 3);
  assert.match(await brief.locator("#mobile-support-total").textContent(), /^\+/);
  assert.match(await brief.locator("#mobile-against-total").textContent(), /^−/);
  assert.equal(await page.locator("#decision-region").isVisible(), false);
  assert.equal(await page.locator("#analysis-panel").isVisible(), false);

  await brief.getByRole("button", { name: "Change the decision" }).click();
  assert.equal(await nav.isVisible(), true);
  assert.match(await page.locator("#mobile-view-title").textContent(), /Change the decision/);
  assert.equal(await page.locator("#decision-region").isVisible(), true);
  assert.equal(await page.locator("#factors-panel").isVisible(), false);
  await page.locator("#decision-title").fill("Should I make the change?");

  await nav.getByRole("button", { name: /Decision overview/ }).click();
  assert.equal(await brief.locator("#mobile-brief-question").textContent(), "Should I make the change?");
  const supportBefore = await page.locator("#mobile-support-total").textContent();
  await brief.getByRole("button", { name: "Review what matters" }).click();
  const first = page.locator(".factor-card").first();
  await first.locator(".factor-summary").click();
  await first.locator('[data-field="weight"][data-control="number"]').fill("10");
  await first.locator('[data-field="probability"][data-control="number"]').fill("100");
  await nav.getByRole("button", { name: /Decision overview/ }).click();
  assert.notEqual(await page.locator("#mobile-support-total").textContent(), supportBefore);

  await brief.getByRole("button", { name: "See the calculation" }).click();
  assert.equal(await page.locator("#analysis-panel").isVisible(), true);
  assert.equal(await page.locator("#decision-region").isVisible(), false);

  await page.setViewportSize({ width: 1024, height: 900 });
  assert.equal(await nav.isVisible(), false);
  assert.equal(await brief.isVisible(), false);
  assert.equal(await page.locator("#decision-region").isVisible(), true);
  assert.equal(await page.locator("#factors-panel").isVisible(), true);
  assert.equal(await page.locator("#analysis-panel").isVisible(), true);
  await context.close();
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

  await page.getByRole("button", { name: "Review what matters" }).click();
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
  await page.getByRole("navigation", { name: "Current section" })
    .getByRole("button", { name: /Decision overview/ })
    .click();
  await page.getByRole("button", { name: "See the calculation" }).click();
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
