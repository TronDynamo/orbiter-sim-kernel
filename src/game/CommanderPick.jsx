// Commander pick: choose one of the 20 leaders to play as. Each leader has an avatar, a faction, a trait and their own
// six-ship set. The layout stacks on phones and sits side by side on wide screens; nothing is absolutely positioned.
import {useState} from "react";
import {LEADERS} from "./roster_data.js";
import {LeaderPortrait} from "./LeaderPortrait.jsx";
import "./commander.css";

// The leader's file key, as used by public/assets/characters/char_<key>.png and public/assets/ships/<key>/.
export const commanderKey = (leader) => leader.id.split("_")[0];

// Ship roles in the order the art sheets use, with the names players see.
export const COMMANDER_SHIPS = [
  {role: "corvette", name: "Corvette"},
  {role: "destroyer", name: "Destroyer"},
  {role: "cruiser", name: "Dreadnought"},
  {role: "probe", name: "Survey Probe"},
  {role: "tender", name: "Satellite Tender"},
  {role: "freighter", name: "Mining Freighter"},
];

function Avatar({leader, size}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <LeaderPortrait id={leader.id} size={size} />;
  return <img className="cmdr-avatar" src={`/assets/characters/char_${commanderKey(leader)}.png`} alt={leader.name}
    width={size} height={size} onError={() => setFailed(true)} />;
}

function ShipStrip({leader}) {
  const key = commanderKey(leader);
  return (
    <div className="cmdr-ships">
      {COMMANDER_SHIPS.map((s) => (
        <figure className="cmdr-ship" key={s.role}>
          <img src={`/assets/ships/${key}/${s.role}.png`} alt={`${leader.name}'s ${s.name}`} loading="lazy" />
          <figcaption>{s.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function CommanderPick({selected, onSelect}) {
  const current = LEADERS.find((l) => l.id === selected) ?? null;
  return (
    <div className="cmdr">
      <div className="cmdr-grid" role="listbox" aria-label="Choose your commander">
        {LEADERS.map((l) => (
          <button key={l.id} type="button" role="option" aria-selected={l.id === selected}
            className={"cmdr-card" + (l.id === selected ? " on" : "")} style={{"--bloc": l.color}}
            onClick={() => onSelect(l.id)}>
            <Avatar leader={l} size={72} />
            <span className="cmdr-name">{l.name}</span>
            <span className="cmdr-faction">{l.faction}</span>
          </button>
        ))}
      </div>
      {current ? (
        <section className="cmdr-detail" style={{"--bloc": current.color}} aria-label={`${current.name} details`}>
          <div className="cmdr-head">
            <Avatar leader={current} size={96} />
            <div className="cmdr-info">
              <div className="cmdr-kicker">{current.title} · {current.species}</div>
              <h4 className="cmdr-title">{current.name}</h4>
              <div className="cmdr-faction">{current.faction}</div>
              <div className="cmdr-trait"><b>{current.trait}.</b> {current.traitDesc}</div>
            </div>
          </div>
          <div className="cmdr-ships-label">Your six ships</div>
          <ShipStrip leader={current} />
        </section>
      ) : (
        <p className="cmdr-hint">Pick a commander to see their ships.</p>
      )}
    </div>
  );
}
