# Deploying Orbiter: Stellar Conquest to Vercel

The game is a static Vite app. The simulation kernel is a WebAssembly module that the browser loads from `/engine/`, so the engine files must be part of the deployed repo.

## What Vercel builds

`vercel.json` sets the build:

- Build command: `npm run build:web` (runs `vite build`, output in `dist/`)
- Output directory: `dist`
- `/engine/*.wasm` is served as `application/wasm`
- All other routes rewrite to `/index.html` (single-page app)

Vercel does not run Emscripten. The engine files in `public/engine/` must already be in the repository:

- `orbiter_kernel.mjs` and `orbiter_kernel.wasm` (game kernel, from `npm run build:wasm`)
- `orbit-sim.js` and `orbit-sim.wasm` (orbit scene engine, from `npm run build:engine`)

Rebuild them with Emscripten whenever the C++ changes, then commit the updated files.

## One-click import

1. Open https://vercel.com/new and choose **Import Git Repository**.
2. Select `TronDynamo/orbiter-sim-kernel`.
3. Leave the framework as **Vite**. The settings come from `vercel.json`.
4. Click **Deploy**.

## Command line

```bash
npm install
npm run build:web          # local check: writes dist/
npx vercel --prod          # first run asks you to log in and link the project
```

## Checking a deployment

- The title screen reads `KERNEL: ONLINE` (not `LOADING`). If it stays on `LOADING`, `/engine/orbiter_kernel.wasm` did not load: check that the file is in the repo.
- Browser devtools → Network: `orbiter_kernel.wasm` should return `200` with `Content-Type: application/wasm`.

## Why no COOP/COEP headers

The kernel is built without pthreads, so it does not use `SharedArrayBuffer`. Cross-origin isolation (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) is not needed, and `require-corp` would block cross-origin assets. Add them only if the engine is later built with threads.
