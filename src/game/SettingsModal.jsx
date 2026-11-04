// Settings: audio, display and gameplay. Changes apply immediately and are saved to orbiter_settings_v1.
import {getSettings, setSettings} from "./settings.js";

const Row = ({label, children}) => (
  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)"}}>
    <span style={{fontSize: 13}}>{label}</span>{children}
  </div>
);
const Slider = ({value, onChange, min = 0, max = 100, suffix = "%"}) => (
  <span style={{display: "flex", alignItems: "center", gap: 8, minWidth: 200}}>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{flex: 1}} />
    <b className="mono" style={{width: 44, textAlign: "right", fontSize: 12}}>{value}{suffix}</b>
  </span>
);
const Toggle = ({value, onChange, on = "ON", off = "OFF"}) => (
  <button className="pill zelo" onClick={() => onChange(!value)} style={{minWidth: 64}}>{value ? on : off}</button>
);

export function SettingsModal({onChange, onClose}) {
  const s = getSettings();
  const set = (patch) => onChange(setSettings({...s, ...patch}));
  return (
    <div className="overlay" style={{zIndex: 40}}>
      <div className="sheet glass" style={{padding: 22, width: "min(480px, calc(100% - 32px))", maxHeight: "90%", overflowY: "auto"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
          <b style={{letterSpacing: "0.12em"}}>SETTINGS</b>
          <button className="pill zelo" onClick={onClose}>Close</button>
        </div>
        <div className="mono" style={{fontSize: 11, opacity: 0.6, marginTop: 6}}>AUDIO</div>
        <Row label="Master Volume"><Slider value={s.master} onChange={(v) => set({master: v})} /></Row>
        <Row label="Music Volume"><Slider value={s.music} onChange={(v) => set({music: v})} /></Row>
        <Row label="SFX / UI Volume"><Slider value={s.sfx} onChange={(v) => set({sfx: v})} /></Row>
        <Row label="Ambience Hum"><Toggle value={s.ambience} onChange={(v) => set({ambience: v})} /></Row>
        <div className="mono" style={{fontSize: 11, opacity: 0.6, marginTop: 12}}>VIDEO / DISPLAY</div>
        <Row label="CRT Scanline FX"><Toggle value={s.crt} onChange={(v) => set({crt: v})} /></Row>
        <Row label="Screen Shake / Impacts">
          <select value={s.shake} onChange={(e) => set({shake: e.target.value})} className="pill zelo">
            <option value="none">None</option><option value="subtle">Subtle</option><option value="heavy">Heavy</option>
          </select>
        </Row>
        <Row label="Orbit Path Opacity"><Slider value={s.orbitOpacity} min={10} onChange={(v) => set({orbitOpacity: v})} /></Row>
        <Row label="FPS / Telemetry Counter"><Toggle value={s.fps} onChange={(v) => set({fps: v})} /></Row>
        <div className="mono" style={{fontSize: 11, opacity: 0.6, marginTop: 12}}>GAMEPLAY</div>
        <Row label="Autosave Frequency">
          <select value={s.autosave} onChange={(e) => set({autosave: Number(e.target.value)})} className="pill zelo">
            <option value={30}>30s</option><option value={60}>60s</option><option value={120}>120s</option><option value={0}>Off</option>
          </select>
        </Row>
        <Row label="Pause On Defocus (alt-tab)"><Toggle value={s.pauseOnDefocus} onChange={(v) => set({pauseOnDefocus: v})} /></Row>
        <Row label="Confirm On Superweapon"><Toggle value={s.confirmSuperweapon} onChange={(v) => set({confirmSuperweapon: v})} /></Row>
      </div>
    </div>
  );
}
