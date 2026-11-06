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

// Twenty sun colours, one per commander. Chosen so that no two are close in perceived colour (the smallest
// pairwise CIELAB difference is about 34; anything under about 20 reads as the same colour).
export const SUN_PALETTE = [
  "#df2020", "#06f906", "#0606f9", "#06c8f9", "#d6cc71", "#8e2984", "#06f9bc", "#f906f9", "#0680f9", "#e0f906",
  "#8e5229", "#40a117", "#f99806", "#f90680", "#298e75", "#1717a1", "#295c8e", "#d6718a", "#aa5ee8", "#4cfa78",
];
const toRgbArr = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

// The look for one commander: sun colour (rgb), planet colours and planet size tiers. Planet colours sit around the
// sun's hue so each home reads as one system.
export function homeLook(id) {
  const i = commanderIndex(id);
  if (i < 0) return null;
  const sunHex = SUN_PALETTE[i % SUN_PALETTE.length];
  const sunRgb = toRgbArr(sunHex);
  const hue = hueOf(sunRgb);
  const planets = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({
    color: hex(hsl((hue + 40 + k * 61) % 360, 0.6, 0.6)),
    tier: TIER_PATTERN[i % TIER_PATTERN.length][k % 5],
  }));
  return {index: i, sunRgb, sun: sunHex, planets};
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
