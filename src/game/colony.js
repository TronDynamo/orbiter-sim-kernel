// Colony Governor: planetary infrastructure. Costs, happiness and the shield's strike rule are approved.
import {shortfall} from "./rules.js";

export const INFRA = [
  {key: "dome", name: "Biosphere Dome", resource: "biomass", rate: 10, cost: {credits: 80, alloys: 40}, blurb: "+10 Biomass/s while connected."},
  {key: "foundry", name: "Deep-Core Foundry", resource: "alloys", rate: 12, cost: {credits: 150, alloys: 60}, blurb: "+12 Alloys/s while connected."},
  {key: "labs", name: "Quantum Labs", resource: "compute", rate: 10, cost: {credits: 120, cryo: 50}, blurb: "+10 Compute/s while connected."},
  {key: "freeport", name: "Commercial Free-Port", resource: "credits", rate: 25, cost: {credits: 200, alloys: 70}, blurb: "+25 Credits/s while connected."},
  {key: "barrier", name: "Planetary Barrier Shield", resource: null, rate: 0, cost: {credits: 300, alloys: 150, compute: 40}, blurb: "Absorbs the next strike aimed at this world; rebuild to restore."},
];

const BASE_HAPPINESS = 50, PER_BUILDING = 5, STRUCK_PENALTY = 25;

export const infraOf = (state, planetId) => state.infra[planetId] ?? [];

// Happiness 0..100: placeholder formula. Buildings lift it; a struck world loses it.
export function happinessOf(state, planetId, struck) {
  const h = BASE_HAPPINESS + PER_BUILDING * infraOf(state, planetId).length - (struck ? STRUCK_PENALTY : 0);
  return Math.max(0, Math.min(100, h));
}

// Cost after Senate effects: a Defense Subsidy halves the Planetary Barrier Shield.
export function costOf(state, d) {
  const mult = d.key === "barrier" ? (state.senate?.effects?.barrierMult ?? 1) : 1;
  return Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.round(v * mult)]));
}

// Builds one of each per world. Returns {ok, msg}.
export function buildInfra(state, planetId, key) {
  const d = INFRA.find((x) => x.key === key);
  if (!d) return {ok: false, msg: "Unknown structure."};
  const list = infraOf(state, planetId);
  if (list.includes(key)) return {ok: false, msg: `${d.name} already stands here.`};
  const cost = costOf(state, d);
  const short = shortfall(state, cost);
  if (short) return {ok: false, msg: `${d.name} needs ${short}.`};
  for (const [k, v] of Object.entries(cost)) state[k] -= v;
  state.infra[planetId] = [...list, key];
  return {ok: true, msg: `${d.name} completed.`};
}

// A barrier absorbs one strike and is then spent. Returns true when a strike was absorbed.
export function absorbStrike(state, planetId) {
  const list = infraOf(state, planetId);
  if (!list.includes("barrier")) return false;
  state.infra[planetId] = list.filter((k) => k !== "barrier");
  return true;
}
