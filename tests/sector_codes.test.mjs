// Structured sector codes: the same name always gives the same star, hazards and planet count.
import {test} from "node:test";
import assert from "node:assert/strict";
import {sectorFromCode, parseSectorCode, GENERATOR_SEED, generateSectors} from "../src/game/sectorGenerator.js";

test("codes parse, and malformed codes are refused", () => {
  assert.deepEqual(parseSectorCode("sector-082-pulsar"), {code: "SECTOR-082-PULSAR", number: 82, word: "PULSAR"});
  assert.equal(parseSectorCode("b81e35e"), null);
  assert.equal(parseSectorCode("SECTOR-12"), null);
  assert.throws(() => sectorFromCode("nope"));
});

test("anchor words set the star and hazards; the number sets the planet count", () => {
  const black = sectorFromCode("SECTOR-909-BLACKHOLE");
  assert.equal(black.anchorType, "black_hole");
  assert.equal(black.starType, "Singularity");
  assert.equal(black.planetCount, 3 + (909 % 4));
  assert.equal(black.planets.length, black.planetCount);
  assert.equal(sectorFromCode("SECTOR-114-VOID").anchorType, "void");
  assert.equal(sectorFromCode("SECTOR-050").anchorType, "sol");
});

test("a code always derives the same sector", () => {
  assert.deepEqual(sectorFromCode("SECTOR-909-BLACKHOLE"), sectorFromCode("SECTOR-909-BLACKHOLE"));
});

test("the generator's default seed is a sector code, not a commit hash", () => {
  assert.equal(GENERATOR_SEED, "SECTOR-001");
  assert.deepEqual(generateSectors().map((s) => s.id), ["SECTOR-082-PULSAR", "SECTOR-114-VOID", "SECTOR-305-HYPER"]);
});
