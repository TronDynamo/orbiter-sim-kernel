// Hull data and vector drawing for the shipyard and the map. Each hull is drawn in a design space 100 units long,
// nose toward +x, and scaled to the requested length. Stroke widths are given in screen pixels.
export const SHIPS = {
  corvette: {name: 'Corvette', cost: {credits: 120, alloys: 40}, seconds: 5, power: 1, speed: 2.6, hull: 40, weapons: 'Twin ion cannons', blurb: 'Fast interceptor raider'},
  destroyer: {name: 'Destroyer', cost: {credits: 350, alloys: 180, cryo: 50}, seconds: 12, power: 4, speed: 1.8, hull: 120, weapons: 'Railgun + 4 flak', blurb: 'Screen and railgun escort'},
  cruiser: {name: 'Dreadnought', cost: {credits: 900, alloys: 520, compute: 120}, seconds: 25, power: 12, speed: 1.1, hull: 400, weapons: 'Spinal cannons + missiles', blurb: 'Heavy capital siege platform'},
};
export const SHIP_ORDER = ['corvette', 'destroyer', 'cruiser'];
export const COST_LABEL = {credits: 'Credits', alloys: 'Alloys', cryo: 'Coolant', compute: 'Compute'};

export const fleetPower = (fleet) => fleet.reduce((sum, f) => sum + (SHIPS[f.type]?.power ?? 0), 0);

// On-map length in screen pixels, per the flight spec.
export const FLIGHT_LENGTH = {corvette: 18, destroyer: 32, cruiser: 52};
export const HULL_SIZE = Object.fromEntries(Object.entries(FLIGHT_LENGTH).map(([k, v]) => [k, {length: v, beam: Math.round(v * 0.6)}]));

const DESIGN = 100;

// Exhaust: a tapered gradient with a hot core, plus drifting particles that thin out behind the nozzle.
function plume(ctx, x, y, len, width, rgb, thrust, t, seed) {
  if (thrust <= 0) return;
  const L = len * thrust * (0.88 + 0.12 * Math.sin(t * 26 + seed));
  const g = ctx.createLinearGradient(x, 0, x - L, 0);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.18, `rgba(${rgb},0.9)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, y - width / 2); ctx.lineTo(x - L, y); ctx.lineTo(x, y + width / 2); ctx.closePath(); ctx.fill();
  for (let k = 0; k < 5; k++) {
    const u = (t * 1.7 + seed * 0.37 + k * 0.2) % 1;
    const py = y + Math.sin(t * 9 + k * 2.1 + seed) * width * 0.22;
    ctx.fillStyle = `rgba(${rgb},${(0.7 * (1 - u)).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x - L * u, py, 1.6 * (1 - u * 0.6), 0, Math.PI * 2); ctx.fill();
  }
}

// Draws a hull centred on (x, y) with its nose along heading (radians).
// opts: length (screen px, defaults to the flight length), thrust 0..1, t seconds for flicker.
export function drawShip(ctx, type, x, y, heading, opts = {}) {
  const thrust = opts.thrust ?? 0, t = opts.t ?? 0;
  const length = opts.length ?? FLIGHT_LENGTH[type] ?? 20;
  const s = length / DESIGN;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(heading); ctx.scale(s, s);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const px = (w) => { ctx.lineWidth = w / s; };
  const poly = (pts, fill, stroke, w) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [a, b] of pts.slice(1)) ctx.lineTo(a, b);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; px(w); ctx.stroke(); }
  };
  const line = (pts, stroke, w) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [a, b] of pts.slice(1)) ctx.lineTo(a, b);
    ctx.strokeStyle = stroke; px(w); ctx.stroke();
  };
  const dot = (cx, cy, r, fill, stroke, w) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; px(w); ctx.stroke(); }
  };
  const mirror = (pts) => pts.map(([a, b]) => [a, -b]);

  if (type === "corvette") {
    // Needle raider: forward-swept strakes, a canopy slit, twin cyan ion nozzles and blaster blisters.
    plume(ctx, -46, -6, 36, 6, "0,240,255", thrust, t, 1);
    plume(ctx, -46, 6, 36, 6, "0,240,255", thrust, t, 2);
    for (const side of [1, -1]) {
      const f = (pts) => side > 0 ? pts : mirror(pts);
      poly(f([[12, -7], [-12, -8], [-34, -30], [-28, -30], [-14, -13], [8, -5]]), "#0c2236", "#38bdf8", 1);
    }
    poly([[50, 0], [34, -6], [8, -9], [-20, -9], [-42, -11], [-48, -7], [-48, 7], [-42, 11], [-20, 9], [8, 9], [34, 6]], "#0f172a", "#38bdf8", 1.5);
    line([[34, 0], [-40, 0]], "rgba(56,189,248,0.45)", 0.8);
    line([[30, -3], [10, -8], [-6, -9]], "#1e40af", 0.8);
    line([[30, 3], [10, 8], [-6, 9]], "#1e40af", 0.8);
    line([[-20, -4], [-40, -4]], "#1e40af", 0.6);
    line([[-20, 4], [-40, 4]], "#1e40af", 0.6);
    const g = ctx.createLinearGradient(14, 0, 30, 0);
    g.addColorStop(0, "#fbbf24"); g.addColorStop(1, "#22d3ee");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(22, 0, 8, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    dot(-6, -8, 2.2, "#0c4a6e", "#38bdf8", 0.6); dot(-6, 8, 2.2, "#0c4a6e", "#38bdf8", 0.6);
    for (const yy of [-6, 6]) { dot(-46, yy, 3.4, "#083344", "#00f0ff", 1.2); dot(-46, yy, 1.4, "#00f0ff"); }
  } else if (type === "destroyer") {
    // Split-bow catamaran: twin prows around an electrified spinal rail, flak blisters, triple thruster bells.
    for (const yy of [-14, 0, 14]) plume(ctx, -46, yy, 30, 7, "125,211,252", thrust, t, yy + 20);
    poly([[50, -6], [38, -2], [38, 2], [50, 6], [42, 14], [20, 20], [-10, 24], [-40, 24], [-46, 16], [-46, -16], [-40, -24], [-10, -24], [20, -20], [42, -14]], "#1e293b", "#94a3b8", 1.2);
    poly([[40, -10], [10, -16], [-30, -18], [-30, -12], [10, -10], [40, -4]], "#111c2e", "#334155", 0.6);
    poly([[40, 10], [10, 16], [-30, 18], [-30, 12], [10, 10], [40, 4]], "#111c2e", "#334155", 0.6);
    // spinal railgun channel
    poly([[-42, -3], [44, -2], [46, 0], [44, 2], [-42, 3]], "#0f172a", "#e0f2fe", 1);
    line([[-40, 0], [42, 0]], "#e0f2fe", 0.8);
    for (const xx of [-30, -18, -6, 6, 18, 30]) line([[xx, -2.6], [xx, 2.6]], "rgba(224,242,254,0.8)", 0.6);
    // flak blisters, recessed in the sponsons
    for (const [xx, yy] of [[10, -14], [10, 14], [-22, -14], [-22, 14]]) {
      dot(xx, yy, 4, "#0f172a", "#38bdf8", 0.8); dot(xx, yy, 1.6, "#38bdf8");
    }
    // bridge canopy
    poly([[28, -3], [22, -2.4], [22, 2.4], [28, 3]], "rgba(125,211,252,0.85)", "#e0f2fe", 0.5);
    for (const yy of [-14, 0, 14]) { dot(-46, yy, 2.8, "#0c4a6e", "#7dd3fc", 0.8); }
  } else if (type === "cruiser") {
    // Siege dreadnought: layered wedge with heat-sink grooves, a rear citadel, twin spinal cannons, missile silos.
    for (const yy of [-10, -3.5, 3.5, 10]) plume(ctx, -48, yy, 42, 9, "96,165,250", thrust, t, yy + 30);
    poly([[50, 0], [20, -16], [-10, -30], [-38, -30], [-50, -14], [-44, 0], [-50, 14], [-38, 30], [-10, 30], [20, 16]], "#0b1220", "#64748b", 1.2);
    poly([[38, 0], [16, -12], [-8, -22], [-34, -22], [-42, -10], [-42, 10], [-34, 22], [-8, 22], [16, 12]], "#111827", "#475569", 0.9);
    // heat-sink grooves glowing amber and red
    line([[30, -4], [-2, -14]], "#f59e0b", 0.9); line([[30, 4], [-2, 14]], "#f59e0b", 0.9);
    line([[20, -6], [-24, -18]], "#ef4444", 0.8); line([[20, 6], [-24, 18]], "#ef4444", 0.8);
    line([[-6, -16], [-30, -16]], "rgba(245,158,11,0.7)", 0.6); line([[-6, 16], [-30, 16]], "rgba(245,158,11,0.7)", 0.6);
    // rear citadel with antenna arrays
    poly([[-20, -8], [-6, -8], [-6, 8], [-20, 8]], "#1f2937", "#38bdf8", 0.9);
    line([[-13, -8], [-13, -18]], "#e0f2fe", 0.6); line([[-9, -8], [-9, -15]], "#e0f2fe", 0.6); line([[-17, -8], [-17, -15]], "#e0f2fe", 0.6);
    dot(-13, -18, 1.4, "#38bdf8");
    // twin spinal magnetic cannons
    for (const yy of [-5, 5]) {
      poly([[-6, yy - 2], [46, yy - 1.6], [46, yy + 1.6], [-6, yy + 2]], "#334155", "#cbd5e1", 0.6);
      dot(46, yy, 1.8, "#fb923c", "#fde68a", 0.4);
    }
    // broadside blisters and missile silo doors
    for (const sg of [1, -1]) {
      dot(-2, 22 * sg, 3.5, "#111827", "#f59e0b", 0.8);
      poly([[-26, 20 * sg], [-18, 20 * sg], [-18, 24 * sg], [-26, 24 * sg]], "#0f172a", "#ef4444", 0.7);
    }
    // quad fusion thrusters
    for (const yy of [-10, -3.5, 3.5, 10]) dot(-50, yy, 3, "#0c4a6e", "#60a5fa", 0.8);
  }
  ctx.restore();
}
