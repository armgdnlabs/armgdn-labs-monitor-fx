import type { ParamValue } from "./types";

/** Serializable layer stack, bottom layer first. */
export interface PresetLayer {
  id: string;
  isOn?: boolean;
  name?: string;
  values?: Record<string, ParamValue>;
  opacity?: number;
  blend?: number;
  seed?: number;
  pre?: number[];
  mask?: number[];
  keyframes?: Record<string, { t: number; v: ParamValue; e?: "smooth" | "linear" | "in" | "out" | "hold" }[]>;
  mods?: Record<string, { shape: "sine" | "triangle" | "saw" | "square" | "random" | "drift"; cycles: number; depth: number; phase: number }>;
  group?: string;
}
export interface PresetSnapshot {
  version: 1;
  graph: PresetLayer[];
  groups?: { id: string; name: string; enabled: boolean; collapsed: boolean }[];
}

export const PRESET_SECTIONS = ["Print & paper", "Drawing & painting", "Film & TV", "Retro & digital", "Looks"] as const;
export type PresetSection = (typeof PRESET_SECTIONS)[number];

export interface BuiltinPreset {
  id: string;
  name: string;
  section: PresetSection;
  /** Photo groups (data/photos.ts) its preview is drawn from. */
  moods: string[];
  snapshot: PresetSnapshot;
}

/** Stacks are written top layer first (the order a layers panel shows them); stored bottom first. */
const p = (id: string, name: string, section: PresetSection, moods: string[], top: PresetLayer[]): BuiltinPreset => ({
  id, name, section, moods, snapshot: { version: 1, graph: [...top].reverse() },
});
const L = (id: string, values: Record<string, ParamValue> = {}, extra: Partial<PresetLayer> = {}): PresetLayer => ({ id, values, ...extra });

/*
 * Each graph below is listed top layer first, like a layers panel (p() reverses it).
 * Every preset is a stack of library effects (the same 75 as effect.app). Stacks and values
 * follow effect.app's own presets where recorded; curves and texture layers, whose data
 * effect.app doesn't expose, are approximated.
 *
 * Layer mix (paper-texture) kinds: 0 crumpled, 1 kraft, 2 folded, 3 lined, 4 thin paper,
 * 5 tracing, 6 cardboard, 7 towel, 8 cracked paint, 9 broken glass, 10 dust, 11 linen.
 * Layer mix blends: 0 overlay, 1 multiply, 2 screen, 3 soft light, 4 light relief.
 * Layer blend (extra.blend): 0 normal, 1 multiply, 2 screen, 3 overlay, 4 soft light.
 */
const S_CURVE = "0,0 0.25,0.2 0.75,0.82 1,1";
const FADE_CURVE = "0,0.06 0.3,0.28 0.75,0.8 1,0.96";
const tx = (kind: number, opacity: number, extra: Record<string, ParamValue> = {}) => L("paper-texture", { kind, opacity, blend: 1, ...extra });
const grade = (v: Record<string, ParamValue>) => L("color-grading", v);

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  /* ── Print & paper ─────────────────────────────────────────────────── */
  p("solarized-print", "Solarized print", "Print & paper", ["fire", "film"], [
    L("blur-sharp", { blurriness: -0.3, ringing: 0.25 }),
    L("film-grain", { amount: 0.24, highlights: 0.4, shadows: 0.55 }),
    L("paper-scan", { textureMode: 1, opacity: 0.26, contrast: 1.1, distortion: 0.1, distScale: 800 }),
    L("gradient-map", { ramp: "#1B1E2A@0,#E8E9EE@0.45,#3A3E4C@0.7,#F2F3F6@1" }),
    L("curves", { master: S_CURVE }),
    L("gaussian-blur", { strength: 3.42, aspect: 0 }, { opacity: 0.89 }),
    L("monochrome", { rW: 0.3, gW: 0.59, bW: 0.11 }),
  ]),
  p("paper-towel-print", "Paper towel print", "Print & paper", ["portraits", "editorial"], [
    L("curves", { master: S_CURVE }),
    tx(7, 0.6, { blend: 4 }),
    L("displacement", { texture: 7, amount: 0.36 }),
    L("gaussian-blur", { strength: 1.5 }, { opacity: 0.5 }),
  ]),
  p("torn-photo", "Torn photo", "Print & paper", ["nature", "film"], [
    L("frame-drop", { fps: 6, irregularity: 0.07 }),
    L("paper-cutout", { columns: 3, rows: 1, seed: 67, rotation: 0.8, sizeVar: 0.05, widthVar: 0.8, uvShift: 0.05, colorVar: 0.08, tear: 0.02, chunk: 0, rough: 0.19, whiteEdge: 0.03, uneven: 0.48, shadow: 0.39, bgImage: 0, bg: "#080808" }),
    L("paper-scan", { opacity: 0.7, brightness: 0.05, contrast: 1.48, distortion: 0.5, distScale: 350 }),
    L("transform", { scale: -0.2, axes: 0, bg: "#FFFFFF", bgOpacity: 1 }),
    L("classic-film", { type: 2 }),
  ]),
  p("faded-copy", "Faded copy", "Print & paper", ["nature", "meadow"], [
    tx(4, 1),
    L("dither", { pattern: 13, palette: 20, colors: 4, distance: 1, gamma: 0.8, pixel: 1 }),
    L("gaussian-blur", { strength: 4.31, aspect: -1.16 }),
  ]),
  p("receipt-scan", "Receipt scans", "Print & paper", ["portraits", "editorial"], [
    L("frame-drop", { fps: 7, irregularity: 0 }),
    L("camera-shake", { motion: 0.04, speed: 4, blur: 0.03, pan: 0.737, tilt: 0.958, roll: 1, ptrSpeed: 0.77, zoom: 1, zoomSpeed: 2.272, phase: 0, randScale: 0, randSpeed: 0, pauseLen: 0, pauseEvery: 1 }),
    L("curves", { master: "0,0 0.35,0.2 0.65,0.85 1,1" }),
    L("transform", { scale: -0.32, axes: 0, bg: "#DEDEDE", bgOpacity: 1 }),
    L("paper-cutout", { columns: 1, rows: 1, seed: 72, rotation: 0, heightVar: 1.11, uvShift: 0, colorVar: 0, tear: 0, chunk: 0.2, rough: 1.41, whiteEdge: 0.4, uneven: 0.4, shadow: 0, bgImage: 0, bg: "#DEDEDE" }),
    L("blur-sharp", { blurriness: -5, ringing: 0.54 }),
    L("paper-scan", { opacity: 0.68, brightness: 0.22, contrast: 1.74, distortion: 0.5, distScale: 1000 }),
    L("dither", { palette: 0, colors: 2, gamma: 0.5, pixel: 1 }),
    L("noise", { amount: 1.37, size: 1.49, speed: 24 }),
    tx(4, 0.52),
    L("motion-blur", { strength: 17.46, angle: 265, box: 1, both: 0 }, { opacity: 0.86 }),
    L("levels", { midpoint: 1.5, lumaOnly: 1 }),
  ]),
  p("receipt", "Receipt", "Print & paper", ["dancer", "streets"], [
    L("curves", { master: "0,0 0.35,0.2 0.65,0.85 1,1" }),
    L("paper-cutout", { columns: 1, rows: 1, seed: 25, rotation: 0, heightVar: 1.11, uvShift: 0, colorVar: 0, tear: 0, chunk: 0.2, rough: 1.41, whiteEdge: 0.4, uneven: 0.4, shadow: 0, bgImage: 0, bg: "#DEDEDE" }),
    L("blur-sharp", { blurriness: -5, ringing: 0.28 }),
    L("paper-scan", { opacity: 0.68, brightness: 0.22, contrast: 1.74, distortion: 0.5, distScale: 1000 }),
    L("dither", { palette: 0, colors: 2, gamma: 0.5, pixel: 1 }),
    tx(4, 1),
    L("text", { content: "ORDER RECEIPT #3498", size: 0.02, y: 0.95, fill: "#000000" }),
    L("motion-blur", { strength: 17.46, angle: 265, box: 1, both: 0 }, { opacity: 0.8 }),
  ]),
  p("thin-paper-print", "Thin paper print", "Print & paper", ["editorial", "portraits"], [
    tx(4, 1),
    tx(5, 0.61),
    L("displacement", { texture: 4, mapBlur: 2.7, amount: 1.08 }),
    L("paper-scan", { texScale: 1.62, brightness: 0.19, contrast: 1.22 }),
    L("noise", { amount: 0.44, size: 0.5, chroma: 0 }),
  ]),
  p("riso-print", "Riso print", "Print & paper", ["editorial", "botanic"], [
    L("curves", { master: S_CURVE }),
    tx(4, 1),
    L("displacement", { texture: 4, mapBlur: 4.9, amount: 0.67 }),
    L("hue-curves", { hueSoft: 0.13, lumaSoft: 0.015, amount: 0.67 }),
    L("transform", { scale: -0.31, axes: 0, bg: "#F0EDE6", bgOpacity: 1 }),
    L("risograph", { paper: "#F0EDE6", grainScale: 0.2, grainOpacity: 1, grainSoft: 0.33, grainContrast: 1.84, r1: 10, r1reds: 3, r1yellows: 3, r1greens: -2, r1cyans: -2, r1blues: -2, r1magentas: -2, r2: 32, r2reds: -2, r2yellows: 3, r2greens: 3, r2cyans: -2, r2blues: -2, r3: 0, r3reds: 1.66, r3yellows: -1.69, r3cyans: 1.1 }),
  ]),
  p("grainy-riso", "Grainy riso", "Print & paper", ["botanic", "butterfly"], [
    L("risograph", { paper: "#F5F2E8", grainScale: 1.09, grainOpacity: 1, grainSoft: 0.37, grainContrast: 1.15, r1: 30 }),
    L("vignette", { anamorphism: 1.34, softness: 0.56, transparency: 0.85, color: "#FFFFFF", blend: 0.7 }),
  ]),
  p("cyanotype", "Cyanotype", "Print & paper", ["botanic", "nature"], [
    L("gradient-map", { ramp: "#001F7A@0,#2457A6@0.45,#9DBBE0@0.8,#EEF2F6@1" }),
    L("noise", { amount: 0.69 }),
    tx(4, 0.86),
    L("depth-of-field", { mRadius: 0.87, mStretch: 0.25, mRot: -12, mFalloff: 1, blur: 0.018, samples: 600, blades: 5, roundness: 0.63, aRot: -19, feather: 0.9, anamorphic: 1.91 }),
  ]),
  p("vintage-poster", "Vintage poster", "Print & paper", ["streets", "nature"], [
    L("threshold", { threshold: 43 }),
    L("thermal", { invert: 0, shadows: 0.06, midtones: 0.02, highlights: -0.01, type: 1, shift: 0.1, repeat: 1, edges: 0 }),
    L("dither", { pattern: 21, palette: 7, colors: 4, distance: 1, strength: 2, gamma: 0.5, pixel: 1 }),
    L("noise", { amount: 2.17, size: 1.44 }),
    tx(4, 1),
  ]),
  p("vintage-print", "Vintage print", "Print & paper", ["portraits", "streets"], [
    L("blur-sharp", { blurriness: -3.68, threshold: 0.324, ringing: 0.54 }),
    L("paper-scan", { texScale: 1.1, brightness: 0.22, contrast: 3, distortion: 0, distScale: 653 }),
    L("transform", { scale: -0.17, axes: 0, bg: "#FFFFFF", bgOpacity: 1 }),
    L("threshold", { threshold: 101 }),
    L("noise", { amount: 1.65, size: 0.5, floor: 0.14, chroma: 0.36, midtone: 0.27 }),
    L("levels", { midpoint: 1.13, lumaOnly: 1 }),
  ]),
  p("print-stamp", "Print stamp", "Print & paper", ["portraits", "sculpture"], [
    L("blur-sharp", { blurriness: -5, threshold: 0.667, ringing: 0.53 }),
    L("paper-scan", { texScale: 3, brightness: 0.27, contrast: 3, distortion: 1.2, distScale: 726 }),
    L("levels", { midpoint: 1.15 }),
    L("gaussian-blur", { strength: 6.34 }),
    L("transform", { scale: -0.11, axes: 0, bg: "#FFFFFF", bgOpacity: 1 }),
    L("halftone", { frequency: 300, rough: 0, ink1On: 0, ink2On: 0, ink3On: 0, ink4On: 1, density: 1 }),
    L("levels", { midpoint: 1.93, lumaOnly: 1 }),
    L("noise", { amount: 0.03, size: 0.56, floor: 0.01, chroma: 0.72, midtone: 0.47, highlight: 0.6 }),
    L("rgb-shift", { red: -0.2, blue: -0.184, stretch: 0.31 }),
    L("gaussian-blur", { strength: 1.42 }),
  ]),
  p("xerox", "Xerox", "Print & paper", ["portraits", "streets"], [
    L("threshold", { threshold: 90, color: "#171717", blendMode: 6 }),
    L("noise", { amount: 1.42, size: 1.66, chroma: 0, midtone: 0.67, highlight: 0.47 }),
    L("noise", { amount: 2, size: 0.5, chroma: 0.53, midtone: 0 }),
  ]),
  p("crumpled", "Crumpled paper", "Print & paper", ["botanic", "stilllife"], [
    tx(0, 1, { blend: 4 }),
    L("displacement", { texture: 0, mapBlur: 3.8, amount: 0.22 }),
  ]),
  p("folded-paper", "Folded paper", "Print & paper", ["editorial", "portraits"], [
    tx(2, 1, { blend: 4 }),
    L("displacement", { texture: 2, mapBlur: 1.6, amount: 0.18 }),
  ]),
  p("tracing-paper", "Tracing paper", "Print & paper", ["butterfly", "botanic"], [
    tx(5, 1, { blend: 2 }),
    L("curves", { master: "0,0.15 0.5,0.62 1,0.95" }),
    tx(4, 0.89),
    L("texture-blur", { texture: 5, strength: 0.072 }),
  ]),
  p("emboss-dirt", "Emboss dirt", "Print & paper", ["sculpture", "botanic"], [
    L("exposure", { exposure: 0.56 }),
    L("halftone", { pattern: 0, frequency: 120, density: 0.7 }),
    L("contrast", { strength: 0.7, pivot: 0.22, output: 0.48, gamma: 2.24 }),
    L("blur-sharp", { blurriness: -0.99, threshold: 0.413, ringing: 0.1 }),
    L("noise", { size: 0.5, floor: 0.01, chroma: 0.31, shadow: 0.65, midtone: 0.35, highlight: 0.73 }),
    L("emboss", { scale: 5.7, color: 12, shadowIntensity: 2, highlight: 0, highlightDist: 0, gradient: 1 }),
    L("gaussian-blur", { strength: 1.19 }),
    L("levels", { midpoint: 0.67, lumaOnly: 1 }),
  ]),

  /* ── Drawing & painting ────────────────────────────────────────────── */
  p("pink-paint-brush", "Pink paint brush", "Drawing & painting", ["botanic", "nature"], [
    L("paper-scan", { textureMode: 1, brightness: 0.01, contrast: 1.18, distortion: 0.5, distScale: 850 }),
    tx(11, 0.39, { scale: 0.83 }),
    L("gradient-map", { ramp: "#0C1724@0,#5B2C6F@0.4,#C77DBA@0.75,#F7D6EC@1" }),
    L("bloom", { threshold: 0.19, intensity: 1.08, factor: 0.85 }),
    L("texture-blur", { texture: 11, texScale: 1.43, strength: 0.083, boost: 0.23, influence: 0.9 }),
    L("displacement", { texture: 11, texScale: 1.2, mapBlur: 1.6, amount: 0.27 }),
  ]),
  p("cross-hatch", "Cross Hatch", "Drawing & painting", ["vase", "stilllife"], [
    L("halftone", { pattern: 4, frequency: 138, rough: 0.3, density: 1, ink1On: 0, ink2On: 0, ink3On: 0, ink4On: 1 }),
    L("curves", { master: "0,0.05 0.5,0.55 1,1" }),
  ]),
  p("pencil-drawing", "Pencil drawing", "Drawing & painting", ["portraits", "editorial"], [
    L("risograph", { paper: "#F5F2E8", grainScale: 0.26, grainOpacity: 1, grainSoft: 0.38, grainContrast: 3, r1: 29, r1reds: -2, r1yellows: 2.18, r1greens: 1.5, r1cyans: 2.44, r2: 1, r2reds: 3, r2yellows: 3, r2greens: 3, r2cyans: -0.87, r2blues: -2, r2magentas: -0.45, r3On: 0 }),
    tx(4, 1),
    tx(0, 0.3, { blend: 4 }),
    L("curves", { master: "0,0.05 0.5,0.55 1,1" }),
  ]),
  p("cube-hatch", "Cube hatch", "Drawing & painting", ["portraits", "editorial"], [
    L("halftone", { pattern: 3, frequency: 155, rough: 0.36, density: 1 }),
    L("cubify", { size: 2.68, depth: 3.62, dispersion: 0.03 }),
    L("curves", { master: "0,0.04 0.5,0.52 1,1" }),
  ]),
  p("pointillism", "Pointillism", "Drawing & painting", ["nature", "mountain"], [
    L("blur-sharp", { blurriness: -3.92, threshold: 0.556, ringing: 0.28 }),
    L("paper-scan", { opacity: 0, brightness: -0.09, contrast: 1.52, distortion: 2.9, distScale: 1000 }),
    L("gaussian-blur", { strength: 1.64 }, { opacity: 0.5 }),
    L("scatter", { size: 3.38, minSize: 0.2, maxSize: 0.07, widthVar: 0.5, colorMode: 1, spriteColor: "#000000", colorVar: 0.32, mode: 5, bg: "#FFFFFF", threshold: 1, key: "#000000", density: 162, gridAngle: -1, spread: 1, seed: 48, shOpacity: 0.25, shColor: "#333333", shDist: 0, shBlur: 0.15 }),
  ]),
  p("stippling", "Stippling", "Drawing & painting", ["portraits"], [
    L("blur-sharp", { blurriness: -5, threshold: 0.785, ringing: 0.65 }),
    L("paper-scan", { brightness: 0.22, contrast: 2.52, distortion: 1.2, distScale: 805 }),
    L("scatter", { size: 3.88, minSize: 0.15, maxSize: 0, widthVar: 0.5, colorMode: 0, spriteColor: "#000000", colorVar: 0.38, mode: 5, bg: "#FFFFFF", threshold: 1, key: "#000000", density: 173, gridAngle: 27, spread: 1 }),
  ]),
  p("scribble", "Scribble", "Drawing & painting", ["botanic", "nature"], [
    tx(4, 1),
    L("displacement", { texture: 0, amount: 1.52 }),
    L("displacement", { texture: 2, amount: 0.27 }),
    L("dither", { pattern: 3, palette: 3, colors: 4, distance: 1, gamma: 0.8, pixel: 1 }),
    L("texture-blur", { texture: 0, strength: 0.058, influence: 0.7 }),
  ]),
  p("pastel", "Pastel", "Drawing & painting", ["portraits", "botanic"], [
    L("blur-sharp", { blurriness: -3.17, threshold: 0.112, ringing: 0.06 }),
    tx(11, 0.79, { blend: 3 }),
    tx(4, 0.52),
    L("texture-blur", { texture: 11, strength: 0.054, boost: 0.6, influence: 0.9 }),
  ]),
  p("spray-paint", "Spray paint", "Drawing & painting", ["portraits", "streets"], [
    L("gradient-map", { ramp: "#000000@0,#000000@0.35,#D3202A@0.55,#F7F2EC@1" }),
    tx(6, 1),
    L("gaussian-blur", { strength: 6.09 }, { opacity: 0.61 }),
  ]),
  p("old-painting", "Old painting", "Drawing & painting", ["portraits", "stilllife"], [
    L("exposure", { exposure: 0.3 }),
    L("ink-bleed", { spread: 20, decay: 0.055, intensity: 1, noiseSize: 85, grain: 0.35, grainSize: 2.6 }),
    L("hue-saturation", { hue: 27, saturation: 1.09 }),
    L("bloom", { threshold: 0.8, intensity: 0.8 }),
    L("gradient-map", { ramp: "#001F7A@0,#8C5B3A@0.5,#F2D9A8@1" }, { opacity: 0.35, blend: 4 }),
    L("noise", { amount: 0.69 }),
    tx(11, 0.42, { blend: 0 }),
    L("depth-of-field", { mRadius: 0.83, mStretch: 0.25, mRot: -12, mFalloff: 1, blur: 0.009, samples: 110, blades: 5, roundness: 0.63, aRot: -19, feather: 0.9, anamorphic: 1.91 }),
  ]),

  /* ── Film & TV ─────────────────────────────────────────────────────── */
  p("purple-hour", "Purple hour", "Film & TV", ["portraits", "editorial"], [
    L("halation", { threshold: 0.42, knee: 0.28, boost: 0.55, local: 0.01, global: 0.33, intensity: 0.29, hue: 0.43, compensation: 0.67 }),
    L("blur-sharp", { blurriness: -1.24 }),
    grade({ gExp: 0.05, kExp: -2.71, kSat: 0.92, lExp: -0.14, lSat: 1.22, xExp: 0.49, xSat: 1.04, z1: -8, z2: -3, z3: 0.55, z4: 2.05, falloff: 2.26, kTint: "#3A1A6E", lTint: "#9A80D0" }),
    L("film-grain", { type: 10, amount: 0.17 }),
  ]),
  p("bleach-bypass", "Bleach bypass", "Film & TV", ["portraits", "streets"], [
    L("curves", { master: S_CURVE }),
    grade({ kExp: -1, kSat: 0.73, sExp: -0.36, sSat: 0.92, lExp: -0.54, lSat: 0.95, hSat: 1.02, xExp: -0.09, xSat: 0.86, falloff: 1.76, gSat: 0.7 }),
    L("film-grain", { type: 1, amount: 0.33, highlights: 0.3, shadows: 0.44, interval: 5 }),
  ]),
  p("revenge-yellow", "Revenge yellow", "Film & TV", ["portraits"], [
    L("paper-scan", { opacity: 0.8, brightness: 0.15, contrast: 1.79, distortion: 0.2, distScale: 551 }),
    grade({ gExp: 0.16, gSat: 0.8, sExp: -0.2, lExp: -0.94, lSat: 1.01, xSat: 1.12, z2: -0.8, falloff: 2.5 }),
    L("rgb-gain", { rMid: 0.29, bMid: 0.17, rGain: 0.95, gGain: 0.79, bGain: 1.44, rGamma: 1.13, gGamma: 0.71, bGamma: 1.08 }),
    L("motion-blur", { strength: 1.86, angle: 190, box: 1, mRadius: 0.92, mFalloff: 1.7, mStretch: 3 }, { opacity: 0.42 }),
    L("duotone", { start: "#D4FF00", end: "#000000", rG: 1.64, gG: 2.19, bG: 3 }, { opacity: 0.35, blend: 4 }),
  ]),
  p("northwest-woods", "Northwest woods", "Film & TV", ["forest", "nature"], [
    L("curves", { master: FADE_CURVE }),
    grade({ gExp: -0.19, kExp: -0.77, sTint: "#3E5A44", lTint: "#A8B590" }),
    L("bloom", { threshold: 0.99, intensity: 2.1 }),
    L("film-grain", { type: 5, amount: 0.59, interval: 6 }),
  ]),
  p("liminal-mall", "Liminal mall", "Film & TV", ["interior", "room"], [
    L("vhs", { resolution: 420, distortion: 0, colorFringing: 0, wobble: 0.59, tapeCrease: 0.37, verticalJump: 0.01, sparkle: 0.31, saturation: 1, softness: 0.4, colorDelay: 4.8, sharpening: 1.14 }),
    grade({ kExp: -0.06, kSat: 0.95, sExp: 0.32, sSat: 1.07, lExp: -0.13, lSat: 0.8, hSat: 0.91, xExp: 0.06, xSat: 0.89, z3: 1.8, falloff: 1.98, strength: 0.92 }),
    L("gaussian-blur", { strength: 3.87 }, { opacity: 0.05 }),
  ]),
  p("neon-express", "Neon express", "Film & TV", ["nightlife", "highway"], [
    L("halation", { threshold: 0.62, knee: 0.03, boost: 1, local: 0.015, global: 0.075, intensity: 0.4, hue: 0.07, background: 0, compensation: 0.98 }),
    grade({ gExp: 0.07, sSat: 0.88, lExp: 0.33, lSat: 0.96, hExp: 0.11, hSat: 0.87, xSat: 0.97, falloff: 1.99, strength: 0.77, sTint: "#2E6F6A" }),
    L("classic-film", { type: 4 }),
    L("gaussian-blur", { strength: 2.62 }, { opacity: 0.26 }),
  ]),
  p("old-editorial", "Old editorial", "Film & TV", ["editorial", "portraits"], [
    L("hue-curves", { lumaSoft: 0.13 }),
    grade({ gExp: 0.02, gSat: 0.9, kExp: -0.17, kSat: 0.75, sExp: -0.09, lExp: -0.02, lSat: 1.11, hExp: 0.02, z3: 1.65, z4: 1.95, falloff: 0.81 }),
    L("classic-film", { type: 2 }),
    L("film-grain", { type: 7, amount: 0.53, highlights: 0.91, midtones: 0.66, shadows: 0.53, interval: 6 }),
  ]),
  p("handheld-portra", "Handheld portra", "Film & TV", ["film", "portraits"], [
    L("hue-curves", { hueSoft: 0.055, lumaSoft: 0.235, amount: 0.46 }),
    grade({ gExp: 0.16, lExp: -0.77, lSat: 1.1, xExp: -0.36, xSat: 0.94, falloff: 2.5, strength: 0.14 }),
    L("classic-film", { type: 1 }),
    L("vignette", { size: 2, anamorphism: 0.45, softness: 0.83, dither: 0 }),
    L("bloom", { threshold: 0.87, intensity: 3.79, knee: 0.48, factor: 0.64 }),
    L("halation", { threshold: 0.43, knee: 0.24, boost: 0.21, local: 0.07, global: 0.105, intensity: 0.49, hue: 0.26 }),
    L("film-grain", { type: 14, amount: 1, interval: 1 }),
    L("camera-shake", { motion: 0.02, speed: 2.817, pan: 0.028, tilt: 1, roll: 0.16, ptrSpeed: 2.329, zoom: 0.042, zoomSpeed: 0.131, randScale: 1.643, randSpeed: 1.052, pauseLen: 0.052, pauseEvery: 3, pauseRand: 0.038 }),
  ]),
  p("kodak-gold", "Gold 200", "Film & TV", ["nature", "film"], [
    tx(4, 0.35),
    L("classic-film", { type: 4 }),
    L("film-grain", { type: 14, amount: 0.82, highlights: 0.99, midtones: 0.64, shadows: 0.44 }),
    L("vignette", { size: 1.55, anamorphism: 0.45, blend: 0.42 }),
  ]),
  p("sepia", "Sepia", "Film & TV", ["desert", "nature"], [
    grade({ gSat: 0.9, kExp: 0.16, kSat: 0.84, sSat: 1.16, hSat: 1.09, xSat: 0.93, falloff: 2.25 }),
    L("bw-film", { type: 5 }),
  ]),
  p("icy-tones", "Icy tones", "Film & TV", ["ocean", "nature"], [
    grade({ gExp: 0.06, kExp: -0.32, kSat: 0.4, sExp: -2.46, sSat: 0.48, lExp: -1.26, lSat: 0.91, hExp: -0.06, hSat: 0.75, xExp: 0.85, xSat: 0.97, z1: -4.9, z2: -0.55, z3: 2, z4: 1.9, falloff: 1.45, sTint: "#5C8AA6", lTint: "#B9D4E6" }),
  ]),
  p("photo-booth", "Photo booth", "Film & TV", ["portraits", "editorial"], [
    L("paper-scan", { opacity: 0.59, brightness: 0.16, contrast: 2.04, distortion: 0.5, distScale: 1000 }),
    L("curves", { master: "0,0.05 0.4,0.32 0.8,0.85 1,1" }),
    L("monochrome", { rW: 0.197, gW: 0.453, bW: 0.897, tint: "#FFCC94" }),
    L("vhs", { resolution: 420, distortion: 0, colorFringing: 0, wobble: 0.01, tapeCrease: 0, trackingNoise: 0, verticalJump: 0, sparkle: 0, flicker: 0, grain: 0, saturation: 0, colorShift: 0.16, colorBlend: 0.45, softness: 0.4, colorDelay: 0, sharpening: 0.33 }),
    L("gaussian-blur", { strength: 15.23 }, { opacity: 0.24 }),
  ]),
  p("vintage-soft-focus", "Vintage soft focus film", "Film & TV", ["portraits", "editorial"], [
    L("paper-scan", { opacity: 0.16, distortion: 0, distScale: 800 }),
    L("color-matrix", { rr: 0.93, rg: 0.04, rb: 0.03, gr: 0.03, gg: 0.94, gb: 0.03, br: 0.04, bg: 0.04, bb: 0.84, ro: 0.01, go: 0.01, bo: 0.01 }),
    L("film-grain", { amount: 0.28, highlights: 0.45, midtones: 0.8, shadows: 0.65 }),
    L("curves", { master: FADE_CURVE }),
    L("gaussian-blur", { strength: 2 }, { opacity: 0.75 }),
    L("bloom", { threshold: 0.5, intensity: 0.9, knee: 0.5, factor: 0.65 }),
  ]),
  p("slow-shutter", "Slow Shutter", "Film & TV", ["portraits", "dancer"], [
    grade({ kExp: 0.55, kSat: 0.95, xSat: 1.02, z1: -5.05, z2: -1.4, z3: 2.1, z4: 2.25, strength: 0.48 }),
    L("frame-drop", { fps: 2, irregularity: 0.03 }),
    L("noise", { size: 0.87, floor: 0.09, chroma: 0, shadow: 0.01, midtone: 0.31, highlight: 1, speed: 60 }),
    L("film-grain", { amount: 0.51, highlights: 1, shadows: 1, interval: 2 }),
    L("camera-shake", { motion: 4, speed: 4, pan: 0.309, tilt: 0.094, roll: 0.018, ptrSpeed: 4, zoom: 0.182, zoomSpeed: 4, phase: 0.6, randScale: 0.299, randSpeed: 0.41, pauseLen: 0.023, pauseEvery: 1, pauseRand: 0.149, rseed: 11 }),
    L("monochrome", { rW: 0.639, gW: 0.598 }),
    L("vhs", { resolution: 1024, distortion: 0.01, colorFringing: 0, wobble: 0, tapeCrease: 0, verticalJump: 0, sparkle: 1.14, flicker: 0, grain: 2, saturation: 1.45, colorShift: 0, colorBlend: 0, softness: 0.4, colorDelay: 8, sharpening: 2 }),
  ]),
  p("motion-freeze", "Motion freeze", "Film & TV", ["portraits", "editorial"], [
    L("frame-drop", { fps: 4, irregularity: 0.03 }),
    L("camera-shake", { motion: 4, speed: 4, pan: 0.296, tilt: 0.094, roll: 0.052, ptrSpeed: 4, phase: 0, randScale: 0.075, randSpeed: 0.263, pauseLen: 0.136, pauseEvery: 8, pauseRand: 0 }),
  ]),
  p("light-streaks", "Light streaks", "Film & TV", ["highway", "nightlife"], [
    grade({ gExp: -0.36, kExp: -1.03, kSat: 0.7, sExp: 0.47, sSat: 1.56, lExp: 0.17, lSat: 1.13, hExp: 0.58, hSat: 1.01, xExp: 0.24, xSat: 1.01, z1: -4.35, z2: -0.35, z3: 1.4, z4: 1.85, falloff: 1.5 }),
    L("motion-blur", { strength: 50, angle: 182, mask: 1, mRadius: 0.8, mFalloff: 1, mStretch: 2.05, mRot: 96, mInvert: 1 }),
    L("motion-blur", { strength: 31.95, angle: 178, both: 0, mask: 1, mRadius: 1.89, mFalloff: 6, mStretch: 5, mInvert: 1 }, { opacity: 0.32 }),
    L("motion-trails", { threshold: 0.79, knee: 1.25, dimming: 0.022, shake: 0.16, shakeSpeed: 3.18, intensity: 1.09, sourceDim: 1 }),
    L("hue-curves", { hueSoft: 0.035, lumaSoft: 0.15, amount: 0.69 }),
  ]),

  /* ── Retro & digital ───────────────────────────────────────────────── */
  p("old-tape", "Old tape", "Retro & digital", ["blossom", "nature"], [
    L("vhs", { resolution: 420, distortion: 0, colorFringing: 0, tapeCrease: 0, trackingNoise: 0, verticalJump: 0, sparkle: 0.15, flicker: 0.04, grain: 0.66, saturation: 1.3, colorShift: 0.09, softness: 0.41, colorDelay: 8, sharpening: 0.22 }),
    L("curves", { master: FADE_CURVE }),
    grade({ gExp: 0.02, kExp: -4, kSat: 1.36, sExp: 0.09, sSat: 0.71, lExp: 1.18, lSat: 0.99, hExp: 0.54, hSat: 0.46, xExp: 0.32, xSat: 0.9, z1: -3.5, z2: -2.05, z3: 1.25, z4: 1.6, falloff: 0.81 }),
  ]),
  p("teleshopping", "Teleshopping", "Retro & digital", ["ocean", "experimental"], [
    L("vhs", { resolution: 420, distortion: 0.45, verticalJump: 0.06, sparkle: 1.2, flicker: 0.03, grain: 1, saturation: 1.5, colorShift: 0, colorBlend: 0.44, softness: 2, colorDelay: 4.1, sharpening: 0.97 }),
    L("star-glow", { threshold: 0.46, knee: 0.29, intensity: 1.47, boost: 0.28, samples: 44, length: 200, falloff: 0.46, angle: 127, ramp: "#CFFF24@0,#FFFFFF@1", shift: -0.89 }),
  ]),
  p("tv", "TV", "Retro & digital", ["portraits"], [
    L("blur-sharp", { blurriness: -5, ringing: 1 }),
    L("ntsc", { ringing: 6, noise: 0, saturation: 2.4, fringes: 8.5, color1: 6, color2: 14.5 }),
    L("crt", { distance: 10, curvature: 0.08, bezel: 0, vignette: 0, bgOpacity: 0, density: 4.62, size: 0.5, softness: 0.491, gamma: 3.11, brightness: 6.9 }),
    L("noise", { amount: 0.31, size: 0.5, chroma: 0.26, shadow: 0.22, midtone: 0.14, highlight: 1 }),
    L("glitch", { scale: 0, offset: 5, angle: 1, rS: 0.05, gS: 0.22, bS: 0.28, rT: 0.46, gT: 0.89, bT: 1, seed: 0 }),
  ]),
  p("cyberpunk", "Cyberpunk", "Retro & digital", ["nightlife", "experimental"], [
    L("blur-sharp", { blurriness: -5, ringing: 0.59 }),
    L("rgb-shift", { red: -0.082, blue: -0.166, stretch: 0.16 }),
    L("crt", { distance: 1.5, curvature: 0.01, bezel: 0, vignette: 0, density: 5.54, size: 0.5, softness: 0.491, gamma: 10, brightness: 1.33 }),
    L("ntsc", { ringing: 5, noise: 0, saturation: 2.3, smear: -0.12, color1: 3 }),
    L("blob-tracker", { key: "#000000", threshold: 0.443, persistence: 0.52, randomPalette: 0, boxColor: "#FF0000", boxType: 1, thickness: 0.5, outline: 0.6, fill: 0.06, centerType: 4, centerSize: 11.5, captionPos: 0, captionSize: 24, captionBg: 0, lineType: 0 }),
    L("jpeg-glitch", { compression: 6, block: 1, acGain: 0.82, corruption: 45, detail: 100, start: 0, end: 58.9, seed: 27, bytes: 1, maxRandom: 33, chromaLuma: -0.08, mismatch: 25 }),
    grade({ gExp: 0.07, gSat: 1.5, kExp: -4, kSat: 1.09, lSat: 0.95, z1: -3.3, z2: 0.1, z3: 2.4, z4: 2.5, falloff: 2.5 }),
    L("halation", { threshold: 0.42, knee: 0.26, boost: 0.71, local: 0.05, global: 0, intensity: 0.49, hue: 1, background: 1, compensation: 0.79 }),
    L("thermal", { invert: 0, midtones: -0.16, highlights: 0.1, repeat: 0.9, edgeRange: 0.51 }),
  ]),
  p("thermal-camera", "Thermal camera", "Retro & digital", ["portraits", "experimental"], [
    L("vhs", { resolution: 1024, colorFringing: 0, wobble: 0, tapeCrease: 0, trackingNoise: 0, verticalJump: 0, sparkle: 1.39, flicker: 0.19, grain: 0.48, saturation: 1.16, colorShift: 0.27, colorBlend: 0.52, softness: 1.02, colorDelay: 4.1 }),
    L("thermal", { shadows: -0.3, midtones: -0.02, highlights: 0, type: 1, repeat: 1, edgeRange: 0.23 }),
    L("ntsc", { ringing: 5, noise: 0, saturation: 3.8, fringes: 4.5, color1: 20 }),
    L("bloom", { threshold: 0.79, intensity: 2.36 }),
    L("gaussian-blur", { strength: 0.52 }),
    L("noise", { amount: 1.91, size: 0.5, speed: 50 }),
  ]),
  p("gameboy-camera", "Pocket camera", "Retro & digital", ["portraits"], [
    L("dither", { pattern: 5, palette: 1, colors: 4, distance: 1, gamma: 0.9, pixel: 3 }),
    L("curves", { master: S_CURVE }),
  ]),
  p("nokia-3310", "Brick phone", "Retro & digital", ["portraits"], [
    L("dither", { pattern: 6, palette: 12, colors: 2, distance: 0, gamma: 2.2, pixel: 3 }),
    L("monochrome", { rW: 0.83, gW: 0.87, bW: 0.964 }),
  ]),
  p("ps1", "PS1", "Retro & digital", ["editorial", "portraits"], [
    L("dither", { pattern: 17, palette: 7, colors: 16, distance: 1, strength: 1.3, gamma: 1.2, pixel: 2 }),
    L("led-screen", { pixelSize: 3.71, pixelBlur: 0, rgb: 0 }),
    L("led-screen", { pixelSize: 3.79, pixelBlur: 0, rgb: 0 }),
    L("curves", { master: S_CURVE }),
    L("gaussian-blur", { strength: 1.6 }),
  ]),
  p("apple-ii-palms", "Apple II", "Retro & digital", ["palms", "nature"], [
    L("crt", { density: 6, curvature: 0.12, brightness: 2.6, vignette: 6, layout: 1 }),
    L("micro-8bit", { mode: 0, dither: 1, exposure: 0.2 }),
  ]),
  p("mac-classic", "MacPaint", "Retro & digital", ["botanic", "flower"], [
    L("paint-1bit", { width: 342, threshold: 0.354, contrast: 2.5, sharpen: -0.83, radius: 1.2, edges: 1, edgeThreshold: 0.1, edgeWidth: 1.1 }),
  ]),
  p("msx-ascii", "MSX ASCII", "Retro & digital", ["nature", "architecture"], [
    L("crt", { distance: 1.58, curvature: 0.1, bezel: 0.03, vignette: 10, dots: 0, density: 5.56, size: 0.5, softness: 0.331, gamma: 4.85, brightness: 1.12 }),
    L("levels", { midpoint: 1.17, lumaOnly: 1 }),
    L("bloom", { threshold: 0.81, intensity: 2.94, factor: 0.22, blend: 1, tonemapper: 7 }),
    L("ascii", { charSet: 1, density: 45, aspect: 0.55, fg: "#00FF40", bg: "#001F0D" }),
    L("gaussian-blur", { strength: 5.23 }, { opacity: 0.52 }),
    L("noise", { amount: 1.06, size: 0.5, floor: 0.29, chroma: 1, midtone: 0, highlight: 1, speed: 52 }),
  ]),
  p("ascii-cut", "Ascii cut", "Retro & digital", ["tree", "nature"], [
    L("ascii", { charSet: 1, density: 59, aspect: 0.55, fg: "#000000", bg: "#FFFFFF", contrast: 3, cutDarks: 0.5, cutLights: 0.11, overlay: 1 }),
    L("noise", { amount: 2.85, size: 0.5, floor: 0.09, chroma: 0.48, shadow: 0, midtone: 0, highlight: 1 }),
    L("grid-split", { density: 29, mergeCutoff: 0.08, mergeDepth: 8, strokes: 0, hide: 0.48, bg: "#FFFFFF", bgCutoff: 0.1, marker: 0 }),
  ]),
  p("high-tech-low-life", "High-tech low-Life", "Retro & digital", ["portraits"], [
    L("curves", { master: S_CURVE }),
    L("ascii", { charSet: 1, density: 70, aspect: 0.73, contrast: 0.55, cutDarks: 0.45, cutLights: 0.5, overlay: 1 }),
    L("gaussian-blur", { strength: 6.99, aspect: 0.2 }, { opacity: 0.39 }),
    L("ascii", { charSet: 2, density: 41, aspect: 0.55, contrast: 1.64, cutDarks: 0.38, cutLights: 0.05, overlay: 1 }),
  ]),
  p("marathon", "Marathon", "Retro & digital", ["portraits"], [
    L("ascii", { charSet: 1, density: 70, aspect: 0.73, contrast: 0.55, cutDarks: 0.45, cutLights: 0.5, overlay: 1 }),
    L("ascii", { charSet: 3, density: 14, aspect: 0.55, fg: "#7AE3FF", contrast: 1.36, cutDarks: 0.29, cutLights: 0.46, overlay: 1 }),
    L("crt", { distance: 2.61, curvature: 0.06, vignette: 0, density: 4.75, size: 0.43, softness: 0.411, gamma: 3.65, brightness: 9.51 }),
    L("monochrome", { rW: 0.372, gW: 1.408, bW: 1.435, tint: "#00FFB3" }),
    L("noise", { amount: 0.75, size: 0.5, floor: 0.11, chroma: 1, shadow: 0.2, midtone: 0.48, highlight: 1, speed: 55 }),
    L("modulation", { waveScale: 500, fm: 0.6, direction: 1 }, { opacity: 0.3, blend: 4 }),
  ]),
  p("rgb-hatch", "RGB hatch", "Retro & digital", ["portraits", "editorial"], [
    L("motion-blur", { strength: 1.16, box: 1 }),
    L("hue-saturation", { saturation: 2.13 }),
    L("stripe", { reps: 40, soft: 1, pattern: 0, rShift: 0.14, gShift: 0.22, bShift: 0.34, rowFreq: 50 }),
    L("cubify", { size: 3.14, stretch: -0.72, depth: 1.42, hard: 1 }),
    L("rgb-shift", { red: -0.107, blue: 0.057, stretch: 1.05 }),
    L("gaussian-blur", { strength: 5.44 }, { opacity: 0.5, blend: 2 }),
  ]),
  p("digital-gobelen", "Digital Gobelen", "Retro & digital", ["portraits", "editorial"], [
    L("dither", { pattern: 1, palette: 7, colors: 18, distance: 1, strength: 2, gamma: 1.3, pixel: 1 }),
    L("exposure", { exposure: 2.35, gamma: 2.28, gamut: 0.17 }),
    L("circular-blur", { radius: 1.94, repetitions: 23, decay: 0 }),
    L("stripe", { reps: 60, angle: 360, soft: 1, pattern: 0, gShift: 0.13, bShift: 0.24, rowFreq: 1 }),
    L("ntsc", { ringing: 30, encoding: 5, noise: 0.06, saturation: 5, smear: 0.2, color1: 12, color2: 20 }),
  ]),
  p("bad-signal", "Bad signal", "Retro & digital", ["portraits", "editorial"], [
    L("blur-sharp", { blurriness: -5, ringing: 0.28 }),
    L("dither", { palette: 0, colors: 2, distance: 1, gamma: 0.5, pixel: 1 }),
    L("motion-blur", { strength: 4.03, angle: 166 }, { opacity: 0.78 }),
    L("modulation", { resolution: 464, waveScale: 130, fm: 0.7, strength: 1.1, phase: 8.2, lineWidth: 1.35 }),
    L("monochrome"),
  ]),
  p("modulation-dither", "Modulation dither", "Retro & digital", ["portraits", "editorial"], [
    L("crt", { distance: 2.61, curvature: 0.06, vignette: 0, density: 4.75, size: 0.43, softness: 0.411, gamma: 3.65, brightness: 9.51 }),
    L("monochrome", { rW: 0.372, gW: 1.408, bW: 1.435, tint: "#0054FF" }),
    L("noise", { amount: 0.75, size: 0.5, floor: 0.11, chroma: 1, shadow: 0.2, midtone: 0.48, highlight: 1 }),
    L("gaussian-blur", { strength: 7.43, aspect: -1.01 }, { opacity: 0.59 }),
    L("modulation", { waveScale: 500, fm: 1, direction: 1 }),
  ]),
  p("damaged-jpeg", "Damaged JPEG", "Retro & digital", ["botanic", "flower"], [
    L("blur-sharp", { blurriness: -1.77, ringing: 1 }),
    L("jpeg-glitch", { compression: 20, block: 1, acGain: 0.91, corruption: 0, detail: 100, bytes: 44, maxRandom: 255, chromaLuma: -0.17, mismatch: 39, qtcTarget: 1 }),
    L("displacement", { texture: 9, texScale: 1.37, amount: 0.09 }),
    L("glitch", { scale: 0, offset: 5, angle: 1, rS: 0.05, gS: 0.22, bS: 0.28, rT: 0.46, gT: 0.89, bT: 1, seed: 0 }),
  ]),
  p("jpeg-compression", "JPEG compression", "Retro & digital", ["fire", "experimental"], [
    L("jpeg-glitch", { compression: 2, block: 16, acGain: 2, corruption: 0, detail: 100, bytes: 64, maxRandom: 255, chromaLuma: -1, mismatch: 0, qtcTarget: 1 }),
  ]),
  p("tile-shift", "Tile shift", "Retro & digital", ["sky", "nature"], [
    L("grid-split", { density: 7, mergeDepth: 4, noiseSize: 0.31, noiseSpeed: 0.47, shiftX: 0.45, shiftY: 0.2, strokes: 0, gap: 0, strokeColor: "#FFFFFF", marker: 0, guidesHidden: 0, guidesShown: 0, bg: "#0008FF" }),
  ]),
  p("glitch-blur", "Glitch blur", "Retro & digital", ["portraits", "nightlife"], [
    L("glitch", { scale: 5, offset: 5, angle: 100, rS: 0.05, gS: 0.01, bS: 0.01, rT: 0.05, gT: 0.05, bT: 0.05, seed: 0.05 }),
    L("glitch", { scale: 5, offset: 5, angle: 2, rS: 0.05, gS: 0.01, bS: 0.01, rT: 0.01, gT: 0.01, bT: 0, seed: 0.039 }),
  ]),
  p("grunge-dither", "Grunge dither", "Retro & digital", ["portraits", "editorial"], [
    L("paper-scan", { brightness: 0.03, contrast: 1.26, distortion: 0.7, distScale: 463 }),
    L("dither", { pattern: 3, palette: 19, colors: 12, gamma: 1.8, pixel: 3 }),
    tx(10, 1),
    L("gaussian-blur", { strength: 20.58 }, { opacity: 0.17 }),
  ]),
  p("hot-light-glow", "Hungry light glow", "Retro & digital", ["nightlife", "portraits"], [
    L("star-glow"),
    L("paper-scan", { textureMode: 1, brightness: 0.03, contrast: 1.26, distortion: 0.7, distScale: 463 }),
    L("dither", { pattern: 6, palette: 18, colors: 12, strength: 1.4, gamma: 1.8, pixel: 3 }),
    tx(10, 1, { scale: 1.93 }),
    L("gaussian-blur", { strength: 20.58 }, { opacity: 0.17 }),
  ]),
  p("star-burst", "Star burst", "Retro & digital", ["botanic", "flower"], [
    L("gaussian-blur", { strength: 7.3 }),
    L("star-glow", { threshold: 0.01, knee: 0.26, intensity: 2.4, boost: 0.25, streaks: 2, samples: 39, length: 14.6, falloff: 0.37, angle: -90, colorize: 0.69, shift: 1 }),
    L("modulation", { resolution: 480, waveScale: 500, fm: 1, strength: 0.1, direction: 3, phase: 8.78, lineWidth: 1.25 }),
    L("cubify", { size: 3.11, depth: 4.61 }),
  ]),

  /* ── Looks ─────────────────────────────────────────────────────────── */
  p("acid-dream", "Acid dream", "Looks", ["interior", "architecture"], [
    L("motion-trails", { threshold: 0.69, knee: 0.57, dimming: 0.066 }),
    grade({ gSat: 1.4, kExp: -4, kSat: 1.09, z1: -3.95, z2: -0.15, z3: 2.4, z4: 2.5, falloff: 2.5 }),
    L("thermal", { invert: 0, shadows: -0.18, midtones: -0.25, repeat: 0.8 }, { opacity: 0.6, blend: 4 }),
    L("texture-blur", { strength: 0.008 }),
  ]),
  p("washed-green", "Washed green", "Looks", ["nature", "mountain"], [
    L("halation", { threshold: 0.35, knee: 0.33, boost: 0.7, local: 0.005, global: 0.01, intensity: 0.58, hue: 1, background: 1, compensation: 0.77 }),
    grade({ gExp: 1.31, gSat: 1.8, kExp: -0.62, kSat: 1.3, sExp: -0.18, sSat: 0, lExp: 0.44, z1: -1.8, z2: 1.05, z3: 0.9, z4: 2.35, falloff: 2.5 }),
    L("curves", { master: FADE_CURVE }),
    L("color-balance", { red: -0.14, green: -0.87, blue: -0.69, gamma: 3.06 }),
    L("texture-blur", { texScale: 2.84, strength: 0, boost: 0.52, influence: 0.3 }),
  ]),
  p("heatwave", "Heatwave", "Looks", ["desert"], [
    L("motion-blur", { strength: 22.1, mRadius: 0.5, mFalloff: 2.5 }, { opacity: 0.3 }),
    L("exposure", { exposure: 3.62, gamma: 1.84 }, { opacity: 0.5 }),
    L("curves", { master: S_CURVE }),
    grade({ gExp: 0.57, gSat: 1.1, kExp: 0.06, kSat: 1.04, sExp: -0.18, sSat: 0, lExp: 0.44, z1: -1.8, z2: 1.05, z3: 0.9, z4: 2.35, falloff: 2.5 }),
    L("color-balance", { red: -0.54, green: -0.79, blue: -0.72, gamma: 2.51 }),
  ]),
  p("polaroid-600", "Polaroid 600", "Looks", ["botanic", "flower"], [
    L("transform", { scale: -0.2, axes: 0, bg: "#D9D9D9", bgOpacity: 1 }),
    L("instant-film", { type: 0 }),
    L("motion-blur", { strength: 3.87 }, { opacity: 0.39 }),
  ]),
  p("kind-of-blue", "A kind of blue", "Looks", ["ocean", "sky"], [
    L("curves", { master: S_CURVE }),
    L("monochrome", { rW: 0.372, gW: 1.408, bW: 1.435, tint: "#0054FF" }),
    L("noise", { amount: 0.75, size: 0.5, floor: 0.11, chroma: 1, shadow: 0.2, midtone: 0.48, highlight: 1 }),
    L("gaussian-blur", { strength: 7.43, aspect: -1.01 }, { opacity: 0.59 }),
  ]),
  p("y2k-street", "Y2K Street", "Looks", ["editorial", "streets"], [
    grade({ gSat: 0.9, falloff: 2.12 }),
    L("paper-scan", { opacity: 0.83, texScale: 1.54, brightness: 0.17, contrast: 2.3, distortion: 0.2, distScale: 437 }),
    L("contrast", { strength: -0.3, pivot: 0.52, gamma: 1.43 }),
    L("star-glow", { threshold: 0.62, knee: 0.24, intensity: 0.25 }),
    L("color-temperature", { shadowK: 6153, highlightK: 6878, gamma: 2.35 }),
    L("rgb-gain", { rMid: 0.72, rGain: 1.17, gGain: 0.92, bGain: 1.01, rGamma: 0.88, gGamma: 0.94, bGamma: 0.67 }),
    L("levels", { midpoint: 0.71 }),
  ]),
  p("y2k-blue", "Y2K blue", "Looks", ["portraits", "editorial"], [
    L("curves", { master: S_CURVE }),
    L("monochrome", { rW: 0.372, gW: 1.408, bW: 1.435, tint: "#0054FF" }),
    L("noise", { amount: 0.75, size: 0.5, floor: 0.11, chroma: 1, shadow: 0.2, midtone: 0.48, highlight: 1 }),
    L("gaussian-blur", { strength: 7.43, aspect: -1.01 }, { opacity: 0.59 }),
  ]),
  p("y2k-summer", "Y2K Summer", "Looks", ["editorial", "portraits"], [
    L("paper-scan", { opacity: 0.74, texScale: 1.69, brightness: 0.13, contrast: 2.04, distortion: 0.1 }),
    L("star-glow", { threshold: 0.35, knee: 0.2, intensity: 0.39, boost: 0.63, length: 59.5, alternate: 0.5, falloff: 0.31 }),
    L("hue-curves", { hueSoft: 0, lumaSoft: 0.14, amount: 0.78 }),
    grade({ gExp: -1.22, gSat: 0.5, kExp: 0.11, kSat: 1.14, sExp: 4, sSat: 1.09, lExp: 0.97, lSat: 0.52, hExp: 1.24, hSat: 1.32, xSat: 1.05, z1: -2.55, z2: -1, z3: 1.95, z4: 2.4, falloff: 2.5, strength: 0.52 }),
    L("rgb-gain", { rMid: 0.07, gMid: 1, bMid: 0.76, rGain: 0.52, gGain: 1.18, bGain: 1.24, rGamma: 1.61, gGamma: 1.1, bGamma: 1.6 }, { opacity: 0.5 }),
  ]),
  p("infrared-pink", "Infrared pink", "Looks", ["palms", "car"], [
    L("infrared-film", { type: 1 }),
    L("star-glow", { threshold: 0.75, knee: 0.17, intensity: 0.23, samples: 33, length: 107.6, falloff: 0.31 }),
    L("hue-saturation", { hue: 0, saturation: 1.15 }),
    L("motion-blur", { strength: 3.38, box: 1, mRadius: 0.92, mFalloff: 1.7, mStretch: 3.35 }, { opacity: 0.59 }),
    L("duotone", { start: "#000A52", end: "#E357FF", rG: 0.85, gG: 1.1, bG: 1.84 }, { opacity: 0.6, blend: 4 }),
  ]),
  p("red-lights", "Red lights", "Looks", ["portraits"], [
    L("classic-film", { type: 4 }),
    L("film-grain", { type: 4, amount: 1, highlights: 1, shadows: 1, interval: 1 }),
    L("duotone", { start: "#000000", end: "#D60000", rG: 0.81, gG: 1.51, bG: 1.35 }),
    L("noise", { amount: 1.9, size: 0.5, floor: 0.03, chroma: 0.22, shadow: 0.31, highlight: 1 }),
  ]),
  p("luma-pulse", "Luma pulse", "Looks", ["botanic", "experimental"], [
    L("gradient-map", { ramp: "#2CB34A@0,#9FE03A@0.3,#FF7A1A@0.6,#C00356@1", shift: 0.64 }, { mods: { shift: { shape: "saw", cycles: 1, depth: 1, phase: 0 } } }),
    L("noise", { amount: 1.82, size: 0.68, floor: 0.03, chroma: 0, shadow: 0.36, midtone: 0.56, highlight: 0.73 }),
    L("gaussian-blur", { strength: 6.63 }),
  ]),
  p("angelic", "Angelic", "Looks", ["portraits", "sculpture"], [
    L("curves", { master: "0,0.1 0.5,0.62 1,1" }),
    L("gaussian-blur", { strength: 24.59 }, { opacity: 0.48, blend: 2 }),
    L("levels", { lumaOnly: 1, inBlack: 0.05, inWhite: 0.85 }),
    L("monochrome", { rW: 0.614, gW: 2, bW: -0.543, tint: "#BFDAF0" }),
  ]),
  p("radiant", "Radiant", "Looks", ["portraits", "editorial"], [
    L("curves", { master: S_CURVE }),
    L("duotone", { start: "#6BFC94", end: "#F0290F", rG: 0.32, gG: 1.01, bG: 0.81 }),
    L("noise", { amount: 0.27, size: 0.5, floor: 0.3, chroma: 1, shadow: 0.26, midtone: 0.24, highlight: 1 }),
    L("depth-of-field", { mRadius: 1.08, mStretch: 0.9, mFalloff: 1.6, blur: 0.1, samples: 160, blades: 7, roundness: 1, aRot: -180, feather: 0.42, cata: 0.7 }),
  ]),
  p("blue-steel", "Blue steel", "Looks", ["sculpture", "portraits"], [
    grade({ gExp: -0.41, kExp: -0.39, kSat: 1.22, lExp: 0.09, lSat: 1.08, hExp: 0.02, xExp: 0.54, xSat: 0.86, z1: -3.45, z2: 0.4, z3: 1.25, z4: 1.35, falloff: 1.39 }),
    L("film-grain", { type: 7, amount: 1, highlights: 0.92, shadows: 1, interval: 10 }),
    L("dither", { pattern: 3, palette: 13, colors: 8, gamma: 1.3, pixel: 1 }),
    L("monochrome", { rW: 0.09, gW: 0.251, bW: 1.596, tint: "#C9D8EA" }),
    L("gaussian-blur", { strength: 3.42 }, { opacity: 0.5 }),
  ]),
  p("tonal-compression", "Tonal compression", "Looks", ["architecture", "interior"], [
    L("curves", { master: "0,0.12 0.3,0.33 0.7,0.66 1,0.86" }),
  ]),
  p("orb", "ORB", "Looks", ["experimental", "nightlife"], [
    L("exposure", { exposure: 0.47, gamma: 2.22, reinhard: 1 }),
    L("vignette", { size: 0.81, softness: 0.73 }),
    L("gaussian-blur", { strength: 10.28, aspect: -1.2 }),
    L("rgb-shift", { red: 0.2, blue: 0.2, stretch: 1.3 }),
    L("ripple", { amplitude: 0.097, frequency: 3.45, speed: 0.8 }),
    L("pinch", { strength: 0.83, radius: 1.68 }),
    L("gaussian-blur", { strength: 43.79, aspect: 0.89 }),
    L("rect-to-polar", { angle: 16, radius: 1.94, distortion: -0.8, overlap: 0.22 }),
  ]),
  p("ghosts", "Ghosts", "Looks", ["portraits", "streets"], [
    L("gaussian-blur", { strength: 1.19 }, { opacity: 0.45 }),
    L("curves", { master: "0,0.1 0.5,0.6 1,1" }),
    L("motion-trails", { threshold: 0.3, dimming: 0.05, intensity: 0.8, sourceDim: 0.3 }),
    L("noise", { amount: 1.84, size: 0.75, floor: 0.07, chroma: 0.1, shadow: 0.85, midtone: 0.28, highlight: 1 }),
    L("gaussian-blur", { strength: 9.66 }, { opacity: 0.2 }),
    L("vignette", { size: 0.53, anamorphism: 1.33, softness: 0.44, color: "#FFFFFF", blend: 0.57 }),
    L("transform", { scale: -0.15, axes: 0, bg: "#EDEDED", bgOpacity: 1 }),
  ]),
  p("broken-glass", "Broken glass", "Looks", ["sculpture", "botanic"], [
    tx(9, 1, { blend: 2 }),
    L("displacement", { texture: 9, mapBlur: 0.2, amount: 1.57 }),
    L("texture-blur", { texture: 9, strength: 0.217 }),
  ]),
  p("glass-panes", "Glass panes", "Looks", ["portraits", "dancer"], [
    L("blur-sharp", { blurriness: -5, threshold: 0.448, ringing: 0.48 }),
    L("film-grain", { type: 14, amount: 0.6, highlights: 0.73, midtones: 0.59, shadows: 0.74, interval: 4 }),
    L("gaussian-blur", { strength: 13.9 }, { opacity: 0.55 }),
    L("reeded-glass", { amount: 1.57, dispersion: 0, reflection: 1, reflectionScale: 2, repeats: 3, contrast: 1.8, shiftSpeed: 0.1, shiftLoop: 7, imperf: 0.11, imperfScale: 5.9 }),
    L("reeded-glass", { amount: 4.89, dispersion: 0, reflection: 1, reflectionScale: 0.1, repeats: 4, angle: 180, contrast: 5, shiftSpeed: 0.1, shiftLoop: 3.5, imperf: 0.09, imperfScale: 25 }),
    L("gaussian-blur", { strength: 4.98 }, { opacity: 0.89 }),
  ]),
  p("static-grain", "Static grain", "Looks", ["portraits"], [
    L("duotone", { start: "#8F0013", end: "#FF7866", rG: 3, gG: 2.38, bG: 1.74 }),
    L("blur-sharp", { blurriness: -0.39, threshold: 0.713, ringing: 0.95 }),
    L("crt", { distance: 10, curvature: 0.15, bezel: 0, vignette: 0, bgOpacity: 0, density: 4.78, softness: 0.451, gamma: 8.98, brightness: 10 }),
    L("ntsc", { ringing: 5, noise: 0, saturation: 3, smear: -0.06, color1: 1.5, color2: 9.5 }),
    L("circular-blur", { radius: 0.24, repetitions: 7, decay: 1 }),
    L("rgb-shift", { red: -0.019, blue: 0.152, stretch: 0.47 }),
    L("noise", { amount: 1.68, size: 1.86, floor: 0.01, chroma: 0.82, shadow: 0.26, midtone: 0.03, highlight: 0.22 }),
  ]),
  p("grunge", "Grunge", "Looks", ["portraits", "editorial"], [
    L("dither", { palette: 0, colors: 2, strength: 0, gamma: 2.41, pixel: 1 }, { opacity: 0.5, blend: 1 }),
    L("noise", { amount: 2.18, size: 1.34, floor: 0.15, chroma: 0, midtone: 1, highlight: 1 }),
    L("monochrome", { rW: -0.245, gW: 0.278, bW: -0.932, tint: "#FF00E6", normalize: 1 }),
  ]),
  p("strobe", "Strobe", "Looks", ["portraits", "nightlife"], [
    L("bloom", { threshold: 0.4, intensity: 2.5 }),
    L("levels", { inBlack: 0.15, inWhite: 0.7, lumaOnly: 1 }, { mods: { inWhite: { shape: "square", cycles: 6, depth: 0.5, phase: 0 } } }),
  ]),
];

export const presetById = new Map(BUILTIN_PRESETS.map((x) => [x.id, x]));
