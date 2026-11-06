// Diplomacy: opinion per faction (-100..100) and the four tactical replies.
// Opinion deltas and costs are PLACEHOLDER balance values until the design spec is available.
import {factionById, FACTIONS} from "./factions.js";

export const OPINION_MIN = -100, OPINION_MAX = 100;
export const CHOICES = [
  {key: "respect", label: "Military Respect", line: "Your fleets speak for you. We respect strength.", delta: 10, cost: {}},
  {key: "trade", label: "Trade Concessions", line: "We offer fair terms on alloys and passage.", delta: 12, cost: {credits: 500}},
  {key: "intimidate", label: "Intimidation", line: "Refuse us, and the Ark will not hesitate.", delta: -15, cost: {}},
  {key: "research", label: "Research Sharing", line: "Our singularity data is yours to study.", delta: 8, cost: {}, reward: {compute: 20}},
];

export const clampOpinion = (v) => Math.max(OPINION_MIN, Math.min(OPINION_MAX, v));
export const opinionOf = (state, id) => state.opinion[id] ?? factionById(id)?.defaultRep ?? 0;

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
  return {selected: "leon_11", log: []};
}
export function openComms(state, factionId) {
  const f = factionById(factionId);
  state.comms.selected = factionId;
  if (!state.comms.log.some((m) => m.faction === factionId && m.opener)) {
    state.comms.log.push({faction: factionId, from: "them", text: f.opener, opener: true});
  }
}

// Raider hails: when a raid wave enters, its warband can be dealt with before it strikes. Balance values are placeholders.
export const RAIDER_ID = "raiders";
export const RAIDER_CHOICES = [
  {key: "payoff", label: "Pay them off", line: "Take this and leave the Ark alone."},
  {key: "fight", label: "Engage", line: "You will not take a single bolt from us."},
  {key: "intimidate", label: "Intimidate", line: "Look at the fleet you are facing. Turn around."},
  {key: "ally", label: "Offer alliance", line: "Ride with us. There is more in it than plunder."},
];
export const payoffCost = (n) => 20 + 15 * n;
export const ALLY_RESPECT = 20;

// Resolves a raider hail. wave: {n, armed} where armed is how many warships the player fields.
// Returns {ok, msg, depart}: depart true means the wave leaves without fighting.
export function applyRaiderChoice(state, key, wave) {
  const c = RAIDER_CHOICES.find((x) => x.key === key);
  if (!c) return {ok: false, msg: "No reply."};
  const before = opinionOf(state, RAIDER_ID);
  const change = (d) => { state.opinion[RAIDER_ID] = clampOpinion(before + d); return state.opinion[RAIDER_ID] - before; };
  if (key === "payoff") {
    const cost = payoffCost(wave.n);
    if (state.credits < cost) return {ok: false, msg: `The raiders want ${cost} credits. You have ${Math.floor(state.credits)}.`};
    state.credits -= cost;
    const shift = change(5);
    return {ok: true, depart: true, msg: `Raiders paid ${cost} credits and withdrew. Respect ${shift >= 0 ? "+" : ""}${shift}.`};
  }
  if (key === "fight") {
    const shift = change(-5);
    return {ok: true, depart: false, msg: `Raiders take your refusal as a challenge. Respect ${shift}.`};
  }
  if (key === "intimidate") {
    if (wave.armed >= wave.n) {
      const shift = change(-5);
      return {ok: true, depart: true, msg: `The raiders see your fleet and withdraw. Respect ${shift}.`};
    }
    const shift = change(-10);
    return {ok: true, depart: false, msg: `Your fleet is too thin to frighten them. They press on. Respect ${shift}.`};
  }
  if (key === "ally") {
    if (before < ALLY_RESPECT) return {ok: false, msg: `They do not trust you yet (respect ${before}, needs ${ALLY_RESPECT}).`};
    const shift = change(10);
    return {ok: true, depart: true, msg: `The raiders stand down and offer their help. Respect +${shift}.`};
  }
  return {ok: false, msg: "No reply."};
}

// Ally conflicts: an allied faction present while raiders fight in your system can be asked to join the fight or stand down.
// Helping raises that faction's alliance strain (its trust with its own allies falls). Past ALLY_STRAIN_LIMIT it refuses.
// Balance values are placeholders.
export const ALLY_STRAIN_LIMIT = 3;
export const ALLY_CHOICES = [
  {key: "help", label: "Ask them to help", line: "Our enemies are yours. Stand with us against these raiders."},
  {key: "stand", label: "Ask them to stand down", line: "Keep out of this. We will handle it ourselves."},
];
export const AID = {n: 2, dps: 4, hull: 120};   // an aid wave: ships, damage per ship per second, hull points. It stays until destroyed or sent home.
export const strainOf = (state, id) => state.strain?.[id] ?? 0;

// The first allied faction (not the player's commander) that can be asked about this conflict, or null.
export function allyForConflict(state, asked = new Set()) {
  return FACTIONS.find((f) => f.id !== state.commander && !asked.has(f.id) && opinionOf(state, f.id) >= ALLY_RESPECT)?.id ?? null;
}

// Resolves an ally choice. Returns {ok, msg, aid}: aid is an aid wave to add to combat, or null.
export function applyAllyChoice(state, factionId, key, onStation = false) {
  const f = factionById(factionId), c = ALLY_CHOICES.find((x) => x.key === key);
  if (!f || !c) return {ok: false, msg: "No reply.", aid: null};
  const before = opinionOf(state, factionId);
  if (key === "stand") {
    state.opinion[factionId] = clampOpinion(before + 2);
    return {ok: true, msg: `${f.name} stands down. Respect +2.`, aid: null};
  }
  if (onStation) return {ok: true, msg: `${f.name} is already fighting beside you.`, aid: null};
  if (strainOf(state, factionId) >= ALLY_STRAIN_LIMIT) {
    return {ok: true, msg: `${f.name} will not risk their other alliances again.`, aid: null};
  }
  state.strain = {...(state.strain ?? {}), [factionId]: strainOf(state, factionId) + 1};
  state.opinion[factionId] = clampOpinion(before + 5);
  return {ok: true, msg: `${f.name} joins the fight. Respect +5, but their other allies notice.`, aid: {id: factionId, ...AID}};
}

// Comms request: an ally at respect asks for aid against raiders in your system. Same rules as a conflict request.
export function requestAid(state, factionId, raidersPresent, onStation = false) {
  if (!raidersPresent) return {ok: false, msg: "No raiders in your system to fight.", aid: null};
  if (opinionOf(state, factionId) < ALLY_RESPECT) return {ok: false, msg: `They will only fight beside you at respect ${ALLY_RESPECT}.`, aid: null};
  return applyAllyChoice(state, factionId, "help", onStation);
}

// Sends an aid wave home from comms. Costs nothing and keeps respect.
export function sendAidHome(state, factionId) {
  const f = factionById(factionId);
  return {ok: true, msg: `${f ? f.name : "The ally"} withdraws to their own space.`};
}
