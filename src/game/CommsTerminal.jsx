// Diplomatic Holo-Comm: roster, leader portrait with CRT scanlines, opinion meter, tactical replies, and the message log.
import {useEffect, useRef} from "react";
import {FACTIONS, factionById} from "./factions.js";
import {CHOICES, opinionOf} from "./comms.js";
import {shortfall} from "./rules.js";
import {COST_LABEL} from "./ships.js";
import "./comms.css";

export function CommsTerminal({s, onOpen, onChoose, onClose}) {
  const f = factionById(s.comms.selected);
  const op = opinionOf(s, f.id);
  const log = s.comms.log.filter((m) => m.faction === f.id);
  const logRef = useRef(null);
  // keep the newest message in view as replies arrive
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log.length, f.id]);
  return (
    <aside className="comms glass open" role="dialog" aria-label="Diplomatic Holo-Comm">
      <div className="comms-head">
        <b className="mono">DIPLOMATIC HOLO-COMM · SENATE CHANNEL</b>
        <button className="pill zelo" onClick={onClose}>Close</button>
      </div>
      <div className="comms-body">
        <div className="comms-roster">
          {FACTIONS.map((x) => (
            <button key={x.id} className={"comms-pick" + (x.id === f.id ? " on" : "")} onClick={() => onOpen(x.id)} style={{borderColor: x.color}}>
              <span style={{color: x.color}}>#{x.number} {x.name}</span>
              <small>{x.bloc}</small>
            </button>
          ))}
        </div>
        <div className="comms-main">
          <div className="comms-leader">
            <div className="comms-portrait" style={{borderColor: f.color, color: f.color}}>
              <span>#{f.number}</span>
              <div className="scanlines" />
            </div>
            <div>
              <div className="comms-name" style={{color: f.color}}>{f.name}</div>
              <div className="comms-sub">{f.sub}</div>
              <div className="comms-sub">Senate bloc: {f.bloc}</div>
            </div>
          </div>
          <div className="comms-meter">
            <span className="mono">Opinion</span>
            <input type="range" min={-100} max={100} value={op} disabled aria-label={`${f.name} opinion`} />
            <b className="mono" style={{color: op < 0 ? "#f87171" : "#34d399"}}>{op > 0 ? "+" : ""}{op}</b>
          </div>
          <div className="comms-log" ref={logRef}>
            {log.map((m, i) => (
              <div key={i} className={"bubble " + m.from}>
                {m.label ? <small className="mono">{m.label}</small> : null}
                <div>{m.text}</div>
                {m.shift !== undefined ? <small className="shift" style={{color: m.shift < 0 ? "#f87171" : "#34d399"}}>{m.shift >= 0 ? "+" : ""}{m.shift} opinion</small> : null}
              </div>
            ))}
          </div>
          <div className="comms-choices">
            {CHOICES.map((c) => {
              const short = shortfall(s, c.cost);
              return (
                <button key={c.key} className="pill zelo" disabled={!!short} title={short ? `Short: ${short}` : c.line}
                  onClick={() => onChoose(c.key)} style={{opacity: short ? 0.45 : 1}}>
                  {c.label}{Object.keys(c.cost).length ? ` · ${Object.entries(c.cost).map(([k, v]) => `${v} ${COST_LABEL[k] ?? k}`).join(" ")}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
