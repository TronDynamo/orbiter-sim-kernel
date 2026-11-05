// Inline SVG glyphs for the HUD, dock and menus. They replace emoji so the UI reads as a tactical console.
// Stroke icons on a 16 px grid, drawn in currentColor. Canvas helpers draw the Ark and relays on the map.
const PATHS = {
  credits: '<polygon points="8,1.6 13.4,4.8 13.4,11.2 8,14.4 2.6,11.2 2.6,4.8"/><circle cx="8" cy="8" r="2.2"/>',
  biomass: '<path d="M5 1.6c4 3 4 9.8 0 12.8M11 1.6c-4 3-4 9.8 0 12.8M5 4.6h6M5 8h6M5 11.4h6"/>',
  coolant: '<path d="M8 1.6v12.8M2.9 4.8l10.2 6.4M2.9 11.2l10.2-6.4M6.4 2.9L8 4.2l1.6-1.3M6.4 13.1L8 11.8l1.6 1.3"/>',
  alloys: '<path d="M3 4.2L8 1.8 13 4.2v7.6L8 14.2 3 11.8z"/><path d="M3 4.2l5 3 5-3M8 7.2v7"/>',
  compute: '<rect x="5" y="5" width="6" height="6"/><path d="M8 1.6V5M8 11v3.4M1.6 8H5M11 8h3.4M3.4 3.4l1.6 1.6M11 11l1.6 1.6M12.6 3.4L11 5M5 11l-1.6 1.6"/>',
  fleet: '<path d="M8 1.8L14 13.2 8 10.6 2 13.2z"/>',
  power: '<path d="M9.2 1.6L3.6 9h4.2l-1 5.4L12.4 7H8.2z"/>',
  hull: '<path d="M8 1.6l5.4 2v4.6c0 3-2.3 5.1-5.4 6.2-3.1-1.1-5.4-3.2-5.4-6.2V3.6z"/>',
  fuel: '<path d="M8 1.8c2.4 3.4 4.4 5.7 4.4 8a4.4 4.4 0 0 1-8.8 0c0-2.3 2-4.6 4.4-8z"/>',
  propellant: '<path d="M8 1.6c1.5 2.5 4 4 4 7.4a4 4 0 0 1-8 0c0-1.8 1-2.8 1.8-3.6.2 1.2.7 2 1.5 2.4C7.2 5.8 7.4 3.4 8 1.6z"/>',
  singularity: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3.2" stroke-dasharray="2 2"/><circle cx="8" cy="8" r="0.9"/>',
  radiation: '<circle cx="8" cy="8" r="1.4"/><path d="M8 6.6C5.4 6.6 3.8 4.6 4.4 2.6 6.2 1.8 8.2 3.4 8 6.6zM9.4 8.6c2-1.8 4-1 4.2 1.1-1.6 1.6-3.7 1.4-4.2-1.1zM6.6 8.6c-2 1.8-4 1-4.2-1.1 1.6-1.6 3.7-1.4 4.2 1.1z"/>',
  senate: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><path d="M4.2 11.2a5 5 0 0 1 7.6 0"/>',
  armory: '<circle cx="8" cy="8" r="5"/><path d="M8 1.2v3M8 11.8v3M1.2 8h3M11.8 8h3"/><circle cx="8" cy="8" r="1.1" fill="currentColor"/>',
  tech: '<circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="4" r="1.8"/><circle cx="8" cy="12" r="1.8"/><path d="M5.6 5.2L7.2 10.6M10.4 5.2L8.8 10.6M5.8 4h4.4"/>',
  relay: '<circle cx="8" cy="6" r="1.5"/><path d="M8 7.5v6M5.6 13.5h4.8M4.6 4.2a4.8 4.8 0 0 0 0 4.6M11.4 4.2a4.8 4.8 0 0 1 0 4.6"/>',
  repair: '<path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z"/>',
  cut: '<circle cx="4.5" cy="4.5" r="2"/><circle cx="4.5" cy="11.5" r="2"/><path d="M6 6l7.5 5.5M6 10l7.5-5.5"/>',
  shipyard: '<path d="M2.5 13V6.6L8 3.2l5.5 3.4V13M5.6 13V9.2h4.8V13"/>',
  comms: '<path d="M3 4.6a7 7 0 0 1 10 0M5.2 7.2a4 4 0 0 1 5.6 0"/><circle cx="8" cy="10.4" r="1.4"/><path d="M8 11.8v2.2"/>',
  gear: '<circle cx="8" cy="8" r="2.2"/><circle cx="8" cy="8" r="5"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>',
  check: '<path d="M3 8.6l3 3 7-7"/>',
};

export function Icon({name, size = 14, title}) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined} aria-label={title}
      dangerouslySetInnerHTML={{__html: PATHS[name] ?? ""}} />
  );
}

// The Ark Endeavor: a vector craft with a cyan running light.
export function drawArk(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#0f172a"; ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(0, -2, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// A relay satellite: a mast with a dish.
export function drawRelay(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = "#9fb3cc"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 7); ctx.moveTo(-3, 7); ctx.lineTo(3, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -2, 5.5, 2.3, 3.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -2, 5.5, -0.8, 0.8); ctx.stroke();
  ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(0, -2, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
