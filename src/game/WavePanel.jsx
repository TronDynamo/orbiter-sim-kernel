// The selected allied fleets: join or leave the convoy, or send them home.
import {factionById} from "./factions.js";
import "./hail.css";

export function WavePanel({waves, onConvoy, onSendHome, onClose}) {
  const single = waves.length === 1 ? waves[0] : null;
  const f = single ? factionById(single.id) : null;
  const allConvoy = waves.every((w) => w.convoy);
  return (
    <aside className="hail glass" role="dialog" aria-label={single ? `Allied fleet: ${f ? f.name : single.id}` : `${waves.length} allied fleets`} style={{top: "auto", bottom: 110}}>
      <div className="hail-head mono"><b>{single ? `ALLIED FLEET · ${f ? f.name.toUpperCase() : ""}` : `${waves.length} ALLIED FLEETS SELECTED`}</b><button className="hail-close" aria-label="Close fleet panel" title="Close" onClick={onClose}>×</button></div>
      <div className="hail-body">
        <div>
          {single ? <div className="hail-name" style={{color: f?.color}}>{f ? f.name : single.id}</div> : <div className="hail-name">{waves.map((w) => factionById(w.id)?.name ?? w.id).join(", ")}</div>}
          <div className="hail-sub">{allConvoy ? "In your convoy: follows the Ark" : "Free: drag to move"}</div>
          {single ? <div className="hail-sub">Hull {Math.round(single.hull ?? 0)}</div> : null}
        </div>
      </div>
      <div className="hail-choices">
        <button className="pill zelo" onClick={() => onConvoy(!allConvoy)}>{allConvoy ? "Leave convoy" : "Join convoy"}</button>
        <button className="pill zelo" onClick={onSendHome}>Send home</button>
      </div>
    </aside>
  );
}
