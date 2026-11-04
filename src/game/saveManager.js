// Save slots in localStorage: autosave, quicksave, and three manual slots. Each save holds the kernel's
// replay log (the simulation) and the React game state (stockpiles, tech, buildings, fleets, opinions).
import {sectorName} from "./campaign.js";

export const SLOTS = [
  {id: "autosave", label: "Autosave", manual: false},
  {id: "quicksave", label: "Quicksave", manual: false},
  {id: "slot_1", label: "Slot 1", manual: true},
  {id: "slot_2", label: "Slot 2", manual: true},
  {id: "slot_3", label: "Slot 3", manual: true},
];
const PREFIX = "orbiter_save_v1:";
const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.label ?? id;

function read(id) {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.version === 1 ? data : null;
  } catch (e) { return null; }
}

// Everything the React side needs, minus transient effects and the drag in progress.
function serializable(state) {
  const {flashes, drag, ...rest} = state;
  return JSON.parse(JSON.stringify(rest));
}

// Writes a save into a slot. Returns the saved record, or null if storage refused it.
export function saveGame(slotId, {kernel, state, seed, difficulty, customName = null}) {
  const population = Math.round(Array.from(kernel.planets.population.subarray(0, kernel.planetCount)).reduce((a, b) => a + b, 0));
  const data = {
    version: 1,
    slot: slotId,
    name: customName ?? slotLabel(slotId),
    savedAt: Date.now(),
    sector: sectorName(seed),
    seed,
    difficulty,
    elapsed: state.elapsed,
    population,
    credits: Math.floor(state.credits),
    kernel: kernel.exportState(),
    state: serializable(state),
  };
  try {
    localStorage.setItem(PREFIX + slotId, JSON.stringify(data));
    return data;
  } catch (e) { return null; }
}

export const loadGame = read;

// Every filled slot, newest first.
export function listSaves() {
  return SLOTS.map((s) => ({slot: s, data: read(s.id)}))
    .filter((x) => x.data)
    .sort((a, b) => b.data.savedAt - a.data.savedAt);
}

export function deleteSave(slotId) {
  try { localStorage.removeItem(PREFIX + slotId); } catch (e) { /* nothing to remove */ }
}

export const hasContinue = () => listSaves().length > 0;

export const fmtElapsed = (sec) => `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
export const fmtWhen = (ms) => new Date(ms).toLocaleString(undefined, {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
