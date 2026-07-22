import { CATEGORIES, appById, validateCatalog } from './catalog.js?v=20260720a';
import { createSelectionState } from './state.js?v=20260720a';
import { resolveAppUrl, resolveOrbitUrl } from './url-resolver.js?v=20260720a';
import {
  markSelections,
  renderApp,
  renderCategories,
  renderDirectoryFilters,
  renderDirectoryResults,
  renderExperiments
} from './render.js?v=20260720a';

validateCatalog();

const select = selector => document.querySelector(selector);
const elements = {
  machine: select('#machine'),
  categoryControls: select('#categoryControls'),
  cartridgeStack: select('#cartridgeStack'),
  magazineCount: select('#magazineCount'),
  previousApp: select('#previousApp'),
  nextApp: select('#nextApp'),
  appImage: select('#appImage'),
  previewMissing: select('#previewMissing'),
  missingName: select('#missingName'),
  displayStatus: select('#displayStatus'),
  appKind: select('#appKind'),
  screenIndex: select('#screenIndex'),
  appRoute: select('#appRoute'),
  appTitle: select('#appTitle'),
  appSummary: select('#appSummary'),
  launchApp: select('#launchApp'),
  launchHint: select('.launch-label small'),
  launchLabel: select('.launch-label b'),
  directory: select('#directory'),
  openDirectory: select('#openDirectory'),
  closeDirectory: select('#closeDirectory'),
  directorySearch: select('#directorySearch'),
  directoryFilters: select('#directoryFilters'),
  directoryResults: select('#directoryResults'),
  directoryEmpty: select('#directoryEmpty'),
  readerSlot: select('.reader-slot'),
  selectionAnnouncement: select('#selectionAnnouncement'),
  mobileAppName: select('#mobileAppName'),
  mobileLaunch: select('#mobileLaunch'),
  inspectApp: select('#inspectApp'),
  displayBay: select('.display-bay'),
  orbitLink: select('#orbitLink')
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const selection = createSelectionState(window.location.hash);
let routingTimer;
let cyclingTimer;
let flightAnimation;
let flightNode;
let directoryReturnFocus;

function pulseMachine() {
  clearTimeout(routingTimer);
  clearTimeout(cyclingTimer);
  elements.machine.classList.remove('routing', 'cycling');
  void elements.machine.offsetWidth;
  elements.machine.classList.add('routing', 'cycling');
  routingTimer = setTimeout(() => elements.machine.classList.remove('routing'), reducedMotion.matches ? 1 : 720);
  cyclingTimer = setTimeout(() => elements.machine.classList.remove('cycling'), reducedMotion.matches ? 1 : 610);
}

function feedExperiment(source) {
  flightAnimation?.cancel();
  flightNode?.remove();
  if (!source || reducedMotion.matches) return;
  const from = source.getBoundingClientRect();
  const to = elements.readerSlot.getBoundingClientRect();
  const clone = source.cloneNode(true);
  clone.classList.add('flying-cartridge');
  clone.setAttribute('aria-hidden', 'true');
  clone.tabIndex = -1;
  clone.disabled = true;
  clone.style.left = `${from.left}px`;
  clone.style.top = `${from.top}px`;
  clone.style.width = `${from.width}px`;
  clone.style.height = `${from.height}px`;
  document.body.append(clone);
  flightNode = clone;
  const translateX = to.left - from.left + 8;
  const translateY = to.top - from.top + 7;
  flightAnimation = clone.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${translateX * .16}px, ${translateY * .16}px) scale(1.02)`, opacity: 1, offset: .22 },
    { transform: `translate(${translateX}px, ${translateY}px) scale(${Math.max(.4, (to.width - 16) / from.width)}, .42)`, opacity: .82 }
  ], { duration: 260, easing: 'cubic-bezier(.2,.85,.25,1)', fill: 'forwards' });
  flightAnimation.finished.catch(() => {}).finally(() => {
    if (flightNode === clone) flightNode = null;
    clone.remove();
  });
}

function commitApp(app, { updateHash = true, animate = true, source = null, initial = false } = {}) {
  if (!app) return;
  const state = selection.state;
  document.body.dataset.category = app.category;
  markSelections(elements.machine, state);
  if (animate) {
    elements.displayStatus.textContent = 'WAKING THE VIEWER';
    feedExperiment(source || elements.cartridgeStack.querySelector(`[data-app="${app.id}"]`));
    pulseMachine();
  }
  const sequence = ++state.sequence;
  const delay = animate && !reducedMotion.matches ? 205 : 0;
  window.setTimeout(() => {
    if (sequence !== state.sequence) return;
    renderApp(elements, app, resolveAppUrl(app), { initial });
  }, delay);
  if (updateHash && window.location.hash !== `#${app.id}`) history.pushState({ appId: app.id }, '', `#${app.id}`);
}

function chooseCategory(category) {
  if (!CATEGORIES[category]) return;
  const app = selection.selectCategory(category);
  renderExperiments(elements.cartridgeStack, selection.state, chooseApp);
  markSelections(elements.machine, selection.state);
  commitApp(app);
}

function chooseApp(id, source = null, options = {}) {
  const previousCategory = selection.state.category;
  const app = selection.selectApp(id);
  if (!app) return;
  if (app.category !== previousCategory) renderExperiments(elements.cartridgeStack, selection.state, chooseApp);
  markSelections(elements.machine, selection.state);
  commitApp(app, { ...options, source });
}

function openDirectory() {
  directoryReturnFocus = elements.openDirectory;
  selection.state.directoryFilter = 'all';
  elements.directorySearch.value = '';
  renderDirectoryFilters(elements.directoryFilters, 'all', chooseDirectoryFilter);
  updateDirectoryResults();
  elements.directory.showModal();
  elements.directorySearch.focus();
}

function closeDirectory() {
  elements.directory.close();
  if (directoryReturnFocus instanceof HTMLElement) directoryReturnFocus.focus();
}

function chooseDirectoryFilter(filter) {
  selection.state.directoryFilter = filter;
  renderDirectoryFilters(elements.directoryFilters, filter, chooseDirectoryFilter);
  updateDirectoryResults();
}

function updateDirectoryResults() {
  renderDirectoryResults(elements.directoryResults, elements.directoryEmpty, {
    filter: selection.state.directoryFilter,
    query: elements.directorySearch.value,
    onSelect: id => {
      closeDirectory();
      chooseApp(id);
    }
  });
}

elements.previousApp.addEventListener('click', () => commitApp(selection.move(-1)));
elements.nextApp.addEventListener('click', () => commitApp(selection.move(1)));
elements.openDirectory.addEventListener('click', openDirectory);
elements.closeDirectory.addEventListener('click', closeDirectory);
elements.directorySearch.addEventListener('input', updateDirectoryResults);
elements.directory.addEventListener('click', event => {
  if (event.target === elements.directory) closeDirectory();
});
elements.directory.addEventListener('cancel', event => {
  event.preventDefault();
  closeDirectory();
});
elements.inspectApp.addEventListener('click', () => elements.displayBay.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' }));
elements.appImage.addEventListener('error', () => {
  const app = appById(elements.appImage.dataset.appId);
  elements.appImage.hidden = true;
  elements.missingName.textContent = app?.name || 'Selected app';
  elements.previewMissing.hidden = false;
  elements.displayStatus.textContent = 'VIEW NOT CAPTURED';
});

document.addEventListener('keydown', event => {
  const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  if (event.key === '/' && !editing) {
    event.preventDefault();
    if (!elements.directory.open) openDirectory();
    return;
  }
  if (elements.directory.open || editing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    chooseCategory(Object.keys(CATEGORIES)[Number(event.key) - 1]);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    commitApp(selection.move(-1));
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    commitApp(selection.move(1));
  } else if (event.key === 'Enter' && document.activeElement === document.body) {
    const href = elements.launchApp.getAttribute('href');
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  }
});

window.addEventListener('popstate', () => {
  const requested = appById(window.location.hash.slice(1));
  if (requested) chooseApp(requested.id, null, { updateHash: false, animate: false });
});

elements.orbitLink.href = resolveOrbitUrl();
renderCategories(elements.categoryControls, selection.state, chooseCategory);
renderExperiments(elements.cartridgeStack, selection.state, chooseApp);
renderDirectoryFilters(elements.directoryFilters, 'all', chooseDirectoryFilter);
if (window.location.hash !== `#${selection.state.appId}`) {
  history.replaceState({ appId: selection.state.appId }, '', `#${selection.state.appId}`);
}
commitApp(selection.currentApp(), { updateHash: false, animate: false, initial: true });
