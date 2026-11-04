// Player settings, stored under orbiter_settings_v1. Applied to the page through data attributes and CSS variables.
export const DEFAULT_SETTINGS = {
  master: 80, music: 60, sfx: 85, ambience: true,
  crt: true, shake: "subtle", orbitOpacity: 35, fps: true,
  pauseOnDefocus: true, confirmSuperweapon: true, autosave: 60,
};
const KEY = "orbiter_settings_v1";

function load() {
  try { return {...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || "{}")}; }
  catch (e) { return {...DEFAULT_SETTINGS}; }
}
let current = load();
export const getSettings = () => current;

export function applySettings(s) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.crt = s.crt ? "on" : "off";
  root.dataset.shake = s.shake;
  root.style.setProperty("--shake-px", s.shake === "heavy" ? "8px" : s.shake === "subtle" ? "2px" : "0px");
}
export function setSettings(next) {
  current = {...DEFAULT_SETTINGS, ...next};
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* storage unavailable: settings last this page only */ }
  applySettings(current);
  return current;
}
applySettings(current);
