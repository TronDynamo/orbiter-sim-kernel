// Ship flight on the orbital map. Ships share the worlds' coordinates and move on the same clock as the kernel.
// Modes: orbit (low orbit around a world), transit (impulse burn toward a world or a fuel depot), surf (riding a
// live conduit at SURF_MULT times impulse speed, no propellant), docked (refuelling and repairing at a fuel depot),
// survey (probe scanning an uncharted world), siphon (freighter filling its hold from a charted world).
import {PLANETS} from "../../config/planets.js";
import {SHIPS} from "./ships.js";
import {bankShip} from "./pseudo3d.js";
import {RULES} from "./rules.js";

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
      if (Math.hypot(D.x - f.x, D.y - f.y) <= 1.5) {
        f.x = D.x; f.y = D.y; f.mode = 'hold'; f.dest = null; f.thrust = 0;
        msgs.push(`${SHIPS[f.type]?.name ?? 'Ship'} holds position in open space.`);
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
export function sendShip(s, f, targetId, P, conduits, targetName) {
  const name = SHIPS[f.type]?.name ?? 'Ship';
  if (f.mode === 'orbit' && f.planet === targetId) return {ok: false, msg: `${name} is already in orbit around ${targetName}.`};
  const T = P[targetId];
  if (!T) return {ok: false, msg: 'That target is out of reach.'};
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
export function sendShipToPoint(s, f, pt, P) {
  const name = SHIPS[f.type]?.name ?? 'Ship';
  const q = shipPosition(f, P);
  const burn = f.overclock ? OVERCLOCK.burn : 1;
  const cost = (Math.hypot(pt.x - q.x, pt.y - q.y) / (IMPULSE[f.type] ?? 1.5)) * PROPELLANT_PER_TICK * burn;
  if (s.propellant < cost) return {ok: false, msg: `Not enough propellant for that burn (needs ${Math.ceil(cost)}).`};
  f.mode = 'transit'; f.to = null; f.from = null; f.dest = {x: pt.x, y: pt.y}; f.x = q.x; f.y = q.y; f.thrust = 1;
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
