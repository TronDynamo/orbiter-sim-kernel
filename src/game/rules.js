// Orbiter: Stellar Conquest rules (prototype). Pure functions. Positions come in as a map {id: {x, y}} in the
// plane the engine draws, so the rules and the picture always agree.
import {NAMES, ARK_POS} from './galaxy.js';
import {SHIPS, COST_LABEL} from './ships.js';
import {WEAPONS as WEAPON_DEFS} from '../../config/planets.js';

export const RULES = {
  START: {hull: 100, fuel: 120, propellant: 60, alloys: 60, cryo: 20},
  MAX_TENSION: 300,       // tether length at which it snaps
  EVENT_HORIZON: 44,      // tethers that dip inside this snap
  COLLAPSE_R: 70,         // relays inside this are lost to collapse
  WHIPLASH_HULL: 12,      // hull damage when a tether snaps under tension
  WHIPLASH_RELAY: 15,     // relay damage within WHIPLASH_R of the snap
  WHIPLASH_R: 40,
  RELAY_HP: 30,
  RELAY_MIN: 60, RELAY_MAX: 440,
  TETHER_FUEL: 0.2,       // fuel per tether per tick
  LIFE_FUEL: 0.5,         // life support per tick
  YEAR_SECONDS: 40,       // one solar orbit; radiation rises each year (prototype value)
  DATA_GOAL: 300,         // singularity data to finish the gravitational drive (prototype value)
  COST: {tether: {alloys: 5}, relay: {alloys: 15, cryo: 5}, repair: {alloys: 10}},
  REPAIR_HULL: 25,
};

export const TENSION = {
  green: '#10B981', yellow: '#F5C542', orange: '#F97316', red: '#EF4444',
};
export const tensionColor = (r) => (r < 0.6 ? TENSION.green : r < 0.8 ? TENSION.yellow : r < 0.92 ? TENSION.orange : TENSION.red);

export const newState = () => ({
  ...RULES.START,
  data: 0,
  radiation: 0,
  year: 1,
  lastTick: 0,
  tethers: [],   // {a, b}
  biomass: 0,    // siphoned from Thalassa through conduits
  compute: 0,    // siphoned from Kryos through conduits
  credits: 0,    // conduit and population income (see GameApp)
  queue: [],     // hulls under construction: {id, type, left}
  fleet: [],     // launched hulls: {id, type, phase}
  shipN: 0,
  reload: {},    // seconds until each weapon can fire again, by kernel WeaponClass index
  spent: {},     // one-shot weapons already fired (Star-Killer)
  infra: {},     // Colony Governor: planet id -> built structure keys
  opinion: {},   // diplomacy: per-faction opinion, -100..100
  comms: {selected: 'aurelius', log: []},
  relays: [],    // {id, x, y, hp}
  relayN: 0,
  won: null,
  lost: null,
  mode: null,
  flashes: [],   // whiplash effects for the renderer: {x, y, t}
});

const nm = (id) => NAMES[id] || id;

export function distFromCore(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  let t = L2 ? -(a.x * dx + a.y * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + dx * t, a.y + dy * t);
}

export const tensionOf = (t, P) => {
  const A = P[t.a], B = P[t.b];
  return A && B ? Math.hypot(B.x - A.x, B.y - A.y) / RULES.MAX_TENSION : 0;
};

// null if the tether is healthy, otherwise why it fails.
export function tetherState(t, P) {
  const A = P[t.a], B = P[t.b];
  if (!A || !B) return 'missing';
  if (tensionOf(t, P) >= 1) return 'snap';
  if (t.a !== 'core' && t.b !== 'core' && distFromCore(A, B) < RULES.EVENT_HORIZON) return 'horizon';
  return null;
}

// Removes failing tethers and applies whiplash. Returns events for the HUD.
export function snapTethers(state, P, now = 0) {
  const events = [];
  state.tethers = state.tethers.filter((t) => {
    const why = tetherState(t, P);
    if (!why) return true;
    if (why === 'missing') return false;
    const A = P[t.a], B = P[t.b];
    if (why === 'snap') {
      const mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
      state.hull -= RULES.WHIPLASH_HULL;
      for (const r of state.relays) {
        if (Math.hypot(r.x - mid.x, r.y - mid.y) < RULES.WHIPLASH_R) r.hp -= RULES.WHIPLASH_RELAY;
      }
      state.flashes.push({x: mid.x, y: mid.y, t: now});
      events.push(`Tether snapped: ${nm(t.a)} to ${nm(t.b)}. Whiplash hit the hull.`);
    } else {
      events.push(`Tether ${nm(t.a)} to ${nm(t.b)} dipped into the event horizon and was lost.`);
    }
    return false;
  });
  // relays that are too deep in the collapse or ground down by whiplash are lost
  state.relays = state.relays.filter((r) => {
    if (r.hp <= 0) { events.push('A relay satellite was destroyed.'); return false; }
    if (Math.hypot(r.x, r.y) < RULES.COLLAPSE_R) { events.push('A relay satellite fell into the collapse.'); return false; }
    return true;
  });
  state.tethers = state.tethers.filter((t) => [t.a, t.b].every((id) => id === 'core' || id === 'ark' || PLANET_OR_RELAY(state, id)));
  return events;
}
const PLANET_OR_RELAY = (state, id) => ['thalassa', 'aeros', 'ferrum', 'kryos'].includes(id) || state.relays.some((r) => r.id === id);

// Nodes reachable from the Ark through intact tethers.
export function network(state) {
  const adj = {};
  for (const t of state.tethers) {
    (adj[t.a] ??= []).push(t.b);
    (adj[t.b] ??= []).push(t.a);
  }
  const seen = new Set(['ark']), q = ['ark'];
  while (q.length) {
    const n = q.shift();
    for (const m of adj[n] || []) if (!seen.has(m)) { seen.add(m); q.push(m); }
  }
  return seen;
}

// Error message, or null when the tether can be attached.
export function checkTether(state, a, b, P) {
  if (a === b) return 'Pick a different body.';
  if (state.tethers.some((t) => (t.a === a && t.b === b) || (t.a === b && t.b === a))) return 'Already tethered.';
  const net = network(state);
  if (!net.has(a) && !net.has(b)) return 'Start from the Ark or a connected body.';
  const A = P[a], B = P[b];
  if (!A || !B) return 'Unknown body.';
  const len = Math.hypot(B.x - A.x, B.y - A.y);
  if (len > RULES.MAX_TENSION) return `Out of reach. Wait for a transfer window (under ${RULES.MAX_TENSION} units).`;
  if (a !== 'core' && b !== 'core' && distFromCore(A, B) < RULES.EVENT_HORIZON) return 'The dying star blocks that line. Use a relay satellite.';
  const c = RULES.COST.tether;
  if (state.alloys < c.alloys) return `Need ${c.alloys} alloys for a tether.`;
  return null;
}

export function tryTether(state, a, b, P) {
  const err = checkTether(state, a, b, P);
  if (err) return {ok: false, msg: err};
  state.alloys -= RULES.COST.tether.alloys;
  state.tethers.push({a, b});
  return {ok: true, msg: `Tether established: ${nm(a)} to ${nm(b)}.`};
}

// Deliberate decoupling vents gas and loses no hull.
export function cut(state, index) {
  const t = state.tethers[index];
  if (!t) return {ok: false, msg: 'No tether there.'};
  state.tethers.splice(index, 1);
  state.propellant = Math.max(0, state.propellant - 3);
  return {ok: true, msg: `Decoupled ${nm(t.a)} from ${nm(t.b)}. Vented 3 propellant.`};
}

// Point-to-segment distance, for clicking a tether.
export function distToTether(pt, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, L2 ? ((pt.x - A.x) * dx + (pt.y - A.y) * dy) / L2 : 0));
  return Math.hypot(A.x + dx * t - pt.x, A.y + dy * t - pt.y);
}
export function tetherAt(state, P, pt, pad = 10) {
  let best = -1, bd = pad;
  state.tethers.forEach((t, i) => {
    if (!P[t.a] || !P[t.b]) return;
    const d = distToTether(pt, P[t.a], P[t.b]);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// One game second: production, upkeep, radiation, collapse, win/lose. Returns events.
export function tick(state, P) {
  const events = [];
  const net = network(state);
  const rad = state.radiation;
  if (net.has('thalassa')) state.fuel += 3 * (1 + 0.15 * rad);
  if (net.has('aeros')) state.propellant += 2 * (1 + 0.15 * rad);
  // Alloys, coolant, biomass and compute are siphoned through conduits by the kernel (see GameApp).
  if (net.has('core')) state.data += 1;
  // Armory reloads count down one game second each.
  for (const k of Object.keys(state.reload)) state.reload[k] = Math.max(0, state.reload[k] - 1);
  // Shipyard: each queued hull counts down one game second; finished hulls join the fleet.
  state.queue = state.queue.filter((q) => {
    q.left -= 1;
    if (q.left > 0) return true;
    state.fleet.push({id: q.id, type: q.type, phase: state.fleet.length * 2.4});
    events.push({msg: `${SHIPS[q.type].name} launched. It holds orbit around Ferrum.`});
    return false;
  });
  for (const id of ['thalassa', 'aeros']) if (net.has(id)) state.hull -= 0.03 * rad;
  state.fuel -= RULES.LIFE_FUEL + state.tethers.length * RULES.TETHER_FUEL;
  state.fuel = Math.max(0, state.fuel);
  state.year = Math.floor(state.lastTick / RULES.YEAR_SECONDS) + 1;
  state.radiation = state.year - 1;
  if (!state.won && !state.lost) {
    if (state.hull <= 0) { state.lost = 'The Ark Endeavor breached its hull.'; events.push({lose: true, msg: state.lost}); }
    else if (state.fuel <= 0) { state.lost = 'The Ark is stranded: no fuel left.'; events.push({lose: true, msg: state.lost}); }
    else if (state.data >= RULES.DATA_GOAL) { state.won = 'Gravitational drive online. The Ark escapes the dying system.'; events.push({win: true, msg: state.won}); }
  }
  return events;
}

// Hit-test a world point against the Ark, the core, planets and relays.
export function hitBody(state, P, pt) {
  let best = null, bd = Infinity;
  for (const id of Object.keys(P)) {
    const r = id === 'core' ? RULES.EVENT_HORIZON : id === 'ark' ? 26 : id.startsWith('relay') ? 18 : 30;
    const d = Math.hypot(P[id].x - pt.x, P[id].y - pt.y);
    if (d <= r && d < bd) { best = id; bd = d; }
  }
  return best;
}

// Names the missing resources for a cost, or null when it is affordable.
export function shortfall(state, cost) {
  const parts = Object.entries(cost).filter(([k, v]) => state[k] < v)
    .map(([k, v]) => `${Math.ceil(v - state[k])} more ${COST_LABEL[k] ?? k}`);
  return parts.length ? parts.join(', ') : null;
}

// Fires a strategic weapon: deducts the cost, starts the reload. typeIdx is the kernel WeaponClass.
export function fireWeapon(state, typeIdx) {
  const def = WEAPON_DEFS[typeIdx];
  if (!def) return {ok: false, msg: 'Unknown weapon.'};
  if (state.spent[typeIdx]) return {ok: false, msg: `${def.name} is already spent for this match.`};
  if ((state.reload[typeIdx] ?? 0) > 0) return {ok: false, msg: `${def.name} reloads in ${Math.ceil(state.reload[typeIdx])}s.`};
  const short = shortfall(state, def.cost);
  if (short) return {ok: false, msg: `${def.name} needs ${short}.`};
  for (const [k, v] of Object.entries(def.cost)) state[k] -= v;
  if (def.reloadSeconds == null) state.spent[typeIdx] = true;
  else state.reload[typeIdx] = def.reloadSeconds;
  return {ok: true, msg: `${def.name} launched.`};
}

// Orders a hull: deducts the cost now and queues the build. Returns {ok, msg}.
export function orderShip(state, type) {
  const ship = SHIPS[type];
  if (!ship) return {ok: false, msg: 'Unknown hull.'};
  const short = shortfall(state, ship.cost);
  if (short) return {ok: false, msg: `${ship.name} needs ${short}.`};
  for (const [k, v] of Object.entries(ship.cost)) state[k] -= v;
  state.queue.push({id: ++state.shipN, type, left: ship.seconds});
  return {ok: true, msg: `${ship.name} ordered. Launch in ${ship.seconds}s.`};
}

export function canAfford(state, cost) {
  return Object.entries(cost).every(([k, v]) => state[k] >= v);
}
function spend(state, cost) { for (const [k, v] of Object.entries(cost)) state[k] -= v; }

// Build or repair. pt is in world units. Returns {ok, msg}.
export function build(state, what, pt, P) {
  if (what === 'relay') {
    const cost = RULES.COST.relay;
    if (!canAfford(state, cost)) return {ok: false, msg: 'Relay needs 15 alloys and 5 cryo.'};
    const d = Math.hypot(pt.x, pt.y);
    if (d < RULES.RELAY_MIN || d > RULES.RELAY_MAX) return {ok: false, msg: 'Place relays between the core and the outer orbit.'};
    if (hitBody(state, P, pt)) return {ok: false, msg: 'Too close to a body.'};
    spend(state, cost);
    state.relays.push({id: 'relay' + (++state.relayN), x: pt.x, y: pt.y, hp: RULES.RELAY_HP});
    return {ok: true, msg: 'Relay satellite deployed. It blocks no lines, but it bridges the core.'};
  }
  if (what === 'repair') {
    const cost = RULES.COST.repair;
    if (!canAfford(state, cost)) return {ok: false, msg: 'Hull repair needs 10 alloys.'};
    if (state.hull >= 100) return {ok: false, msg: 'Hull is already intact.'};
    spend(state, cost);
    state.hull = Math.min(100, state.hull + RULES.REPAIR_HULL);
    return {ok: true, msg: 'Hull patched.'};
  }
  return {ok: false, msg: 'Unknown action.'};
}
