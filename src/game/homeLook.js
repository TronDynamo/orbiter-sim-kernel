// Home galaxy look: each commander's home system keeps the same solar-system rendering, but gets its own
// sun colour, planet colours and planet sizes. A non-manual copy of the recolour logic in src/orbit/custom.js:
// no storage, no UI, applied once when a campaign starts. Returns a new system; the input is never mutated.
import {LEADERS} from "./roster_data.js";

// Planet size tiers, as drawn radii in screen px (the game's own world radii are 10–12).
export const SIZE_TIER = {small: 9, medium: 11, large: 13};
// Size pattern per home, from home_galaxy_asset_checklist.csv (rotated per commander so no two homes match).
const TIER_PATTERN = [
  ["large", "medium", "small", "small", "medium"],
  ["medium", "large", "small", "medium", "small"],
  ["small", "small", "large", "medium", "medium"],
  ["medium", "small", "medium", "large", "small"],
];

const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

// Index of a commander in the roster, or -1 when none is chosen.
export function commanderIndex(id) { return LEADERS.findIndex((l) => l.id === id); }

// The look for one commander: sun colour (rgb), planet colours and planet size tiers. Hues step by the golden
// angle so every home is distinct from the others.
export function homeLook(id) {
  const i = commanderIndex(id);
  if (i < 0) return null;
  const hue = (i * 137.508) % 360;
  const sunRgb = hsl(hue, 0.85, 0.55);
  const planets = [0, 1, 2, 3, 4, 5].map((k) => ({
    color: hex(hsl((hue + 40 + k * 61) % 360, 0.6, 0.6)),
    tier: TIER_PATTERN[i % TIER_PATTERN.length][k % 5],
  }));
  return {index: i, sunRgb, sun: hex(sunRgb), planets};
}

// Applies a commander's look to a system. Without a commander the system comes back untouched (same object).
export function applyHomeLook(system, id) {
  const look = homeLook(id);
  if (!look) return system;
  const rgb = look.sunRgb;
  const sun = {
    ...system.sun,
    base: rgb,
    patch: rgb.map((v) => Math.round(v + (255 - v) * 0.5)),
    glow: `rgba(${rgb.join(",")},`,
  };
  const planets = system.planets.map((p, k) => {
    const look_ = look.planets[k % look.planets.length];
    return {...p, color: look_.color, r: SIZE_TIER[look_.tier]};
  });
  return {...system, sun, planets};
}
