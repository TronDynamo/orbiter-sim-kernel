// Rehydration: a generated system replaces the kernel's worlds, and a save that holds the swap replays exactly.
// Needs the wasm build (npm run build:wasm).
import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";

const modPath = new URL("../build/wasm/orbiter_kernel.mjs", import.meta.url);
const wrapperPath = new URL("../src/game/kernel/orbiterKernel.js", import.meta.url);
const galaxyPath = new URL("../src/game/galaxyGenerator.js", import.meta.url);
const hasBuild = existsSync(modPath);

async function freshKernel() {
  const {default: create} = await import(modPath.href);
  const {OrbiterKernel} = await import(wrapperPath.href);
  return new OrbiterKernel(await create());
}

// Turns a generated sector into the kernel's system form.
async function kernelSystem(seed) {
  const {generateSector} = await import(galaxyPath.href);
  const {STAR_TYPE} = await import(wrapperPath.href);
  const map = {G: STAR_TYPE.SOL, O: STAR_TYPE.BLUE_HYPERGIANT, M: STAR_TYPE.RED_GIANT, D: STAR_TYPE.WHITE_DWARF,
    NS: STAR_TYPE.PULSAR, BH: STAR_TYPE.BLACK_HOLE, BB: STAR_TYPE.SOL, NN: STAR_TYPE.VOID};
  const sector = generateSector(seed);
  return {
    starType: map[sector.star.key],
    starRadius: sector.star.radius,
    planets: sector.planets.map((p) => ({orbitRadius: p.orbit, angle: p.angle, speed: p.speed,
      radius: p.r, population: 1e6, yieldRate: p.multiplier})),
  };
}

test("a loaded system replaces the worlds, clears tethers and starts uncharted", {skip: !hasBuild}, async () => {
  const k = await freshKernel();
  k.addConduit(0, 1);
  const sys = await kernelSystem("#SECTOR-909-BLACKHOLE");
  assert.equal(k.loadSystem(sys), 0);
  assert.equal(k.planetCount, sys.planets.length);
  assert.equal(k.conduitCount, 0, "old tethers cleared");
  for (let i = 0; i < k.planetCount; i++) assert.equal(k.isCharted(i), false, `world ${i} uncharted`);
  k.tick(600);
  assert.ok(Array.from(k.planets.gainTotal.subarray(0, k.planetCount)).every((g) => g === 0), "no harvest while uncharted");
  assert.equal(k.surveyPlanet(0), 0);
  assert.equal(k.isCharted(0), true);
  assert.equal(k.surveyPlanet(0), -1, "charting twice is refused");
});

test("a save that contains the swap and a survey replays with zero drift", {skip: !hasBuild}, async () => {
  const k = await freshKernel();
  k.tick(300);
  k.loadSystem(await kernelSystem("SECTOR-082-PULSAR"));
  k.tick(200);
  k.surveyPlanet(1);
  k.tick(500);
  const save = JSON.parse(JSON.stringify(k.exportState()));
  const fresh = await freshKernel();
  const res = fresh.importState(save);
  assert.equal(res.ok, true, `drift ${res.drift}`);
  assert.equal(fresh.planetCount, k.planetCount);
  assert.equal(fresh.isCharted(1), true, "the survey is restored");
  assert.equal(fresh.isCharted(0), false, "uncharted worlds stay uncharted");
});

test("the home system still loads and replays unchanged", {skip: !hasBuild}, async () => {
  const k = await freshKernel();
  k.tick(100);
  const save = JSON.parse(JSON.stringify(k.exportState()));
  assert.equal((await freshKernel()).importState(save).ok, true);
  assert.equal(k.isCharted(0), true, "home worlds are charted");
});
