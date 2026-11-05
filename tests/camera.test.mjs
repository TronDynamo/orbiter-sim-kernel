// Camera smoothing and zoom limits. easeToward must be frame-rate independent so the glide looks the same at 30 and 144 FPS.
import {test} from "node:test";
import assert from "node:assert/strict";
import {easeToward, ZOOM_MIN, ZOOM_MAX, ZOOM_DETAIL, ZOOM_FOLLOW, ZOOM_FOCUS} from "../src/orbit/scene.js";

test("easeToward closes the same fraction of the gap in the same time at any frame rate", () => {
  const rate = 6;
  const after = (fps, seconds) => {
    let v = 0;
    for (let i = 0; i < Math.round(fps * seconds); i++) v = easeToward(v, 1, 1 / fps, rate);
    return v;
  };
  assert.ok(Math.abs(after(30, 1) - after(144, 1)) < 1e-9);
  assert.ok(Math.abs(after(60, 1) - (1 - Math.exp(-rate))) < 1e-9);
});

test("easeToward never overshoots its target", () => {
  let v = 0;
  for (let i = 0; i < 2000; i++) { v = easeToward(v, 1, 0.05, 7); assert.ok(v <= 1); }
  assert.ok(v > 0.999);
});

test("zoom band and LOD thresholds are ordered as the directive asks", () => {
  assert.equal(ZOOM_MIN, 0.3);
  assert.equal(ZOOM_MAX, 4.5);
  assert.equal(ZOOM_DETAIL, 1.8);
  assert.equal(ZOOM_FOLLOW, 2.0);
  assert.equal(ZOOM_FOCUS, 3.5);
  assert.ok(ZOOM_MIN < ZOOM_DETAIL && ZOOM_DETAIL < ZOOM_FOLLOW && ZOOM_FOLLOW < ZOOM_FOCUS && ZOOM_FOCUS < ZOOM_MAX);
});
