// Orbiter: Stellar Conquest. The dying star and its four worlds, drawn by Orbit's C++ orbit engine.
// Orbit speeds are engine units (radians per second). Inner worlds are fast, outer worlds slow.
export const ARK_POS = {x: 0, y: -95}; // the Ark Endeavor's fixed station between the core and the inner world

export const GAME_GALAXY = {
  id: 'game',
  type: 'game',
  tab: 'Orbiter: Stellar Conquest',
  dot: '#ff7a45',
  subtitle: 'Orbiter: Stellar Conquest • Dying Star Sector',
  subtitleNote: '',
  sun: {base: [170, 64, 46], patch: [230, 130, 90], glow: 'rgba(230,90,50,', radius: 44},
  nebula: [200, 70, 40],
  planets: [
    {id: 'thalassa', name: 'Thalassa', tag: 'Thalassa', molten: true, color: '#7fd3ff', r: 10, orbit: 170, speed: 0.314, phase: 0.0, inner: true},
    {id: 'aeros', name: 'Aeros', tag: 'Aeros', color: '#d6a84f', r: 11, orbit: 255, speed: 0.196, phase: 2.0, inner: true},
    {id: 'ferrum', name: 'Ferrum', tag: 'Ferrum', color: '#8a6a5a', r: 10, orbit: 335, speed: 0.14, phase: 3.5},
    {id: 'kryos', name: 'Kryos', tag: 'Kryos', color: '#c9ecff', r: 12, orbit: 420, speed: 0.105, phase: 1.0},
  ],
};

export const PLANET_IDS = GAME_GALAXY.planets.map((p) => p.id);
export const NAMES = {ark: 'Ark Endeavor', core: 'Dying Star', thalassa: 'Thalassa', aeros: 'Aeros', ferrum: 'Ferrum', kryos: 'Kryos'};
