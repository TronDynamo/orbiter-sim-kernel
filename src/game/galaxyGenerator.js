// Procedural sector generator. A seed string always yields the same system, so a sector can be revisited or shared.
// Seeds look like "#SECTOR-001" (the Sol starting system), "#SECTOR-892-PULSAR" or "#SECTOR-VOID". Keywords in the seed
// pick the star class; any other seed rolls the anchor from its hash.

// Converts any seed to its canonical form: upper case, no leading '#', surrounding space removed.
export function normalizeSeed(input) {
  const s = String(input ?? '').trim().replace(/^#/, '').toUpperCase();
  return s || 'SECTOR-001';
}

// 32-bit FNV-1a hash of a canonical seed.
export function hashSeed(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Small seeded PRNG (mulberry32). Returns a function giving floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Central anchors. weight is the relative roll chance; radius is the drawn core size in world units.
export const STAR_CLASSES = {
  G:  {name: 'Yellow Sol',           color: '#F59E0B', radius: 45, weight: 40, mechanic: 'Predictable orbits; standard occlusion.'},
  O:  {name: 'Blue Hypergiant',     color: '#00F0FF', radius: 75, weight: 8,  mechanic: 'Massive occlusion; +50% shield regen, coolant drains 2x.'},
  M:  {name: 'Red Supergiant',      color: '#EF4444', radius: 95, weight: 12, mechanic: 'Coronal flares sweep to Orbit 2, incinerating unshielded tethers.'},
  D:  {name: 'White Dwarf',         color: '#FFFFFF', radius: 18, weight: 10, mechanic: 'Tiny occlusion; almost no solar power, relies on geothermal plants.'},
  NS: {name: 'Pulsar',              color: '#A855F7', radius: 12, weight: 8,  mechanic: 'Twin gamma beams sweep every 8 s, scrambling avionics.'},
  BH: {name: 'Singularity',         color: '#1e1b4b', radius: 22, weight: 6,  mechanic: 'Inward drift; planets decay toward the event horizon.'},
  BB: {name: 'Binary Suns',         color: '#60A5FA', radius: 35, weight: 10, mechanic: 'Two suns cast rotating blind spots.'},
  NN: {name: 'Dark Nebula',         color: '#064e3b', radius: 0,  weight: 6,  mechanic: 'No star; no occlusion; raiders spawn from dust.'},
};

// The 16 planetary archetypes, in four thermal bands from the hottest orbit to the coldest.
export const BIOMES = [
  {key: 'magma-forge',      name: 'Magma Forge World',           band: 1, color: '#7c2d12', yield: 'Magma Isotopes',         multiplier: 1.4, hazard: 'Thermal stress; needs coolant shielding'},
  {key: 'volcanic-obsidian', name: 'Volcanic Obsidian Siphon',   band: 1, color: '#1f2937', yield: 'Obsidian Glass',         multiplier: 1.2, hazard: 'Ash fallout'},
  {key: 'irradiated-glass', name: 'Irradiated Glass Desert',     band: 1, color: '#fde68a', yield: 'Irradiated Glass',       multiplier: 1.1, hazard: 'Radiation'},
  {key: 'shattered-mantle', name: 'Shattered Mantle',            band: 1, color: '#78716c', yield: 'Core Titanite',          multiplier: 2.0, hazard: 'Micro-meteorite collisions'},
  {key: 'diamondite',       name: 'Carbon Diamond Planet',       band: 2, color: '#a5f3fc', yield: 'Diamondite',             multiplier: 1.3, hazard: 'None'},
  {key: 'pelagic-ocean',    name: 'Deep Pelagic Ocean',          band: 2, color: '#0ea5e9', yield: 'Deuterium',              multiplier: 1.2, hazard: 'Tidal megawaves'},
  {key: 'methane-storm',    name: 'Toxic Methane Acid Giant',    band: 2, color: '#84cc16', yield: 'Cryo-Coolant',           multiplier: 1.2, hazard: 'Acid atmosphere'},
  {key: 'storm-gas-dwarf',  name: 'Storm Gas Dwarf',             band: 2, color: '#fb923c', yield: 'Atmospheric Propellant', multiplier: 1.1, hazard: 'Lightning arcs'},
  {key: 'fungal-jungle',    name: 'Bioluminescent Fungal Jungle', band: 3, color: '#22c55e', yield: 'Bio-Resin',             multiplier: 1.1, hazard: 'Spore clouds'},
  {key: 'living-biohive',   name: 'Living Bio-Hive World',       band: 3, color: '#16a34a', yield: 'Biomass',                multiplier: 1.3, hazard: 'Tether retaliation when over-harvested'},
  {key: 'crystal-shard',    name: 'Crystalline Shard Planet',    band: 3, color: '#c084fc', yield: 'Quantum Crystals',       multiplier: 1.3, hazard: 'Needs shielded hulls'},
  {key: 'radium-basin',     name: 'Radioactive Radium Basin',    band: 3, color: '#4ade80', yield: 'Radium Salts',           multiplier: 1.2, hazard: 'Radiation'},
  {key: 'glacial-cryo',     name: 'Glacial Cryo-Vault',          band: 4, color: '#bae6fd', yield: 'Superconductors',        multiplier: 1.1, hazard: 'Sub-zero crevasses'},
  {key: 'barren-moon',      name: 'Barren Moon Colony',          band: 4, color: '#9ca3af', yield: 'Regolith Alloys',        multiplier: 1.0, hazard: 'None'},
  {key: 'ship-graveyard',   name: 'War-Ravaged Ship Graveyard',  band: 4, color: '#57534e', yield: 'Scrap Alloys',           multiplier: 1.0, hazard: 'Drifting hulks'},
  {key: 'precursor',        name: 'Precursor Megastructure',     band: 4, color: '#facc15', yield: 'Dark Matter Cells',      multiplier: 1.5, hazard: 'Dormant defences'},
];

const PREFIXES = ['Aureus', 'Thalassa', 'Ferrum', 'Kryos', 'Aeros', 'Zephyr', 'Titan', 'Tartarus', 'Elysium', 'Valhalla', 'Selene', 'Apex', 'Gorgon', 'Chimera', 'Boreas', 'Promethium'];
const DESIGNATIONS = ['Major', 'Minor', 'Prime', 'Secundus', 'VII', 'B', 'Core', 'Shoals', 'Reach', 'Vault', 'Shroud', 'Ridge', 'Abyss'];
const SYSTEM_ROOTS = ['Regulus', 'Gliese', 'Ouroboros', 'Cygnus', 'Fenris', 'Kepler', 'Obsidian', 'Tigris', 'Hyperion', 'Vega', 'Chronos', 'Sol'];
const SYSTEM_TAILS = ['Prime', 'Voss', 'IX', 'Omega', 'Rift', '734', 'Deep', 'Reach', 'Vanguard', 'Null', 'Analytics', 'Cradle'];

// Keyword in the seed overrides the rolled anchor.
const KEYWORD_CLASS = [['PULSAR', 'NS'], ['VOID', 'NN'], ['BLACK', 'BH'], ['HYPER', 'O'], ['RED', 'M'], ['DWARF', 'D'], ['BINARY', 'BB']];

function pickWeighted(rng) {
  const entries = Object.entries(STAR_CLASSES);
  const total = entries.reduce((sum, [, c]) => sum + c.weight, 0);
  let roll = rng() * total;
  for (const [key, c] of entries) { roll -= c.weight; if (roll < 0) return key; }
  return 'G';
}

// Builds one sector from a seed. Returns {seed, name, star, planets}.
// Planets sit on circular orbits. Each orbit is spaced so neighbouring bodies never touch, even at their closest.
export function generateSector(input) {
  const seed = normalizeSeed(input);
  const rng = mulberry32(hashSeed(seed));
  let starKey = 'G';
  if (seed === 'SECTOR-001') starKey = 'G';
  else {
    const hit = KEYWORD_CLASS.find(([word]) => seed.includes(word));
    starKey = hit ? hit[1] : pickWeighted(rng);
  }
  const star = {key: starKey, ...STAR_CLASSES[starKey]};
  const name = seed === 'SECTOR-001' ? 'Sol-Analytics'
    : `${SYSTEM_ROOTS[Math.floor(rng() * SYSTEM_ROOTS.length)]}-${SYSTEM_TAILS[Math.floor(rng() * SYSTEM_TAILS.length)]}`;

  const count = 3 + Math.floor(rng() * 4);  // 3 to 6 planets
  const planets = [];
  let orbit = star.radius + 40;
  for (let i = 0; i < count; i++) {
    const band = Math.min(4, Math.floor((i * 4) / count) + 1);
    const pool = BIOMES.filter((b) => b.band === band);
    const biome = pool[Math.floor(rng() * pool.length)];
    const r = 6 + Math.floor(rng() * 9);                       // body radius 6..14
    if (i > 0) orbit += r + planets[i - 1].r + 24 + Math.floor(rng() * 40);   // never closer than the two bodies' radii plus a margin
    const speed = (0.6 * Math.pow(120 / orbit, 1.5)) / 60;     // rad per tick, Kepler-like: inner worlds run faster
    planets.push({
      id: `${seed.toLowerCase()}-p${i + 1}`,
      name: `${PREFIXES[Math.floor(rng() * PREFIXES.length)]} ${DESIGNATIONS[Math.floor(rng() * DESIGNATIONS.length)]}`,
      orbit,
      angle: rng() * Math.PI * 2,
      speed,
      r,
      band,
      biome: biome.key,
      color: biome.color,
      yield: biome.yield,
      multiplier: biome.multiplier,
      hazard: biome.hazard,
      scanned: false,   // fog of war: a probe must chart the world before its biome and multiplier show
    });
  }
  return {seed, name, star, planets};
}

// What a player may see of a planet: the biome and harvest multiplier only once it has been scanned.
export function visibleBody(planet) {
  if (!planet.scanned) return {id: planet.id, name: 'Uncharted world', scanned: false};
  return {id: planet.id, name: planet.name, scanned: true, biome: planet.biome, yield: planet.yield,
    multiplier: planet.multiplier, hazard: planet.hazard, color: planet.color};
}

// Checks a generated sector for overlaps and bad orbits. Returns a list of problems; empty means valid.
export function validateSector(sector) {
  const problems = [];
  const star = sector.star;
  if (sector.planets.length < 3 || sector.planets.length > 6) problems.push('planet count out of range');
  let prev = null;
  for (const p of sector.planets) {
    if (p.orbit - p.r <= star.radius) problems.push(`${p.id} orbits inside the star`);
    if (p.speed <= 0) problems.push(`${p.id} has no orbital speed`);
    if (prev) {
      if (p.orbit <= prev.orbit) problems.push(`${p.id} is not outside ${prev.id}`);
      if (p.orbit - prev.orbit <= p.r + prev.r) problems.push(`${p.id} and ${prev.id} can collide`);
    }
    if (prev && p.speed >= prev.speed) problems.push(`${p.id} should be slower than ${prev.id}`);
    prev = p;
  }
  return problems;
}
