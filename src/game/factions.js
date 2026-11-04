// Galactic Senate factions. Names, numbers, blocs and colours are the roster shown on the title screen.
// Species traits, portraits and opening lines are PLACEHOLDERS until the design spec's roster lands:
// the title screen lists six factions, not the twenty the spec describes.
export const FACTIONS = [
  {id: "aurelius", name: "High King Aurelius Leon", number: 11, sub: "The Solar Imperium • Crown of Sol", bloc: "Hawk Bloc", color: "#fbbf24",
    opener: "Your conduits have been counted. The Imperium does not bargain with conduits. It takes them."},
  {id: "aurelia", name: "Empath-Matriarch Aurelia", number: 2, sub: "The Medusan Chorus • Hydro-Harmonics", bloc: "Preservation", color: "#38bdf8",
    opener: "Your machines hum where our oceans once sang. Tell us what you intend to preserve."},
  {id: "kael", name: "Arch-Entity Kael-Voss", number: 4, sub: "The Void Born • Singularity Sight", bloc: "Singularity", color: "#c084fc",
    opener: "We have seen the star's death from the inside. Speak plainly, or do not speak."},
  {id: "ren", name: "Captain Ren", number: 16, sub: "Vulpine Free-Traders • Bounty Runner", bloc: "Cartel", color: "#34d399",
    opener: "Ren here. Everything has a price, and I'm listening for yours."},
  {id: "apex", name: "Unit 734-Apex", number: 18, sub: "The Machine Conclave • Calculated Precision", bloc: "Synthetic", color: "#f87171",
    opener: "Query: state your objective. Probability of your cooperation is being calculated."},
  {id: "vance", name: 'Captain James "Rook" Vance', number: 19, sub: "Terran Scrap-Fleets • Scrap-Welder", bloc: "Frontier", color: "#e2e8f0",
    opener: "Rook Vance. We've got scrap, a few ships, and no patience for speeches."},
];
export const factionById = (id) => FACTIONS.find((f) => f.id === id);
