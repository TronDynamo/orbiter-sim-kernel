// Combat visuals: weapon discharge, impacts, debris and damage, drawn with glow and motion so each effect reads
// as a physical event. Shared by the map and the tactical PIP: toS maps world to canvas, k scales sizes.
// Particles come from the combat state's pool and are drawn in place; nothing is allocated per particle.

// Kinetic Coilgun: a dual-pass hypervelocity tracer. A wide cyan bloom, then an incandescent white core.
function drawCoilTracer(ctx, toS, sh, k) {
  const head = toS(sh), tail = toS({x: sh.x - sh.vx * 0.05, y: sh.y - sh.vy * 0.05});
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(56,189,248,0.38)"; ctx.lineWidth = 5.5 * k;
  ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5 * k;
  ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(tail.x + (head.x - tail.x) * 0.35, tail.y + (head.y - tail.y) * 0.35); ctx.lineTo(head.x, head.y); ctx.stroke();
  ctx.shadowBlur = 0;
}

// Flak round: a short incandescent streak. The burst's rounds fly as a cluster.
function drawFlakRound(ctx, toS, sh, k) {
  const head = toS(sh), tail = toS({x: sh.x - sh.vx * 0.04, y: sh.y - sh.vy * 0.04});
  ctx.strokeStyle = "rgba(254,240,138,0.45)"; ctx.lineWidth = 3 * k; ctx.shadowColor = "#fef08a"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
  ctx.strokeStyle = "#fffbeb"; ctx.lineWidth = 1 * k; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(tail.x + (head.x - tail.x) * 0.5, tail.y + (head.y - tail.y) * 0.5); ctx.lineTo(head.x, head.y); ctx.stroke();
}

// Plasma lance: a superheated beam, orange outer, yellow-white core, with turbulence along its length.
function drawLanceBeam(ctx, toS, sh, k, t, idx) {
  const head = toS(sh), tail = toS({x: sh.x - sh.vx * 0.07, y: sh.y - sh.vy * 0.07});
  const dx = head.x - tail.x, dy = head.y - tail.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const jit = (j) => Math.sin(t * 38 + idx * 1.7 + j * 2.3) * 1.1 * k;
  const pathOf = (w) => {
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) {
      const u = j / 6, off = j === 0 || j === 6 ? 0 : jit(j) * (w / 4);
      const x = tail.x + dx * u + nx * off, y = tail.y + dy * u + ny * off;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(249,115,22,0.45)"; ctx.lineWidth = 10 * k; ctx.shadowColor = "#f97316"; ctx.shadowBlur = 18; pathOf(10 * k);
  ctx.strokeStyle = "#f97316"; ctx.lineWidth = 4.5 * k; ctx.shadowBlur = 10; pathOf(4.5 * k);
  ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 1.8 * k; ctx.shadowColor = "#fef08a"; ctx.shadowBlur = 6; pathOf(1.8 * k);
  ctx.shadowBlur = 0;
}

// Muzzle flare: a bright bloom plus six spikes that fall off as the flare ages.
function drawFlare(ctx, toS, e, k) {
  const q = toS(e), a = Math.max(0, e.life / e.max), r = e.size * k * (0.6 + 0.4 * (1 - a));
  const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 1.6);
  g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
  g.addColorStop(0.35, colorAlpha(e.color, 0.8 * a));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = colorAlpha(e.color, 0.7 * a); ctx.lineWidth = 1.2 * k;
  for (let i = 0; i < 6; i++) {
    const ang = i * Math.PI / 3 + (e.x + e.y) * 0.01, L = r * 1.9 * a;
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.cos(ang) * L, q.y + Math.sin(ang) * L); ctx.stroke();
  }
}

// Hex colours with alpha, for gradients and strokes.
function colorAlpha(hex, a) {
  if (!hex || hex[0] !== "#") return `rgba(255,255,255,${a.toFixed(3)})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

// Expanding shockwave ring at a contact point, fading as it spreads.
function drawShock(ctx, toS, e, k) {
  const q = toS(e), a = Math.max(0, e.life / e.max), r = e.r * k;
  ctx.strokeStyle = colorAlpha(e.color, 0.85 * a); ctx.lineWidth = 2.2 * k * a + 0.4;
  ctx.shadowColor = e.color; ctx.shadowBlur = 10 * a;
  ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
}

// A spark is a short streak along its velocity, so it reads as motion rather than a dot.
function drawSpark(ctx, toS, e, k) {
  const head = toS(e), tail = toS({x: e.x - e.vx * 0.04, y: e.y - e.vy * 0.04});
  const a = Math.max(0, e.life / e.max);
  ctx.globalAlpha = Math.min(1, a * 1.1);
  ctx.strokeStyle = e.color; ctx.lineWidth = 1.6 * k; ctx.shadowColor = e.color; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
  ctx.shadowBlur = 0;
}

// Composite armour: a rotating jagged polygon in dark composite with a molten edge that fades out.
function drawShard(ctx, toS, e, k) {
  const q = toS(e), a = Math.min(1, e.life / 1.2);
  ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(e.rot);
  ctx.globalAlpha = a;
  ctx.fillStyle = e.color;
  ctx.beginPath();
  e.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = e.edge ?? "#f97316"; ctx.lineWidth = 1.1 * k; ctx.shadowColor = e.edge ?? "#f97316"; ctx.shadowBlur = 7;
  ctx.stroke();
  ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

// Venting: a pale puff that spreads and thins as it drifts from the wreck.
function drawVent(ctx, toS, e, k) {
  const q = toS(e), a = Math.max(0, e.life / e.max), r = (4 + (1 - a) * 12) * k;
  const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
  g.addColorStop(0, colorAlpha(e.color, 0.35 * a)); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
}

// Raiders: crimson wedges with a hot leading edge, or their design's art when zoomed in (opts.detail with opts.art).
function drawRaider(ctx, toS, r, k, opts) {
  const q = toS(r), a = Math.atan2(r.vy, r.vx);
  ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a);
  const img = opts?.detail && opts.art ? opts.art(r) : null;
  if (img) {
    const L = 46 * k, h = L * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, -L / 2, -h / 2, L, h);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#7f1d1d"; ctx.strokeStyle = "#fca5a5"; ctx.lineWidth = 1 * k; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(8 * k, 0); ctx.lineTo(-6 * k, -5 * k); ctx.lineTo(-3 * k, 0); ctx.lineTo(-6 * k, 5 * k); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore(); ctx.shadowBlur = 0;
}

// Lance spool: a corona gathers at the mount and a ring fills as the charge completes.
function drawCharge(ctx, toS, ch, k, t) {
  const q = toS(ch), p = 1 - Math.max(0, ch.t) / ch.total, pulse = 0.85 + 0.15 * Math.sin(t * 30);
  const r = 9 * k * pulse;
  const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 2);
  g.addColorStop(0, "rgba(254,240,138,0.9)"); g.addColorStop(0.4, "rgba(249,115,22,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r * 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 1.5 * k; ctx.shadowColor = "#f97316"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.4, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
}

// Draws everything in one combat state. cb: combat state, toS: world to canvas, k: size scale, t: seconds.
export function drawCombatFx(ctx, toS, cb, k, t, opts) {
  for (const r of cb.raiders) drawRaider(ctx, toS, r, k, opts);
  const idx = new Map();
  for (const sh of cb.shots) {
    if (sh.kind === "kinetic") drawCoilTracer(ctx, toS, sh, k);
    else if (sh.kind === "flak") drawFlakRound(ctx, toS, sh, k);
    else {
      const i = idx.get(sh.mount ?? "plasma") ?? 0; idx.set(sh.mount ?? "plasma", i + 1);
      drawLanceBeam(ctx, toS, sh, k, t, i);
    }
  }
  for (const key of Object.keys(cb.charging)) drawCharge(ctx, toS, cb.charging[key], k, t);
  for (const e of cb.fx) {
    if (e.kind === "flare") drawFlare(ctx, toS, e, k);
    else if (e.kind === "shock") drawShock(ctx, toS, e, k);
    else if (e.kind === "spark") drawSpark(ctx, toS, e, k);
    else if (e.kind === "shard") drawShard(ctx, toS, e, k);
    else if (e.kind === "vent") drawVent(ctx, toS, e, k);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// Damage on a hull: scorch quadrants with a molten red edge, and micro-arcs once the hull is below half.
export function drawHullDamage(ctx, q, pct, k, t, rand = Math.random) {
  const d = 1 - pct;
  // burn scars on the forward and ventral quadrants, growing with damage
  const scars = [[3, -2, 5], [-6, 3, 4], [4, 4, 3]];
  for (let i = 0; i < scars.length; i++) {
    if (d < 0.2 * (i + 1)) continue;
    const [dx, dy, r] = scars[i];
    const x = q.x + dx * k, y = q.y + dy * k, rr = r * k * (0.8 + d * 0.6);
    ctx.fillStyle = `rgba(15,10,5,${(0.45 + 0.3 * d).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    if (d > 0.4) { ctx.strokeStyle = "rgba(239,68,68,0.85)"; ctx.lineWidth = 1 * k; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0; }
  }
  if (pct < 0.5 && rand() < 0.3) {
    ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 1 * k; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(q.x - 9 * k, q.y + (rand() - 0.5) * 6 * k);
    for (let j = 1; j <= 3; j++) ctx.lineTo(q.x - 9 * k + j * 6 * k, q.y + (rand() - 0.5) * 10 * k);
    ctx.stroke(); ctx.shadowBlur = 0;
  }
}
