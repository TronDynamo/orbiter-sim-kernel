# orbiter-sim-kernel

High-tick simulation kernel for Orbiter: Stellar Conquest. Structure-of-arrays state, fixed buffers, no allocation on the tick path.

## Layout
- `config/planets.js`: star, planets and conduits (edit this; same shape as orbit-business `src/orbit/data.js`)
- `scripts/gen-config.mjs`: generates `src/planet_config.hpp` from the config
- `src/orbiter_kernel.{hpp,cpp}`: the kernel
- `src/main.cpp`: benchmark entry point
- `tests/kernel_test.cpp`: checks

## Commands
- `npm run gen`: regenerate the C++ config header
- `npm run build`: build `build/orbiter_kernel`
- `npm test`: build and run the checks
- `npm run run`: build and run the 20,000-tick benchmark

## Game (web)
Orbiter: Stellar Conquest runs in the browser. The title screen waits for the kernel to load, then
"Initialize Sector" starts the game with the kernel driving the planets.

- `npm install`
- `npm run build:engine`: compile the Orbit scene engine (`native/game-optimizer`) to `public/engine/` (needs emscripten; set `EMSDK`)
- `npm run build:wasm`: compile the kernel to WebAssembly in `build/wasm/`, then copy `orbiter_kernel.mjs` and `orbiter_kernel.wasm` into `public/engine/`
- `npm run dev`: start the dev server at http://127.0.0.1:5173/
- `npm run build:web`: production build into `dist/`

`public/engine/` is generated and not committed.
