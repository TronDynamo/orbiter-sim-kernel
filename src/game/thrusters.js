// Animated engine flames for commander ship art. Engine points come from public/assets/ships/<leader>/engines.json,
// normalised to the sprite (0..1, origin top-left, nose along +x). The flame sits at each engine and streams aft.
const ENGINE_DATA = {};   // leader key -> parsed engines.json (or false when the file is missing)

export function loadEngines(leaderKey, base) {
  if (ENGINE_DATA[leaderKey] !== undefined) return;
  ENGINE_DATA[leaderKey] = false;
  fetch(`${base}/ships/${leaderKey}/engines.json`).then((r) => (r.ok ? r.json() : null))
    .then((j) => { ENGINE_DATA[leaderKey] = j ?? false; })
    .catch(() => { ENGINE_DATA[leaderKey] = false; });
}

// Engine points for one ship role, or null until the file has loaded.
export function enginesFor(leaderId, role, base) {
  if (!leaderId || !role) return null;
  const key = leaderId.split("_")[0];
  loadEngines(key, base);
  const d = ENGINE_DATA[key];
  return d ? (d[role] ?? []) : null;
}

// Draws flames behind the origin-centred sprite of size w x h (nose along +x). thrust 0..1 sets the length.
// With no engine points, a single flame sits at the stern centre.
export function drawThrusters(ctx, w, h, engines, thrust = 0, t = performance.now() / 1000) {
  const pts = engines && engines.length ? engines : [{x: 0.04, y: 0.5, r: 0.03}];
  const level = Math.max(0.15, Math.min(1, thrust));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  pts.forEach((e, i) => {
    const px = -w / 2 + e.x * w, py = -h / 2 + e.y * h;
    const width = Math.max(2, (e.r ?? 0.03) * w * 2.2);
    const flick = 0.82 + 0.18 * Math.sin(t * 27 + i * 1.9) + 0.08 * Math.sin(t * 61 + i * 0.7);
    const len = w * 0.16 * level * flick;
    const g = ctx.createLinearGradient(px, py, px - len, py);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.25, "rgba(125,211,252,0.85)");
    g.addColorStop(0.7, "rgba(56,189,248,0.35)");
    g.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px, py - width / 2);
    ctx.quadraticCurveTo(px - len * 0.55, py - width * 0.35 * flick, px - len, py);
    ctx.quadraticCurveTo(px - len * 0.55, py + width * 0.35 * flick, px, py + width / 2);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}
