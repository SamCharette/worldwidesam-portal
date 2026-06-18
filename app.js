import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const apps = [
  { name: "Hex", kind: "strategy game", code: "HX-01", url: "https://hex.worldwidesam.net", radius: 4.5, speed: 0.1, size: 0.34, start: 0.1, color: 0x4ee7ff },
  { name: "Clawdtris", kind: "arcade stacker", code: "TR-02", url: "https://tetris.worldwidesam.net", radius: 5.45, speed: 0.082, size: 0.42, start: 1.4, color: 0xff4f8b },
  { name: "Circut Snap", kind: "puzzle lab", code: "CS-03", url: "https://circutsnap.worldwidesam.net", radius: 6.35, speed: 0.07, size: 0.38, start: 2.6, color: 0xffd166 },
  { name: "Mission Control", kind: "command center", code: "MC-04", url: "https://missioncontrol.worldwidesam.net", radius: 7.2, speed: 0.058, size: 0.48, start: 3.6, color: 0x56f5bf },
  { name: "RPG Catalog", kind: "library archive", code: "RP-06", url: "https://rpgs.worldwidesam.net", radius: 9.0, speed: 0.043, size: 0.46, start: 5.5, color: 0xff8a58 },
  { name: "Decisions Please", kind: "choice engine", code: "DP-07", url: "https://decisions.worldwidesam.net", radius: 5.95, speed: -0.064, size: 0.36, start: 5.9, color: 0x4ee7ff },
  { name: "Ypsillon Overkill Dashboard", kind: "overkill metrics", code: "YO-08", url: "https://ypsillon.worldwidesam.net", radius: 7.65, speed: -0.045, size: 0.5, start: 0.75, color: 0xff4f8b }
];

const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmallScreen = window.matchMedia("(max-width: 860px)").matches;
const canvas = document.querySelector("#orbitCanvas");
const labels = document.querySelector("#labels");
const template = document.querySelector("#labelTemplate");
const clock = document.querySelector("#clock");

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

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(1.48, 64, 64),
  new THREE.MeshBasicMaterial({
    color: 0xffc35c,
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
      color: app.color,
      emissive: app.color,
      emissiveIntensity: 0.42,
      roughness: 0.35,
      metalness: 0.24
    })
  );
  planet.userData.app = app;
  group.add(planet);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(app.size * 1.55, 32, 32),
    new THREE.MeshBasicMaterial({
      color: app.color,
      transparent: true,
      opacity: 0.16,
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
  label.querySelector(".planet-kind").textContent = app.kind;
  labels.append(label);

  planets.push({ app, group, planet, label });
}

apps.forEach(makePlanet);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;

  if (width < 860) {
    camera.position.set(0, 9.5, 14.8);
  } else if (width < 1180) {
    camera.position.set(0.7, 8.8, 14.6);
  } else {
    camera.position.set(1.7, 7.4, 13.5);
  }

  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
}

function updatePlanetPositions(time) {
  for (const item of planets) {
    const app = item.app;
    const angle = app.start + (isReducedMotion ? 0 : time * app.speed);
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
  const introGuard = width > 1100 ? 470 : 0;

  for (const item of planets) {
    if (isSmallScreen) {
      item.label.style.opacity = "1";
      continue;
    }

    vector.copy(item.group.position).project(camera);
    let x = (vector.x * 0.5 + 0.5) * width;
    const y = (vector.y * -0.5 + 0.5) * height;
    const visible = vector.z < 1 && x > -150 && x < width + 150 && y > -80 && y < height + 80;
    const depth = THREE.MathUtils.clamp(1.12 - vector.z * 0.18, 0.58, 1);
    if (introGuard && x < introGuard && y > height * 0.2 && y < height * 0.76) {
      x = introGuard;
    }

    item.label.style.left = `${x}px`;
    item.label.style.top = `${y}px`;
    item.label.style.opacity = visible ? String(depth) : "0";
    item.label.style.transform = `translate(-50%, -50%) scale(${depth})`;
  }
}

function animate(now = 0) {
  const time = now / 1000;
  updatePlanetPositions(time);

  if (!isReducedMotion) {
    sun.rotation.y += 0.0025;
    sunGlow.rotation.y -= 0.0018;
    orbitRoot.rotation.y = Math.sin(time * 0.08) * 0.04;
  }

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
    window.open(intersections[0].object.userData.app.url, "_blank", "noopener,noreferrer");
  }
}

window.addEventListener("resize", resize);
canvas.addEventListener("click", openPlanetFromPointer);
resize();
animate();
