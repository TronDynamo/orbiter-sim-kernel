// A raider warband hails the Ark as it enters: pay it off, engage, intimidate, or offer alliance.
import {RAIDER_CHOICES, payoffCost, ALLY_RESPECT, opinionOf, RAIDER_ID} from "./comms.js";
import "./hail.css";

export function RaiderHail({s, hail, note, onChoose, onClose}) {
  const op = opinionOf(s, RAIDER_ID);
  const armed = s.fleet.length;
  const cost = payoffCost(hail.n);
  return (
    <aside className="hail glass" role="dialog" aria-label="Raider hail">
      <div className="hail-head mono"><b>INCOMING HAIL · RAIDER WARBAND</b><button className="hail-close" aria-label="Close hail" title="Close" onClick={onClose}>×</button></div>
      <div className="hail-body">
        <img className="hail-portrait wheel" src={`${import.meta.env.BASE_URL}assets/characters/char_raider_warband.png`} alt="Raider warband leader"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `${import.meta.env.BASE_URL}assets/raiders/mothership.png`; }} />
        <div>
          <div className="hail-name" style={{color: "#f87171"}}>Raider Warband</div>
          <div className="hail-sub">{hail.n} raider{hail.n > 1 ? "s" : ""} in your system</div>
          <div className="hail-sub">Respect {op > 0 ? "+" : ""}{op} (ally at {ALLY_RESPECT})</div>
        </div>
      </div>
      <div className="hail-choices">
        {RAIDER_CHOICES.map((c) => {
          let label = c.label, off = null;
          if (c.key === "payoff") { label = `${c.label} · ${cost} credits`; if (s.credits < cost) off = `You need ${cost} credits.`; }
          if (c.key === "intimidate" && armed < hail.n) label = `${c.label} · fleet too thin`;
          if (c.key === "ally" && op < ALLY_RESPECT) off = `Needs respect ${ALLY_RESPECT}.`;
          return (
            <button key={c.key} className="pill zelo" title={off ?? c.line} disabled={!!off} onClick={() => onChoose(c.key)}>
              {label}{off ? ` (${off})` : ""}
            </button>
          );
        })}
      </div>
      <div className="hail-note" role="status">{note}</div>
    </aside>
  );
}
