// Loads the WebAssembly build and checks the exported state views.
// Build first with: EMSDK_DIR=/path/to/emsdk npm run build:wasm
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const modPath = new URL('../build/wasm/orbiter_kernel.mjs', import.meta.url);
const hasBuild = existsSync(modPath);

test('wasm kernel: launch, tick and read planet status through views', { skip: !hasBuild && 'run build:wasm first' }, async () => {
  const { default: createOrbiterKernel } = await import(modPath.href);
  const k = await createOrbiterKernel();
  k._orbiter_reset();
  assert.equal(k._orbiter_planet_count(), 4);

  k._orbiter_launch(0, 110, 0, 1); // ICBM at Aeros (index 1)
  for (let i = 0; i < 20000 && k.HEAPU8[k._orbiter_planet_status() + 1] === 0; ++i) k._orbiter_tick(1);

  const statusPtr = k._orbiter_planet_status();
  assert.equal(k.HEAPU8[statusPtr + 1], 1, 'Aeros is glassed (status 1)');

  const xPtr = k._orbiter_planet_x() / 8;
  const xs = k.HEAPF64.subarray(xPtr, xPtr + 4);
  assert.equal(xs.length, 4);
  assert.ok(Number.isFinite(xs[0]));

  assert.ok(k._orbiter_tick_count() > 0, 'ticks were simulated');
});
