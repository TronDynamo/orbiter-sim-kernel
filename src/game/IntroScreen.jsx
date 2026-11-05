// Title screen for Orbiter: Stellar Conquest. Starfield and orbits, then Continue Campaign, New Campaign
// (sector seed and difficulty), Load Game (save slots), Settings, the Faction Database and Credits.
// Every route into the game plays the warp sequence first.
import {useEffect, useRef, useState} from "react";
import "./intro.css";
import {FACTIONS} from "./factions.js";
import {DIFFICULTIES, randomSeed, sectorName} from "./campaign.js";
import {createAudio} from "./audio.js";
import {listSaves, loadGame, fmtElapsed} from "./saveManager.js";
import {SlotBrowser} from "./SlotBrowser.jsx";
import {SettingsModal} from "./SettingsModal.jsx";

// Decorative orbits for the title backdrop (not the game simulation).
const BACKDROP_PLANETS = [
  {r: 110, angle: 0.3, speed: 0.008, size: 6, color: "#f59e0b"},
  {r: 180, angle: 1.9, speed: 0.005, size: 8, color: "#38bdf8"},
  {r: 270, angle: 3.4, speed: 0.003, size: 7, color: "#ef4444"},
  {r: 370, angle: 4.8, speed: 0.0018, size: 10, color: "#34d399"},
];

export function IntroScreen({kernelStatus, onStart, onLoad}) {
  const canvasRef = useRef(null);
  const warpRef = useRef(false);
  const audioRef = useRef(null);
  const [warping, setWarping] = useState(false);
  const [panel, setPanel] = useState(null); // null | "new" | "load" | "settings" | "roster" | "credits"
  const [, setSaveTick] = useState(0);      // re-reads the save list after a delete
  const [seedText, setSeedText] = useState("");
  if (!audioRef.current) audioRef.current = createAudio();
  const kernelOnline = kernelStatus === "ONLINE";
  const saves = listSaves();
  const latest = saves[0]?.data ?? null;
  const seedPreview = seedText.trim() ? sectorName(seedText.trim()) : null;

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext("2d");
    let w = 0, h = 0, stars = [], raf = 0, planets = BACKDROP_PLANETS.map((p) => ({...p}));
    const createStars = () => {
      stars = [];
      const n = Math.floor((w * h) / 3500) + 120;
      for (let i = 0; i < n; i++) stars.push({
        x: (Math.random() - 0.5) * w * 2, y: (Math.random() - 0.5) * h * 2, z: Math.random() * 1000 + 1, pz: 1000,
        color: Math.random() > 0.8 ? "#38bdf8" : Math.random() > 0.6 ? "#f59e0b" : "#ffffff",
      });
    };
    const resize = () => {
      w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; createStars();
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const warpingNow = warpRef.current;
      ctx.fillStyle = warpingNow ? "rgba(3,7,18,0.3)" : "#030712";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (const s of stars) {
        s.pz = s.z;
        s.z -= warpingNow ? 45 : 1.2;
        if (s.z <= 1) { s.z = 1000; s.pz = 1000; s.x = (Math.random() - 0.5) * w * 2; s.y = (Math.random() - 0.5) * h * 2; }
        const k = 250 / s.z, pk = 250 / s.pz;
        const px = s.x * k + cx, py = s.y * k + cy, ppx = s.x * pk + cx, ppy = s.y * pk + cy;
        if (px >= 0 && px <= w && py >= 0 && py <= h) {
          ctx.beginPath(); ctx.strokeStyle = s.color;
          ctx.lineWidth = Math.min(2.5, (1 - s.z / 1000) * (warpingNow ? 4 : 1.8));
          ctx.moveTo(ppx, ppy); ctx.lineTo(px, py); ctx.stroke();
        }
      }
      if (!warpingNow) {
        const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 80);
        grad.addColorStop(0, "#fff"); grad.addColorStop(0.3, "#fef08a"); grad.addColorStop(0.6, "#f59e0b"); grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.fill();
        planets.forEach((p, i) => {
          p.angle += p.speed;
          ctx.beginPath(); ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1; ctx.stroke();
          const px = cx + Math.cos(p.angle) * p.r, py = cy + Math.sin(p.angle) * p.r;
          if (i > 0) {
            const q = planets[i - 1], qx = cx + Math.cos(q.angle) * q.r, qy = cy + Math.sin(q.angle) * q.r;
            ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py);
            ctx.strokeStyle = "rgba(56,189,248,0.15)"; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        });
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    const onFirstClick = () => audioRef.current.start();
    window.addEventListener("click", onFirstClick, {once: true});
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onFirstClick);
    };
  }, []);

  // Plays the warp, then hands over to the game (or the loaded save) once the sequence ends.
  const go = (next) => {
    if (!kernelOnline || warpRef.current) return;
    audioRef.current.warp();
    warpRef.current = true;
    setWarping(true);
    setPanel(null);
    setTimeout(next, 1400);
  };
  const beginNew = (difficulty) => {
    const seed = seedText.trim() || randomSeed();
    go(() => onStart({seed, difficulty}));
  };
  const continueLatest = () => { if (latest) go(() => onLoad(latest)); };
  const loadSlot = (id) => { const data = loadGame(id); if (data) go(() => onLoad(data)); };
  const closePanel = () => setPanel(null);
  const modalOpen = panel === "new" || panel === "roster" || panel === "credits";

  return (
    <div className="intro-root">
      <canvas ref={canvasRef} className="intro-canvas" />
      <div className="intro-crt" />

      <div className="intro-top">
        <div className="intro-badge">
          <div className="intro-dot" />
          <span>AUDIO: READY</span>
        </div>
        <div><span className="intro-core">KERNEL:</span> {kernelOnline ? "ONLINE" : "LOADING"}</div>
      </div>

      <div className="intro-hud" style={{opacity: warping ? 0 : 1, transform: warping ? "scale(0.9)" : "none"}}>
        <div className="intro-pill"><span>●</span> Sector Expansion Protocol</div>
        <h1 className="intro-title">ORBITER</h1>
        <h2 className="intro-sub">Stellar Conquest</h2>
        <p className="intro-lore">
          Dynamic orbital motion meets interspecies warfare. Weave hardlight supply tethers between moving worlds,
          construct modular starfleets, and negotiate survival with 20 galactic factions.
        </p>
        <div className="intro-buttons" style={{display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch"}}>
          <button className={latest ? "intro-start" : "intro-secondary"} onClick={continueLatest} disabled={!kernelOnline || !latest}>
            Continue Campaign
            <small style={{display: "block", fontWeight: 400, opacity: 0.85, fontSize: 12}}>
              {latest
                ? `${latest.sector} · ${fmtElapsed(latest.elapsed)} · Pop ${(latest.population / 1e6).toFixed(1)}M`
                : "No saved campaign yet"}
            </small>
          </button>
          <button className={latest ? "intro-secondary" : "intro-start"} onClick={() => setPanel("new")} disabled={!kernelOnline}>
            {kernelOnline ? "New Campaign" : "Kernel loading…"}
          </button>
          <button className="intro-secondary" onClick={() => setPanel("load")} disabled={!kernelOnline || !saves.length}>Load Game</button>
          <button className="intro-secondary" onClick={() => setPanel("settings")}>Settings</button>
          <button className="intro-secondary" onClick={() => setPanel("roster")}>Faction Database (20)</button>
          <button className="intro-secondary" onClick={() => setPanel("credits")}>Credits</button>
        </div>
        <div className="intro-grid">
          <div><span>ORBITS</span><strong style={{color: "#38bdf8"}}>Keplerian Loop</strong></div>
          <div><span>LEADERS</span><strong style={{color: "#f59e0b"}}>20 Factions</strong></div>
          <div><span>TETHERS</span><strong style={{color: "#34d399"}}>Tensile Elastic</strong></div>
          <div><span>CATACLYSMS</span><strong style={{color: "#f87171"}}>Superweapons</strong></div>
        </div>
      </div>

      <div className={`intro-warp${warping ? " on" : ""}`}>
        <div className="intro-spinner" />
        <div style={{fontWeight: 800, fontSize: 18, letterSpacing: "0.25em", color: "#38bdf8", textTransform: "uppercase", marginBottom: 8}}>
          Engaging Slipstream Conduit
        </div>
        <div style={{fontFamily: "monospace", fontSize: 13, color: "#64748b"}}>Synchronizing Planetary Orbits to Sol Core...</div>
      </div>

      {modalOpen ? (
        <div className="intro-modal open" onClick={(e) => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="intro-box">
            <div className="intro-box-head">
              <div>
                <h3 style={{fontSize: 18, fontWeight: 800, letterSpacing: "0.1em", color: "#38bdf8", textTransform: "uppercase"}}>
                  {panel === "new" ? "New Campaign" : panel === "roster" ? "Galactic Senate Factions" : "Credits"}
                </h3>
                <p style={{fontSize: 12, color: "#64748b", fontFamily: "monospace"}}>
                  {panel === "new" ? "Sector seed and difficulty" : panel === "roster" ? "20 Interspecies Factions Across 5 Blocs" : "Orbiter: Stellar Conquest"}
                </p>
              </div>
              <button className="intro-close" onClick={closePanel} aria-label="Close">×</button>
            </div>

            {panel === "new" ? (
              <div style={{display: "flex", flexDirection: "column", gap: 12, padding: 4}}>
                <div style={{fontSize: 13, opacity: 0.85}}>The seed sets where the worlds start in their orbits and names the sector. Leave it blank for a random sector.</div>
                <div className="seed-row">
                  <input value={seedText} onChange={(e) => setSeedText(e.target.value.slice(0, 24))} placeholder="random"
                    style={{flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", fontFamily: "monospace"}} />
                  <button className="intro-secondary" onClick={() => setSeedText(randomSeed())}>Roll</button>
                </div>
                {seedPreview ? <div className="mono" style={{fontSize: 12, color: "#64748b"}}>Sector: {seedPreview}</div> : null}
                <div style={{fontSize: 12, opacity: 0.8}}>Pick a difficulty to start the campaign:</div>
                {Object.entries(DIFFICULTIES).map(([key, d]) => (
                  <button key={key} className="difficulty-option" onClick={() => beginNew(key)} disabled={!kernelOnline}>
                    <b>{d.label}</b>
                    <span>{d.blurb}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {panel === "roster" ? (
              <div className="intro-list">
                {FACTIONS.map((f) => (
                  <div className="intro-faction" key={f.id}>
                    <div><strong style={{color: f.color, display: "block"}}>{f.name} (#{f.number})</strong><small>{f.sub}</small><small style={{display: "block", opacity: 0.85}}>{f.trait}</small></div>
                    <span className="intro-badge-faction" style={{color: f.color}}>{f.bloc}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {panel === "credits" ? (
              <div style={{display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.5, padding: 4}}>
                <div><b>Orbit kernel</b>: C++17 compiled to WebAssembly with Emscripten 4.0.9. Capacity: 64 worlds, 256 conduits, 128 missiles, 1,024 asteroids. Runs at 60 ticks per second.</div>
                <div><b>Front end</b>: React and Vite, drawn on HTML canvas.</div>
                <div><b>Audio</b>: synthesised in the browser with the Web Audio API. No sound files.</div>
                <div><b>Saves</b>: the kernel stores a replay of your changes; autosave, quick save and three manual slots are kept in this browser.</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {panel === "load" ? (
        <SlotBrowser mode="load" onPick={loadSlot} onClose={closePanel} onChanged={() => setSaveTick((t) => t + 1)} />
      ) : null}
      {panel === "settings" ? (
        <SettingsModal onChange={() => audioRef.current.applyLevels()} onClose={closePanel} />
      ) : null}
    </div>
  );
}
