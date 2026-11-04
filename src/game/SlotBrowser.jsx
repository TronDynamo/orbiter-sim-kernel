// Save and load slots. "save" writes to manual slots; "load" opens any filled slot. Deleting asks for a second click.
import {useState} from "react";
import {SLOTS, listSaves, deleteSave, fmtElapsed, fmtWhen} from "./saveManager.js";

export function SlotBrowser({mode, onPick, onClose, onChanged}) {
  const [armed, setArmed] = useState(null);
  const saves = Object.fromEntries(listSaves().map((x) => [x.slot.id, x.data]));
  const pickable = (slot) => (mode === "save" ? slot.manual : true);
  return (
    <div className="overlay" style={{zIndex: 40}}>
      <div className="sheet glass" style={{padding: 20, width: "min(560px, calc(100% - 32px))", maxHeight: "90%", overflowY: "auto"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10}}>
          <b style={{letterSpacing: "0.12em"}}>{mode === "save" ? "SAVE GAME" : "LOAD GAME"}</b>
          <button className="pill zelo" onClick={onClose}>Close</button>
        </div>
        {SLOTS.map((slot) => {
          const d = saves[slot.id];
          return (
            <div key={slot.id} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "10px 0", display: "flex", gap: 10, alignItems: "center"}}>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontWeight: 700}}>{slot.label}</div>
                {d ? (
                  <div style={{fontSize: 12, opacity: 0.85}}>
                    {d.sector} · {fmtElapsed(d.elapsed)} · Pop {(d.population / 1e6).toFixed(1)}M · {d.credits.toLocaleString()} Cr
                    <div style={{opacity: 0.6}}>{fmtWhen(d.savedAt)} · {d.difficulty}</div>
                  </div>
                ) : <div style={{fontSize: 12, opacity: 0.6}}>Empty</div>}
              </div>
              {pickable(slot) ? (
                <button className="pill zelo" disabled={mode === "load" && !d} onClick={() => onPick(slot.id)}>{mode === "save" ? (d ? "Overwrite" : "Save") : "Load"}</button>
              ) : null}
              {d ? (
                <button className="pill zelo" onClick={() => {
                  if (armed !== slot.id) { setArmed(slot.id); return; }
                  deleteSave(slot.id); setArmed(null); onChanged?.();
                }} style={{color: armed === slot.id ? "#f87171" : undefined}}>{armed === slot.id ? "Confirm delete" : "Delete"}</button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
