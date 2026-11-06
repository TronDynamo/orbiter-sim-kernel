// Every avatar must have the art the shipyard and the Ark draw: one PNG per shipyard hull and one Ark PNG.
// Runs with the rest of the suite, so a missing or broken file fails the push instead of vanishing from the shipyard.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {LEADERS} from "../src/game/roster_data.js";
import {SHIP_ORDER} from "../src/game/ships.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../public/assets");
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const isPng = (file) => {
  const b = fs.readFileSync(file);
  return b.length > 1000 && PNG_MAGIC.every((v, i) => b[i] === v);
};

test("shipyard has a sprite for every hull", () => {
  assert.ok(SHIP_ORDER.length >= 6, "shipyard lists its hulls");
  for (const leader of LEADERS) {
    const key = leader.id.split("_")[0];
    for (const hull of SHIP_ORDER) {
      const file = path.join(root, "ships", key, `${hull}.png`);
      assert.ok(fs.existsSync(file), `missing ${key}/${hull}.png`);
      assert.ok(isPng(file), `${key}/${hull}.png is not a real PNG`);
    }
  }
});

test("every avatar has Ark art", () => {
  for (const leader of LEADERS) {
    const key = leader.id.split("_")[0];
    const file = path.join(root, "ark", `${key}.png`);
    assert.ok(isPng(file), `missing or broken ark/${key}.png`);
  }
});
