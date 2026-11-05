import {test} from "node:test";
import assert from "node:assert/strict";
import {bootSystem, systemFromSector, planetIndex, planetIds, planetName, MIN_SYSTEM_PLANETS, MAX_SYSTEM_PLANETS} from "../src/game/currentSystem.js";
import {sectorFromCode} from "../src/game/sectorGenerator.js";

test("boot system is the four starter worlds", () => {
  const sys = bootSystem();
  assert.deepEqual(planetIds(sys), ["thalassa", "aeros", "ferrum", "kryos"]);
  assert.equal(planetIndex(sys, "ferrum"), 2);
  assert.equal(planetName(sys, "kryos"), "Kryos");
});

for (const code of ["SECTOR-082-PULSAR", "SECTOR-114-VOID", "SECTOR-909-BLACKHOLE"]) {
  test(`${code} becomes a dynamic system with 3-6 uniquely identified worlds`, () => {
    const sys = systemFromSector(sectorFromCode(code));
    assert.ok(sys.planets.length >= MIN_SYSTEM_PLANETS && sys.planets.length <= MAX_SYSTEM_PLANETS);
    const ids = planetIds(sys);
    assert.equal(new Set(ids).size, ids.length, "planet ids must be unique");
    for (const id of ids) assert.match(id, new RegExp(`^${code}-P\\d$`));
    sys.planets.forEach((p, i) => assert.equal(planetIndex(sys, p.id), i));
    assert.equal(planetIndex(sys, "thalassa"), -1, "starter ids are not present after a jump");
  });

  test(`${code} system is deterministic across builds`, () => {
    const a = JSON.stringify(systemFromSector(sectorFromCode(code)));
    const b = JSON.stringify(systemFromSector(sectorFromCode(code)));
    assert.equal(a, b);
  });
}

test("systemFromSector rejects a sector with no planets", () => {
  assert.throws(() => systemFromSector({id: "X", planets: []}));
});
