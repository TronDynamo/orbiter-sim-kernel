// Victory conditions, checked once per game second. Thresholds are PLACEHOLDERS until the design spec lands.
import {LEADERS} from "./roster_data.js";
import {opinionOf} from "./comms.js";

export const VICTORIES = {
  domination: {title: "Absolute Orbital Hegemony", blurb: "Every world in the system bears the mark of your weapons."},
  science: {title: "Galactic Dyson Network", blurb: "A conduit ring now encircles the star, and the Stellar AI Core wakes."},
  diplomacy: {title: "Supreme Chancellor", blurb: "A majority of the Senate follows you."},
  economic: {title: "Economic Monopoly", blurb: "Every world is taxed through your Free-Ports, and the treasury overflows."},
};
export const DIPLOMACY_NEEDED = 11;     // of 20 leaders
export const DIPLOMACY_OPINION = 50;
export const ECONOMY_CREDITS = 5000;

// planets: [{id, status, flow}] in planet order. conduits: [{source, target, snapped}] by planet index.
export function checkVictory(state, planets, conduits) {
  if (state.victory) return null;
  // Domination: every world has been struck or collapsed.
  if (planets.length && planets.every((p) => p.status !== 0)) return "domination";
  // Science: Dyson Framework researched and every world sits on a loop of live conduits.
  if (state.tech?.dyson && ringed(planets.length, conduits)) return "science";
  // Diplomacy: a majority of leaders hold a high opinion of the player.
  const friends = LEADERS.filter((l) => opinionOf(state, l.id) >= DIPLOMACY_OPINION).length;
  if (friends >= DIPLOMACY_NEEDED) return "diplomacy";
  // Economy: every world has a Free-Port and the treasury is large.
  const free = planets.every((_, i) => (state.infra[planets[i].id] ?? []).includes("freeport"));
  if (free && state.credits >= ECONOMY_CREDITS) return "economic";
  return null;
}

// True when every world has at least two live conduits and all worlds are in one connected network.
function ringed(n, conduits) {
  const live = conduits.filter((c) => !c.snapped);
  const degree = new Array(n).fill(0), parent = Array.from({length: n}, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const c of live) {
    degree[c.source]++; degree[c.target]++;
    parent[find(c.source)] = find(c.target);
  }
  if (!n || degree.some((d) => d < 2)) return false;
  return new Set(Array.from({length: n}, (_, i) => find(i))).size === 1;
}
