import test from "node:test";
import assert from "node:assert/strict";
import {arkOrbitSlot} from "../src/game/rules.js";
import {stepFleet, shipPosition} from "../src/game/fleet.js";

test("new hulls take distinct orbit radii around the Ark", () => {
  const fleet = [];
  for (let i = 0; i < 4; i++) {
    const slot = arkOrbitSlot(fleet, null);
    fleet.push({id: i, type: "corvette", mode: "orbit", planet: "ark", orbitR: slot.r, ang: slot.ang, hp: 10});
  }
  const radii = fleet.map((f) => f.orbitR);
  assert.equal(new Set(radii).size, 4);
});

test("orbiting the Ark costs no propellant and repairs and refuels the ship", () => {
  const s = {fleet: [{id: 1, type: "corvette", mode: "orbit", planet: "ark", orbitR: 60, ang: 0, hp: 5}], propellant: 10, ark: {x: 0, y: 0, dest: null}};
  const P = {ark: {x: 0, y: 0}};
  const before = s.propellant;
  for (let i = 0; i < 100; i++) stepFleet(s, P, 1, {conduits: [], velocity: {}});
  assert.ok(s.propellant > before, "tanks refuel at the Ark");
  assert.ok(s.fleet[0].hp > 5, "hull repairs at the Ark");
  const p = shipPosition(s.fleet[0], P);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 60) < 1e-6, "keeps its own radius");
});
