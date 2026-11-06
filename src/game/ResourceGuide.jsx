// Resource guide: where each resource comes from in the system you are in, how to get it, and what it is spent on.
// Everything here reads the live system and game state, so it matches what the map is doing right now.
import {resourceFor, RESOURCE_LABEL, BIOME_CLASS, YIELD_CLASSES} from "./currentSystem.js";
import {RULES} from "./rules.js";
import {SHIPS, DEPOT_COST, ARMOR} from "./ships.js";
import {INFRA} from "./colony.js";
import {JUMP_GATE_COST} from "./jumpGate.js";
import {SWAP_COST} from "./combat.js";

const fmt = (cost) => Object.entries(cost).map(([k, v]) => `${v} ${RESOURCE_LABEL[k] ?? (k === "cryo" ? "Coolant" : k)}`).join(" + ");

// Which biomes give each resource, from the same table the sector generator uses.
function biomesFor(resource) {
  const classes = Object.keys(YIELD_CLASSES).filter((k) => YIELD_CLASSES[k].resource === resource);
  const names = Object.keys(BIOME_CLASS).filter((b) => classes.includes(BIOME_CLASS[b]));
  return names;
}
const SECONDARY_NOTE = (resource) => Object.keys(YIELD_CLASSES).filter((k) => YIELD_CLASSES[k].secondary?.resource === resource)
  .map((k) => `${YIELD_CLASSES[k].label} (${YIELD_CLASSES[k].secondary.yield}/s secondary)`);

export function ResourceGuide({system, s, flowing, arkFed, onClose}) {
  const worlds = system.planets.map((p, i) => ({p, i, res: resourceFor(system, i)}));
  const surveyed = s.surveyed ?? {};
  const wrecked = s.wrecked ?? {};
  const statusOf = (id) => {
    if (wrecked[id]) return "Destroyed. It produces nothing.";
    if (!surveyed[id]) return "Uncharted: output stays at 0 until a Survey Probe (Shipyard) charts it.";
    if (flowing(id)) return "Producing: a live conduit carries its output.";
    if (arkFed(id)) return "Producing: tethered to the Ark, which delivers it directly.";
    return "Charted but not connected. Drag from it to a connected world (a conduit) or tether it to the Ark. A conduit whose line crosses the Sun is refused.";
  };
  const resources = ["alloys", "cryo", "compute", "biomass", "credits", "fuel", "propellant"];
  return (
    <div className="overlay" style={{zIndex: 30}} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet glass" style={{padding: 20, width: "min(760px, calc(100% - 32px))", maxHeight: "90%", overflowY: "auto"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
          <b style={{letterSpacing: "0.12em"}}>RESOURCE GUIDE · {system.id}</b>
          <button className="pill zelo" onClick={onClose}>Close</button>
        </div>

        <h3 style={{margin: "10px 0 4px", fontSize: 14}}>Worlds in this system</h3>
        {worlds.map(({p, i, res}) => {
          const sec = surveyed[p.id] && p.secondary ? ` + ${RESOURCE_LABEL[p.secondary.resource]} ${p.secondary.yield}/s` : "";
          return (
            <div key={p.id} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "6px 0", fontSize: 13}}>
              <div><b>{p.name}</b> · {p.yieldLabel ?? "World"} · {RESOURCE_LABEL[res] ?? res} {p.yield}/s{sec}</div>
              <div style={{opacity: 0.8, fontSize: 12}}>{statusOf(p.id)}</div>
            </div>
          );
        })}

        <h3 style={{margin: "14px 0 4px", fontSize: 14}}>How to get each resource</h3>
        {resources.map((r) => {
          const names = biomesFor(r), side = SECONDARY_NOTE(r);
          const here = worlds.filter((w) => w.res === r).map((w) => w.p.name);
          return (
            <div key={r} style={{borderTop: "1px solid rgba(255,255,255,0.08)", padding: "6px 0", fontSize: 13}}>
              <b>{RESOURCE_LABEL[r]}</b>
              <div style={{opacity: 0.85, fontSize: 12}}>
                {names.length ? `Primary: worlds with ${names.slice(0, 6).join(", ")}${names.length > 6 ? ", and more" : ""}.` : "No primary world type."}
                {side.length ? ` Secondary: ${side.join("; ")}.` : ""}
                {here.length ? ` In this system: ${here.join(", ")}.` : " None of the worlds in this system give it as a primary yield."}
              </div>
            </div>
          );
        })}
        <div style={{fontSize: 12, opacity: 0.85, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6}}>
          Every world pays only once it is charted by a Survey Probe. Freighters siphon charted worlds (not the home world) and
          haul the cargo home. Output needs a live conduit, or a tether to the Ark.
        </div>

        <h3 style={{margin: "14px 0 4px", fontSize: 14}}>What it is spent on</h3>
        <div style={{fontSize: 12, lineHeight: 1.6}}>
          <div>Conduit or tether: {RULES.COST.tether.alloys} Alloys each.</div>
          <div>Relay satellite: {fmt(RULES.COST.relay)}.</div>
          <div>Patch hull: {fmt(RULES.COST.repair)}.</div>
          <div>Weapon swap: Coilgun to Flak {SWAP_COST.flak} Alloys, Flak to Lance {SWAP_COST.lance} Alloys. Coilgun to Flak is {SWAP_COST.coilgun}.</div>
          {ARMOR.filter((a) => Object.keys(a.cost).length).map((a) => <div key={a.name}>{a.name}: {fmt(a.cost)}.</div>)}
          {Object.values(SHIPS).map((sh) => <div key={sh.name}>{sh.name}: {fmt(sh.cost)}.</div>)}
          <div>Fuel depot: {fmt(DEPOT_COST)}.</div>
          {INFRA.map((d) => <div key={d.key}>{d.name}: {fmt(d.cost)}.</div>)}
          <div>Jump gate portal (unlock): {fmt(JUMP_GATE_COST)}.</div>
        </div>
      </div>
    </div>
  );
}
