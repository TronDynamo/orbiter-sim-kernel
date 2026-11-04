// Checks that every WorldStatus in the kernel has a sprite entry in config/planets.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORLD_SPRITES } from '../config/planets.js';

test('every WorldStatus has a sprite entry', () => {
  const header = readFileSync(new URL('../src/orbiter_kernel.hpp', import.meta.url), 'utf8');
  const block = header.match(/enum class WorldStatus[^{]*\{([^}]*)\}/);
  assert.ok(block, 'WorldStatus enum not found');
  const names = [...block[1].matchAll(/([A-Z_]+)\s*=/g)].map((m) => m[1]);
  assert.ok(names.length > 0, 'no WorldStatus entries parsed');
  assert.deepEqual(Object.keys(WORLD_SPRITES).sort(), names.sort());
});
