import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  APPS,
  CATEGORIES,
  CATEGORY_ORDER,
  appById,
  appsIn,
  validateCatalog
} from '../wonderlab/catalog.js';
import { createSelectionState } from '../wonderlab/state.js';
import { linkMode, resolveAppUrl, resolveOrbitUrl } from '../wonderlab/url-resolver.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = value => new URL(value);

test('the catalog has the agreed fifteen destinations and category balance', () => {
  assert.equal(validateCatalog(), true);
  assert.equal(APPS.length, 15);
  assert.equal(new Set(APPS.map(app => app.id)).size, APPS.length);
  assert.deepEqual(CATEGORY_ORDER, ['games', 'tools', 'tabletop', 'work']);
  assert.deepEqual(
    Object.fromEntries(CATEGORY_ORDER.map(category => [category, appsIn(category).length])),
    { games: 7, tools: 2, tabletop: 5, work: 1 }
  );

  assert.deepEqual(
    Object.fromEntries(APPS.map(app => [app.id, app.name])),
    {
      'dungeon-desk': 'Dungeon Desk',
      'neon-cycle-grid': 'Neon Cycle Grid',
      clawdtris: 'Clawdtris',
      'one-bullet-dungeon': 'One Bullet Dungeon',
      'orbital-slingshot': 'Orbital Slingshot',
      'circuit-snap': 'Circuit Snap',
      hex: 'Hex',
      'mission-control': 'Mission Control',
      'decision-please': 'Decision Please',
      'rpg-library': 'RPG Library',
      'ypsilon-overkill': 'Ypsilon Overkill',
      'marvel-champions': 'Marvel Champions Runner',
      'wasteland-map': 'Wasteland Terminal Map',
      foundry: 'Foundry VTT',
      eems: 'EEMS'
    }
  );

  for (const app of APPS) {
    assert.equal(appById(app.id), app);
    assert.ok(CATEGORIES[app.category], `${app.id} has a known category`);
    assert.ok(app.localPort || app.publicUrl, `${app.id} has at least one route`);
    assert.ok(app.kind.trim(), `${app.id} has a kind`);
    assert.ok(app.summary.trim(), `${app.id} has a summary`);
  }
  assert.equal(appById('not-an-app'), null);
});

test('captured previews have complete, non-empty 640px and 1280px WebP variants', () => {
  const appsWithoutPreview = APPS.filter(app => !app.preview).map(app => app.id);
  assert.deepEqual(appsWithoutPreview, ['mission-control', 'ypsilon-overkill', 'foundry', 'eems']);

  for (const app of APPS.filter(app => app.preview)) {
    assert.match(app.preview.src, /^\/wonderlab\/assets\/previews\/[a-z0-9-]+-1280\.webp$/);
    assert.ok(app.preview.width > 0 && app.preview.height > 0, `${app.id} declares image dimensions`);

    const variants = app.preview.srcset.split(',').map(candidate => candidate.trim().split(/\s+/));
    assert.deepEqual(variants.map(([, width]) => width), ['640w', '1280w']);
    assert.equal(variants[1][0], app.preview.src);

    for (const [source] of variants) {
      const file = join(repositoryRoot, source.slice(1));
      assert.equal(existsSync(file), true, `${source} exists`);
      assert.ok(statSync(file).size > 0, `${source} is not empty`);
    }
  }
});

test('link mode follows the host and allows an explicit query-string override', () => {
  assert.equal(linkMode(at('https://worldwidesam.net/')), 'public');
  assert.equal(linkMode(at('https://portal.worldwidesam.net/')), 'public');
  assert.equal(linkMode(at('http://127.0.0.1:4179/')), 'local');
  assert.equal(linkMode(at('http://workstation.local:4179/')), 'local');
  assert.equal(linkMode(at('http://127.0.0.1:4179/?links=public')), 'public');
  assert.equal(linkMode(at('https://worldwidesam.net/?links=local')), 'local');
  assert.equal(linkMode(at('https://worldwidesam.net/?links=unknown')), 'public');
});

test('public routes preserve external URLs, root-relative routes, and local-only state', () => {
  const publicLocation = at('https://worldwidesam.net/');
  assert.equal(resolveAppUrl(appById('clawdtris'), publicLocation), 'https://tetris.worldwidesam.net/');
  assert.equal(resolveAppUrl(appById('wasteland-map'), publicLocation), 'https://worldwidesam.net/wasteland-terminal-map/');
  assert.equal(resolveAppUrl(appById('dungeon-desk'), publicLocation), null);
  assert.equal(resolveAppUrl(appById('neon-cycle-grid'), publicLocation), null);
  assert.equal(resolveOrbitUrl(publicLocation), 'https://worldwidesam.net/orbit/');
});

test('local routes use the current machine hostname and each destination port', () => {
  const lanLocation = at('http://192.168.1.99:4179/wonderlab/');
  assert.equal(resolveAppUrl(appById('dungeon-desk'), lanLocation), 'http://192.168.1.99:5174/');
  assert.equal(resolveAppUrl(appById('neon-cycle-grid'), lanLocation), 'http://192.168.1.99:4323/g/neon-cycle-grid/');
  assert.equal(resolveAppUrl(appById('decision-please'), lanLocation), 'http://192.168.1.99:5178/');
  assert.equal(resolveAppUrl(appById('wasteland-map'), lanLocation), 'http://192.168.1.99:4179/wasteland-terminal-map/');
  assert.equal(resolveOrbitUrl(lanLocation), 'http://192.168.1.99:4179/orbit/');

  const loopbackLocation = at('http://localhost:4179/');
  assert.equal(resolveAppUrl(appById('dungeon-desk'), loopbackLocation), 'http://127.0.0.1:5174/');
  assert.equal(resolveAppUrl(appById('neon-cycle-grid'), loopbackLocation), 'http://127.0.0.1:4323/g/neon-cycle-grid/');
  assert.equal(resolveOrbitUrl(loopbackLocation), 'http://localhost:4179/orbit/');
});

test('IPv6 loopback is normalized to a valid local destination URL', () => {
  const ipv6Loopback = at('http://[::1]:4179/');
  assert.equal(resolveAppUrl(appById('dungeon-desk'), ipv6Loopback), 'http://127.0.0.1:5174/');
  assert.equal(resolveAppUrl(appById('neon-cycle-grid'), ipv6Loopback), 'http://127.0.0.1:4323/g/neon-cycle-grid/');
  assert.equal(resolveOrbitUrl(ipv6Loopback), 'http://[::1]:4179/orbit/');
});

test('selection state accepts direct hashes and canonicalizes invalid initial hashes', () => {
  const direct = createSelectionState('#marvel-champions');
  assert.equal(direct.currentApp().id, 'marvel-champions');
  assert.equal(direct.state.category, 'tabletop');
  assert.equal(direct.state.invalidInitialHash, false);

  const invalid = createSelectionState('#does-not-exist');
  assert.equal(invalid.currentApp().id, 'dungeon-desk');
  assert.equal(invalid.state.category, 'games');
  assert.equal(invalid.state.invalidInitialHash, true);

  const empty = createSelectionState('');
  assert.equal(empty.currentApp().id, 'dungeon-desk');
  assert.equal(empty.state.invalidInitialHash, false);
});

test('selection state remembers a category selection and wraps arrow movement', () => {
  const selection = createSelectionState('#dungeon-desk');

  assert.equal(selection.move(-1).id, 'hex');
  assert.equal(selection.move(1).id, 'dungeon-desk');
  assert.equal(selection.selectApp('clawdtris').id, 'clawdtris');
  assert.equal(selection.selectCategory('tools').id, 'mission-control');
  assert.equal(selection.selectApp('decision-please').id, 'decision-please');
  assert.equal(selection.selectCategory('games').id, 'clawdtris');
  assert.equal(selection.selectCategory('tools').id, 'decision-please');

  const snapshot = { ...selection.state };
  assert.equal(selection.selectCategory('not-a-category'), null);
  assert.equal(selection.selectApp('not-an-app'), null);
  assert.deepEqual(selection.state, snapshot);
});
