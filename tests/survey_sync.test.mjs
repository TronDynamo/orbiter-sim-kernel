// A world surveyed in game state must also be charted in the kernel, or its output stays at zero.
// Needs the wasm build (npm run build:wasm).
import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";

const modPath = new URL("../build/wasm/orbiter_kernel.mjs", import.meta.url);
const wrapperPath = new URL("../src/game/kernel/orbiterKernel.js", import.meta.url);
const hasBuild = existsSync(modPath);

test("surveyPlanet charts a world once and refuses a second survey (safe to call every tick)", {skip: !hasBuild}, async () => {
  const {default: create} = await import(modPath.href);
  const {OrbiterKernel} = await import(wrapperPath.href);
  const k = new OrbiterKernel(await create());
  k.loadSystem({starType: 0, starRadius: 40, planets: [
    {orbitRadius: 150, angle: 0, speed: 0.01, radius: 10, population: 1e6, yieldRate: 10},
    {orbitRadius: 260, angle: 2, speed: 0.01, radius: 10, population: 1e6, yieldRate: 10},
  ]});
  assert.equal(k.surveyPlanet(0), 0, "first survey charts the world");
  assert.equal(k.surveyPlanet(0), -1, "a charted world is not charted again");
  assert.equal(k.surveyPlanet(1), 0, "the other world charts independently");
});
