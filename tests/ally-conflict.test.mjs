import test from "node:test";
import assert from "node:assert/strict";
import {allyForConflict, applyAllyChoice, ALLY_STRAIN_LIMIT, opinionOf, ALLY_RESPECT, sendAidHome} from "../src/game/comms.js";
import {stepCombat, newCombat} from "../src/game/combat.js";
import {FACTIONS} from "../src/game/factions.js";

const base = () => ({opinion: Object.fromEntries(FACTIONS.map((f) => [f.id, 0])), strain: {}, commander: "nobody", comms: {log: [], selected: null}, credits: 0, compute: 0});
const ally = FACTIONS[0].id;

test("only a faction at ally respect, other than the commander, is asked", () => {
  const s = base();
  s.opinion[ally] = ALLY_RESPECT - 1;
  assert.equal(allyForConflict(s), null);
  s.opinion[ally] = ALLY_RESPECT;
  assert.equal(allyForConflict(s), ally);
  assert.notEqual(allyForConflict({...s, commander: ally}), ally);
  assert.notEqual(allyForConflict(s, new Set([ally])), ally);
});

test("asking for help puts an aid wave on station and raises alliance strain", () => {
  const s = base(); s.opinion[ally] = 30;
  const r = applyAllyChoice(s, ally, "help");
  assert.ok(r.aid && r.aid.id === ally);
  assert.equal(s.strain[ally], 1);
  assert.equal(opinionOf(s, ally), 35);
});

test("a faction past the strain limit refuses to help", () => {
  const s = base(); s.opinion[ally] = 30; s.strain[ally] = ALLY_STRAIN_LIMIT;
  const r = applyAllyChoice(s, ally, "help");
  assert.equal(r.aid, null);
  assert.equal(s.strain[ally], ALLY_STRAIN_LIMIT);
});

test("standing down raises respect and sends no aid", () => {
  const s = base(); s.opinion[ally] = 30;
  const r = applyAllyChoice(s, ally, "stand");
  assert.equal(r.aid, null);
  assert.equal(opinionOf(s, ally), 32);
  assert.equal(s.strain[ally] ?? 0, 0);
});

test("aid wave destroys raiders without paying a bounty", () => {
  const c = newCombat();
  c.raiders.push({id: 1, x: 300, y: 0, vx: 0, vy: 0, hp: 2, maxHp: 2, mounts: [], bounty: 50});
  c.aid = [{id: ally, n: 2, dps: 4, hull: 120}];
  let kills = [];
  for (let i = 0; i < 40 && c.raiders.length; i++) {
    const ev = stepCombat(c, {dt: 0.05, fleet: [], planets: [], core: {x: 0, y: 0}, pos: () => null, tech: {}, rand: () => 0.5, bodies: []});
    kills.push(...ev.filter((e) => e.kind === "kill"));
  }
  assert.equal(c.raiders.length, 0);
  assert.ok(kills.every((k) => k.bounty === 0));
});

test("a request is refused while the ally's wave is already on station", () => {
  const s = base(); s.opinion[ally] = 30;
  const r = applyAllyChoice(s, ally, "help", true);
  assert.equal(r.aid, null);
  assert.equal(s.strain[ally] ?? 0, 0);
});

test("an aid wave stays on station with no raiders until it is sent home or destroyed", () => {
  const c = newCombat();
  c.aid = [{id: ally, n: 2, dps: 4, hull: 120}];
  for (let i = 0; i < 2400; i++) stepCombat(c, {dt: 0.05, fleet: [], planets: [], core: {x: 0, y: 0}, pos: () => null, tech: {}, rand: () => 0.5, bodies: []});
  assert.equal(c.aid.length, 1, "still on station after 120 seconds");
});

test("raiders wear an aid wave's hull down until it is lost", () => {
  const c = newCombat();
  c.raiders.push({id: 1, x: 1e6, y: 0, vx: 0, vy: 0, hp: 1e9, maxHp: 1e9, mounts: [], bounty: 0});
  c.aid = [{id: ally, n: 2, dps: 4, hull: 120}];
  let lost = [];
  for (let i = 0; i < 4000 && c.aid.length; i++) {
    lost.push(...stepCombat(c, {dt: 0.05, fleet: [], planets: [], core: {x: 0, y: 0}, pos: () => null, tech: {}, rand: () => 0.5, bodies: []}).filter((e) => e.kind === "aidLost"));
  }
  assert.equal(c.aid.length, 0);
  assert.equal(lost.length, 1);
});

test("sending a wave home keeps respect", () => {
  const s = base(); s.opinion[ally] = 30;
  const r = sendAidHome(s, ally);
  assert.equal(r.ok, true);
  assert.equal(opinionOf(s, ally), 30);
});

test("allied waves keep formation spacing instead of stacking", () => {
  const c = newCombat();
  c.aid = [
    {id: ally, n: 2, dps: 4, hull: 120, phase: "station", station: {x: 0, y: 0}, x: 0, y: 0},
    {id: FACTIONS[1].id, n: 2, dps: 4, hull: 120, phase: "station", station: {x: 0, y: 0}, x: 0, y: 0},
  ];
  stepCombat(c, {dt: 0.05, fleet: [], planets: [], core: {x: 0, y: 0}, pos: () => null, tech: {}, rand: () => 0.5, bodies: []});
  const d = Math.hypot(c.aid[0].x - c.aid[1].x, c.aid[0].y - c.aid[1].y);
  assert.ok(d >= 40, `spacing ${d.toFixed(1)}`);
});

test("a convoy takes a wedge in front of the Ark toward the threat, and reforms when it is gone", () => {
  const c = newCombat();
  const ark = {x: 0, y: 0};
  c.aid = [0, 1, 2].map((slot) => ({id: FACTIONS[slot].id, n: 2, dps: 4, hull: 120, convoy: true, slot, x: 0, y: 0}));
  c.raiders.push({id: 99, x: 600, y: 0, vx: 0, vy: 0, hp: 1e9, maxHp: 1e9, mounts: [], bounty: 0});
  const env = {dt: 0.05, fleet: [], planets: [], core: {x: 0, y: 0}, pos: () => null, tech: {}, rand: () => 0.5, bodies: [], ark};
  for (let i = 0; i < 200; i++) stepCombat(c, env);
  for (const a of c.aid) assert.ok(a.x > 40, `fleet ${a.slot} in front of the Ark: x=${a.x.toFixed(1)}`);
  c.raiders.length = 0;
  for (let i = 0; i < 400; i++) stepCombat(c, env);
  for (const a of c.aid) {
    const r = Math.hypot(a.x - ark.x, a.y - ark.y);
    assert.ok(Math.abs(r - 80) < 12, `fleet ${a.slot} back in its ring: r=${r.toFixed(1)}`);
  }
});

test("a convoy fleet under fire from a close raider sidesteps, weaving across the line", () => {
  const c = newCombat();
  const ark = {x: 0, y: 0};
  c.aid = [{id: ally, n: 2, dps: 4, hull: 120, convoy: true, slot: 0, x: 0, y: 0}];
  c.raiders.push({id: 99, x: 150, y: 0, vx: 0, vy: 0, hp: 1e9, maxHp: 1e9, mounts: [], bounty: 0});
  const env = {dt: 0.05, fleet: [], planets: [], core: {x: 0, y: 0}, pos: () => null, tech: {}, rand: () => 0.5, bodies: [], ark};
  const ys = [];
  for (let i = 0; i < 120; i++) { stepCombat(c, env); ys.push(c.aid[0].y); }
  const span = Math.max(...ys.slice(60)) - Math.min(...ys.slice(60));
  assert.ok(span > 40, `weaving span ${span.toFixed(1)}`);
});
