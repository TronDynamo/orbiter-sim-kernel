import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tick, newState, RULES } from '../src/game/rules.js';

const burn = RULES.LIFE_FUEL + RULES.TETHER_FUEL;

test('parked: no fuel is burned while the Ark and fleet hold still', () => {
  const s = newState();
  const before = s.fuel;
  for (let i = 0; i < 5; i++) tick(s, {});
  assert.equal(s.fuel, before, 'parked, no tethers: fuel unchanged');
});

test('Ark under way: fuel drains each tick', () => {
  const s = newState();
  s.ark = {x: 0, y: 0, dest: {x: 100, y: 0}};
  const before = s.fuel;
  tick(s, {});
  assert.ok(Math.abs(before - s.fuel - RULES.LIFE_FUEL) < 1e-9);
});

test('ship in transit: fuel drains each tick', () => {
  const s = newState();
  s.fleet = [{id: 1, type: 'freighter', mode: 'transit', thrust: 1}];
  const before = s.fuel;
  tick(s, {});
  assert.ok(Math.abs(before - s.fuel - RULES.LIFE_FUEL) < 1e-9);
  assert.ok(burn > 0);
});
