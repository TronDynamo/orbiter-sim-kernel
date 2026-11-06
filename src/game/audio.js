// Synthesised audio (Web Audio), created on the first user gesture. Levels follow the settings:
// music volume drives the ambience hum, SFX volume drives the warp sweep, both scaled by the master.
import {getSettings} from "./settings.js";

export function createAudio() {
  let ctx = null, hum = null, humGain = null;
  const levels = () => {
    const s = getSettings(), master = s.master / 100;
    return {hum: s.ambience ? 0.15 * master * (s.music / 100) : 0, sfx: 0.3 * master * (s.sfx / 100)};
  };
  const applyLevels = () => {
    if (!ctx || !humGain) return;
    humGain.gain.setTargetAtTime(levels().hum, ctx.currentTime, 0.05);
  };
  const start = () => {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      hum = ctx.createOscillator(); humGain = ctx.createGain();
      hum.type = "sine"; hum.frequency.setValueAtTime(55, ctx.currentTime);
      humGain.gain.setValueAtTime(0.01, ctx.currentTime);
      humGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, levels().hum), ctx.currentTime + 2);
      hum.connect(humGain); humGain.connect(ctx.destination); hum.start();
    } catch (e) { ctx = null; }
    return ctx;
  };
  const warp = () => {
    if (!ctx) start();
    if (!ctx) return;
    const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain(), peak = Math.max(0.0002, levels().sfx);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(800, now + 1.2);
    gain.gain.setValueAtTime(0.01, now); gain.gain.exponentialRampToValueAtTime(peak, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(now + 1.5);
  };
  // Low two-tone alert klaxon: square wave 220 Hz / 165 Hz alternating every 0.3 s, about 1.2 s in all.
  const klaxon = () => {
    if (!ctx) start();
    if (!ctx) return;
    const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain(), peak = Math.max(0.0002, levels().sfx);
    osc.type = "square";
    for (let i = 0; i < 4; i++) osc.frequency.setValueAtTime(i % 2 ? 165 : 220, now + i * 0.3);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 1.3);
  };
  return {start, warp, klaxon, applyLevels};
}
