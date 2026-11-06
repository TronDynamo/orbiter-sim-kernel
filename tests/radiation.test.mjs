// Radiation: only a nova raises it, and only the Ark inside the blast zone takes it. Ships never do.
import {test} from "node:test";
import assert from "node:assert/strict";
import {arkRadiation} from "../src/game/fleet.js";
import {newState, tick, NOVA_RADIUS} from "../src/game/rules.js";

test("no nova: no radiation anywhere, even right next to the star", () => {
  const s = {ark: {x: 0, y: 0, dest: null}};
  assert.equal(arkRadiation(s, false), 0);
});

test("after a nova: severe inside the blast zone, none outside it", () => {
  assert.equal(arkRadiation({ark: {x: 10, y: 0, dest: null}}, true), 4);
  assert.equal(arkRadiation({ark: {x: NOVA_RADIUS + 50, y: 0, dest: null}}, true), 0);
});

test("the year clock alone never raises radiation", () => {
  const s = newState();
  s.ark = {x: 0, y: 0, dest: null};
  s.lastTick = 40 * 10;   // ten years in
  s.novaFired = false;
  tick(s, {});
  assert.equal(s.radiation, 0);
});

test("after a nova, the Ark in the blast zone takes radiation and the Ark outside does not", () => {
  const near = newState(); near.ark = {x: 0, y: 0, dest: null}; near.novaFired = true; near.lastTick = 0;
  tick(near, {});
  assert.equal(near.radiation, 4);
  const far = newState(); far.ark = {x: NOVA_RADIUS + 50, y: 0, dest: null}; far.novaFired = true; far.lastTick = 0;
  tick(far, {});
  assert.equal(far.radiation, 0);
});
