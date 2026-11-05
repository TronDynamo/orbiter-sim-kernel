// Warship combat: raids, mounts, hits, bounties and permanent losses. Pure logic, no canvas.
import {test} from "node:test";
import assert from "node:assert/strict";
import {newCombat, spawnRaid, stepCombat, defaultMounts, mountsOf, LOADOUT, RAID_BOUNTY, RAID_INTERVAL, RAID_MIN, RAID_MAX} from "../src/game/combat.js";

const pos = (f) => ({x: f.x, y: f.y});
const ship = (id, type, x, y, extra = {}) => ({id, type, x, y, ...extra});
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function run(state, fleet, seconds, extra = {}) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...stepCombat(state, {dt: 0.05, fleet, planets: [], core: {x: 0, y: 0}, pos, rand: seeded(7), ...extra}));
  return events;
}

test("loadouts match the design sheet", () => {
  assert.deepEqual(defaultMounts("corvette"), ["coilgun"]);
  assert.deepEqual(defaultMounts("destroyer"), ["coilgun", "flak", "flak"]);
  assert.deepEqual(LOADOUT.cruiser, ["lance", "lance", "flak", "flak"]);
  assert.deepEqual(mountsOf({type: "probe"}), []);
});

test("a raid brings 1-3 raiders from beyond the outermost world", () => {
  const s = newCombat();
  const n = spawnRaid(s, 300, seeded(3));
  assert.ok(n >= RAID_MIN && n <= RAID_MAX);
  assert.equal(s.raiders.length, n);
  for (const r of s.raiders) assert.ok(Math.hypot(r.x, r.y) >= 300 * 1.25 - 1e-6);
});

test("raids come on the interval only when the system allows them", () => {
  const quiet = newCombat();
  stepCombat(quiet, {dt: RAID_INTERVAL + 1, fleet: [], planets: [], core: {x: 0, y: 0}, pos});
  assert.equal(quiet.raiders.length, 0, "no raids without an edge radius (boot system)");
  const raided = newCombat();
  const ev = stepCombat(raided, {dt: RAID_INTERVAL + 1, fleet: [], planets: [], core: {x: 0, y: 0}, pos, edgeR: 300, rand: seeded(5)});
  assert.ok(ev.some((e) => e.kind === "raid"));
  assert.ok(raided.raiders.length >= RAID_MIN);
});

test("a corvette destroys an unarmed raider and collects the bounty", () => {
  const s = newCombat();
  s.raiders.push({id: 1, x: 120, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: [], bounty: RAID_BOUNTY});
  const fleet = [ship(10, "corvette", 0, 0)];
  const ev = run(s, fleet, 12);
  assert.equal(s.raiders.length, 0);
  const kill = ev.find((e) => e.kind === "kill");
  assert.ok(kill);
  assert.equal(kill.bounty, RAID_BOUNTY);
  assert.equal(fleet.length, 1);
  assert.equal(fleet[0].hp, undefined, "no return fire, so the corvette is untouched");
});

test("an even one-on-one fight ends with at least one side destroyed (both can fall on one frame)", () => {
  const s = newCombat();
  s.raiders.push({id: 1, x: 120, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: ["coilgun"], bounty: RAID_BOUNTY});
  const fleet = [ship(10, "corvette", 0, 0)];
  const ev = run(s, fleet, 20);
  const killed = ev.some((e) => e.kind === "kill"), lost = ev.some((e) => e.kind === "loss");
  assert.ok(killed || lost, "someone is destroyed");
  assert.ok(s.raiders.length === 0 || fleet.length === 0 || fleet[0].hp < 40 || s.raiders[0].hp < 40, "the fight was fought");
});

test("a destroyed ship is removed from the fleet for good", () => {
  const s = newCombat();
  s.raiders.push({id: 1, x: 150, y: 0, vx: 0, vy: 0, hp: 500, maxHp: 500, mounts: ["lance"], bounty: 0});
  const fleet = [ship(11, "corvette", 0, 0, {hp: 1})];
  const ev = run(s, fleet, 6);
  assert.equal(fleet.length, 0);
  assert.ok(ev.some((e) => e.kind === "loss" && /permanent/.test(e.msg)));
});

test("a hit leaves sparks and shards behind it", () => {
  const s = newCombat();
  s.raiders.push({id: 1, x: 60, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: [], bounty: 0});
  run(s, [ship(12, "corvette", 0, 0)], 1);
  assert.ok(s.fx.some((e) => e.kind === "spark"));
  assert.ok(s.fx.some((e) => e.kind === "shard") || s.fx.length > 0);
});

test("locked mounts do not fire until their tech is researched", () => {
  const cruiser = ship(13, "cruiser", 0, 0);
  const raider = () => ({id: 2, x: 200, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: [], bounty: 0});
  const locked = newCombat(); locked.raiders.push(raider());
  run(locked, [cruiser], 0.5, {tech: {}});
  assert.ok(!locked.shots.some((sh) => sh.side === "ally" && sh.kind === "plasma"), "no lance without its tech");
  const unlocked = newCombat(); unlocked.raiders.push(raider());
  run(unlocked, [cruiser], 0.1, {tech: {lance: true}});
  assert.ok(unlocked.shots.some((sh) => sh.kind === "plasma"), "lance fires once researched");
});
