// Colony Governor: planetary infrastructure. Building effects come from the design brief.
// Costs, happiness and the shield's strike rule are PLACEHOLDER values until the balance table lands.
import {shortfall} from "./rules.js";

export const INFRA = [
  {key: "dome", name: "Biosphere Dome", resource: "biomass", rate: 10, cost: {credits: 400, alloys: 150}, blurb: "+10 Biomass/s while connected."},
  {key: "foundry", name: "Deep-Core Foundry", resource: "alloys", rate: 12, cost: {credits: 300, alloys: 200}, blurb: "+12 Alloys/s while connected."},
  {key: "labs", name: "Quantum Labs", resource: "compute", rate: 10, cost: {credits: 800, alloys: 300}, blurb: "+10 Compute/s while connected."},
  {key: "freeport", name: "Commercial Free-Port", resource: "credits", rate: 25, cost: {credits: 500, alloys: 250}, blurb: "+25 Credits/s while connected."},
  {key: "barrier", name: "Planetary Barrier Shield", resource: null, rate: 0, cost: {credits: 1200, alloys: 800}, blurb: "Stops the next strike aimed at this world."},
];

const BASE_HAPPINESS = 50, PER_BUILDING = 5, STRUCK_PENALTY = 25;

export const infraOf = (state, planetId) => state.infra[planetId] ?? [];

// Happiness 0..100: placeholder formula. Buildings lift it; a struck world loses it.
export function happinessOf(state, planetId, struck) {
  const h = BASE_HAPPINESS + PER_BUILDING * infraOf(state, planetId).length - (struck ? STRUCK_PENALTY : 0);
  return Math.max(0, Math.min(100, h));
}

// Builds one of each per world. Returns {ok, msg}.
export function buildInfra(state, planetId, key) {
  const d = INFRA.find((x) => x.key === key);
  if (!d) return {ok: false, msg: "Unknown structure."};
  const list = infraOf(state, planetId);
  if (list.includes(key)) return {ok: false, msg: `${d.name} already stands here.`};
  const short = shortfall(state, d.cost);
  if (short) return {ok: false, msg: `${d.name} needs ${short}.`};
  for (const [k, v] of Object.entries(d.cost)) state[k] -= v;
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
