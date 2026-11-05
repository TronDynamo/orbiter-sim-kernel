// Pseudo-3D ship rendering: heading buckets, roll banking, Sol Core lighting and detached ion plumes.
// No pre-rendered 32-angle sprite strips are shipped yet, so frames are drawn procedurally; directionBucket() is the
// index a strip would be sampled with once the art exists.
import {drawShip, DESIGN, FLIGHT_LENGTH} from "./ships.js";

export const DIRECTIONS = 32;
export const ROLL_MAX = 0.8;     // radians: maximum bank angle
export const ROLL_GAIN = 14;     // bank per radian of heading change per tick
const TAU = Math.PI * 2;

export const wrapAngle = (a) => {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x < -Math.PI) x += TAU;
  return x;
};

// Maps an angle onto one of n equal buckets (0..n-1). Bucket 0 faces +x.
export function directionBucket(theta, n = DIRECTIONS) {
  const t = ((theta % TAU) + TAU) % TAU;
  return Math.round((t / TAU) * n) % n;
}

// Velocity-driven bank: records the travel direction and eases the roll toward the turn rate.
// vx, vy: displacement this step; ticks: kernel ticks elapsed.
export function bankShip(f, vx, vy, ticks) {
  const speed = Math.hypot(vx, vy);
  if (speed < 1e-6) { f.roll = (f.roll ?? 0) * 0.9; return; }
  const theta = Math.atan2(vy, vx);
  if (f.prevTheta === undefined) f.prevTheta = theta;
  const turn = wrapAngle(theta - f.prevTheta) / Math.max(1, ticks);
  f.prevTheta = theta;
  f.theta = theta;
  f.bucket = directionBucket(theta);
  const target = Math.max(-ROLL_MAX, Math.min(ROLL_MAX, turn * ROLL_GAIN));
  f.roll = (f.roll ?? 0) + (target - (f.roll ?? 0)) * Math.min(1, 0.25 * Math.max(1, ticks));
}

// Direction from the ship to the star, expressed in the ship's own frame (lx forward, ly lateral).
export function sunLocal(x, y, heading, sun) {
  const dx = sun.x - x, dy = sun.y - y, d = Math.hypot(dx, dy) || 1;
  const c = Math.cos(heading), s = Math.sin(heading);
  return {lx: (dx * c + dy * s) / d, ly: (-dx * s + dy * c) / d};
}

// Hull with a keel ghost (depth), star-lit flank, and a bridge highlight nudged toward Sol Core.
// opts: length (px), thrust (0..1, drives the engine flare glow), roll (radians), sunDir (from sunLocal).
export function drawPseudo3DShip(ctx, type, x, y, heading, opts = {}) {
  const length = opts.length ?? FLIGHT_LENGTH[type] ?? 20;
  const roll = opts.roll ?? 0;
  const L = opts.sunDir ?? {lx: 0, ly: 0};
  const s = length / DESIGN;
  const lit = Math.max(0, L.ly);           // how strongly the star reaches the +y (port) flank
  const dark = Math.max(0, -L.ly);         // ...or the -y (starboard) flank
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(1, Math.cos(roll));            // kinetic bank: compress the lateral axis

  // keel layer: a dim ghost pushed away from the star reads as thickness under the hull
  ctx.save();
  ctx.globalAlpha = 0.3;
  drawShip(ctx, type, -L.lx * 1.6, -L.ly * 1.6, 0, {length, thrust: 0});
  ctx.restore();

  drawShip(ctx, type, 0, 0, 0, {length, thrust: 0});

  // starlight on the flank that faces Sol Core; the far flank sinks into shadow
  const h = 20 * s;
  const g = ctx.createLinearGradient(0, -h, 0, h);
  if (L.ly >= 0) {
    g.addColorStop(0, `rgba(2,6,23,${(0.35 + 0.4 * lit).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,190,120,${(0.08 + 0.45 * lit).toFixed(3)})`);
  } else {
    g.addColorStop(0, `rgba(255,190,120,${(0.08 + 0.45 * dark).toFixed(3)})`);
    g.addColorStop(1, `rgba(2,6,23,${(0.35 + 0.4 * dark).toFixed(3)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(-50 * s, -h, 100 * s, 2 * h);

  // rim highlight along the sunward edge
  const edge = (L.ly >= 0 ? 1 : -1) * 14 * s;
  ctx.strokeStyle = `rgba(255,214,160,${(0.15 + 0.6 * Math.abs(L.ly)).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.6, 1.1);
  ctx.beginPath(); ctx.moveTo(-38 * s, edge); ctx.lineTo(36 * s, edge); ctx.stroke();

  // bridge layer: shifted a few pixels toward the star so it sits above the hull
  ctx.fillStyle = `rgba(186,230,253,${(0.25 + 0.4 * Math.abs(L.ly)).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(8 * s + L.lx * 1.2, L.ly * 1.2, 5 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  drawHullDetail(ctx, s, opts.thrust ?? 0);
  ctx.restore();
}

// Close-up detail, drawn only at high zoom: armour bulkheads across the hull, engine flares at the stern
// that brighten with thrust, and hardpoint mounts on the flanks. Hull-local coordinates, scaled by s.
function drawHullDetail(ctx, s, thrust) {
  ctx.strokeStyle = "rgba(15,23,42,0.55)";
  ctx.lineWidth = Math.max(0.5, 0.8);
  for (const x of [-22, -6, 10, 24]) {
    ctx.beginPath(); ctx.moveTo(x * s, -11 * s); ctx.lineTo(x * s, 11 * s); ctx.stroke();
  }
  const burn = 0.35 + 0.65 * Math.min(1, Math.max(0, thrust));
  for (const y of [-4.5, 4.5]) {
    const g = ctx.createRadialGradient(-40 * s, y * s, 0, -40 * s, y * s, 7 * s);
    g.addColorStop(0, `rgba(186,230,253,${(0.9 * burn).toFixed(3)})`);
    g.addColorStop(0.4, `rgba(56,189,248,${(0.5 * burn).toFixed(3)})`);
    g.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(-40 * s, y * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "rgba(148,163,184,0.75)";
  for (const y of [-13, 13]) ctx.fillRect((-4 - 1.5) * s, (y - 1.5) * s, 3 * s, 3 * s);
}

// Ion plumes are particles emitted at the stern and left behind to drift, so they detach from the hull.
// bank: Map<shipId, particle[]>. power 0..1 comes from thrust (surfing burns at about 0.45).
export function emitPlume(bank, id, x, y, heading, power, dt, tailPx) {
  if (power <= 0) return;
  let list = bank.get(id);
  if (!list) { list = []; bank.set(id, list); }
  const flicker = 0.85 + 0.15 * Math.sin(performance.now() / 40 + id.length);
  const count = Math.floor(power * flicker * 60 * dt + Math.random());
  const bx = x - Math.cos(heading) * tailPx, by = y - Math.sin(heading) * tailPx;
  for (let k = 0; k < count; k++) {
    const speed = (30 + 70 * power) * (0.7 + 0.6 * Math.random());
    const side = (Math.random() - 0.5) * 16 * power;
    const back = heading + Math.PI;
    list.push({
      x: bx + (Math.random() - 0.5) * 2, y: by + (Math.random() - 0.5) * 2,
      vx: Math.cos(back) * speed - Math.sin(back) * side * 0.1, vy: Math.sin(back) * speed + Math.cos(back) * side * 0.1,
      life: 0, max: 0.5 + 0.7 * power * Math.random(), size: 1.2 + 1.6 * power,
    });
  }
}

export function updatePlumes(bank, dt, liveIds) {
  for (const id of [...bank.keys()]) {
    if (!liveIds.has(id)) { bank.delete(id); continue; }
    const list = bank.get(id);
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 1.5); p.vy *= 1 - Math.min(1, dt * 1.5);
      if (p.life >= p.max) list.splice(i, 1);
    }
  }
}

export function drawPlumes(ctx, list) {
  if (!list) return;
  for (const p of list) {
    const a = Math.max(0, 1 - p.life / p.max);
    ctx.fillStyle = `rgba(125,211,252,${(0.6 * a).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * a), 0, Math.PI * 2); ctx.fill();
  }
}
