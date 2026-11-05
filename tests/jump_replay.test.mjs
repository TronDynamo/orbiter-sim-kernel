// A save that includes a Jump Gate transit replays with zero planet drift.
// Needs the wasm build (npm run build:wasm).
import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";

const modPath = new URL("../build/wasm/orbiter_kernel.mjs", import.meta.url);
const wrapperPath = new URL("../src/game/kernel/orbiterKernel.js", import.meta.url);
const systemPath = new URL("../src/game/currentSystem.js", import.meta.url);
const sectorPath = new URL("../src/game/sectorGenerator.js", import.meta.url);
const hasBuild = existsSync(modPath);

async function freshKernel() {
  const {default: create} = await import(modPath.href);
  const {OrbiterKernel} = await import(wrapperPath.href);
  return new OrbiterKernel(await create());
}

// Plays a session: start, run, jump into a sector mid-run, keep running, then save.
async function playJumpSession(code, {before = 300, after = 600} = {}) {
  const {sectorFromCode} = await import(sectorPath.href);
  const {kernelSystemFromSector} = await import(systemPath.href);
  const k = await freshKernel();
  k.beginAt(0);
  k.tick(before);
  const sector = sectorFromCode(code);
  const rc = k.loadSystem(kernelSystemFromSector(sector));
  assert.ok(rc >= 0, `loadSystem refused ${code}`);
  k.tick(after);
  return {kernel: k, count: sector.planets.length};
}

for (const code of ["SECTOR-082-PULSAR", "SECTOR-114-VOID", "SECTOR-909-BLACKHOLE"]) {
  test(`jump save to ${code} replays with zero drift`, {skip: !hasBuild && "run build:wasm first"}, async () => {
    const {kernel: a, count} = await playJumpSession(code);
    const save = JSON.parse(JSON.stringify(a.exportState()));  // survives the JSON round-trip the save file uses
    const b = await freshKernel();
    const res = b.importState(save);
    assert.equal(res.ok, true, `planet drift ${res.drift}`);
    assert.ok(res.drift < 1e-9, `drift ${res.drift}`);
    assert.equal(b.planetCount, count, "replay restores the arriving system's worlds");
    assert.equal(b.tickCount, a.tickCount);
  });
}

test("arriving worlds are uncharted and pay nothing until surveyed", {skip: !hasBuild && "run build:wasm first"}, async () => {
  const {kernel: k, count} = await playJumpSession("SECTOR-114-VOID", {after: 1200});
  for (let i = 0; i < count; i++) {
    assert.equal(k.isCharted(i), false, `world ${i} should start uncharted`);
    assert.equal(k.planets.gainTotal[i], 0, `world ${i} should pay nothing before a survey`);
  }
});
