// Orbiter: Stellar Conquest screen. Reuses Orbit's solar-system scene (C++ WebAssembly orbit engine,
// planets, dying star, starfield, styling). Tethers, the Ark and mission telemetry sit on top.
import {useEffect, useRef, useState} from "react";
import {OrbitScene} from "../orbit/scene.js";
import {BODY_STRIDE} from "../orbit/engine.js";
import {GAME_GALAXY, PLANET_IDS, ARK_POS} from "./galaxy.js";
import {loadOrbiterKernel, TICKS_PER_SECOND, WEAPON, CONDUIT_ERR, CONDUIT_RULES} from "./kernel/orbiterKernel.js";
import {IntroScreen} from "./IntroScreen.jsx";
import {RULES, newState, snapTethers, network, tick, tryTether, checkTether, cut, tetherAt, tensionOf, tensionColor, build, hitBody, distToTether, orderShip, shortfall} from "./rules.js";
import {SHIPS, SHIP_ORDER, COST_LABEL, drawShip, fleetPower} from "./ships.js";

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
const FLEET_ORBIT = 26;   // world units around Ferrum where hulls hold orbit
const PLANET_OUTPUT = [
  {planet: "thalassa", resource: "biomass"},
  {planet: "aeros", resource: "cryo"},   // Coolant
  {planet: "ferrum", resource: "alloys"},
  {planet: "kryos", resource: "compute"},
];
const planetName = (id) => GAME_GALAXY.planets.find((p) => p.id === id)?.name ?? id;
const planetIndex = (id) => GAME_GALAXY.planets.findIndex((p) => p.id === id);

// The live session. The kernel is loaded once by GameApp and passed in; each session starts it from zero.
function GameSession({kernel}) {
  const canvasRef = useRef(null), overlayRef = useRef(null);
  const st = useRef(newState());
  const u = useRef({drag: null, mode: null, msg: START_MSG, msgWin: false, paused: false, speed: 1, tick: 0, shipyard: false});
  const [ui, setUi] = useState({...u.current});
  const refresh = () => setUi({...u.current});

  useEffect(() => {
    const scene = new OrbitScene(canvasRef.current, {}, {galaxies: {game: GAME_GALAXY}, galaxyId: "game"});
    scene.zoomBy(0.8); // frame all four orbits clear of the telemetry panel and the dock
    const ov = overlayRef.current, ctx = ov.getContext("2d");
    const s0 = u.current;
    let raf = 0, lastUi = 0, lastGame = -1;

    // The simulation kernel is the source of truth for planet positions. It ticks to match the
    // game clock (sim.c[5], seconds) so pause and speed controls still apply.
    let kBase = null;
    kernel.reset();
    const syncKernel = () => {
      if (!kernel || !scene.sim) return false;
      const gameT = scene.sim.c[5];
      if (kBase === null) kBase = gameT;
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
    const gainSeen = PLANET_OUTPUT.map(() => 0); // kernel totals already credited to the stockpile
    let creditSeen = 0;                          // kernel credit total already credited

    const onDown = (e) => {
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
      const id = hitBody(st.current, P, p);
      if (id) s0.drag = {from: id, cur: p};
      ov.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => { if (s0.drag) s0.drag.cur = toWorld(e); };
    const onUp = () => {
      const P = positions();
      if (s0.drag && P) {
        const target = hitBody(st.current, P, s0.drag.cur);
        if (target && target !== s0.drag.from) {
          if (isPlanet(s0.drag.from) && isPlanet(target)) buildConduit(s0.drag.from, target);
          else { const r = tryTether(st.current, s0.drag.from, target, P); say(r.msg); }
        }
      }
      s0.drag = null;
    };
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
          const col = snapped ? "#EF4444" : occluded ? "rgba(148,163,184,0.35)" : len > CONDUIT_RULES.amberLength ? "#F5C542" : "#10B981";
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(snapped ? [4, 6] : []);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
          const m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
          ctx.font = "11px system-ui"; ctx.fillStyle = col; ctx.textAlign = "center";
          ctx.fillText(snapped ? "snapped" : occluded ? "in shadow" : `${Math.round(kernel.conduits.throughput[c])} flow · ${Math.round(len)}u`, m.x, m.y - 6);
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
          ctx.fillStyle = kernel.missiles.type[m] === WEAPON.STARKILLER ? "#ff3b3b" : "#ffb35a";
          ctx.beginPath(); ctx.arc(q.x, q.y, 3 + scene.base, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(160,160,170,0.8)";
        for (let a = 0; a < kernel.asteroidCount; a++) {
          const q = toS({x: kernel.asteroids.x[a], y: kernel.asteroids.y[a]});
          ctx.fillRect(q.x, q.y, 2, 2);
        }
      }

      // fleet: procedurally drawn hulls holding orbit around Ferrum
      const fer = P.ferrum;
      if (fer && s.fleet.length) {
        const t = kernel ? kernel.tickCount / TICKS_PER_SECOND : 0;
        for (const f of s.fleet) {
          const ang = f.phase + t * 0.7;
          const q = toS({x: fer.x + Math.cos(ang) * FLEET_ORBIT, y: fer.y + Math.sin(ang) * FLEET_ORBIT});
          drawShip(ctx, f.type, q.x, q.y, ang + Math.PI / 2, 11);
        }
      }

      // Ark, relays, labels
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const ark = toS(ARK_POS);
      ctx.font = "20px system-ui"; ctx.fillText("🚀", ark.x, ark.y);
      ctx.font = "12px system-ui"; ctx.fillStyle = "#cfd8e6"; ctx.fillText("Ark Endeavor", ark.x, ark.y - 20);
      for (const r of s.relays) {
        const q = toS(r);
        ctx.font = "16px system-ui"; ctx.fillText("📡", q.x, q.y);
        ctx.font = "10px system-ui"; ctx.fillStyle = r.hp < 15 ? "#ff8a8a" : "#9fb3cc"; ctx.fillText(`${Math.max(0, Math.round(r.hp))}`, q.x, q.y + 14);
      }
      ctx.font = "12px system-ui"; ctx.fillStyle = "#cfd8e6";
      for (const p of GAME_GALAXY.planets) { const q = toS(P[p.id]); ctx.fillText(p.name, q.x, q.y - 22); }
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    };

    const loop = (now) => {
      const sim = scene.sim, P = positions();
      if (P && sim) {
        const s = st.current, gameT = sim.c[5];
        if (lastGame < 0) { lastGame = Math.floor(gameT); s.lastTick = lastGame; }
        for (const msg of snapTethers(s, P, now)) say(msg);
        if (kernel) {
          const total = kernel.creditTotal, d = total - creditSeen;
          if (d > 0) { s.credits += d; creditSeen = total; }
        }
        // Siphoning: the kernel adds each world's output to its running total every tick; credit the difference.
        if (kernel) PLANET_OUTPUT.forEach((o, i) => {
          const idx = planetIndex(o.planet), total = kernel.planets.gainTotal[idx], d = total - gainSeen[i];
          if (d > 0) { s[o.resource] += d; gainSeen[i] = total; }
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
          for (const ev of tick(s, P)) say(ev.msg, !!ev.win);
        }
        if (s.won || s.lost) scene.speed = 0;
        drawOverlay(P, now);
        s0.tick = Math.floor(gameT);
        if (now - lastUi > 150) { lastUi = now; setUi({...s0}); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const setSpeedKey = (v) => { s0.speed = v; s0.paused = false; scene.speed = v; refresh(); };
    const onKey = (e) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.key === "1" || e.key === "2" || e.key === "4") setSpeedKey(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    window.__relic = {scene, u: s0, st, say, refresh, get kernel() { return kernel; }, resetKernel: () => { kernel.reset(); kBase = null; gainSeen.fill(0); creditSeen = 0; snapSeen.clear(); }};
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sizeOverlay);
      window.removeEventListener("keydown", onKey);
      ov.removeEventListener("pointerdown", onDown);
      ov.removeEventListener("pointermove", onMove);
      ov.removeEventListener("pointerup", onUp);
      ov.removeEventListener("pointercancel", onUp);
      scene.destroy();
      delete window.__relic;
    };
  }, []);

  function togglePause() {
    const sc = window.__relic?.scene; if (!sc || st.current.won || st.current.lost) return;
    u.current.paused = !u.current.paused;
    sc.speed = u.current.paused ? 0 : u.current.speed;
    refresh();
  }
  function toggleShipyard() { u.current.shipyard = !u.current.shipyard; refresh(); }
  function buildHull(type) { const r = orderShip(st.current, type); u.current.msg = r.msg; refresh(); }
  function setSpeed(v) {
    u.current.speed = v; u.current.paused = false;
    const sc = window.__relic?.scene; if (sc) sc.speed = v;
    refresh();
  }
  function setMode(m) {
    u.current.mode = u.current.mode === m ? null : m;
    const txt = {relay: "Click the map to place a relay satellite.", repair: "Click anywhere to confirm the hull patch.", cut: "Click a tether to decouple it safely."};
    u.current.msg = u.current.mode ? txt[u.current.mode] : "Cancelled.";
    refresh();
  }
  function repairNow() {
    const P = window.__relic?.scene ? null : null;
    const r = build(st.current, "repair", {x: 0, y: 0}, P || {});
    u.current.msg = r.msg; refresh();
  }
  function restart() {
    const sc = window.__relic?.scene;
    window.__relic?.resetKernel?.();
    st.current = newState();
    st.current.lastTick = Math.floor(sc?.sim?.c?.[5] ?? 0);
    Object.assign(u.current, {drag: null, mode: null, msg: START_MSG, msgWin: false});
    if (sc) sc.speed = u.current.paused ? 0 : u.current.speed;
    refresh();
  }

  const s = st.current;
  const over = s.won || s.lost;
  const yr = s.year || 1;
  const radiationLabel = ["Low", "Rising", "High", "Severe", "Critical"][Math.min(4, Math.max(0, s.radiation))];
  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" />
      <canvas ref={overlayRef} className="stage" style={{pointerEvents: "auto", cursor: u.current.mode ? "crosshair" : "default"}} />

      <div className="brand glass">
        <div className="brand-kicker mono">ORBITER: STELLAR CONQUEST · MISSION TELEMETRY</div>
        <div className="row"><span>💳 Credits</span><b>{Math.floor(s.credits)}</b></div>
        <div className="row"><span>🌱 Biomass</span><b>{Math.floor(s.biomass)}</b></div>
        <div className="row"><span>🔩 Alloys</span><b>{Math.floor(s.alloys)}</b></div>
        <div className="row"><span>🧠 Compute</span><b>{Math.floor(s.compute)}</b></div>
        <div className="row"><span>❄️ Coolant</span><b>{Math.floor(s.cryo)}</b></div>
        <div className="row"><span>🚀 Fleet</span><b>{s.fleet.length}</b></div>
        <div className="row"><span>⚡ Fleet power</span><b>{fleetPower(s.fleet)}</b></div>
        <div className="row"><span>🛡️ Hull</span><b>{Math.max(0, Math.round(s.hull))}%</b></div>
        <div className="row"><span>⛽ Fuel</span><b>{Math.floor(s.fuel)}</b></div>
        <div className="row"><span>🔥 Propellant</span><b>{Math.floor(s.propellant)}</b></div>
        <div className="row"><span>🌀 Singularity data</span><b>{Math.floor(s.data)} / {RULES.DATA_GOAL}</b></div>
        <div className="row"><span>☢️ Radiation</span><b>{radiationLabel}</b></div>
        <div className="row"><span>Year</span><b>{yr}</b></div>
      </div>

      <div className="top-right" style={{gap: 8}}>
        <button className="pill glass zelo" onClick={togglePause}>{u.current.paused ? "Resume" : "Pause"}</button>
        {[1, 2, 4].map((v) => (
          <button key={v} className={"pill glass zelo" + (u.current.speed === v && !u.current.paused ? " on" : "")} onClick={() => setSpeed(v)}>{v}x</button>
        ))}
        <button className="pill glass zelo" onClick={restart}>Restart</button>
      </div>

      {u.current.msg ? <div className={"toast glass" + (u.current.msgWin ? " win" : "")} style={{top: 60, pointerEvents: "none", maxWidth: 300, textAlign: "center", whiteSpace: "normal"}}>{u.current.msg}</div> : null}

      <footer className="dock glass" style={{flexWrap: "wrap", gap: 6, justifyContent: "center"}}>
        <button className={"pill zelo" + (u.current.mode === "relay" ? " on" : "")} onClick={() => setMode("relay")}>📡 Relay satellite · 15🔩 5❄️</button>
        <button className={"pill zelo" + (u.current.mode === "repair" ? " on" : "")} onClick={() => setMode("repair")}>🛡️ Patch hull · 10🔩</button>
        <button className={"pill zelo" + (u.current.mode === "cut" ? " on" : "")} onClick={() => setMode("cut")}>✂️ Decouple tether</button>
        <button className={"pill zelo" + (u.current.shipyard ? " on" : "")} onClick={toggleShipyard}>🚀 Shipyard</button>
      </footer>

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
                <div style={{display: "flex", justifyContent: "space-between"}}><b>{ship.name}</b><span>{ship.seconds}s build</span></div>
                <div style={{fontSize: 12, opacity: 0.8, margin: "2px 0 4px"}}>{ship.blurb} · power {ship.power}</div>
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
  useEffect(() => {
    let alive = true;
    loadOrbiterKernel()
      .then((k) => { if (alive) setKernel(k); })
      .catch((err) => console.error("Orbiter kernel failed to load:", err));
    return () => { alive = false; };
  }, []);
  if (screen === "intro" || !kernel) {
    return <IntroScreen kernelStatus={kernel ? "ONLINE" : "LOADING"} onLaunch={() => setScreen("game")} />;
  }
  return <GameSession kernel={kernel} />;
}
