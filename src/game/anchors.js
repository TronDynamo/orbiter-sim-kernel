// Star anchor visuals for Jump Gate sectors: a descriptor per anchor type and a canvas renderer.
// Ported from the attached anchor section; pure descriptor logic is testable in Node.

// 5. On-map anchor visuals (Jump Gate destinations).
// anchorDescriptor is pure and headless-testable; drawAnchor renders it.
// Types: sol, black_hole, pulsar, blue_hypergiant, void, red_giant,
// white_dwarf. Unknown types fall back to sol.
export const ANCHOR_TYPES = [
  "sol", "black_hole", "pulsar", "blue_hypergiant", "void", "red_giant", "white_dwarf",
];

export function anchorDescriptor(type) {
  switch (type) {
    case "black_hole":
      return { type: "black_hole", coreColor: "#000000", glowColor: "#a855f7", hasAccretionDisk: true, hasBeams: false, hasCore: true, coreRadius: 22, glowRadius: 70 };
    case "pulsar":
      return { type: "pulsar", coreColor: "#fef08a", glowColor: "#38bdf8", hasAccretionDisk: false, hasBeams: true, hasCore: true, coreRadius: 14, glowRadius: 55 };
    case "blue_hypergiant":
      return { type: "blue_hypergiant", coreColor: "#7dd3fc", glowColor: "#38bdf8", hasAccretionDisk: false, hasBeams: false, hasCore: true, coreRadius: 42, glowRadius: 90 };
    case "void":
      return { type: "void", coreColor: "#030712", glowColor: "#334155", hasAccretionDisk: false, hasBeams: false, hasCore: false, coreRadius: 0, glowRadius: 30 };
    case "red_giant":
      return { type: "red_giant", coreColor: "#ef4444", glowColor: "#ff4500", hasAccretionDisk: false, hasBeams: false, hasCore: true, coreRadius: 38, glowRadius: 80 };
    case "white_dwarf":
      return { type: "white_dwarf", coreColor: "#ffffff", glowColor: "#e0f2fe", hasAccretionDisk: false, hasBeams: false, hasCore: true, coreRadius: 12, glowRadius: 40 };
    case "sol":
    default:
      return { type: "sol", coreColor: "#ff8c2e", glowColor: "#ff9a2e", hasAccretionDisk: false, hasBeams: false, hasCore: true, coreRadius: 28, glowRadius: 60 };
  }
}

export function drawAnchor(ctx, type, cx, cy, time = 0) {
  const d = anchorDescriptor(type);
  // Glow halo (skip gradient if the test stub has no createRadialGradient).
  if (ctx.createRadialGradient) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, d.glowRadius);
    g.addColorStop(0, d.glowColor);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, d.glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Black hole: purple accretion disk, drawn as a tilted ellipse ring.
  if (d.hasAccretionDisk) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Pulsar: two rotating beam spikes, opposite directions.
  if (d.hasBeams) {
    const a = time * 2.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(90, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-90, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Core (void has no visible core — only faint fog glow above).
  if (d.hasCore) {
    ctx.fillStyle = d.coreColor;
    ctx.beginPath();
    ctx.arc(cx, cy, d.coreRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  return d;
}

