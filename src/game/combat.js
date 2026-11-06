// Warship combat. JavaScript only: the kernel and its replay are untouched, and a save keeps the fleet's hull
// damage and mounts. Raiders (corvette-class) spawn at the system edge in generated sectors, every RAID_INTERVAL
// seconds of game time. Allied ships and raiders fire mounted weapons at the nearest enemy in range. Hits throw
// sparks and jagged shards with real velocity vectors. A destroyed raider pays a bounty; a destroyed ship is lost.
import {SHIPS, hullMax} from "./ships.js";
import {EMERGENCY} from "./emergency.js";

export const RAID_INTERVAL = 90;     // seconds of game time before the first raid (later gaps are random)
// Raids come at random gaps, a minute to three, and sooner in dangerous systems (danger 1 = average).
export const raidGap = (rand, danger = 1) => (60 + rand() * 120) / danger;
// Seconds between one raider's plunders: random, so the player is not on a fixed clock.
const plunderGap = (rand) => 20 + rand() * 60;
export const RAID_MIN = 1, RAID_MAX = 3;
export const RAID_BOUNTY = 60;       // credits on kill
const RAIDER_HULL = 40;
const RAIDER_SPEED = 55;             // world units per second
const ENGAGE_RANGE = 300;            // raiders go after ships within this distance
const HOLD_RANGE = 170;              // raiders hover this far from the nearest world when no ship is in range
const HIT_RADIUS = 9;
const FLAK_FUSE = 14;                // flak detonates within this distance of an enemy
const DRAG = 0.8;

// Mounts. Speed in world units per second, cool is the reload in seconds, charge the spool-up before a shot.
// accuracy and tracking feed the hit roll (see hitChance). burst is the number of rounds per trigger pull.
export const MOUNTS = {
  coilgun: {label: "Kinetic Coilgun", range: 260, cool: 1.1, charge: 0, proj: "kinetic", speed: 900, damage: 9, color: "#e0f2fe",
    accuracy: 0.8, tracking: 0.6, burst: 1},
  flak: {label: "Point-Defense Flak", range: 120, cool: 0.6, charge: 0, proj: "flak", speed: 320, damage: 2, radius: 26, color: "#fde68a",
    accuracy: 1.0, tracking: 1.0, burst: 3},
  lance: {label: "Plasma Lance", range: 320, cool: 2.4, charge: 0.5, proj: "plasma", speed: 420, damage: 30, color: "#fb923c",
    accuracy: 0.8, tracking: 0.35, burst: 1},
};
// Evasion per hull: how hard the hull is to hit. Raiders fly corvette hulls.
export const EVASION = {corvette: 0.2, destroyer: 0.15, cruiser: 0.1, probe: 0.3, tender: 0.15, freighter: 0.05};
const FLAK_SPREAD = 0.05;            // radians between the rounds of a flak burst
const CHARGE_CORONA_R = 14;          // world units: the lance corona is drawn over this radius around the mount

// Stellaris-style hit resolution. A weapon's accuracy scales its chance, tracking against the target's evasion
// decides how often it keeps up, and a fast-moving target is harder to land on. Clamped to 5-95%.
export function hitChance(mount, evasion, targetSpeed = 0) {
  const def = MOUNTS[mount];
  const tracking = def.tracking / (def.tracking + evasion);
  const speedPenalty = 1 - Math.min(0.5, targetSpeed / 300);
  return Math.max(0.05, Math.min(0.95, def.accuracy * tracking * speedPenalty));
}
// Default loadout per hull, from the design sheet.
export const LOADOUT = {corvette: ["coilgun"], destroyer: ["coilgun", "flak", "flak"], cruiser: ["lance", "lance", "flak", "flak"]};
// Alloys per swap, and the Tech Web key that unlocks each mount (null is always available).
export const SWAP_COST = {coilgun: 30, flak: 60, lance: 120};
export const MOUNT_UNLOCK = {coilgun: null, flak: "flak", lance: "lance"};

export const defaultMounts = (type) => [...(LOADOUT[type] ?? [])];
export const mountsOf = (f) => f.mounts ?? defaultMounts(f.type);
export const maxHullOf = (f) => hullMax(f);
export const hullOf = (f) => Math.max(0, f.hp ?? maxHullOf(f));
export const mountUnlocked = (tech, kind) => MOUNT_UNLOCK[kind] == null || !!tech?.[MOUNT_UNLOCK[kind]];
// The next weapon a socket swaps to: the following unlocked type in cycle order, or null if none.
export const MOUNT_ORDER = ["coilgun", "flak", "lance"];
export function nextMount(tech, cur) {
  const i = MOUNT_ORDER.indexOf(cur);
  for (let step = 1; step < MOUNT_ORDER.length; step++) {
    const k = MOUNT_ORDER[(i + step) % MOUNT_ORDER.length];
    if (mountUnlocked(tech, k)) return k;
  }
  return null;
}

export function newCombat() {
  // activeT: seconds of combat left to show the PIP (set on every shot or hit); focus: where the fight is;
  // noise: 0..1 heat of the PIP's CRT distortion, raised by hits on allied hulls and decaying.
  // charging: lance mounts spooling up, keyed like cool, each with the spool left and the mount's position.
  return {raiders: [], shots: [], fx: [], pool: [], cool: {}, charging: {}, weld: [], raidT: RAID_INTERVAL, nextId: 1,
    activeT: 0, focus: null, noise: 0};
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Distance from point p to the segment a-b. Shots are swept along their path, so a fast round cannot skip a target.
function segDist(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
  return Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y);
}
function nearest(list, p, range) {
  let best = null, bd = range;
  for (const e of list) { const d = dist(e, p); if (d <= bd) { bd = d; best = e; } }
  return best;
}

// Radar occlusion: a body (world or star) blocks the line between two craft when the line passes through its disc.
// A craft sitting inside a body's disc is not blocked by that body, so a ship in low orbit still shows on radar.
export function occluded(a, b, bodies) {
  for (const o of bodies) {
    if (dist(a, o) <= o.r || dist(b, o) <= o.r) continue;
    if (segDist(o, a, b) < o.r) return true;
  }
  return false;
}

// True when a ship at p is in a fight: a raider is inside engagement range, or a shot or hit landed recently.
export function engaged(state, p) {
  return state.activeT > 0 || state.raiders.some((r) => dist(r, p) <= ENGAGE_RANGE);
}

// Spawns a raid of 1-3 corvette raiders on a ring just outside the outermost world.
export function spawnRaid(state, edgeR, rand = Math.random) {
  const n = RAID_MIN + Math.floor(rand() * (RAID_MAX - RAID_MIN + 1));
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = edgeR * 1.25;
    state.raiders.push({id: state.nextId++, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0,
      hp: RAIDER_HULL, maxHp: RAIDER_HULL, mounts: defaultMounts("corvette"), bounty: RAID_BOUNTY});
  }
  return n;
}

// Particle pool: finished effects return to state.pool and are reused, so steady-state combat allocates nothing.
const FX_MAX = 700;
function fxNew(state, props) {
  const e = state.pool.pop() ?? {};
  for (const k in e) delete e[k];
  return Object.assign(e, props);
}
function fxAdd(state, props) {
  if (state.fx.length < FX_MAX) state.fx.push(fxNew(state, props));
}

// Sparks thrown from a point. bias is the momentum carried in from the impact, so debris keeps the round's way.
// drag is how fast they slow: flak shrapnel decelerates hard.
function spawnSparks(state, x, y, n, color, rand, speed = 160, bias = null, drag = DRAG) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = speed * (0.3 + rand() * 0.7);
    fxAdd(state, {kind: "spark", x, y, vx: Math.cos(a) * v + (bias?.x ?? 0), vy: Math.sin(a) * v + (bias?.y ?? 0),
      life: 0.25 + rand() * 0.35, max: 0.6, color, drag});
  }
}

// Composite armour fragments: rotating jagged polygons with a molten edge, carrying the impact's momentum.
function spawnShards(state, x, y, n, size, rand, speed = 90, bias = null) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = speed * (0.4 + rand() * 0.8), k = 5 + Math.floor(rand() * 3);
    const pts = [];
    for (let j = 0; j < k; j++) {
      const t = (j / k) * Math.PI * 2 + (rand() - 0.5) * 0.5, r = size * (0.45 + rand() * 0.55);
      pts.push({x: Math.cos(t) * r, y: Math.sin(t) * r});
    }
    fxAdd(state, {kind: "shard", x, y, vx: Math.cos(a) * v + (bias?.x ?? 0), vy: Math.sin(a) * v + (bias?.y ?? 0),
      rot: rand() * Math.PI, vr: (rand() - 0.5) * 8, pts, life: 4 + rand() * 2, max: 6,
      color: "#334155", edge: "#f97316", drag: DRAG});
  }
}

// Expanding shockwave corona at a contact point.
function shockwave(state, x, y, color, size = 22) {
  fxAdd(state, {kind: "shock", x, y, vx: 0, vy: 0, r: 2, grow: size * 6, life: 0.32, max: 0.32, color, drag: 0});
}

// Coolant or atmosphere venting from a broken hull: slow, pale plume drifting off the wreck.
function vent(state, x, y, n, rand) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = 30 + rand() * 50;
    fxAdd(state, {kind: "vent", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + rand() * 0.8, max: 2, color: "#bae6fd", drag: 1.4});
  }
}

// Welding sparks for a hull patch: warm and bright, thrown up and out from the ship.
export function weldSparks(state, x, y, rand = Math.random) {
  spawnSparks(state, x, y, 14, rand() < 0.5 ? "#fef3c7" : "#fbbf24", rand, 120);
}

const PIP_HOLD = 4;   // seconds the PIP stays open after the last shot or hit

// Fires a mount at target: one round, or a burst fanned by FLAK_SPREAD. Leaves a muzzle flare behind.
function fire(state, key, mount, from, target, side, rand) {
  const def = MOUNTS[mount];
  state.activeT = PIP_HOLD; state.focus = {x: from.x, y: from.y};
  const sp = def.speed, base = Math.atan2(target.y - from.y, target.x - from.x);
  for (let b = 0; b < def.burst; b++) {
    const off = def.burst > 1 ? (b - (def.burst - 1) / 2) * FLAK_SPREAD : 0, a = base + off;
    state.shots.push({
      side, mount, kind: def.proj, x: from.x, y: from.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      damage: def.damage, radius: def.radius ?? 0, color: def.color,
      life: (def.range / sp) * 1.4, checked: new Set(),
    });
  }
  fxAdd(state, {kind: "flare", x: from.x, y: from.y, vx: 0, vy: 0, life: 0.14, max: 0.14, color: def.color,
    size: mount === "coilgun" ? 11 : mount === "lance" ? 16 : 7, drag: 0});
  state.cool[key] = def.cool;
}

const allies0 = (fleet, env) => fleet.map((f) => ({f, p: env.pos(f)})).filter((a) => a.p);
const evasionOf = (e) => (e._f
  ? (EVASION[e._f.type] ?? 0.2) + (e._f.emergency?.left > 0 ? EMERGENCY.evasion : 0)
  : EVASION.corvette);

// Advances combat by dt seconds. env: {dt, fleet, planets, core, pos(f) -> {x,y}, tech, rand, edgeR, raidNow}.
// Mutates state and env.fleet (destroyed ships are removed). Returns events for the HUD.
export function stepCombat(state, env) {
  const {dt, fleet, planets, core, tech, rand = Math.random} = env;
  const events = [];
  // radar: a craft behind a body is out of lock, so each side only picks targets it can see
  const bodies = env.bodies ?? [];
  const seen = (from, list) => (bodies.length ? list.filter((e) => !occluded(from, e, bodies)) : list);

  // dev trigger: one raid now, without touching the ambient timer
  if (env.raidNow) {
    const n = spawnRaid(state, env.edgeR ?? 300, rand);
    events.push({kind: "raid", n, msg: `[DEV] ${n} raider${n > 1 ? "s" : ""} spawned.`});
  }

  state.activeT = Math.max(0, state.activeT - dt);
  state.noise = Math.max(0, state.noise - dt * 1.5);

  // welding sparks for ships patched since the last step (queued by the UI, placed here with the positions)
  for (const id of state.weld.splice(0)) {
    const a = allies0(fleet, env).find((x) => x.f.id === id);
    if (a) weldSparks(state, a.p.x, a.p.y, rand);
  }

  // raids: only in generated sectors (the caller decides that by passing edgeR)
  if (env.edgeR != null) {
    state.raidT -= dt;
    if (state.raidT <= 0) {
      state.raidT = raidGap(rand, env.danger ?? 1);
      const n = spawnRaid(state, env.edgeR, rand);
      events.push({kind: "raid", n, msg: `${n} raider${n > 1 ? "s" : ""} entering the system.`});
    }
  }

  // hostile and allied copies for this step. Ship copies point back at the fleet entry through _f.
  const allies = allies0(fleet, env).map((a) => ({key: `s${a.f.id}`, x: a.p.x, y: a.p.y, vx: 0, vy: 0, _f: a.f, f: a.f}));

  // raiders steer toward the nearest ship in range, else hover near the nearest world
  for (const r of state.raiders) {
    const target = nearest(seen(r, allies), r, ENGAGE_RANGE);
    let goal = null;
    if (target) goal = target;
    else if (planets.length) goal = nearest(planets, r, Infinity);
    if (goal) {
      const d = dist(r, goal) || 1;
      // once a ship is inside the raider's own gun range it holds station: a stationary gunner is no harder
      // to hit than the ship it is shooting at, so the duel stays even
      const want = target ? MOUNTS.coilgun.range * 0.85 : HOLD_RANGE;
      if (d > want + 4) {
        r.vx = (goal.x - r.x) / d * RAIDER_SPEED; r.vy = (goal.y - r.y) / d * RAIDER_SPEED;
      } else { r.vx *= 0.9; r.vy *= 0.9; }
    }
    r.x += r.vx * dt; r.y += r.vy * dt;
    // with no ship to fight, a raider over a world takes what it can carry off
    if (!target && goal && dist(r, goal) <= HOLD_RANGE + 40) {
      if (!r.plunderGap) r.plunderGap = plunderGap(rand);
      r.plunder = (r.plunder ?? 0) + dt;
      if (r.plunder >= r.plunderGap) {
        r.plunder = 0; r.plunderGap = plunderGap(rand);
        const amount = 10 + Math.floor(rand() * 31);
        events.push({kind: "theft", amount, msg: `Raiders plundered ${amount} credits from a world.`});
      }
    }
  }

  // mounts: a ready mount with a target starts its spool (lances) or fires (everything else)
  const alive = new Set();
  // allied mounts follow the player's Tech Web; raider mounts are always armed
  const trigger = (key, kind, from, targets, side, gated) => {
    alive.add(key);
    const def = MOUNTS[kind];
    const ch = state.charging[key];
    if (ch) {
      ch.x = from.x; ch.y = from.y; ch.t -= dt;
      if (ch.t > 0) return;
      delete state.charging[key];
      const t = nearest(targets, from, def.range);
      if (t) fire(state, key, kind, from, t, side, rand);
      return;
    }
    state.cool[key] = Math.max(0, (state.cool[key] ?? 0) - dt);
    if (state.cool[key] > 0 || (gated && !mountUnlocked(tech, kind))) return;
    const t = nearest(targets, from, def.range);
    if (!t) return;
    if (def.charge > 0) state.charging[key] = {t: def.charge, total: def.charge, x: from.x, y: from.y, color: def.color};
    else fire(state, key, kind, from, t, side, rand);
  };
  for (const a of allies) {
    // a ship on an attack order fires only at its raider; otherwise at any raider in range
    const pool = a._f.attack != null ? state.raiders.filter((r) => r.id === a._f.attack) : state.raiders;
    mountsOf(a._f).forEach((kind, i) => trigger(`a${a._f.id}:${i}`, kind, a, seen(a, pool), "ally", true));
  }
  for (const r of state.raiders) {
    r.mounts.forEach((kind, i) => trigger(`r${r.id}:${i}`, kind, r, seen(r, allies), "raider", false));
  }
  // a spool whose shooter is gone is dropped, so a dead ship's lance does not fire from nowhere
  for (const k of Object.keys(state.charging)) if (!alive.has(k)) delete state.charging[k];

  // shots travel; each target gets one roll per round, and a missed round keeps flying
  const hostileOf = (side) => (side === "ally"
    ? state.raiders.map((r) => ({key: `r${r.id}`, x: r.x, y: r.y, vx: r.vx, vy: r.vy, ref: r}))
    : allies.map((a) => ({key: a.key, x: a.x, y: a.y, vx: 0, vy: 0, _f: a._f, ref: a})));
  const applyHit = (e, amount) => {
    if (e._f) e._f.hp = Math.max(0, hullOf(e._f) - amount);
    else e.ref.hp = Math.max(0, e.ref.hp - amount);
  };
  const resolveRoll = (sh, e) => {
    const speed = Math.hypot(e.vx, e.vy);
    return rand() < hitChance(sh.mount, evasionOf(e), speed);
  };
  state.shots = state.shots.filter((sh) => {
    const from = {x: sh.x, y: sh.y};
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
    const targets = hostileOf(sh.side);
    const reach = sh.kind === "flak" ? FLAK_FUSE : HIT_RADIUS;
    if (sh.kind === "flak") {
      // proximity fuse: the first burst within reach detonates and shreds everything inside its radius
      const near = targets.find((e) => !sh.checked.has(e.key) && segDist(e, from, sh) <= reach);
      if (!near && sh.life > 0) return true;
      if (!near) return false;
      for (const e of targets) {
        if (sh.checked.has(e.key) || segDist(e, from, sh) > sh.radius) continue;
        sh.checked.add(e.key);
        if (resolveRoll(sh, e)) applyHit(e, sh.damage);
      }
      spawnSparks(state, sh.x, sh.y, 12, "#fef08a", rand, 260, {x: sh.vx * 0.15, y: sh.vy * 0.15}, 3.5);
      shockwave(state, sh.x, sh.y, "#fef08a", 14);
      return false;
    }
    let landed = null;
    for (const e of targets) {
      if (sh.checked.has(e.key) || segDist(e, from, sh) > reach) continue;
      sh.checked.add(e.key);
      if (resolveRoll(sh, e)) { landed = e; break; }
      // a miss: a small glint off the hull where the round passed, and the round flies on
      fxAdd(state, {kind: "spark", x: e.x, y: e.y, vx: sh.vx * 0.05, vy: sh.vy * 0.05, life: 0.18, max: 0.2, color: sh.color, drag: 2});
    }
    if (!landed) return sh.life > 0;
    // a hit: the target takes the damage, and the impact throws shards and molten sparks with the round's momentum
    const bias = {x: sh.vx * 0.3 + landed.vx * 0.6, y: sh.vy * 0.3 + landed.vy * 0.6};
    state.activeT = PIP_HOLD; state.focus = {x: landed.x, y: landed.y};
    if (landed._f) state.noise = 1;
    applyHit(landed, sh.damage);
    shockwave(state, landed.x, landed.y, sh.color, 22);
    spawnSparks(state, landed.x, landed.y, 10, "#fde68a", rand, 200, bias);
    spawnSparks(state, landed.x, landed.y, 4, "#f97316", rand, 120, bias, 1.2);
    spawnShards(state, landed.x, landed.y, 6 + Math.floor(rand() * 5), 5, rand, 70, bias);   // 6-10 composite fragments
    return false;
  });

  // deaths. A raider comes apart into composite fragments. A ship breaks into spinning derelict sections
  // with cook-off flashes and venting plumes; the loss is permanent.
  for (let i = state.raiders.length - 1; i >= 0; i--) {
    const r = state.raiders[i];
    if (r.hp > 0) continue;
    state.raiders.splice(i, 1);
    spawnShards(state, r.x, r.y, 8, 10, rand, 130, {x: r.vx * 0.6, y: r.vy * 0.6});
    spawnSparks(state, r.x, r.y, 24, "#f97316", rand, 240, {x: r.vx * 0.5, y: r.vy * 0.5});
    shockwave(state, r.x, r.y, "#fca5a5", 30);
    vent(state, r.x, r.y, 6, rand);
    events.push({kind: "kill", bounty: r.bounty, msg: `Raider destroyed. Bounty ${r.bounty} credits.`});
  }
  for (let i = fleet.length - 1; i >= 0; i--) {
    const f = fleet[i];
    if (f.hp == null || f.hp > 0) continue;
    const p = env.pos(f) ?? core;
    fleet.splice(i, 1);
    // derelict sections: larger hull halves tumbling apart on different vectors
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rand() * 0.6, v = 40 + rand() * 60, size = 18 + rand() * 6;
      fxAdd(state, {kind: "shard", x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand() * Math.PI,
        vr: (rand() - 0.5) * 2.5, pts: Array.from({length: 6}, (_, j) => ({x: Math.cos(j) * size * (0.7 + rand() * 0.3), y: Math.sin(j) * size * (0.7 + rand() * 0.3)})),
        life: 9, max: 9, color: "#334155", edge: "#ef4444", drag: 0.25});
    }
    spawnSparks(state, p.x, p.y, 30, "#fdba74", rand, 260);
    for (let c = 0; c < 3; c++) fxAdd(state, {kind: "flare", x: p.x + (rand() - 0.5) * 20, y: p.y + (rand() - 0.5) * 20, vx: 0, vy: 0, life: 0.3, max: 0.3, color: "#fde68a", size: 18, drag: 0});
    shockwave(state, p.x, p.y, "#fdba74", 40);
    vent(state, p.x, p.y, 10, rand);
    events.push({kind: "loss", msg: `${SHIPS[f.type].name} #${f.id} destroyed. The loss is permanent.`});
  }

  // fx: every effect moves with its own drag; finished effects return to the pool
  let w = 0;
  for (let i = 0; i < state.fx.length; i++) {
    const e = state.fx[i];
    e.life -= dt;
    if (e.life <= 0) { if (state.pool.length < FX_MAX) state.pool.push(e); continue; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    const k = Math.exp(-(e.drag ?? DRAG) * dt); e.vx *= k; e.vy *= k;
    if (e.kind === "shard") e.rot += e.vr * dt;
    if (e.kind === "shock") e.r += e.grow * dt;
    state.fx[w++] = e;
  }
  state.fx.length = w;
  return events;
}
