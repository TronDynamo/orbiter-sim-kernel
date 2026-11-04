#!/usr/bin/env bash
# Compiles the Orbit scene engine (native/game-optimizer/orbit-sim.cpp) to WebAssembly into public/engine/.
# Needs emscripten on PATH (or EMSDK pointing at an emsdk checkout).
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v em++ >/dev/null 2>&1; then
  : "${EMSDK:?set EMSDK to an emsdk checkout or put em++ on PATH}"
  source "$EMSDK/emsdk_env.sh" >/dev/null
fi
mkdir -p public/engine
em++ -std=c++20 -O3 -fno-exceptions --no-entry native/game-optimizer/scheduler.cpp native/game-optimizer/orbit-sim.cpp -Inative/game-optimizer/include \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sINITIAL_MEMORY=16777216 -sALLOW_MEMORY_GROWTH=0 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS='["_sim_init","_sim_clear_bodies","_sim_add_body","_sim_set_view","_sim_set_params","_sim_select","_sim_reset_camera","_sim_step","_sim_hit","_sim_body_count","_sim_star_count","_sim_bodies","_sim_stars","_sim_order","_sim_camera","_sim_stats"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAPF32","HEAP32"]' -o public/engine/orbit-sim.js
ls -la public/engine
