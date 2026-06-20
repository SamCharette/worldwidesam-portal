import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const apps = [
  { name: "Hex", kind: "strategy game", code: "HX-01", url: "https://hex.worldwidesam.net", radius: 4.5, speed: 0.1, size: 0.34, start: 0.1, color: 0x4ee7ff, summary: "A compact strategy game space for hex-grid experiments and tactical play.", highlights: ["Hex-grid board interactions", "Fast tactical experiments", "Public game prototype"] },
  { name: "Clawdtris", kind: "arcade stacker", code: "TR-02", url: "https://tetris.worldwidesam.net", radius: 5.45, speed: 0.082, size: 0.42, start: 1.4, color: 0xff4f8b, summary: "A bright block-stacking arcade build with quick restarts and score-chasing energy.", highlights: ["Classic falling-block rhythm", "Immediate restart loop", "Keyboard-first arcade feel"] },
  { name: "Circuit Snap", kind: "puzzle lab", code: "CS-03", url: "https://circutsnap.worldwidesam.net", radius: 6.35, speed: 0.07, size: 0.38, start: 2.6, color: 0xffd166, summary: "A circuit-flavored puzzle lab for snapping together logic, patterns, and tiny sparks of order.", highlights: ["Logic puzzle experiments", "Circuit-board visual language", "Small, focused challenge loops"] },
  { name: "Mission Control", kind: "command center", code: "MC-04", url: "https://missioncontrol.worldwidesam.net", radius: 7.2, speed: 0.058, size: 0.48, start: 3.6, color: 0x56f5bf, summary: "The operational dashboard for Clawdia-facing status, tools, and command-center experiments.", highlights: ["Assistant status surfaces", "Workspace tools and readouts", "Command-center UI experiments"] },
  { name: "RPG Catalog", kind: "library archive", code: "RP-06", url: "https://rpgs.worldwidesam.net", radius: 9.0, speed: 0.043, size: 0.46, start: 5.5, color: 0xff8a58, summary: "A public archive surface for RPG library and catalog artifacts.", highlights: ["Collection browsing", "Archive-oriented presentation", "Public library artifacts"] },
  { name: "Decisions Please", kind: "choice engine", code: "DP-07", url: "https://decisions.worldwidesam.net", radius: 5.95, speed: -0.064, size: 0.36, start: 5.9, color: 0x4ee7ff, summary: "A lightweight decision helper for turning options into an actual next move.", highlights: ["Option comparison", "Small decision workflows", "Fast answer-oriented interface"] },
  { name: "Ypsillon Overkill Dashboard", kind: "overkill metrics", code: "YO-08", url: "https://ypsillon.worldwidesam.net", radius: 7.65, speed: -0.045, size: 0.5, start: 0.75, color: 0xff4f8b, summary: "A dashboard for delightfully excessive Ypsillon tracking and metrics.", highlights: ["Metric-heavy dashboard surface", "Overkill tracking experiments", "Dense operational readouts"] },
  { name: "Orbital Slingshot", kind: "gravity toy", code: "OS-09", url: "https://slingshot.worldwidesam.net/", radius: 8.35, speed: 0.052, size: 0.4, start: 4.6, color: 0x8df0a6, summary: "A drag-and-release gravity slingshot toy with curved trajectories, target rings, and flashy probe trails.", highlights: ["Drag to aim and release", "Visible gravity-bent trajectories", "Standalone local service on port 4320"] },
  { name: "Marvel Champions Runner", kind: "table helper", code: "MR-10", url: "https://marvel.worldwidesam.net/", radius: 9.7, speed: -0.038, size: 0.44, start: 2.1, color: 0x2f7dff, summary: "A standalone Marvel Champions villain runner for keeping encounter flow, threat, health, and setup readable at the table.", highlights: ["New Game, Setup, Play, Board, Reference, and Guide tabs", "Browser-local table state", "Standalone local service on port 4321"] },
  { name: "Foundry VTT", kind: "virtual tabletop", code: "FV-11", url: "https://foundry.worldwidesam.net/", radius: 10.45, speed: 0.032, size: 0.5, start: 3.15, color: 0xb38cff, summary: "The full virtual tabletop for sessions, maps, character sheets, journals, dice, and campaign prep.", highlights: ["Live session tabletop", "Maps, sheets, journals, and dice", "Foundry service on port 30000"] }
];

const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmallScreen = window.matchMedia("(max-width: 860px)").matches;
const canvas = document.querySelector("#orbitCanvas");
const labels = document.querySelector("#labels");
const labelLines = document.querySelector("#labelLines");
const template = document.querySelector("#labelTemplate");
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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x07080d, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);
scene.fog = new THREE.Fog(0x07080d, 12, 34);

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
camera.position.set(0, 7.4, 13.5);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0x8fb8ff, 0.72);
scene.add(ambient);

const sunLight = new THREE.PointLight(0xffa64d, 2.4, 18, 2);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

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

function makePlanetTexture(app) {
  const random = seededRandom(app.code);
  return makeCanvasTexture(256, (context, size) => {
    const base = colorStyle(app.color, -0.06);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 4) {
      const wave = Math.sin(y * 0.05 + random() * 4) * 18;
      const alpha = 0.08 + random() * 0.16;
      context.fillStyle = y % 16 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      context.fillRect(wave, y, size, 3);
    }

    for (let patch = 0; patch < 28; patch += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 8 + random() * 34;
      const shade = random() > 0.48 ? colorStyle(app.color, 0.5) : colorStyle(app.color, -0.52);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `${shade}d6`);
      gradient.addColorStop(1, `${shade}00`);
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(x, y, radius * (0.55 + random()), radius * (0.28 + random() * 0.6), random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    for (let crater = 0; crater < 18; crater += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 2 + random() * 8;
      context.strokeStyle = "rgba(255,255,255,0.24)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "rgba(0,0,0,0.2)";
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
  new THREE.SphereGeometry(1.48, 64, 64),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: makeSunTexture()
  })
);
sunGroup.add(sun);

const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1.72, 64, 64),
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
  new THREE.SphereGeometry(2.05, 64, 64),
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
  new THREE.SphereGeometry(1.56, 64, 64),
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
let orbitTime = 0;

function makeOrbit(radius, color) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.62, 0, Math.PI * 2);
  const points = curve.getPoints(180).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.24 });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.x = -0.08;
  orbitRoot.add(line);
}

function makePlanet(app) {
  makeOrbit(app.radius, app.color);

  const group = new THREE.Group();
  group.userData.app = app;
  orbitRoot.add(group);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(app.size, 36, 36),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: makePlanetTexture(app),
      emissive: app.color,
      emissiveIntensity: 0.08,
      roughness: 0.84,
      metalness: 0.02
    })
  );
  planet.userData.app = app;
  group.add(planet);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(app.size * 1.55, 32, 32),
    new THREE.MeshBasicMaterial({
      color: app.color,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(glow);

  const label = template.content.firstElementChild.cloneNode(true);
  label.href = app.url;
  label.setAttribute("aria-label", `Open ${app.name} in a new window`);
  label.querySelector(".planet-code").textContent = app.code;
  label.querySelector(".planet-name").textContent = app.name;
  labels.append(label);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("label-line");
  line.setAttribute("stroke", `#${app.color.toString(16).padStart(6, "0")}`);
  labelLines.append(line);

  planets.push({ app, group, planet, label, line });
}

apps.forEach(makePlanet);

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
}

function updatePlanetPositions(delta) {
  if (!activePlanet && !isReducedMotion) {
    orbitTime += delta;
  }

  for (const item of planets) {
    const app = item.app;
    const angle = app.start + (isReducedMotion ? 0 : orbitTime * app.speed);
    const x = Math.cos(angle) * app.radius;
    const z = Math.sin(angle) * app.radius * 0.62;
    const y = Math.sin(angle * 1.8 + app.radius) * 0.22;

    item.group.position.set(x, y, z);
    item.planet.rotation.y += isReducedMotion ? 0 : 0.008;
  }
}

function updateLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const vector = new THREE.Vector3();
  const planetPoint = new THREE.Vector3();
  const introGuard = width > 1100 ? 700 : 0;
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
    const labelSide = planetX > width * 0.5 ? 1 : -1;
    let x = planetX + labelSide * THREE.MathUtils.clamp(width * 0.085, 84, 132);
    const y = planetY + THREE.MathUtils.clamp((0.5 - vector.y) * 32, -28, 28);
    const visible = vector.z < 1 && x > -150 && x < width + 150 && y > -80 && y < height + 80;
    const depth = THREE.MathUtils.clamp(1.12 - vector.z * 0.18, 0.58, 1);
    if (introGuard && x < introGuard && y > height * 0.2 && y < height * 0.76) {
      x = introGuard;
    }

    item.label.style.left = `${x}px`;
    item.label.style.top = `${y}px`;
    item.label.style.opacity = visible && !activePlanet ? String(depth) : "0";
    item.label.style.transform = `translate(-50%, -50%) scale(${depth})`;
    item.label.classList.toggle("is-active", item === activePlanet);

    const lineEndX = x - labelSide * 86 * depth;
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
  activePlanet = item;
  const { app } = item;
  cardCode.textContent = app.code;
  cardName.textContent = app.name;
  cardKind.textContent = app.kind;
  cardDomain.textContent = new URL(app.url).hostname;
  cardSummary.textContent = app.summary;
  cardHighlights.replaceChildren(...app.highlights.map((highlight) => {
    const item = document.createElement("li");
    item.textContent = highlight;
    return item;
  }));
  cardLink.href = app.url;
  cardLink.setAttribute("aria-label", `Visit ${app.name} in a new window`);
  planetCard.classList.add("is-open");
  planetCard.setAttribute("aria-hidden", "false");
}

function closePlanetCard() {
  activePlanet = null;
  planetCard.classList.remove("is-open");
  planetCard.setAttribute("aria-hidden", "true");
}

let previousTime = 0;
function animate(now = 0) {
  const time = now / 1000;
  const delta = previousTime ? time - previousTime : 0;
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
  updateLabels();
  requestAnimationFrame(animate);
}

function openPlanetFromPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(planets.map((item) => item.planet), false);

  if (intersections[0]?.object.userData.app) {
    const item = planets.find((planetItem) => planetItem.app === intersections[0].object.userData.app);
    if (item) {
      showPlanetCard(item);
    }
  }
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activePlanet) {
    closePlanetCard();
  }
});
canvas.addEventListener("click", openPlanetFromPointer);
cardClose.addEventListener("click", closePlanetCard);
resize();
cameraTarget.set(0, 0, 0);
animate();
