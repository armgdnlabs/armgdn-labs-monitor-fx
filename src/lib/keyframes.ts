import type { EffectDef, ParamValue, ParamValues } from "../effects/types";
import { hexToRgb, rgbToHex } from "./color";

export type Easing = "smooth" | "linear" | "in" | "out" | "hold";
export const EASINGS: Easing[] = ["smooth", "linear", "in", "out", "hold"];

export interface Keyframe {
  t: number;
  v: ParamValue;
  /** Easing toward the next keyframe (default smooth). */
  e?: Easing;
}
export type KeyframeTracks = Record<string, Keyframe[]>;

/**
 * A modulator animates a numeric param without keyframes: value + depth·range·wave.
 * `cycles` counts whole periods per loop, so every export loops seamlessly.
 */
export type WaveShape = "sine" | "triangle" | "saw" | "square" | "random" | "drift";
export const WAVES: WaveShape[] = ["sine", "triangle", "saw", "square", "random", "drift"];
export interface Modulator {
  shape: WaveShape;
  cycles: number;
  /** Fraction of the param's full range, ±. */
  depth: number;
  /** 0..1 offset within a cycle. */
  phase: number;
}
export type Modulators = Record<string, Modulator>;

const HEX = /^#[0-9a-f]{6}$/i;

const EASE: Record<Easing, (x: number) => number> = {
  smooth: (x) => x * x * (3 - 2 * x),
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - (1 - x) ** 3,
  hold: () => 0,
};

function lerpValue(a: ParamValue, b: ParamValue, x: number): ParamValue {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * x;
  if (typeof a === "string" && typeof b === "string" && HEX.test(a) && HEX.test(b)) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex(ca[0] + (cb[0] - ca[0]) * x, ca[1] + (cb[1] - ca[1]) * x, ca[2] + (cb[2] - ca[2]) * x);
  }
  return x < 0.5 ? a : b;
}

export function sampleTrack(track: Keyframe[], t: number): ParamValue | undefined {
  if (!track.length) return undefined;
  if (t <= track[0].t) return track[0].v;
  const last = track[track.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (t >= a.t && t <= b.t) return lerpValue(a.v, b.v, EASE[a.e ?? "smooth"]((t - a.t) / Math.max(b.t - a.t, 1e-6)));
  }
  return last.v;
}

/** Static values overridden by any animated tracks at time t. */
export function resolveValues(values: ParamValues, tracks: KeyframeTracks, t: number): ParamValues {
  const keys = Object.keys(tracks);
  if (!keys.length) return values;
  const out = { ...values };
  for (const k of keys) {
    const v = sampleTrack(tracks[k], t);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Periodic wave in −1..1 at cycle position x (any real). */
export function wave(shape: WaveShape, x: number, cycles = 1): number {
  const f = x - Math.floor(x);
  switch (shape) {
    case "sine": return Math.sin(f * Math.PI * 2);
    case "triangle": return 1 - 4 * Math.abs(f - 0.5);
    case "saw": return f * 2 - 1;
    case "square": return f < 0.5 ? 1 : -1;
    case "random": {
      // Stepped sample & hold, eight steps per cycle; wraps with the loop.
      const steps = 8 * Math.max(1, Math.round(cycles));
      const i = Math.floor(f * 8 + Math.floor(x) * 8) % steps;
      return hash(i) * 2 - 1;
    }
    case "drift": {
      // Smooth periodic noise: a few incommensurate sines locked to the cycle.
      const a = f * Math.PI * 2;
      return (Math.sin(a) * 0.55 + Math.sin(a * 2 + 1.3) * 0.3 + Math.sin(a * 3 + 4.1) * 0.15);
    }
  }
}

export function applyModulators(effect: EffectDef, values: ParamValues, mods: Modulators, t: number, loop: number): ParamValues {
  const keys = Object.keys(mods);
  if (!keys.length) return values;
  const out = { ...values };
  for (const k of keys) {
    const p = effect.params.find((x) => x.key === k);
    const m = mods[k];
    if (!p || p.type !== "range" || typeof out[k] !== "number") continue;
    const x = (t / Math.max(loop, 0.1)) * m.cycles + m.phase;
    const v = (out[k] as number) + wave(m.shape, x, m.cycles) * m.depth * (p.max - p.min) * 0.5;
    out[k] = Math.min(p.max, Math.max(p.min, v));
  }
  return out;
}

export function upsertKeyframe(track: Keyframe[], t: number, v: ParamValue, epsilon = 1 / 60): Keyframe[] {
  const prev = track.find((k) => Math.abs(k.t - t) <= epsilon);
  const next = track.filter((k) => Math.abs(k.t - t) > epsilon);
  next.push({ t, v, ...(prev?.e ? { e: prev.e } : {}) });
  return next.sort((a, b) => a.t - b.t);
}

export function hasKeyframes(tracks: KeyframeTracks): boolean {
  return Object.values(tracks).some((t) => t.length > 0);
}
