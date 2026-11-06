// Ship lead: auto steers at a moving world's arrival point, manual flies to where the world is now.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendShip, stepFleet, shipPosition} from '../src/game/fleet.js';

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
  assert.match(r.msg, /to lead/);
  assert.equal(f.mode, 'transit');
  assert.equal(f.to, null);
  assert.deepEqual(f.dest, {x: 300, y: 0});
  assert.equal(f.leadTo, 'aeros');
});

test('manual lead does not apply to depots, which still dock', () => {
  const {s, f} = fresh();
  const P2 = {...P, depot1: {x: 100, y: 100}};
  sendShip(s, f, 'depot1', P2, [], 'the fuel depot', 'manual');
  assert.equal(f.to, 'depot1');
});

test('manual lead locks into orbit when its world is at the ship\'s arrival spot', () => {
  // Aeros rides a circular orbit around the core, as worlds do in the game
  const R = 255, W = 0.196 / 60, a0 = 2.0;
  const at = (t) => ({x: R * Math.cos(a0 + W * t), y: R * Math.sin(a0 + W * t)});
  const s = {propellant: 999, fleet: [], tethers: []};
  const f = {id: 1, type: 'destroyer', mode: 'orbit', planet: 'ferrum', ang: 0, heading: 0, thrust: 0, hp: 100};
  s.fleet.push(f);
  const base = {ferrum: {x: 0, y: 0}, core: {x: 0, y: 0}};
  let t = 0;
  const vel = () => ({aeros: {x: at(t + 1).x - at(t).x, y: at(t + 1).y - at(t).y}});
  const P0 = {...base, aeros: at(0)};
  sendShip(s, f, 'aeros', P0, [], 'Aeros', 'manual', vel());
  for (let k = 0; k < 6000 && f.mode !== 'orbit'; k++) {
    t++;
    const P = {...base, aeros: at(t)};
    stepFleet(s, P, 1, {conduits: [], velocity: vel()});
  }
  assert.equal(f.mode, 'orbit');
  assert.equal(f.planet, 'aeros');
});
