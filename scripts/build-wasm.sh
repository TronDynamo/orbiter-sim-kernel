#!/usr/bin/env bash
# Builds the kernel to WebAssembly as an ES module: build/wasm/orbiter_kernel.mjs + .wasm
# Needs an Emscripten checkout: EMSDK_DIR=/path/to/emsdk scripts/build-wasm.sh
set -euo pipefail
: "${EMSDK_DIR:?set EMSDK_DIR to your emsdk checkout}"
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
node scripts/gen-config.mjs
mkdir -p build/wasm
EXPORTS=(
  orbiter_reset orbiter_tick orbiter_launch orbiter_tick_count
  orbiter_planet_count orbiter_conduit_count orbiter_missile_count orbiter_asteroid_count
  orbiter_star_radius orbiter_star_collapsed orbiter_star_supernova
  orbiter_planet_x orbiter_planet_y orbiter_planet_orbit_radius orbiter_planet_population
  orbiter_planet_status orbiter_planet_vortex_ticks
  orbiter_conduit_throughput orbiter_conduit_length orbiter_conduit_snapped orbiter_conduit_surge
  orbiter_conduit_add orbiter_conduit_remove orbiter_conduit_occluded
  orbiter_conduit_source orbiter_conduit_target orbiter_conduit_max_length
  orbiter_planet_gain_total orbiter_planet_flow
  orbiter_missile_x orbiter_missile_y orbiter_missile_active orbiter_missile_type
  orbiter_asteroid_x orbiter_asteroid_y
)
EXPORTED=$(printf "_%s," "${EXPORTS[@]}"); EXPORTED=${EXPORTED%,}
emcc -std=c++17 -O2 -Isrc src/orbiter_kernel.cpp src/wasm_api.cpp \
  -o build/wasm/orbiter_kernel.mjs \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createOrbiterKernel \
  -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=0 -sINITIAL_MEMORY=8388608 \
  -sEXPORTED_FUNCTIONS="$EXPORTED" -sEXPORTED_RUNTIME_METHODS=HEAPF64,HEAPU8
echo "built build/wasm/orbiter_kernel.mjs and .wasm"
