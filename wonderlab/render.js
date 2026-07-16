import { APPS, CATEGORIES, CATEGORY_ORDER, appsIn } from './catalog.js?v=20260716b';

export function renderCategories(container, state, onSelect) {
  container.innerHTML = CATEGORY_ORDER.map(key => {
    const category = CATEGORIES[key];
    return `<button class="category-control" type="button" data-category="${key}" aria-pressed="${key === state.category}" style="--category-color:${category.color}">
      <span class="lever-well" aria-hidden="true"><i class="lever-handle"></i></span>
      <span class="category-label"><b>${category.label}</b><small>${category.instruction}</small></span>
      <span class="category-count" aria-label="${appsIn(key).length} apps">${appsIn(key).length}</span>
    </button>`;
  }).join('');
  container.querySelectorAll('.category-control').forEach(button => {
    button.addEventListener('click', () => onSelect(button.dataset.category));
  });
}

export function renderExperiments(container, state, onSelect) {
  const categoryApps = appsIn(state.category);
  const experiments = categoryApps.map((app, index) => `<button class="cartridge" type="button" data-app="${app.id}" aria-pressed="${app.id === state.appId}" style="--cartridge-color:${CATEGORIES[app.category].color};--delay:${index * 34}ms">
    <span class="cartridge-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
    <b>${app.name}</b><small>${app.kind}</small>
  </button>`).join('');
  const emptyBays = Array.from({ length: Math.max(0, 6 - categoryApps.length) }, (_, index) => `<div class="empty-slot" aria-hidden="true">EMPTY BAY ${String(categoryApps.length + index + 1).padStart(2, '0')}</div>`).join('');
  container.innerHTML = experiments + emptyBays;
  container.querySelectorAll('.cartridge').forEach(button => {
    button.addEventListener('click', () => onSelect(button.dataset.app, button));
  });
}

export function markSelections(root, state) {
  root.querySelectorAll('.category-control').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.category === state.category));
  });
  root.querySelectorAll('.cartridge').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.app === state.appId));
  });
}

export function renderDirectoryFilters(container, selected, onSelect) {
  const options = [['all', 'Everything'], ...CATEGORY_ORDER.map(key => [key, CATEGORIES[key].label])];
  container.innerHTML = options.map(([key, label]) => `<button type="button" data-filter="${key}" aria-pressed="${key === selected}">${label}</button>`).join('');
  container.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => onSelect(button.dataset.filter));
  });
}

export function renderDirectoryResults(container, empty, { filter, query, onSelect }) {
  const normalized = query.trim().toLowerCase();
  const matches = APPS.filter(app => {
    if (filter !== 'all' && app.category !== filter) return false;
    const haystack = `${app.name} ${app.kind} ${app.summary} ${CATEGORIES[app.category].label}`.toLowerCase();
    return !normalized || haystack.includes(normalized);
  });
  container.innerHTML = matches.map((app, index) => `<button class="directory-item" type="button" data-app="${app.id}">
    <span>${String(index + 1).padStart(2, '0')}</span>
    <span><b>${app.name}</b><small>${CATEGORIES[app.category].label} · ${app.kind}</small></span>
    <i aria-hidden="true">LOAD</i>
  </button>`).join('');
  empty.hidden = matches.length !== 0;
  container.querySelectorAll('.directory-item').forEach(button => {
    button.addEventListener('click', () => onSelect(button.dataset.app));
  });
}

export function renderApp(elements, app, resolvedUrl, { initial = false } = {}) {
  const categoryApps = appsIn(app.category);
  const categoryIndex = categoryApps.findIndex(candidate => candidate.id === app.id);
  const globalIndex = APPS.findIndex(candidate => candidate.id === app.id);
  document.body.dataset.category = app.category;
  elements.displayStatus.textContent = app.preview ? 'EXPERIMENT READY' : 'DESTINATION READY';
  elements.appKind.textContent = app.kind;
  elements.screenIndex.textContent = String(globalIndex + 1).padStart(2, '0');
  elements.appRoute.textContent = `${CATEGORIES[app.category].label} / experiment ${String(categoryIndex + 1).padStart(2, '0')}`;
  elements.appTitle.textContent = app.name;
  elements.appSummary.textContent = app.summary;
  elements.mobileAppName.textContent = app.name;
  elements.selectionAnnouncement.textContent = `${app.name} selected. ${CATEGORIES[app.category].label}. ${resolvedUrl ? 'Ready to visit.' : 'Available on the local network only.'}`;
  elements.magazineCount.value = `${categoryIndex + 1} / ${categoryApps.length} ready`;
  elements.magazineCount.textContent = elements.magazineCount.value;

  for (const launch of [elements.launchApp, elements.mobileLaunch]) {
    if (resolvedUrl) {
      launch.href = resolvedUrl;
      launch.removeAttribute('aria-disabled');
      launch.classList.remove('unavailable');
      launch.setAttribute('aria-label', `Visit ${app.name} in a new tab`);
    } else {
      launch.removeAttribute('href');
      launch.setAttribute('aria-disabled', 'true');
      launch.classList.add('unavailable');
      launch.setAttribute('aria-label', `${app.name} is currently available on the local network only`);
    }
  }
  elements.launchHint.textContent = resolvedUrl ? 'TRY THIS ONE' : 'LOCAL ONLY';
  elements.launchLabel.textContent = resolvedUrl ? 'Visit app' : 'No public route';
  elements.mobileLaunch.textContent = resolvedUrl ? 'Launch ↗' : 'Local only';

  if (app.preview) {
    elements.appImage.dataset.appId = app.id;
    elements.appImage.src = app.preview.src;
    elements.appImage.srcset = app.preview.srcset;
    elements.appImage.sizes = app.preview.sizes;
    elements.appImage.width = app.preview.width;
    elements.appImage.height = app.preview.height;
    elements.appImage.style.objectPosition = app.preview.position;
    elements.appImage.alt = `${app.name} interface`;
    elements.appImage.fetchPriority = initial ? 'high' : 'auto';
    elements.appImage.hidden = false;
    elements.previewMissing.hidden = true;
  } else {
    elements.appImage.removeAttribute('src');
    elements.appImage.removeAttribute('srcset');
    elements.appImage.alt = '';
    elements.appImage.hidden = true;
    elements.missingName.textContent = app.name;
    elements.previewMissing.hidden = false;
  }
}
