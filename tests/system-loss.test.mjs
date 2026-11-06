// A destroyed system is posted to the Senate channel: every leader except the commander reacts, in their own tone.
import {test} from "node:test";
import assert from "node:assert/strict";
import {systemLost, LOSS_TONES} from "../src/game/comms.js";
import {FACTIONS} from "../src/game/factions.js";

const fresh = (commander = "fenris_15") => ({commander, opinion: {}, comms: {selected: null, log: []}});

test("every leader but the commander reacts, once each", () => {
  const s = fresh();
  systemLost(s, {name: "Sol", cause: "player"});
  const posted = s.comms.log.filter((m) => m.news);
  assert.equal(posted.length, FACTIONS.length - 1);
  assert.ok(!posted.some((m) => m.faction === "fenris_15"));
  assert.deepEqual(s.news, [{name: "Sol", cause: "player"}]);
});

test("a player-caused loss names the commander; a leader who dislikes the commander is frustrated", () => {
  const s = fresh();
  s.opinion.leon_11 = -60;
  systemLost(s, {name: "Sol", cause: "player"});
  const leon = s.comms.log.find((m) => m.news && m.faction === "leon_11");
  assert.equal(leon.tone, "frustration");
  assert.match(leon.text, /Sol/);
  assert.ok(s.comms.log.filter((m) => m.news).every((m) => LOSS_TONES.includes(m.tone)));
});

test("the same leader answers the same way about the same system", () => {
  const a = fresh(), b = fresh();
  systemLost(a, {name: "Uncharted system X", cause: "enemy"});
  systemLost(b, {name: "Uncharted system X", cause: "enemy"});
  assert.deepEqual(a.comms.log.map((m) => m.text), b.comms.log.map((m) => m.text));
});
