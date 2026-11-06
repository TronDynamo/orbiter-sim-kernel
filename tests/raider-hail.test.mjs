import test from "node:test";
import assert from "node:assert/strict";
import {applyRaiderChoice, payoffCost, ALLY_RESPECT} from "../src/game/comms.js";

const fresh = (over = {}) => ({credits: 500, opinion: {}, ...over});

test("paying off costs credits, makes the wave leave, and raises respect", () => {
  const s = fresh();
  const r = applyRaiderChoice(s, "payoff", {n: 2, armed: 0});
  assert.equal(r.ok, true); assert.equal(r.depart, true);
  assert.equal(s.credits, 500 - payoffCost(2));
  assert.ok(s.opinion.raiders > 0);
});

test("paying off fails without enough credits and changes nothing", () => {
  const s = fresh({credits: 10});
  const r = applyRaiderChoice(s, "payoff", {n: 3, armed: 0});
  assert.equal(r.ok, false);
  assert.equal(s.credits, 10);
  assert.equal(s.opinion.raiders, undefined);
});

test("engaging keeps the wave fighting and lowers respect", () => {
  const s = fresh();
  const r = applyRaiderChoice(s, "fight", {n: 2, armed: 0});
  assert.equal(r.depart, false);
  assert.equal(s.opinion.raiders, -5);
});

test("intimidation works only with a fleet at least as large as the wave", () => {
  const strong = fresh(), weak = fresh();
  assert.equal(applyRaiderChoice(strong, "intimidate", {n: 2, armed: 2}).depart, true);
  assert.equal(applyRaiderChoice(weak, "intimidate", {n: 2, armed: 1}).depart, false);
});

test("alliance needs enough respect first", () => {
  const cold = fresh(), warm = fresh({opinion: {raiders: ALLY_RESPECT}});
  assert.equal(applyRaiderChoice(cold, "ally", {n: 1, armed: 0}).ok, false);
  const r = applyRaiderChoice(warm, "ally", {n: 1, armed: 0});
  assert.equal(r.ok, true); assert.equal(r.depart, true);
});
