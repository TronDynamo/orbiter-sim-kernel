// A raider warband hails the Ark as it enters: pay it off, engage, intimidate, or offer alliance.
import {RAIDER_CHOICES, payoffCost, ALLY_RESPECT, opinionOf, RAIDER_ID} from "./comms.js";

export function RaiderHail({s, hail, onChoose}) {
  const op = opinionOf(s, RAIDER_ID);
  const armed = s.fleet.length;
  return (
    <aside className="comms glass open" role="dialog" aria-label="Raider hail" style={{width: 360}}>
      <div className="comms-head">
        <b className="mono">INCOMING HAIL · RAIDER WARBAND</b>
      </div>
      <div className="comms-body" style={{flexDirection: "column"}}>
        <div style={{display: "flex", gap: 12, alignItems: "center"}}>
          <img src={`${import.meta.env.BASE_URL}assets/raiders/portrait.jpg`} alt="Raider leader" width={84} height={84} style={{borderRadius: 8, objectFit: "cover"}} />
          <div>
            <div className="comms-name" style={{color: "#f87171"}}>Raider Warband</div>
            <div className="comms-sub">{hail.n} raider{hail.n > 1 ? "s" : ""} in your system</div>
            <div className="comms-sub">Respect {op > 0 ? "+" : ""}{op} (ally at {ALLY_RESPECT})</div>
          </div>
        </div>
        <div className="comms-choices" style={{flexDirection: "column", alignItems: "stretch"}}>
          {RAIDER_CHOICES.map((c) => {
            const cost = c.key === "payoff" ? ` · ${payoffCost(hail.n)} credits` : "";
            const locked = c.key === "ally" && op < ALLY_RESPECT;
            const note = c.key === "intimidate" ? (armed >= hail.n ? "" : " · fleet too thin") : locked ? ` · needs respect ${ALLY_RESPECT}` : "";
            return (
              <button key={c.key} className="pill zelo" title={c.line} onClick={() => onChoose(c.key)}>
                {c.label}{cost}{note}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
