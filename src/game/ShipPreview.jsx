// A small static view of a hull for the shipyard cards, drawn with the same routine as the map.
import {useEffect, useRef} from "react";
import {drawShip, HULL_SIZE} from "./ships.js";

const PREVIEW_SCALE = {corvette: 3.4, destroyer: 2.6, cruiser: 1.9};

export function ShipPreview({type}) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    drawShip(ctx, type, c.clientWidth / 2, c.clientHeight / 2, 0, {thrust: 0.5, t: 0, scale: PREVIEW_SCALE[type] ?? 2});
  }, [type]);
  const size = HULL_SIZE[type] ?? {length: 20, beam: 12};
  return <canvas ref={ref} className="ship-preview" style={{width: "100%", height: Math.max(64, size.beam * 2.4) + "px"}} aria-label={type} />;
}
