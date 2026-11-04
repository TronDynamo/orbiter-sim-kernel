// Hull data and procedural vector drawing for the shipyard. Costs use the stockpile field names in rules.js
// (cryo is shown as Coolant). Power is a game balance value used for Fleet Power.
export const SHIPS = {
  corvette: {name: 'Corvette', cost: {credits: 120, alloys: 40}, seconds: 5, power: 1, blurb: 'Fast interceptor'},
  destroyer: {name: 'Destroyer', cost: {credits: 350, alloys: 180, cryo: 50}, seconds: 12, power: 4, blurb: 'Railgun prow'},
  cruiser: {name: 'Cruiser', cost: {credits: 900, alloys: 520, compute: 120}, seconds: 25, power: 12, blurb: 'Heavy broadside'},
};
export const SHIP_ORDER = ['corvette', 'destroyer', 'cruiser'];
export const COST_LABEL = {credits: 'Credits', alloys: 'Alloys', cryo: 'Coolant', compute: 'Compute'};

export const fleetPower = (fleet) => fleet.reduce((sum, f) => sum + (SHIPS[f.type]?.power ?? 0), 0);

// Draws a hull centred on (x, y) with its nose along heading (radians). size is the nose length in px.
export function drawShip(ctx, type, x, y, heading, size = 10) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  const k = size / 12;
  ctx.lineJoin = 'round';
  if (type === 'corvette') {
    // ion trail
    const g = ctx.createLinearGradient(-14 * k, 0, -34 * k, 0);
    g.addColorStop(0, 'rgba(34,211,238,0.9)'); g.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(-10 * k, 0); ctx.lineTo(-34 * k, 0); ctx.stroke();
    // double chevron
    ctx.fillStyle = '#cffafe'; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(12 * k, 0); ctx.lineTo(-6 * k, -8 * k); ctx.lineTo(-2 * k, 0); ctx.lineTo(-6 * k, 8 * k); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4 * k, 0); ctx.lineTo(-10 * k, -5 * k); ctx.lineTo(-8 * k, 0); ctx.lineTo(-10 * k, 5 * k); ctx.closePath();
    ctx.fillStyle = '#0891b2'; ctx.fill(); ctx.stroke();
  } else if (type === 'destroyer') {
    // angular screen hull with a railgun prow
    ctx.fillStyle = '#334155'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(14 * k, 0); ctx.lineTo(4 * k, -7 * k); ctx.lineTo(-10 * k, -7 * k);
    ctx.lineTo(-10 * k, 7 * k); ctx.lineTo(4 * k, 7 * k); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(14 * k, 0); ctx.lineTo(24 * k, 0); ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-6 * k, -3 * k, 8 * k, 2 * k);
  } else if (type === 'cruiser') {
    // heavy broadside with turrets
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(-12 * k, -10 * k); ctx.lineTo(8 * k, -10 * k); ctx.lineTo(13 * k, -5 * k);
    ctx.lineTo(13 * k, 5 * k); ctx.lineTo(8 * k, 10 * k); ctx.lineTo(-12 * k, 10 * k); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f97316';
    for (const [tx, ty] of [[-6, -6], [2, -6], [-6, 6], [2, 6]]) {
      ctx.beginPath(); ctx.arc(tx * k, ty * k, 1.8 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 1.5 * k;
    ctx.beginPath(); ctx.moveTo(13 * k, 0); ctx.lineTo(18 * k, 0); ctx.stroke();
  }
  ctx.restore();
}
