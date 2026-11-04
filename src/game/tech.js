// Orbital tech tree. Research is paid in Compute. Perk values are PLACEHOLDERS until the design spec lands.
export const TECHS = [
  {key: "beams", name: "High-Tensile Beams", tier: 1, cost: 120, requires: [],
    perk: "Conduits snap 60 units later (limit 440 → 500)."},
  {key: "plating", name: "Phase Plating", tier: 1, cost: 160, requires: [],
    perk: "Shadowed worlds still earn 50% of their output while the sun blocks them."},
  {key: "spinal", name: "Spinal Mounts", tier: 2, cost: 320, requires: ["beams"],
    perk: "Superweapons reload 25% faster."},
  {key: "anchors", name: "Singularity Anchors", tier: 2, cost: 420, requires: ["plating"],
    perk: "Fleet power +30%."},
  {key: "dyson", name: "Dyson Framework", tier: 3, cost: 900, requires: ["spinal", "anchors"],
    perk: "Unlocks the Galactic Dyson Network victory: a conduit ring around the star."},
];
export const techByKey = (key) => TECHS.find((t) => t.key === key);

// The perks currently in force, read from what has been researched.
export function perks(state) {
  const t = state.tech ?? {};
  return {
    conduitBonus: t.beams ? 60 : 0,
    occlusionShare: t.plating ? 0.5 : 0,
    reloadScale: t.spinal ? 0.75 : 1,
    fleetMult: t.anchors ? 1.3 : 1,
  };
}

// Tech costs drop while a Senate Research Accord is in force.
export const techCost = (state, tech) => Math.round(tech.cost * (state.senate?.effects?.researchMult ?? 1));

// Researches one tech. Returns {ok, msg}.
export function researchTech(state, key) {
  const t = techByKey(key);
  if (!t) return {ok: false, msg: "Unknown tech."};
  if (state.tech?.[key]) return {ok: false, msg: `${t.name} is already researched.`};
  const missing = t.requires.filter((r) => !state.tech?.[r]).map((r) => techByKey(r).name);
  if (missing.length) return {ok: false, msg: `${t.name} needs ${missing.join(" and ")} first.`};
  const cost = techCost(state, t);
  if (state.compute < cost) return {ok: false, msg: `${t.name} needs ${cost - Math.floor(state.compute)} more Compute.`};
  state.compute -= cost;
  state.tech = {...state.tech, [key]: true};
  return {ok: true, msg: `${t.name} researched.`};
}
