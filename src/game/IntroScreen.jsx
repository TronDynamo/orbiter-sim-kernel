// Title screen for Orbiter: Stellar Conquest. Ported from the cinematic intro: starfield, warp
// sequence, faction roster. "Initialize Sector" starts the warp and then calls onLaunch().
import {useEffect, useRef, useState} from "react";
import "./intro.css";
import {FACTIONS} from "./factions.js";



// Decorative orbits for the title backdrop (not the game simulation).
const BACKDROP_PLANETS = [
  {r: 110, angle: 0.3, speed: 0.008, size: 6, color: "#f59e0b"},
  {r: 180, angle: 1.9, speed: 0.005, size: 8, color: "#38bdf8"},
  {r: 270, angle: 3.4, speed: 0.003, size: 7, color: "#ef4444"},
  {r: 370, angle: 4.8, speed: 0.0018, size: 10, color: "#34d399"},
];

// Synthesised audio (Web Audio). Created on the first user gesture.
function makeAudio() {
  let ctx = null;
  const start = () => {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(55, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 2);
      osc.connect(gain); gain.connect(ctx.destination); osc.start();
    } catch (e) { ctx = null; }
    return ctx;
  };
  const warp = () => {
    if (!ctx) start();
    if (!ctx) return;
    const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(800, now + 1.2);
    gain.gain.setValueAtTime(0.01, now); gain.gain.exponentialRampToValueAtTime(0.3, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(now + 1.5);
  };
  return {start, warp};
}

export function IntroScreen({kernelStatus, onLaunch}) {
  const canvasRef = useRef(null);
  const warpRef = useRef(false);
  const audioRef = useRef(null);
  const [warping, setWarping] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  if (!audioRef.current) audioRef.current = makeAudio();
  const kernelOnline = kernelStatus === "ONLINE";

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

  const launch = () => {
    if (!kernelOnline || warpRef.current) return;
    audioRef.current.warp();
    warpRef.current = true;
    setWarping(true);
    setTimeout(onLaunch, 1400);
  };

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
        <div className="intro-buttons">
          <button className="intro-start" onClick={launch} disabled={!kernelOnline}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            {kernelOnline ? "Initialize Sector" : "Kernel loading…"}
          </button>
          <button className="intro-secondary" onClick={() => setRosterOpen(true)}>Faction Database (20)</button>
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

      <div className={`intro-modal${rosterOpen ? " open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setRosterOpen(false); }}>
        <div className="intro-box">
          <div className="intro-box-head">
            <div>
              <h3 style={{fontSize: 18, fontWeight: 800, letterSpacing: "0.1em", color: "#38bdf8", textTransform: "uppercase"}}>Galactic Senate Factions</h3>
              <p style={{fontSize: 12, color: "#64748b", fontFamily: "monospace"}}>20 Interspecies Factions Across 5 Blocs</p>
            </div>
            <button className="intro-close" onClick={() => setRosterOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="intro-list">
            {FACTIONS.map((f) => (
              <div className="intro-faction" key={f.name}>
                <div><strong style={{color: f.color, display: "block"}}>{f.name} (#{f.number})</strong><small>{f.sub}</small></div>
                <span className="intro-badge-faction" style={{color: f.color}}>{f.bloc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
