// Galactic Senate roster, derived from roster_data.js (20 leaders, 5 Senate blocs).
import {LEADERS, SENATE_BLOCS} from "./roster_data.js";

export const BLOC_LIST = Object.values(SENATE_BLOCS);

export const FACTIONS = LEADERS.map((l) => ({
  id: l.id,
  name: l.name,
  number: l.number,
  monogram: l.monogram,
  sub: `${l.faction} • ${l.species}`,
  trait: `${l.trait}: ${l.traitDesc}`,
  bloc: SENATE_BLOCS[l.bloc].name,
  blocId: l.bloc,
  color: l.color,
  defaultRep: l.defaultRep,
  opener: l.greeting,
}));
export const factionById = (id) => FACTIONS.find((f) => f.id === id);
