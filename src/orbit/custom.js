// Personalisation of the solar systems: recolour planets, add/remove your own. Stored per browser.
import { GALAXIES } from './data.js';

const KEY = 'orbit.custom.v1';
const ORBIT_GAP = 55;
const hash = (str) => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 9973; return (h % 1000) / 1000; };
const AUTO_COLORS = ['#4fd1c5', '#f6ad55', '#b794f4', '#68d391', '#f687b3', '#63b3ed'];
const HEX = /^#[0-9a-f]{6}$/i;
// Safety ceiling for the renderer only. Not a plan limit: users are never shown this number.
export const MAX_EXTRA = 60;
let autoSpecs = []; // planets that appear because a source is connected (not stored)
let state = { colors: {}, added: { origin: [], growth: [] }, style: {} };

for (const g of Object.values(GALAXIES)) for (const p of g.planets) { p.color0 = p.color; p.dot0 = p.dot; }
// Each sun's default look, so resetting the sun colour restores it exactly.
const SUN0 = Object.fromEntries(Object.entries(GALAXIES).map(([gid, g]) => [gid, { base: [...g.sun.base], patch: [...g.sun.patch], glow: g.sun.glow }]));
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
// The sun colour is stored like a planet colour, under the id 'sun-<galaxy>', so it saves and loads the same way.
const sunKey = (gid) => 'sun-' + gid;
function applySun() {
  for (const gid of Object.keys(GALAXIES)) {
    const hex = state.colors[sunKey(gid)];
    const sun = GALAXIES[gid].sun;
    if (hex && HEX.test(hex)) {
      const rgb = toRgb(hex);
      sun.base = rgb;
      sun.patch = rgb.map((v) => v + (255 - v) * 0.5);
      sun.glow = `rgba(${rgb.join(',')},`;
    } else {
      sun.base = [...SUN0[gid].base]; sun.patch = [...SUN0[gid].patch]; sun.glow = SUN0[gid].glow;
    }
  }
}
// The sun's current colour as a hex code, for the colour input.
export function sunHex(gid) { return toHex(GALAXIES[gid].sun.base); }
// The user's chosen sun colour, or null while the default is in use.
export function sunColorOf(gid) { return state.colors[sunKey(gid)] || null; }
export function setSunColor(gid, hex) {
  if (!HEX.test(hex)) return;
  state.colors[sunKey(gid)] = hex.toLowerCase(); applyCustom(); save();
}
export function resetSunColor(gid) { delete state.colors[sunKey(gid)]; applyCustom(); save(); }

function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } }

function paint(p, hex) { p.color = hex; p.dot = hex; }

function makePlanet(gid, spec) {
  const g = GALAXIES[gid];
  return {
    id: spec.id, name: spec.name, tag: 'Custom', custom: true, color: spec.color, dot: spec.color, color0: spec.color, dot0: spec.color,
    r: 9, orbit: spec.orbit, speed: Math.max(0.03, 0.045 * (500 / spec.orbit) ** 1.3 * 0.7), phase: spec.phase,
    title: spec.name, kicker: 'Your planet',
    explain: `${spec.name} is a planet you added to the ${g.type === 'build' ? 'Creator' : 'Analytics'} Galaxy. It is yours to arrange — tap it to recolour or remove it.`,
  };
}

// Rebuild the in-memory galaxy definitions from the saved settings.
// Planet personalisation: name, orbit speed, size and glow. Colour lives in state.colors.
const STYLE_RANGE = { orbitSpeed: [0.2, 2.5], size: [0.7, 1.5], glowIntensity: [0, 1] };
function cleanStyle(v) {
  const out = {};
  if (typeof v?.name === 'string' && v.name.trim()) out.name = v.name.trim().slice(0, 24);
  for (const [k, [lo, hi]] of Object.entries(STYLE_RANGE)) {
    if (Number.isFinite(+v?.[k]) && +v[k] >= lo && +v[k] <= hi) out[k] = +v[k];
  }
  return Object.keys(out).length ? out : null;
}

export function applyCustom() {
  for (const [gid, g] of Object.entries(GALAXIES)) {
    g.planets = g.planets.filter((p) => !p.custom && !p.auto);
    for (const spec of state.added[gid] || []) g.planets.push(makePlanet(gid, spec));
    // auto planets: one per connected source that has no planet of its own, each on a fresh outer orbit
    let last = Math.max(...g.planets.map((p) => p.orbit));
    for (const a of autoSpecs.filter((x) => x.galaxy === gid)) {
      last += ORBIT_GAP;
      g.planets.push({ id: 'a-' + a.slug, name: a.name, tag: 'Connected', auto: true, connector: a.slug, color: a.color, dot: a.color, color0: a.color, dot0: a.color,
        r: 9, orbit: last, speed: Math.max(0.03, 0.045 * (500 / last) ** 1.3 * 0.7), phase: hash(a.slug) * Math.PI * 2,
        title: a.name, kicker: 'Connected source',
        explain: `${a.name} is connected to your account. This planet appeared automatically so every source you connect has a place in your solar system. Tap Manage to change or remove the connection.` });
    }
    for (const p of g.planets) {
      if (p.defaultName === undefined) p.defaultName = p.name;
      if (p.baseSpeed === undefined) p.baseSpeed = p.speed;
      const st = state.style[p.id] || {};
      p.name = st.name || p.defaultName;
      p.title = p.title === p.defaultName ? p.name : p.title;
      p.speed = p.baseSpeed * (st.orbitSpeed ?? 1);
      p.engineParams = { orbitSpeed: st.orbitSpeed ?? 1, size: st.size ?? 1, glowIntensity: st.glowIntensity ?? 1 };
      const c = state.colors[p.id];
      if (c && HEX.test(c)) paint(p, c); else { p.color = p.color0; p.dot = p.dot0; }
    }
  }
  applySun();
}

export function loadCustom() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      state = { colors: {}, added: { origin: [], growth: [] }, style: {} };
      for (const [k, v] of Object.entries(s.style || {})) { const c = cleanStyle(v); if (c && /^[a-z0-9-]{1,40}$/.test(k)) state.style[k] = c; }
      for (const [k, v] of Object.entries(s.colors || {})) if (HEX.test(v) && /^[a-z0-9-]{1,40}$/.test(k)) state.colors[k] = v;
      for (const gid of ['origin', 'growth']) {
        state.added[gid] = (s.added?.[gid] || []).filter((a) => a && /^c-[a-z0-9]{4,12}$/.test(a.id) && HEX.test(a.color) && Number.isFinite(a.orbit) && Number.isFinite(a.phase))
          .map((a) => ({ id: a.id, name: String(a.name || 'Planet').slice(0, 24), color: a.color, orbit: a.orbit, phase: a.phase }));
      }
    }
  } catch { /* ignore corrupt data */ }
  applyCustom();
}

// Set any of name / orbitSpeed / size / glowIntensity. Null or '' clears the name.
export function setStyle(planetId, patch) {
  const next = { ...(state.style[planetId] || {}) };
  if (patch.name === null || patch.name === '') delete next.name; else if ('name' in patch) next.name = String(patch.name).trim().slice(0, 24);
  for (const k of Object.keys(STYLE_RANGE)) if (k in patch) { const [lo, hi] = STYLE_RANGE[k]; const n = +patch[k]; if (Number.isFinite(n) && n >= lo && n <= hi) next[k] = n; }
  const clean = cleanStyle(next);
  if (clean) state.style[planetId] = clean; else delete state.style[planetId];
  applyCustom(); save();
}
export function resetStyle(planetId) { delete state.style[planetId]; applyCustom(); save(); }
// The record the server stores for one planet (null means "no override").
export function styleRecord(planetId) {
  const st = state.style[planetId] || {};
  return { customName: st.name ?? null, color: state.colors[planetId] ?? null, orbitSpeed: st.orbitSpeed ?? null, size: st.size ?? null, glowIntensity: st.glowIntensity ?? null };
}
// Apply the rows saved on the account (from GET /api/planet-settings).
export function applyServerStyles(rows) {
  for (const r of rows || []) {
    if (!/^[a-z0-9-]{1,40}$/.test(r.planetId)) continue;
    if (r.color && HEX.test(r.color)) state.colors[r.planetId] = r.color.toLowerCase();
    const clean = cleanStyle({ name: r.customName, orbitSpeed: r.orbitSpeed, size: r.size, glowIntensity: r.glowIntensity });
    if (clean) state.style[r.planetId] = clean;
  }
  applyCustom(); save();
}

export function setColor(planetId, hex) {
  if (!HEX.test(hex)) return;
  state.colors[planetId] = hex.toLowerCase(); applyCustom(); save();
}
export function setAllColors(gid, hex) {
  if (!HEX.test(hex)) return;
  for (const p of GALAXIES[gid].planets) state.colors[p.id] = hex.toLowerCase();
  applyCustom(); save();
}
export function resetColors(gid, planetId) {
  if (planetId) delete state.colors[planetId];
  else for (const p of GALAXIES[gid].planets) delete state.colors[p.id];
  applyCustom(); save();
}
export function addPlanet(gid, name, color) {
  if ((state.added[gid] || []).length >= MAX_EXTRA || !HEX.test(color)) return null;
  const last = Math.max(...GALAXIES[gid].planets.map((p) => p.orbit));
  const id = 'c-' + Math.random().toString(36).slice(2, 8);
  state.added[gid].push({ id, name: (name || 'New planet').trim().slice(0, 24) || 'New planet', color: color.toLowerCase(), orbit: last + ORBIT_GAP, phase: Math.random() * Math.PI * 2 });
  applyCustom(); save(); return id;
}
export function removePlanet(gid, id) {
  state.added[gid] = (state.added[gid] || []).filter((a) => a.id !== id);
  delete state.colors[id]; applyCustom(); save();
}
export function canAdd(gid) { return (state.added[gid] || []).length < MAX_EXTRA; }

// Connected sources without a dedicated planet get one automatically. Returns true if the set changed.
export function syncConnections(connections, catalog) {
  const wanted = [];
  for (const c of connections || []) {
    if (c.status !== 'active' || c.slug === 'anthropic') continue; // Claude already has its planet
    const meta = (catalog || []).find((x) => x.slug === c.slug);
    if (meta?.type === 'ai') continue; // AI keys power KV-4 and the builder; they don't add a planet
    const gid = meta?.type === 'analytics' ? 'origin' : 'growth';
    if (GALAXIES[gid].planets.some((p) => !p.auto && !p.custom && (p.connector === c.slug || p.sources?.some((x) => x.connector === c.slug)))) continue;
    wanted.push({ slug: c.slug, name: meta?.name || c.slug, galaxy: gid, color: AUTO_COLORS[wanted.length % AUTO_COLORS.length] });
  }
  const key = (l) => l.map((a) => a.slug).join(',');
  if (key(wanted) === key(autoSpecs)) return false;
  autoSpecs = wanted; applyCustom(); return true;
}
