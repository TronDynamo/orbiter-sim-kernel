// Strategic weapons: display data (costs and reloads come from config/planets.js) and the canvas effects
// for targeting and cataclysm states. Effects read kernel state; nothing here changes the simulation.
import {WEAPONS} from '../../config/planets.js';

// Display order follows the armory. `type` is the kernel's WeaponClass value.
const DEFS = {
  thermonuclear_icbm: {
    type: 0, name: 'Titan-Buster ICBM', target: 'planet',
    blurb: 'Glasses the target world: -85% population, -75% yield.',
  },
  planet_cracker: {
    type: 1, name: 'World-Cracker Drill', target: 'planet',
    blurb: 'Cracks the world within 45 units, then shatters it into an asteroid belt.',
  },
  singularity_torpedo: {
    type: 3, name: 'Singularity Torpedo', target: 'planet',
    blurb: 'Collapses the world to a black hole and opens a 5 s gravity vortex.',
  },
  starkiller: {
    type: 2, name: 'Star-Killer Needle', target: 'core',
    blurb: 'Strikes Sol Core. Supernova, then the core collapses to a black hole. One per match.',
  },
};

export const ARMORY = ['thermonuclear_icbm', 'planet_cracker', 'singularity_torpedo', 'starkiller'].map((key) => {
  const cfg = WEAPONS.find((w) => w.key === key);
  return {key, ...DEFS[key], cost: cfg.cost, reloadSeconds: cfg.reloadSeconds, speed: cfg.speed};
});

// Reticle drawn around a valid target.
export function drawCage(ctx, x, y, r) {
  const d = r + 8;
  ctx.save();
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.moveTo(x + sx * d, y + sy * (d - 8)); ctx.lineTo(x + sx * d, y + sy * d); ctx.lineTo(x + sx * (d - 8), y + sy * d);
  }
  ctx.stroke();
  ctx.restore();
}

// Deterministic jagged fissures across a cracking world, glowing and pulsing.
export function drawMagma(ctx, x, y, r, t) {
  ctx.save();
  const pulse = 0.65 + 0.35 * Math.sin(t * 4);
  // Two passes: a wide soft bloom under a bright, crisp core line, so the fissures read at default zoom.
  const web = (lineWidth, color, blur) => {
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = blur;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4;
      ctx.beginPath();
      let px = x + Math.cos(a) * r * 0.2, py = y + Math.sin(a) * r * 0.2;
      ctx.moveTo(px, py);
      for (let seg = 1; seg <= 4; seg++) {
        const jitter = Math.sin(seg * 7.3 + i * 2.1) * 0.22;
        const rr = r * (0.2 + seg * 0.2);
        px = x + Math.cos(a + jitter) * rr; py = y + Math.sin(a + jitter) * rr;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  };
  web(7, `rgba(255,110,30,${(0.35 * pulse + 0.15).toFixed(3)})`, 24);
  web(3.2, `rgba(255,214,140,${pulse.toFixed(3)})`, 14);
  ctx.restore();
}

// Green-yellow halo over an irradiated world.
export function drawIrradiated(ctx, x, y, r, t) {
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.4);
  g.addColorStop(0, `rgba(190,255,90,${(0.35 * pulse + 0.15).toFixed(3)})`);
  g.addColorStop(1, 'rgba(190,255,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(190,255,90,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Black hole with a turning accretion ring; the vortex swirl is drawn while it is still pulling debris.
export function drawBlackHole(ctx, x, y, r, t, vortexPx = 0, vortexLeft = 0) {
  ctx.save();
  if (vortexLeft > 0 && vortexPx > 0) {
    const fade = Math.min(1, vortexLeft / 60);
    ctx.strokeStyle = `rgba(167,139,250,${(0.35 * fade).toFixed(3)})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const rr = vortexPx * (0.45 + i * 0.25), a0 = t * (1.4 + i * 0.5);
      ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + 2.1); ctx.stroke();
    }
  }
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(x, y, Math.max(3, r), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(251,146,60,0.9)'; ctx.lineWidth = 2; ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.55, t * 0.6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Expanding supernova shockwave. progress runs 0 to 1 over the blast.
export function drawSupernova(ctx, x, y, startPx, endPx, progress) {
  ctx.save();
  const rr = startPx + (endPx - startPx) * progress;
  ctx.strokeStyle = `rgba(255,220,140,${(1 - progress).toFixed(3)})`; ctx.lineWidth = 3 + 6 * (1 - progress);
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
