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

// Debris from a destroyed world expires after this many ticks.
export const DEBRIS = { lifetimeTicks: 20000 };

export const CONDUITS = [
  { source: 'aureus', target: 'verdant', maxLength: 320, throughput: 100 },
];
