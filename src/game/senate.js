// Galactic Senate: a session every SESSION_SECONDS of game time. Each session puts one motion to all 20 leaders.
// Blocs lean toward or against the motion; a leader's own opinion of the player can overrule that lean.
import {LEADERS, SENATE_BLOCS} from "./roster_data.js";
import {opinionOf} from "./comms.js";

export const SESSION_SECONDS = 300; // five minutes of game time

// stance: +1 for, -1 against, 0 no bloc lean. effect: applied for one session when the motion passes.
export const RESOLUTIONS = [
  {key: "ban", title: "Ban the Star-Killer Needle", text: "Outlaw Sol Core strikes until the next session.",
    stance: {HAWK: -1, PRESERVATION: 1, CARTEL: 0, FORGE: -1, CONCLAVE: 1}, effect: {starkillerBanned: true}},
  {key: "tariff", title: "Trade Tariff on Free-Ports", text: "Commercial Free-Ports earn half their credits until the next session.",
    stance: {HAWK: 0, PRESERVATION: -1, CARTEL: -1, FORGE: 1, CONCLAVE: 0}, effect: {freeportMult: 0.5}},
  {key: "subsidy", title: "Defense Subsidy", text: "Planetary Barrier Shields cost half price until the next session.",
    stance: {HAWK: 1, PRESERVATION: 0, CARTEL: -1, FORGE: 1, CONCLAVE: 0}, effect: {barrierMult: 0.5}},
  {key: "accord", title: "Research Accord", text: "Tech costs drop 20% until the next session.",
    stance: {HAWK: -1, PRESERVATION: 1, CARTEL: 0, FORGE: 0, CONCLAVE: 1}, effect: {researchMult: 0.8}},
];

// Runs session n: every leader votes, the motion passes on a majority, and a pass sets the effects.
export function runSession(state, n) {
  const r = RESOLUTIONS[n % RESOLUTIONS.length];
  const votes = LEADERS.map((l) => {
    const op = opinionOf(state, l.id), lean = r.stance[l.bloc] * 30;
    const score = lean + op * 0.5;
    const yes = score > 0;
    const reason = lean === 0 ? "no bloc lean; opinion decides"
      : (lean > 0) === yes ? `bloc ${yes ? "for" : "against"}` : `opinion (${op > 0 ? "+" : ""}${op}) overrules the bloc`;
    return {id: l.id, name: l.name, number: l.number, monogram: l.monogram, color: l.color, bloc: l.bloc, blocName: SENATE_BLOCS[l.bloc].name, yes, reason};
  });
  const yes = votes.filter((v) => v.yes).length, no = votes.length - yes;
  const passed = yes > votes.length / 2;
  if (passed) state.senate.effects = {...r.effect}; // a failed motion leaves the current effects in place
  return {n, resolution: r, votes, yes, no, passed};
}
