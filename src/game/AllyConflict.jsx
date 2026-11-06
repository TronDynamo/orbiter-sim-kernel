// An allied faction is present while raiders fight in your system: ask it to help, or to stand down.
import {ALLY_CHOICES, ALLY_STRAIN_LIMIT, opinionOf, strainOf} from "./comms.js";
import {factionById} from "./factions.js";
import "./hail.css";

export function AllyConflict({s, factionId, note, onChoose, onClose}) {
  const f = factionById(factionId);
  if (!f) return null;
  const strain = strainOf(s, factionId);
  return (
    <aside className="hail glass" role="dialog" aria-label={`Ally conflict: ${f.name}`}>
      <div className="hail-head mono"><b>ALLY IN THE FIGHT · RAIDERS</b><button className="hail-close" aria-label="Close hail" title="Close" onClick={onClose}>×</button></div>
      <div className="hail-body">
        <div className="hail-portrait mono" style={{display: "grid", placeItems: "center", background: f.color, color: "#fff", fontWeight: 700, fontSize: 22}}>{f.monogram}</div>
        <div>
          <div className="hail-name">{f.name}</div>
          <div className="hail-sub">{f.sub}</div>
          <div className="hail-sub">Respect {opinionOf(s, factionId)} · alliance strain {strain}/{ALLY_STRAIN_LIMIT}</div>
        </div>
      </div>
      <div className="hail-choices">
        {ALLY_CHOICES.map((c) => {
          const refuse = c.key === "help" && strain >= ALLY_STRAIN_LIMIT;
          return (
            <button key={c.key} className="pill zelo" title={c.line} disabled={refuse} onClick={() => onChoose(c.key)}>
              {c.label}{refuse ? " (they refuse)" : ""}
            </button>
          );
        })}
      </div>
      <div className="hail-note" role="status">{note}</div>
    </aside>
  );
}
