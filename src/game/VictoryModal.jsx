// Victory banner: shown when a victory condition is met, with a choice to keep playing.
const fmtTime = (sec) => `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;

export function VictoryModal({s, onKeep, onRestart}) {
  const v = s.victory;
  return (
    <div className="overlay" style={{zIndex: 35}}>
      <div className="sheet glass" style={{padding: 24, maxWidth: 480, textAlign: "center"}}>
        <div style={{letterSpacing: "0.2em", fontSize: 12, opacity: 0.75}}>VICTORY</div>
        <h2 style={{margin: "6px 0 8px", color: "#fbbf24"}}>{v.title}</h2>
        <p style={{margin: "0 0 14px"}}>{v.blurb}</p>
        <div className="match-summary">
          <div><span>Time elapsed</span><b>{fmtTime(v.summary.seconds)}</b></div>
          <div><span>Credits accumulated</span><b>{v.summary.credits.toLocaleString()}</b></div>
          <div><span>Worlds intact</span><b>{v.summary.intact} / {v.summary.total}</b></div>
          <div><span>Final fleet power</span><b>{v.summary.fleetPower}</b></div>
        </div>
        <div style={{display: "flex", gap: 10, justifyContent: "center"}}>
          <button className="pill zelo" onClick={onKeep}>Keep playing</button>
          <button className="cta" onClick={onRestart}>New game</button>
        </div>
      </div>
    </div>
  );
}
