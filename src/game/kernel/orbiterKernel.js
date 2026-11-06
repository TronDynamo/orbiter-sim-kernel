// Bridge to the Orbiter simulation kernel (public/engine/orbiter_kernel.wasm, built from
// orbiter-sim-kernel with scripts/build-wasm.sh). Call tick() from the 60 FPS loop; read the
// state through the typed-array views, which point straight into WebAssembly memory.
// Capacities match the kernel's MAX_* constants.
//
// Saves: every change made from the game (conduits, snap limits, launches) is logged with the tick it
// happened on. The kernel is deterministic, so a save is the start offset plus that log: importState()
// resets the kernel, replays each change at its tick, and checks the planet positions against the save.
export const MAX = { planets: 64, conduits: 256, missiles: 128, asteroids: 1024 };
export const TICKS_PER_SECOND = 60;

// Mirrors WorldStatus in src/orbiter_kernel.hpp.
export const WORLD = { PRISTINE: 0, GLASSED: 1, FRACTURED: 2, BLACK_HOLE: 3, CRACKING: 4 };
// Mirrors WeaponClass in src/orbiter_kernel.hpp.
export const WEAPON = { ICBM: 0, CRACKER_DRILL: 1, STARKILLER: 2, SINGULARITY_TORPEDO: 3 };
// Mirrors CONDUIT_ERR_* in src/orbiter_kernel.hpp: results of addConduit that are below zero.
export const CONDUIT_ERR = { BAD_PLANET: -1, DUPLICATE: -2, TOO_LONG: -3, OCCLUDED: -4, FULL: -5 };
// Mirrors CONDUIT_RULES in config/planets.js: player conduits snap past maxLength and turn amber from amberLength.
export const CONDUIT_RULES = { maxLength: 650, amberLength: 455 };
// Mirrors STAR_* in src/orbiter_kernel.hpp: the star types a generated sector can open with.
export const STAR_TYPE = { SOL: 0, BLACK_HOLE: 1, PULSAR: 2, BLUE_HYPERGIANT: 3, VOID: 4, RED_GIANT: 5, WHITE_DWARF: 6 };

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
    this.log = [];        // changes made from the game, each stamped with the tick it happened on
    this.startOffset = 0; // ticks run before the first change (a seeded sector start)
    m._orbiter_reset();
    // Views are created once: memory does not grow, so the buffers stay valid.
    const f64 = (ptr, n) => new Float64Array(m.HEAPF64.buffer, ptr, n);
    const u8 = (ptr, n) => new Uint8Array(m.HEAPU8.buffer, ptr, n);
    const u32 = (ptr, n) => new Uint32Array(m.HEAPU8.buffer, ptr, n);
    this.planets = {
      gainTotal: f64(m._orbiter_planet_gain_total(), MAX.planets),
      flow: u8(m._orbiter_planet_flow(), MAX.planets),
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
      // Planet index each missile homes on; -1 means the central star.
      target: new Int32Array(m.HEAPU8.buffer, m._orbiter_missile_target(), MAX.missiles),
    };
    this.loadPtr = m._orbiter_load_buffer();
    this.loadBuf = f64(this.loadPtr, MAX.planets * 8);
    this.charted = u8(m._orbiter_planet_charted(), MAX.planets);
    this.asteroids = {
      x: f64(m._orbiter_asteroid_x(), MAX.asteroids),
      y: f64(m._orbiter_asteroid_y(), MAX.asteroids),
    };
  }

  reset() { this.m._orbiter_reset(); this.accumulator = 0; this.log = []; this.startOffset = 0; }
  // Starts a sector partway through its orbits: the seed picks the offset, so each sector opens at a different alignment.
  beginAt(offset) {
    this.reset();
    if (offset > 0) this.m._orbiter_tick(offset);
    this.startOffset = offset;
  }
  tick(n = 1) { this.m._orbiter_tick(n); }
  // Advance by real time in whole 1/60 s ticks, so the sim speed does not depend on frame rate.
  advance(dtSeconds) {
    this.accumulator += dtSeconds * TICKS_PER_SECOND;
    const n = Math.floor(this.accumulator);
    if (n > 0) { this.tick(n); this.accumulator -= n; }
    return n;
  }
  launch(type, x, y, targetPlanet = -1) {
    this._record({ op: "launch", type, x, y, target: targetPlanet });
    this.m._orbiter_launch(type, x, y, targetPlanet);
  }
  // Builds a conduit between two planets (indices). Returns the conduit index, or a CONDUIT_ERR code.
  addConduit(source, target) {
    const code = this.m._orbiter_conduit_add(source, target);
    if (code >= 0) this._record({ op: "add", source, target });
    return code;
  }
  // Removes a conduit by index. Returns 0, or -1 if there is none.
  removeConduit(index) {
    const r = this.m._orbiter_conduit_remove(index);
    if (r === 0) this._record({ op: "remove", index });
    return r;
  }
  // Tech tuning: raises or lowers one conduit's snap limit (the physics is unchanged).
  setConduitMaxLength(index, value) {
    this.m._orbiter_conduit_set_max_length(index, value);
    this._record({ op: "max", index, value });
  }

  // Rehydrates the kernel with a generated system: tethers, missiles and debris are cleared and the worlds are
  // replaced. Each world is {orbitRadius, angle, speed, radius, population, yieldRate}; all start uncharted.
  // Recorded in the log, so a save replays the swap at the same tick.
  loadSystem(system) {
    const op = { op: "load", starType: system.starType, starRadius: system.starRadius, planets: system.planets.map((p) => ({ orbitRadius: p.orbitRadius, angle: p.angle, speed: p.speed, radius: p.radius, population: p.population, yieldRate: p.yieldRate, eccentricity: p.eccentricity ?? 0 })) };
    if (op.planets.length > MAX.planets) return -1;
    this._record(op);
    return this._applyLoad(op);
  }
  _applyLoad(op) {
    const n = op.planets.length;
    op.planets.forEach((p, i) => {
      const b = this.loadBuf, o = i * 8;
      b[o] = i; b[o + 1] = p.orbitRadius; b[o + 2] = p.angle; b[o + 3] = p.speed;
      b[o + 4] = p.radius; b[o + 5] = p.population; b[o + 6] = p.yieldRate; b[o + 7] = p.eccentricity ?? 0;
    });
    return this.m._orbiter_load_system(op.starType, op.starRadius, n, this.loadPtr);
  }
  // Charts an uncharted world, starting its harvest. Returns 0, or -1 for an unknown or charted world.
  surveyPlanet(index) {
    const r = this.m._orbiter_survey_planet(index);
    if (r === 0) this._record({ op: "survey", index });
    return r;
  }
  isCharted(index) { return this.charted[index] === 1; }

  _record(op) { this.log.push({ t: this.tickCount, ...op }); }
  _applyRaw(op) {
    switch (op.op) {
      case "add": this.m._orbiter_conduit_add(op.source, op.target); break;
      case "remove": this.m._orbiter_conduit_remove(op.index); break;
      case "max": this.m._orbiter_conduit_set_max_length(op.index, op.value); break;
      case "launch": this.m._orbiter_launch(op.type, op.x, op.y, op.target); break;
      case "load": this._applyLoad(op); break;
      case "survey": this.m._orbiter_survey_planet(op.index); break;
      default: throw new Error(`unknown kernel op ${op.op}`);
    }
  }

  // The save form of the kernel: where it started, every change with its tick, and the planet positions to check against.
  exportState() {
    const n = this.planetCount;
    return {
      version: 1,
      startOffset: this.startOffset,
      tick: this.tickCount,
      log: this.log.map((o) => ({ ...o })),
      planetX: Array.from(this.planets.x.subarray(0, n)),
      planetY: Array.from(this.planets.y.subarray(0, n)),
    };
  }
  // Restores a save by replaying it. Returns {ok, drift}: drift is the largest planet position error against the save.
  importState(snap) {
    this.m._orbiter_reset();
    this.accumulator = 0;
    this.startOffset = snap.startOffset ?? 0;
    if (this.startOffset > 0) this.m._orbiter_tick(this.startOffset);
    for (const op of snap.log) {
      const dt = op.t - this.tickCount;
      if (dt < 0) throw new Error("save log out of order");
      if (dt > 0) this.m._orbiter_tick(dt);
      this._applyRaw(op);
    }
    const rest = snap.tick - this.tickCount;
    if (rest < 0) throw new Error("save tick is behind its log");
    if (rest > 0) this.m._orbiter_tick(rest);
    this.log = snap.log.map((o) => ({ ...o }));
    let drift = 0;
    snap.planetX.forEach((x, i) => {
      drift = Math.max(drift, Math.abs(this.planets.x[i] - x), Math.abs(this.planets.y[i] - snap.planetY[i]));
    });
    return { ok: drift < 1e-9, drift };
  }

  get planetCount() { return this.m._orbiter_planet_count(); }
  get tickCount() { return this.m._orbiter_tick_count(); }
  // Credits earned since reset (connected worlds plus conduit fees).
  get creditTotal() { return this.m._orbiter_credit_total(); }
  get conduitCount() { return this.m._orbiter_conduit_count(); }
  get missileCount() { return this.m._orbiter_missile_count(); }
  get asteroidCount() { return this.m._orbiter_asteroid_count(); }
  get starRadius() { return this.m._orbiter_star_radius(); }
  get starCollapsed() { return this.m._orbiter_star_collapsed() === 1; }
  get starSupernova() { return this.m._orbiter_star_supernova() === 1; }
  // Ticks left in the supernova blast ring (0 when there is none).
  get starBlastTicks() { return this.m._orbiter_star_blast_ticks(); }
}
