// Bridge to the C++ orbit simulation (public/engine/orbit-sim.wasm, built from native/game-optimizer/orbit-sim.cpp).
// The scene calls step(dt) once per frame and reads positions straight out of WASM memory (zero-copy views).
// JsSim is a line-for-line JavaScript twin used only if WebAssembly can't load (e.g. very old browsers);
// tests/engine.test.js checks both produce the same numbers.
export const BODY_STRIDE = 12; // sx, sy, R, depth, ca, sa, Lx, Ly, Lz, lit, wx, wy
export const STAR_STRIDE = 4;  // x, y, alpha, size

class WasmSim {
  constructor(m) { this.m = m; this.kind = "C++ WebAssembly"; }
  init(stars, seed) { this.m._sim_init(stars, seed); this.views(); }
  setBodies(list) { this.m._sim_clear_bodies(); for (const b of list) this.m._sim_add_body(b.orbit, b.speed, b.phase, b.r); this.views(); }
  views() {
    const m = this.m, n = m._sim_body_count();
    this.b = new Float32Array(m.HEAPF32.buffer, m._sim_bodies(), n * BODY_STRIDE);
    this.o = new Int32Array(m.HEAP32.buffer, m._sim_order(), n);
    this.s = new Float32Array(m.HEAPF32.buffer, m._sim_stars(), (this.starTotal || 0) * STAR_STRIDE);
    this.c = new Float32Array(m.HEAPF32.buffer, m._sim_camera(), 7);
    this.st = new Float32Array(m.HEAPF32.buffer, m._sim_stats(), 8);
  }
  setView(w, h, base, panel) { this.m._sim_set_view(w, h, base, panel); }
  setParams(speed, visible, zoom, sel, orbitY, sinE) { this.m._sim_set_params(speed, visible, zoom, sel, orbitY, sinE); }
  select(i) { this.m._sim_select(i); }
  resetCamera() { this.m._sim_reset_camera(); }
  step(dt) { this.m._sim_step(dt); }
  hit(x, y) { return this.m._sim_hit(x, y); }
  starCount() { return this.m._sim_star_count(); }
}

export class JsSim {
  constructor() { this.kind = "JavaScript fallback"; this.bodies = []; this.stars = []; this.c = new Float32Array(7); this.c[4] = 1; this.st = new Float32Array(8);
    this.w = 1000; this.h = 600; this.base = 1; this.panel = 0; this.speed = 1; this.zoom = 1.6; this.sel = 1.75; this.orbitY = 0.55; this.sinE = 0.55; this.visible = 0; this.selected = -1; this.camInit = false; }
  init(count, seed) {
    let s = seed || 1234; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.stars = Array.from({length: count}, () => { const u = r(), v = r(), k = r(); const size = k < 0.08 ? 1.6 : r() < 0.4 ? 1.1 : 0.7;
      return {u, v, size, tw: r() * Math.PI * 2, tws: 0.6 + r() * 1.8, a: 0.35 + r() * 0.6, depth: 0.2 + r() * 0.8}; });
    this.s = new Float32Array(count * STAR_STRIDE); this.visible = count;
  }
  setBodies(list) { this.bodies = list.map((b) => ({orbit: b.orbit, speed: b.speed, phase: b.phase, radius: b.r, sel: 1})); this.b = new Float32Array(list.length * BODY_STRIDE); this.o = new Int32Array(list.length); this.selected = -1; }
  setView(w, h, base, panel) { this.w = w; this.h = h; this.base = base; this.panel = panel; }
  setParams(speed, visible, zoom, sel, orbitY, sinE) { Object.assign(this, {speed, visible: Math.max(0, Math.min(visible, this.stars.length)), zoom, sel, orbitY, sinE}); }
  select(i) { this.selected = i >= 0 && i < this.bodies.length ? i : -1; }
  resetCamera() { this.camInit = false; for (const b of this.bodies) b.sel = 1; }
  world(b) { const a = b.phase + this.c[5] * b.speed, ca = Math.cos(a), sa = Math.sin(a); return [ca * b.orbit, sa * b.orbit * this.orbitY, ca, sa]; }
  step(dt) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    const c = this.c; c[5] += dt * this.speed; c[6] += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    let tax = this.w * 0.5, tay = this.h * 0.52, tfx = 0, tfy = 0, tz = 1;
    if (this.selected >= 0) { const [wx, wy] = this.world(this.bodies[this.selected]); tax = (this.w - this.panel) * 0.64; tay = this.h * 0.525; tfx = wx; tfy = wy; tz = this.zoom; }
    if (!this.camInit) { c[0] = tax; c[1] = tay; c[2] = tfx; c[3] = tfy; c[4] = tz; this.camInit = true; }
    else { c[0] += (tax - c[0]) * k; c[1] += (tay - c[1]) * k; c[2] += (tfx - c[2]) * k; c[3] += (tfy - c[3]) * k; c[4] += (tz - c[4]) * k; }
    const zb = c[4] * this.base, cosE = Math.sqrt(Math.max(0, 1 - this.sinE * this.sinE));
    this.bodies.forEach((b, i) => {
      b.sel += ((i === this.selected ? this.sel : 1) - b.sel) * k;
      const [wx, wy, ca, sa] = this.world(b), o = i * BODY_STRIDE;
      this.b.set([c[0] + (wx - c[2]) * zb, c[1] + (wy - c[3]) * zb, b.radius * zb * (0.9 + 0.15 * sa) * b.sel, sa, ca, sa, -ca, sa * this.sinE, -sa * cosE, Math.max(0, -sa * 0.5 + 0.5), wx, wy], o);
      this.o[i] = i;
    });
    this.o.sort((a, b) => this.b[a * BODY_STRIDE + 3] - this.b[b * BODY_STRIDE + 3]);
    const px = c[2] * c[4] * 0.04, py = c[3] * c[4] * 0.04;
    this.stars.forEach((s, i) => {
      let x = (s.u * this.w - px * s.depth) % this.w; if (x < 0) x += this.w;
      let y = (s.v * this.h - py * s.depth) % this.h; if (y < 0) y += this.h;
      this.s.set([x, y, s.a * (0.55 + 0.45 * Math.sin(c[6] * s.tws + s.tw)), s.size], i * STAR_STRIDE);
    });
    const n = this.stars.length + this.bodies.length; this.st[0] = n; this.st[1] = n; this.st[7] = 1;
  }
  hit(x, y) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.bodies.length; i++) { const o = i * BODY_STRIDE, d = Math.hypot(this.b[o] - x, this.b[o + 1] - y); if (d < Math.max(this.b[o + 2] + 6, 12) && d < bd) { bd = d; best = i; } }
    return best;
  }
  starCount() { return this.visible; }
}

// Loads the C++ engine; resolves to a JsSim if WebAssembly is unavailable.
export async function loadSim({stars = 700, seed = 1234, moduleUrl = "/engine/orbit-sim.js", importer} = {}) {
  try {
    const mod = importer ? await importer() : await import(/* @vite-ignore */ moduleUrl);
    const m = await mod.default();
    const sim = new WasmSim(m);
    sim.starTotal = stars;
    sim.init(stars, seed);
    if (typeof performance !== "undefined") performance.mark?.("orbit:engine:wasm");
    return sim;
  } catch (e) {
    console.warn("Orbit: C++ engine unavailable, using JavaScript fallback", e);
    const sim = new JsSim(); sim.init(stars, seed); return sim;
  }
}
