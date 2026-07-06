import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const apps = [
  { name: "Hex", category: "games", kind: "strategy game", code: "HX-01", publicUrl: "https://hex.worldwidesam.net", localPort: 5173, radius: 4.5, speed: 0.1, size: 0.34, start: 0.1, color: 0x4ee7ff, summary: "A compact strategy game space for hex-grid experiments and tactical play.", highlights: ["Hex-grid board interactions", "Fast tactical experiments", "Public game prototype"] },
  { name: "Clawdtris", category: "games", kind: "arcade stacker", code: "TR-02", publicUrl: "https://tetris.worldwidesam.net", localPort: 4316, radius: 5.45, speed: 0.082, size: 0.42, start: 1.4, color: 0xff4f8b, summary: "A bright block-stacking arcade build with quick restarts and score-chasing energy.", highlights: ["Classic falling-block rhythm", "Immediate restart loop", "Keyboard-first arcade feel"] },
  { name: "Circuit Snap", category: "games", kind: "puzzle lab", code: "CS-03", publicUrl: "https://circutsnap.worldwidesam.net", localPort: 4317, radius: 6.35, speed: 0.07, size: 0.38, start: 2.6, color: 0xffd166, summary: "A circuit-flavored puzzle lab for snapping together logic, patterns, and tiny sparks of order.", highlights: ["Logic puzzle experiments", "Circuit-board visual language", "Small, focused challenge loops"] },
  { name: "Mission Control", category: "tools", kind: "command center", code: "MC-04", publicUrl: "https://missioncontrol.worldwidesam.net", localPort: 8124, radius: 7.2, speed: 0.058, size: 0.48, start: 3.6, color: 0x56f5bf, summary: "The operational dashboard for Clawdia-facing status, tools, and command-center experiments.", highlights: ["Assistant status surfaces", "Workspace tools and readouts", "Command-center UI experiments"] },
  { name: "RPG Catalog", category: "tabletop", kind: "library archive", code: "RP-06", publicUrl: "https://rpgs.worldwidesam.net", localPort: 8099, radius: 9.0, speed: 0.043, size: 0.46, start: 5.5, color: 0xff8a58, summary: "A public archive surface for RPG library and catalog artifacts.", highlights: ["Collection browsing", "Archive-oriented presentation", "Public library artifacts"] },
  { name: "Decisions Please", category: "tools", kind: "choice engine", code: "DP-07", publicUrl: "https://decisions.worldwidesam.net", localPort: 5178, radius: 5.95, speed: -0.064, size: 0.36, start: 5.9, color: 0x4ee7ff, summary: "A lightweight decision helper for turning options into an actual next move.", highlights: ["Option comparison", "Small decision workflows", "Fast answer-oriented interface"] },
  { name: "Ypsillon Overkill Dashboard", category: "tabletop", kind: "overkill metrics", code: "YO-08", publicUrl: "https://ypsillon.worldwidesam.net", localPort: 4315, radius: 7.65, speed: -0.045, size: 0.5, start: 0.75, color: 0xff4f8b, summary: "A dashboard for delightfully excessive Ypsillon tracking and metrics.", highlights: ["Metric-heavy dashboard surface", "Overkill tracking experiments", "Dense operational readouts"] },
  { name: "Orbital Slingshot", category: "games", kind: "gravity toy", code: "OS-09", publicUrl: "https://slingshot.worldwidesam.net/", localPort: 4320, radius: 8.35, speed: 0.052, size: 0.4, start: 4.6, color: 0x8df0a6, summary: "A drag-and-release gravity slingshot toy with curved trajectories, target rings, and flashy probe trails.", highlights: ["Drag to aim and release", "Visible gravity-bent trajectories", "Standalone local service on port 4320"] },
  { name: "Marvel Champions Runner", category: "tabletop", kind: "table helper", code: "MR-10", publicUrl: "https://marvel.worldwidesam.net/", localPort: 4321, radius: 9.7, speed: -0.038, size: 0.44, start: 2.1, color: 0x2f7dff, summary: "A standalone Marvel Champions villain runner for keeping encounter flow, threat, health, and setup readable at the table.", highlights: ["New Game, Setup, Play, Board, Reference, and Guide tabs", "Browser-local table state", "Standalone local service on port 4321"] },
  { name: "Foundry VTT", category: "tabletop", kind: "virtual tabletop", code: "FV-11", publicUrl: "https://foundry.worldwidesam.net/", localPort: 30000, radius: 10.45, speed: 0.032, size: 0.5, start: 3.15, color: 0xb38cff, summary: "The full virtual tabletop for sessions, maps, character sheets, journals, dice, and campaign prep.", highlights: ["Live session tabletop", "Maps, sheets, journals, and dice", "Foundry service on port 30000"] },
  { name: "One Bullet Dungeon", category: "games", kind: "arcade dungeon", code: "OB-12", publicUrl: "https://onebullet.worldwidesam.net/", localPort: 4322, radius: 9.25, speed: -0.046, size: 0.42, start: 5.45, color: 0xd7ff58, summary: "A tiny top-down dungeon shooter where every shot is a commitment because the lone projectile has to be physically recovered.", highlights: ["One projectile, no magic recall", "Bounce, recover, and clear rooms", "Standalone local service on port 4322"] },
  { name: "EEMS", category: "work", kind: "workplace modernization", code: "EE-13", publicUrl: "https://eems.worldwidesam.net/", localPort: 5291, radius: 5.85, speed: 0.055, size: 0.44, start: 1.35, color: 0x88a6ff, summary: "The ASP.NET Core rebuild of the workplace energy and emissions management system.", highlights: ["MVC and Razor replacement app", "Accounts read-parity slice", "Local development service on port 5291"] },
  { name: "Wasteland Terminal Map", category: "tabletop", kind: "campaign map", code: "WT-14", publicUrl: "wasteland-terminal-map/", radius: 11.15, speed: -0.032, size: 0.43, start: 4.25, color: 0x77ff66, summary: "A green-screen wasteland campaign map with clickable locations, filters, route scanning, and GM hooks.", highlights: ["Interactive terminal-style regional map", "Clickable sites with rumors and finds", "Static portal page for easy sharing"] }
];

function siteCountForCategory(category) {
  return apps.filter((app) => app.category === category).length;
}

function systemPlanetSize(category) {
  return THREE.MathUtils.clamp(0.38 + siteCountForCategory(category) * 0.065, 0.48, 0.68);
}

const systems = [
  { id: "games", name: "Games", kind: "playable experiments", code: "GM", radius: 5.8, speed: 0.052, size: systemPlanetSize("games"), start: 0.1, color: 0x2c7892, summary: "Arcade, puzzle, strategy, gravity toys, and tiny management games.", highlights: ["Hex", "Clawdtris", "Circuit Snap", "Orbital Slingshot", "One Bullet Dungeon"] },
  { id: "tools", name: "Tools", kind: "utility surfaces", code: "TL", radius: 8.0, speed: -0.041, size: systemPlanetSize("tools"), start: 2.75, color: 0x5f7b42, summary: "Dashboards and helper apps.", highlights: ["Mission Control", "Decisions Please"] },
  { id: "tabletop", name: "Tabletop", kind: "RPG and table helpers", code: "TT", radius: 10.2, speed: 0.034, size: systemPlanetSize("tabletop"), start: 4.75, color: 0xae793c, summary: "RPG library, VTT, and campaign/table tools.", highlights: ["RPG Catalog", "Ypsillon Overkill Dashboard", "Marvel Champions Runner", "Foundry VTT", "Wasteland Terminal Map"] },
  { id: "work", name: "Work", kind: "workplace apps", code: "WK", radius: 12.05, speed: -0.028, size: systemPlanetSize("work"), start: 1.72, color: 0x6579b8, summary: "Workplace systems and modernization projects.", highlights: ["EEMS"] }
];

const systemById = new Map(systems.map((system) => [system.id, system]));

const publicPortalHosts = new Set(["worldwidesam.net", "www.worldwidesam.net", "landing.worldwidesam.net"]);
const currentHostname = window.location.hostname;
const isPublicPortal = publicPortalHosts.has(currentHostname);

function localHostForLinks() {
  if (currentHostname === "localhost" || currentHostname === "127.0.0.1" || currentHostname === "::1") {
    return "127.0.0.1";
  }

  return currentHostname;
}

function appUrl(app) {
  if (isPublicPortal || !app.localPort) {
    return app.publicUrl;
  }

  return `http://${localHostForLinks()}:${app.localPort}/`;
}

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const smallScreenQuery = window.matchMedia("(max-width: 860px)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const isReducedMotion = reducedMotionQuery.matches;
const prefersPowerSaver = isReducedMotion || smallScreenQuery.matches || coarsePointerQuery.matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const maxPixelRatio = prefersPowerSaver ? 1 : 1.5;
const targetFrameRate = isReducedMotion ? 10 : prefersPowerSaver ? 24 : 30;
const targetFrameInterval = 1000 / targetFrameRate;
const labelFrameInterval = prefersPowerSaver ? 160 : 100;
const sunSegments = prefersPowerSaver ? 36 : 56;
const planetSegments = prefersPowerSaver ? 28 : 40;
document.documentElement.classList.toggle("power-save", prefersPowerSaver);
const canvas = document.querySelector("#orbitCanvas");
const labels = document.querySelector("#labels");
const labelLines = document.querySelector("#labelLines");
const template = document.querySelector("#labelTemplate");
const solarBack = document.querySelector("#solarBack");
const appCount = document.querySelector("#appCount");
const clock = document.querySelector("#clock");
const planetCard = document.querySelector("#planetCard");
const cardClose = document.querySelector("#cardClose");
const cardCode = document.querySelector("#cardCode");
const cardName = document.querySelector("#cardName");
const cardKind = document.querySelector("#cardKind");
const cardDomain = document.querySelector("#cardDomain");
const cardSummary = document.querySelector("#cardSummary");
const cardHighlights = document.querySelector("#cardHighlights");
const cardLink = document.querySelector("#cardLink");

function updateClock() {
  clock.textContent = new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

updateClock();
setInterval(updateClock, 30_000);
appCount.textContent = String(apps.length).padStart(2, "0");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !prefersPowerSaver,
  alpha: false,
  powerPreference: "low-power"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x07080d, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);
scene.fog = new THREE.Fog(0x07080d, 24, 58);

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
camera.position.set(0, 7.4, 13.5);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0xc7d5ff, 0.96);
scene.add(ambient);

const sunLight = new THREE.PointLight(0xffb15f, 4.2, 24, 2);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const planetFillLight = new THREE.DirectionalLight(0xf4f8ff, 2.45);
planetFillLight.position.set(4.5, 7.2, 11.5);
scene.add(planetFillLight);

const planetSideLight = new THREE.DirectionalLight(0xaed6ff, 1.15);
planetSideLight.position.set(-7, 4.4, 5.5);
scene.add(planetSideLight);

const planetOverheadLight = new THREE.HemisphereLight(0xdde8ff, 0x1c2318, 0.58);
scene.add(planetOverheadLight);

const sunGroup = new THREE.Group();
scene.add(sunGroup);

const sunFlares = [];

function makeCanvasTexture(size, draw) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = size;
  canvasTexture.height = size;
  const context = canvasTexture.getContext("2d");
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function seededRandom(seedText) {
  let seed = 1779033703 ^ seedText.length;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = Math.imul(seed ^ seedText.charCodeAt(index), 3432918353);
    seed = (seed << 13) | (seed >>> 19);
  }

  return () => {
    seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    seed ^= seed >>> 16;
    return (seed >>> 0) / 4294967296;
  };
}

function colorStyle(hexColor, amount = 0) {
  const color = new THREE.Color(hexColor);
  if (amount > 0) {
    color.lerp(new THREE.Color(0xffffff), amount);
  } else if (amount < 0) {
    color.lerp(new THREE.Color(0x05070b), Math.abs(amount));
  }

  return `#${color.getHexString()}`;
}

function terrainForBody(body) {
  return {
    "GM": "ocean",
    "TL": "jungle",
    "TT": "desert",
    "WK": "cobalt",
    "HX-01": "ice",
    "TR-02": "storm",
    "CS-03": "desert",
    "MC-04": "ocean",
    "RP-06": "rust",
    "DP-07": "marble",
    "YO-08": "lava",
    "OS-09": "jungle",
    "MR-10": "cobalt",
    "FV-11": "violet",
    "OB-12": "crater",
    "EE-13": "marble"
  }[body.code] || "crater";
}

function makeSunTexture() {
  return makeCanvasTexture(512, (context, size) => {
    const center = size / 2;
    const glow = context.createRadialGradient(center, center, size * 0.05, center, center, size * 0.52);
    glow.addColorStop(0, "#fff8c9");
    glow.addColorStop(0.22, "#ffe477");
    glow.addColorStop(0.52, "#ff9f32");
    glow.addColorStop(0.78, "#f24b16");
    glow.addColorStop(1, "#7c1609");
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);

    context.globalCompositeOperation = "screen";
    for (let band = 0; band < 52; band += 1) {
      const y = (band / 52) * size;
      const wave = Math.sin(band * 0.9) * 22;
      const gradient = context.createLinearGradient(0, y, size, y + wave);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.45, "rgba(255, 242, 122, 0.18)");
      gradient.addColorStop(1, "rgba(255, 117, 35, 0)");
      context.strokeStyle = gradient;
      context.lineWidth = 3 + Math.sin(band) * 2;
      context.beginPath();
      for (let x = -20; x <= size + 20; x += 24) {
        const offset = Math.sin(x * 0.025 + band * 0.7) * 16;
        if (x === -20) {
          context.moveTo(x, y + offset);
        } else {
          context.lineTo(x, y + offset);
        }
      }
      context.stroke();
    }

    context.globalCompositeOperation = "multiply";
    for (let spot = 0; spot < 34; spot += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 12 + Math.random() * 34;
      const spotGradient = context.createRadialGradient(x, y, 0, x, y, radius);
      spotGradient.addColorStop(0, "rgba(80, 12, 4, 0.24)");
      spotGradient.addColorStop(1, "rgba(80, 12, 4, 0)");
      context.fillStyle = spotGradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function makePlanetTexture(body) {
  const random = seededRandom(body.code);
  const terrain = terrainForBody(body);
  return makeCanvasTexture(256, (context, size) => {
    if (body.code === "GM") {
      const ocean = context.createLinearGradient(0, 0, size, size);
      ocean.addColorStop(0, "#2db4d6");
      ocean.addColorStop(0.42, "#126aa0");
      ocean.addColorStop(1, "#07345f");
      context.fillStyle = ocean;
      context.fillRect(0, 0, size, size);

      for (let shelf = 0; shelf < 18; shelf += 1) {
        context.fillStyle = shelf % 3 === 0 ? "rgba(212, 242, 235, 0.74)" : "rgba(64, 143, 115, 0.82)";
        context.beginPath();
        const x = random() * size;
        const y = random() * size;
        const width = 26 + random() * 74;
        const height = 8 + random() * 28;
        context.ellipse(x, y, width, height, random() * Math.PI, 0, Math.PI * 2);
        context.fill();
      }

      for (let cap = 0; cap < 9; cap += 1) {
        context.fillStyle = "rgba(236, 250, 255, 0.88)";
        context.beginPath();
        context.ellipse(random() * size, random() > 0.5 ? random() * 36 : size - random() * 36, 18 + random() * 40, 4 + random() * 14, random() * Math.PI, 0, Math.PI * 2);
        context.fill();
      }
      return;
    }

    if (body.code === "TL") {
      const land = context.createLinearGradient(0, 0, size, size);
      land.addColorStop(0, "#9faf55");
      land.addColorStop(0.5, "#348348");
      land.addColorStop(1, "#674324");
      context.fillStyle = land;
      context.fillRect(0, 0, size, size);

      for (let patch = 0; patch < 34; patch += 1) {
        context.fillStyle = random() > 0.45 ? "rgba(28, 92, 45, 0.88)" : "rgba(121, 89, 45, 0.82)";
        context.beginPath();
        context.ellipse(random() * size, random() * size, 14 + random() * 44, 8 + random() * 25, random() * Math.PI, 0, Math.PI * 2);
        context.fill();
      }

      for (let ridge = 0; ridge < 20; ridge += 1) {
        context.strokeStyle = "rgba(226, 216, 150, 0.38)";
        context.lineWidth = 1 + random() * 2;
        context.beginPath();
        let x = random() * size;
        let y = random() * size;
        context.moveTo(x, y);
        for (let step = 0; step < 5; step += 1) {
          x += random() * 40 - 20;
          y += random() * 32 - 16;
          context.lineTo(x, y);
        }
        context.stroke();
      }
      return;
    }

    if (body.code === "TT") {
      const desert = context.createLinearGradient(0, 0, size, size);
      desert.addColorStop(0, "#e3b566");
      desert.addColorStop(0.48, "#b9783a");
      desert.addColorStop(1, "#704728");
      context.fillStyle = desert;
      context.fillRect(0, 0, size, size);

      for (let band = 0; band < 26; band += 1) {
        context.strokeStyle = band % 2 ? "rgba(245, 199, 112, 0.56)" : "rgba(82, 54, 34, 0.5)";
        context.lineWidth = 3 + random() * 8;
        context.beginPath();
        const y = (band / 26) * size + random() * 16;
        for (let x = -20; x <= size + 20; x += 22) {
          const wave = Math.sin(x * 0.035 + band) * (8 + random() * 12);
          if (x === -20) {
            context.moveTo(x, y + wave);
          } else {
            context.lineTo(x, y + wave);
          }
        }
        context.stroke();
      }

      for (let crater = 0; crater < 20; crater += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 3 + random() * 10;
        context.fillStyle = "rgba(50, 34, 24, 0.42)";
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(238, 188, 107, 0.5)";
        context.lineWidth = 1;
        context.stroke();
      }
      return;
    }

    const base = colorStyle(body.color, terrain === "ice" || terrain === "marble" ? 0.28 : -0.24);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);

    const drawBand = (y, height, lightness, alpha = 0.7) => {
      const gradient = context.createLinearGradient(0, y - height, size, y + height);
      gradient.addColorStop(0, `${colorStyle(body.color, -0.6)}00`);
      gradient.addColorStop(0.5, `${colorStyle(body.color, lightness)}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
      gradient.addColorStop(1, `${colorStyle(body.color, -0.6)}00`);
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(size / 2, y, size * (0.34 + random() * 0.46), height, random() * 0.18 - 0.09, 0, Math.PI * 2);
      context.fill();
    };

    if (["storm", "cobalt", "violet"].includes(terrain)) {
      for (let band = 0; band < 22; band += 1) {
        const y = (band / 22) * size + random() * 10;
        drawBand(y, 4 + random() * 14, band % 3 === 0 ? 0.28 : -0.42, 0.42 + random() * 0.28);
      }
    } else if (terrain === "lava") {
      context.fillStyle = "#1a1014";
      context.fillRect(0, 0, size, size);
      for (let crack = 0; crack < 28; crack += 1) {
        context.strokeStyle = random() > 0.45 ? "rgba(255, 118, 44, 0.82)" : "rgba(255, 214, 92, 0.56)";
        context.lineWidth = 1 + random() * 3;
        context.beginPath();
        let x = random() * size;
        let y = random() * size;
        context.moveTo(x, y);
        for (let step = 0; step < 5; step += 1) {
          x += random() * 34 - 17;
          y += random() * 34 - 17;
          context.lineTo(x, y);
        }
        context.stroke();
      }
    } else if (terrain === "ice" || terrain === "marble") {
      for (let vein = 0; vein < 42; vein += 1) {
        context.strokeStyle = terrain === "ice" ? "rgba(31, 95, 128, 0.34)" : "rgba(60, 48, 82, 0.28)";
        context.lineWidth = 1;
        context.beginPath();
        let x = random() * size;
        let y = random() * size;
        context.moveTo(x, y);
        for (let step = 0; step < 4; step += 1) {
          x += random() * 46 - 23;
          y += random() * 24 - 12;
          context.lineTo(x, y);
        }
        context.stroke();
      }
    } else {
      for (let patch = 0; patch < 48; patch += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 8 + random() * 44;
        const lightness = terrain === "desert" ? (random() > 0.5 ? 0.26 : -0.34) : (random() > 0.48 ? 0.34 : -0.56);
        const shade = colorStyle(body.color, lightness);
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `${shade}b0`);
        gradient.addColorStop(1, `${shade}00`);
        context.fillStyle = gradient;
        context.beginPath();
        context.ellipse(x, y, radius * (0.5 + random()), radius * (0.24 + random() * 0.52), random() * Math.PI, 0, Math.PI * 2);
        context.fill();
      }
    }

    const craterCount = ["desert", "rust", "crater"].includes(terrain) ? 24 : 8;
    for (let crater = 0; crater < craterCount; crater += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 2 + random() * 8;
      context.strokeStyle = "rgba(255,255,255,0.14)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "rgba(0,0,0,0.24)";
      context.beginPath();
      context.arc(x + radius * 0.22, y + radius * 0.18, radius * 0.72, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function makeFlareTexture() {
  return makeCanvasTexture(128, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size * 0.76, 0, size / 2, size * 0.76, size * 0.72);
    gradient.addColorStop(0, "rgba(255,255,210,0.95)");
    gradient.addColorStop(0.24, "rgba(255,181,62,0.62)");
    gradient.addColorStop(0.62, "rgba(255,74,18,0.28)");
    gradient.addColorStop(1, "rgba(255,74,18,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(size / 2, 0);
    context.bezierCurveTo(size * 0.9, size * 0.3, size * 0.76, size * 0.86, size / 2, size);
    context.bezierCurveTo(size * 0.24, size * 0.86, size * 0.1, size * 0.3, size / 2, 0);
    context.fill();
  });
}

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(1.48, sunSegments, sunSegments),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: makeSunTexture()
  })
);
sunGroup.add(sun);

const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1.72, sunSegments, sunSegments),
  new THREE.MeshBasicMaterial({
    color: 0xff9f45,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
sunGroup.add(sunGlow);

const sunCorona = new THREE.Mesh(
  new THREE.SphereGeometry(2.05, sunSegments, sunSegments),
  new THREE.MeshBasicMaterial({
    color: 0xff6d24,
    transparent: true,
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
sunGroup.add(sunCorona);

const flareTexture = makeFlareTexture();
for (let index = 0; index < 10; index += 1) {
  const angle = (index / 10) * Math.PI * 2;
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTexture,
    color: index % 2 ? 0xffa236 : 0xff5c1c,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  flare.position.set(Math.cos(angle) * 1.74, Math.sin(angle * 1.7) * 0.18, Math.sin(angle) * 1.08);
  flare.scale.set(0.5 + (index % 3) * 0.14, 1.0 + (index % 4) * 0.18, 1);
  flare.userData.phase = index * 0.72;
  sunFlares.push(flare);
  sunGroup.add(flare);
}

const sunRim = new THREE.Mesh(
  new THREE.SphereGeometry(1.56, sunSegments, sunSegments),
  new THREE.MeshBasicMaterial({
    color: 0xfff0a8,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  })
);
sunGroup.add(sunRim);

const orbitRoot = new THREE.Group();
scene.add(orbitRoot);

const starGeometry = new THREE.BufferGeometry();
const starCount = 900;
const starPositions = new Float32Array(starCount * 3);
for (let index = 0; index < starCount; index += 1) {
  const distance = 18 + Math.random() * 38;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[index * 3] = distance * Math.sin(phi) * Math.cos(theta);
  starPositions[index * 3 + 1] = distance * Math.cos(phi) * 0.62;
  starPositions[index * 3 + 2] = distance * Math.sin(phi) * Math.sin(theta);
}
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xd7f7ff, size: 0.035, transparent: true, opacity: 0.7 })
));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const planets = [];
const baseCameraPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const desiredCameraTarget = new THREE.Vector3();
let activePlanet = null;
let activeSystem = null;
let focusedSystemCore = null;
let orbitTime = 0;
let labelsDirty = true;
let lastLabelUpdate = 0;
let animationFrameId = 0;

function makeOrbit(radius, color) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.62, 0, Math.PI * 2);
  const points = curve.getPoints(180).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.24 });
  const line = new THREE.LineLoop(geometry, material);
  orbitRoot.add(line);
}

function appsForSystem(systemId) {
  return apps.filter((app) => app.category === systemId);
}

function orbitBodies() {
  if (!activeSystem) {
    return systems.map((system) => ({
      type: "system",
      data: system,
      radius: system.radius,
      speed: system.speed,
      size: system.size,
      start: system.start,
      color: system.color
    }));
  }

  const systemApps = appsForSystem(activeSystem.id);
  return systemApps.map((app, index) => ({
    type: "app",
    data: app,
    radius: 1.65 + index * 0.72,
    speed: (index % 2 ? -0.06 : 0.068) * (1 - index * 0.035),
    size: Math.max(0.12, Math.min(0.18, app.size * 0.38)),
    start: 0.45 + (index / systemApps.length) * Math.PI * 2,
    color: app.color
  }));
}

function makeFocusedSystemCore() {
  if (!activeSystem) return;

  const coreGroup = new THREE.Group();
  orbitRoot.add(coreGroup);
  const coreSize = 1.18;

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(coreSize, planetSegments, planetSegments),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: makePlanetTexture(activeSystem),
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.96,
      metalness: 0.01
    })
  );
  coreGroup.add(core);

  focusedSystemCore = { group: coreGroup, core };
}

function clearOrbitBodies() {
  planets.splice(0, planets.length);
  focusedSystemCore = null;
  orbitRoot.clear();
  labels.replaceChildren();
  labelLines.replaceChildren();
}

function makePlanet(body) {
  makeOrbit(body.radius, body.color);

  const group = new THREE.Group();
  group.userData.body = body;
  orbitRoot.add(group);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(body.size, planetSegments, planetSegments),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: makePlanetTexture(body.data),
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.95,
      metalness: 0.01
    })
  );
  planet.userData.body = body;
  group.add(planet);

  const label = template.content.firstElementChild.cloneNode(true);

  if (body.type === "app") {
    label.href = appUrl(body.data);
    label.setAttribute("aria-label", `Open ${body.data.name} in a new window`);
  } else {
    label.removeAttribute("href");
    label.setAttribute("role", "button");
    label.setAttribute("tabindex", "0");
    label.setAttribute("aria-label", `Focus ${body.data.name} planet`);
    label.addEventListener("click", (event) => {
      event.preventDefault();
      focusSystem(body.data.id);
    });
    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusSystem(body.data.id);
      }
    });
  }
  label.querySelector(".planet-code").textContent = body.data.code;
  label.querySelector(".planet-name").textContent = body.data.name;
  labels.append(label);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("label-line");
  line.setAttribute("stroke", `#${body.color.toString(16).padStart(6, "0")}`);
  labelLines.append(line);

  planets.push({ body, group, planet, label, line, labelWidth: 160, labelHeight: 62 });
}

function measureLabels() {
  for (const item of planets) {
    item.labelWidth = item.label.offsetWidth || 160;
    item.labelHeight = item.label.offsetHeight || 62;
  }
}

function renderOrbitBodies() {
  closePlanetCard();
  clearOrbitBodies();
  sunGroup.visible = !activeSystem;
  solarBack.hidden = !activeSystem;
  document.body.classList.toggle("system-focus", Boolean(activeSystem));
  if (activeSystem) {
    makeFocusedSystemCore();
  }
  orbitBodies().forEach(makePlanet);
  measureLabels();
  labelsDirty = true;
}

function focusSystem(systemId) {
  activeSystem = systemById.get(systemId) || null;
  renderOrbitBodies();
}

function returnToSolarSystem() {
  activeSystem = null;
  renderOrbitBodies();
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;

  if (width < 860) {
    camera.position.set(0, 10.6, 21);
  } else if (width < 1180) {
    camera.position.set(0.7, 8.8, 14.6);
  } else {
    camera.position.set(1.7, 7.4, 13.5);
  }

  baseCameraPosition.copy(camera.position);
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
  measureLabels();
  labelsDirty = true;
}

function updatePlanetPositions(delta) {
  if (!activePlanet && !isReducedMotion) {
    orbitTime += delta;
  }

  for (const item of planets) {
    const body = item.body;
    const angle = body.start + (isReducedMotion ? 0 : orbitTime * body.speed);
    const x = Math.cos(angle) * body.radius;
    const z = Math.sin(angle) * body.radius * 0.62;
    const y = body.type === "system" ? 0 : Math.sin(angle * 1.8 + body.radius) * 0.22;

    item.group.position.set(x, y, z);
    item.planet.rotation.y += isReducedMotion ? 0 : 0.0065;
  }

  if (focusedSystemCore && !isReducedMotion) {
    focusedSystemCore.core.rotation.y += 0.004;
  }
}

function updateLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const vector = new THREE.Vector3();
  const planetPoint = new THREE.Vector3();
  const planetRadiusPoint = new THREE.Vector3();
  const isSmallScreen = smallScreenQuery.matches;
  labelLines.setAttribute("viewBox", `0 0 ${width} ${height}`);

  for (const item of planets) {
    if (isSmallScreen) {
      item.label.style.opacity = "1";
      item.line.style.opacity = "0";
      continue;
    }

    planetPoint.copy(item.group.position).project(camera);
    const planetX = (planetPoint.x * 0.5 + 0.5) * width;
    const planetY = (planetPoint.y * -0.5 + 0.5) * height;
    vector.copy(planetPoint);
    planetRadiusPoint.copy(item.group.position);
    planetRadiusPoint.x += item.body.size;
    planetRadiusPoint.project(camera);
    const planetScreenRadius = Math.abs((planetRadiusPoint.x * 0.5 + 0.5) * width - planetX);
    const depth = THREE.MathUtils.clamp(1.12 - vector.z * 0.18, 0.58, 1);
    const labelWidth = item.labelWidth;
    const labelHeight = item.labelHeight;
    const labelHalfWidth = (labelWidth * depth) / 2;
    const labelHalfHeight = (labelHeight * depth) / 2;
    const preferredSide = planetX > width * 0.5 ? 1 : -1;
    const labelDistance = activeSystem
      ? THREE.MathUtils.clamp(width * 0.12, 128, 190)
      : THREE.MathUtils.clamp(width * 0.18, 220, 300);
    const minClearance = planetScreenRadius + labelHalfWidth + 26;
    const distance = Math.max(labelDistance, minClearance);
    const minX = labelHalfWidth + 18;
    const maxX = width - labelHalfWidth - 18;
    const placeOnSide = (side) => THREE.MathUtils.clamp(planetX + side * distance, minX, maxX);
    let x = placeOnSide(preferredSide);
    const alternateX = placeOnSide(-preferredSide);
    if (Math.abs(x - planetX) < minClearance && Math.abs(alternateX - planetX) > Math.abs(x - planetX)) {
      x = alternateX;
    }
    const y = THREE.MathUtils.clamp(
      planetY + THREE.MathUtils.clamp((0.5 - vector.y) * 32, -28, 28),
      labelHalfHeight + 18,
      height - labelHalfHeight - 18
    );
    const visible = vector.z < 1 && x > -150 && x < width + 150 && y > -80 && y < height + 80;
    const actualSide = x >= planetX ? 1 : -1;

    item.label.style.left = `${x}px`;
    item.label.style.top = `${y}px`;
    item.label.style.opacity = visible && !activePlanet ? String(depth) : "0";
    item.label.style.transform = `translate(-50%, -50%) scale(${depth})`;
    item.label.classList.toggle("is-active", item === activePlanet);
    const lineEndX = x - actualSide * (labelHalfWidth + 8);
    item.line.setAttribute("x1", String(planetX));
    item.line.setAttribute("y1", String(planetY));
    item.line.setAttribute("x2", String(lineEndX));
    item.line.setAttribute("y2", String(y));
    item.line.style.opacity = visible && !activePlanet ? String(depth * 0.78) : "0";
  }
}

function updateCamera() {
  if (activePlanet) {
    desiredCameraTarget.copy(activePlanet.group.position);
    desiredCameraPosition.copy(activePlanet.group.position).add(new THREE.Vector3(0.4, 1.9, 3.1));
  } else if (activeSystem) {
    desiredCameraTarget.set(0, 0, 0);
    desiredCameraPosition.set(smallScreenQuery.matches ? 0 : 0.9, smallScreenQuery.matches ? 8.4 : 5.5, smallScreenQuery.matches ? 15.8 : 9.5);
  } else {
    desiredCameraTarget.set(0, 0, 0);
    desiredCameraPosition.copy(baseCameraPosition);
  }

  const easing = isReducedMotion ? 1 : 0.075;
  camera.position.lerp(desiredCameraPosition, easing);
  cameraTarget.lerp(desiredCameraTarget, easing);
  camera.lookAt(cameraTarget);
}

function showPlanetCard(item) {
  if (item.body.type !== "app") return;
  activePlanet = item;
  labelsDirty = true;
  const app = item.body.data;
  const url = appUrl(app);
  cardCode.textContent = app.code;
  cardName.textContent = app.name;
  cardKind.textContent = app.kind;
  cardDomain.textContent = new URL(url, window.location.href).host;
  cardSummary.textContent = app.summary;
  cardHighlights.replaceChildren(...app.highlights.map((highlight) => {
    const item = document.createElement("li");
    item.textContent = highlight;
    return item;
  }));
  cardLink.href = url;
  cardLink.setAttribute("aria-label", `Visit ${app.name} in a new window`);
  planetCard.classList.add("is-open");
  planetCard.setAttribute("aria-hidden", "false");
}

function closePlanetCard() {
  activePlanet = null;
  labelsDirty = true;
  planetCard.classList.remove("is-open");
  planetCard.setAttribute("aria-hidden", "true");
}

let previousTime = 0;
let previousFrameTime = 0;
function animate(now = 0) {
  if (document.hidden) {
    animationFrameId = 0;
    return;
  }

  if (previousFrameTime && now - previousFrameTime < targetFrameInterval) {
    animationFrameId = requestAnimationFrame(animate);
    return;
  }

  const frameDelta = previousFrameTime ? Math.min(now - previousFrameTime, 120) : 0;
  previousFrameTime = now;
  const time = now / 1000;
  const delta = previousTime ? frameDelta / 1000 : 0;
  previousTime = time;
  updatePlanetPositions(delta);

  if (!isReducedMotion) {
    sun.rotation.y += 0.0025;
    sunGlow.rotation.y -= 0.0018;
    sun.material.map.offset.x += 0.0008;
    sun.material.map.offset.y = Math.sin(time * 0.18) * 0.015;
    sunCorona.material.opacity = 0.045 + Math.sin(time * 1.7) * 0.015;
    sunRim.material.opacity = 0.1 + Math.sin(time * 1.3) * 0.035;
    for (const flare of sunFlares) {
      const pulse = 0.5 + Math.sin(time * 1.8 + flare.userData.phase) * 0.5;
      flare.material.opacity = 0.18 + pulse * 0.28;
      flare.scale.y = 0.95 + pulse * 0.45;
    }
    if (!activePlanet) {
      orbitRoot.rotation.y = Math.sin(time * 0.08) * 0.04;
    }
  }

  updateCamera();
  renderer.render(scene, camera);
  if (labelsDirty || now - lastLabelUpdate >= labelFrameInterval) {
    updateLabels();
    labelsDirty = false;
    lastLabelUpdate = now;
  }
  animationFrameId = requestAnimationFrame(animate);
}

function startAnimation() {
  if (animationFrameId) return;
  previousTime = 0;
  previousFrameTime = 0;
  lastLabelUpdate = 0;
  animationFrameId = requestAnimationFrame(animate);
}

function openPlanetFromPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(planets.map((item) => item.planet), false);

  if (intersections[0]?.object.userData.body) {
    const body = intersections[0].object.userData.body;
    const item = planets.find((planetItem) => planetItem.body === body);
    if (!item) return;
    if (body.type === "system") {
      focusSystem(body.data.id);
    } else {
      showPlanetCard(item);
    }
  }
}

window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  } else {
    startAnimation();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activePlanet) {
    closePlanetCard();
  } else if (event.key === "Escape" && activeSystem) {
    returnToSolarSystem();
  }
});
canvas.addEventListener("click", openPlanetFromPointer);
cardClose.addEventListener("click", closePlanetCard);
solarBack.addEventListener("click", returnToSolarSystem);
resize();
cameraTarget.set(0, 0, 0);
renderOrbitBodies();
startAnimation();
