// Galactic Senate: each session puts one motion to a vote. The vote runs five minutes of game time, the commander
// votes on it, and then the final tally is made. Each session puts one motion to all 20 leaders.
// Blocs lean toward or against the motion; a leader's own opinion of the player can overrule that lean.
import {LEADERS, SENATE_BLOCS} from "./roster_data.js";
import {opinionOf} from "./comms.js";

export const SESSION_SECONDS = 300; // five minutes of game time between one decision and the next motion
export const VOTE_SECONDS = 300;    // the five-minute timer from motion to final vote

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

// Each leader's vote on the motion, from the bloc lean and their opinion of the player.
export function leaderVotes(state, r) {
  return LEADERS.map((l) => {
    const op = opinionOf(state, l.id), lean = r.stance[l.bloc] * 30;
    const score = lean + op * 0.5;
    const yes = score > 0;
    const reason = lean === 0 ? "no bloc lean; opinion decides"
      : (lean > 0) === yes ? `bloc ${yes ? "for" : "against"}` : `opinion (${op > 0 ? "+" : ""}${op}) overrules the bloc`;
    return {id: l.id, name: l.name, number: l.number, monogram: l.monogram, color: l.color, bloc: l.bloc, blocName: SENATE_BLOCS[l.bloc].name, yes, reason};
  });
}

// Puts session n's motion to the Senate. The vote stays open for VOTE_SECONDS of game time and the
// commander may vote on it until then. The leaders' votes are fixed now; the tally comes at the close.
export function openSession(state, n) {
  const r = RESOLUTIONS[n % RESOLUTIONS.length];
  return {n, resolution: r, leaders: leaderVotes(state, r), playerVote: null, closesAt: state.elapsed + VOTE_SECONDS};
}

// The final vote: 20 leaders plus the commander's own vote. Abstaining counts for neither side, and a
// motion passes only when yes votes beat no votes. A pass sets the effects until the next session.
export function closeSession(state, open) {
  const r = open.resolution;
  const leadYes = open.leaders.filter((v) => v.yes).length, leadNo = open.leaders.length - leadYes;
  const pv = open.playerVote;
  const yes = leadYes + (pv === "yes" ? 1 : 0), no = leadNo + (pv === "no" ? 1 : 0);
  const passed = yes > no;
  if (passed) state.senate.effects = {...r.effect}; // a failed motion leaves the current effects in place
  return {n: open.n, resolution: r, votes: open.leaders, playerVote: pv, yes, no, passed};
}
