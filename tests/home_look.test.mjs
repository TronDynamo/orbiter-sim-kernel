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

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lab = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
test("each of the 20 commanders gets a distinct sun colour, clearly apart in perceived colour", () => {
  assert.equal(LEADERS.length, 20);
  const suns = LEADERS.map((l) => homeLook(l.id).sun);
  assert.equal(new Set(suns).size, 20);
  let min = Infinity;
  for (let i = 0; i < suns.length; i++) for (let j = i + 1; j < suns.length; j++) {
    const a = lab(suns[i]), b = lab(suns[j]);
    min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  assert.ok(min >= 30, `closest pair differs by only ${min.toFixed(1)}`);
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
