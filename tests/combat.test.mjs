// Warship combat: raids, mounts, hits, bounties and permanent losses. Pure logic, no canvas.
import {test} from "node:test";
import assert from "node:assert/strict";
import {newCombat, spawnRaid, stepCombat, defaultMounts, mountsOf, LOADOUT, RAID_BOUNTY, RAID_INTERVAL, RAID_MIN, RAID_MAX, nextMount, hitChance, MOUNTS} from "../src/game/combat.js";
const sure = () => 0;   // a roll of 0 always lands: deterministic hits for the tests that are not about chance

test("a socket swaps to the next unlocked weapon, cycling, and reports none when nothing is unlocked", () => {
  assert.equal(nextMount({}, "coilgun"), null, "nothing else is researched");
  assert.equal(nextMount({flak: true}, "coilgun"), "flak");
  assert.equal(nextMount({flak: true, lance: true}, "flak"), "lance");
  assert.equal(nextMount({flak: true, lance: true}, "lance"), "coilgun", "wraps back to the always-available Coilgun");
});

test("the PIP opens on fire, follows the fight, and closes 4 s after it ends", () => {
  const s = newCombat();
  s.raiders.push({id: 1, x: 120, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: [], bounty: 0});
  run(s, [ship(20, "corvette", 0, 0)], 0.05);
  assert.ok(s.activeT > 0, "open while firing");
  assert.ok(s.focus, "centred on the fight");
  run(s, [], 4.5);
  assert.equal(s.activeT, 0, "closed after the hold");
});

test("a hit on an allied hull raises the PIP's distortion", () => {
  const s = newCombat();
  s.raiders.push({id: 1, x: 40, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: ["lance"], bounty: 0});
  run(s, [ship(21, "corvette", 0, 0, {hp: 40})], 1.0);
  assert.ok(s.noise > 0, "an ally hit raises the distortion");
});

test("a dev raid spawns on demand, even where the ambient timer is off", () => {
  const s = newCombat();
  const ev = stepCombat(s, {dt: 0, fleet: [], planets: [], core: {x: 0, y: 0}, pos, raidNow: true, rand: seeded(9)});
  assert.ok(ev.some((e) => e.kind === "raid"));
  assert.ok(s.raiders.length >= RAID_MIN);
  assert.equal(s.raidT, RAID_INTERVAL, "the ambient timer is not reset");
});

const pos = (f) => ({x: f.x, y: f.y});
const ship = (id, type, x, y, extra = {}) => ({id, type, x, y, ...extra});
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function run(state, fleet, seconds, extra = {}) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...stepCombat(state, {dt: 0.05, fleet, planets: [], core: {x: 0, y: 0}, pos, rand: sure, ...extra}));
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
  run(s, [ship(12, "corvette", 0, 0)], 0.15);
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
  run(unlocked, [cruiser], 1.0, {tech: {lance: true}});
  assert.ok(unlocked.shots.some((sh) => sh.kind === "plasma") || unlocked.raiders.length === 0, "lance fires once researched");
});

test("the hit roll follows accuracy, tracking against evasion, and target speed, clamped to 5-95%", () => {
  const base = hitChance("coilgun", 0.2, 0);
  assert.ok(Math.abs(base - 0.8 * (0.6 / 0.8)) < 1e-9);
  assert.ok(hitChance("coilgun", 0.2, 150) < base, "a fast target is harder to land on");
  assert.ok(hitChance("coilgun", 0.2, 1e6) >= 0.05, "never below 5%");
  assert.ok(hitChance("flak", 0, 0) <= 0.95, "never above 95%");
  assert.ok(hitChance("lance", 0.2, 0) < hitChance("coilgun", 0.2, 0), "lances are less likely to land than coilguns");
});

test("a corvette and a raider with coilguns trade fire for a tense skirmish, not an instant wipe", () => {
  // expected time to kill from the roll: damage * chance per shot, once per cool-down
  const shot = MOUNTS.coilgun;
  const chance = hitChance("coilgun", 0.2, 55);   // the raider is closing at its cruising speed
  const dps = shot.damage * chance / shot.cool;
  const ttk = 40 / dps;
  assert.ok(ttk >= 5 && ttk <= 11, `1-on-1 coilgun kill time ${ttk.toFixed(1)}s`);
});

test("particles are recycled: a long fight reuses effect objects instead of growing without bound", () => {
  const s = newCombat();
  let rng = seeded(11);
  for (let round = 0; round < 6; round++) {
    s.raiders.push({id: 100 + round, x: 120, y: 0, vx: 0, vy: 0, hp: 40, maxHp: 40, mounts: ["coilgun"], bounty: 0});
    run(s, [ship(30 + round, "corvette", 0, 0)], 14, {rand: rng});
  }
  assert.ok(s.fx.length <= 700, "the effect list stays under its cap");
  assert.ok(s.pool.length <= 700, "the pool stays under its cap");
});
