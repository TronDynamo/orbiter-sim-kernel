// Bridge to the Orbiter simulation kernel (public/engine/orbiter_kernel.wasm, built from
// orbiter-sim-kernel with scripts/build-wasm.sh). Call tick() from the 60 FPS loop; read the
// state through the typed-array views, which point straight into WebAssembly memory.
// Capacities match the kernel's MAX_* constants.
export const MAX = { planets: 64, conduits: 256, missiles: 128, asteroids: 1024 };
export const TICKS_PER_SECOND = 60;

// Mirrors WorldStatus in src/orbiter_kernel.hpp.
export const WORLD = { PRISTINE: 0, GLASSED: 1, FRACTURED: 2, BLACK_HOLE: 3, CRACKING: 4 };
// Mirrors WeaponClass in src/orbiter_kernel.hpp.
export const WEAPON = { ICBM: 0, CRACKER_DRILL: 1, STARKILLER: 2, SINGULARITY_TORPEDO: 3 };
// Mirrors CONDUIT_ERR_* in src/orbiter_kernel.hpp: results of addConduit that are below zero.
export const CONDUIT_ERR = { BAD_PLANET: -1, DUPLICATE: -2, TOO_LONG: -3, OCCLUDED: -4, FULL: -5 };
// Mirrors CONDUIT_RULES in config/planets.js: player conduits snap past maxLength and turn amber from amberLength.
export const CONDUIT_RULES = { maxLength: 440, amberLength: 340 };

// Vite will not import files from public/ as modules in dev, so the module is fetched and imported
// through a blob URL. The WebAssembly file is located explicitly, so this works in dev and in builds.
export async function loadOrbiterKernel(base = "/engine/") {
  const res = await fetch(base + "orbiter_kernel.mjs");
  if (!res.ok) throw new Error(`kernel module HTTP ${res.status}`);
  const url = URL.createObjectURL(new Blob([await res.text()], { type: "text/javascript" }));
  try {
    const { default: create } = await import(/* @vite-ignore */ url);
    return new OrbiterKernel(await create({ locateFile: (file) => base + file }));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class OrbiterKernel {
  constructor(m) {
    this.m = m;
    this.accumulator = 0;
    m._orbiter_reset();
    // Views are created once: memory does not grow, so the buffers stay valid.
    const f64 = (ptr, n) => new Float64Array(m.HEAPF64.buffer, ptr, n);
    const u8 = (ptr, n) => new Uint8Array(m.HEAPU8.buffer, ptr, n);
    const u32 = (ptr, n) => new Uint32Array(m.HEAPU8.buffer, ptr, n);
    this.planets = {
      x: f64(m._orbiter_planet_x(), MAX.planets),
      y: f64(m._orbiter_planet_y(), MAX.planets),
      orbitRadius: f64(m._orbiter_planet_orbit_radius(), MAX.planets),
      population: f64(m._orbiter_planet_population(), MAX.planets),
      status: u8(m._orbiter_planet_status(), MAX.planets),
      vortexTicks: u32(m._orbiter_planet_vortex_ticks(), MAX.planets),
    };
    this.conduits = {
      source: u32(m._orbiter_conduit_source(), MAX.conduits),
      target: u32(m._orbiter_conduit_target(), MAX.conduits),
      throughput: f64(m._orbiter_conduit_throughput(), MAX.conduits),
      length: f64(m._orbiter_conduit_length(), MAX.conduits),
      maxLength: f64(m._orbiter_conduit_max_length(), MAX.conduits),
      snapped: u8(m._orbiter_conduit_snapped(), MAX.conduits),
      occluded: u8(m._orbiter_conduit_occluded(), MAX.conduits),
      surge: u8(m._orbiter_conduit_surge(), MAX.conduits),
    };
    this.missiles = {
      x: f64(m._orbiter_missile_x(), MAX.missiles),
      y: f64(m._orbiter_missile_y(), MAX.missiles),
      active: u8(m._orbiter_missile_active(), MAX.missiles),
      type: u8(m._orbiter_missile_type(), MAX.missiles),
    };
    this.asteroids = {
      x: f64(m._orbiter_asteroid_x(), MAX.asteroids),
      y: f64(m._orbiter_asteroid_y(), MAX.asteroids),
    };
  }

  reset() { this.m._orbiter_reset(); this.accumulator = 0; }
  tick(n = 1) { this.m._orbiter_tick(n); }
  // Advance by real time in whole 1/60 s ticks, so the sim speed does not depend on frame rate.
  advance(dtSeconds) {
    this.accumulator += dtSeconds * TICKS_PER_SECOND;
    const n = Math.floor(this.accumulator);
    if (n > 0) { this.tick(n); this.accumulator -= n; }
    return n;
  }
  launch(type, x, y, targetPlanet = -1) { this.m._orbiter_launch(type, x, y, targetPlanet); }
  // Builds a conduit between two planets (indices). Returns the conduit index, or a CONDUIT_ERR code.
  addConduit(source, target) { return this.m._orbiter_conduit_add(source, target); }
  // Removes a conduit by index. Returns 0, or -1 if there is none.
  removeConduit(index) { return this.m._orbiter_conduit_remove(index); }

  get tickCount() { return this.m._orbiter_tick_count(); }
  get planetCount() { return this.m._orbiter_planet_count(); }
  get conduitCount() { return this.m._orbiter_conduit_count(); }
  get missileCount() { return this.m._orbiter_missile_count(); }
  get asteroidCount() { return this.m._orbiter_asteroid_count(); }
  get starRadius() { return this.m._orbiter_star_radius(); }
  get starCollapsed() { return this.m._orbiter_star_collapsed() === 1; }
  get starSupernova() { return this.m._orbiter_star_supernova() === 1; }
}
