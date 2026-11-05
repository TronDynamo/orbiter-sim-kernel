// Flight roles: probe survey, freighter siphon and delivery, tender relay drop.
import {test} from "node:test";
import assert from "node:assert/strict";
import {stepFleet, sendShip, deploySatellite, SURVEY_TICKS, CARGO_CAP} from "../src/game/fleet.js";
import {newState} from "../src/game/rules.js";

const P = {thalassa: {x: 300, y: 0}, aeros: {x: 0, y: 330}, ferrum: {x: -180, y: 0}, kryos: {x: 0, y: -400}, sun: {x: 0, y: 0}};
const noConduits = {conduits: [], velocity: {}};

test("probe charts an uncharted world after a 5 s scan", () => {
  const s = newState();
  const f = {id: 1, type: 'probe', mode: 'orbit', planet: 'ferrum', ang: 0};
  s.fleet.push(f);
  assert.equal(sendShip(s, f, 'thalassa', P, [], 'Thalassa').ok, true);
  for (let i = 0; i < 2000 && f.mode !== 'survey'; i++) stepFleet(s, P, 1, noConduits);
  assert.equal(f.mode, 'survey', 'probe should reach orbit and begin scanning');
  const msgs = [];
  for (let i = 0; i < SURVEY_TICKS + 2; i++) msgs.push(...stepFleet(s, P, 1, noConduits));
  assert.equal(s.surveyed.thalassa, true);
  assert.ok(msgs.some((m) => m.includes('charted')));
});

test("freighter refuses an uncharted world, then siphons and delivers to Ferrum", () => {
  const s = newState();
  const f = {id: 2, type: 'freighter', mode: 'orbit', planet: 'ferrum', ang: 0};
  s.fleet.push(f);
  assert.equal(sendShip(s, f, 'aeros', P, [], 'Aeros').ok, false, 'uncharted refused');
  s.surveyed.aeros = true;
  assert.equal(sendShip(s, f, 'aeros', P, [], 'Aeros').ok, true);
  for (let i = 0; i < 3000 && f.mode !== 'siphon'; i++) stepFleet(s, P, 1, noConduits);
  assert.equal(f.mode, 'siphon');
  for (let i = 0; i < 1000 && f.mode === 'siphon'; i++) stepFleet(s, P, 1, noConduits);
  assert.equal(f.cargo, CARGO_CAP);
  assert.equal(f.res, 'cryo');
  assert.equal(sendShip(s, f, 'ferrum', P, [], 'Ferrum').ok, true);
  const before = s.cryo ?? 0;
  for (let i = 0; i < 4000 && f.cargo > 0; i++) stepFleet(s, P, 1, noConduits);
  assert.equal(f.cargo, 0, 'cargo delivered');
  assert.equal(s.cryo, before + CARGO_CAP, 'stockpile credited with the hold');
});

test("tender drops three relays, then refuses", () => {
  const s = newState();
  const f = {id: 3, type: 'tender', mode: 'orbit', planet: 'ferrum', ang: 0};
  s.fleet.push(f);
  const before = s.relays.length;
  for (let i = 0; i < 3; i++) assert.equal(deploySatellite(s, f, P).ok, true);
  assert.equal(s.relays.length, before + 3);
  assert.equal(deploySatellite(s, f, P).ok, false);
});
