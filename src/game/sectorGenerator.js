// sectorGenerator.js — deterministic seeded sector generator, Orbiter.
// Sector codes (SECTOR-NNN or SECTOR-NNN-WORD) decide each sector. Same code, same sector, same planet order.
// No dependencies, no DOM, so it can be tested headlessly in Node.

// Sector codes read SECTOR-NNN or SECTOR-NNN-WORD (e.g. SECTOR-082-PULSAR, SECTOR-909-BLACKHOLE). The number and the
// word decide the sector: its star, its hazards and how many planets it has.
export const GENERATOR_SEED = "SECTOR-001";

// Small deterministic hash of a string -> uint32.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 PRNG, seeded from hashSeed.
export function makeRng(seedStr) {
  let a = hashSeed(seedStr);
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BIOMES = [
  "Ocean World", "Methane Giant", "Rust Industrial", "Frozen Cryo-Sphere",
  "Volcanic", "Desert", "Jungle Biosphere", "Barren Rock", "Toxic",
  "Scorched", "Ice Drift", "Nebula Veil",
  "Continental", "Sub-Neptune", "Precursor Ruin", "Nitrogen Ice", "Crystal Shard",
];

const BASE_SECTORS = [
  {
    id: "SECTOR-082-PULSAR",
    name: "SECTOR-082-PULSAR",
    starType: "Pulsar",
    anchorType: "pulsar",
    planetCount: 4,
    hazards: ["Extreme Hazard", "Rotating beam spikes", "Extreme radiation"],
    rewards: ["High Compute"],
    description: "Extreme Hazard, High Compute",
  },
  {
    id: "SECTOR-114-VOID",
    name: "SECTOR-114-VOID",
    starType: "Starless Drift",
    anchorType: "void",
    planetCount: 3,
    hazards: ["Starless Drift", "Deep Fog", "Low solar power"],
    rewards: [],
    description: "Starless Drift, Deep Fog",
  },
  {
    id: "SECTOR-305-HYPER",
    name: "SECTOR-305-HYPER",
    starType: "Blue Supergiant",
    anchorType: "blue_hypergiant",
    planetCount: 6,
    hazards: ["Scorched Worlds", "Intense stellar wind"],
    rewards: [],
    description: "Blue Supergiant, Scorched Worlds",
  },
];

export function makePlanets(sectorId, planetCount, rng) {
  const planets = [];
  for (let i = 0; i < planetCount; i++) {
    const biome = BIOMES[Math.floor(rng() * BIOMES.length)];
    // Multiplier in 0.75..1.75, rounded to 2 decimals, deterministic per seed.
    const multiplier = Math.round((0.75 + rng() * 1.0) * 100) / 100;
    planets.push({
      id: `${sectorId}-P${i + 1}`,
      orbitRadius: 120 + i * 55,
      // Hidden until surveyed: callers must not display biome/multiplier
      // while surveyed === false. surveyPlanet() is the only reveal path.
      biome,
      multiplier,
      surveyed: false,
    });
  }
  return planets;
}

// Exactly 3 sectors, in the fixed order above, for the default seed.
// Other seeds still produce the same 3 sector templates (same ids/types/
// hazards/counts) but different planet biomes/multipliers, so the
// starchart is stable while the worlds inside vary by seed.
export function generateSectors(seed = GENERATOR_SEED) {
  return BASE_SECTORS.map((base, idx) => {
    const rng = makeRng(`${seed}:${base.id}:${idx}`);
    return {
      ...base,
      hazards: [...base.hazards],
      rewards: [...base.rewards],
      planets: makePlanets(base.id, base.planetCount, rng),
    };
  });
}

export function generateSector(sectorId, seed = GENERATOR_SEED) {
  const found = generateSectors(seed).find((s) => s.id === sectorId);
  if (!found) throw new Error(`Unknown sector: ${sectorId}`);
  return found;
}

// Public view: biome/multiplier stripped while unsurveyed.
export function publicSector(sector) {
  return {
    ...sector,
    planets: sector.planets.map((p) => ({
      id: p.id,
      orbitRadius: p.orbitRadius,
      surveyed: p.surveyed,
      biome: p.surveyed ? p.biome : null,
      multiplier: p.surveyed ? p.multiplier : null,
    })),
  };
}

// Star anchor by the word after the number in a sector code. Missing or unknown words mean a Sol-type star.
const ANCHOR_BY_WORD = {
  PULSAR: {anchorType: "pulsar", starType: "Pulsar", hazards: ["Extreme Hazard", "Rotating beam spikes", "Extreme radiation"]},
  VOID: {anchorType: "void", starType: "Starless Drift", hazards: ["Starless Drift", "Deep Fog", "Low solar power"]},
  HYPER: {anchorType: "blue_hypergiant", starType: "Blue Supergiant", hazards: ["Scorched Worlds", "Intense stellar wind"]},
  BLACKHOLE: {anchorType: "black_hole", starType: "Singularity", hazards: ["Event horizon", "Inward gravitational drift"]},
  RED: {anchorType: "red_giant", starType: "Red Supergiant", hazards: ["Coronal flares", "Tethers within orbit 2 incinerated"]},
  DWARF: {anchorType: "white_dwarf", starType: "White Dwarf", hazards: ["Low solar power", "Geothermal reliance"]},
};
const SOL_ANCHOR = {anchorType: "sol", starType: "Yellow Sol", hazards: ["Standard occlusion"]};

// Reads a sector code. Returns {code, number, word} or null when the code does not match SECTOR-NNN[-WORD].
export function parseSectorCode(code) {
  const m = /^SECTOR-(\d{3})(?:-([A-Z]+))?$/.exec(String(code ?? "").trim().toUpperCase());
  if (!m) return null;
  return {code: m[0], number: Number(m[1]), word: m[2] ?? ""};
}

// A sector built from its code alone: the star and hazards come from the anchor word, and the planet count
// from the number (3 to 6). The same code always gives the same sector.
export function sectorFromCode(code, seed = GENERATOR_SEED) {
  const parsed = parseSectorCode(code);
  if (!parsed) throw new Error(`Bad sector code: ${code}`);
  const anchor = ANCHOR_BY_WORD[parsed.word] ?? SOL_ANCHOR;
  const planetCount = 3 + (parsed.number % 4);
  const rng = makeRng(`${seed}:${parsed.code}:code`);
  return {
    id: parsed.code,
    name: parsed.code,
    starType: anchor.starType,
    anchorType: anchor.anchorType,
    planetCount,
    hazards: [...anchor.hazards],
    rewards: [],
    description: `${anchor.starType}, ${anchor.hazards[0]}`,
    planets: makePlanets(parsed.code, planetCount, rng),
  };
}
