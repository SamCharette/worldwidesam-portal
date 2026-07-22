import { APPS, CATEGORY_ORDER, appById, appsIn } from './catalog.js?v=20260722a';

export function createSelectionState(initialHash = '') {
  const defaultApp = APPS[0];
  const requested = appById(initialHash.replace(/^#/, ''));
  const initialApp = requested || defaultApp;
  const lastAppByCategory = Object.fromEntries(CATEGORY_ORDER.map(category => [category, appsIn(category)[0].id]));
  lastAppByCategory[initialApp.category] = initialApp.id;

  const state = {
    category: initialApp.category,
    appId: initialApp.id,
    directoryFilter: 'all',
    sequence: 0,
    invalidInitialHash: Boolean(initialHash && !requested)
  };

  return {
    state,
    currentApp: () => appById(state.appId),
    selectCategory(category) {
      const app = appById(lastAppByCategory[category]) || appsIn(category)[0];
      if (!app) return null;
      state.category = category;
      state.appId = app.id;
      return app;
    },
    selectApp(id) {
      const app = appById(id);
      if (!app) return null;
      state.category = app.category;
      state.appId = app.id;
      lastAppByCategory[app.category] = app.id;
      return app;
    },
    move(direction) {
      const categoryApps = appsIn(state.category);
      const current = categoryApps.findIndex(app => app.id === state.appId);
      const next = (current + direction + categoryApps.length) % categoryApps.length;
      return this.selectApp(categoryApps[next].id);
    }
  };
}
