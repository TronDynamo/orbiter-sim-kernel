// currentSystem.js — the star system the game layer is currently playing in.
// Boot uses the four starter worlds from galaxy.js. After a Jump Gate transit,
// the arriving sector's planets become the current system. Everything that
// draws or indexes planets should read from currentSystem(), never from the
// GAME_GALAXY constant directly.
//
// Planet ids are strings. Starter worlds keep their names ('thalassa', ...).
// Generated worlds use their sector ids ('SECTOR-082-PULSAR-P1', ...), which
// are stable across reloads because the generator is seeded.
import {GAME_GALAXY} from "./galaxy.js";

export const MIN_SYSTEM_PLANETS = 3;
export const MAX_SYSTEM_PLANETS = 6;

// Palette and size cycle for generated worlds, so they stay visually distinct.
const WORLD_COLORS = ["#7fd3ff", "#d6a84f", "#8a6a5a", "#c9ecff", "#9be38a", "#c58cff"];

const cyclic = (arr, i) => arr[i % arr.length];

// The boot system: the dying star and its four starter worlds.
export function bootSystem() {
  return GAME_GALAXY;
}

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
  }));
  return {
    id: sector.id,
    type: "sector",
    tab: sector.id,
    dot: "#7fd3ff",
    subtitle: `${sector.id} • ${sector.starType}`,
    subtitleNote: sector.description ?? "",
    sun: GAME_GALAXY.sun,
    nebula: GAME_GALAXY.nebula,
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
