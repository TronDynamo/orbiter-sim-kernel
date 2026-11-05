// Procedural sector generator: determinism, seed handling, orbit validity and biome coverage.
import {test} from "node:test";
import assert from "node:assert/strict";
import {generateSector, normalizeSeed, validateSector, visibleBody, BIOMES, STAR_CLASSES} from "../src/game/galaxyGenerator.js";

test("the same seed always yields the same system", () => {
  assert.deepEqual(generateSector("#SECTOR-892"), generateSector("SECTOR-892"));
  assert.notDeepEqual(generateSector("SECTOR-892").planets, generateSector("SECTOR-893").planets);
});

test("seeds normalise and keywords choose the star class", () => {
  assert.equal(normalizeSeed(" #sector-892-pulsar "), "SECTOR-892-PULSAR");
  assert.equal(generateSector("#SECTOR-892-PULSAR").star.key, "NS");
  assert.equal(generateSector("#SECTOR-VOID").star.key, "NN");
  const sol = generateSector("#SECTOR-001");
  assert.equal(sol.star.key, "G");
  assert.equal(sol.name, "Sol-Analytics");
});

test("500 random seeds produce valid, non-overlapping systems", () => {
  for (let i = 0; i < 500; i++) {
    const sector = generateSector(`#SECTOR-${i}-X${i * 7}`);
    assert.deepEqual(validateSector(sector), [], `seed ${sector.seed}`);
    assert.ok(sector.planets.length >= 3 && sector.planets.length <= 6);
  }
});

test("every star class appears across seeds and every biome is reachable", () => {
  const stars = new Set(), biomes = new Set();
  for (let i = 0; i < 2000; i++) {
    const sector = generateSector(`SEED-${i}`);
    stars.add(sector.star.key);
    for (const p of sector.planets) biomes.add(p.biome);
  }
  assert.deepEqual([...stars].sort(), Object.keys(STAR_CLASSES).sort());
  assert.equal(biomes.size, BIOMES.length);
});

test("unscanned worlds hide their biome and multiplier", () => {
  const p = generateSector("SECTOR-001").planets[0];
  assert.equal(visibleBody(p).scanned, false);
  assert.equal(visibleBody(p).biome, undefined);
  p.scanned = true;
  assert.equal(visibleBody(p).biome, p.biome);
});
