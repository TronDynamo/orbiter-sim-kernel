// Ship lead: auto steers at a moving world's arrival point, manual flies to where the world is now.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendShip, shipPosition} from '../src/game/fleet.js';

const P = {ferrum: {x: 0, y: 0}, aeros: {x: 300, y: 0}, thalassa: {x: -300, y: 0}, core: {x: 0, y: 0}};
const fresh = () => ({s: {propellant: 999, fleet: []}, f: {id: 1, type: 'destroyer', mode: 'orbit', planet: 'ferrum', ang: 0, heading: 0, thrust: 0, hp: 100}});

test('auto lead (default) sends the ship to the world as a moving target', () => {
  const {s, f} = fresh();
  const r = sendShip(s, f, 'aeros', P, [], 'Aeros');
  assert.equal(r.ok, true);
  assert.equal(f.mode, 'transit');
  assert.equal(f.to, 'aeros');
  assert.equal(f.dest, undefined);
});

test('manual lead flies to where the world is now and holds there', () => {
  const {s, f} = fresh();
  const r = sendShip(s, f, 'aeros', P, [], 'Aeros', 'manual');
  assert.equal(r.ok, true);
  assert.match(r.msg, /manual lead/);
  assert.equal(f.mode, 'transit');
  assert.equal(f.to, null);
  assert.deepEqual(f.dest, {x: 300, y: 0});
});

test('manual lead does not apply to depots, which still dock', () => {
  const {s, f} = fresh();
  const P2 = {...P, depot1: {x: 100, y: 100}};
  sendShip(s, f, 'depot1', P2, [], 'the fuel depot', 'manual');
  assert.equal(f.to, 'depot1');
});
