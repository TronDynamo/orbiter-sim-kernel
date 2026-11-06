import test from "node:test";
import assert from "node:assert/strict";
import {stepRetreat, stepFleet} from "../src/game/fleet.js";
import {hullMax} from "../src/game/ships.js";

test("a ship below 30% hull breaks off, follows the Ark and repairs once whole", () => {
  const s = {fleet: [{id: 1, type: "corvette", hp: 5, mode: "orbit", planet: "p", ang: 0, attack: 7}], propellant: 50, ark: {x: 500, y: 0, dest: null}};
  const P = {p: {x: 0, y: 0}, ark: {x: 500, y: 0}};
  const r = stepRetreat(s, P, 1);
  assert.deepEqual(r.started, [1]);
  const f = s.fleet[0];
  assert.equal(f.attack, null, "attack order dropped");
  assert.equal(f.mode, "transit");
  assert.deepEqual(f.dest, {x: 500, y: 0});
  assert.equal(f.hp, 5, "no repair while far from the Ark");
  f.x = 480; f.y = 0;
  for (let i = 0; i < 5000 && f.retreat; i++) { stepRetreat(s, P, 1); stepFleet(s, P, 1, {conduits: [], velocity: {}}); }
  assert.equal(f.planet, "ark", "settled into Ark orbit");
  assert.equal(f.retreat, false);
  assert.equal(f.hp, hullMax(f));
});
