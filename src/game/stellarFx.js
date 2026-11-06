// Stellar effects drawn over the map: planetary umbra cones, black-hole and pulsar lensing, and the
// rotating debris belt that a shattered world leaves on its orbit. Pure geometry plus canvas drawing;
// the simulation is never touched here.

// Umbra length behind a body, in world units. Shadows fade out over this distance.
export const UMBRA_LENGTH = 180;

// 0..1 shadow strength at point q from a body of radius R that blocks star light.
// The cone opens away from the star, so only points behind the body (along star->body) are shaded.
export function umbraStrength(q, star, body, R, length = UMBRA_LENGTH) {
  const dx = body.x - star.x, dy = body.y - star.y, dl = Math.hypot(dx, dy);
  if (dl < 1e-6) return 0;
  const ux = dx / dl, uy = dy / dl;
  const vx = q.x - body.x, vy = q.y - body.y;
  const along = vx * ux + vy * uy;                 // distance behind the body
  if (along <= 0 || along >= length) return 0;
  const perp = Math.abs(vx * -uy + vy * ux);       // distance from the cone's axis
  const coneR = R * (1 - along / length);
  if (perp >= coneR) return 0;
  // darkest on the axis, softening toward the edge (penumbra) and toward the far end
  return (1 - perp / coneR) * (1 - along / length);
}

// Largest shadow strength over several bodies (planets), for dimming a ship or a line.
export function shadowAt(q, star, bodies, length = UMBRA_LENGTH) {
  let s = 0;
  for (const b of bodies) s = Math.max(s, umbraStrength(q, star, b, b.R, length));
  return s;
}

// The planet's shadow, cast away from the star. It is a soft, transparent oval that fades out toward its end
// and is never wider than the planet itself, so it reads as shade rather than a hard spike.
export function drawUmbra(ctx, toS, star, body, R) {
  const dx = body.x - star.x, dy = body.y - star.y, dl = Math.hypot(dx, dy);
  if (dl < 1e-6) return;
  const ux = dx / dl, uy = dy / dl;
  const base = toS(body);
  const ahead = toS({x: body.x + ux * R, y: body.y + uy * R});
  const side = toS({x: body.x - uy * R, y: body.y + ux * R});
  const rPx = Math.hypot(side.x - base.x, side.y - base.y);   // the planet's radius on screen
  const ang = Math.atan2(ahead.y - base.y, ahead.x - base.x); // away from the star
  // centred just behind the limb, so the planet covers the inner part of the shadow
  const cx = base.x + Math.cos(ang) * rPx * 0.9, cy = base.y + Math.sin(ang) * rPx * 0.9;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.scale(1.6, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rPx);
  g.addColorStop(0, "rgba(2,6,23,0.09)");
  g.addColorStop(0.5, "rgba(2,6,23,0.045)");
  g.addColorStop(1, "rgba(2,6,23,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rPx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Lensing around a black hole or pulsar, approximated in 2D: concentric photon rings plus background
// streaks stretched tangentially and compressed toward the rim. Deterministic, so it does not shimmer.
export function drawLensing(ctx, toS, center, R, t, scale = 1) {
  const c = toS(center);
  const rimPx = Math.abs(toS({x: center.x + R * 3, y: center.y}).x - c.x);
  // photon rings
  for (let k = 0; k < 3; k++) {
    const r = rimPx * (1.05 + k * 0.18);
    ctx.strokeStyle = `rgba(196,181,253,${(0.32 - k * 0.09).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.6, 1.4 - k * 0.4) * scale;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
  }
  // lensed starfield: streaks that bend around the rim, longer and brighter nearer the ring
  const GOLD = 2.399963;
  for (let i = 0; i < 90; i++) {
    const ang = i * GOLD + t * 0.02 / (1 + (i % 5) * 0.2);
    const frac = ((i * 0.6180339) % 1);
    const r = rimPx * (1.1 + frac * 3.2);
    const len = (rimPx * 0.35) / (1 + frac * 2.5);
    const x = c.x + Math.cos(ang) * r, y = c.y + Math.sin(ang) * r;
    const tx = -Math.sin(ang), ty = Math.cos(ang);
    ctx.strokeStyle = `rgba(226,232,240,${(0.5 * (1 - frac)).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.5, 0.9 * scale);
    ctx.beginPath(); ctx.moveTo(x - tx * len, y - ty * len); ctx.lineTo(x + tx * len, y + ty * len); ctx.stroke();
  }
}

// Rotating belt of rock points on a fractured world's orbit. Inner rocks turn faster, as in a real belt.
export function debrisBeltAngles(count, radius, t) {
  const out = [];
  const rate = 0.6 / Math.pow(Math.max(radius, 1) / 100, 1.5);
  for (let i = 0; i < count; i++) {
    const spread = ((i * 0.6180339) % 1 - 0.5) * 0.12;   // slight radial jitter in angle, fixed per rock
    out.push(i * (Math.PI * 2 / count) + t * rate + spread);
  }
  return out;
}

export function drawDebrisBelt(ctx, toS, center, radius, t, count = 32, scale = 1) {
  const c = toS(center);
  const edge = toS({x: center.x + radius, y: center.y});
  const r = Math.abs(edge.x - c.x) || 1;
  ctx.fillStyle = "rgba(160,160,170,0.8)";
  const ring = debrisBeltAngles(count, radius, t);
  for (let i = 0; i < count; i++) {
    const x = c.x + Math.cos(ring[i]) * r, y = c.y + Math.sin(ring[i]) * r;
    const s = (1.2 + (i % 3) * 0.6) * scale;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}
