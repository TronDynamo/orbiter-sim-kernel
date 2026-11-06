// Ship flight on the orbital map. Ships share the worlds' coordinates and move on the same clock as the kernel.
// Modes: orbit (low orbit around a world), transit (impulse burn toward a world or a fuel depot), surf (riding a
// live conduit at SURF_MULT times impulse speed, no propellant), docked (refuelling and repairing at a fuel depot),
// survey (probe scanning an uncharted world), siphon (freighter filling its hold from a charted world).
import {PLANETS} from "../../config/planets.js";
import {SHIPS, hullMax} from "./ships.js";
import {bankShip} from "./pseudo3d.js";
import {RULES} from "./rules.js";
import {ARK_POS} from "./galaxy.js";
import {EMERGENCY} from "./emergency.js";

export const SHIP_ORBIT = 26;             // low-orbit radius around a world (world units)
export const ORBIT_RATE = 0.02;           // radians per tick around a world
export const IMPULSE = Object.fromEntries(Object.entries(SHIPS).map(([k, v]) => [k, v.speed]));  // world units per tick
export const SURF_MULT = 5;               // conduit surfing speed multiplier
export const PROPELLANT_PER_TICK = 0.05;  // propellant per tick of impulse burn

// The Ark Endeavor moves like a ship: a burn to any point in space, paid in propellant, at its own speed.
export const ARK_IMPULSE = 1.5, ARK_SPEED = 30;   // world units per game second
// Radiation the Ark receives from the star (at the origin): full flux inside ARK_RAD_IN, none beyond ARK_RAD_OUT.
export const ARK_RAD_IN = 44, ARK_RAD_OUT = 400;
export function arkState(s) { if (!s.ark) s.ark = {x: ARK_POS.x, y: ARK_POS.y, dest: null}; return s.ark; }
export function sendArkToPoint(s, pt) {
  const a = arkState(s);
  const cost = (Math.hypot(pt.x - a.x, pt.y - a.y) / ARK_IMPULSE) * PROPELLANT_PER_TICK;
  if (s.propellant < cost) return {ok: false, msg: `Not enough propellant for that burn (needs ${Math.ceil(cost)}).`};
  s.propellant -= cost;
  a.dest = {x: pt.x, y: pt.y};
  return {ok: true, msg: "Ark Endeavor burns for open space."};
}
// Moves the Ark along its burn; it stops on arrival.
export function stepArk(s, dt) {
  const a = arkState(s);
  if (!a.dest || dt <= 0) return;
  const dx = a.dest.x - a.x, dy = a.dest.y - a.y, d = Math.hypot(dx, dy), step = ARK_SPEED * dt;
  if (d <= step) { a.x = a.dest.x; a.y = a.dest.y; a.dest = null; return; }
  a.x += (dx / d) * step; a.y += (dy / d) * step;
}
// Radiation level 0 (none) to 4 (severe), from the Ark's distance to the star: the closer, the harder.
export function arkRadiation(s) {
  const a = arkState(s), d = Math.hypot(a.x, a.y);
  if (d >= ARK_RAD_OUT) return 0;
  const t = Math.max(0, (ARK_RAD_OUT - d) / (ARK_RAD_OUT - ARK_RAD_IN));
  return Math.min(4, Math.ceil(4 * t * t));
}
export const MAX_PROPELLANT = 100;        // tank capacity used by depots and the telemetry bar
export const REFUEL_PER_TICK = 0.6;       // propellant taken on per tick while docked
export const HULL_REPAIR_PER_TICK = 0.05; // hull points recovered per tick while docked
export const OVERCLOCK = {speed: 1.5, burn: 2};   // overclocked thrusters: faster, double propellant burn
export const INTERCEPT_DAMAGE = 45;       // hull lost by a ship that takes an incoming strike
export const SURVEY_SECONDS = 5;          // orbital scan time for a Survey Probe
export const SURVEY_TICKS = SURVEY_SECONDS * 60;
export const CARGO_CAP = 200;             // freighter hold size
export const SIPHON_PER_TICK = 0.5;       // cargo taken on per tick while siphoning
export const SATS_PER_TENDER = 3;         // relay satellites carried by a Satellite Tender
export const PLANET_RES = {thalassa: 'biomass', aeros: 'cryo', kryos: 'compute', ferrum: 'alloys'};
// Resource a world yields: the current system's map on a jump, the starter map otherwise.
const resOf = (s, id) => s.planetRes?.[id] ?? PLANET_RES[id];
const homeOf = (s) => s.homePlanet ?? 'ferrum';
const PLANET_NAME = {thalassa: 'Thalassa', aeros: 'Aeros', ferrum: 'Ferrum', kryos: 'Kryos'};
export const CHARTED_AT_START = {thalassa: false, aeros: false, kryos: false, ferrum: true};
const ARRIVE_PAD = 4;                     // arrival distance beyond the world's radius
const DEPOT_ORBIT = 18;                   // a depot in orbit sits this far from its world

const radiusOf = (id) => PLANETS.find((p) => p.key === id)?.r ?? 10;
const hasLive = (conduits, a, b) => conduits.some((c) => !c.snapped && ((c.a === a && c.b === b) || (c.a === b && c.b === a)));
const isOrbiting = (f) => f.mode === 'orbit' || f.mode === 'survey' || f.mode === 'siphon';

// Where a fuel depot sits: beside its world when it is in orbit, otherwise at its fixed deep-space point.
export function depotPos(d, P) {
  if (d.planet && P[d.planet]) {
    const c = P[d.planet];
    return {x: c.x + DEPOT_ORBIT * Math.cos(d.ang), y: c.y + DEPOT_ORBIT * Math.sin(d.ang)};
  }
  return {x: d.x, y: d.y};
}

// Where a ship is now. Orbit-like and surf positions are derived from the worlds; transit uses the stored position.
export function shipPosition(f, P) {
  if (isOrbiting(f)) {
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
// Returns the messages the flight produced this step (scan done, delivery made, hold full, ...).
export function stepFleet(s, P, ticks, ctx) {
  const msgs = [];
  if (ticks <= 0) return msgs;
  s.surveyed = s.surveyed ?? {...CHARTED_AT_START};
  const before = s.fleet.map((f) => shipPosition(f, P));
  for (const f of s.fleet) {
    if (!f.mode) { f.mode = 'orbit'; f.planet = homeOf(s); f.ang = f.phase ?? 0; } // hulls saved before flight existed
    const max = hullMax(f) || 100;
    if (f.hp === undefined) f.hp = max;
    // Emergency Burn window runs down in kernel time, whatever the ship is doing
    if (f.emergency) { f.emergency.left -= ticks / EMERGENCY.tps; if (f.emergency.left <= 0) f.emergency = null; }
    if (f.mode === 'docked') {
      // refuel the shared tanks and mend the hull while moored at the depot
      s.propellant = Math.min(MAX_PROPELLANT, s.propellant + REFUEL_PER_TICK * ticks);
      f.hp = Math.min(max, f.hp + HULL_REPAIR_PER_TICK * ticks);
      const q = shipPosition(f, P); f.x = q.x; f.y = q.y; f.thrust = 0;
      continue;
    }
    const boost = f.overclock ? OVERCLOCK.speed : 1;
    const burn = f.overclock ? OVERCLOCK.burn : 1;
    const speed = (IMPULSE[f.type] ?? 1.5) * boost * (f.emergency ? 1 + EMERGENCY.thrust : 1);
    if (isOrbiting(f)) {
      f.ang += ORBIT_RATE * ticks;
      if (f.mode === 'survey') {
        f.surveyLeft = Math.max(0, (f.surveyLeft ?? SURVEY_TICKS) - ticks);
        if (f.surveyLeft === 0) {
          s.surveyed[f.planet] = true;
          msgs.push(`Survey complete: ${s.planetNames?.[f.planet] ?? PLANET_NAME[f.planet] ?? f.planet} is charted.`);
          f.mode = 'orbit';
        }
      }
      if (f.mode === 'siphon') {
        f.cargo = Math.min(CARGO_CAP, (f.cargo ?? 0) + SIPHON_PER_TICK * ticks);
        if (f.cargo >= CARGO_CAP) {
          f.mode = 'orbit';
          msgs.push(`Freighter hold full: ${CARGO_CAP} ${f.res}. Haul it to Ferrum.`);
        }
      }
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
      f.x = q.x; f.y = q.y; f.thrust = 0.45;   // surfing rides the tether on a throttled burn
      f.heading = Math.atan2(B.y - A.y, B.x - A.x);
      if (f.p >= 1) settleInOrbit(f, P, f.to);
      continue;
    }
    if (f.mode === 'surf') f.mode = 'transit'; // the beam was cut: fall back to an impulse burn
    // parked in open space: stays put until it is ordered elsewhere
    if (f.mode === 'hold') { f.thrust = 0; continue; }
    // burn toward an empty point in space (no world to lead)
    if (f.mode === 'transit' && !f.to && f.dest) {
      const D = f.dest, dx = D.x - f.x, dy = D.y - f.y, d = Math.hypot(dx, dy);
      if (d > 1e-6) { const step = Math.min(d, speed * ticks); f.x += (dx / d) * step; f.y += (dy / d) * step; }
      f.heading = Math.atan2(dy, dx); f.thrust = 1;
      s.propellant = Math.max(0, s.propellant - PROPELLANT_PER_TICK * burn * ticks);
      // a manual lead locks into orbit the moment the ship reaches its world, even before the aimed spot
      if (f.leadTo && P[f.leadTo] && Math.hypot(P[f.leadTo].x - f.x, P[f.leadTo].y - f.y) <= radiusOf(f.leadTo) + ARRIVE_PAD) {
        const L = f.leadTo; f.leadTo = null; f.dest = null; f.thrust = 0;
        settleInOrbit(f, P, L);
        msgs.push(`${SHIPS[f.type]?.name ?? 'Ship'} locks into orbit around ${s.planetNames?.[L] ?? PLANET_NAME[L] ?? L}.`);
        continue;
      }
      if (Math.hypot(D.x - f.x, D.y - f.y) <= 1.5) {
        const L = f.leadTo; f.leadTo = null; f.dest = null; f.thrust = 0;
        f.x = D.x; f.y = D.y;
        // a manual lead locks into orbit when its world is at the spot the ship reached
        if (L && P[L] && Math.hypot(P[L].x - D.x, P[L].y - D.y) <= radiusOf(L) + ARRIVE_PAD) {
          settleInOrbit(f, P, L);
          msgs.push(`${SHIPS[f.type]?.name ?? 'Ship'} locks into orbit around ${s.planetNames?.[L] ?? PLANET_NAME[L] ?? L}.`);
        } else {
          f.mode = 'hold';
          msgs.push(`${SHIPS[f.type]?.name ?? 'Ship'} holds position in open space.`);
        }
      }
      continue;
    }
    // impulse transit: steer at where the target will be when the ship arrives (intercept)
    const T = P[f.to];
    if (!T) { f.mode = 'orbit'; f.planet = homeOf(s); f.ang = 0; continue; }
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
      const name = SHIPS[f.type]?.name ?? 'Ship';
      if (String(f.to).startsWith('depot')) {
        // moor at the depot: the ship stops there and refuels until it is ordered away
        f.mode = 'docked'; f.depot = f.to; f.from = null; f.to = null; f.thrust = 0;
        const q = shipPosition(f, P); f.x = q.x; f.y = q.y;
        continue;
      }
      const arrived = f.to;
      settleInOrbit(f, P, arrived);
      if (f.type === 'probe' && !s.surveyed[arrived]) {
        f.mode = 'survey'; f.surveyLeft = SURVEY_TICKS;
        msgs.push(`${name} in orbit of ${s.planetNames?.[arrived] ?? PLANET_NAME[arrived] ?? arrived}: scan running.`);
      } else if (f.type === 'freighter' && arrived === homeOf(s) && (f.cargo ?? 0) > 0) {
        const got = Math.floor(f.cargo);
        s[f.res] = (s[f.res] ?? 0) + got;
        msgs.push(`Freighter delivered ${got} ${f.res} to the Ferrum stockpile.`);
        f.cargo = 0; f.res = null;
      } else if (f.type === 'freighter' && resOf(s, arrived) && s.surveyed[arrived]) {
        if ((f.cargo ?? 0) > 0 && f.res !== resOf(s, arrived)) {
          msgs.push(`Hold still carries ${f.res}. Deliver it to Ferrum first.`);
        } else {
          f.mode = 'siphon'; f.res = resOf(s, arrived); f.cargo = f.cargo ?? 0;
        }
      }
    }
  }
  s.fleet.forEach((f, i) => {
    const b = shipPosition(f, P), a = before[i];
    bankShip(f, b.x - a.x, b.y - a.y, ticks);
  });
  return msgs;
}

// Issues a flight order to a world or a fuel depot. Returns {ok, msg}. A ship in orbit surfs when a live conduit joins
// its world to the target; otherwise it burns for the target, provided it has the propellant for the trip.
// Where a world will be after tau ticks, turning around the core at its current angular speed (worlds ride circular orbits).
export function predictOrbit(T, v, core, tau) {
  const dx = T.x - core.x, dy = T.y - core.y, r2 = dx * dx + dy * dy;
  if (r2 < 1e-9) return {x: T.x + v.x * tau, y: T.y + v.y * tau};
  const w = (dx * v.y - dy * v.x) / r2, c = Math.cos(w * tau), sn = Math.sin(w * tau);
  return {x: core.x + dx * c - dy * sn, y: core.y + dx * sn + dy * c};
}

// Time for a ship at speed s to meet a target that starts at offset D and moves at v (per tick): the smallest positive
// root of |D + v t| = s t. Falls back to a stationary estimate if the target outruns the ship.
export function interceptTime(D, v, s) {
  const a = v.x * v.x + v.y * v.y - s * s, b = 2 * (D.x * v.x + D.y * v.y), c = D.x * D.x + D.y * D.y;
  let roots = [];
  if (Math.abs(a) < 1e-12) { if (b !== 0) roots = [-c / b]; }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const sq = Math.sqrt(disc); roots = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]; }
  }
  const pos = roots.filter((r) => r > 0);
  return pos.length ? Math.min(...pos) : Math.hypot(D.x, D.y) / s;
}

// lead: 'auto' (default) follows the world and locks into its orbit on arrival. 'manual' aims at where the world will be
// on arrival (the ghost pip), flies there, and locks into orbit if the world is at that spot when the ship arrives.
// vel: each world's speed per tick, used to aim the manual lead. Depots always dock, so they stay on auto.
export function sendShip(s, f, targetId, P, conduits, targetName, lead = 'auto', vel = {}) {
  const name = SHIPS[f.type]?.name ?? 'Ship';
  if (f.mode === 'orbit' && f.planet === targetId) return {ok: false, msg: `${name} is already in orbit around ${targetName}.`};
  const T = P[targetId];
  if (!T) return {ok: false, msg: 'That target is out of reach.'};
  if (lead === 'manual' && !String(targetId).startsWith('depot')) {
    const q = shipPosition(f, P), v = vel[targetId] ?? {x: 0, y: 0};
    const speed = (IMPULSE[f.type] ?? 1.5) * (f.overclock ? OVERCLOCK.speed : 1);
    // solve for the arrival time against the world's orbit, not a straight line: it turns around the star as it goes
    const core = P.core ?? {x: 0, y: 0};
    let tau = Math.hypot(T.x - q.x, T.y - q.y) / speed;
    for (let i = 0; i < 60; i++) tau = Math.hypot(predictOrbit(T, v, core, tau).x - q.x, predictOrbit(T, v, core, tau).y - q.y) / speed;
    const r = sendShipToPoint(s, f, predictOrbit(T, v, core, tau), P);
    if (!r.ok) return r;
    f.leadTo = targetId;
    return {ok: true, msg: `${name} burns to lead ${targetName}.`};
  }
  if (f.type === 'freighter' && resOf(s, targetId) && targetId !== homeOf(s) && !(s.surveyed ?? CHARTED_AT_START)[targetId]) {
    return {ok: false, msg: `Scan ${targetName} with a Survey Probe before siphoning it.`};
  }
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

// A Satellite Tender lays one of its relay satellites at its current position. The satellite joins the relay list,
// so tethers can route through it. Returns {ok, msg}.
export function deploySatellite(s, f, P) {
  if (f.type !== 'tender') return {ok: false, msg: 'Only a Satellite Tender can deploy relays.'};
  if (f.mode === 'docked') return {ok: false, msg: 'Undock before deploying a relay.'};
  const left = f.sats ?? SATS_PER_TENDER;
  if (left <= 0) return {ok: false, msg: 'No relay satellites left aboard.'};
  const q = shipPosition(f, P);
  if (Math.hypot(q.x, q.y) < RULES.COLLAPSE_R) return {ok: false, msg: 'Too deep in the collapse to hold a relay.'};
  f.sats = left - 1;
  const id = 'relay' + (++s.relayN);
  s.relays.push({id, x: q.x, y: q.y, hp: RULES.RELAY_HP});
  return {ok: true, msg: `Relay satellite locked into orbit. ${f.sats} left aboard.`};
}

// Send a ship to an empty point in space. It burns there, then holds position until ordered elsewhere.
// Emergency Burn: an engaged ship given a reroute ignites for EMERGENCY.cost propellant. With the tank empty it
// burns dirty at standard speed, with no boost and no chaff.
export function emergencyBurn(s, f) {
  if (s.propellant < EMERGENCY.cost) { f.emergency = null; return {ok: false, msg: "Propellant empty: burning dirty at standard speed."}; }
  s.propellant = Math.max(0, s.propellant - EMERGENCY.cost);
  f.emergency = {left: EMERGENCY.seconds};
  return {ok: true, msg: "EMERGENCY BURN: thrusters at full, chaff out."};
}

export function sendShipToPoint(s, f, pt, P) {
  const name = SHIPS[f.type]?.name ?? 'Ship';
  const q = shipPosition(f, P);
  const burn = f.overclock ? OVERCLOCK.burn : 1;
  const cost = (Math.hypot(pt.x - q.x, pt.y - q.y) / (IMPULSE[f.type] ?? 1.5)) * PROPELLANT_PER_TICK * burn;
  if (s.propellant < cost) return {ok: false, msg: `Not enough propellant for that burn (needs ${Math.ceil(cost)}).`};
  f.mode = 'transit'; f.to = null; f.from = null; f.leadTo = null; f.dest = {x: pt.x, y: pt.y}; f.x = q.x; f.y = q.y; f.thrust = 1;
  return {ok: true, msg: `${name} burns for open space.`};
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
