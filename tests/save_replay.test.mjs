// Save/load by replay: a kernel state saved mid-game and replayed into a fresh kernel must match exactly.
// Needs the wasm build (npm run build:wasm) and the game's kernel wrapper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const modPath = new URL('../build/wasm/orbiter_kernel.mjs', import.meta.url);
const wrapperPath = new URL('../src/game/kernel/orbiterKernel.js', import.meta.url);
const hasBuild = existsSync(modPath);

async function freshKernel() {
  const { default: create } = await import(modPath.href);
  const { OrbiterKernel } = await import(wrapperPath.href);
  return new OrbiterKernel(await create());
}

const snapshot = (k) => ({
  tick: k.tickCount,
  x: Array.from(k.planets.x.subarray(0, k.planetCount)),
  y: Array.from(k.planets.y.subarray(0, k.planetCount)),
  status: Array.from(k.planets.status.subarray(0, k.planetCount)),
  credits: k.creditTotal,
  conduits: Array.from({ length: k.conduitCount }, (_, c) => [k.conduits.source[c], k.conduits.target[c], k.conduits.snapped[c], k.conduits.maxLength[c]]),
  missiles: k.missileCount,
});

test('save replays to the identical state, including a seeded start, conduits, tech and a strike', { skip: !hasBuild && 'run build:wasm first' }, async () => {
  const a = await freshKernel();
  a.beginAt(1234);                          // a seeded sector start
  assert.ok(a.addConduit(0, 1) >= 0);       // Thalassa-Aeros
  assert.ok(a.addConduit(1, 2) >= 0);       // Aeros-Ferrum
  a.tick(900);
  a.setConduitMaxLength(0, 500);            // High-Tensile Beams perk
  a.tick(1500);
  a.launch(0, 0, 0, 1);                     // an ICBM toward Aeros from the star's centre, just to exercise the log
  a.tick(700);
  a.removeConduit(1);
  a.tick(600);
  const save = JSON.parse(JSON.stringify(a.exportState()));  // a save survives JSON round-trip
  const want = snapshot(a);

  const b = await freshKernel();
  const res = b.importState(save);
  assert.equal(res.ok, true, `planet drift ${res.drift}`);
  const got = snapshot(b);
  assert.deepEqual(got, want);
  assert.equal(b.log.length, save.log.length);
});

test('importState rejects a save whose log is out of order', { skip: !hasBuild && 'run build:wasm first' }, async () => {
  const k = await freshKernel();
  assert.throws(() => k.importState({ startOffset: 0, tick: 10, log: [{ t: 5, op: 'add', source: 0, target: 1 }, { t: 2, op: 'add', source: 1, target: 2 }], planetX: [], planetY: [] }), /out of order/);
});
