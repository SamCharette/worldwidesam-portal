import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.WONDERLAB_BASE_URL || 'http://127.0.0.1:4179/');
const widthMatrix = [320, 360, 390, 768, 899, 901, 920, 960, 1024, 1366, 1600];
const checks = [];
let browser;

function candidateUrl({ hash = '', search = '' } = {}) {
  const url = new URL(baseUrl);
  url.search = search;
  url.hash = hash;
  return url.href;
}

function check(name, run) {
  checks.push({ name, run });
}

async function waitForApp(page, appId, title) {
  await page.waitForFunction(
    ({ expectedHash, expectedTitle }) => location.hash === expectedHash && document.querySelector('#appTitle')?.textContent === expectedTitle,
    { expectedHash: `#${appId}`, expectedTitle: title }
  );
}

async function newPage(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    ...options
  });
  const page = await context.newPage();
  return { context, page };
}

check('initial render loads exactly one selected preview', async () => {
  const { context, page } = await newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const previewRequests = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (/\/wonderlab\/assets\/previews\//.test(request.url())) previewRequests.push(request.url());
  });

  const response = await page.goto(candidateUrl(), { waitUntil: 'networkidle' });
  assert.equal(response?.ok(), true);
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');
  await page.locator('#appImage').evaluate(image => image.decode());

  assert.equal(await page.title(), 'Worldwide Sam — Saturday Wonderlab');
  assert.equal(await page.locator('.category-control').count(), 4);
  assert.equal(await page.locator('.cartridge').count(), 7);
  assert.equal(await page.locator('.category-control[aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('.cartridge[aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('#appImage').isVisible(), true);
  assert.match(await page.locator('#appImage').getAttribute('alt'), /Dungeon Desk interface/);

  const uniquePreviews = [...new Set(previewRequests.map(request => new URL(request).pathname))];
  assert.equal(uniquePreviews.length, 1, `preview requests: ${uniquePreviews.join(', ')}`);
  assert.match(uniquePreviews[0], /dungeon-desk-(640|1280)\.webp$/);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  await context.close();
});

check('directory search, filters, keyboard navigation, and history stay in sync', async () => {
  const { context, page } = await newPage();
  await page.goto(candidateUrl(), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');

  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'All experiments' });
  const search = page.getByRole('searchbox', { name: 'Find an experiment' });
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await search.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('.directory-item').count(), 18);

  await page.getByRole('button', { name: 'Tabletop', exact: true }).click();
  assert.equal(await page.locator('.directory-item').count(), 5);
  await page.getByRole('button', { name: 'Everything' }).click();
  await search.fill('emissions');
  assert.equal(await page.locator('.directory-item').count(), 1);
  await page.getByRole('button', { name: /EEMS/ }).click();
  await waitForApp(page, 'eems', 'EEMS');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await page.locator('body').getAttribute('data-category'), 'work');
  assert.equal(await page.locator('#previewMissing').isVisible(), true);
  assert.match(await page.locator('#selectionAnnouncement').textContent(), /EEMS selected/);

  await page.keyboard.press('/');
  await search.fill('definitely not an experiment');
  assert.equal(await page.locator('.directory-item').count(), 0);
  assert.equal(await page.locator('#directoryEmpty').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await search.inputValue(), '');
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await page.locator('#openDirectory').evaluate(element => element === document.activeElement), true);

  await page.keyboard.press('1');
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');
  await page.keyboard.press('ArrowLeft');
  await waitForApp(page, 'hex', 'Hex');
  await page.keyboard.press('ArrowRight');
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');
  await page.goBack();
  await waitForApp(page, 'hex', 'Hex');

  await context.close();
});

check('direct and invalid hashes produce canonical selections', async () => {
  const { context, page } = await newPage();
  const previewRequests = [];
  page.on('request', request => {
    if (/\/wonderlab\/assets\/previews\//.test(request.url())) previewRequests.push(new URL(request.url()).pathname);
  });

  await page.goto(candidateUrl({ hash: 'marvel-champions' }), { waitUntil: 'networkidle' });
  await waitForApp(page, 'marvel-champions', 'Marvel Champions Runner');
  assert.equal(await page.locator('body').getAttribute('data-category'), 'tabletop');
  assert.equal(new Set(previewRequests).size, 1);
  assert.match(previewRequests[0], /marvel-(640|1280)\.webp$/);

  await page.goto(candidateUrl({ hash: 'does-not-exist' }), { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');
  assert.equal(await page.evaluate(() => history.state?.appId), 'dungeon-desk');
  await context.close();
});

check('Enter opens only an available destination', async () => {
  const { context, page } = await newPage();
  await page.goto(candidateUrl({ search: '?links=public', hash: 'dungeon-desk' }), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');
  assert.equal(await page.locator('#launchApp').getAttribute('href'), null);
  assert.equal(await page.locator('#launchApp').getAttribute('aria-disabled'), 'true');

  await page.evaluate(() => {
    window.__wonderlabOpened = [];
    window.open = (...args) => {
      window.__wonderlabOpened.push(args);
      return null;
    };
    document.activeElement?.blur();
  });
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__wonderlabOpened.length), 0);

  await page.getByRole('button', { name: /Clawdtris/ }).click();
  await waitForApp(page, 'clawdtris', 'Clawdtris');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__wonderlabOpened.length), 1);
  assert.equal(await page.evaluate(() => window.__wonderlabOpened[0][0]), 'https://tetris.worldwidesam.net/');
  await context.close();
});

check('Neon Cycle Grid uses its standalone routes in local and public modes', async () => {
  const { context, page } = await newPage();
  await page.goto(candidateUrl({ hash: 'neon-cycle-grid' }), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'neon-cycle-grid', 'Neon Cycle Grid');
  assert.equal(
    await page.locator('#launchApp').getAttribute('href'),
    'http://127.0.0.1:4325/'
  );
  assert.equal(await page.locator('#launchApp').getAttribute('aria-disabled'), null);

  await page.goto(candidateUrl({ search: '?links=public', hash: 'neon-cycle-grid' }), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'neon-cycle-grid', 'Neon Cycle Grid');
  assert.equal(await page.locator('#launchApp').getAttribute('href'), 'https://worldwidesam.net/neon-cycle-grid/');
  assert.equal(await page.locator('#launchApp').getAttribute('aria-disabled'), null);
  await context.close();
});

check('ProCon and Idea Graph stay discoverable in Tools with their established routes', async () => {
  const { context, page } = await newPage();

  await page.goto(candidateUrl({ search: '?links=public', hash: 'procon' }), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'procon', 'ProCon');
  assert.equal(await page.locator('body').getAttribute('data-category'), 'tools');
  assert.equal(await page.locator('#launchApp').getAttribute('href'), 'https://procon.worldwidesam.net/');

  await page.goto(candidateUrl({ hash: 'idea-graph' }), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'idea-graph', 'Idea Graph');
  assert.equal(await page.locator('body').getAttribute('data-category'), 'tools');
  assert.equal(await page.locator('#launchApp').getAttribute('href'), 'http://127.0.0.1:5181/');
  assert.equal(await page.locator('#previewMissing').isVisible(), true);

  await page.goto(candidateUrl({ search: '?links=public', hash: 'idea-graph' }), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'idea-graph', 'Idea Graph');
  assert.equal(await page.locator('#launchApp').getAttribute('href'), 'https://ideagraph.worldwidesam.net/');
  await context.close();
});

check('the original Orbit fallback rebases assets and navigation to the portal root', async () => {
  const { context, page } = await newPage();
  const sameOriginFailures = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === baseUrl.origin && response.status() >= 400) {
      sameOriginFailures.push({ path: url.pathname, status: response.status() });
    }
  });

  const orbitUrl = new URL('/orbit/', baseUrl);
  const response = await page.goto(orbitUrl.href, { waitUntil: 'networkidle' });
  assert.equal(response?.ok(), true);
  assert.equal(await page.title(), 'Worldwide Sam Orbit');
  assert.equal(await page.locator('link[rel="stylesheet"]').evaluate(link => link.href), `${baseUrl.origin}/styles.css?v=16`);
  assert.equal(await page.locator('script[type="module"]').evaluate(script => script.src), `${baseUrl.origin}/app.js?v=24`);
  assert.equal(await page.locator('.sun-card img').evaluate(image => image.currentSrc), `${baseUrl.origin}/assets/clawdia-mission-hero-card.png`);
  assert.ok(await page.locator('.sun-card img').evaluate(image => image.naturalWidth > 0));
  await page.waitForFunction(() => document.querySelector('#appCount')?.textContent !== '--');
  assert.equal(await page.locator('#appCount').textContent(), '18');
  await page.getByRole('button', { name: /Tools/ }).evaluate(control => control.click());
  await page.waitForFunction(() => [...document.querySelectorAll('.planet-label')]
    .some(label => label.textContent.includes('ProCon')));
  assert.equal(await page.locator('.planet-label').filter({ hasText: 'ProCon' }).count(), 1);
  assert.equal(await page.locator('.planet-label').filter({ hasText: 'Idea Graph' }).count(), 1);
  assert.equal(await page.locator('.planet-label').filter({ hasText: 'Sudbury Regreening Time Machine' }).count(), 1);
  assert.deepEqual(sameOriginFailures, []);

  const blogUrl = await page.locator('.blog-teaser').evaluate(link => link.href);
  assert.match(new URL(blogUrl).pathname, /^\/blog\/[a-z0-9-]+\.html$/);
  await page.locator('.blog-teaser').evaluate(link => link.click());
  await page.waitForURL(blogUrl);
  assert.notEqual(await page.title(), 'Worldwide Sam Orbit');
  await context.close();
});

check('a failed preview falls back without disabling the destination', async () => {
  const { context, page } = await newPage();
  await page.route('**/wonderlab/assets/previews/**', route => route.abort('failed'));
  await page.goto(candidateUrl({ hash: 'clawdtris' }), { waitUntil: 'domcontentloaded' });
  await page.locator('#previewMissing').waitFor({ state: 'visible' });

  assert.equal(await page.locator('#appImage').isVisible(), false);
  assert.equal(await page.locator('#missingName').textContent(), 'Clawdtris');
  assert.equal(await page.locator('#displayStatus').textContent(), 'VIEW NOT CAPTURED');
  assert.ok(await page.locator('#launchApp').getAttribute('href'));
  await context.close();
});

check('the audit width matrix has no horizontal clipping and uses the compact dock at its breakpoint', async () => {
  const { context, page } = await newPage();

  for (const width of widthMatrix) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await page.goto(candidateUrl({ hash: 'wasteland-map' }), { waitUntil: 'domcontentloaded' });
    await waitForApp(page, 'wasteland-map', 'Wasteland Terminal Map');

    const geometry = await page.evaluate(() => {
      const visible = element => getComputedStyle(element).display !== 'none';
      const regions = ['.site-header', '.welcome', '#machine', '.mobile-dock']
        .map(selector => document.querySelector(selector))
        .filter(element => element && visible(element))
        .map(element => {
          const rect = element.getBoundingClientRect();
          return { className: element.className, id: element.id, left: rect.left, right: rect.right };
        });
      return {
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        regions,
        dockVisible: visible(document.querySelector('.mobile-dock'))
      };
    });

    assert.equal(geometry.viewport, width, `${width}px viewport is exact`);
    assert.ok(geometry.documentWidth <= width + 1, `${width}px document width is ${geometry.documentWidth}`);
    assert.ok(geometry.bodyWidth <= width + 1, `${width}px body width is ${geometry.bodyWidth}`);
    for (const region of geometry.regions) {
      assert.ok(region.left >= -1, `${width}px ${region.id || region.className} begins at ${region.left}`);
      assert.ok(region.right <= width + 1, `${width}px ${region.id || region.className} ends at ${region.right}`);
    }
    assert.equal(geometry.dockVisible, width <= 1060, `${width}px compact dock breakpoint`);

    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'All experiments' });
    const dialogRect = await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    assert.ok(dialogRect.left >= -1, `${width}px directory begins at ${dialogRect.left}`);
    assert.ok(dialogRect.right <= width + 1, `${width}px directory ends at ${dialogRect.right}`);
    await page.keyboard.press('Escape');
  }

  await context.close();
});

check('reduced motion removes the cartridge flight and commits immediately', async () => {
  const { context, page } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(candidateUrl(), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');

  await page.getByRole('button', { name: /Clawdtris/ }).click();
  await waitForApp(page, 'clawdtris', 'Clawdtris');
  await page.waitForTimeout(20);
  assert.equal(await page.locator('.flying-cartridge').count(), 0);
  assert.equal(await page.locator('#machine').evaluate(element => element.classList.contains('routing')), false);
  assert.equal(await page.locator('#machine').evaluate(element => element.classList.contains('cycling')), false);
  await context.close();
});

check('semantic names, dialog focus, skip navigation, and live announcements remain usable', async () => {
  const { context, page } = await newPage();
  await page.goto(candidateUrl(), { waitUntil: 'domcontentloaded' });
  await waitForApp(page, 'dungeon-desk', 'Dungeon Desk');

  const duplicateIds = await page.evaluate(() => {
    const counts = new Map();
    for (const element of document.querySelectorAll('[id]')) counts.set(element.id, (counts.get(element.id) || 0) + 1);
    return [...counts].filter(([, count]) => count > 1);
  });
  assert.deepEqual(duplicateIds, []);

  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('.skip-link').isVisible(), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#machine').evaluate(element => element === document.activeElement), true);

  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'All experiments' });
  assert.equal(await dialog.getAttribute('aria-describedby'), 'directoryHelp');
  assert.match(await page.locator('#directoryHelp').textContent(), /Search by app name/);
  assert.equal(await page.getByRole('searchbox', { name: 'Find an experiment' }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#openDirectory').evaluate(element => element === document.activeElement), true);

  const unnamedButtons = await page.locator('button').evaluateAll(buttons => buttons
    .filter(button => !button.hidden && getComputedStyle(button).display !== 'none')
    .filter(button => !(button.getAttribute('aria-label') || button.textContent.trim()))
    .map(button => button.outerHTML));
  assert.deepEqual(unnamedButtons, []);

  await page.getByRole('button', { name: /Clawdtris/ }).click();
  await waitForApp(page, 'clawdtris', 'Clawdtris');
  assert.match(await page.locator('#selectionAnnouncement').textContent(), /Clawdtris selected\. Games\. Ready to visit\./);
  assert.equal(await page.locator('#launchApp').getAttribute('aria-label'), 'Visit Clawdtris in a new tab');
  await context.close();
});

check('the no-JavaScript fallback keeps every destination discoverable', async () => {
  const { context, page } = await newPage({ javaScriptEnabled: false });
  await page.goto(candidateUrl(), { waitUntil: 'domcontentloaded' });

  const fallback = page.locator('.no-script');
  assert.equal(await fallback.isVisible(), true);
  assert.equal(await fallback.locator('li').count(), 19);
  assert.match(await fallback.textContent(), /Dungeon Desk \(local network only\)/);
  assert.equal(await fallback.locator('a[href="/neon-cycle-grid/"]').count(), 1);
  assert.equal(await fallback.locator('a[href="https://procon.worldwidesam.net/"]').count(), 1);
  assert.equal(await fallback.locator('a[href="https://ideagraph.worldwidesam.net/"]').count(), 1);
  assert.equal(await fallback.locator('a[href="https://sudburyregreening.worldwidesam.net/"]').count(), 1);
  assert.equal(await fallback.locator('a[href="https://games.worldwidesam.net/"]').count(), 0);
  assert.equal(await fallback.locator('a[href="/blog/"]').count(), 1);
  await context.close();
});

async function run() {
  browser = await chromium.launch({ headless: true });
  let failures = 0;

  for (const { name, run: execute } of checks) {
    const started = performance.now();
    try {
      await execute();
      console.log(`PASS ${name} (${Math.round(performance.now() - started)}ms)`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error?.stack || error);
    }
  }

  await browser.close();
  console.log(`\n${checks.length - failures}/${checks.length} Wonderlab browser checks passed at ${baseUrl.href}`);
  if (failures) process.exitCode = 1;
}

run().catch(async error => {
  console.error(error?.stack || error);
  await browser?.close();
  process.exitCode = 1;
});
