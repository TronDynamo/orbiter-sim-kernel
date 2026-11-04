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
