// Diplomacy: opinion per faction (-100..100) and the four tactical replies.
// Opinion deltas and costs are PLACEHOLDER balance values until the design spec is available.
import {factionById} from "./factions.js";

export const OPINION_MIN = -100, OPINION_MAX = 100;
export const CHOICES = [
  {key: "respect", label: "Military Respect", line: "Your fleets speak for you. We respect strength.", delta: 10, cost: {}},
  {key: "trade", label: "Trade Concessions", line: "We offer fair terms on alloys and passage.", delta: 12, cost: {credits: 500}},
  {key: "intimidate", label: "Intimidation", line: "Refuse us, and the Ark will not hesitate.", delta: -15, cost: {}},
  {key: "research", label: "Research Sharing", line: "Our singularity data is yours to study.", delta: 8, cost: {}, reward: {compute: 20}},
];

export const clampOpinion = (v) => Math.max(OPINION_MIN, Math.min(OPINION_MAX, v));
export const opinionOf = (state, id) => state.opinion[id] ?? 0;

// Applies a reply to the selected leader. Returns {ok, msg}.
export function applyChoice(state, factionId, key) {
  const f = factionById(factionId), c = CHOICES.find((x) => x.key === key);
  if (!f || !c) return {ok: false, msg: "No reply."};
  for (const [k, v] of Object.entries(c.cost)) if (state[k] < v) return {ok: false, msg: `Not enough ${k} for that offer.`};
  for (const [k, v] of Object.entries(c.cost)) state[k] -= v;
  for (const [k, v] of Object.entries(c.reward ?? {})) state[k] += v;
  const before = opinionOf(state, factionId), after = clampOpinion(before + c.delta);
  state.opinion[factionId] = after;
  const shift = after - before;
  state.comms.log.push({faction: factionId, from: "you", text: c.line, label: c.label});
  const reply = shift >= 0 ? "considers your offer." : "takes your words as a threat.";
  state.comms.log.push({faction: factionId, from: "them", text: `${f.name} ${reply}`, shift});
  return {ok: true, msg: `${f.name}: ${shift >= 0 ? "+" : ""}${shift} opinion.`};
}

export function newComms() {
  return {selected: "aurelius", log: []};
}
export function openComms(state, factionId) {
  const f = factionById(factionId);
  state.comms.selected = factionId;
  if (!state.comms.log.some((m) => m.faction === factionId && m.opener)) {
    state.comms.log.push({faction: factionId, from: "them", text: f.opener, opener: true});
  }
}
