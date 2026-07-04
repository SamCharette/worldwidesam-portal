const sites = [
  {
    id: "ash-loop",
    code: "VS-01",
    name: "Ash Loop",
    type: "settlement",
    x: 15.3,
    y: 23.1,
    symbol: "A",
    signal: "Clear",
    threat: "Low",
    summary: "A ring of salvage shacks around a broken highway exchange.",
    find: "Water filters, tire armor, map gossip.",
    hook: "A caravan vanished after buying every Geiger counter in town.",
    tags: ["trade", "salvage", "roads"]
  },
  {
    id: "dry-creek",
    code: "VS-02",
    name: "Dry Creek",
    type: "hazard",
    x: 34,
    y: 20.1,
    symbol: "D",
    signal: "Dirty",
    threat: "Medium",
    summary: "A riverbed full of cracked culverts, sinkholes, and green-glowing puddles.",
    find: "Pre-war survey stakes and half-buried warning drums.",
    hook: "The creek bed hums whenever someone brings a working radio near it.",
    tags: ["radiation", "terrain", "rumor"]
  },
  {
    id: "old-verdant",
    code: "VS-03",
    name: "Old Verdant",
    type: "settlement",
    x: 15.3,
    y: 40.6,
    symbol: "V",
    signal: "Crowded",
    threat: "Low",
    summary: "A stubborn market town rebuilt inside the shell of a civic arboretum.",
    find: "Seed vault rumors, greenhouse glass, trained medics.",
    hook: "The town's oldest tree started producing metal fruit.",
    tags: ["market", "medicine", "food"]
  },
  {
    id: "echo-yard",
    code: "VS-04",
    name: "Echo Yard",
    type: "utility",
    x: 45.7,
    y: 41,
    symbol: "E",
    signal: "Looping",
    threat: "Medium",
    summary: "A switching yard where a damaged broadcast tower repeats clipped emergency phrases.",
    find: "Copper, capacitors, signal maps.",
    hook: "One of the emergency phrases names a character by description.",
    tags: ["radio", "rail", "scrap"]
  },
  {
    id: "north-pylon",
    code: "VS-05",
    name: "North Pylon",
    type: "utility",
    x: 51.5,
    y: 21.5,
    symbol: "P",
    signal: "Strong",
    threat: "Medium",
    summary: "A high-voltage tower field that still snaps blue-white at sundown.",
    find: "Power cells, ceramic insulators, climbable high ground.",
    hook: "The pylons form a map if viewed during a storm.",
    tags: ["power", "height", "storm"]
  },
  {
    id: "silt-mine",
    code: "VS-06",
    name: "Silt Mine",
    type: "hazard",
    x: 68.6,
    y: 19.9,
    symbol: "M",
    signal: "Muffled",
    threat: "High",
    summary: "A flooded strip mine where the sludge moves too deliberately for comfort.",
    find: "Industrial pumps, ore carts, sealed lockers.",
    hook: "Miners left payroll records for people who never existed.",
    tags: ["mine", "flooded", "danger"]
  },
  {
    id: "rooster-ridge",
    code: "VS-07",
    name: "Rooster Ridge",
    type: "military",
    x: 80.1,
    y: 29.9,
    symbol: "X",
    signal: "Jammed",
    threat: "High",
    summary: "A ridge-line bunker net with trench doors disguised as farm outbuildings.",
    find: "Ammo tins, ration cards, fortified overlooks.",
    hook: "The bunkers unlock only when the morning siren plays.",
    tags: ["bunker", "weapons", "defense"]
  },
  {
    id: "cinder-clinic",
    code: "VS-08",
    name: "Cinder Clinic",
    type: "settlement",
    x: 68.6,
    y: 60.8,
    symbol: "+",
    signal: "Clear",
    threat: "Low",
    summary: "A field clinic painted in soot-black stripes to keep raiders guessing.",
    find: "Stimpaks, surgical tools, patient ledgers.",
    hook: "Patients keep recovering with memories that are not theirs.",
    tags: ["clinic", "healing", "mystery"]
  },
  {
    id: "relay-9",
    code: "VS-09",
    name: "Relay 9",
    type: "utility",
    x: 65,
    y: 43.9,
    symbol: "9",
    signal: "Piercing",
    threat: "Medium",
    summary: "A microwave relay shack surrounded by dish arrays and melted fence posts.",
    find: "Signal boosters, access codes, insulated cable.",
    hook: "A voice on the relay pays caps for weather reports from places that no longer exist.",
    tags: ["relay", "codes", "communications"]
  },
  {
    id: "the-sump",
    code: "VS-10",
    name: "The Sump",
    type: "hazard",
    x: 83.4,
    y: 52.3,
    symbol: "S",
    signal: "Wet",
    threat: "Medium",
    summary: "A sunken water plant where filtration tanks knock from the inside.",
    find: "Purifier parts, chlorine tabs, pressure valves.",
    hook: "The plant produces clean water every third night, then locks itself down.",
    tags: ["water", "plant", "locks"]
  },
  {
    id: "sunset-fuel",
    code: "VS-11",
    name: "Sunset Fuel",
    type: "settlement",
    x: 15.4,
    y: 59.2,
    symbol: "F",
    signal: "Warm",
    threat: "Low",
    summary: "A half-buried service station with a canopy patched in license plates.",
    find: "Siphon pumps, road flares, tire chains.",
    hook: "The station bell rings whenever something approaches from underground.",
    tags: ["fuel", "road", "supplies"]
  },
  {
    id: "waterworks",
    code: "VS-12",
    name: "Waterworks",
    type: "utility",
    x: 38.2,
    y: 57.3,
    symbol: "W",
    signal: "Pressurized",
    threat: "Medium",
    summary: "A concrete water station that still coughs to life when the pumps are sweet-talked.",
    find: "Purifier membranes, valve wheels, ration barrels.",
    hook: "A locked maintenance terminal marks one pipe as 'do not drink, do not listen.'",
    tags: ["water", "plant", "repairs"]
  },
  {
    id: "hollow-point",
    code: "VS-13",
    name: "Hollow Point",
    type: "military",
    x: 51.4,
    y: 62.3,
    symbol: "H",
    signal: "Watched",
    threat: "Medium",
    summary: "A low defensive camp dug into an old road bend and named after its ammunition habit.",
    find: "Ammo presses, sandbags, concealed foxholes.",
    hook: "The camp's sentries fire warning shots at the same empty hillside every night.",
    tags: ["camp", "ammo", "ambush"]
  },
  {
    id: "iron-quarry",
    code: "VS-14",
    name: "Iron Quarry",
    type: "hazard",
    x: 39.1,
    y: 77.9,
    symbol: "Q",
    signal: "Echoing",
    threat: "High",
    summary: "A terraced quarry with rust-red dust and a crane that moves after midnight.",
    find: "Blasting caps, stone cover, machine parts.",
    hook: "Someone has been carving fresh names into the quarry walls.",
    tags: ["quarry", "explosives", "night"]
  },
  {
    id: "bunker-delta",
    code: "VS-15",
    name: "Bunker Delta",
    type: "military",
    x: 20.1,
    y: 77.9,
    symbol: "B",
    signal: "Buried",
    threat: "High",
    summary: "A sealed bunker entrance below a bent service road and a field of broken signs.",
    find: "Ration crates, encrypted tags, armored door parts.",
    hook: "The keypad accepts only dates from before the war, and one date was scratched into a nearby skull.",
    tags: ["bunker", "sealed", "pre-war"]
  },
  {
    id: "wreck-7",
    code: "VS-16",
    name: "Wreck 7",
    type: "military",
    x: 59.2,
    y: 79.1,
    symbol: "7",
    signal: "Intermittent",
    threat: "Medium",
    summary: "The tail section of a cargo aircraft lying in the weeds below a scorched approach lane.",
    find: "Aviation fuel, flight recorder, parachute cloth.",
    hook: "The cockpit recorder keeps logging new flights.",
    tags: ["aircraft", "fuel", "blackbox"]
  },
  {
    id: "splinter-crossing",
    code: "VS-17",
    name: "Splinter Crossing",
    type: "settlement",
    x: 84.6,
    y: 78.2,
    symbol: "C",
    signal: "Crowded",
    threat: "Medium",
    summary: "A plank-and-rope crossing town lashed around a fractured highway ramp.",
    find: "Bridge tolls, scrap timber, caravan rumors.",
    hook: "Every repaired plank is found split again by morning, always from the underside.",
    tags: ["crossing", "trade", "bridge"]
  }
];

const typeColors = {
  settlement: "#8dff9a",
  utility: "#7ee6ff",
  hazard: "#ffc857",
  military: "#ff5f5f"
};

const markerLayer = document.querySelector("#markerLayer");
const routeLayer = document.querySelector("#routeLayer");
const siteList = document.querySelector("#siteList");
const searchInput = document.querySelector("#searchInput");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const mapStage = document.querySelector("#mapStage");
const screen = document.querySelector(".screen");
const visibleCount = document.querySelector("#visibleCount");
const threatMeter = document.querySelector("#threatMeter");
const zoomReadout = document.querySelector("#zoomReadout");

const detail = {
  code: document.querySelector("#siteCode"),
  type: document.querySelector("#siteClass"),
  name: document.querySelector("#siteName"),
  summary: document.querySelector("#siteSummary"),
  signal: document.querySelector("#siteSignal"),
  threat: document.querySelector("#siteThreat"),
  find: document.querySelector("#siteFind"),
  hook: document.querySelector("#siteHook"),
  tags: document.querySelector("#tagBank")
};

let selectedId = "ash-loop";
let activeFilter = "all";
let routeActive = false;
let zoom = 1;
let pan = { x: 0, y: 0 };
let dragStart = null;

function matchesSite(site) {
  const query = searchInput.value.trim().toLowerCase();
  const haystack = [
    site.code,
    site.name,
    site.type,
    site.signal,
    site.threat,
    site.summary,
    site.find,
    site.hook,
    ...site.tags
  ].join(" ").toLowerCase();

  return (activeFilter === "all" || site.type === activeFilter) && (!query || haystack.includes(query));
}

function renderMarkers() {
  markerLayer.innerHTML = "";

  for (const site of sites) {
    const marker = document.createElement("button");
    marker.className = "map-marker";
    marker.dataset.id = site.id;
    marker.style.left = `${site.x}%`;
    marker.style.top = `${site.y}%`;
    marker.style.setProperty("--marker-color", typeColors[site.type]);
    marker.textContent = site.symbol;
    marker.title = `${site.name} (${site.code})`;
    marker.setAttribute("aria-label", `${site.name}, ${site.type}`);
    marker.addEventListener("click", () => selectSite(site.id));
    markerLayer.append(marker);
  }
}

function renderSiteList() {
  siteList.innerHTML = "";

  for (const site of sites) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = site.id;
    button.innerHTML = `
      <code>${site.code}</code>
      <span>
        <strong>${site.name}</strong>
        <span>${site.type.toUpperCase()} / ${site.threat.toUpperCase()}</span>
      </span>
    `;
    button.addEventListener("click", () => selectSite(site.id));
    item.append(button);
    siteList.append(item);
  }
}

function updateDetails(site) {
  detail.code.textContent = site.code;
  detail.type.textContent = site.type;
  detail.name.textContent = site.name;
  detail.summary.textContent = site.summary;
  detail.signal.textContent = site.signal;
  detail.threat.textContent = site.threat;
  detail.find.textContent = site.find;
  detail.hook.textContent = site.hook;
  detail.tags.innerHTML = "";

  for (const tag of site.tags) {
    const chip = document.createElement("span");
    chip.textContent = tag;
    detail.tags.append(chip);
  }
}

function updateRoute() {
  routeLayer.innerHTML = "";

  if (!routeActive) {
    return;
  }

  const selected = sites.find((site) => site.id === selectedId);
  const visible = sites.filter((site) => site.id !== selectedId && matchesSite(site));
  const nearest = visible
    .map((site) => ({
      site,
      distance: Math.hypot(site.x - selected.x, site.y - selected.y)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((item) => item.site);

  for (const site of nearest) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const midX = (selected.x + site.x) / 2;
    const midY = Math.min(selected.y, site.y) - 8;
    path.setAttribute("class", "route-path");
    path.setAttribute("d", `M ${selected.x} ${selected.y} Q ${midX} ${midY} ${site.x} ${site.y}`);
    routeLayer.append(path);
  }
}

function updateVisibility() {
  let count = 0;
  const visibleThreats = [];

  for (const site of sites) {
    const visible = matchesSite(site);
    const marker = markerLayer.querySelector(`[data-id="${site.id}"]`);
    const button = siteList.querySelector(`[data-id="${site.id}"]`);
    const item = button?.parentElement;

    marker?.classList.toggle("hidden", !visible);
    item?.classList.toggle("hidden", !visible);

    if (visible) {
      count += 1;
      visibleThreats.push(site.threat);
    }
  }

  visibleCount.textContent = String(count);
  threatMeter.textContent = visibleThreats.includes("High") ? "HIGH" : visibleThreats.includes("Medium") ? "MED" : "LOW";
}

function updateSelection() {
  const selected = sites.find((site) => site.id === selectedId) || sites[0];
  selectedId = selected.id;

  for (const marker of markerLayer.querySelectorAll(".map-marker")) {
    marker.classList.toggle("active", marker.dataset.id === selectedId);
  }

  for (const button of siteList.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.id === selectedId);
  }

  updateDetails(selected);
}

function updateZoom() {
  mapStage.style.setProperty("--zoom", zoom.toFixed(2));
  mapStage.style.setProperty("--pan-x", `${pan.x}px`);
  mapStage.style.setProperty("--pan-y", `${pan.y}px`);
  zoomReadout.textContent = `${Math.round(zoom * 100)}%`;
}

function updateAll() {
  updateVisibility();
  updateSelection();
  updateRoute();
  updateZoom();
}

function selectSite(id) {
  selectedId = id;
  updateAll();
}

function setZoom(nextZoom) {
  zoom = Math.min(2.4, Math.max(.72, nextZoom));
  if (zoom <= 1) {
    pan = { x: 0, y: 0 };
  }
  updateZoom();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    updateAll();
  });
});

searchInput.addEventListener("input", updateAll);

document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + .18));
document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - .18));
document.querySelector("#resetView").addEventListener("click", () => {
  zoom = 1;
  pan = { x: 0, y: 0 };
  routeActive = false;
  updateAll();
});
document.querySelector("#routeScan").addEventListener("click", () => {
  routeActive = !routeActive;
  updateRoute();
});

screen.addEventListener("pointerdown", (event) => {
  if (zoom <= 1 || event.target.closest("button")) {
    return;
  }

  dragStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: pan.x,
    panY: pan.y
  };
  screen.setPointerCapture(event.pointerId);
  screen.classList.add("dragging");
});

screen.addEventListener("pointermove", (event) => {
  if (!dragStart || event.pointerId !== dragStart.pointerId) {
    return;
  }

  pan = {
    x: dragStart.panX + (event.clientX - dragStart.x) / zoom,
    y: dragStart.panY + (event.clientY - dragStart.y) / zoom
  };
  updateZoom();
});

screen.addEventListener("pointerup", (event) => {
  if (dragStart?.pointerId === event.pointerId) {
    dragStart = null;
    screen.classList.remove("dragging");
  }
});

screen.addEventListener("wheel", (event) => {
  event.preventDefault();
  setZoom(zoom + (event.deltaY > 0 ? -.1 : .1));
}, { passive: false });

renderMarkers();
renderSiteList();
updateAll();
