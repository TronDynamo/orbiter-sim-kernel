// Orbital Tech Web: five techs in three tiers, researched with Compute. Each unlocked tech applies its perk.
import {TECHS, techCost, perks} from "./tech.js";

export function TechWeb({s, onResearch, onClose}) {
  const p = perks(s);
  return (
    <aside className="glass" style={{position: "absolute", right: 16, top: 84, width: 320, maxHeight: 520, overflowY: "auto", padding: 14, zIndex: 8, borderRadius: 12}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4}}>
        <b>🧪 Orbital Tech Web</b>
        <button className="pill zelo" onClick={onClose}>Close</button>
      </div>
      <div style={{fontSize: 12, opacity: 0.85, marginBottom: 8}}>Research costs Compute. Compute now: <b>{Math.floor(s.compute)}</b></div>
      {[1, 2, 3].map((tier) => (
        <div key={tier} style={{marginBottom: 8}}>
          <div style={{fontSize: 11, letterSpacing: "0.1em", opacity: 0.7, textTransform: "uppercase"}}>Tier {tier}</div>
          {TECHS.filter((t) => t.tier === tier).map((t) => {
            const done = !!s.tech[t.key], cost = techCost(s, t);
            const lacking = t.requires.filter((r) => !s.tech[r]);
            const why = done ? null : lacking.length ? "Locked" : s.compute < cost ? `Short: ${cost - Math.floor(s.compute)} Compute` : null;
            return (
              <div key={t.key} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0"}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8}}>
                  <b style={{fontSize: 13}}>{t.name}{done ? " ✓" : ""}</b>
                  {done ? <span style={{fontSize: 11, opacity: 0.7}}>researched</span> : (
                    <button className="pill zelo" disabled={!!why} title={why ?? `Research ${t.name}`} onClick={() => onResearch(t.key)}
                      style={{opacity: why ? 0.45 : 1, cursor: why ? "not-allowed" : "pointer"}}>{cost} 🧠</button>
                  )}
                </div>
                <div style={{fontSize: 12, opacity: 0.85}}>{t.perk}</div>
                {lacking.length && !done ? <div style={{fontSize: 11, opacity: 0.6}}>Requires {lacking.map((r) => TECHS.find((x) => x.key === r).name).join(" and ")}</div> : null}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{fontSize: 11, opacity: 0.7, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6}}>
        Active: conduit limit +{p.conduitBonus} · shadow share {Math.round(p.occlusionShare * 100)}% · reloads ×{p.reloadScale} · fleet ×{p.fleetMult}
      </div>
    </aside>
  );
}
