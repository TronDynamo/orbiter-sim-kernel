// Warship combat. JavaScript only: the kernel and its replay are untouched, and a save keeps the fleet's hull
// damage and mounts. Raiders (corvette-class) spawn at the system edge in generated sectors, every RAID_INTERVAL
// seconds of game time. Allied ships and raiders fire mounted weapons at the nearest enemy in range. Hits throw
// sparks and jagged shards with real velocity vectors. A destroyed raider pays a bounty; a destroyed ship is lost.
import {SHIPS} from "./ships.js";

export const RAID_INTERVAL = 90;     // seconds of game time between raids
export const RAID_MIN = 1, RAID_MAX = 3;
export const RAID_BOUNTY = 60;       // credits on kill
const RAIDER_HULL = 40;
const RAIDER_SPEED = 55;             // world units per second
const ENGAGE_RANGE = 300;            // raiders go after ships within this distance
const HOLD_RANGE = 170;              // raiders hover this far from the nearest world when no ship is in range
const HIT_RADIUS = 9;
const FLAK_FUSE = 14;                // flak detonates within this distance of an enemy
const DRAG = 0.8;

// Mounts. Speed in world units per second, cool is the reload in seconds.
export const MOUNTS = {
  coilgun: {label: "Kinetic Coilgun", range: 260, cool: 0.9, proj: "kinetic", speed: 900, damage: 9, color: "#e0f2fe"},
  flak: {label: "Point-Defense Flak", range: 120, cool: 0.6, proj: "flak", speed: 320, damage: 6, radius: 26, color: "#fde68a"},
  lance: {label: "Plasma Lance", range: 320, cool: 2.4, proj: "plasma", speed: 420, damage: 30, color: "#fb923c"},
};
// Default loadout per hull, from the design sheet.
export const LOADOUT = {corvette: ["coilgun"], destroyer: ["coilgun", "flak", "flak"], cruiser: ["lance", "lance", "flak", "flak"]};
// Alloys per swap, and the Tech Web key that unlocks each mount (null is always available).
export const SWAP_COST = {coilgun: 30, flak: 60, lance: 120};
export const MOUNT_UNLOCK = {coilgun: null, flak: "flak", lance: "lance"};

export const defaultMounts = (type) => [...(LOADOUT[type] ?? [])];
export const mountsOf = (f) => f.mounts ?? defaultMounts(f.type);
export const maxHullOf = (f) => SHIPS[f.type]?.hull ?? 0;
export const hullOf = (f) => Math.max(0, f.hp ?? maxHullOf(f));
export const mountUnlocked = (tech, kind) => MOUNT_UNLOCK[kind] == null || !!tech?.[MOUNT_UNLOCK[kind]];

export function newCombat() {
  return {raiders: [], shots: [], fx: [], cool: {}, weld: [], raidT: RAID_INTERVAL, nextId: 1};
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

function spawnSparks(state, x, y, n, color, rand, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = speed * (0.3 + rand() * 0.7);
    state.fx.push({kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + rand() * 0.35, max: 0.6, color});
  }
}

// Jagged shards with spin: each one a random polygon thrown outward.
function spawnShards(state, x, y, n, size, rand, speed = 90) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = speed * (0.4 + rand() * 0.8), k = 4 + Math.floor(rand() * 2);
    const pts = [];
    for (let j = 0; j < k; j++) {
      const t = (j / k) * Math.PI * 2, r = size * (0.5 + rand() * 0.5);
      pts.push({x: Math.cos(t) * r, y: Math.sin(t) * r});
    }
    state.fx.push({kind: "shard", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand() * Math.PI,
      vr: (rand() - 0.5) * 8, pts, life: 4 + rand() * 2, max: 6, color: "#94a3b8"});
  }
}

// Welding sparks for a hull patch: warm and bright, thrown up and out from the ship.
export function weldSparks(state, x, y, rand = Math.random) {
  spawnSparks(state, x, y, 14, rand() < 0.5 ? "#fef3c7" : "#fbbf24", rand, 120);
}

function fire(state, key, mount, from, target, side, rand) {
  const def = MOUNTS[mount];
  const d = dist(from, target) || 1;
  const sp = def.speed;
  state.shots.push({
    side, kind: def.proj, x: from.x, y: from.y,
    vx: (target.x - from.x) / d * sp, vy: (target.y - from.y) / d * sp,
    damage: def.damage, radius: def.radius ?? 0, color: def.color,
    life: (def.range / sp) * 1.4,
  });
  state.cool[key] = def.cool;
}

const allies0 = (fleet, env) => fleet.map((f) => ({f, p: env.pos(f)})).filter((a) => a.p);

// Advances combat by dt seconds. env: {dt, fleet, planets, core, pos(f) -> {x,y}, tech, rand, edgeR}.
// Mutates state and env.fleet (destroyed ships are removed). Returns events for the HUD.
export function stepCombat(state, env) {
  const {dt, fleet, planets, core, tech, rand = Math.random} = env;
  const events = [];

  // welding sparks for ships patched since the last step (queued by the UI, placed here with the positions)
  for (const id of state.weld.splice(0)) {
    const a = allies0(fleet, env).find((x) => x.f.id === id);
    if (a) weldSparks(state, a.p.x, a.p.y, rand);
  }

  // raids: only in generated sectors (the caller decides that by passing edgeR)
  if (env.edgeR != null) {
    state.raidT -= dt;
    if (state.raidT <= 0) {
      state.raidT = RAID_INTERVAL;
      const n = spawnRaid(state, env.edgeR, rand);
      events.push({kind: "raid", n, msg: `${n} raider${n > 1 ? "s" : ""} entering the system.`});
    }
  }

  // ally positions, once per step
  const allies = fleet.map((f) => ({f, p: env.pos(f)})).filter((a) => a.p);

  // raiders steer toward the nearest ship in range, else hover near the nearest world
  for (const r of state.raiders) {
    const target = nearest(allies.map((a) => ({...a.p, _f: a.f})), r, ENGAGE_RANGE);
    let goal = null;
    if (target) goal = target;
    else if (planets.length) goal = nearest(planets, r, Infinity);
    if (goal) {
      const d = dist(r, goal) || 1;
      const want = target ? 0 : HOLD_RANGE;
      if (d > want + 4) {
        r.vx = (goal.x - r.x) / d * RAIDER_SPEED; r.vy = (goal.y - r.y) / d * RAIDER_SPEED;
      } else { r.vx *= 0.9; r.vy *= 0.9; }
    }
    r.x += r.vx * dt; r.y += r.vy * dt;
  }

  // mounts fire: allied ships at raiders, raiders at allied ships
  for (const a of allies) {
    mountsOf(a.f).forEach((kind, i) => {
      const key = `a${a.f.id}:${i}`;
      state.cool[key] = Math.max(0, (state.cool[key] ?? 0) - dt);
      if (state.cool[key] > 0 || !mountUnlocked(tech, kind)) return;
      const t = nearest(state.raiders, a.p, MOUNTS[kind].range);
      if (t) fire(state, key, kind, a.p, t, "ally", rand);
    });
  }
  for (const r of state.raiders) {
    r.mounts.forEach((kind, i) => {
      const key = `r${r.id}:${i}`;
      state.cool[key] = Math.max(0, (state.cool[key] ?? 0) - dt);
      if (state.cool[key] > 0) return;
      const t = nearest(allies.map((a) => ({...a.p, _f: a.f})), r, MOUNTS[kind].range);
      if (t) fire(state, key, kind, r, t, "raider", rand);
    });
  }

  // shots travel and resolve
  state.shots = state.shots.filter((sh) => {
    const from = {x: sh.x, y: sh.y};
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
    const enemies = sh.side === "ally" ? state.raiders : allies.map((a) => ({...a.p, _f: a.f, hp: a.f.hp, maxHp: maxHullOf(a.f)}));
    const reach = sh.kind === "flak" ? FLAK_FUSE : HIT_RADIUS;
    const hit = enemies.find((e) => segDist(e, from, sh) <= reach);
    if (!hit && sh.life > 0) return true;
    if (!hit) { spawnSparks(state, sh.x, sh.y, 3, sh.color, rand, 60); return false; }
    if (sh.kind === "flak") {
      // proximity burst: every enemy inside the radius takes the hit, and shrapnel flies out
      for (const e of enemies) if (segDist(e, from, sh) <= sh.radius) applyHit(e, sh.damage);
      spawnSparks(state, sh.x, sh.y, 10, sh.color, rand, 260);
    } else {
      applyHit(hit, sh.damage);
      spawnSparks(state, hit.x, hit.y, 8, sh.color, rand, 180);
      spawnShards(state, hit.x, hit.y, 1, 5, rand, 60);
    }
    return false;
  });
  // ship copies carry _f, the fleet entry, and hits write back to it; raiders are hit directly
  function applyHit(e, amount) {
    if (e._f) e._f.hp = Math.max(0, hullOf(e._f) - amount);
    else e.hp = Math.max(0, e.hp - amount);
  }

  // deaths
  for (let i = state.raiders.length - 1; i >= 0; i--) {
    const r = state.raiders[i];
    if (r.hp > 0) continue;
    state.raiders.splice(i, 1);
    spawnShards(state, r.x, r.y, 3, 10, rand, 110);
    spawnSparks(state, r.x, r.y, 16, "#fca5a5", rand, 220);
    events.push({kind: "kill", bounty: r.bounty, msg: `Raider destroyed. Bounty ${r.bounty} credits.`});
  }
  for (let i = fleet.length - 1; i >= 0; i--) {
    const f = fleet[i];
    if (f.hp == null || f.hp > 0) continue;
    const p = env.pos(f) ?? core;
    fleet.splice(i, 1);
    spawnShards(state, p.x, p.y, 3, 13, rand, 100);
    spawnSparks(state, p.x, p.y, 20, "#fdba74", rand, 240);
    events.push({kind: "loss", msg: `${SHIPS[f.type].name} #${f.id} destroyed. The loss is permanent.`});
  }

  // fx: sparks and shards fly with drag, shards spin
  state.fx = state.fx.filter((e) => {
    e.x += e.vx * dt; e.y += e.vy * dt;
    const k = Math.exp(-DRAG * dt); e.vx *= k; e.vy *= k;
    if (e.kind === "shard") e.rot += e.vr * dt;
    e.life -= dt;
    return e.life > 0;
  });
  return events;
}
