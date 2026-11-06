import {test} from "node:test";
import assert from "node:assert/strict";
import {applyHomeLook, homeLook, SIZE_TIER} from "../src/game/homeLook.js";
import {LEADERS} from "../src/game/roster_data.js";
import {bootSystem} from "../src/game/currentSystem.js";

test("no commander leaves the system untouched", () => {
  const sys = bootSystem();
  assert.equal(applyHomeLook(sys, null), sys);
  assert.equal(applyHomeLook(sys, "nobody"), sys);
});

test("each of the 20 commanders gets a distinct sun colour", () => {
  assert.equal(LEADERS.length, 20);
  const suns = LEADERS.map((l) => homeLook(l.id).sun);
  assert.equal(new Set(suns).size, 20);
});

test("the look changes sun and planets but not the input system", () => {
  const sys = bootSystem();
  const before = JSON.stringify(sys);
  const out = applyHomeLook(sys, LEADERS[0].id);
  assert.equal(JSON.stringify(sys), before);
  assert.notDeepEqual(out.sun.base, sys.sun.base);
  assert.equal(out.planets.length, sys.planets.length);
  out.planets.forEach((p, i) => assert.equal(p.orbit, sys.planets[i].orbit));
  for (const p of out.planets) assert.ok([9, 11, 13].includes(p.r));
});

test("sizes come from the three tiers", () => {
  assert.deepEqual(Object.values(SIZE_TIER).sort((a, b) => a - b), [9, 11, 13]);
});

import {homeSystem} from "../src/game/currentSystem.js";
test("every home has 3 to 8 planets, the same every time, and they vary between commanders", () => {
  const counts = LEADERS.map((l) => homeSystem(l.id).planets.length);
  for (const n of counts) assert.ok(n >= 3 && n <= 8, `count ${n}`);
  assert.deepEqual(homeSystem(LEADERS[3].id).planets.map((p) => p.id), homeSystem(LEADERS[3].id).planets.map((p) => p.id));
  assert.ok(new Set(counts).size > 1);
});
test("a home system keeps its planets in order and at distinct orbits", () => {
  const sys = homeSystem(LEADERS[0].id);
  for (let i = 1; i < sys.planets.length; i++) assert.ok(sys.planets[i].orbit > sys.planets[i - 1].orbit);
});
