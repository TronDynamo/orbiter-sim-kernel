// Leader portraits: one image per leader ID, with the hologram colour shown when the image is missing.
// Image files go in public/assets/characters/ (see the README there). A missing file falls back to a
// procedural holographic avatar, so the UI never shows a broken image square.
export const PORTRAITS = {
  talon_01: {src: "/assets/characters/char_talon.png", fallback: "#38BDF8"},
  aurelia_02: {src: "/assets/characters/char_aurelia.png", fallback: "#06B6D4"},
  ignis_03: {src: "/assets/characters/char_ignis.png", fallback: "#10B981"},
  kaelvoss_04: {src: "/assets/characters/char_kaelvoss.png", fallback: "#818CF8"},
  vesper_05: {src: "/assets/characters/char_vesper.png", fallback: "#64748B"},
  lunara_06: {src: "/assets/characters/char_lunara.png", fallback: "#C084FC"},
  bjorn_07: {src: "/assets/characters/char_bjorn.png", fallback: "#A855F7"},
  xyria_08: {src: "/assets/characters/char_xyria.png", fallback: "#F97316"},
  boreas_09: {src: "/assets/characters/char_boreas.png", fallback: "#67E8F9"},
  ssarath_10: {src: "/assets/characters/char_ssarath.png", fallback: "#34D399"},
  leon_11: {src: "/assets/characters/char_leon.png", fallback: "#F59E0B"},
  zephyra_12: {src: "/assets/characters/char_zephyra.png", fallback: "#E0E7FF"},
  morvath_13: {src: "/assets/characters/char_morvath.png", fallback: "#A78BFA"},
  solaria_14: {src: "/assets/characters/char_solaria.png", fallback: "#FDE047"},
  fenris_15: {src: "/assets/characters/char_fenris.png", fallback: "#94A3B8"},
  ren_16: {src: "/assets/characters/char_ren.png", fallback: "#FBBF24"},
  vexkiri_17: {src: "/assets/characters/char_vexkiri.png", fallback: "#84CC16"},
  unit734_18: {src: "/assets/characters/char_unit734.png", fallback: "#EF4444"},
  vance_19: {src: "/assets/characters/char_vance.png", fallback: "#CBD5E1"},
  strix_20: {src: "/assets/characters/char_strix.png", fallback: "#2DD4BF"},
};
