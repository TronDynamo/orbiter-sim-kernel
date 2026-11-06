// Canvas renderer for the Orbit galaxies: starfield, nebula, textured sun,
// orbiting planets lit by their star, and a smooth camera that locks onto a planet.
import { sunColorOf } from './custom.js';
import { GALAXIES } from './data.js';
import { BodyRenderer } from './bodies.js';
import { loadSim, BODY_STRIDE, STAR_STRIDE } from './engine.js';

// star plasma ramps (dark → hot) and the colour of light each star casts
const STAR = {
  origin: { c: [[0.45, 0.07, 0.01], [0.93, 0.36, 0.05], [1.0, 0.7, 0.25], [1.0, 0.96, 0.82]], light: [1.0, 0.84, 0.62] },
  growth: { c: [[0.3, 0.01, 0.08], [0.82, 0.1, 0.3], [1.0, 0.45, 0.6], [1.0, 0.88, 0.92]], light: [1.0, 0.58, 0.7] },
  game: { c: [[0.45, 0.07, 0.01], [0.93, 0.36, 0.05], [1.0, 0.7, 0.25], [1.0, 0.96, 0.82]], light: [1.0, 0.84, 0.62] },
};
const SIN_E = 0.55, COS_E = Math.sqrt(1 - SIN_E * SIN_E); // camera elevation over the orbital plane

const TAU = Math.PI * 2;
const ORBIT_Y = 0.55; // ellipse squash for the tilted orbital plane
const ZOOM = 1.6;

// Camera tuning. Zoom is a range from full-system view to close inspection.
export const ZOOM_MIN = 0.3, ZOOM_MAX = 4.5;
export const ZOOM_DETAIL = 1.8;   // at or above this, ships draw as detailed hulls instead of chevrons
export const ZOOM_FOLLOW = 2.0;   // at or above this, the camera centres on the followed body
export const ZOOM_FOCUS = 3.5;    // double-click target zoom
const ZOOM_GLIDE = 7;             // zoom approach rate (1/s)
const FOCUS_GLIDE = 6;            // camera centre approach rate (1/s)

// Frame-rate independent exponential approach: after time dt the gap has closed by 1 - exp(-rate * dt).
export function easeToward(cur, target, dt, rate) {
  return cur + (target - cur) * (1 - Math.exp(-dt * rate));
}
const SEL_SCALE = 1.75; // selected planet swells as the camera locks on

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

// Seeded value noise → fbm, used for the blotchy sun surface.
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = [...Array(256).keys()].sort(() => rand() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grid = (x, y) => perm[(x & 255) + perm[y & 255]] / 255;
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = grid(xi, yi), b = grid(xi + 1, yi), c = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => {
    let v = 0, amp = 0.55, f = 1;
    for (let o = 0; o < 4; o++) { v += noise(x * f, y * f) * amp; amp *= 0.5; f *= 2.1; }
    return v;
  };
}

// Star palette derived from a custom sun colour: plasma ramp for the core and the light the planets get.
const SUN_SEED = { origin: 7, growth: 23, game: 7 };
const STAR0 = JSON.parse(JSON.stringify(STAR));
function starFromBase(base) {
  const b = base.map((v) => v / 255);
  const lift = (t) => b.map((v) => v + (1 - v) * t);
  return { c: [b.map((v) => v * 0.45), b, lift(0.45), lift(0.85)], light: lift(0.3) };
}

function makeSunTexture(sun, seed) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const fbm = makeNoise(seed);
  const F = 4.2 / H; // isotropic frequency → round blotches
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // blend with a copy shifted by W so the texture wraps seamlessly
      const t0 = x / W;
      const n = fbm(x * F, y * F) * (1 - t0) + fbm((x - W) * F, y * F) * t0;
      const t = Math.min(1, Math.max(0, (n - 0.47) * 11 + 0.5));
      const col = mix(sun.base, sun.patch, t);
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class OrbitScene {
  constructor(canvas, callbacks = {}, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;
    this.galaxies = opts.galaxies || GALAXIES;
    this.galaxyId = opts.galaxyId || 'origin';
    this.fade = 1; // 0..1 brightness for galaxy crossfade
    this.pendingGalaxy = null;
    this.selected = null;
    this.speed = 1;
    this.density = 'dense';
    this.nebulaDrift = true;
    this.panelWidth = 0; // css px of the right detail panel, for camera framing
    this.zoomUser = 0.72; // user zoom on top of the screen-fit size; 0.72 shows the whole system
    this.zoomTarget = this.zoomUser; // where the zoom glides to
    this.followFn = null; // () => {x, y} world point the camera centres on, or null
    this.camF = null;     // smoothed camera centre while following
    this.time = 0;
    this.textures = {
      origin: null,
      growth: null,
    };
    this.sunKey = {};
    this.refreshSun();
    this.hover = null;
    this.bodies = new BodyRenderer();
    this.real = 0;
    // Optional external world positions (e.g. the simulation kernel): () => [{x, y} | null] per planet index.
    this.positionSource = null;
    // All motion (orbits, camera, focus, lighting vectors, starfield) is simulated by the C++ engine.
    this.sim = null;
    this.engineReady = loadSim({ stars: 700 }).then((sim) => {
      this.sim = sim;
      sim.setBodies(this.galaxies[this.galaxyId].planets);
      if (this.selected) this.select(this.selected);
      this.cb.onEngine?.(sim.kind);
      return sim;
    });
    this.resize();
    this.setupTilt();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this._onMove = (e) => this.onMove(e);
    this._onClick = (e) => this.onClick(e);
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('click', this._onClick);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // Camera angle: 1 = looking straight down the system; lower values tip the plane toward the viewer.
  pitchBy(dy) { this.pitch = Math.max(0.35, Math.min(1, (this.pitch ?? 1) + dy * 0.0035)); }

  // Phone tilt → tiny parallax wobble (stars drift against the system). Off for prefers-reduced-motion.
  setupTilt() {
    this.tilt = { x: 0, y: 0 }; this.tiltTarget = { x: 0, y: 0 };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('DeviceOrientationEvent' in window)) return;
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    this._onTilt = (e) => {
      if (e.gamma == null || e.beta == null) return;
      const portrait = (screen.orientation?.angle ?? window.orientation ?? 0) % 180 === 0;
      const lr = portrait ? e.gamma : e.beta, fb = portrait ? e.beta - 45 : -e.gamma;
      this.tiltTarget.x = clamp(lr / 25); this.tiltTarget.y = clamp(fb / 25);
    };
    const enable = () => window.addEventListener('deviceorientation', this._onTilt);
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS asks for motion permission; it must be requested from a tap.
      this._askTilt = () => DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') enable(); }).catch(() => {});
      window.addEventListener('touchend', this._askTilt, { once: true });
    } else enable();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this._onTilt) window.removeEventListener('deviceorientation', this._onTilt);
    if (this._askTilt) window.removeEventListener('touchend', this._askTilt);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('click', this._onClick);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // scene designed on a 1000x600 stage
    this.baseRaw = Math.max(0.55, Math.min(w / 1000, h / 600));
    this.base = this.baseRaw * this.zoomUser;
  }

  // Zoom in/out by a factor. Keeps the whole solar system in reach.
  // Zoom glides toward the new level in frame(); snap skips the glide (used at load).
  zoomBy(f, snap = false) {
    this.zoomTo(this.zoomTarget * f, snap);
  }
  zoomTo(z, snap = false) {
    this.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    if (snap) { this.zoomUser = this.zoomTarget; this.base = this.baseRaw * this.zoomUser; }
  }
  // Camera follows fn() while zoomed in at or above ZOOM_FOLLOW. Pass null to release.
  setFollow(fn) {
    this.followFn = fn ?? null;
    this.pan = null; // following a body takes the camera back from a manual pan
  }

  // Drag the map: move the camera focus by a screen-space delta (px), in world units at the current zoom.
  panBy(px, py) {
    const c = this.sim.c, z = c[4] * this.base, pitch = this.pitch ?? 1;
    if (!this.pan) this.pan = { x: c[2], y: c[3] };
    this.pan.x -= px / z; this.pan.y -= py / (z * pitch);
  }

  setGalaxy(id) {
    if (id === this.galaxyId && !this.pendingGalaxy) return;
    this.ensureGalaxy(id);
    this.pendingGalaxy = id;
    this.selected = null;
  }
  // Star lighting and sun texture for a galaxy that was added at runtime (a jumped-to sector).
  // Built-in galaxies already have them; generated ones take their look from their sun colour.
  ensureGalaxy(gid) {
    const g = this.galaxies[gid];
    if (!g) return;
    if (!STAR[gid]) {
      const st = starFromBase(g.sun.base);
      STAR[gid] = {c: st.c, light: st.light};
    }
    if (!STAR0[gid]) STAR0[gid] = JSON.parse(JSON.stringify(STAR[gid]));
    if (SUN_SEED[gid] === undefined) SUN_SEED[gid] = 7;
    if (!this.textures[gid]) this.textures[gid] = makeSunTexture(g.sun, SUN_SEED[gid]);
    if (this.sunKey[gid] === undefined) this.sunKey[gid] = null;
  }
  select(id) {
    this.selected = id;
    this.sim?.select(id ? this.galaxies[this.galaxyId].planets.findIndex((q) => q.id === id) : -1);
  }

  // camera state lives in the engine: [ax, ay, fx, fy, z]
  get cam() { const c = this.sim.c; return { ax: c[0], ay: c[1], fx: c[2], fy: c[3], z: c[4] }; }

  // Camera micro-shake: kick() sets an amplitude in screen pixels that decays over a short time.
  kick(amp = 5, seconds = 0.35) {
    this.kickAmp = Math.max(this.kickAmp ?? 0, amp);
    this.kickLeft = Math.max(this.kickLeft ?? 0, seconds);
  }
  // Runs the shake down by real seconds and sets the offset for this frame.
  tickShake(rdt) {
    if (!(this.kickLeft > 0)) { this.kickX = 0; this.kickY = 0; return; }
    this.kickLeft = Math.max(0, this.kickLeft - rdt);
    const k = (this.kickAmp ?? 0) * (this.kickLeft / 0.35);
    this.kickX = (Math.random() * 2 - 1) * k; this.kickY = (Math.random() * 2 - 1) * k;
    if (this.kickLeft === 0) this.kickAmp = 0;
  }

  toScreen(wx, wy) {
    const c = this.sim.c, zb = c[4] * this.base;
    return { x: c[0] + (wx - c[2]) * zb + (this.kickX ?? 0), y: c[1] + (wy - c[3]) * zb * (this.pitch ?? 1) + (this.kickY ?? 0) };
  }

  // Place planets at the external positions for this frame: world coords (read by game logic)
  // and screen coords (read by drawPlanet), projected with the same camera the engine uses.
  // Centre the camera on the followed point, eased so it never jumps. Runs after the engine step,
  // which otherwise pulls the focus toward the selected body or the origin.
  followCamera(dt) {
    const c = this.sim.c;
    if (this.pan) { c[2] = this.pan.x; c[3] = this.pan.y; return; }
    const p = this.followFn && this.zoomUser >= ZOOM_FOLLOW ? this.followFn() : null;
    if (!p) { this.camF = null; return; }
    if (!this.camF) this.camF = {x: c[2], y: c[3]};
    this.camF.x = easeToward(this.camF.x, p.x, dt, FOCUS_GLIDE);
    this.camF.y = easeToward(this.camF.y, p.y, dt, FOCUS_GLIDE);
    c[2] = this.camF.x; c[3] = this.camF.y;
  }

  applyPositions() {
    this.kernelOrbits = false;
    if (!this.positionSource || !this.sim) return;
    const list = this.positionSource();
    if (!list) return;
    // The kernel places planets on true circles, so the tracks must be circles too (see drawOrbits).
    this.kernelOrbits = true;
    const b = this.sim.b;
    this.bodyLive = list.map((p) => !!p); // slots without a planet are unused and must not be drawn
    list.forEach((p, i) => {
      if (!p) return;
      const o = i * BODY_STRIDE;
      if (o + 11 >= b.length) return;
      b[o + 10] = p.x; b[o + 11] = p.y;
      const s = this.toScreen(p.x, p.y);
      b[o] = s.x; b[o + 1] = s.y;
    });
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // planet spin follows the game clock: half speed at 1X, full speed at 2X and 4X, stopped when paused
    this.spin = (this.spin ?? 0) + dt * (this.speed > 1 ? 1 : this.speed > 0 ? 0.5 : 0);

    if (this.pendingGalaxy) {
      this.fade = Math.max(0, this.fade - dt * 3.2);
      if (this.fade === 0) {
        this.galaxyId = this.pendingGalaxy; this.pendingGalaxy = null;
        this.sim?.setBodies(this.galaxies[this.galaxyId].planets);
        if (this.selected) this.select(this.selected);
      }
    } else if (this.fade < 1) this.fade = Math.min(1, this.fade + dt * 2.2);
    const kt = 1 - Math.exp(-dt * 4);
    this.tilt.x += (this.tiltTarget.x - this.tilt.x) * kt; this.tilt.y += (this.tiltTarget.y - this.tilt.y) * kt;

    // zoom glide: approach the target, then snap when the difference is below a pixel-level fraction
    const zGap = this.zoomTarget - this.zoomUser;
    if (Math.abs(zGap) > 1e-4) {
      this.zoomUser = easeToward(this.zoomUser, this.zoomTarget, dt, ZOOM_GLIDE);
      this.base = this.baseRaw * this.zoomUser;
    }

    if (this.sim) {
      this.sim.setView(this.w, this.h, this.base, this.panelWidth);
      this.sim.setParams(this.speed, this.density === 'dense' ? 700 : 260, ZOOM, SEL_SCALE, ORBIT_Y, SIN_E);
      this.sim.step(dt);
      this.followCamera(dt);
      this.applyPositions();
      this.real = this.sim.c[6];
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  draw() {
    const { ctx, w, h, dpr } = this;
    const g = this.galaxies[this.galaxyId];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, h);

    // faint vertical scan grid
    ctx.strokeStyle = 'rgba(120,140,200,0.025)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 9) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    ctx.stroke();

    if (!this.sim) return; // engine still loading (a few ms)
    const tx = this.tilt.x, ty = this.tilt.y;
    ctx.save(); ctx.translate(-tx * 6, -ty * 6); this.drawStars(); ctx.restore();   // far layer drifts one way…

    ctx.save(); ctx.translate(tx * 9, ty * 9);                                      // …the system the other
    ctx.globalAlpha = this.fade;
    this.drawNebula(g);
    this.drawOrbits(g);

    // depth order comes from the engine: planets behind the sun, the sun, planets in front
    const { b, o } = this.sim;
    const order = Array.from(o);
    const live = (i) => this.bodyLive ? !!this.bodyLive[i] : true;   // empty engine slots sit at the sun and would draw as a dark disc
    order.filter((i) => live(i) && b[i * BODY_STRIDE + 3] < 0).forEach((i) => this.drawPlanet(i));
    this.drawSun(g);
    order.filter((i) => live(i) && b[i * BODY_STRIDE + 3] >= 0).forEach((i) => this.drawPlanet(i));
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawStars() {
    const { ctx, w, h } = this;
    // positions, parallax and twinkle are computed by the engine (distant stars on a slower schedule)
    const s = this.sim.s, count = this.sim.starCount();
    for (let i = 0; i < count; i++) {
      const o = i * STAR_STRIDE;
      ctx.fillStyle = `rgba(220,228,255,${s[o + 2].toFixed(3)})`;
      ctx.fillRect(s[o], s[o + 1], s[o + 3], s[o + 3]);
    }
  }

  drawNebula(g) {
    const { ctx, w, h } = this;
    const sun = this.toScreen(0, 0);
    const z = this.cam.z * this.base;
    const drift = this.nebulaDrift ? this.real : 0;
    const blobs = [
      { ox: 0, oy: 0, r: 220, a: 0.22 },
      { ox: -160 + Math.sin(drift * 0.13) * 40, oy: 40 + Math.cos(drift * 0.1) * 25, r: 260, a: 0.09 },
      { ox: 180 + Math.cos(drift * 0.11) * 40, oy: -60 + Math.sin(drift * 0.09) * 25, r: 230, a: 0.07 },
    ];
    for (const b of blobs) {
      const x = sun.x + b.ox * z, y = sun.y + b.oy * z, r = b.r * z;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(g.nebula, b.a));
      grad.addColorStop(0.5, rgba(g.nebula, b.a * 0.35));
      grad.addColorStop(1, rgba(g.nebula, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawOrbits(g) {
    const { ctx } = this;
    const sun = this.toScreen(0, 0);
    const z = this.cam.z * this.base;
    // Kernel positions are circular (x = r cos a, y = r sin a), so their track is a circle (ratio 1).
    // The engine-only view places planets on the tilted ellipse, so its track keeps ORBIT_Y.
    const ratio = (this.kernelOrbits ? 1 : ORBIT_Y) * (this.pitch ?? 1);
    ctx.lineWidth = 1;
    for (const p of g.planets) {
      if (p.hidden) continue;
      ctx.strokeStyle = `rgba(160,170,220,${(0.045 * (this.orbitScale ?? 1)).toFixed(4)})`; // Settings: orbit path opacity
      ctx.beginPath();
      ctx.ellipse(sun.x, sun.y, p.orbit * z, p.orbit * ratio * z, 0, 0, TAU);
      ctx.stroke();
    }
  }

  drawSun(g) {
    const { ctx } = this;
    const s = this.toScreen(0, 0);
    const r = g.sun.radius * this.cam.z * this.base;
    // corona glow, gently flickering
    const fl = 1 + 0.06 * Math.sin(this.real * 2.3) + 0.04 * Math.sin(this.real * 5.1 + 1.3);
    const glow = ctx.createRadialGradient(s.x, s.y, r * 0.85, s.x, s.y, r * 3.4 * fl);
    glow.addColorStop(0, g.sun.glow + (0.6 * fl).toFixed(3) + ')');
    glow.addColorStop(0.3, g.sun.glow + '0.18)');
    glow.addColorStop(1, g.sun.glow + '0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 3.4 * fl, 0, TAU); ctx.fill();

    if (this.bodies.ok) {
      const st = STAR[g.id];
      this.bodies.draw(ctx, s.x, s.y, r, this.dpr, {
        kind: 0, time: this.real, rot: (this.sim ? this.sim.c[5] : this.real) * 0.07, /* rigid spin, follows Orbit Speed */ seed: g.id === 'origin' ? 3.1 : 11.7,
        c0: st.c[0], c1: st.c[1], c2: st.c[2], c3: st.c[3],
      });
      return;
    }
    // 2D fallback (no WebGL)
    ctx.save();
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.clip();
    const tex = this.textures[g.id];
    const tw = r * 4, th = r * 2;
    const off = ((this.real * 6) % tw + tw) % tw;
    for (let k = -1; k <= 1; k++) ctx.drawImage(tex, s.x - r - off + k * tw, s.y - r, tw, th);
    const shade = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r);
    shade.addColorStop(0, 'rgba(255,255,255,0.12)');
    shade.addColorStop(1, 'rgba(60,0,20,0.4)');
    ctx.fillStyle = shade;
    ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    ctx.restore();
  }

  drawPlanet(idx) {
    const { ctx } = this;
    const p = this.galaxies[this.galaxyId].planets[idx];
    const b = this.sim.b, o = idx * BODY_STRIDE;
    const s = { x: b[o], y: b[o + 1] };
    const R = b[o + 2];                         // radius incl. perspective + focus swell (engine)
    const col = hexToRgb(p.color);
    const isSel = this.selected === p.id;
    const isHover = this.hover === p.id;

    // direction of the star as seen from this planet, in view space (engine)
    const st = STAR[this.galaxyId];
    const L = [b[o + 6], b[o + 7], b[o + 8]];
    const lit = b[o + 9]; // how much of the lit face we see

    // faint atmospheric scatter, stronger when we look at the day side
    const glow = ctx.createRadialGradient(s.x, s.y, R * 0.8, s.x, s.y, R * 1.9);
    const gcol = p.molten ? [255, 96, 30] : col;
    glow.addColorStop(0, rgba(gcol, p.molten ? 0.35 : 0.12 + 0.18 * lit));
    glow.addColorStop(1, rgba(gcol, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, R * 1.9, 0, TAU); ctx.fill();

    if (this.bodies.ok) {
      const c1 = col.map((v) => v / 255);
            this.bodies.draw(ctx, s.x, s.y, R, this.dpr, {
        kind: p.molten ? 2 : 1, time: this.real, rot: this.spin * (0.22 + (idx % 4) * 0.06) + idx * 1.7, seed: 4.3 + idx * 7.1,
        bands: !p.molten && p.r >= 12 ? 5 : 0,
        c0: c1.map((v) => v * 0.32), c1, c2: c1.map((v) => v + (1 - v) * 0.55),
        light: L, lightCol: st.light,
      });
    } else {
      const light = mix(col, [255, 255, 255], 0.45);
      const dark = mix(col, [10, 4, 12], 0.85);
      const len = Math.hypot(L[0], L[1]) || 1;
      const lx = s.x + (L[0] / len) * R * 0.45, ly = s.y - (L[1] / len) * R * 0.45;
      const body = ctx.createRadialGradient(lx, ly, R * 0.05, s.x, s.y, R * 1.05);
      body.addColorStop(0, rgba(light, 1));
      body.addColorStop(0.5, rgba(col, 1));
      body.addColorStop(1, rgba(dark, 1));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, TAU); ctx.fill();
    }

    // new activity on this planet (e.g. a fresh order): expanding signal rings
    if (this.alerts?.has(p.id)) {
      for (let k = 0; k < 2; k++) {
        const ph = ((this.real * 0.6 + k * 0.5) % 1);
        ctx.strokeStyle = `rgba(255, 214, 120, ${(0.7 * (1 - ph)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, R + (6 + ph * 22) * this.base, 0, TAU); ctx.stroke();
      }
    }

    if (isSel) {
      ctx.save();
      ctx.strokeStyle = 'rgba(70,220,150,0.85)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -this.real * 8;
      ctx.beginPath(); ctx.arc(s.x, s.y, R + 10 * this.base, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  // call after planets were added/removed/recoloured
  // Re-tint the sun core, corona and star light for each galaxy from its current sun colour.
  refreshSun() {
    for (const gid of Object.keys(this.galaxies)) {
      this.ensureGalaxy(gid);
      const sun = this.galaxies[gid].sun;
      const key = sunColorOf(gid) || 'default';
      if (this.sunKey[gid] === key) continue;
      this.sunKey[gid] = key;
      if (key === 'default') {
        STAR[gid].c = STAR0[gid].c; STAR[gid].light = STAR0[gid].light;
      } else {
        const st = starFromBase(sun.base);
        STAR[gid].c = st.c; STAR[gid].light = st.light;
      }
      this.textures[gid] = makeSunTexture(sun, SUN_SEED[gid]);
    }
  }

  refreshBodies() {
    this.refreshSun();
    if (!this.sim) return;
    this.sim.setBodies(this.galaxies[this.galaxyId].planets);
    this.select(this.selected && this.planetIndex(this.selected) >= 0 ? this.selected : null);
  }

  planetIndex(id) {
    return this.galaxies[this.galaxyId].planets.findIndex((q) => q.id === id);
  }

  hit(e) {
    if (!this.sim) return null;
    const rect = this.canvas.getBoundingClientRect();
    const i = this.sim.hit(e.clientX - rect.left - this.tilt.x * 9, e.clientY - rect.top - this.tilt.y * 9);
    return i >= 0 ? this.galaxies[this.galaxyId].planets[i]?.id || null : null;
  }

  engineStats() {
    if (!this.sim) return null;
    const st = this.sim.st;
    return { engine: this.sim.kind, updated: st[0], entities: st[1], workRatio: st[7] };
  }
  onMove(e) {
    this.hover = this.locked ? null : this.hit(e);
    this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
  }
  onClick(e) {
    const id = this.hit(e);
    if (id && this.cb.onSelect) { this.cb.onSelect(id); return; }
    // Clicking the sun opens the solar overview.
    const rect = this.canvas.getBoundingClientRect();
    const sun = this.toScreen(0, 0);
    const r = this.galaxies[this.galaxyId].sun.radius * this.cam.z * this.base;
    if (Math.hypot(e.clientX - rect.left - sun.x, e.clientY - rect.top - sun.y) <= r && this.cb.onSun) this.cb.onSun();
  }
}
