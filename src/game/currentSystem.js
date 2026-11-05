// currentSystem.js — the star system the game layer is currently playing in.
// Boot uses the four starter worlds from galaxy.js. After a Jump Gate transit,
// the arriving sector's planets become the current system. Everything that
// draws or indexes planets should read from currentSystem(), never from the
// GAME_GALAXY constant directly.
//
// Planet ids are strings. Starter worlds keep their names ('thalassa', ...).
// Generated worlds use their sector ids ('SECTOR-082-PULSAR-P1', ...), which
// are stable across reloads because the generator is seeded.
import {GAME_GALAXY, NAMES} from "./galaxy.js";
import {sectorFromCode} from "./sectorGenerator.js";
import {STAR_TYPE} from "./kernel/orbiterKernel.js";

export const MIN_SYSTEM_PLANETS = 3;
export const MAX_SYSTEM_PLANETS = 6;

// Palette and size cycle for generated worlds, so they stay visually distinct.
const WORLD_COLORS = ["#7fd3ff", "#d6a84f", "#8a6a5a", "#c9ecff", "#9be38a", "#c58cff"];

const cyclic = (arr, i) => arr[i % arr.length];

// The boot system: the dying star and its four starter worlds.
export function bootSystem() {
  return {...GAME_GALAXY, home: "ferrum"};
}

// Starter worlds keep their established resource.
export const STARTER_RESOURCE = {thalassa: "biomass", aeros: "cryo", kryos: "compute", ferrum: "alloys"};

// Biome-derived production for generated worlds. The yield is the kernel's harvest rate once the world
// is surveyed, the same scale as the starter worlds. Only the first resource of each pair is wired.
export const YIELD_CLASSES = {
  pelagic: {resource: "biomass", yield: 15, label: "Pelagic Ocean"},
  methane: {resource: "cryo", yield: 12, label: "Methane Giant"},
  basalt: {resource: "alloys", yield: 10, label: "Oxidized Iron / Basalt"},
  cryo: {resource: "compute", yield: 8, label: "Cryo-Glacier"},
  rare: {resource: "credits", yield: 14, label: "Carbon Diamond / Rare"},
};
// Sector biome name -> yield class. Desert, Scorched, Toxic and Jungle are assigned to the nearest class.
export const BIOME_CLASS = {
  "Ocean World": "pelagic", "Jungle Biosphere": "pelagic",
  "Methane Giant": "methane", "Toxic": "methane",
  "Rust Industrial": "basalt", "Volcanic": "basalt", "Barren Rock": "basalt", "Desert": "basalt", "Scorched": "basalt",
  "Frozen Cryo-Sphere": "cryo", "Ice Drift": "cryo",
  "Nebula Veil": "rare",
};
export function yieldClassOf(biome) {
  return YIELD_CLASSES[BIOME_CLASS[biome]] ?? YIELD_CLASSES.basalt;
}

export function resourceFor(system, index) {
  const p = system.planets[index];
  if (!p) return null;
  return STARTER_RESOURCE[p.id] ?? p.resource;
}

// Kernel star type and core radius per anchor. Radii match the design sheet; void is 0 (no central star).
const STAR_BY_ANCHOR = {
  sol: [STAR_TYPE.SOL, 44], black_hole: [STAR_TYPE.BLACK_HOLE, 22], pulsar: [STAR_TYPE.PULSAR, 12],
  blue_hypergiant: [STAR_TYPE.BLUE_HYPERGIANT, 75], void: [STAR_TYPE.VOID, 0],
  red_giant: [STAR_TYPE.RED_GIANT, 95], white_dwarf: [STAR_TYPE.WHITE_DWARF, 18],
};

// Sun look per anchor, from the design sheet: each class reads as its own star in the map.
const SUN_BY_ANCHOR = {
  sol: {base: [245, 158, 11], patch: [255, 200, 90], glow: "rgba(245,158,11,", radius: 44},
  black_hole: {base: [60, 20, 90], patch: [124, 58, 237], glow: "rgba(124,58,237,", radius: 22},
  pulsar: {base: [34, 211, 238], patch: [165, 243, 252], glow: "rgba(34,211,238,", radius: 12},
  blue_hypergiant: {base: [0, 240, 255], patch: [160, 250, 255], glow: "rgba(0,240,255,", radius: 40},
  void: {base: [16, 185, 129], patch: [110, 231, 183], glow: "rgba(16,185,129,", radius: 30},
  red_giant: {base: [239, 68, 68], patch: [252, 165, 165], glow: "rgba(239,68,68,", radius: 50},
  white_dwarf: {base: [230, 235, 245], patch: [255, 255, 255], glow: "rgba(230,235,245,", radius: 18},
};

// The payload for kernel.loadSystem(...). Angles and speeds are per tick (game speed / 60).
// Yield is pending: the kernel pays it out only once a Survey Probe charts the world.
export function kernelSystemFromSector(sector, system = systemFromSector(sector)) {
  const [starType, starRadius] = STAR_BY_ANCHOR[sector.anchorType] ?? STAR_BY_ANCHOR.sol;
  return {
    starType,
    starRadius,
    planets: system.planets.map((p, i) => {
      const mult = sector.planets[i].multiplier;
      return {
        orbitRadius: p.orbit,
        angle: p.phase,
        speed: p.speed / 60,
        radius: p.r,
        population: Math.round(60 + 40 * mult),
        yieldRate: p.yield,
      };
    }),
  };
}

// The game-side state a system needs: planet ids and names, resource per world, the home world, and
// survey flags (all uncharted on arrival). Written onto the game state on every jump.
export function systemState(system) {
  const ids = planetIds(system);
  const names = {...NAMES};
  const planetRes = {};
  const surveyed = {};
  system.planets.forEach((p, i) => {
    names[p.id] = p.name;
    planetRes[p.id] = resourceFor(system, i);
    surveyed[p.id] = false;
  });
  return {planetIds: ids, planetNames: names, planetRes, surveyed, homePlanet: system.home ?? ids[0]};
}

// Sends ships that were in orbit or flight around the old system's worlds back to the new home world.
export function rehomeFleet(fleet, system) {
  const ids = new Set(planetIds(system));
  const home = system.home ?? system.planets[0].id;
  for (const f of fleet) {
    if (!f.planet || ids.has(f.planet) && f.mode === "orbit") continue;
    f.mode = "orbit"; f.planet = home; f.ang = 0; f.from = null; f.to = null; f.p = 0; f.thrust = 0; f.res = null;
  }
}

// Starchart destinations: the three base sectors come from openStarchart; this is the fourth, reachable only from here.
export const EXTRA_DESTINATIONS = ["SECTOR-909-BLACKHOLE"];
export function extraDestinations() { return EXTRA_DESTINATIONS.map((code) => sectorFromCode(code)); }

// Builds a galaxy-shaped system from a generated sector. The result has the
// same shape as GAME_GALAXY, so scene.js and the map renderer accept it as is.
export function systemFromSector(sector) {
  if (!sector || !Array.isArray(sector.planets) || sector.planets.length === 0) {
    throw new Error("systemFromSector: sector has no planets");
  }
  const count = Math.min(MAX_SYSTEM_PLANETS, Math.max(MIN_SYSTEM_PLANETS, sector.planets.length));
  const planets = sector.planets.slice(0, count).map((p, i) => ({
    id: p.id,
    name: `${sector.id} ${romanOrdinal(i + 1)}`,
    tag: romanOrdinal(i + 1),
    color: cyclic(WORLD_COLORS, i),
    r: 10 + (i % 3),
    orbit: p.orbitRadius,
    speed: 0.35 / Math.sqrt(p.orbitRadius / 100), // inner worlds faster, as in the starter system
    phase: (i * 2.1) % (Math.PI * 2),
    inner: i < 2,
    biome: p.biome,
    yield: yieldClassOf(p.biome).yield,
    resource: yieldClassOf(p.biome).resource,
    yieldLabel: yieldClassOf(p.biome).label,
  }));
  return {
    id: sector.id,
    type: "sector",
    tab: sector.id,
    dot: "#7fd3ff",
    subtitle: `${sector.id} • ${sector.starType}`,
    subtitleNote: sector.description ?? "",
    sun: SUN_BY_ANCHOR[sector.anchorType] ?? GAME_GALAXY.sun,
    nebula: SUN_BY_ANCHOR[sector.anchorType]?.base ?? GAME_GALAXY.nebula,
    planets,
  };
}

// Index of a planet by its string id, or -1. Used by tether validation, drag
// and decoupling in place of hard-coded indices.
export function planetIndex(system, id) {
  return system.planets.findIndex((p) => p.id === id);
}

export function planetIds(system) {
  return system.planets.map((p) => p.id);
}

// Name lookup for labels and governor tabs. Falls back to the id itself.
export function planetName(system, id) {
  return system.planets.find((p) => p.id === id)?.name ?? id;
}

function romanOrdinal(n) {
  const table = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}
