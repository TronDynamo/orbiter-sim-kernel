import {test} from "node:test";
import assert from "node:assert/strict";
import {bootSystem, systemFromSector, planetIndex, planetIds, planetName, resourceFor, MIN_SYSTEM_PLANETS, MAX_SYSTEM_PLANETS} from "../src/game/currentSystem.js";
import {sectorFromCode} from "../src/game/sectorGenerator.js";
import {YIELD_CLASSES, BIOME_CLASS, kernelSystemFromSector} from "../src/game/currentSystem.js";

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

test("every sector biome maps to a yield class", () => {
  const biomes = ["Ocean World", "Methane Giant", "Rust Industrial", "Frozen Cryo-Sphere", "Volcanic", "Desert",
    "Jungle Biosphere", "Barren Rock", "Toxic", "Scorched", "Ice Drift", "Nebula Veil"];
  for (const b of biomes) assert.ok(BIOME_CLASS[b] in YIELD_CLASSES, `${b} has no yield class`);
});

test("generated worlds take their yield and resource from their biome", () => {
  const sector = sectorFromCode("SECTOR-114-VOID");
  const sys = systemFromSector(sector);
  const kernel = kernelSystemFromSector(sector, sys);
  sys.planets.forEach((p, i) => {
    const cls = YIELD_CLASSES[BIOME_CLASS[sector.planets[i].biome]];
    assert.equal(p.yield, cls.yield);
    assert.equal(p.resource, cls.resource);
    assert.equal(kernel.planets[i].yieldRate, cls.yield, "kernel harvest rate follows the biome");
  });
});

test("starter worlds keep their resource", () => {
  assert.equal(resourceFor(bootSystem(), 0), "biomass");
  assert.equal(resourceFor(bootSystem(), 3), "compute");
});
