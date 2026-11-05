// Umbra geometry: a body shades only what is behind it, away from the star, and fades with distance.
import {test} from "node:test";
import assert from "node:assert/strict";
import {umbraStrength, shadowAt, debrisBeltAngles, UMBRA_LENGTH} from "../src/game/stellarFx.js";

const star = {x: 0, y: 0}, body = {x: 200, y: 0}, R = 10;

test("points directly behind the body are shaded, strongest on the axis", () => {
  const onAxis = umbraStrength({x: 230, y: 0}, star, body, R);
  const offAxis = umbraStrength({x: 230, y: 6}, star, body, R);
  assert.ok(onAxis > offAxis && offAxis > 0);
  assert.ok(onAxis <= 1);
});

test("points on the star's side of the body are never shaded", () => {
  assert.equal(umbraStrength({x: 150, y: 0}, star, body, R), 0);
  assert.equal(umbraStrength({x: 190, y: 0}, star, body, R), 0);
});

test("points beside the cone and beyond its length are lit", () => {
  assert.equal(umbraStrength({x: 230, y: 40}, star, body, R), 0);
  assert.equal(umbraStrength({x: 200 + UMBRA_LENGTH + 5, y: 0}, star, body, R), 0);
});

test("shadowAt takes the strongest of several bodies", () => {
  const far = {x: 0, y: 200, R};
  const q = {x: 230, y: 0};
  assert.equal(shadowAt(q, star, [far, {x: 200, y: 0, R}]), umbraStrength(q, star, {x: 200, y: 0}, R));
});

test("a belt's rocks spread evenly and inner rocks turn faster", () => {
  const a0 = debrisBeltAngles(32, 100, 0), a1 = debrisBeltAngles(32, 100, 1);
  assert.equal(a0.length, 32);
  const inner = debrisBeltAngles(4, 50, 1)[0] - debrisBeltAngles(4, 50, 0)[0];
  const outer = debrisBeltAngles(4, 300, 1)[0] - debrisBeltAngles(4, 300, 0)[0];
  assert.ok(inner > outer);
  assert.ok(a1.every((a, i) => a > a0[i]));
});
