/**
 * Orbiter: Stellar Conquest - 20-Leader Diplomatic Roster
 * Source: Master Lore Compendium & Senate Architecture
 * 
 * 5 Blocs, 4 Leaders each (20 total)
 */

export const SENATE_BLOCS = {
  HAWK: { id: "HAWK", name: "The Hawk Coalition", description: "Military Might & Territorial Expansion", color: "#38bdf8" },
  PRESERVATION: { id: "PRESERVATION", name: "The Preservation Bloc", description: "Ecological Balance & Starlight Harmonics", color: "#06b6d4" },
  CARTEL: { id: "CARTEL", name: "The Free Enterprise Cartel", description: "Commerce, Liquidity & Privateering", color: "#f59e0b" },
  FORGE: { id: "FORGE", name: "The Forge & Foundry Guild", description: "Heavy Industry & Survivor Grit", color: "#a855f7" },
  CONCLAVE: { id: "CONCLAVE", name: "The Synthetic & Scholastic Conclave", description: "Data Telemetry, Void-Tech & Galactic Law", color: "#818cf8" }
};

export const LEADERS = [
  // --- BLOC 1: THE HAWK COALITION ---
  {
    id: "talon_01",
    number: "01",
    name: "High Warmaster Talon",
    faction: "The Raptor Dominion",
    species: "Avian-Strigiform",
    title: "High Warmaster",
    bloc: "HAWK",
    color: "#38bdf8",
    monogram: "TL",
    trait: "Sovereign Skies",
    traitDesc: "+15% fleet speed along active solar conduits.",
    defaultRep: 0,
    greeting: "Vector locked, Commander. Keep your conduits clear of our combat wings or prepare for kinetic interception."
  },
  {
    id: "ignis_03",
    number: "03",
    name: "Sovereign Ignis",
    faction: "The Draconis Ascendancy",
    species: "Draconian Elder",
    title: "Sovereign",
    bloc: "HAWK",
    color: "#10b981",
    monogram: "IG",
    trait: "Titan Scales",
    traitDesc: "Capital hulls absorb 25% kinetic railgun damage.",
    defaultRep: 10,
    greeting: "Three centuries I have watched empires burn and freeze. Honor your signed accords, and the Ascendancy will not crush your nodes."
  },
  {
    id: "leon_11",
    number: "11",
    name: "High King Aurelius Leon",
    faction: "The Solar Imperium",
    species: "Felid-Leonine Sovereign",
    title: "High King",
    bloc: "HAWK",
    color: "#f59e0b",
    monogram: "AL",
    trait: "Crown of Sol",
    traitDesc: "Planetary stations generate defensive solar barrier fields.",
    defaultRep: 0,
    greeting: "You stand in the radiant presence of the Solar Imperium. State your business: do you offer fealty to the Crown, or does your fleet seek battle?"
  },
  {
    id: "fenris_15",
    number: "15",
    name: "Commander Fenris",
    faction: "The Wolfpack Vanguard",
    species: "Lupine Battlemaster",
    title: "Alpha Commander",
    bloc: "HAWK",
    color: "#94a3b8",
    monogram: "FN",
    trait: "Pack Stalker",
    traitDesc: "Combat ships gain +5% attack power per adjacent allied ship.",
    defaultRep: -10,
    greeting: "The pack smells weakness across the void. Show courage and stand your ground, or be hunted like scrap in the belts."
  },

  // --- BLOC 2: THE PRESERVATION BLOC ---
  {
    id: "aurelia_02",
    number: "02",
    name: "Empath-Matriarch Aurelia",
    faction: "The Medusan Chorus",
    species: "Cnidarian Mystic",
    title: "Empath-Matriarch",
    bloc: "PRESERVATION",
    color: "#06b6d4",
    monogram: "AR",
    trait: "Hydro-Harmonics",
    traitDesc: "+20% Biomass & Food yield on ocean worlds.",
    defaultRep: 15,
    greeting: "The ocean songs echo through the vacuum. Harmonize your extraction networks with our currents, and we shall share the deep harvest."
  },
  {
    id: "lunara_06",
    number: "06",
    name: "Lady Lunara",
    faction: "The Nebula Enclave",
    species: "Astral Luminary",
    title: "High Emissary",
    bloc: "PRESERVATION",
    color: "#c084fc",
    monogram: "LN",
    trait: "Aurora Matrix",
    traitDesc: "Syzygy 3-planet alignment production surges last double duration.",
    defaultRep: 20,
    greeting: "The celestial alignments foretell great turbulence. Align your orbital circuits with the stars, and peace shall prosper."
  },
  {
    id: "zephyra_12",
    number: "12",
    name: "Oracle Zephyra",
    faction: "The Avian Cloister",
    species: "Avian-Seraph",
    title: "High Oracle",
    bloc: "PRESERVATION",
    color: "#e0e7ff",
    monogram: "ZP",
    trait: "Starlit Prophecy",
    traitDesc: "Pre-warns of hazard spikes and cosmic cataclysms 60s in advance.",
    defaultRep: 10,
    greeting: "I hear the groaning of fractured planetary crusts across the ether. Tread carefully where you strike your drills, Arch-Administrator."
  },
  {
    id: "solaria_14",
    number: "14",
    name: "Queen Solaria",
    faction: "The Corona Ascendancy",
    species: "Solar-Forged Sovereign",
    title: "Corona Queen",
    bloc: "PRESERVATION",
    color: "#fde047",
    monogram: "SL",
    trait: "Solar Bloom",
    traitDesc: "+40% energy and revenue on innermost planetary orbits.",
    defaultRep: 5,
    greeting: "Bask in the thermal splendor of Sol Core. Those who fear the flame wither in the cold dark. What offering do you bring to the sunfire?"
  },

  // --- BLOC 3: THE FREE ENTERPRISE CARTEL ---
  {
    id: "vesper_05",
    number: "05",
    name: "Shadow-Operative Vesper",
    faction: "Felis Black-Ops Syndicate",
    species: "Felid Infiltrator",
    title: "Master Infiltrator",
    bloc: "CARTEL",
    color: "#64748b",
    monogram: "VS",
    trait: "Silent Thrusters",
    traitDesc: "Stealth freighters siphon unmonitored enemy conduits.",
    defaultRep: -5,
    greeting: "Quiet steps leave no radar wake. Everything has a price tag out here—including the coordinates to your unshielded fuel depots."
  },
  {
    id: "xyria_08",
    number: "08",
    name: "Huntress Xyria",
    faction: "The Tigris Corsairs",
    species: "Felid Corsair",
    title: "Warmistress",
    bloc: "CARTEL",
    color: "#f97316",
    monogram: "XY",
    trait: "Ambush Vector",
    traitDesc: "+35% critical strike damage when firing from asteroid fields.",
    defaultRep: -20,
    greeting: "Your conduits run thick with raw loot. Pay our toll in clean Credits, or my reavers will sever your beams and take the scrap."
  },
  {
    id: "ssarath_10",
    number: "10",
    name: "High Vizier Ssa-Rath",
    faction: "The Serpentine Banking Guild",
    species: "Ophidian Aristocrat",
    title: "High Vizier",
    bloc: "CARTEL",
    color: "#34d399",
    monogram: "SR",
    trait: "Compound Usury",
    traitDesc: "+10% interest dividend on banked credits per solar cycle.",
    defaultRep: 10,
    greeting: "Contracts signed in blood are messy; contracts signed in compounded interest are permanent. Let us examine your credit balance."
  },
  {
    id: "ren_16",
    number: "16",
    name: "Captain Ren",
    faction: "The Vulpine Free-Traders",
    species: "Vulpine Merchant",
    title: "Commodore",
    bloc: "CARTEL",
    color: "#fbbf24",
    monogram: "RN",
    trait: "Bounty Runner",
    traitDesc: "Earns bonus credit payouts whenever hostile raiders are destroyed.",
    defaultRep: 15,
    greeting: "Keep your weapons powered down and your trading ledgers open! The Free-Traders are always ready to make a fair exchange."
  },

  // --- BLOC 4: THE FORGE & FOUNDRY GUILD ---
  {
    id: "bjorn_07",
    number: "07",
    name: "Warlord Bjorn-Ironhide",
    faction: "The Ursa Legion",
    species: "Ursine Cybernetic Warlord",
    title: "Supreme Commander",
    bloc: "FORGE",
    color: "#a855f7",
    monogram: "BJ",
    trait: "Dense Foundry",
    traitDesc: "-30% alloy cost for capital ship armor and fortifications.",
    defaultRep: 5,
    greeting: "Talk is thin air; armor plating is fact. If you have iron to smelt and battles to fight, speak. If not, get out of the foundry."
  },
  {
    id: "boreas_09",
    number: "09",
    name: "Frost-Lord Boreas",
    faction: "The Gliesian Frostborn",
    species: "Cryo-Infused Humanoid",
    title: "Lord Protector",
    bloc: "FORGE",
    color: "#67e8f9",
    monogram: "BR",
    trait: "Zero Kelvin",
    traitDesc: "Railguns generate zero heat and cycle 20% faster.",
    defaultRep: 0,
    greeting: "Heat is waste; motion is friction. Conserve your energy, Commander. Cryogenic stillness is the only lasting truth of this galaxy."
  },
  {
    id: "vexkiri_17",
    number: "17",
    name: "Hive Matron Vex'Kiri",
    faction: "The Swarm Brood",
    species: "Insectoid Sovereign",
    title: "Bio-Architect",
    bloc: "FORGE",
    color: "#84cc16",
    monogram: "VX",
    trait: "Accelerated Gestation",
    traitDesc: "+50% planetary population growth rates across all worlds.",
    defaultRep: -5,
    greeting: "The Brood requires biomass to feed the nursery hives. Feed us water and food from your ocean worlds, and we shall not swarm."
  },
  {
    id: "vance_19",
    number: "19",
    name: "Captain James 'Rook' Vance",
    faction: "The Terran Scrap-Fleets",
    species: "Cybernetic Human",
    title: "Commodore",
    bloc: "FORGE",
    color: "#cbd5e1",
    monogram: "JV",
    trait: "Scrap-Welder",
    traitDesc: "Damaged hulls auto-salvage defeated ships mid-combat to restore health.",
    defaultRep: 10,
    greeting: "Look around you, kid. Half our ships are held together by spit, prayer, and welded scrap. Got any titanium to spare for the survivors?"
  },

  // --- BLOC 5: THE SYNTHETIC & SCHOLASTIC CONCLAVE ---
  {
    id: "kaelvoss_04",
    number: "04",
    name: "Arch-Entity Kael-Voss",
    faction: "The Void Born",
    species: "Void-Forged Transhuman",
    title: "Arch-Entity",
    bloc: "CONCLAVE",
    color: "#818cf8",
    monogram: "KV",
    trait: "Singularity Sight",
    traitDesc: "Immune to solar flare disruptions and black-hole gravitational pull.",
    defaultRep: -15,
    greeting: "We have crossed the threshold of the event horizon and witnessed the cold math of eternity. Your fragile stellar circuits mean nothing."
  },
  {
    id: "morvath_13",
    number: "13",
    name: "Archon Morvath",
    faction: "The Rift Syndicate",
    species: "Cosmic Archon",
    title: "High Physicist",
    bloc: "CONCLAVE",
    color: "#a78bfa",
    monogram: "MV",
    trait: "Void Weaving",
    traitDesc: "-50% energy loss over long-distance orbital tethers.",
    defaultRep: 0,
    greeting: "Space-time is merely fabric waiting for the needle. Feed my compute arrays with telemetry, and I will show you how to fold the orbits."
  },
  {
    id: "unit734_18",
    number: "18",
    name: "Unit 734-Apex",
    faction: "The Machine Conclave",
    species: "Synthetic Automaton",
    title: "Central Core",
    bloc: "CONCLAVE",
    color: "#ef4444",
    monogram: "73",
    trait: "Calculated Precision",
    traitDesc: "+25% targeting accuracy for planetary defense platforms.",
    defaultRep: -10,
    greeting: "Organics are volatile, inefficient variables. State your transmission payload in clean binary compute packets. Do not waste cycles."
  },
  {
    id: "strix_20",
    number: "20",
    name: "Chancellor Strix",
    faction: "The Athenaeum Syndicate",
    species: "Strigiform High Scholar",
    title: "High Chancellor",
    bloc: "CONCLAVE",
    color: "#2dd4bf",
    monogram: "SX",
    trait: "Scholastic Dominion",
    traitDesc: "+20% faster research progression when linked to 3+ capitals.",
    defaultRep: 25,
    greeting: "Knowledge is the only currency that survives stellar collapse. Uphold the Galactic Senate Charter, and our vast libraries are open to you."
  }
];

export default { SENATE_BLOCS, LEADERS };