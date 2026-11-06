// Preloads the art shipped under public/assets/. Each image is optional: when a file is missing or fails to load,
// the renderer falls back to its procedural vector drawing, so the game never blocks on art.
const BASE = "/assets";
export const ASSET_BASE = BASE;

export const ASSET_SRC = {
  ships: {
    corvette: `${BASE}/ships/ship_corvette.png`,
    destroyer: `${BASE}/ships/ship_destroyer.png`,
    cruiser: `${BASE}/ships/ship_dreadnought.png`,
  },
  planets: {
    sun: `${BASE}/planets/sun_orange_core.png`,
    thalassa: `${BASE}/planets/planet_aureus.png`,
    aeros: `${BASE}/planets/planet_verdant.png`,
    ferrum: `${BASE}/planets/planet_ferrum.png`,
    kryos: `${BASE}/planets/planet_kryos.png`,
  },
};

export const ASSETS = {ships: {}, planets: {}};
let ready = false;

// Resolves once every image has settled (loaded or failed). Safe to call more than once.
export function preloadAssets() {
  const jobs = [];
  for (const group of ["ships", "planets"]) {
    for (const [key, src] of Object.entries(ASSET_SRC[group])) {
      const img = new Image();
      ASSETS[group][key] = img;
      jobs.push(new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      }));
    }
  }
  return Promise.all(jobs).then((results) => { ready = true; return results; });
}

// True when the sprite decoded and can be drawn; otherwise callers keep their vector fallback.
export function spriteReady(img) {
  return !!img && img.complete && img.naturalWidth > 0;
}
export const assetsReady = () => ready;

// Commander ship art: public/assets/ships/<leader key>/<role>.png, loaded on first use and cached. Returns the image once
// it has decoded, otherwise null, so the caller keeps its vector hull until the art is ready.
const SHIP_ART = {};
export function commanderSprite(leaderId, role) {
  if (!leaderId || !role) return null;
  const key = `${leaderId.split("_")[0]}/${role}`;
  if (!SHIP_ART[key]) {
    const img = new Image();
    img.src = `${BASE}/ships/${key}.png`;
    SHIP_ART[key] = img;
  }
  return spriteReady(SHIP_ART[key]) ? SHIP_ART[key] : null;
}

// Commander Ark art: public/assets/ark/<leader key>.jpg, loaded on first use. Null until decoded.
const ARK_ART = {};
export function arkArt(leaderId) {
  if (!leaderId) return null;
  const key = leaderId.split("_")[0];
  if (!ARK_ART[key]) {
    const img = new Image();
    img.src = `${BASE}/ark/${key}.jpg`;
    ARK_ART[key] = img;
  }
  return spriteReady(ARK_ART[key]) ? ARK_ART[key] : null;
}
