// An allied faction is present while raiders fight in your system: ask it to help, or to stand down.
import {ALLY_CHOICES, ALLY_STRAIN_LIMIT, opinionOf, strainOf} from "./comms.js";
import {factionById} from "./factions.js";

export function AllyConflict({s, factionId, onChoose}) {
  const f = factionById(factionId);
  if (!f) return null;
  const strain = strainOf(s, factionId);
  return (
    <aside className="comms glass open" role="dialog" aria-label={`Ally conflict: ${f.name}`} style={{width: 360}}>
      <div className="comms-head">
        <b className="mono">ALLY IN THE FIGHT · RAIDERS</b>
      </div>
      <div className="comms-body" style={{flexDirection: "column"}}>
        <div style={{display: "flex", gap: 12, alignItems: "center"}}>
          <div className="mono" style={{width: 64, height: 64, display: "grid", placeItems: "center", borderRadius: 8, background: f.color, color: "#fff", fontWeight: 700}}>{f.monogram}</div>
          <div>
            <div className="comms-name">{f.name}</div>
            <div className="comms-sub">{f.sub}</div>
            <div className="comms-sub">Respect {opinionOf(s, factionId)} · alliance strain {strain}/{ALLY_STRAIN_LIMIT}</div>
          </div>
        </div>
        <div className="comms-choices" style={{flexDirection: "column", alignItems: "stretch"}}>
          {ALLY_CHOICES.map((c) => {
            const refuse = c.key === "help" && strain >= ALLY_STRAIN_LIMIT;
            return (
              <button key={c.key} className="pill zelo" title={c.line} onClick={() => onChoose(c.key)}>
                {c.label}{refuse ? " · they refuse" : ""}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
