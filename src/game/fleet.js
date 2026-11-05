// Ship flight on the orbital map. Ships share the worlds' coordinates and move on the same clock as the kernel.
// Modes: orbit (low orbit around a world), transit (impulse burn toward a world or a fuel depot), surf (riding a
// live conduit at SURF_MULT times impulse speed, no propellant), docked (refuelling and repairing at a fuel depot).
import {PLANETS} from "../../config/planets.js";
import {SHIPS} from "./ships.js";

export const SHIP_ORBIT = 26;             // low-orbit radius around a world (world units)
export const ORBIT_RATE = 0.02;           // radians per tick around a world
export const IMPULSE = Object.fromEntries(Object.entries(SHIPS).map(([k, v]) => [k, v.speed]));  // world units per tick
export const SURF_MULT = 5;               // conduit surfing speed multiplier
export const PROPELLANT_PER_TICK = 0.05;  // propellant per tick of impulse burn
export const MAX_PROPELLANT = 100;        // tank capacity used by depots and the telemetry bar
export const REFUEL_PER_TICK = 0.6;       // propellant taken on per tick while docked
export const HULL_REPAIR_PER_TICK = 0.05; // hull points recovered per tick while docked
export const OVERCLOCK = {speed: 1.5, burn: 2};   // overclocked thrusters: faster, double propellant burn
export const INTERCEPT_DAMAGE = 45;       // hull lost by a ship that takes an incoming strike
const ARRIVE_PAD = 4;                     // arrival distance beyond the world's radius
const DEPOT_ORBIT = 18;                   // a depot in orbit sits this far from its world

const radiusOf = (id) => PLANETS.find((p) => p.key === id)?.r ?? 10;
const hasLive = (conduits, a, b) => conduits.some((c) => !c.snapped && ((c.a === a && c.b === b) || (c.a === b && c.b === a)));

// Where a fuel depot sits: beside its world when it is in orbit, otherwise at its fixed deep-space point.
export function depotPos(d, P) {
  if (d.planet && P[d.planet]) {
    const c = P[d.planet];
    return {x: c.x + DEPOT_ORBIT * Math.cos(d.ang), y: c.y + DEPOT_ORBIT * Math.sin(d.ang)};
  }
  return {x: d.x, y: d.y};
}

// Where a ship is now. Orbit and surf positions are derived from the worlds; transit uses the stored position.
export function shipPosition(f, P) {
  if (f.mode === 'orbit') {
    const c = P[f.planet] ?? {x: 0, y: 0};
    return {x: c.x + SHIP_ORBIT * Math.cos(f.ang), y: c.y + SHIP_ORBIT * Math.sin(f.ang)};
  }
  if (f.mode === 'docked') return P[f.depot] ?? {x: f.x ?? 0, y: f.y ?? 0};
  if (f.mode === 'surf') {
    const A = P[f.from], B = P[f.to];
    if (A && B) return {x: A.x + (B.x - A.x) * f.p, y: A.y + (B.y - A.y) * f.p};
  }
  return {x: f.x ?? P.ferrum?.x ?? 0, y: f.y ?? P.ferrum?.y ?? 0};
}

function settleInOrbit(f, P, id) {
  const T = P[id], q = shipPosition(f, P);
  f.mode = 'orbit'; f.planet = id; f.from = null; f.to = null; f.p = 0; f.thrust = 0;
  f.ang = Math.atan2(q.y - T.y, q.x - T.x);
}

// Advances every ship by `ticks` kernel ticks. ctx: {conduits: [{a, b, snapped}], velocity: {id: {x, y}}}.
export function stepFleet(s, P, ticks, ctx) {
  if (ticks <= 0) return;
  for (const f of s.fleet) {
    if (!f.mode) { f.mode = 'orbit'; f.planet = 'ferrum'; f.ang = f.phase ?? 0; } // hulls saved before flight existed
    const max = SHIPS[f.type]?.hull ?? 100;
    if (f.hp === undefined) f.hp = max;
    if (f.mode === 'docked') {
      // refuel the shared tanks and mend the hull while moored at the depot
      s.propellant = Math.min(MAX_PROPELLANT, s.propellant + REFUEL_PER_TICK * ticks);
      f.hp = Math.min(max, f.hp + HULL_REPAIR_PER_TICK * ticks);
      const q = shipPosition(f, P); f.x = q.x; f.y = q.y; f.thrust = 0;
      continue;
    }
    const boost = f.overclock ? OVERCLOCK.speed : 1;
    const burn = f.overclock ? OVERCLOCK.burn : 1;
    const speed = (IMPULSE[f.type] ?? 1.5) * boost;
    if (f.mode === 'orbit') {
      f.ang += ORBIT_RATE * ticks;
      const q = shipPosition(f, P);
      f.x = q.x; f.y = q.y; f.thrust = 0;
      f.heading = f.ang + Math.PI / 2;
      continue;
    }
    if (f.mode === 'surf' && hasLive(ctx.conduits, f.from, f.to)) {
      const A = P[f.from], B = P[f.to];
      const L = Math.max(1, Math.hypot(B.x - A.x, B.y - A.y));
      f.p = Math.min(1, f.p + (speed * SURF_MULT * ticks) / L);
      const q = shipPosition(f, P);
      f.x = q.x; f.y = q.y; f.thrust = 1;
      f.heading = Math.atan2(B.y - A.y, B.x - A.x);
      if (f.p >= 1) settleInOrbit(f, P, f.to);
      continue;
    }
    if (f.mode === 'surf') f.mode = 'transit'; // the beam was cut: fall back to an impulse burn
    // impulse transit: steer at where the target will be when the ship arrives (intercept)
    const T = P[f.to];
    if (!T) { f.mode = 'orbit'; f.planet = 'ferrum'; f.ang = 0; continue; }
    const v = ctx.velocity?.[f.to] ?? {x: 0, y: 0};
    const tau = Math.hypot(T.x - f.x, T.y - f.y) / speed;
    const dx = T.x + v.x * tau - f.x, dy = T.y + v.y * tau - f.y, d = Math.hypot(dx, dy);
    if (d > 1e-6) {
      const step = Math.min(d, speed * ticks);
      f.x += (dx / d) * step; f.y += (dy / d) * step;
    }
    f.heading = Math.atan2(dy, dx); f.thrust = 1;
    s.propellant = Math.max(0, s.propellant - PROPELLANT_PER_TICK * burn * ticks);
    if (Math.hypot(T.x - f.x, T.y - f.y) <= radiusOf(f.to) + ARRIVE_PAD) {
      if (String(f.to).startsWith('depot')) {
        // moor at the depot: the ship stops there and refuels until it is ordered away
        f.mode = 'docked'; f.depot = f.to; f.from = null; f.to = null; f.thrust = 0;
        const q = shipPosition(f, P); f.x = q.x; f.y = q.y;
      } else settleInOrbit(f, P, f.to);
    }
  }
}

// Issues a flight order to a world or a fuel depot. Returns {ok, msg}. A ship in orbit surfs when a live conduit joins
// its world to the target; otherwise it burns for the target, provided it has the propellant for the trip.
export function sendShip(s, f, targetId, P, conduits, targetName) {
  const name = SHIPS[f.type]?.name ?? 'Ship';
  if (f.mode === 'orbit' && f.planet === targetId) return {ok: false, msg: `${name} is already in orbit around ${targetName}.`};
  const T = P[targetId];
  if (!T) return {ok: false, msg: 'That target is out of reach.'};
  if (f.mode === 'orbit' && hasLive(conduits, f.planet, targetId)) {
    f.mode = 'surf'; f.from = f.planet; f.to = targetId; f.p = 0; f.thrust = 1;
    return {ok: true, msg: `${name} locks onto the conduit and surfs to ${targetName}.`};
  }
  const q = shipPosition(f, P);
  const burn = f.overclock ? OVERCLOCK.burn : 1;
  const cost = (Math.hypot(T.x - q.x, T.y - q.y) / (IMPULSE[f.type] ?? 1.5)) * PROPELLANT_PER_TICK * burn;
  if (s.propellant < cost) return {ok: false, msg: `Not enough propellant for that burn (needs ${Math.ceil(cost)}).`};
  f.mode = 'transit'; f.to = targetId; f.from = null; f.x = q.x; f.y = q.y; f.thrust = 1;
  return {ok: true, msg: String(targetId).startsWith('depot') ? `${name} burns for ${targetName} to refuel.` : `${name} burns for ${targetName}.`};
}

// A ship in orbit around a world takes the first incoming strike at that world. It survives unless the hull gives out.
// Returns {ship, destroyed} or null when no ship is on station there.
export function interceptAt(s, planetId) {
  const i = s.fleet.findIndex((f) => f.mode === 'orbit' && f.planet === planetId);
  if (i < 0) return null;
  const f = s.fleet[i];
  f.hp = (f.hp ?? SHIPS[f.type]?.hull ?? 100) - INTERCEPT_DAMAGE;
  if (f.hp <= 0) { s.fleet.splice(i, 1); return {ship: f, destroyed: true}; }
  return {ship: f, destroyed: false};
}
