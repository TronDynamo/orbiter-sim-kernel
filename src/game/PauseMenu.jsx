// ESC / gear menu: the simulation is paused behind it. Resume, quick save, save and load slots, settings, and quit.
import {useState} from "react";
import {SlotBrowser} from "./SlotBrowser.jsx";
import {SettingsModal} from "./SettingsModal.jsx";

export function PauseMenu({onResume, onQuickSave, onSave, onLoad, onQuit, onSettingsChanged}) {
  const [panel, setPanel] = useState(null); // null | "save" | "load" | "settings" | "quit"
  const btn = {width: 260, justifyContent: "center"};
  if (panel === "save") return <SlotBrowser mode="save" onPick={(id) => { onSave(id); setPanel(null); }} onClose={() => setPanel(null)} />;
  if (panel === "load") return <SlotBrowser mode="load" onPick={onLoad} onClose={() => setPanel(null)} />;
  if (panel === "settings") return <SettingsModal onChange={onSettingsChanged} onClose={() => setPanel(null)} />;
  return (
    <div className="overlay" style={{zIndex: 30}}>
      <div className="sheet glass" style={{padding: 24, display: "flex", flexDirection: "column", gap: 8, alignItems: "center"}}>
        <b style={{letterSpacing: "0.2em", marginBottom: 6}}>PAUSED</b>
        <button className="pill zelo" style={btn} onClick={onResume}>Resume (ESC)</button>
        <button className="pill zelo" style={btn} onClick={onQuickSave}>Quick Save (F5)</button>
        <button className="pill zelo" style={btn} onClick={() => setPanel("save")}>Save Game</button>
        <button className="pill zelo" style={btn} onClick={() => setPanel("load")}>Load Game (F9 loads quicksave)</button>
        <button className="pill zelo" style={btn} onClick={() => setPanel("settings")}>Settings</button>
        {panel === "quit"
          ? (<>
              <div style={{fontSize: 13, textAlign: "center", maxWidth: 260}}>Quit to the title screen? Anything not saved is lost.</div>
              <button className="pill zelo" style={{...btn, color: "#f87171"}} onClick={onQuit}>Yes, quit to title</button>
              <button className="pill zelo" style={btn} onClick={() => setPanel(null)}>Cancel</button>
            </>)
          : <button className="pill zelo" style={btn} onClick={() => setPanel("quit")}>Quit to Title Screen</button>}
      </div>
    </div>
  );
}
