// Campaign setup: sector seeds, difficulty, and sector names. Difficulty multipliers are PLACEHOLDERS.
export const DIFFICULTIES = {
  cadet: {label: "Cadet", income: 1.25, blurb: "Generous income; a gentler Senate."},
  commander: {label: "Commander", income: 1, blurb: "The intended balance."},
  ironcore: {label: "Ironcore", income: 0.75, blurb: "Lean income; the Senate watches closely."},
};
const NAMES = ["Sol Reach", "Kryos Verge", "Aeros Drift", "Ferrum Deep", "Thalassa Shoals", "Veil of Sol", "Cinder Belt", "Umbra Gate"];

// A string seed becomes a number; the same seed always gives the same sector.
export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}
// Where in the orbital cycle a new sector starts, in ticks (0 to one 60-second cycle).
export const seedOffset = (seed) => hashSeed(seed) % 3600;
export const sectorName = (seed) => NAMES[hashSeed(seed) % NAMES.length] + " " + ((hashSeed(seed) >> 8) % 90 + 10);
// A fresh random seed for "random" starts.
export const randomSeed = () => Math.random().toString(36).slice(2, 8).toUpperCase();
