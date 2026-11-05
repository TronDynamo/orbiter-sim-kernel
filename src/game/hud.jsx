// Cockpit HUD pieces: resource chips for the top ribbon and segmented meters for the Ark telemetry module.
import {Icon} from "./icons.jsx";

export function HudChip({c, icon, label, value}) {
  return (
    <div className="hud-chip" style={{"--c": c}}>
      <span className="hud-chip-ico"><Icon name={icon} size={18} /></span>
      <span className="hud-chip-text">
        <span className="hud-label">{label}</span>
        <span className="hud-val mono">{value}</span>
      </span>
    </div>
  );
}

export function HudMeter({label, pct, color, value, warn}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className={"hud-meter" + (warn ? " warn" : "")}>
      <div className="hud-meter-head"><span className="hud-label">{label}</span><span className="hud-val mono">{value}</span></div>
      <div className="hud-bar" style={{"--w": p + "%", "--c": color}}><i /></div>
    </div>
  );
}
