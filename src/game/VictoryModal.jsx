// Victory banner: shown when a victory condition is met, with a choice to keep playing.
export function VictoryModal({s, onKeep, onRestart}) {
  const v = s.victory;
  return (
    <div className="overlay" style={{zIndex: 35}}>
      <div className="sheet glass" style={{padding: 24, maxWidth: 480, textAlign: "center"}}>
        <div style={{letterSpacing: "0.2em", fontSize: 12, opacity: 0.75}}>VICTORY</div>
        <h2 style={{margin: "6px 0 8px", color: "#fbbf24"}}>{v.title}</h2>
        <p style={{margin: "0 0 18px"}}>{v.blurb}</p>
        <div style={{display: "flex", gap: 10, justifyContent: "center"}}>
          <button className="pill zelo" onClick={onKeep}>Keep playing</button>
          <button className="cta" onClick={onRestart}>New game</button>
        </div>
      </div>
    </div>
  );
}
