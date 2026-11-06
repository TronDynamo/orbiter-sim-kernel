// Galactic Senate Chambers: the open motion with its countdown and the commander's vote, then the final tally.
import {useEffect, useState} from "react";
import {SENATE_BLOCS} from "./roster_data.js";
import {LEADERS} from "./roster_data.js";
import {LeaderPortrait} from "./LeaderPortrait.jsx";

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export function SenateChamber({s, onClose, onVote}) {
  // The clock runs while the chamber is open, so the countdown redraws itself from the live game state.
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(t); }, []);
  const open = s.senate.open;
  const sess = open ?? s.senate.current;
  const blocs = Object.keys(SENATE_BLOCS);
  const leaders = open ? open.leaders : sess.votes;
  const leadYes = leaders.filter((v) => v.yes).length;
  const left = open ? Math.max(0, open.closesAt - s.elapsed) : 0;
  const mine = open?.playerVote ?? null;
  return (
    <div className="overlay" style={{zIndex: 30}} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet glass" style={{padding: 20, width: "min(760px, calc(100% - 32px))", maxHeight: "90%", overflowY: "auto"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
          <b style={{letterSpacing: "0.12em"}}>GALACTIC SENATE · SESSION {sess.n + 1}</b>
          <button className="pill zelo" onClick={onClose}>Close</button>
        </div>
        <h2 style={{margin: "4px 0", fontSize: 20}}>{sess.resolution.title}</h2>
        <p style={{margin: "0 0 10px", opacity: 0.9}}>{sess.resolution.text}</p>

        {open ? (
          <div className="senate-vote" style={{border: "1px solid rgba(56,189,248,0.35)", borderRadius: 10, padding: 12, marginBottom: 10}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
              <b className="mono" style={{letterSpacing: "0.08em"}}>VOTE OPEN · FINAL VOTE IN <span style={{color: "#7dd3fc"}}>{clock(left)}</span></b>
              <span style={{fontSize: 12, opacity: 0.8}}>Leaders leaning: {leadYes} for · {leaders.length - leadYes} against</span>
            </div>
            <div style={{display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap"}}>
              <button className={"pill" + (mine === "yes" ? " on" : "")} style={{flex: 1, minWidth: 120, color: "#34d399"}} onClick={() => onVote("yes")}>Vote YES</button>
              <button className={"pill" + (mine === "no" ? " on" : "")} style={{flex: 1, minWidth: 120, color: "#f87171"}} onClick={() => onVote("no")}>Vote NO</button>
            </div>
            <small style={{opacity: 0.7, display: "block", marginTop: 6}}>
              {mine ? `Your vote: ${mine === "yes" ? "YES" : "NO"}. You can change it until the timer runs out.` : "You have not voted. An abstention counts for neither side."}
            </small>
          </div>
        ) : null}

        {open ? blocs.map((b) => {
          const members = leaders.filter((v) => v.bloc === b);
          return (
            <div key={b} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 0"}}>
              <div style={{fontSize: 12, letterSpacing: "0.08em", color: SENATE_BLOCS[b].color, marginBottom: 4}}>{SENATE_BLOCS[b].name} · leaning {members.filter((m) => m.yes).length} for</div>
            </div>
          );
        }) : blocs.map((b) => {
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

        {!open ? (
          <div style={{borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, fontWeight: 700}}>
            {sess.yes} for · {sess.no} against — <span style={{color: sess.passed ? "#34d399" : "#f87171"}}>{sess.passed ? "PASSED" : "FAILED"}</span>
            <div style={{fontWeight: 400, fontSize: 12, opacity: 0.85, marginTop: 4}}>
              Your vote: {sess.playerVote === "yes" ? "YES" : sess.playerVote === "no" ? "NO" : "abstained"}.{" "}
              {sess.passed ? `In force until the next session: ${sess.resolution.text}` : "The motion failed; current rules stand."}
            </div>
          </div>
        ) : null}
        <small style={{opacity: 0.6}}>{LEADERS.length} leaders · {blocs.length} blocs</small>
      </div>
    </div>
  );
}
