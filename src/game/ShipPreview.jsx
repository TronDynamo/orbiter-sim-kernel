// A shipyard card's preview bay: the hull drawn large, idling with a slow float and a small thrust plume.
import {useEffect, useRef} from "react";
import {drawShip} from "./ships.js";
import {commanderSprite, ASSET_BASE} from "./assetLoader.js";
import {enginesFor, drawThrusters} from "./thrusters.js";

const PREVIEW_FIT = {corvette: 0.8, destroyer: 0.9, cruiser: 0.95};

export function ShipPreview({type, commander}) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const ctx = c.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let size = {w: 0, h: 0};
    const fit = () => {
      size = {w: c.clientWidth, h: c.clientHeight};
      c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const t0 = performance.now();
    let raf = 0;
    const frame = (now) => {
      const {w, h} = size, t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const length = Math.min(w * 0.72, h * 1.1) * (PREVIEW_FIT[type] ?? 0.9);
      const float = Math.sin(t * 1.6) * 3;
      // The commander's own ship art once it has loaded; the vector hull until then (or with no commander).
      const art = commanderSprite(commander, type);
      if (art) {
        const dw = length, dh = dw * art.naturalHeight / art.naturalWidth;
        ctx.drawImage(art, w / 2 - dw / 2, h / 2 + float - dh / 2, dw, dh);
        ctx.save(); ctx.translate(w / 2, h / 2 + float); drawThrusters(ctx, dw, dh, enginesFor(commander, type, ASSET_BASE), 0.55, t); ctx.restore();
      } else {
        drawShip(ctx, type, w / 2, h / 2 + float, 0, {thrust: 0.55, t, length});
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", fit);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); };
  }, [type, commander]);
  return (
    <div style={{background: "rgba(2,6,23,0.9)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 12, height: 96, margin: "6px 0", overflow: "hidden"}}>
      <canvas ref={ref} aria-label={type} style={{display: "block", width: "100%", height: "100%"}} />
    </div>
  );
}
