// Stellar Jump Gate: build cost, starchart gating, warp lifecycle, state preservation, anchor descriptors.
import {test} from "node:test";
import assert from "node:assert/strict";
import {JUMP_GATE_COST, JUMP_GATE_BEACON_ORBIT_RADIUS, WARP_DURATION, canAfford, openStarchart, initiateJump, advanceWarp, makeInitialState, surveyPlanet} from "../src/game/jumpGate.js";
import {anchorDescriptor, ANCHOR_TYPES} from "../src/game/anchors.js";

const rich = () => ({credits: 2400, alloys: 1200, compute: 600});

test("the portal costs 2400 credits, 1200 alloys, 600 compute and is refused when short", () => {
  assert.deepEqual(JUMP_GATE_COST, {credits: 2400, alloys: 1200, compute: 600});
  assert.equal(canAfford(rich()), true);
  assert.equal(canAfford({credits: 2399, alloys: 1200, compute: 600}), false);
});

test("starchart is closed until the gate is built, then lists the three sectors", () => {
  const g = makeInitialState();
  assert.equal(openStarchart(g).ok, false);
  g.built = true;
  const r = openStarchart(g);
  assert.equal(r.ok, true);
  assert.deepEqual(r.sectors.map((s) => s.id), ["SECTOR-082-PULSAR", "SECTOR-114-VOID", "SECTOR-305-HYPER"]);
  assert.equal(r.sectors[0].starType, "Pulsar");
  assert.equal(r.sectors[2].planetCount, 6);
  assert.ok(JUMP_GATE_BEACON_ORBIT_RADIUS > 0);
});

test("a jump runs the slipstream, then sets the new sector without touching fleet, research or treasury", () => {
  const fleet = [{id: 1, type: "corvette"}];
  const research = ["high-tensile"];
  const treasury = {credits: 10, alloys: 20, compute: 30};
  const g = makeInitialState({fleet, research, treasury, built: true});
  const dest = openStarchart(g).sectors[1];
  assert.equal(initiateJump(g, dest).ok, true);
  assert.equal(initiateJump(g, dest).reason, "warp_in_progress");
  advanceWarp(g, WARP_DURATION / 2);
  assert.equal(g.currentSector, null, "map does not change mid-warp");
  advanceWarp(g, WARP_DURATION);
  assert.equal(g.warp.active, false);
  assert.equal(g.currentSector.id, "SECTOR-114-VOID");
  assert.equal(g.fleet, fleet, "fleet reference kept");
  assert.equal(g.research, research, "research reference kept");
  assert.equal(g.treasury, treasury, "treasury reference kept");
});

test("worlds in a new sector start unsurveyed and only a probe reveals them", () => {
  const g = makeInitialState({built: true});
  initiateJump(g, openStarchart(g).sectors[0]);
  advanceWarp(g, WARP_DURATION);
  assert.ok(g.currentSector.planets.every((p) => p.surveyed === false && p.biome !== undefined));
  assert.equal(surveyPlanet(g, g.currentSector.planets[0].id).ok, true);
  assert.equal(surveyPlanet(g, g.currentSector.planets[0].id).reason, "already_surveyed");
});

test("anchor descriptors cover every type, with sol as the fallback", () => {
  for (const t of ANCHOR_TYPES) assert.equal(anchorDescriptor(t).type, t);
  assert.equal(anchorDescriptor("black_hole").hasAccretionDisk, true);
  assert.equal(anchorDescriptor("pulsar").hasBeams, true);
  assert.equal(anchorDescriptor("nonsense").type, "sol");
});
