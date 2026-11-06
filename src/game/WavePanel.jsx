// The selected allied wave: join or leave the convoy, or send it home.
import {factionById} from "./factions.js";
import "./hail.css";

export function WavePanel({wave, onConvoy, onSendHome, onClose}) {
  const f = factionById(wave.id);
  return (
    <aside className="hail glass" role="dialog" aria-label={`Allied fleet: ${f ? f.name : wave.id}`} style={{top: "auto", bottom: 110}}>
      <div className="hail-head mono"><b>ALLIED FLEET · {f ? f.name.toUpperCase() : ""}</b><button className="hail-close" aria-label="Close fleet panel" title="Close" onClick={onClose}>×</button></div>
      <div className="hail-body">
        <div>
          <div className="hail-name" style={{color: f?.color}}>{f ? f.name : wave.id}</div>
          <div className="hail-sub">{wave.convoy ? "In your convoy: follows the Ark" : "Free: drag to move it"}</div>
          <div className="hail-sub">Hull {Math.round(wave.hull ?? 0)}</div>
        </div>
      </div>
      <div className="hail-choices">
        <button className="pill zelo" onClick={() => onConvoy(!wave.convoy)}>{wave.convoy ? "Leave convoy" : "Join convoy"}</button>
        <button className="pill zelo" onClick={onSendHome}>Send home</button>
      </div>
    </aside>
  );
}
