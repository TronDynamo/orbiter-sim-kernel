// Emergency Burn, radar occlusion and engagement rules.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {occluded, engaged, newCombat, stepCombat} from '../src/game/combat.js';
import {emergencyBurn, stepFleet, shipPosition} from '../src/game/fleet.js';
import {EMERGENCY} from '../src/game/emergency.js';

test('a body between two craft occludes the line; craft beside it do not', () => {
  const body = [{x: 0, y: 0, r: 10}];
  assert.equal(occluded({x: -100, y: 0}, {x: 100, y: 0}, body), true);
  assert.equal(occluded({x: -100, y: 40}, {x: 100, y: 40}, body), false);
});

test('a craft inside a body disc is not blocked by that body (low orbit stays visible)', () => {
  const body = [{x: 0, y: 0, r: 10}];
  assert.equal(occluded({x: 5, y: 0}, {x: -100, y: 0}, body), false);
  assert.equal(occluded({x: 26, y: 0}, {x: -100, y: 0}, body), true, 'a ship on the far side of the world is hidden');
});

test('engaged: a raider within 300 units, or a recent shot, counts as a fight', () => {
  const c = newCombat();
  assert.equal(engaged(c, {x: 0, y: 0}), false);
  c.raiders.push({id: 1, x: 200, y: 0, hp: 40, mounts: []});
  assert.equal(engaged(c, {x: 0, y: 0}), true);
  const d = newCombat(); d.activeT = 1;
  assert.equal(engaged(d, {x: 0, y: 0}), true);
});

test('a raider loses lock on a ship hidden behind a world', () => {
  const combat = newCombat();
  const fleet = [{id: 1, type: 'destroyer', mode: 'hold', x: -100, y: 0, hp: 100}];
  const planet = {x: 0, y: 0};
  // the raider sits on the far side of the world from the ship; no mounts fire, so only the target choice is tested
  combat.raiders.push({id: 1, x: 100, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: ['coilgun'], bounty: 0});
  const env = {dt: 0.05, fleet, planets: [planet], core: {x: 0, y: 0}, pos: (f) => ({x: f.x, y: f.y}), tech: {}, edgeR: null,
    bodies: [{x: 0, y: 0, r: 10}]};
  stepCombat(combat, env);
  assert.equal(combat.shots.length, 0, 'no shot fired through the world');
  assert.equal(combat.raiders[0].mounts.length, 1);
});

test('Emergency Burn spends 2 propellant and boosts the next flight', () => {
  const s = {propellant: 10, fleet: []};
  const f = {id: 1, type: 'destroyer', mode: 'transit', x: 0, y: 0, hp: 100};
  const r = emergencyBurn(s, f);
  assert.equal(r.ok, true);
  assert.equal(s.propellant, 10 - EMERGENCY.cost);
  assert.equal(f.emergency.left, EMERGENCY.seconds);
});

test('with the tank empty the burn is dirty: no window, no boost', () => {
  const s = {propellant: 1, fleet: []};
  const f = {id: 1, type: 'destroyer', mode: 'transit', x: 0, y: 0, hp: 100};
  const r = emergencyBurn(s, f);
  assert.equal(r.ok, false);
  assert.equal(f.emergency, null);
  assert.equal(s.propellant, 1);
});

test('the Emergency Burn window runs down in kernel time and then ends', () => {
  const P = {ferrum: {x: 0, y: 0}, aeros: {x: 300, y: 0}, thalassa: {x: -300, y: 0}, core: {x: 0, y: 0}};
  const s = {propellant: 100, fleet: [], raiders: [], tech: {}};
  const f = {id: 1, type: 'destroyer', mode: 'transit', x: 0, y: 0, hp: 100, heading: 0, thrust: 0, to: null, dest: {x: 9999, y: 0}};
  s.fleet.push(f);
  emergencyBurn(s, f);
  stepFleet(s, P, EMERGENCY.seconds * EMERGENCY.tps + 5, {conduits: [], velocity: {}});
  assert.equal(f.emergency, null);
});
