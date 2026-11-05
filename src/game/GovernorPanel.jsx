import {Icon} from "./icons.jsx";
// Colony Governor: a planet's population, happiness, yield and infrastructure. Opens when a world is clicked.
import {INFRA, infraOf, happinessOf, costOf} from "./colony.js";
import {shortfall} from "./rules.js";
import {COST_LABEL} from "./ships.js";

const STATUS = ["Intact", "Glassed", "Fractured", "Black hole"];
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`);

export function GovernorPanel({s, kernel, planet, idx, base, outputLabel, secondary, onBuild, onClose}) {
  const flowing = kernel.planets.flow[idx] > 0;
  const status = kernel.planets.status[idx];
  const population = kernel.planets.population[idx];
  const happy = happinessOf(s, planet.id, status !== 0);
  const built = infraOf(s, planet.id);
  const extra = INFRA.filter((d) => built.includes(d.key) && d.resource);
  return (
    <aside className="glass" style={{position: "absolute", left: 16, top: 320, width: 300, maxHeight: 420, overflowY: "auto", padding: 14, zIndex: 8, borderRadius: 12}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
        <b>Colony Governor · {planet.name}</b>
        <button className="pill zelo" onClick={onClose}>Close</button>
      </div>
      <div style={{fontSize: 13, lineHeight: 1.6}}>
        <div>Population: <b>{fmt(population)}</b></div>
        <div>Status: <b>{STATUS[status] ?? status}</b></div>
        <div>Happiness: <b>{happy}</b> / 100</div>
        <div>Conduit link: <b>{flowing ? "flowing" : "none"}</b></div>
        <div>Output: <b>{flowing ? base : 0} {outputLabel}/s</b>{extra.map((d) => <span key={d.key}> + {d.rate} {d.resource}/s</span>)}</div>
        {secondary ? <div>Secondary: <b>{flowing ? secondary.yield : 0} {secondary.label}/s</b></div> : null}
      </div>
      <div style={{borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 10, paddingTop: 8}}>
        <b style={{fontSize: 13}}>Infrastructure</b>
        {INFRA.map((d) => {
          const has = built.includes(d.key), cost = costOf(s, d), why = has ? null : shortfall(s, cost);
          return (
            <div key={d.key} style={{padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8}}>
                <span style={{fontSize: 13}}><b>{d.name}</b>{has ? <Icon name="check" size={12} /> : ""}</span>
                {has ? <span style={{fontSize: 11, opacity: 0.7}}>built</span> : (
                  <button className="pill zelo" disabled={!!why} title={why ? `Short: ${why}` : `Build ${d.name}`} onClick={() => onBuild(d.key)}
                    style={{opacity: why ? 0.45 : 1, cursor: why ? "not-allowed" : "pointer"}}>Build</button>
                )}
              </div>
              <div style={{fontSize: 12, opacity: 0.8}}>{d.blurb} · {Object.entries(cost).map(([k, v]) => `${v} ${COST_LABEL[k] ?? k}`).join(" · ")}</div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
