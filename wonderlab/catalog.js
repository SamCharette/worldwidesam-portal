export const CATEGORIES = Object.freeze({
  games: Object.freeze({ id: 'games', label: 'Games', instruction: 'Pick up and play', color: '#df4938' }),
  tools: Object.freeze({ id: 'tools', label: 'Tools', instruction: 'Useful on purpose', color: '#339b7e' }),
  tabletop: Object.freeze({ id: 'tabletop', label: 'Tabletop', instruction: 'Help at the table', color: '#b47a00' }),
  work: Object.freeze({ id: 'work', label: 'Work', instruction: 'Serious software, allegedly', color: '#3159ae' })
});

const preview = (name, width, height, position = 'top') => Object.freeze({
  src: `/wonderlab/assets/previews/${name}-1280.webp`,
  srcset: `/wonderlab/assets/previews/${name}-640.webp 640w, /wonderlab/assets/previews/${name}-1280.webp 1280w`,
  sizes: '(max-width: 720px) calc(100vw - 70px), (max-width: 1100px) calc(100vw - 130px), 760px',
  width,
  height,
  position
});

export const APPS = Object.freeze([
  Object.freeze({
    id: 'dungeon-desk', name: 'Dungeon Desk', category: 'games', kind: 'cursed paperwork game', localPort: 5174,
    publicUrl: null,
    summary: 'Survive seven days of dungeon administration by stamping memos, balancing resources, and choosing which terrible idea hurts least.',
    preview: preview('dungeon-desk', 1280, 888)
  }),
  Object.freeze({
    id: 'neon-cycle-grid', name: 'Neon Cycle Grid', category: 'games', kind: 'light-cycle arcade', localPort: 4325,
    publicUrl: 'https://worldwidesam.net/neon-cycle-grid/',
    summary: 'Outlast three rival riders in a fast 3D arena where every glowing trail becomes the next wall.',
    preview: preview('neon-cycle-grid', 1280, 720)
  }),
  Object.freeze({
    id: 'clawdtris', name: 'Clawdtris', category: 'games', kind: 'arcade stacker', localPort: 4316,
    publicUrl: 'https://tetris.worldwidesam.net/',
    summary: 'A bright falling-block arcade build with quick restarts and score-chasing energy.',
    preview: preview('clawdtris', 1280, 720)
  }),
  Object.freeze({
    id: 'one-bullet-dungeon', name: 'One Bullet Dungeon', category: 'games', kind: 'arcade dungeon', localPort: 4322,
    publicUrl: 'https://onebullet.worldwidesam.net/',
    summary: 'A tiny top-down dungeon where every shot is a commitment because the lone projectile must be recovered.',
    preview: preview('one-bullet-dungeon', 1280, 720)
  }),
  Object.freeze({
    id: 'orbital-slingshot', name: 'Orbital Slingshot', category: 'games', kind: 'gravity toy', localPort: 4320,
    publicUrl: 'https://slingshot.worldwidesam.net/',
    summary: 'Drag, aim, and release probes through visible gravity-bent trajectories and target rings.',
    preview: preview('orbital-slingshot', 1280, 720)
  }),
  Object.freeze({
    id: 'circuit-snap', name: 'Circuit Snap', category: 'games', kind: 'puzzle lab', localPort: 4317,
    publicUrl: 'https://circutsnap.worldwidesam.net/',
    summary: 'Snap together circuit-flavored logic, patterns, and tiny sparks of order.',
    preview: preview('circuit-snap', 1280, 720)
  }),
  Object.freeze({
    id: 'hex', name: 'Hex', category: 'games', kind: 'strategy game', localPort: 5173,
    publicUrl: 'https://hex.worldwidesam.net/',
    summary: 'A compact space for hex-grid experiments and fast tactical play.',
    preview: preview('hex-game', 1280, 720)
  }),
  Object.freeze({
    id: 'mission-control', name: 'Mission Control', category: 'tools', kind: 'command center', localPort: 8124,
    publicUrl: 'https://missioncontrol.worldwidesam.net/',
    summary: 'Clawdia’s operational cockpit for workspace attention, services, workboard state, memory, and live signals.',
    preview: null
  }),
  Object.freeze({
    id: 'decision-please', name: 'Decision Please', category: 'tools', kind: 'choice engine', localPort: 5178,
    publicUrl: 'https://decisions.worldwidesam.net/',
    summary: 'Turn a pile of options into a decision with structured ballots and a clear next move.',
    preview: preview('decision-please', 1280, 800)
  }),
  Object.freeze({
    id: 'procon', name: 'ProCon', category: 'tools', kind: 'decision workbench', localPort: null,
    publicUrl: 'https://procon.worldwidesam.net/',
    summary: 'Map a personal decision with weighted consequences, explicit probabilities, exact outcomes, and reversible what-if assumptions.',
    preview: preview('procon', 1280, 800)
  }),
  Object.freeze({
    id: 'sudbury-regreening', name: 'Sudbury Regreening Time Machine', category: 'tools', kind: 'environmental time machine', localPort: 4326,
    publicUrl: 'https://sudburyregreening.worldwidesam.net/',
    summary: 'Pair Greater Sudbury\u2019s recorded planting and liming work with Landsat-observed vegetation change across four decades.',
    preview: null
  }),
  Object.freeze({
    id: 'rpg-library', name: 'RPG Library', category: 'tabletop', kind: 'library archive', localPort: 8099,
    publicUrl: 'https://rpgs.worldwidesam.net/',
    summary: 'Browse roleplaying games by feeling, mechanic, genre, or one familiar starting point.',
    preview: preview('rpg-library', 1280, 800)
  }),
  Object.freeze({
    id: 'ypsilon-overkill', name: 'Ypsilon Overkill', category: 'tabletop', kind: 'warden console', localPort: 4315,
    publicUrl: 'https://ypsillon.worldwidesam.net/',
    summary: 'A purpose-built campaign console for delightfully excessive Ypsilon tracking and table support.',
    preview: null
  }),
  Object.freeze({
    id: 'marvel-champions', name: 'Marvel Champions Runner', category: 'tabletop', kind: 'table helper', localPort: 4321,
    publicUrl: 'https://marvel.worldwidesam.net/',
    summary: 'Run villain health, threat, setup, encounter flow, and reference material without losing the table.',
    preview: preview('marvel', 1280, 800)
  }),
  Object.freeze({
    id: 'wasteland-map', name: 'Wasteland Terminal Map', category: 'tabletop', kind: 'campaign map', localPort: null,
    publicUrl: '/wasteland-terminal-map/',
    summary: 'Scan a green-screen regional campaign map with locations, rumors, routes, and GM hooks.',
    preview: preview('wasteland-map', 1280, 854)
  }),
  Object.freeze({
    id: 'foundry', name: 'Foundry VTT', category: 'tabletop', kind: 'virtual tabletop', localPort: 30000,
    publicUrl: 'https://foundry.worldwidesam.net/',
    summary: 'The full virtual tabletop for sessions, maps, character sheets, journals, and dice.',
    preview: null
  }),
  Object.freeze({
    id: 'eems', name: 'EEMS', category: 'work', kind: 'workplace modernization', localPort: 5291,
    publicUrl: 'https://eems.worldwidesam.net/',
    summary: 'The ASP.NET Core rebuild of the workplace energy and emissions management system.',
    preview: null
  })
]);

export const CATEGORY_ORDER = Object.freeze(Object.keys(CATEGORIES));

export function appsIn(category) {
  return APPS.filter(app => app.category === category);
}

export function appById(id) {
  return APPS.find(app => app.id === id) || null;
}

export function validateCatalog() {
  const ids = new Set();
  for (const app of APPS) {
    if (ids.has(app.id)) throw new Error(`Duplicate app id: ${app.id}`);
    if (!CATEGORIES[app.category]) throw new Error(`Unknown category for ${app.id}`);
    if (!app.publicUrl && !app.localPort) throw new Error(`No route for ${app.id}`);
    if (app.localPath && (!app.localPort || !app.localPath.startsWith('/') || !app.localPath.endsWith('/'))) {
      throw new Error(`Invalid local path for ${app.id}`);
    }
    ids.add(app.id);
  }
  if (APPS.length !== 17) throw new Error(`Expected 17 apps, found ${APPS.length}`);
  return true;
}
