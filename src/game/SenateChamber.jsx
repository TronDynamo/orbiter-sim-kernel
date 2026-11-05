// Galactic Senate Chambers: the current motion, every leader's vote grouped by Senate bloc, and the result.
import {SENATE_BLOCS} from "./roster_data.js";
import {LEADERS} from "./roster_data.js";
import {LeaderPortrait} from "./LeaderPortrait.jsx";

export function SenateChamber({s, onClose}) {
  const sess = s.senate.current;
  const yes = sess.votes.filter((v) => v.yes).length;
  const blocs = Object.keys(SENATE_BLOCS);
  return (
    <div className="overlay" style={{zIndex: 30}} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet glass" style={{padding: 20, width: "min(760px, calc(100% - 32px))", maxHeight: "90%", overflowY: "auto"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
          <b style={{letterSpacing: "0.12em"}}>GALACTIC SENATE · SESSION {sess.n + 1}</b>
          <button className="pill zelo" onClick={onClose}>Close</button>
        </div>
        <h2 style={{margin: "4px 0", fontSize: 20}}>{sess.resolution.title}</h2>
        <p style={{margin: "0 0 10px", opacity: 0.9}}>{sess.resolution.text}</p>
        {blocs.map((b) => {
          const members = sess.votes.filter((v) => v.bloc === b);
          return (
            <div key={b} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0"}}>
              <div style={{fontSize: 12, letterSpacing: "0.08em", color: SENATE_BLOCS[b].color, marginBottom: 4}}>{SENATE_BLOCS[b].name} · {members.filter((m) => m.yes).length} for</div>
              {members.map((m) => (
                <div key={m.id} style={{display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 13}}>
                  <LeaderPortrait id={m.id} size={34} />
                  <span style={{flex: 1}}>{m.name}<small style={{display: "block", opacity: 0.7}}>{m.reason}</small></span>
                  <b style={{color: m.yes ? "#34d399" : "#f87171"}}>{m.yes ? "YES" : "NO"}</b>
                </div>
              ))}
            </div>
          );
        })}
        <div style={{borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, fontWeight: 700}}>
          {yes} for · {sess.votes.length - yes} against — <span style={{color: sess.passed ? "#34d399" : "#f87171"}}>{sess.passed ? "PASSED" : "FAILED"}</span>
          <div style={{fontWeight: 400, fontSize: 12, opacity: 0.85, marginTop: 4}}>
            {sess.passed ? `In force until the next session: ${sess.resolution.text}` : "The motion failed; current rules stand."}
          </div>
        </div>
        <small style={{opacity: 0.6}}>{LEADERS.length} leaders · {blocs.length} blocs</small>
      </div>
    </div>
  );
}
