// jumpGate.js — pure game-state functions for the Stellar Jump Gate.
// No DOM, no imports from scene.js, so it can be tested headlessly.
// State shape (plain object, mutated in place and returned):
//   {
//     research: [...],                       // preserved across jumps
//     treasury: { credits, alloys, compute }, // preserved except gate cost
//     fleet: [...ship objects],              // preserved by reference
//     currentSector: { id, starType, anchorType, planets: [...] } | null,
//     built: false,
//     beacon: null,                  // { orbitRadius } once built
//     warp: { active, phase, progress, destination } // see advanceWarp
//   }
import { generateSectors, GENERATOR_SEED } from "./sectorGenerator.js";

export const JUMP_GATE_COST = { credits: 600, alloys: 300, compute: 150 };
export const JUMP_GATE_BEACON_ORBIT_RADIUS = 340;
export const WARP_DURATION = 1.0; // slipstream phase, in seconds of game time

export function makeInitialState(overrides = {}) {
  return {
    research: [],
    treasury: { credits: 0, alloys: 0, compute: 0 },
    fleet: [],
    currentSector: null,
    built: false,
    beacon: null,
    warp: { active: false, phase: "idle", progress: 0, destination: null },
    ...overrides,
  };
}

export function canAfford(treasury, cost = JUMP_GATE_COST) {
  return (
    treasury.credits >= cost.credits &&
    treasury.alloys >= cost.alloys &&
    treasury.compute >= cost.compute
  );
}

// Deducts only if affordable. Returns { ok, reason? }.
// On refusal, treasury and built flag are left untouched.
export function buildJumpGate(state) {
  if (state.built) return { ok: false, reason: "already_built" };
  if (!canAfford(state.treasury)) return { ok: false, reason: "insufficient_funds" };
  state.treasury.credits -= JUMP_GATE_COST.credits;
  state.treasury.alloys -= JUMP_GATE_COST.alloys;
  state.treasury.compute -= JUMP_GATE_COST.compute;
  state.built = true;
  state.beacon = { orbitRadius: JUMP_GATE_BEACON_ORBIT_RADIUS };
  return { ok: true };
}

// Sector Starchart: only available once the gate is built.
export function openStarchart(state, seed = GENERATOR_SEED) {
  if (!state.built) return { ok: false, reason: "gate_not_built", sectors: [] };
  return { ok: true, sectors: generateSectors(seed) };
}

// Starts the slipstream warp. Does NOT yet change the map, research,
// treasury, or fleet — rehydration happens in advanceWarp when the
// slipstream phase completes. Destination planets are cloned fresh
// (surveyed=false) so a jump never carries surveyed state from a
// previous visit in the same object.
export function initiateJump(state, sector) {
  if (!state.built) return { ok: false, reason: "gate_not_built" };
  if (state.warp.active) return { ok: false, reason: "warp_in_progress" };
  if (!sector || !sector.id) return { ok: false, reason: "no_destination" };
  const destination = {
    ...sector,
    hazards: [...sector.hazards],
    planets: sector.planets.map((p) => ({ ...p, surveyed: false })),
  };
  state.warp = { active: true, phase: "slipstream", progress: 0, destination };
  return { ok: true };
}

// Advance the warp by dt seconds. When progress reaches 1, the map is
// rehydrated to the destination sector; research, treasury, and fleet
// object references are left unchanged (preserved, not rebuilt).
export function advanceWarp(state, dt) {
  if (!state.warp.active) return state.warp;
  state.warp.progress += dt / WARP_DURATION;
  if (state.warp.progress >= 1) {
    const destination = state.warp.destination;
    state.currentSector = destination;
    state.warp = { active: false, phase: "done", progress: 1, destination: null };
  }
  return state.warp;
}

// Survey Probe: the only way to reveal a world's biome/multiplier.
// Returns { ok, planet? , reason? } and leaves the planet unsurveyed
// on any failure (unknown id, already surveyed, no current sector).
export function surveyPlanet(state, planetId) {
  if (!state.currentSector) return { ok: false, reason: "no_current_sector" };
  const planet = state.currentSector.planets.find((p) => p.id === planetId);
  if (!planet) return { ok: false, reason: "unknown_planet" };
  if (planet.surveyed) return { ok: false, reason: "already_surveyed" };
  planet.surveyed = true;
  return { ok: true, planet };
}
