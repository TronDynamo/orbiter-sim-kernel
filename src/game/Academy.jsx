// Flight Academy: a four-step briefing shown before a new campaign starts. The clock stays paused until it is dismissed.
import {useState} from "react";

const STEPS = [
  {title: "The Keplerian Engine", body: "Worlds never stop moving, and the inner worlds race ahead of the outer ones. A line you draw now will not look the same in a few seconds."},
  {title: "Weave the Energy Mesh", body: "Drag from one world to another to build a conduit for 5 alloys. Connected worlds feed their output into your stockpiles: Thalassa gives Biomass, Aeros gives Coolant, Ferrum gives Alloys and Kryos gives Compute."},
  {title: "Manage Tension", body: "Conduits stretch as worlds drift apart. Cyan is safe, amber means 70% of the limit, and pulsing red means 90% or more. A conduit past its limit snaps. High-Tensile Beams in the Tech Web raise the limit."},
  {title: "Fly Your Fleet", body: "Build ships at the Shipyard and they launch from Ferrum. Click a ship to select it, then right-click a world to fly there. If a live conduit joins the two worlds, the ship surfs along it at five times its speed. A ship in orbit around a world can intercept one incoming strike."},
];

export function Academy({onDone}) {
  const [i, setI] = useState(0);
  const step = STEPS[i], last = i === STEPS.length - 1;
  return (
    <div className="overlay academy" style={{zIndex: 45}}>
      <div className="sheet glass academy-box">
        <div className="academy-kicker mono">FLIGHT ACADEMY · {i + 1} / {STEPS.length}</div>
        <h2 className="academy-title">{step.title}</h2>
        <p className="academy-body">{step.body}</p>
        <div className="academy-dots" aria-hidden="true">
          {STEPS.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="academy-nav">
          <button className="academy-btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          {last
            ? <button className="academy-btn primary" onClick={onDone}>Enter Command Deck</button>
            : <button className="academy-btn primary" onClick={() => setI(i + 1)}>Next</button>}
        </div>
        <button className="academy-skip" onClick={onDone}>Skip briefing</button>
      </div>
    </div>
  );
}
