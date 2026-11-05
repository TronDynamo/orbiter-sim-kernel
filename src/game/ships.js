// Hull data and procedural vector drawing for the shipyard and the map. Costs use the stockpile field names in
// rules.js (cryo is shown as Coolant). Power is a game balance value used for Fleet Power.
export const SHIPS = {
  corvette: {name: 'Corvette', cost: {credits: 120, alloys: 40}, seconds: 5, power: 1, blurb: 'Beam-rider raider'},
  destroyer: {name: 'Destroyer', cost: {credits: 350, alloys: 180, cryo: 50}, seconds: 12, power: 4, blurb: 'Screen destroyer'},
  cruiser: {name: 'Dreadnought', cost: {credits: 900, alloys: 520, compute: 120}, seconds: 25, power: 12, blurb: 'Siege dreadnought'},
};
export const SHIP_ORDER = ['corvette', 'destroyer', 'cruiser'];
export const COST_LABEL = {credits: 'Credits', alloys: 'Alloys', cryo: 'Coolant', compute: 'Compute'};

export const fleetPower = (fleet) => fleet.reduce((sum, f) => sum + (SHIPS[f.type]?.power ?? 0), 0);

// Hull sizes on the map, in screen pixels (nose to tail, and across the beam).
export const HULL_SIZE = {corvette: {length: 18, beam: 12}, destroyer: {length: 32, beam: 18}, cruiser: {length: 54, beam: 32}};

const flicker = (t, i) => 0.8 + 0.2 * Math.sin(t * 22 + i * 1.7);
function plume(ctx, x, y, len, width, thrust, t, i = 0) {
  if (thrust <= 0) return;
  const L = len * thrust * flicker(t, i);
  const g = ctx.createLinearGradient(x, 0, x - L, 0);
  g.addColorStop(0, 'rgba(186,230,253,0.95)'); g.addColorStop(0.3, 'rgba(56,189,248,0.7)'); g.addColorStop(1, 'rgba(56,189,248,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, y - width / 2); ctx.lineTo(x - L, y); ctx.lineTo(x, y + width / 2); ctx.closePath(); ctx.fill();
}
function poly(ctx, pts, fill, stroke, lw = 0.6) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// Draws a hull centred on (x, y) with its nose along heading (radians). Local units are screen pixels.
// opts: thrust 0..1 (ion or impulse plume), t seconds (plume flicker), scale.
export function drawShip(ctx, type, x, y, heading, opts = {}) {
  const thrust = opts.thrust ?? 0, t = opts.t ?? 0, s = opts.scale ?? 1;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(heading); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (type === 'corvette') {
    // needle raider: dual blue ion plumes, forward-swept fins, canopy, railgun blisters, spine grapple
    plume(ctx, -7.4, -1.7, 8, 1.5, thrust, t, 1); plume(ctx, -7.4, 1.7, 8, 1.5, thrust, t, 2);
    poly(ctx, [[-1.5, -1.4], [-0.4, -6], [-4.6, -3.2], [-4.6, -1.2]], '#0c2236', '#38bdf8', 0.5);
    poly(ctx, [[-1.5, 1.4], [-0.4, 6], [-4.6, 3.2], [-4.6, 1.2]], '#0c2236', '#38bdf8', 0.5);
    poly(ctx, [[8.5, 0], [3.5, -1.5], [-5.5, -1.2], [-7.5, -0.6], [-7.5, 0.6], [-5.5, 1.2], [3.5, 1.5]], '#0b1a2b', '#7dd3fc', 0.6);
    ctx.strokeStyle = 'rgba(34,211,238,0.55)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(4.5, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(103,232,249,0.9)'; ctx.beginPath(); ctx.ellipse(2.2, 0, 2, 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#38bdf8'; for (const yy of [-1.9, 1.9]) ctx.fillRect(-1.2, yy - 0.5, 2, 1);
  } else if (type === 'destroyer') {
    // split-bow catamaran: triple exhausts, heavy side skirts, spinal coilgun, flak turrets
    for (const yy of [-3.2, 0, 3.2]) plume(ctx, -13, yy, 7, 1.3, thrust, t, Math.round(yy) + 3);
    for (const sg of [1, -1]) poly(ctx, [[6, 4.5 * sg], [-8, 7 * sg], [-10, 6 * sg], [-10, 3.2 * sg], [6, 3 * sg]], '#273449', '#64748b', 0.5);
    poly(ctx, [[16, 0], [8, -3.5], [2, -7.5], [-8, -9], [-12, -6.5], [-12, 6.5], [-8, 9], [2, 7.5], [8, 3.5]], '#1e293b', '#94a3b8', 0.7);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(-6, -0.9, 18, 1.8);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; for (const xx of [-4, -1, 2, 5, 8, 11]) ctx.fillRect(xx - 0.3, -1.6, 0.6, 3.2);
    for (const [xx, yy] of [[6, -5], [-3, -6], [-3, 6], [6, 5]]) {
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(xx, yy, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.25)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(xx, yy, 3.8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(125,211,252,0.85)'; ctx.beginPath(); ctx.ellipse(10, 0, 1.8, 0.8, 0, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'cruiser') {
    // siege dreadnought: layered triangular wedge, broadside missile pods, quad sub-light bells, prow ram
    for (const yy of [-7, -2.5, 2.5, 7]) plume(ctx, -25, yy, 9, 2.4, thrust, t, Math.round(yy) + 9);
    for (const sg of [1, -1]) {
      poly(ctx, [[-2, 12 * sg], [12, 12 * sg], [14, 14.5 * sg], [-2, 16.5 * sg]], '#111c2e', '#64748b', 0.6);
      ctx.fillStyle = '#f97316'; for (const xx of [1, 5, 9]) ctx.fillRect(xx - 0.9, 13.6 * sg - 0.9, 1.8, 1.8);
    }
    poly(ctx, [[27, 0], [12, -6], [2, -15], [-14, -16.5], [-25, -10], [-25, 10], [-14, 16.5], [2, 15], [12, 6]], '#0f172a', '#64748b', 0.8);
    poly(ctx, [[14, 0], [4, -6.5], [-6, -8], [-14, -7], [-14, 7], [-6, 8], [4, 6.5]], '#1e293b', '#38bdf8', 0.6);
    poly(ctx, [[27, 0], [21, -2.2], [21, 2.2]], '#475569', '#cbd5e1', 0.5);
    ctx.strokeStyle = 'rgba(34,211,238,0.7)'; ctx.lineWidth = 0.5;
    for (const xx of [-19, -16, -13]) { ctx.beginPath(); ctx.moveTo(xx, -4); ctx.lineTo(xx, 4); ctx.stroke(); }
    ctx.fillStyle = 'rgba(125,211,252,0.85)'; ctx.beginPath(); ctx.ellipse(18, 0, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
