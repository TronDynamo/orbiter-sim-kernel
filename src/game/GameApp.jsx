// Orbiter: Stellar Conquest screen. Reuses Orbit's solar-system scene (C++ WebAssembly orbit engine,
// planets, dying star, starfield, styling). Tethers, the Ark and mission telemetry sit on top.
import {useEffect, useRef, useState} from "react";
import {OrbitScene, ZOOM_DETAIL, ZOOM_FOCUS} from "../orbit/scene.js";
import {BODY_STRIDE} from "../orbit/engine.js";
import {ARK_POS} from "./galaxy.js";
import {bootSystem, systemFromSector, kernelSystemFromSector, systemState, rehomeFleet, resourceFor, extraDestinations, RESOURCE_LABEL} from "./currentSystem.js";
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
import {SHIPS, SHIP_ORDER, COST_LABEL, drawShip, drawChevron, fleetPower, FLIGHT_LENGTH, DEPOT_COST} from "./ships.js";
import {stepFleet, sendShip, shipPosition, interceptAt, depotPos, MAX_PROPELLANT, deploySatellite, SURVEY_TICKS, CARGO_CAP} from "./fleet.js";
import {Icon, drawArk, drawRelay} from "./icons.jsx";
import {Academy} from "./Academy.jsx";
import {drawPseudo3DShip, sunLocal, emitPlume, updatePlumes, drawPlumes} from "./pseudo3d.js";
import {shadowAt, drawUmbra, drawLensing, drawDebrisBelt} from "./stellarFx.js";
import {newCombat, stepCombat, weldSparks, mountsOf, MOUNTS, SWAP_COST, nextMount} from "./combat.js";
import {JUMP_GATE_COST, JUMP_GATE_BEACON_ORBIT_RADIUS, openStarchart, initiateJump, advanceWarp} from "./jumpGate.js";
import {drawAnchor} from "./anchors.js";
import {HudChip, HudMeter} from "./hud.jsx";
import {ShipPreview} from "./ShipPreview.jsx";

const START_MSG = "Drag from one world to another to build a conduit. Conduits snap beyond " + CONDUIT_RULES.maxLength + " units.";
const CONDUIT_MSG = {
  [CONDUIT_ERR.BAD_PLANET]: "That world can't take a conduit.",
  [CONDUIT_ERR.DUPLICATE]: "Those worlds are already linked.",
  [CONDUIT_ERR.TOO_LONG]: "Too far apart: conduits snap beyond " + CONDUIT_RULES.maxLength + " units.",
  [CONDUIT_ERR.OCCLUDED]: "The dying star blocks that line.",
  [CONDUIT_ERR.FULL]: "The network has no free conduit slots.",
};
// Which stockpile each world's siphoned output feeds (game data; the kernel only produces the flow).
// Conduit tone by tension: cyan below 70% of the snap limit, amber to 90%, a pulsing red beyond that.
// Conduit shape: slack sags at low tension, straightens as it nears the snap limit, and hums past 80%.
const SNAP_HUM_RATIO = 0.8;
const conduitPoint = (a, b, ratio, now, t, seed = 0) => {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const slack = Math.max(0, 1 - ratio / SNAP_HUM_RATIO) * 0.1 * len;
  const sag = 4 * slack * t * (1 - t);
  const amp = ratio >= SNAP_HUM_RATIO ? 0.8 + 2 * Math.min(1, (ratio - SNAP_HUM_RATIO) / 0.12) : 0;
  const hum = amp * Math.sin(now / 22 + t * 23 + seed);
  return {x: a.x + dx * t + nx * (sag + hum), y: a.y + dy * t + ny * (sag + hum)};
};
const conduitPath = (ctx, a, b, ratio, now, seed = 0) => {
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const q = conduitPoint(a, b, ratio, now, i / 24, seed);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
};
// Packet colour per resource, so the player can read what a line carries at a glance.
const PULSE_COLOR = {biomass: "#4ade80", cryo: "#7dd3fc", alloys: "#fb923c", compute: "#c4b5fd", credits: "#fde047", fuel: "#f472b6", propellant: "#f97316"};
// Compressed packets of light travelling source to target; faster and more of them as throughput rises.
const drawPulses = (ctx, a, b, ratio, now, flow, color, seed) => {
  const n = Math.min(4, 1 + Math.floor(flow / 40)), speed = 0.2 + Math.min(1, flow / 200) * 0.6;
  for (let k = 0; k < n; k++) {
    const u = ((now / 1000) * speed + seed + k / n) % 1;
    const q = conduitPoint(a, b, ratio, now, u, seed);
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 7);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fill();
  }
};
const tensionTone = (r, now) => r >= 0.9 ? `rgba(239,68,68,${(0.55 + 0.45 * Math.sin(now / 120)).toFixed(3)})` : r >= 0.7 ? "#f59e0b" : "#38bdf8";
// Fallback yield for a world with no biome class (should not occur for generated worlds).
const DEFAULT_YIELD = 6;

// The live session. The kernel is loaded once by GameApp and passed in; each session starts it from zero.
// session: {key, seed, difficulty, save}. A save (a record from saveManager) restores the sector instead of starting it.
function GameSession({kernel, session, onRestart, onLoad, onQuit}) {
  const canvasRef = useRef(null), overlayRef = useRef(null), appRef = useRef(null);
  // The star system the game is playing in: the boot system, or the sector a jump brought us to (see currentSystem.js).
  const sysRef = useRef(null);
  if (sysRef.current === null) {
    const saved = session.save?.state?.jumpGate?.currentSector;
    sysRef.current = saved ? systemFromSector(saved) : bootSystem();
  }
  const isPlanet = (id) => sysRef.current.planets.some((p) => p.id === id);
  const planetName = (id) => sysRef.current.planets.find((p) => p.id === id)?.name ?? id;
  const planetIndex = (id) => sysRef.current.planets.findIndex((p) => p.id === id);
  // Which stockpile each world's siphoned output feeds, resolved for the current system.
  // secondary is the half-rate second yield of a generated world (null for starter worlds).
  const outputsOf = () => sysRef.current.planets.map((p, i) => ({planet: p.id, resource: resourceFor(sysRef.current, i), index: i, secondary: p.secondary ?? null, primary: yieldOf(p.id)}));
  // Starter worlds read config/planets.js; generated worlds carry the yield of their biome class (currentSystem.js).
  const yieldOf = (id) => PLANET_DEFS.find((d) => d.key === id)?.yield ?? sysRef.current.planets.find((p) => p.id === id)?.yield ?? DEFAULT_YIELD;
  const st = useRef(newState());
  const combatRef = useRef(newCombat());   // raiders, shots and debris; hulls and mounts live on the fleet
  const u = useRef({drag: null, mode: null, msg: START_MSG, msgWin: false, paused: false, speed: 1, tick: 0, shipyard: false, armory: false, comms: false, governor: null, tech: false, senate: false, arm: null, hover: null, pointer: null, menu: false, confirm: null, autosaveAt: -1e9, fps: 0, selected: null, briefing: !!session.tutorial, depotPlace: false});
  const [ui, setUi] = useState({...u.current});
  const refresh = () => setUi({...u.current});
  const difficulty = DIFFICULTIES[session.difficulty] ?? DIFFICULTIES.commander;

  useEffect(() => {
    const startSys = sysRef.current;
    const scene = new OrbitScene(canvasRef.current, {}, {galaxies: {[startSys.id]: startSys}, galaxyId: startSys.id});
    scene.zoomBy(0.8, true); // frame all four orbits clear of the telemetry panel and the dock
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
    scene.positionSource = () => (syncKernel() ? sysRef.current.planets.map((_, i) => ({x: kernel.planets.x[i], y: kernel.planets.y[i]})) : null);

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
      sysRef.current.planets.forEach((p, i) => { const o = i * BODY_STRIDE; P[p.id] = {x: sim.b[o + 10], y: sim.b[o + 11]}; });
      for (const r of st.current.relays) P[r.id] = {x: r.x, y: r.y};
      for (const d of st.current.depots ?? []) P[d.id] = depotPos(d, P);
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
        const A = P[sysRef.current.planets[kernel.conduits.source[c]].id], B = P[sysRef.current.planets[kernel.conduits.target[c]].id];
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
    const gainSeen = outputsOf().map((o) => kernel.planets.gainTotal[o.index]);
    let creditSeen = kernel.creditTotal;         // kernel credit total already credited
    let buildTick = kernel.tickCount;            // kernel tick up to which structure income has been paid

    const onDown = (e) => {
      if (e.button !== 0) return;
      const P = positions(); if (!P) return;
      const p = toWorld(e);
      if (st.current.jumpGate?.built && !s0.mode && !s0.depotPlace && Math.abs(Math.hypot(p.x, p.y) - JUMP_GATE_BEACON_ORBIT_RADIUS) < 14) {
        u.current.starchart = true; refresh(); return;
      }
      if (s0.depotPlace) {
        const need = shortfall(st.current, DEPOT_COST);
        if (need) { say(`Fuel depot needs ${need}.`); refresh(); return; }
        const hit = hitBody(st.current, P, p);
        const planet = hit && isPlanet(hit) ? hit : null;
        for (const [k, v] of Object.entries(DEPOT_COST)) st.current[k] -= v;
        const n = (st.current.depotN ?? 0) + 1; st.current.depotN = n;
        const depot = planet ? {id: `depot${n}`, planet, ang: Math.atan2(p.y - P[planet].y, p.x - P[planet].x)} : {id: `depot${n}`, planet: null, x: p.x, y: p.y};
        st.current.depots = [...(st.current.depots ?? []), depot];
        s0.depotPlace = false;
        say(planet ? `Fuel depot placed in orbit around ${planetName(planet)}.` : "Fuel depot holding station in deep space.", true);
        refresh(); return;
      }
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
          else {
            const a = sysRef.current.planets[kernel.conduits.source[c]].id, b = sysRef.current.planets[kernel.conduits.target[c]].id;
            const ten = P[a] && P[b] ? Math.hypot(P[b].x - P[a].x, P[b].y - P[a].y) / CONDUIT_RULES.maxLength : 0;
            kernel.removeConduit(c); snapSeen.clear();
            if (ten >= 0.85) {
              st.current.propellant = Math.max(0, st.current.propellant - 3);
              say(`[ EMERGENCY CUT ] Explosive bolts severed the line at ${Math.round(ten * 100)}% tension before whiplash. Vented 3 propellant.`);
            } else say("Conduit decoupled cleanly. No damage.");
          }
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
      if (picked) { s0.selected = picked.id; scene.setFollow(shipFollow(picked.id)); say(`${SHIPS[picked.type].name} selected. Right-click a world to send it.`); refresh(); return; }
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
      if (kernel) for (let c = 0; c < kernel.conduitCount; c++) out.push({a: sysRef.current.planets[kernel.conduits.source[c]].id, b: sysRef.current.planets[kernel.conduits.target[c]].id, snapped: !!kernel.conduits.snapped[c]});
      return out;
    };
    const onCtx = (e) => {
      e.preventDefault();
      const P = positions(); if (!P || s0.selected == null) return;
      const ship = st.current.fleet.find((f) => f.id === s0.selected);
      if (!ship) { s0.selected = null; refresh(); return; }
      const id = hitBody(st.current, P, toWorld(e));
      if (!id || !(isPlanet(id) || id.startsWith("depot"))) { say("Right-click a world or fuel depot to send the selected ship."); refresh(); return; }
      const r = sendShip(st.current, ship, id, P, liveConduits(), id.startsWith("depot") ? "the fuel depot" : planetName(id));
      say(r.msg, r.ok); refresh();
    };
    // The camera follows a ship while zoomed in past ZOOM_FOLLOW. Stops once that ship is no longer selected.
    const shipFollow = (id) => () => {
      if (s0.selected !== id) return null;
      const f = st.current.fleet.find((x) => x.id === id), P2 = positions();
      return f && P2 ? shipPosition(f, P2) : null;
    };
    // Double-click a ship or world: glide the camera onto it and zoom to ZOOM_FOCUS.
    const onDbl = (e) => {
      const P = positions(); if (!P) return;
      const w = toWorld(e);
      const zb = scene.sim.c[4] * scene.base;
      const ship = st.current.fleet.find((f) => { const q = shipPosition(f, P); return Math.hypot(q.x - w.x, q.y - w.y) <= 16 / zb; });
      if (ship) {
        s0.selected = ship.id; scene.setFollow(shipFollow(ship.id)); scene.zoomTo(ZOOM_FOCUS);
        say(`${SHIPS[ship.type].name} centred.`); refresh(); return;
      }
      const id = hitBody(st.current, P, w);
      if (id && isPlanet(id)) {
        scene.setFollow(() => positions()?.[id] ?? null); scene.zoomTo(ZOOM_FOCUS);
        say(`${planetName(id)} centred.`); refresh();
      }
    };
    const onWheel = (e) => { e.preventDefault(); scene.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); };
    ov.addEventListener("contextmenu", onCtx);
    ov.addEventListener("wheel", onWheel, {passive: false});
    ov.addEventListener("dblclick", onDbl);
    ov.addEventListener("pointerdown", onDown);
    ov.addEventListener("pointermove", onMove);
    ov.addEventListener("pointerup", onUp);
    ov.addEventListener("pointercancel", onUp);

    const plumeBank = new Map();
    let plumeT = performance.now();
    const drawOverlay = (P, now) => {
      const s = st.current, w = ov.clientWidth, h = ov.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const toS = (p) => scene.toScreen(p.x, p.y);
      const sysNow = sysRef.current, star = P.core;

      // stellar backdrop: planetary umbra cones, black-hole or pulsar lensing, belts on shattered worlds
      const bodies = sysNow.planets.filter((p) => P[p.id]).map((p) => ({...P[p.id], R: p.r}));
      if (sysNow.anchor !== "void") for (const b of bodies) drawUmbra(ctx, toS, star, b, b.R);
      if (sysNow.anchor === "black_hole" || sysNow.anchor === "pulsar") drawLensing(ctx, toS, star, sysNow.sun?.radius ?? 22, now / 1000);
      const fractured = kernel ? sysNow.planets.filter((p, i) => kernel.planets.status[i] === WORLD.FRACTURED && P[p.id]).map((p) => P[p.id]) : [];
      for (const fp of fractured) drawDebrisBelt(ctx, toS, star, Math.hypot(fp.x - star.x, fp.y - star.y), now / 1000);

      // tethers, coloured by tension
      for (const t of s.tethers) {
        if (!P[t.a] || !P[t.b]) continue;
        const a = toS(P[t.a]), b = toS(P[t.b]), ratio = tensionOf(t, P), col = tensionColor(ratio);
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.shadowColor = col; ctx.shadowBlur = ratio >= 0.8 ? 14 : 4;
        conduitPath(ctx, a, b, ratio, now, t.a.length);
        ctx.shadowBlur = 0;
        const m = conduitPoint(a, b, ratio, now, 0.5);
        ctx.font = "11px system-ui"; ctx.fillStyle = col; ctx.textAlign = "center";
        ctx.fillText(`${Math.round(ratio * 100)}%`, m.x, m.y - 6);
      }

      // player conduits, read from the kernel: amber when stretched, red when snapped, dimmed in the star's shadow
      if (kernel) {
        for (let c = 0; c < kernel.conduitCount; c++) {
          const A = P[sysRef.current.planets[kernel.conduits.source[c]].id], B = P[sysRef.current.planets[kernel.conduits.target[c]].id];
          if (!A || !B) continue;
          const a = toS(A), b = toS(B), len = kernel.conduits.length[c];
          const snapped = !!kernel.conduits.snapped[c], occluded = !!kernel.conduits.occluded[c];
          ctx.globalAlpha = 1 - 0.55 * shadowAt({x: (A.x + B.x) / 2, y: (A.y + B.y) / 2}, star, bodies);
          const ratio = len / (kernel.conduits.maxLength[c] || CONDUIT_RULES.maxLength);
          const col = snapped ? "#EF4444" : occluded ? "rgba(148,163,184,0.35)" : tensionTone(ratio, now);
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(snapped ? [4, 6] : []);
          if (snapped) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
          else conduitPath(ctx, a, b, ratio, now, c);
          ctx.setLineDash([]);
          // a live line carries its source world's resource: packets in that resource's colour
          const flow = kernel.conduits.throughput[c];
          if (!snapped && !occluded && flow > 0) {
            const res = resourceFor(sysRef.current, kernel.conduits.source[c]);
            drawPulses(ctx, a, b, ratio, now, flow, PULSE_COLOR[res] ?? "#e2e8f0", c * 0.37);
          }
          const m = snapped ? {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2} : conduitPoint(a, b, ratio, now, 0.5, c);
          ctx.font = "11px system-ui"; ctx.fillStyle = col; ctx.textAlign = "center";
          ctx.fillText(snapped ? "snapped" : occluded ? "in shadow" : ratio >= 0.7 ? `TENSION: ${Math.round(ratio * 100)}%` : `${Math.round(kernel.conduits.throughput[c])} flow · ${Math.round(len)}u`, m.x, m.y - 6);
        }
      }

      ctx.globalAlpha = 1;

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
          const ti = kernel.missiles.target[m], tp = ti >= 0 ? P[sysRef.current.planets[ti].id] : P.core;
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
          const ax = kernel.asteroids.x[a], ay = kernel.asteroids.y[a];
          // rocks at a shattered world's spawn point are drawn as its rotating belt instead
          if (fractured.some((fp) => Math.hypot(fp.x - ax, fp.y - ay) < 30)) continue;
          const q = toS({x: ax, y: ay});
          ctx.fillRect(q.x, q.y, 2, 2);
        }
      }

      // warship combat: raiders, shots, debris and visual damage states
      {
        const cb = combatRef.current, k = Math.max(0.6, Math.min(2, scene.zoomUser));
        for (const r of cb.raiders) {
          const q = toS(r), a = Math.atan2(r.vy, r.vx);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a);
          ctx.fillStyle = "#f87171"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(7 * k, 0); ctx.lineTo(-5 * k, -4.5 * k); ctx.lineTo(-5 * k, 4.5 * k); ctx.closePath(); ctx.fill();
          ctx.restore(); ctx.shadowBlur = 0;
        }
        for (const sh of cb.shots) {
          const q = toS(sh), back = toS({x: sh.x - sh.vx * 0.03, y: sh.y - sh.vy * 0.03});
          if (sh.kind === "kinetic") {
            ctx.strokeStyle = "#e0f2fe"; ctx.lineWidth = 1.6; ctx.shadowColor = "#bae6fd"; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          } else if (sh.kind === "plasma") {
            ctx.fillStyle = "#fb923c"; ctx.shadowColor = "#f97316"; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(q.x, q.y, 3.5 * k, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillStyle = "#fde68a"; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(q.x, q.y, 1.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
        for (const e of cb.fx) {
          const q = toS(e), a = Math.max(0, e.life / e.max);
          if (e.kind === "spark") { ctx.globalAlpha = a; ctx.fillStyle = e.color; ctx.fillRect(q.x - 1, q.y - 1, 2.2, 2.2); }
          else {
            ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(e.rot);
            ctx.globalAlpha = Math.min(1, a * 1.2); ctx.fillStyle = e.color; ctx.strokeStyle = "rgba(226,232,240,0.5)"; ctx.lineWidth = 0.8;
            ctx.beginPath(); e.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)));
            ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        // damage states: scorch marks as hulls fall, and flickering arcs below half hull
        for (const f of s.fleet) {
          const max = SHIPS[f.type].hull, hp = f.hp ?? max;
          if (hp >= max) continue;
          const q = toS(shipPosition(f, P)), pct = hp / max;
          ctx.fillStyle = `rgba(15,10,5,${(0.25 + 0.4 * (1 - pct)).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(q.x + 3 * k, q.y - 2 * k, 4 * k, 0, Math.PI * 2); ctx.fill();
          if (pct < 0.5 && Math.random() < 0.3) {
            ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 1; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.moveTo(q.x - 9 * k, q.y + (Math.random() - 0.5) * 6 * k);
            for (let j = 1; j <= 3; j++) ctx.lineTo(q.x - 9 * k + j * 6 * k, q.y + (Math.random() - 0.5) * 10 * k);
            ctx.stroke(); ctx.shadowBlur = 0;
          }
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
          const tp = P[sysRef.current.planets[ti].id];
          if (tp && Math.hypot(tp.x - kernel.missiles.x[m], tp.y - kernel.missiles.y[m]) <= DRILL_CRACK_DISTANCE) {
            const q = toS(tp); drawMagma(ctx, q.x, q.y, pxAt(tp, 11), t);
          }
        }
        // world states
        sysRef.current.planets.forEach((p, i) => {
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
        const closeUp = scene.zoomUser >= ZOOM_DETAIL;
        const dtP = Math.min(0.05, Math.max(0, (now - plumeT) / 1000)); plumeT = now;
        const sunW = P.sun ?? {x: 0, y: 0};
        updatePlumes(plumeBank, dtP, new Set(s.fleet.map((f) => f.id)));
        for (const f of s.fleet) {
          const world = shipPosition(f, P);
          const q = toS(world);
          const heading = f.theta ?? f.heading ?? 0;   // banked along the velocity vector
          const length = closeUp ? FLIGHT_LENGTH[f.type] * scene.zoomUser / 2 : 0;
          ctx.globalAlpha = 1 - 0.5 * shadowAt(world, star, bodies);   // planetary shadow dims the hull
          if (closeUp) drawPseudo3DShip(ctx, f.type, q.x, q.y, heading, {length, roll: f.roll ?? 0, thrust: f.thrust ?? 0, sunDir: sunLocal(world.x, world.y, heading, sunW)});
          else drawChevron(ctx, q.x, q.y, heading, {thrust: f.thrust ?? 0, t: tt});
          // detached ion plumes: emitted at the stern, left behind to drift
          const tail = closeUp ? length * 0.5 : 3;
          emitPlume(plumeBank, f.id, q.x, q.y, heading, f.thrust ?? 0, dtP, tail);
          drawPlumes(ctx, plumeBank.get(f.id));
          ctx.globalAlpha = 1;
          if (f.mode === "survey") {
            const frac = 1 - (f.surveyLeft ?? SURVEY_TICKS) / SURVEY_TICKS;
            ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(q.x, q.y, 12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
          }
          if (f.type === "freighter" && (f.cargo ?? 0) > 0) {
            ctx.fillStyle = "rgba(2,6,23,0.8)"; ctx.fillRect(q.x - 12, q.y + 10, 24, 3);
            ctx.fillStyle = "#fbbf24"; ctx.fillRect(q.x - 12, q.y + 10, 24 * (f.cargo / CARGO_CAP), 3);
          }
          if (f.id === s0.selected) {
            ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.arc(q.x, q.y, closeUp ? 18 : 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            const T = f.to && P[f.to];
            if (T && (f.mode === "transit" || f.mode === "surf")) {
              const tq = toS(T); ctx.strokeStyle = "rgba(56,189,248,0.6)"; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(tq.x, tq.y); ctx.stroke();
            }
          }
        }
      }

      // Jump Gate beacon ring and the anchor of a jumped-to sector
      const gate = s.jumpGate;
      if (gate?.built) {
        const c = toS({x: 0, y: 0});
        const rr = Math.abs(toS({x: JUMP_GATE_BEACON_ORBIT_RADIUS, y: 0}).x - c.x);
        ctx.strokeStyle = "rgba(0,240,255,0.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        const bx = c.x + rr, by = c.y;
        ctx.fillStyle = "#00f0ff"; ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (gate?.currentSector && gate.currentSector.anchorType && gate.currentSector.anchorType !== "sol") {
        const c = toS({x: 0, y: 0});
        drawAnchor(ctx, gate.currentSector.anchorType, c.x, c.y, now / 1000);
        ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
        ctx.fillText(gate.currentSector.name, c.x, c.y + 96);
      }
      // uncharted worlds: label the ones no probe has scanned yet
      for (const id of sysRef.current.planets.map((p) => p.id)) {
        if ((s.surveyed ?? {})[id] || !P[id]) continue;
        const q = toS(P[id]);
        ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
        ctx.fillText("UNCHARTED", q.x, q.y + 34);
      }
      // fuel depots: a hexagonal station ring with a slow spin, labelled in the telemetry face
      for (const d of s.depots ?? []) {
        const q = toS(P[d.id]);
        ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 1.2; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + now / 4000;
          const x = q.x + 7 * Math.cos(a), y = q.y + 7 * Math.sin(a);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#67e8f9"; ctx.textAlign = "center";
        ctx.fillText("DEPOT", q.x, q.y + 16);
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
      // A frame that completes a jump can hold positions for the old worlds; skip any world without one this frame.
      for (const p of sysRef.current.planets) { if (!P[p.id]) continue; const q = toS(P[p.id]); ctx.fillText(p.name, q.x, q.y - 22); }
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    };

    let fleetTick = -1, prevP = {};
    let warpT = performance.now();
    let frames = 0, fpsT = performance.now(), prevStatus = null, lastAutosave = performance.now(), combatT = performance.now();
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
            for (const m of stepFleet(s, P, dt, {conduits: liveConduits(), velocity: vel})) say(m);
            if (s.jumpGate?.warp?.active) {
              advanceWarp(s.jumpGate, Math.max(0, (now - warpT) / 1000));
              if (!s.jumpGate.warp.active) {
                const sector = s.jumpGate.currentSector, sys = systemFromSector(sector);
                if (kernel.loadSystem(kernelSystemFromSector(sector, sys)) >= 0) {
                  sysRef.current = sys;
                  scene.galaxies[sys.id] = sys;
                  scene.setGalaxy(sys.id);
                  Object.assign(s, systemState(sys));   // worlds uncharted, resources and names for the new system
                  rehomeFleet(s.fleet, sys);            // ships come along, parked at the new home world
                  s.tethers = []; s.relays = [];         // the old system's links were lost with its conduits
                  gainSeen.fill(0);                      // the kernel's payout totals restart for the new worlds
                  say(`Arrived in ${sector.name}. Fleet, research and treasury came with you.`, true);
                } else say("The jump failed: the destination could not be loaded.", true);
              }
            }
            warpT = now;
            if (u.current.deployRelay) {
              u.current.deployRelay = false;
              const tender = s.fleet.find((x) => x.id === u.current.selected);
              say(tender ? deploySatellite(s, tender, P).msg : "Select a Satellite Tender first.");
            }
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
          if (dt > 0) sysRef.current.planets.forEach((p) => {
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
              const out = outputsOf().find((o) => o.planet === p.id);
              if (shadowed) {
                s[out.resource] += yieldOf(p.id) * pz.occlusionShare * dt / TICKS_PER_SECOND;
                if (out.secondary) s[out.secondary.resource] += out.secondary.yield * pz.occlusionShare * dt / TICKS_PER_SECOND;
              }
            }
          });
        }
        if (kernel) outputsOf().forEach((o, i) => {
          const idx = planetIndex(o.planet), total = kernel.planets.gainTotal[idx], d = total - gainSeen[i];
          if (d > 0) {
            s[o.resource] += d * difficulty.income;
            if (o.secondary) s[o.secondary.resource] += d * (o.secondary.yield / o.primary) * difficulty.income;
            gainSeen[i] = total;
          }
        });
        if (kernel) for (let c = 0; c < kernel.conduitCount; c++) {
          if (kernel.conduits.snapped[c] && !snapSeen.has(c)) {
            snapSeen.add(c);
            const from = sysRef.current.planets[kernel.conduits.source[c]].id, to = sysRef.current.planets[kernel.conduits.target[c]].id;
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
          const planets = sysRef.current.planets.map((p, i) => ({id: p.id, status: kernel.planets.status[i]}));
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
        // warship combat: raids in generated sectors, mounts firing, debris, bounties on kill. Scaled by game speed.
        const cdt = Math.min(0.05, Math.max(0, (now - combatT) / 1000)) * (s0.paused ? 0 : (scene.speed || 0));
        combatT = now;
        if (!s.won && !s.lost) {
          const sys = sysRef.current;
          const edgeR = sys.type === "sector" ? Math.max(...sys.planets.map((p) => p.orbit)) : null;
          const planets = sys.planets.filter((p) => P[p.id]).map((p) => P[p.id]);
          const raidNow = !!s0.raidNow; s0.raidNow = false;
          for (const ev of stepCombat(combatRef.current, {dt: cdt, fleet: s.fleet, planets, core: P.core, pos: (f) => shipPosition(f, P), tech: s.tech, edgeR, raidNow})) {
            if (ev.kind === "kill") s.credits += ev.bounty;
            say(ev.msg, ev.kind === "kill");
          }
        }
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
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) { s0.raidNow = true; say("[DEV] Raid queued for the next frame."); refresh(); }
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
      ov.removeEventListener("wheel", onWheel);
      ov.removeEventListener("dblclick", onDbl);
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
  function flash(text, win = false) { u.current.msg = text; u.current.msgWin = win; }
  function patchBulkhead() {
    const f = st.current.fleet.find((x) => x.id === u.current.selected); if (!f) return;
    const max = SHIPS[f.type].hull, hp = f.hp ?? max;
    if (hp >= max) flash("Bulkhead already intact.");
    else if (st.current.alloys < 10) flash("Patching a bulkhead needs 10 Alloys.");
    else {
      st.current.alloys -= 10; f.hp = Math.min(max, hp + 25);
      flash(`${SHIPS[f.type].name} bulkhead patched.`, true);
      weldFx(f);
    }
    refresh();
  }
  // Swaps one mount slot to the next weapon type the Tech Web has unlocked, paying Alloys for it.
  function swapMount(id, slot) {
    const f = st.current.fleet.find((x) => x.id === id); if (!f) return;
    const mounts = mountsOf(f).slice();
    const cur = mounts[slot];
    const pick = nextMount(st.current.tech, cur);
    if (!pick) { flash("No other mount is unlocked yet. Research it in the Tech Web."); return; }
    const cost = SWAP_COST[pick];
    if (st.current.alloys < cost) { flash(`Swapping to ${MOUNTS[pick].label} needs ${cost} Alloys.`); return; }
    st.current.alloys -= cost; mounts[slot] = pick; f.mounts = mounts;
    flash(`${MOUNTS[cur].label} swapped for ${MOUNTS[pick].label}.`, true);
    refresh();
  }
  // A patch queues welding sparks at the ship; the frame loop places them, since it holds the positions.
  function weldFx(f) {
    combatRef.current.weld.push(f.id);
  }
  // dev: queue one raid for the next frame (the R key does the same)
  function devRaid() {
    u.current.raidNow = true;
    flash("[DEV] Raid queued.", true);
  }
  function toggleOverclock() {
    const f = st.current.fleet.find((x) => x.id === u.current.selected); if (!f) return;
    f.overclock = !f.overclock;
    flash(f.overclock ? "Thrusters overclocked: 1.5x speed, double burn." : "Thrusters back to nominal burn.");
    refresh();
  }
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
  function gateOf() { return (st.current.jumpGate ??= {built: false, beacon: null, currentSector: null, warp: {active: false, phase: "idle", progress: 0, destination: null}}); }
  function buildGate() {
    const g = gateOf();
    if (g.built) return flash("The Stellar Jump Gate is already online.");
    const need = shortfall(st.current, JUMP_GATE_COST);
    if (need) return flash(`Jump gate needs ${need}.`);
    for (const [k, v] of Object.entries(JUMP_GATE_COST)) st.current[k] -= v;
    g.built = true; g.beacon = {orbitRadius: JUMP_GATE_BEACON_ORBIT_RADIUS};
    flash("Stellar Jump Gate online. Click its beacon in the outer orbit.", true);
    refresh();
  }
  function jumpTo(sector) {
    const r = initiateJump(gateOf(), sector);
    if (r.ok) { u.current.starchart = false; flash(`Slipstream engaged for ${sector.name}.`, true); }
    else flash(`Jump refused: ${String(r.reason).replace(/_/g, " ")}.`);
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
  const hullPct = Math.max(0, Math.round(s.hull));
  const selShip = u.current.selected != null ? s.fleet.find((f) => f.id === u.current.selected) : null;
  const selMax = selShip ? SHIPS[selShip.type].hull : 1;
  const selHp = selShip ? Math.max(0, Math.round(selShip.hp ?? selMax)) : 0;
  const selPct = Math.round((selHp / selMax) * 100);
  const hullColor = hullPct > 60 ? "#22c55e" : hullPct > 30 ? "#eab308" : "#ef4444";
  const radColor = s.radiation >= 4 ? "#ef4444" : s.radiation >= 2 ? "#f59e0b" : "#22d3ee";
  return (
    <div className="app" ref={appRef}>
      <canvas ref={canvasRef} className="stage" />
      <canvas ref={overlayRef} className="stage" style={{pointerEvents: "auto", cursor: u.current.arm ? "none" : u.current.mode ? "crosshair" : "default"}} />

      <div className="hud-ribbon hud-panel" role="status" aria-label="Strategic resources">
        <HudChip c="#f59e0b" icon="credits" label="Credits" value={Math.floor(s.credits)} />
        <HudChip c="#10b981" icon="biomass" label="Biomass" value={Math.floor(s.biomass)} />
        <HudChip c="#06b6d4" icon="coolant" label="Coolant" value={Math.floor(s.cryo)} />
        <HudChip c="#f43f5e" icon="alloys" label="Alloys" value={Math.floor(s.alloys)} />
        <HudChip c="#a855f7" icon="compute" label="Compute" value={Math.floor(s.compute)} />
      </div>

      <aside className="hud-ark hud-panel" aria-label="Ark telemetry">
        <div className="hud-kicker mono">ARK ENDEAVOR · TELEMETRY</div>
        <HudMeter label="Hull" pct={hullPct} color={hullColor} value={`${hullPct}%`} warn={hullPct <= 30} />
        <HudMeter label="Propellant" pct={Math.min(100, s.propellant)} color="#38bdf8" value={Math.floor(s.propellant)} />
        <HudMeter label="Fuel" pct={Math.min(100, (s.fuel / Math.max(120, s.fuel)) * 100)} color="#60a5fa" value={Math.floor(s.fuel)} />
        <HudMeter label={`Radiation · ${radiationLabel}`} pct={(s.radiation / 4) * 100} color={radColor} value={radiationLabel.toUpperCase()} warn={s.radiation >= 3} />
        <HudMeter label="Singularity" pct={(s.data / RULES.DATA_GOAL) * 100} color="#c084fc" value={`${Math.floor(s.data)} / ${RULES.DATA_GOAL}`} />
        <div className="hud-fleet mono">
          <span>FLEET {s.fleet.length}</span>
          <span>POWER {Math.round(fleetPower(s.fleet) * perks(s).fleetMult * 10) / 10}</span>
        </div>
        <div className="hud-fleet mono">
          <span>CYCLE {String(yr).padStart(2, "0")} // TICK {(kernel?.tickCount ?? 0).toLocaleString("en-US")}</span>
          {getSettings().fps ? <span>{u.current.fps} FPS</span> : null}
        </div>
      </aside>

      <div className="hud-controls">
        <div className="hud-seg" role="group" aria-label="Time controls">
          <button className={u.current.paused ? "on" : ""} onClick={togglePause}>{u.current.paused ? "RESUME" : "PAUSE"}</button>
          {[1, 2, 4].map((v) => (
            <button key={v} className={u.current.speed === v && !u.current.paused ? "on" : ""} onClick={() => setSpeed(v)}>{v}X</button>
          ))}
        </div>
        <button className="hud-btn" onClick={restart}>Restart</button>
        <button className="hud-btn hud-icon" title="Menu (Esc)" aria-label="Menu" onClick={openMenu}><Icon name="gear" size={16} /></button>
      </div>

      {u.current.msg ? <div className={"toast glass" + (u.current.msgWin ? " win" : "")} style={{top: 60, pointerEvents: "none", maxWidth: 300, textAlign: "center", whiteSpace: "normal"}}>{u.current.msg}</div> : null}

      <footer className="hud-dock" aria-label="Command dock">
        <div className="hud-dock-group">
          <button className={"hud-btn" + (u.current.mode === "relay" ? " on" : "")} title="Relay satellite: 15 Alloys, 5 Coolant" onClick={() => setMode("relay")}><Icon name="relay" size={14} /> Relay</button>
          <button className={"hud-btn" + (u.current.mode === "repair" ? " on" : "")} title="Patch hull: 10 Alloys" onClick={() => setMode("repair")}><Icon name="repair" size={14} /> Patch</button>
          <button className={"hud-btn" + (u.current.mode === "cut" ? " on" : "")} onClick={() => setMode("cut")}><Icon name="cut" size={14} /> Decouple</button>
        </div>
        <div className="hud-dock-group">
          <button className={"hud-btn" + (u.current.shipyard ? " on" : "")} onClick={toggleShipyard}><Icon name="shipyard" size={14} /> Shipyard</button>
          <button className={"hud-btn" + (u.current.armory ? " on" : "")} onClick={toggleArmory}><Icon name="armory" size={14} /> Armory</button>
          <button className={"hud-btn" + (u.current.comms ? " on" : "")} onClick={toggleComms}><Icon name="comms" size={14} /> Comms</button>
          <button className={"hud-btn" + (s.senate.dismissed ? "" : " flash-alert")} onClick={openSenate}><Icon name="senate" size={14} /> Senate</button>
          <button className="hud-btn" title="Dev: spawn one raid now (also the R key). Remove before release." onClick={devRaid}>[+ Raid] Dev</button>
        </div>
      </footer>

      {u.current.starchart && st.current.jumpGate?.built ? (() => {
        const sectors = [...openStarchart(st.current.jumpGate).sectors, ...extraDestinations()];
        return (
          <div style={{position: "absolute", inset: 0, zIndex: 12, display: "grid", placeItems: "center", background: "rgba(2,6,23,0.6)"}}>
            <div className="glass" style={{width: 560, maxWidth: "92vw", padding: 18, borderRadius: 14}}>
              <div style={{display: "flex", justifyContent: "space-between", marginBottom: 8}}><b className="hud-label">Sector Starchart</b><button className="pill zelo" onClick={() => { u.current.starchart = false; refresh(); }}>Close</button></div>
              {sectors.map((sec) => (
                <div key={sec.id} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "10px 0"}}>
                  <div style={{display: "flex", justifyContent: "space-between"}}><b className="mono">{sec.name}</b><span>{sec.planets.length} planets</span></div>
                  <div style={{fontSize: 12, opacity: 0.85, margin: "3px 0"}}>{sec.starType} · {sec.description}</div>
                  <div className="ship-badges mono"><span>{sec.hazards.join(" · ")}</span></div>
                  <button className="pill zelo" style={{marginTop: 6}} onClick={() => jumpTo(sec)}>Initiate Jump</button>
                </div>
              ))}
            </div>
          </div>
        );
      })() : null}
      {st.current.jumpGate?.warp?.active ? (
        <div className="glass" style={{position: "absolute", left: "50%", top: "14%", transform: "translateX(-50%)", zIndex: 13, padding: "10px 16px", borderRadius: 10, minWidth: 260}}>
          <div className="hud-label" style={{marginBottom: 6}}>SLIPSTREAM</div>
          <div style={{height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2}}><div style={{height: 4, width: `${Math.round(st.current.jumpGate.warp.progress * 100)}%`, background: "#00f0ff", borderRadius: 2}} /></div>
        </div>
      ) : null}
      {selShip ? (
        <aside className="hud-panel hud-engineering" aria-label="Vessel engineering">
          <div className="hud-kicker mono">VESSEL ENGINEERING · {SHIPS[selShip.type].name.toUpperCase()} #{selShip.id}</div>
          <HudMeter label="Hull" pct={selPct} color={selPct > 60 ? "#22c55e" : selPct > 30 ? "#eab308" : "#ef4444"} value={`${selHp}/${selMax}`} warn={selPct <= 30} />
          <div className="hud-fleet mono"><span>PROPELLANT {Math.floor(s.propellant)}/{MAX_PROPELLANT}</span><span>{String(selShip.mode ?? "orbit").toUpperCase()}</span></div>
          <button className="hud-btn" onClick={patchBulkhead}><Icon name="repair" size={14} /> Patch bulkhead · 10 Alloys</button>
          {mountsOf(selShip).length ? (
            <div className="hud-sockets" aria-label="Weapon mount sockets">
              <div className="hud-fleet mono"><span>WEAPON SOCKETS</span><span>{s.alloys ? Math.floor(s.alloys) : 0} ALLOYS</span></div>
              {mountsOf(selShip).map((k, i) => {
                const nxt = nextMount(s.tech, k), cost = nxt ? SWAP_COST[nxt] : 0;
                const short = nxt && s.alloys < cost;
                const why = !nxt ? "Research Flak or Plasma Lances in the Tech Web to swap this socket." : short ? `Needs ${cost} Alloys.` : "";
                return (
                  <div className="hud-socket" key={i}>
                    <div className="hud-socket-head"><span className="hud-label">Socket {i + 1}</span><span className="mono" style={{color: MOUNTS[k].color}}>{MOUNTS[k].label}</span></div>
                    <button className="hud-btn" disabled={!nxt || short} title={why} onClick={() => swapMount(selShip.id, i)}>
                      <Icon name="power" size={14} /> {nxt ? `Swap to ${MOUNTS[nxt].label} · ${cost} Alloys` : "No upgrade unlocked"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          <button className={"hud-btn" + (selShip.overclock ? " on" : "")} onClick={toggleOverclock}><Icon name="power" size={14} /> Overclock thrusters</button>
          {selShip.type === "tender" ? <button className="hud-btn" onClick={() => { u.current.deployRelay = true; }}><Icon name="relay" size={14} /> Deploy relay · {selShip.sats ?? 3} left</button> : null}
          {selShip.type === "freighter" ? <div className="hud-fleet mono"><span>HOLD {Math.floor(selShip.cargo ?? 0)}/{CARGO_CAP}</span><span>{selShip.res ? selShip.res.toUpperCase() : "EMPTY"}</span></div> : null}
          {selShip.type === "probe" ? <div className="hud-fleet mono"><span>SCAN</span><span>{selShip.mode === "survey" ? `${Math.round((1 - (selShip.surveyLeft ?? SURVEY_TICKS) / SURVEY_TICKS) * 100)}%` : "IDLE"}</span></div> : null}
        </aside>
      ) : null}
      {u.current.governor ? (() => {
        const id = u.current.governor, idx = planetIndex(id), def = {yield: yieldOf(id)};
        const out = outputsOf().find((o) => o.planet === id);
        const surveyed = !!(s.surveyed ?? {})[id];
        return <GovernorPanel s={s} kernel={kernel} planet={sysRef.current.planets[idx]} idx={idx} base={def.yield}
          outputLabel={RESOURCE_LABEL[out.resource] ?? out.resource} secondary={surveyed && out.secondary ? {...out.secondary, label: RESOURCE_LABEL[out.secondary.resource] ?? out.secondary.resource} : null}
          onBuild={govBuild} onClose={closeGovernor} />;
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
          <div style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0", marginTop: 6}}>
            <div style={{display: "flex", justifyContent: "space-between"}}><b>Fuel Depot</b><span>Station</span></div>
            <div style={{fontSize: 12, opacity: 0.8, margin: "2px 0 4px"}}>Refuels and repairs docked ships. Place in orbit or deep space.</div>
            <div className="ship-badges mono"><span>150 CREDITS</span><span>80 ALLOYS</span><span>60 COOLANT</span></div>
            <button className="pill zelo" disabled={!!shortfall(s, DEPOT_COST)} onClick={() => { u.current.depotPlace = true; flash("Click a world to orbit it, or empty space to hold station."); refresh(); }}>Deploy fuel depot</button>
          </div>
          <div style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0", marginTop: 6}}>
            <div style={{display: "flex", justifyContent: "space-between"}}><b>Stellar Jump Gate</b><span>{st.current.jumpGate?.built ? "Online" : "Offline"}</span></div>
            <div style={{fontSize: 12, opacity: 0.8, margin: "2px 0 4px"}}>Folds space into a sector of your choice. Fleet, research and treasury come with you.</div>
            <div className="ship-badges mono"><span>600 CREDITS</span><span>300 ALLOYS</span><span>150 COMPUTE</span></div>
            <button className="pill zelo" disabled={!!st.current.jumpGate?.built || !!shortfall(s, JUMP_GATE_COST)} onClick={buildGate}>Build Jump Gate</button>
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
