// Star, planet and conduit definitions for the Orbiter simulation kernel.
// Same shape as orbit-business src/orbit/data.js: one plain object per body, edited here.
// Run `npm run gen` after editing; it writes src/planet_config.hpp for the C++ kernel.
//  - orbit: distance from the star (world units)      - speed: radians per tick
//  - r: body radius (hit area for weapons)            - population / yield: economy values

export const STAR = { name: 'Central Star', radius: 45, mass: 10000 };

export const PLANETS = [
  { key: 'aureus',  id: 101, name: 'Aureus Prime',  orbit: 110, angle: 0.0, speed: 0.00035, r: 14, population: 12500000, yield: 25 },
  { key: 'verdant', id: 102, name: 'Verdant Hub',   orbit: 190, angle: 1.2, speed: 0.00021, r: 18, population: 45000000, yield: 18 },
  { key: 'ferrum',  id: 103, name: 'Ferrum Ridge',  orbit: 270, angle: 3.1, speed: 0.00014, r: 16, population: 8200000,  yield: 12 },
  { key: 'kryos',   id: 104, name: 'Kryos Vault',   orbit: 360, angle: 4.8, speed: 0.00008, r: 22, population: 2100000,  yield: 8 },
];

// Simulation rate. The browser loop runs one tick per frame at 60 FPS.
export const TICKS_PER_SECOND = 60;

// Star-Killer: stage 1 is the supernova blast ring, stage 2 is the black-hole collapse.
// Values are locked in the balance table.
export const STAR_COLLAPSE = {
  ringTicks: 120,        // 2 s blast ring before the core collapses
  collapsedRadius: 12,   // black-hole event radius (locked)
  pullPerTick: 0.08,     // inward pull per tick, planets and debris (locked: 4.8 units/s)
};

// Singularity Torpedo vortex left on the target world.
export const VORTEX = {
  durationTicks: 300,    // 5 s
  radius: 75,            // pull range around the world (locked)
  pullPerTick: 1.2,      // debris pull per tick (locked)
};

// Weapons, in WeaponClass order. speed: world units per tick.
// Values marked PLACEHOLDER are not yet in the asset manifest's balance table.
// cost / reload / effect are game-layer values; the kernel reads only speed.
export const WEAPONS = [
  { key: 'thermonuclear_icbm', name: 'Titan-Buster Thermonuclear Warhead', speed: 1.8,  cost: { credits: 2500,  alloys: 1200 }, reloadSeconds: 45,  effect: 'Glasses surface; -85% pop, -75% yield' },
  { key: 'planet_cracker',     name: 'Planetary Core-Drill',               speed: 0.9,  cost: { credits: 8000,  alloys: 4500 }, reloadSeconds: 120, effect: 'Cracks within 45 units, then shatters world into an asteroid belt; -100% pop' },
  { key: 'starkiller',         name: 'Stellar Inversion Needle',           speed: 18.0, cost: { credits: 25000, alloys: 15000 }, reloadSeconds: null, effect: 'Supernova shockwave; severs all conduits; one per match' },
  { key: 'singularity_torpedo', name: 'Resonance Singularity Torpedo',     speed: 2.5,  cost: { credits: 5000,  alloys: 3000 }, reloadSeconds: 90, effect: 'Kills 100% pop; gravity vortex pulls debris for 5 s' },
];

// Drill begins the cracking stage when it is this close to its target (world units).
export const DRILL_CRACK_DISTANCE = 45.0;

// Sprite for each world state (presentation only; the kernel reports the state name).
// Keys must match WorldStatus in src/orbiter_kernel.hpp. Checked by tests/world_states.test.mjs.
export const WORLD_SPRITES = {
  ACTIVE_PRISTINE: null,                             // intact planet: its normal sprite
  CRACKING_STAGE1: 'planet_cracking_stage1.png',
  GLASSED_IRRADIATED: 'planet_nuked_wasteland.png',
  FRACTURED_DEBRIS: 'planet_shattered_debris.png',
  BLACK_HOLE_COLLAPSED: 'planet_blackhole_vortex.png',
};
export const DEBRIS_SPRITE = 'planet_dust_ring.png';  // ring left where a fractured world was
export const STAR_SPRITES = { SUPERNOVA: 'fx_supernova_ring.png', COLLAPSED: 'sun_collapsed_singularity.png' };

// Debris from a destroyed world expires after this many ticks.
export const DEBRIS = { lifetimeTicks: 20000 };

export const CONDUITS = [
  { source: 'aureus', target: 'verdant', maxLength: 320, throughput: 100 },
];
