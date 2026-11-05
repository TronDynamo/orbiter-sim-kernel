// Orbiter: Stellar Conquest screen. Reuses Orbit's solar-system scene (C++ WebAssembly orbit engine,
// planets, dying star, starfield, styling). Tethers, the Ark and mission telemetry sit on top.
import {useEffect, useRef, useState} from "react";
import {OrbitScene} from "../orbit/scene.js";
import {BODY_STRIDE} from "../orbit/engine.js";
import {GAME_GALAXY, PLANET_IDS, ARK_POS} from "./galaxy.js";
import {loadOrbiterKernel, TICKS_PER_SECOND, WEAPON, WORLD, CONDUIT_ERR, CONDUIT_RULES} from "./kernel/orbiterKernel.js";
import {ARMORY, drawCage, drawMagma, drawIrradiated, drawBlackHole, drawSupernova} from "./armory.js";
import {STAR_COLLAPSE, VORTEX, DRILL_CRACK_DISTANCE, PLANETS as PLANET_DEFS} from "../../config/planets.js";
import {IntroScreen} from "./IntroScreen.jsx";
import {PauseMenu} from "./PauseMenu.jsx";
import {DIFFICULTIES, seedOffset} from "./campaign.js";
import {getSettings} from "./settings.js";
import {saveGame, loadGame} from "./saveManager.js";
import "./system.css";
import {CommsTerminal} from "./CommsTerminal.jsx";
import {applyChoice, openComms} from "./comms.js";
import {GovernorPanel} from "./GovernorPanel.jsx";
import {INFRA, infraOf, buildInfra, absorbStrike, costOf} from "./colony.js";
import {TECHS, researchTech, perks} from "./tech.js";
import {SESSION_SECONDS, runSession} from "./senate.js";
import {checkVictory, VICTORIES} from "./victory.js";
import {TechWeb} from "./TechWeb.jsx";
import {SenateChamber} from "./SenateChamber.jsx";
import {VictoryModal} from "./VictoryModal.jsx";
import {RULES, newState, snapTethers, network, tick, tryTether, checkTether, cut, tetherAt, tensionOf, tensionColor, build, hitBody, distToTether, orderShip, shortfall, fireWeapon} from "./rules.js";
import {SHIPS, SHIP_ORDER, COST_LABEL, drawShip, fleetPower, FLIGHT_LENGTH} from "./ships.js";
import {stepFleet, sendShip, shipPosition, interceptAt} from "./fleet.js";
import {Icon, drawArk, drawRelay} from "./icons.jsx";
import {Academy} from "./Academy.jsx";
import {ShipPreview} from "./ShipPreview.jsx";

const START_MSG = "Drag from one world to another to build a conduit. Conduits snap beyond " + CONDUIT_RULES.maxLength + " units.";
const CONDUIT_MSG = {
  [CONDUIT_ERR.BAD_PLANET]: "That world can't take a conduit.",
  [CONDUIT_ERR.DUPLICATE]: "Those worlds are already linked.",
  [CONDUIT_ERR.TOO_LONG]: "Too far apart: conduits snap beyond " + CONDUIT_RULES.maxLength + " units.",
  [CONDUIT_ERR.OCCLUDED]: "The dying star blocks that line.",
  [CONDUIT_ERR.FULL]: "The network has no free conduit slots.",
};
const isPlanet = (id) => GAME_GALAXY.planets.some((p) => p.id === id);
// Which stockpile each world's siphoned output feeds (game data; the kernel only produces the flow).
// Conduit tone by tension: cyan below 70% of the snap limit, amber to 90%, a pulsing red beyond that.
const tensionTone = (r, now) => r >= 0.9 ? `rgba(239,68,68,${(0.55 + 0.45 * Math.sin(now / 120)).toFixed(3)})` : r >= 0.7 ? "#f59e0b" : "#38bdf8";
const PLANET_OUTPUT = [
  {planet: "thalassa", resource: "biomass"},
  {planet: "aeros", resource: "cryo"},   // Coolant
  {planet: "ferrum", resource: "alloys"},
  {planet: "kryos", resource: "compute"},
];
const planetName = (id) => GAME_GALAXY.planets.find((p) => p.id === id)?.name ?? id;
const planetIndex = (id) => GAME_GALAXY.planets.findIndex((p) => p.id === id);

// The live session. The kernel is loaded once by GameApp and passed in; each session starts it from zero.
// session: {key, seed, difficulty, save}. A save (a record from saveManager) restores the sector instead of starting it.
function GameSession({kernel, session, onRestart, onLoad, onQuit}) {
  const canvasRef = useRef(null), overlayRef = useRef(null), appRef = useRef(null);
  const st = useRef(newState());
  const u = useRef({drag: null, mode: null, msg: START_MSG, msgWin: false, paused: false, speed: 1, tick: 0, shipyard: false, armory: false, comms: false, governor: null, tech: false, senate: false, arm: null, hover: null, pointer: null, menu: false, confirm: null, autosaveAt: -1e9, fps: 0, selected: null, briefing: !!session.tutorial});
  const [ui, setUi] = useState({...u.current});
  const refresh = () => setUi({...u.current});
  const difficulty = DIFFICULTIES[session.difficulty] ?? DIFFICULTIES.commander;

  useEffect(() => {
    const scene = new OrbitScene(canvasRef.current, {}, {galaxies: {game: GAME_GALAXY}, galaxyId: "game"});
    scene.zoomBy(0.8); // frame all four orbits clear of the telemetry panel and the dock
    const ov = overlayRef.current, ctx = ov.getContext("2d");
    const s0 = u.current;
    let raf = 0, lastUi = 0, lastGame = -1;

    // The simulation kernel is the source of truth for planet positions. It ticks to match the
    // game clock (sim.c[5], seconds) so pause and speed controls still apply.
    let kBase = null;
    // A new sector starts at its seeded offset; a save is replayed from its log and the game state put back.
    if (session.save) {
      const r = kernel.importState(session.save.kernel);
      if (!r.ok) console.warn("Save restored with planet drift", r.drift);
      st.current = {...newState(), ...session.save.state};
    } else {
      kernel.beginAt(seedOffset(session.seed));
    }
    scene.orbitScale = getSettings().orbitOpacity / 35;
    const syncKernel = () => {
      if (!kernel || !scene.sim) return false;
      const gameT = scene.sim.c[5];
      // the kernel is already at its start (or save) tick, so the game clock is pinned to that tick
      if (kBase === null) kBase = gameT - kernel.tickCount / TICKS_PER_SECOND;
      const n = Math.floor((gameT - kBase) * TICKS_PER_SECOND) - kernel.tickCount;
      if (n > 0) kernel.tick(n);
      return true;
    };
    scene.positionSource = () => (syncKernel() ? GAME_GALAXY.planets.map((_, i) => ({x: kernel.planets.x[i], y: kernel.planets.y[i]})) : null);

    const sizeOverlay = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvasRef.current.clientWidth, h = canvasRef.current.clientHeight;
      ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr);
      ov.style.width = w + "px"; ov.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeOverlay();
    window.addEventListener("resize", sizeOverlay);

    const say = (text, win = false) => { s0.msg = text; s0.msgWin = win; };
    const toWorld = (e) => {
      const r = ov.getBoundingClientRect(), c = scene.sim.c, zb = c[4] * scene.base;
      return {x: c[2] + (e.clientX - r.left - c[0]) / zb, y: c[3] + (e.clientY - r.top - c[1]) / zb};
    };
    const positions = () => {
      const sim = scene.sim;
      if (!sim) return null;
      const P = {core: {x: 0, y: 0}, ark: ARK_POS};
      GAME_GALAXY.planets.forEach((p, i) => { const o = i * BODY_STRIDE; P[p.id] = {x: sim.b[o + 10], y: sim.b[o + 11]}; });
      for (const r of st.current.relays) P[r.id] = {x: r.x, y: r.y};
      return P;
    };

    // Builds a player conduit between two planets through the kernel. Costs alloys like a tether.
    const buildConduit = (from, to) => {
      const cost = RULES.COST.tether.alloys;
      if (st.current.alloys < cost) { say(`Need ${cost} alloys for a conduit.`); return; }
      const code = kernel.addConduit(planetIndex(from), planetIndex(to));
      if (code >= 0) {
        st.current.alloys -= cost;
        snapSeen.clear();
        say(`Conduit built: ${planetName(from)} to ${planetName(to)}.`);
      } else {
        say(CONDUIT_MSG[code] ?? "The conduit could not be built.");
      }
    };
    // Index of the player conduit under a world point, or -1.
    const conduitAt = (P, pt) => {
      let best = -1, bd = 10;
      for (let c = 0; c < kernel.conduitCount; c++) {
        const A = P[GAME_GALAXY.planets[kernel.conduits.source[c]].id], B = P[GAME_GALAXY.planets[kernel.conduits.target[c]].id];
        if (!A || !B) continue;
        const d = distToTether(pt, A, B);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    };
    // Live feedback while dragging between worlds: red when the line would be too long.
    const previewConduit = (P, from, to) => {
      const A = P[from], B = P[to];
      if (Math.hypot(B.x - A.x, B.y - A.y) > CONDUIT_RULES.maxLength) return "too far";
      // the dying star blocks the line when the segment passes through its disc
      const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, -(A.x * dx + A.y * dy) / L2)) : 0;
      const px = A.x + dx * t, py = A.y + dy * t, R = kernel.starRadius;
      return px * px + py * py <= R * R ? "shadow" : null;
    };
    const snapSeen = new Set();
    // Kernel totals already paid into the stockpiles. A restored save starts from its own totals, so the
    // replayed history is not paid out a second time.
    const gainSeen = PLANET_OUTPUT.map((o) => kernel.planets.gainTotal[planetIndex(o.planet)]);
    let creditSeen = kernel.creditTotal;         // kernel credit total already credited
    let buildTick = kernel.tickCount;            // kernel tick up to which structure income has been paid

    const onDown = (e) => {
      if (e.button !== 0) return;
      const P = positions(); if (!P) return;
      const p = toWorld(e);
      if (s0.mode === "relay" || s0.mode === "repair") {
        const res = build(st.current, s0.mode, p, P);
        say(res.msg);
        if (res.ok) s0.mode = null;
        refresh();
        return;
      }
      if (s0.mode === "cut") {
        const i = tetherAt(st.current, P, p);
        if (i >= 0) { const r = cut(st.current, i); say(r.msg); }
        else {
          const c = conduitAt(P, p);
          if (c < 0) say("Click right on a tether to decouple it.");
          else { kernel.removeConduit(c); snapSeen.clear(); say("Conduit decoupled."); }
        }
        refresh();
        return;
      }
      if (s0.arm) {
        const W = ARMORY.find((a) => a.key === s0.arm);
        const id = hitBody(st.current, P, p);
        const valid = id && (W.target === "core" ? id === "core" : isPlanet(id));
        if (!valid) { say(`Click ${W.target === "core" ? "Sol Core" : "a world"} to target ${W.name}. Esc cancels.`); refresh(); return; }
        const doFire = () => {
          const r = fireWeapon(st.current, W.type);
          if (!r.ok) { s0.arm = null; say(r.msg); refresh(); return; }
          if (W.target !== "core" && interceptAt(st.current, id)) {
            st.current.flashes.push({x: P[id].x, y: P[id].y, t: performance.now()});
            say(`A ship in orbit around ${planetName(id)} intercepted the ${W.name}.`, true);
            s0.arm = null; refresh();
            return;
          }
          if (W.target !== "core" && absorbStrike(st.current, id)) {
            // a barrier intercepts the strike: the shot never reaches the world, the shield is spent
            st.current.flashes.push({x: P[id].x, y: P[id].y, t: performance.now()});
            say(`${planetName(id)}'s barrier shield absorbed the ${W.name}.`, true);
            s0.arm = null; refresh();
            return;
          }
          const f = P.ferrum;
          kernel.launch(W.type, f.x, f.y, W.target === "core" ? -1 : planetIndex(id));
          s0.arm = null;
          say(`${W.name} launched at ${W.target === "core" ? "Sol Core" : planetName(id)}.`, true);
          refresh();
        };
        if (getSettings().confirmSuperweapon) {
          const cost = Object.entries(W.cost).map(([k, v]) => `${v} ${COST_LABEL[k]}`).join(" · ");
          s0.confirm = {text: `${W.name} at ${W.target === "core" ? "Sol Core" : planetName(id)}. Costs ${cost}.`, run: doFire};
          refresh();
          return;
        }
        doFire();
        return;
      }
      const zb = scene.sim.c[4] * scene.base;
      const picked = st.current.fleet.find((f) => { const q = shipPosition(f, P); return Math.hypot(q.x - p.x, q.y - p.y) <= 16 / zb; });
      if (picked) { s0.selected = picked.id; say(`${SHIPS[picked.type].name} selected. Right-click a world to send it.`); refresh(); return; }
      const id = hitBody(st.current, P, p);
      if (id) s0.drag = {from: id, cur: p, start: p};
      else if (s0.selected != null) { s0.selected = null; say("Ship deselected."); refresh(); }
      ov.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (s0.drag) s0.drag.cur = toWorld(e);
      const r = ov.getBoundingClientRect();
      s0.pointer = {x: e.clientX - r.left, y: e.clientY - r.top};
      if (s0.arm) { const P = positions(); s0.hover = P ? hitBody(st.current, P, toWorld(e)) : null; }
    };
    const onUp = () => {
      const P = positions();
      if (s0.drag && P) {
        const target = hitBody(st.current, P, s0.drag.cur);
        if (target && target !== s0.drag.from) {
          if (isPlanet(s0.drag.from) && isPlanet(target)) buildConduit(s0.drag.from, target);
          else { const r = tryTether(st.current, s0.drag.from, target, P); say(r.msg); }
        } else if (isPlanet(s0.drag.from) && Math.hypot(s0.drag.cur.x - s0.drag.start.x, s0.drag.cur.y - s0.drag.start.y) < 4) {
          // a click without a drag opens the world's Colony Governor
          s0.governor = s0.drag.from; refresh();
        }
      }
      s0.drag = null;
    };
    const liveConduits = () => {
      const out = [];
      if (kernel) for (let c = 0; c < kernel.conduitCount; c++) out.push({a: GAME_GALAXY.planets[kernel.conduits.source[c]].id, b: GAME_GALAXY.planets[kernel.conduits.target[c]].id, snapped: !!kernel.conduits.snapped[c]});
      return out;
    };
    const onCtx = (e) => {
      e.preventDefault();
      const P = positions(); if (!P || s0.selected == null) return;
      const ship = st.current.fleet.find((f) => f.id === s0.selected);
      if (!ship) { s0.selected = null; refresh(); return; }
      const id = hitBody(st.current, P, toWorld(e));
      if (!id || !isPlanet(id)) { say("Right-click a world to send the selected ship."); refresh(); return; }
      const r = sendShip(st.current, ship, id, P, liveConduits(), planetName(id));
      say(r.msg, r.ok); refresh();
    };
    ov.addEventListener("contextmenu", onCtx);
    ov.addEventListener("pointerdown", onDown);
    ov.addEventListener("pointermove", onMove);
    ov.addEventListener("pointerup", onUp);
    ov.addEventListener("pointercancel", onUp);

    const drawOverlay = (P, now) => {
      const s = st.current, w = ov.clientWidth, h = ov.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const toS = (p) => scene.toScreen(p.x, p.y);

      // tethers, coloured by tension
      for (const t of s.tethers) {
        if (!P[t.a] || !P[t.b]) continue;
        const a = toS(P[t.a]), b = toS(P[t.b]), ratio = tensionOf(t, P), col = tensionColor(ratio);
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.shadowColor = col; ctx.shadowBlur = ratio >= 0.8 ? 14 : 4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.shadowBlur = 0;
        const m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
        ctx.font = "11px system-ui"; ctx.fillStyle = col; ctx.textAlign = "center";
        ctx.fillText(`${Math.round(ratio * 100)}%`, m.x, m.y - 6);
      }

      // player conduits, read from the kernel: amber when stretched, red when snapped, dimmed in the star's shadow
      if (kernel) {
        for (let c = 0; c < kernel.conduitCount; c++) {
          const A = P[GAME_GALAXY.planets[kernel.conduits.source[c]].id], B = P[GAME_GALAXY.planets[kernel.conduits.target[c]].id];
          if (!A || !B) continue;
          const a = toS(A), b = toS(B), len = kernel.conduits.length[c];
          const snapped = !!kernel.conduits.snapped[c], occluded = !!kernel.conduits.occluded[c];
          const ratio = len / (kernel.conduits.maxLength[c] || CONDUIT_RULES.maxLength);
          const col = snapped ? "#EF4444" : occluded ? "rgba(148,163,184,0.35)" : tensionTone(ratio, now);
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(snapped ? [4, 6] : []);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
          const m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
          ctx.font = "11px system-ui"; ctx.fillStyle = col; ctx.textAlign = "center";
          ctx.fillText(snapped ? "snapped" : occluded ? "in shadow" : ratio >= 0.7 ? `TENSION: ${Math.round(ratio * 100)}%` : `${Math.round(kernel.conduits.throughput[c])} flow · ${Math.round(len)}u`, m.x, m.y - 6);
        }
      }

      // drag preview: green when the transfer window is open, red when not
      if (s0.drag && P[s0.drag.from]) {
        const t = hitBody(s, P, s0.drag.cur);
        const err = !t || t === s0.drag.from ? "no target"
          : isPlanet(t) && isPlanet(s0.drag.from) ? previewConduit(P, s0.drag.from, t)
          : checkTether(s, s0.drag.from, t, P);
        const a = toS(P[s0.drag.from]), b = toS(s0.drag.cur);
        if (err === "shadow") {
          // dimmed line plus a red crosshair on the star, so the eclipse shows before release
          ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(239,68,68,0.35)";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
          const sun = toS({x: 0, y: 0}), r = 14;
          ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sun.x, sun.y, r, 0, Math.PI * 2);
          ctx.moveTo(sun.x - r - 6, sun.y); ctx.lineTo(sun.x + r + 6, sun.y);
          ctx.moveTo(sun.x, sun.y - r - 6); ctx.lineTo(sun.x, sun.y + r + 6); ctx.stroke();
        } else {
          ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = err ? "#ef4444" : "#10B981";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // whiplash flashes
      s.flashes = s.flashes.filter((f) => now - f.t < 700);
      for (const f of s.flashes) {
        const q = toS(f), k = (now - f.t) / 700;
        ctx.strokeStyle = `rgba(255,190,90,${(1 - k).toFixed(3)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(q.x, q.y, (10 + 50 * k) * scene.base, 0, Math.PI * 2); ctx.stroke();
      }

      // kernel projectiles and debris
      if (kernel) {
        for (let m = 0; m < kernel.missileCount; m++) {
          if (!kernel.missiles.active[m]) continue;
          const q = toS({x: kernel.missiles.x[m], y: kernel.missiles.y[m]});
          const ti = kernel.missiles.target[m], tp = ti >= 0 ? P[GAME_GALAXY.planets[ti].id] : P.core;
          if (tp) {
            const tq = toS(tp);
            ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(255,90,90,0.5)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(tq.x, tq.y); ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.fillStyle = kernel.missiles.type[m] === WEAPON.STARKILLER ? "#ff3b3b" : "#ffb35a";
          ctx.beginPath(); ctx.arc(q.x, q.y, 3 + scene.base, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(160,160,170,0.8)";
        for (let a = 0; a < kernel.asteroidCount; a++) {
          const q = toS({x: kernel.asteroids.x[a], y: kernel.asteroids.y[a]});
          ctx.fillRect(q.x, q.y, 2, 2);
        }
      }

      // Armory: cataclysm states read from the kernel, plus targeting feedback
      if (kernel) {
        const t = now / 1000;
        const pxAt = (p, wr) => Math.abs(toS({x: p.x + wr, y: p.y}).x - toS(p).x);
        // World-Cracker: a drill within reach of its target lays magma fissures across it
        for (let m = 0; m < kernel.missileCount; m++) {
          if (!kernel.missiles.active[m] || kernel.missiles.type[m] !== WEAPON.CRACKER_DRILL) continue;
          const ti = kernel.missiles.target[m];
          if (ti < 0) continue;
          const tp = P[GAME_GALAXY.planets[ti].id];
          if (tp && Math.hypot(tp.x - kernel.missiles.x[m], tp.y - kernel.missiles.y[m]) <= DRILL_CRACK_DISTANCE) {
            const q = toS(tp); drawMagma(ctx, q.x, q.y, pxAt(tp, 11), t);
          }
        }
        // world states
        GAME_GALAXY.planets.forEach((p, i) => {
          const tp = P[p.id]; if (!tp) return;
          const status = kernel.planets.status[i], q = toS(tp), R = pxAt(tp, 11);
          if (status === WORLD.GLASSED) drawIrradiated(ctx, q.x, q.y, R, t);
          else if (status === WORLD.FRACTURED) {
            ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(160,160,170,0.6)"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(q.x, q.y, R * 2.2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          } else if (status === WORLD.BLACK_HOLE) {
            drawBlackHole(ctx, q.x, q.y, R, t, pxAt(tp, VORTEX.radius), kernel.planets.vortexTicks[i]);
          }
        });
        // star states: supernova blast ring, then the collapsed black hole
        const sun = toS({x: 0, y: 0});
        if (kernel.starCollapsed) drawBlackHole(ctx, sun.x, sun.y, pxAt({x: 0, y: 0}, STAR_COLLAPSE.collapsedRadius), t);
        else if (kernel.starSupernova && kernel.starBlastTicks > 0) {
          const progress = 1 - kernel.starBlastTicks / STAR_COLLAPSE.ringTicks;
          drawSupernova(ctx, sun.x, sun.y, pxAt({x: 0, y: 0}, kernel.starRadius), pxAt({x: 0, y: 0}, 160), progress);
        }
      }
      // targeting: red cage on a valid target under the pointer, and a reticle that follows the pointer
      if (s0.arm) {
        const W = ARMORY.find((a) => a.key === s0.arm);
        const hv = s0.hover, valid = !!hv && (W.target === "core" ? hv === "core" : isPlanet(hv));
        if (valid && P[hv]) {
          const tp = P[hv], q = toS(tp);
          drawCage(ctx, q.x, q.y, Math.abs(toS({x: tp.x + (hv === "core" ? kernel.starRadius : 11), y: tp.y}).x - q.x));
        }
        if (s0.pointer) {
          const {x, y} = s0.pointer;
          ctx.strokeStyle = valid ? "#ef4444" : "rgba(239,68,68,0.6)"; ctx.lineWidth = 1.5; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = valid ? 8 : 0;
          ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 14, y);
          ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 14); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // ships: vector hulls flying the map; the selected ship gets a ring and a nav vector to its target
      if (s.fleet.length) {
        const tt = now / 1000;
        for (const f of s.fleet) {
          const q = toS(shipPosition(f, P));
          drawShip(ctx, f.type, q.x, q.y, f.heading ?? 0, {thrust: f.thrust ?? 0, t: tt, length: FLIGHT_LENGTH[f.type]});
          if (f.id === s0.selected) {
            ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.arc(q.x, q.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            const T = f.to && P[f.to];
            if (T && (f.mode === "transit" || f.mode === "surf")) {
              const tq = toS(T); ctx.strokeStyle = "rgba(56,189,248,0.6)"; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(tq.x, tq.y); ctx.stroke();
            }
          }
        }
      }

      // Ark, relays, labels
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const ark = toS(ARK_POS);
      drawArk(ctx, ark.x, ark.y);
      ctx.font = "12px system-ui"; ctx.fillStyle = "#cfd8e6"; ctx.fillText("Ark Endeavor", ark.x, ark.y - 20);
      for (const r of s.relays) {
        const q = toS(r);
        drawRelay(ctx, q.x, q.y);
        ctx.font = "10px system-ui"; ctx.fillStyle = r.hp < 15 ? "#ff8a8a" : "#9fb3cc"; ctx.fillText(`${Math.max(0, Math.round(r.hp))}`, q.x, q.y + 14);
      }
      ctx.font = "12px system-ui"; ctx.fillStyle = "#cfd8e6";
      for (const p of GAME_GALAXY.planets) { const q = toS(P[p.id]); ctx.fillText(p.name, q.x, q.y - 22); }
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    };

    let fleetTick = -1, prevP = {};
    let frames = 0, fpsT = performance.now(), prevStatus = null, lastAutosave = performance.now();
    const loop = (now) => {
      frames += 1;
      if (now - fpsT >= 1000) { s0.fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
      const sim = scene.sim, P = positions();
      if (P && sim) {
        const s = st.current, gameT = sim.c[5];
        if (lastGame < 0) { lastGame = Math.floor(gameT); s.lastTick = lastGame; }
        for (const msg of snapTethers(s, P, now)) say(msg);
        if (kernel) {
          if (fleetTick < 0) fleetTick = kernel.tickCount;
          const dt = kernel.tickCount - fleetTick;
          if (dt > 0) {
            const vel = {};
            for (const id of Object.keys(P)) if (prevP[id]) vel[id] = {x: (P[id].x - prevP[id].x) / dt, y: (P[id].y - prevP[id].y) / dt};
            stepFleet(s, P, dt, {conduits: liveConduits(), velocity: vel});
            fleetTick = kernel.tickCount;
            prevP = Object.fromEntries(Object.keys(P).map((id) => [id, {x: P[id].x, y: P[id].y}]));
          }
        }
        if (kernel) {
          const total = kernel.creditTotal, d = total - creditSeen;
          if (d > 0) { s.credits += d * difficulty.income; creditSeen = total; }
        }
        // Siphoning: the kernel adds each world's output to its running total every tick; credit the difference.
        // High-Tensile Beams: each conduit's snap limit follows the researched perk
        if (kernel) {
          const want = CONDUIT_RULES.maxLength + perks(s).conduitBonus;
          for (let c = 0; c < kernel.conduitCount; c++) if (kernel.conduits.maxLength[c] !== want) kernel.setConduitMaxLength(c, want);
        }
        // Colony structures pay their rate per second while their world is connected to a conduit
        if (kernel) {
          const dt = kernel.tickCount - buildTick;
          buildTick = kernel.tickCount;
          const pz = perks(s), fpMult = s.senate?.effects?.freeportMult ?? 1;
          if (dt > 0) GAME_GALAXY.planets.forEach((p) => {
            const idx = planetIndex(p.id);
            if (kernel.planets.flow[idx] > 0) {
              for (const key of infraOf(s, p.id)) {
                const d = INFRA.find((x) => x.key === key);
                if (d.resource) s[d.resource] += d.rate * dt / TICKS_PER_SECOND * (key === "freeport" ? fpMult : 1) * difficulty.income;
              }
            } else if (pz.occlusionShare > 0) {
              // Phase Plating: a world shadowed by the sun still earns part of its output
              let shadowed = false;
              for (let c = 0; c < kernel.conduitCount; c++) {
                if ((kernel.conduits.source[c] === idx || kernel.conduits.target[c] === idx) && kernel.conduits.occluded[c]) shadowed = true;
              }
              const out = PLANET_OUTPUT.find((o) => o.planet === p.id);
              if (shadowed) s[out.resource] += PLANET_DEFS.find((d) => d.key === p.id).yield * pz.occlusionShare * dt / TICKS_PER_SECOND;
            }
          });
        }
        if (kernel) PLANET_OUTPUT.forEach((o, i) => {
          const idx = planetIndex(o.planet), total = kernel.planets.gainTotal[idx], d = total - gainSeen[i];
          if (d > 0) { s[o.resource] += d * difficulty.income; gainSeen[i] = total; }
        });
        if (kernel) for (let c = 0; c < kernel.conduitCount; c++) {
          if (kernel.conduits.snapped[c] && !snapSeen.has(c)) {
            snapSeen.add(c);
            const from = GAME_GALAXY.planets[kernel.conduits.source[c]].id, to = GAME_GALAXY.planets[kernel.conduits.target[c]].id;
            say(`Conduit snapped: ${planetName(from)} to ${planetName(to)}.`);
          }
        }
        while (Math.floor(gameT) > s.lastTick && !s.won && !s.lost) {
          s.lastTick += 1;
          s.elapsed += 1;
          if (s.elapsed >= s.senate.next) convene();
          for (const ev of tick(s, P)) say(ev.msg, !!ev.win);
        }
        // credits earned this match: only increases count, so spending does not reduce it
        if (s.creditsSeen == null) s.creditsSeen = s.credits;
        if (s.credits > s.creditsSeen) s.earned += s.credits - s.creditsSeen;
        s.creditsSeen = s.credits;
        if (kernel && !s.victory) {
          const planets = GAME_GALAXY.planets.map((p, i) => ({id: p.id, status: kernel.planets.status[i]}));
          const conduits = [];
          for (let c = 0; c < kernel.conduitCount; c++) conduits.push({source: kernel.conduits.source[c], target: kernel.conduits.target[c], snapped: !!kernel.conduits.snapped[c]});
          const v = checkVictory(s, planets, conduits);
          if (v) {
            const summary = {
              seconds: s.elapsed, credits: Math.floor(s.earned),
              intact: planets.filter((p) => p.status === 0).length, total: planets.length,
              fleetPower: Math.round(fleetPower(s.fleet) * perks(s).fleetMult * 10) / 10,
            };
            s.victory = {key: v, ...VICTORIES[v], summary};
            s.victoryAck = false; say(`Victory: ${VICTORIES[v].title}.`, true); refresh();
          }
        }
        // a world struck from pristine shakes the screen (Settings: None / Subtle / Heavy)
        if (kernel) {
          const n = kernel.planetCount;
          let struck = false;
          if (prevStatus) for (let i = 0; i < n; i++) if (prevStatus[i] === 0 && kernel.planets.status[i] !== 0) struck = true;
          prevStatus = Uint8Array.from(kernel.planets.status.subarray(0, n));
          if (struck && getSettings().shake !== "none" && appRef.current) {
            appRef.current.classList.remove("shake"); void appRef.current.offsetWidth; appRef.current.classList.add("shake");
            setTimeout(() => appRef.current?.classList.remove("shake"), 450);
          }
        }
        // autosave on the Settings interval (0 turns it off)
        const cfg = getSettings();
        if (cfg.autosave > 0 && now - lastAutosave >= cfg.autosave * 1000) {
          lastAutosave = now;
          if (persist("autosave")) s0.autosaveAt = now;
        }
        if (s.won || s.lost) scene.speed = 0;
        drawOverlay(P, now);
        s0.tick = Math.floor(gameT);
        if (now - lastUi > 150) { lastUi = now; setUi({...s0}); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const setSpeedKey = (v) => { s0.speed = v; s0.paused = false; applySpeed(); refresh(); };
    const onKey = (e) => {
      if (e.key === "Escape") {
        // Esc backs out of the innermost thing first, and only then opens the pause menu
        if (s0.confirm) { s0.confirm = null; s0.arm = null; say("Strike cancelled."); }
        else if (s0.menu) closeMenu();
        else if (s0.arm) { s0.arm = null; say("Targeting cancelled."); }
        else if (s0.governor) s0.governor = null;
        else openMenu();
        refresh();
        return;
      }
      if (s0.menu) return;
      if (e.key === "F5") { e.preventDefault(); persist("quicksave", "Quick save made."); }
      if (e.key === "F9") {
        e.preventDefault();
        const data = loadGame("quicksave");
        if (data) onLoad(data); else { say("No quick save yet. Press F5 during a campaign to make one."); refresh(); }
      }
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.key === "1" || e.key === "2" || e.key === "4") setSpeedKey(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    // Settings: pause when the window loses focus; resume when it comes back if we paused it
    const onBlur = () => {
      if (getSettings().pauseOnDefocus && !s0.paused && !s0.menu && !st.current.won && !st.current.lost) {
        s0.paused = true; s0.blurPaused = true; applySpeed(); refresh();
      }
    };
    const onFocus = () => { if (s0.blurPaused) { s0.blurPaused = false; s0.paused = false; applySpeed(); refresh(); } };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.__relic = {scene, u: s0, st, say, refresh, get kernel() { return kernel; }, resetKernel: () => { kernel.reset(); kBase = null; gainSeen.fill(0); creditSeen = 0; buildTick = 0; snapSeen.clear(); }};
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sizeOverlay);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      ov.removeEventListener("contextmenu", onCtx);
      ov.removeEventListener("pointerdown", onDown);
      ov.removeEventListener("pointermove", onMove);
      ov.removeEventListener("pointerup", onUp);
      ov.removeEventListener("pointercancel", onUp);
      scene.destroy();
      delete window.__relic;
    };
  }, []);

  function togglePause() {
    if (!window.__relic?.scene || st.current.won || st.current.lost || u.current.menu) return;
    u.current.paused = !u.current.paused;
    applySpeed();
    refresh();
  }
  // The sim runs at the chosen speed only when nothing holds it: the pause button, the pause menu, a finished match.
  function applySpeed() {
    const sc = window.__relic?.scene; if (!sc) return;
    const cur = u.current, over = st.current.won || st.current.lost;
    sc.speed = cur.paused || cur.menu || cur.briefing || over ? 0 : cur.speed;
  }
  function dismissBriefing() { u.current.briefing = false; applySpeed(); refresh(); }
  function openMenu() { if (u.current.menu) return; u.current.menu = true; applySpeed(); refresh(); }
  function closeMenu() { u.current.menu = false; applySpeed(); refresh(); }
  function syncSettings() { const sc = window.__relic?.scene; if (sc) sc.orbitScale = getSettings().orbitOpacity / 35; refresh(); }
  function notify(text, win = false) { u.current.msg = text; u.current.msgWin = win; refresh(); }
  // Writes the live game to a slot. Manual saves say so; autosaves stay quiet. Returns whether it stuck.
  function persist(slot, text) {
    const ok = !!saveGame(slot, {kernel, state: st.current, seed: session.seed, difficulty: session.difficulty});
    if (text) notify(ok ? text : "Save failed: browser storage is unavailable.", ok);
    return ok;
  }
  function runStrike() { const c = u.current.confirm; u.current.confirm = null; c?.run(); refresh(); }
  function cancelStrike() { u.current.confirm = null; u.current.arm = null; notify("Strike cancelled."); }
  function toggleShipyard() { u.current.shipyard = !u.current.shipyard; u.current.armory = false; refresh(); }
  function toggleArmory() { u.current.armory = !u.current.armory; u.current.shipyard = false; refresh(); }
  function toggleTech() { u.current.tech = !u.current.tech; u.current.shipyard = false; u.current.armory = false; refresh(); }
  function researchNow(key) { const r = researchTech(st.current, key); u.current.msg = r.msg; refresh(); }
  function convene() {
    const s = st.current, sess = runSession(s, s.senate.count);
    s.senate.count += 1;
    s.senate.current = sess;
    s.senate.next = s.elapsed + SESSION_SECONDS;
    s.senate.dismissed = false;
    // a floating banner so the outcome shows even with the chamber closed
    u.current.senateToast = {text: `Senate ${sess.passed ? "passed" : "rejected"}: ${sess.resolution.title}`, passed: sess.passed, id: s.senate.count};
    clearTimeout(u.current.toastTimer);
    u.current.toastTimer = setTimeout(() => { u.current.senateToast = null; refresh(); }, 6000);
    refresh();
  }
  function openSenate() { st.current.senate.dismissed = true; u.current.senate = true; refresh(); }
  function closeSenate() { u.current.senate = false; refresh(); }
  function keepPlaying() { st.current.victoryAck = true; refresh(); }
  function toggleComms() {
    u.current.comms = !u.current.comms;
    if (u.current.comms) openComms(st.current, st.current.comms.selected); // first visit shows the leader's opener
    refresh();
  }
  function govBuild(key) { const r = buildInfra(st.current, u.current.governor, key); u.current.msg = r.msg; refresh(); }
  function closeGovernor() { u.current.governor = null; refresh(); }
  function commsOpen(id) { openComms(st.current, id); refresh(); }
  function commsChoose(key) { const r = applyChoice(st.current, st.current.comms.selected, key); u.current.msg = r.msg; refresh(); }
  // Why a strategic weapon cannot be armed right now, or null.
  function weaponBlock(s, W) {
    if (W.type === 2 && s.senate?.effects?.starkillerBanned) return "Banned by the Senate this session.";
    if (s.spent[W.type]) return `${W.name} is spent for this match.`;
    const r = Math.ceil(s.reload[W.type] ?? 0);
    if (r > 0) return `${W.name} reloads in ${r}s.`;
    const short = shortfall(s, W.cost);
    return short ? `${W.name} needs ${short}.` : null;
  }
  function armWeapon(key) {
    const W = ARMORY.find((a) => a.key === key);
    const why = weaponBlock(st.current, W);
    if (why) { u.current.msg = why; refresh(); return; }
    u.current.arm = key; u.current.mode = null;
    u.current.msg = `Targeting ${W.name}: click ${W.target === "core" ? "Sol Core" : "a world"}. Esc cancels.`;
    refresh();
  }
  function buildHull(type) { const r = orderShip(st.current, type); u.current.msg = r.msg; refresh(); }
  function setSpeed(v) {
    u.current.speed = v; u.current.paused = false;
    applySpeed();
    refresh();
  }
  function setMode(m) {
    u.current.mode = u.current.mode === m ? null : m;
    u.current.arm = null;
    const txt = {relay: "Click the map to place a relay satellite.", repair: "Click anywhere to confirm the hull patch.", cut: "Click a tether to decouple it safely."};
    u.current.msg = u.current.mode ? txt[u.current.mode] : "Cancelled.";
    refresh();
  }
  function repairNow() {
    const P = window.__relic?.scene ? null : null;
    const r = build(st.current, "repair", {x: 0, y: 0}, P || {});
    u.current.msg = r.msg; refresh();
  }
  // Restart is a fresh sector with the same seed and difficulty: a new session, so kernel and scene start clean.
  function restart() { onRestart(); }

  const s = st.current;
  const over = s.won || s.lost;
  const yr = s.year || 1;
  const radiationLabel = ["Low", "Rising", "High", "Severe", "Critical"][Math.min(4, Math.max(0, s.radiation))];
  return (
    <div className="app" ref={appRef}>
      <canvas ref={canvasRef} className="stage" />
      <canvas ref={overlayRef} className="stage" style={{pointerEvents: "auto", cursor: u.current.arm ? "none" : u.current.mode ? "crosshair" : "default"}} />

      <div className="brand glass">
        <div className="brand-kicker mono">ORBITER: STELLAR CONQUEST · MISSION TELEMETRY</div>
        <div className="row"><span><Icon name="credits" /> Credits</span><b>{Math.floor(s.credits)}</b></div>
        <div className="row"><span><Icon name="biomass" /> Biomass</span><b>{Math.floor(s.biomass)}</b></div>
        <div className="row"><span><Icon name="alloys" /> Alloys</span><b>{Math.floor(s.alloys)}</b></div>
        <div className="row"><span><Icon name="compute" /> Compute <button className="pill zelo" style={{padding: "0 6px", marginLeft: 4}} title="Orbital Tech Web" onClick={toggleTech}><Icon name="tech" /></button></span><b>{Math.floor(s.compute)}</b></div>
        <div className="row"><span><Icon name="coolant" /> Coolant</span><b>{Math.floor(s.cryo)}</b></div>
        <div className="row"><span><Icon name="fleet" /> Fleet</span><b>{s.fleet.length}</b></div>
        <div className="row"><span><Icon name="power" /> Fleet power</span><b>{Math.round(fleetPower(s.fleet) * perks(s).fleetMult * 10) / 10}</b></div>
        <div className="row"><span><Icon name="hull" /> Hull</span><b>{Math.max(0, Math.round(s.hull))}%</b></div>
        <div className="row"><span><Icon name="fuel" /> Fuel</span><b>{Math.floor(s.fuel)}</b></div>
        <div className="row"><span><Icon name="propellant" /> Propellant</span><b>{Math.floor(s.propellant)}</b></div>
        <div className="row"><span><Icon name="singularity" /> Singularity data</span><b>{Math.floor(s.data)} / {RULES.DATA_GOAL}</b></div>
        <div className="row"><span><Icon name="radiation" /> Radiation</span><b>{radiationLabel}</b></div>
        <div className="row"><span>Year</span><b>{yr}</b></div>
        {getSettings().fps ? <div className="row"><span>Frame rate</span><b>{u.current.fps} fps</b></div> : null}
      </div>

      <div className="top-right" style={{gap: 8}}>
        <button className="pill glass zelo" title="Menu (Esc)" aria-label="Menu" onClick={openMenu}><Icon name="gear" /></button>
        <button className="pill glass zelo" onClick={togglePause}>{u.current.paused ? "Resume" : "Pause"}</button>
        {[1, 2, 4].map((v) => (
          <button key={v} className={"pill glass zelo" + (u.current.speed === v && !u.current.paused ? " on" : "")} onClick={() => setSpeed(v)}>{v}x</button>
        ))}
        <button className="pill glass zelo" onClick={restart}>Restart</button>
      </div>

      {u.current.msg ? <div className={"toast glass" + (u.current.msgWin ? " win" : "")} style={{top: 60, pointerEvents: "none", maxWidth: 300, textAlign: "center", whiteSpace: "normal"}}>{u.current.msg}</div> : null}

      <footer className="dock glass" style={{flexWrap: "wrap", gap: 6, justifyContent: "center"}}>
        <button className={"pill zelo" + (u.current.mode === "relay" ? " on" : "")} onClick={() => setMode("relay")}><Icon name="relay" /> Relay satellite · 15 Alloys · 5 Coolant</button>
        <button className={"pill zelo" + (u.current.mode === "repair" ? " on" : "")} onClick={() => setMode("repair")}><Icon name="repair" /> Patch hull · 10 Alloys</button>
        <button className={"pill zelo" + (u.current.mode === "cut" ? " on" : "")} onClick={() => setMode("cut")}><Icon name="cut" /> Decouple tether</button>
        <button className={"pill zelo" + (u.current.shipyard ? " on" : "")} onClick={toggleShipyard}><Icon name="shipyard" /> Shipyard</button>
        <button className={"pill zelo" + (u.current.armory ? " on" : "")} onClick={toggleArmory}><Icon name="armory" /> Armory</button>
        <button className={"pill zelo" + (u.current.comms ? " on" : "")} onClick={toggleComms}><Icon name="comms" /> Comms</button>
        <button className={"pill zelo" + (s.senate.dismissed ? "" : " flash-alert")} onClick={openSenate}><Icon name="senate" /> Senate</button>
      </footer>

      {u.current.governor ? (() => {
        const id = u.current.governor, idx = planetIndex(id), def = PLANET_DEFS.find((p) => p.key === id);
        const out = PLANET_OUTPUT.find((o) => o.planet === id);
        return <GovernorPanel s={s} kernel={kernel} planet={GAME_GALAXY.planets[idx]} idx={idx} base={def.yield}
          outputLabel={out.resource} onBuild={govBuild} onClose={closeGovernor} />;
      })() : null}

      {u.current.tech ? <TechWeb s={s} onResearch={researchNow} onClose={toggleTech} /> : null}
      {u.current.senate && s.senate.current ? <SenateChamber s={s} onClose={closeSenate} /> : null}
      {performance.now() - u.current.autosaveAt < 1500 ? <div className="autosave-tag mono">AUTOSAVING…</div> : null}
      {u.current.confirm ? (
        <div className="overlay" style={{zIndex: 35}}>
          <div className="sheet small glass" style={{padding: 20, gap: 12}}>
            <b>Confirm strategic strike</b>
            <p style={{margin: 0, fontSize: 13}}>{u.current.confirm.text} Launch now?</p>
            <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
              <button className="pill zelo" onClick={cancelStrike}>Cancel</button>
              <button className="cta" onClick={runStrike}>Launch</button>
            </div>
          </div>
        </div>
      ) : null}
      {u.current.briefing ? <Academy onDone={dismissBriefing} /> : null}
      {u.current.menu ? (
        <PauseMenu onResume={closeMenu} onQuickSave={() => persist("quicksave", "Quick save made.")}
          onSave={(slot) => persist(slot, "Game saved.")}
          onLoad={(id) => { const data = loadGame(id); if (data) onLoad(data); }}
          onQuit={onQuit} onSettingsChanged={syncSettings} />
      ) : null}
      {s.victory && !s.victoryAck ? <VictoryModal s={s} onKeep={keepPlaying} onRestart={restart} /> : null}
      {u.current.senateToast ? (
        <div key={u.current.senateToast.id} className={"senate-toast glass" + (u.current.senateToast.passed ? " passed" : " failed")}>
          <Icon name="senate" /> {u.current.senateToast.text}
        </div>
      ) : null}

      {u.current.comms ? <CommsTerminal s={s} onOpen={commsOpen} onChoose={commsChoose} onClose={toggleComms} /> : null}

      {u.current.armory ? (
        <aside className="glass" style={{position: "absolute", right: 16, top: 84, width: 320, padding: 14, zIndex: 8, borderRadius: 12}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
            <b>Strategic Weapons</b>
            <button className="pill zelo" onClick={toggleArmory}>Close</button>
          </div>
          {ARMORY.map((W) => {
            const why = weaponBlock(s, W), reload = Math.ceil(s.reload[W.type] ?? 0);
            return (
              <div key={W.key} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0"}}>
                <div style={{display: "flex", justifyContent: "space-between"}}><b>{W.name}</b><span>{W.reloadSeconds ? `${W.reloadSeconds}s reload` : "one per match"}</span></div>
                <div style={{fontSize: 12, opacity: 0.8, margin: "2px 0 4px"}}>{W.blurb}</div>
                <div style={{fontSize: 12, marginBottom: 6}}>{Object.entries(W.cost).map(([k, v]) => `${v} ${COST_LABEL[k]}`).join(" · ")}{reload > 0 ? ` · reloading ${reload}s` : ""}</div>
                <button className="pill zelo" disabled={!!why} title={why ?? `Arm ${W.name}`} onClick={() => armWeapon(W.key)}
                  style={{opacity: why ? 0.45 : 1, cursor: why ? "not-allowed" : "pointer"}}>{u.current.arm === W.key ? "Armed: pick target" : "Arm"}</button>
              </div>
            );
          })}
          <div style={{fontSize: 12, opacity: 0.85, marginTop: 6}}>Strikes launch from Ferrum. Esc cancels targeting.</div>
        </aside>
      ) : null}

      {u.current.shipyard ? (
        <aside className="glass" style={{position: "absolute", right: 16, top: 84, width: 300, padding: 14, zIndex: 8, borderRadius: 12}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
            <b>Shipyard</b>
            <button className="pill zelo" onClick={toggleShipyard}>Close</button>
          </div>
          {SHIP_ORDER.map((id) => {
            const ship = SHIPS[id], short = shortfall(s, ship.cost);
            return (
              <div key={id} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0"}}>
                <ShipPreview type={id} />
                <div style={{display: "flex", justifyContent: "space-between"}}><b>{ship.name}</b><span>{ship.seconds}s build</span></div>
                <div style={{fontSize: 12, opacity: 0.8, margin: "2px 0 4px"}}>{ship.blurb}</div>
                <div className="ship-badges mono"><span>HULL {ship.hull}</span><span>{ship.weapons}</span><span>SPEED {ship.speed}</span><span>POWER {ship.power}</span></div>
                <div style={{fontSize: 12, marginBottom: 6}}>{Object.entries(ship.cost).map(([k, v]) => `${v} ${COST_LABEL[k]}`).join(" · ")}</div>
                <button className="pill zelo" disabled={!!short} title={short ? `Short: ${short}` : `Build ${ship.name}`}
                  onClick={() => buildHull(id)} style={{opacity: short ? 0.45 : 1, cursor: short ? "not-allowed" : "pointer"}}>Build</button>
              </div>
            );
          })}
          <div style={{fontSize: 12, opacity: 0.85, marginTop: 6}}>
            In production: {s.queue.length ? s.queue.map((q) => `${SHIPS[q.type].name} ${q.left}s`).join(", ") : "none"}
          </div>
        </aside>
      ) : null}

      {over ? (
        <div className="overlay">
          <div className="sheet glass" style={{padding: 24, maxWidth: 480}}>
            <h2 style={{margin: "0 0 10px"}}>{s.won ? "Escape" : "Mission failed"}</h2>
            <p style={{margin: "0 0 18px"}}>{s.won || s.lost}</p>
            <button className="cta" onClick={restart}>{s.won ? "Play again" : "Try again"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Entry point: the title screen first, then the live session once "Initialize Sector" is pressed.
// The kernel loads here, once, and is shared by the session.
export function GameApp() {
  const [kernel, setKernel] = useState(null);
  const [screen, setScreen] = useState("intro");
  const [session, setSession] = useState(null);
  useEffect(() => {
    let alive = true;
    loadOrbiterKernel()
      .then((k) => { if (alive) setKernel(k); })
      .catch((err) => console.error("Orbiter kernel failed to load:", err));
    return () => { alive = false; };
  }, []);
  // Each new, restarted or loaded game is a new session with its own key, so the screen mounts clean.
  const startNew = (opts) => { setSession({key: Date.now(), seed: opts.seed, difficulty: opts.difficulty, save: null, tutorial: !!opts.tutorial}); setScreen("game"); };
  const startLoad = (save) => { setSession({key: Date.now(), seed: save.seed, difficulty: save.difficulty, save}); setScreen("game"); };
  if (screen === "intro" || !kernel || !session) {
    return <IntroScreen kernelStatus={kernel ? "ONLINE" : "LOADING"} onStart={startNew} onLoad={startLoad} />;
  }
  return (
    <GameSession key={session.key} kernel={kernel} session={session}
      onRestart={() => startNew({seed: session.seed, difficulty: session.difficulty})}
      onLoad={startLoad} onQuit={() => setScreen("intro")} />
  );
}
