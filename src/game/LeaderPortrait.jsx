// A leader's portrait in a holographic frame. Shows the image when it loads; otherwise a procedural
// avatar in the leader's hologram colour, with the bloc-coloured monogram and #ID.
import {useEffect, useState} from "react";
import {factionById} from "./factions.js";
import {SENATE_BLOCS} from "./roster_data.js";
import {PORTRAITS} from "./portraits.js";
import "./leader_portrait.css";

export function LeaderPortrait({id, size = 84, className = ""}) {
  const f = factionById(id);
  const entry = PORTRAITS[id];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (!f) return null;
  const bloc = SENATE_BLOCS[f.blocId]?.color ?? f.color;
  const hologram = entry?.fallback ?? f.color;
  const showImage = !!entry && !failed;
  return (
    <div className={`leader-portrait ${className}`} style={{width: size, height: size, "--bloc": bloc}} role="img" aria-label={`${f.name}, #${f.number}`}>
      {showImage ? (
        <img className="lp-img" src={entry.src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <svg className="lp-svg" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={`lp-g-${id}`} cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor={hologram} stopOpacity="0.45" />
              <stop offset="100%" stopColor="#020617" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#lp-g-${id})`} />
          <circle cx="50" cy="44" r="26" fill="none" stroke={hologram} strokeOpacity="0.35" strokeDasharray="3 3" />
          <circle cx="50" cy="44" r="18" fill={hologram} fillOpacity="0.12" stroke={bloc} strokeWidth="1.5" />
          <text x="50" y="50" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="700" fontSize="18" fill={bloc}>{f.monogram}</text>
          <text x="50" y="92" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill={hologram} fillOpacity="0.85">#{f.number}</text>
        </svg>
      )}
      <div className="lp-scan" />
      <div className="lp-vignette" />
    </div>
  );
}
