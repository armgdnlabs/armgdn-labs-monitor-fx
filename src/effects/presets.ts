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

const p = (id: string, name: string, section: PresetSection, moods: string[], graph: PresetLayer[]): BuiltinPreset => ({
  id, name, section, moods, snapshot: { version: 1, graph },
});
const L = (id: string, values: Record<string, ParamValue> = {}, extra: Partial<PresetLayer> = {}): PresetLayer => ({ id, values, ...extra });

// Blend indices (engine/glsl BLEND_MODES): 0 normal, 1 multiply, 2 screen, 3 overlay, 4 soft light, 5 add.
// Palette indices (library/color PALETTES): 0 1-bit bone, 1 pocket LCD, 12 brick phone, 13 grey 8, 17 mint print, 18 hot pink, 19 ocean blue.

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  /* ── Print & paper ─────────────────────────────────────────────────── */
  p("solarized-print", "Solarized print", "Print & paper", ["fire", "film"], [
    L("blur-sharp", { soften: 0.15, detail: 1.4, radius: 4 }),
    L("film-grain", { type: 6, amount: 0.25, shadows: 0.55, highlights: 0.4 }),
    L("paper-scan", { paper: 0.3, toner: 0.15, lamp: 0.3, soft: 0.2, fade: 0.2, paperColor: "#E6E8EC" }),
    L("gradient-map", { ramp: "#1B1E2A@0,#5A5F6E@0.35,#E8E9EE@0.6,#3A3E4C@0.8,#F2F3F6@1", contrast: 1.1 }),
    L("gaussian-blur", { radius: 3.5 }, { opacity: 0.6 }),
    L("monochrome", { filter: 0, contrast: 1.1 }),
  ]),
  p("paper-towel-print", "Paper towel print", "Print & paper", ["portraits", "editorial"], [
    L("contrast", { contrast: 0.15, fade: 0.06 }),
    L("paper-texture", { kind: 7, opacity: 0.85, scale: 1.1, blend: 4, relief: 1.3, displace: 0.5 }),
    L("gaussian-blur", { radius: 2 }, { opacity: 0.5 }),
  ]),
  p("torn-photo", "Torn photo", "Print & paper", ["nature", "film"], [
    L("classic-film", { stock: 1, grain: 0.3, fade: 0.08 }),
    L("paper-cutout", { layers: 3, shadow: 0.45, light: 0.4, depth: 0.5, smooth: 0.4, texture: 0.6, colorMode: 0 }),
    L("paper-scan", { paper: 0.5, toner: 0.2, lamp: 0.25, soft: 0.2, fade: 0.1 }),
    L("frame-drop", { fps: 6, irregularity: 0.1 }),
  ]),
  p("faded-copy", "Faded copy", "Print & paper", ["nature", "meadow"], [
    L("dither", { pattern: 13, palette: 20, colors: 4, strength: 0.9, pixel: 1, distance: 1, gamma: 0.9 }),
    L("gaussian-blur", { radius: 3 }, { opacity: 0.55 }),
    L("paper-texture", { kind: 4, opacity: 0.6, scale: 1, blend: 1 }),
  ]),
  p("receipt-scan", "Receipt scan", "Print & paper", ["portraits", "editorial"], [
    L("frame-drop", { fps: 7, irregularity: 0 }),
    L("camera-shake", { amount: 3, trail: 0.1, speed: 2, rotation: 0.4 }),
    L("blur-sharp", { soften: 0.1, detail: 2, radius: 5 }),
    L("threshold", { level: 0.45, softness: 0.05, noise: 0.2, ink: "#1A1A1A", paper: "#F3F1EC" }),
    L("paper-texture", { kind: 4, opacity: 0.8, blend: 1 }),
    L("noise", { amount: 1, size: 1, chroma: 0, type: 3, speed: 24 }),
    L("motion-blur", { distance: 20, angle: 265, mode: 1 }, { opacity: 0.5 }),
  ]),
  p("thermal-receipt", "Thermal receipt", "Print & paper", ["dancer", "streets"], [
    L("blur-sharp", { soften: 0.1, detail: 1.6, radius: 5 }),
    L("dither", { pattern: 2, palette: 0, colors: 2, strength: 1, pixel: 1, gamma: 1 }),
    L("paper-texture", { kind: 4, opacity: 0.8, blend: 1 }),
    L("text", { content: "ORDER RECEIPT #3498", size: 0.025, y: 0.95, fill: "#111111" }),
    L("motion-blur", { distance: 20, angle: 265, mode: 1 }, { opacity: 0.5 }),
  ]),
  p("thin-paper-print", "Thin paper print", "Print & paper", ["editorial", "portraits"], [
    L("paper-texture", { kind: 4, opacity: 0.9, scale: 1.6, blend: 3, relief: 0.8, displace: 0.7 }),
    L("paper-scan", { paper: 0.7, toner: 0.15, lamp: 0.4, soft: 0.25, fade: 0.2 }),
    L("noise", { amount: 0.45, size: 0.6, chroma: 0 }),
  ]),
  p("riso-print", "Riso print", "Print & paper", ["editorial", "botanic"], [
    L("risograph", { inks: 1, ink1: "#FF48B0", ink2: "#00A95C", ink3: "#3255A4", paper: "#F0EDE6", grain: 0.7, misreg: 6, screen: 0 }),
    L("paper-texture", { kind: 4, opacity: 0.5, blend: 1 }),
  ]),
  p("grainy-riso", "Grainy riso", "Print & paper", ["botanic", "butterfly"], [
    L("risograph", { inks: 0, ink1: "#FF6C2F", ink2: "#5E2D79", paper: "#F5F2E8", grain: 0.95, misreg: 3, screen: 0, density: 1.1 }),
    L("vignette", { amount: -0.4, radius: 0.7, feather: 0.6, tint: "#FFFFFF" }),
  ]),
  p("cyanotype-print", "Cyanotype", "Print & paper", ["botanic", "nature"], [
    L("gradient-map", { ramp: "#001F7A@0,#2457A6@0.45,#9DBBE0@0.8,#EEF2F6@1", contrast: 1.1 }),
    L("noise", { amount: 0.7, chroma: 0.2 }),
    L("paper-texture", { kind: 4, opacity: 0.86, blend: 1 }),
    L("depth-of-field", { mode: 1, blur: 14, falloff: 0.5 }),
  ]),
  p("vintage-poster", "Vintage poster", "Print & paper", ["streets", "nature"], [
    L("threshold", { level: 0.35, softness: 0.05, noise: 0.05 }, { opacity: 0.6, blend: 1 }),
    L("thermal", { palette: 4, contrast: 1.1, offset: 0.1 }, { opacity: 0.7, blend: 9 }),
    L("dither", { pattern: 13, palette: 3, colors: 4, strength: 1.2, pixel: 1, gamma: 0.6 }),
    L("noise", { amount: 2, size: 1.4, chroma: 0 }),
    L("paper-texture", { kind: 4, opacity: 0.7, blend: 1 }),
  ]),
  p("print-stamp", "Print stamp", "Print & paper", ["portraits", "sculpture"], [
    L("blur-sharp", { soften: 0.2, detail: 1.8, radius: 4 }),
    L("halftone", { mode: 1, shape: 0, cell: 2.5, gain: 0.2, ink: "#151515", paper: "#F6F4EE", texture: 0.7 }),
    L("paper-texture", { kind: 4, opacity: 0.8, blend: 1 }),
    L("rgb-shift", { mode: 0, amount: 3 }),
    L("gaussian-blur", { radius: 1.2 }),
  ]),
  p("xerox", "Xerox", "Print & paper", ["portraits", "streets"], [
    L("threshold", { level: 0.35, softness: 0.04, noise: 0.15, ink: "#171717" }),
    L("noise", { amount: 1.4, size: 1.6, chroma: 0, midtone: 0.67, highlight: 0.47 }),
    L("noise", { amount: 2, size: 0.5, chroma: 0.5, midtone: 0 }),
  ]),
  p("crumpled", "Crumpled paper", "Print & paper", ["botanic", "stilllife"], [
    L("paper-texture", { kind: 0, opacity: 1, scale: 1, blend: 4, relief: 1.2, displace: 0.6 }),
  ]),
  p("folded-paper", "Folded paper", "Print & paper", ["editorial", "portraits"], [
    L("paper-texture", { kind: 2, opacity: 1, scale: 1, blend: 4, relief: 1.2, displace: 0.4, variation: 7 }),
    L("paper-scan", { paper: 0.3, toner: 0.1, lamp: 0.25, soft: 0.1, fade: 0.1 }),
  ]),
  p("tracing-paper", "Tracing paper", "Print & paper", ["butterfly", "botanic"], [
    L("gaussian-blur", { radius: 6 }, { opacity: 0.7 }),
    L("paper-texture", { kind: 5, opacity: 0.85, scale: 1, blend: 2, relief: 0.6, tint: "#DCE6F2", tintAmount: 0.5 }),
    L("contrast", { contrast: -0.35, fade: 0.2 }),
  ]),
  p("emboss-dirt", "Emboss dirt", "Print & paper", ["sculpture", "botanic"], [
    L("emboss", { depth: 5.5, radius: 1.5, output: 0 }),
    L("halftone", { mode: 1, cell: 4, texture: 0.6, ink: "#4A463F", paper: "#D9D4C8" }),
    L("noise", { amount: 0.6, chroma: 0.3 }),
  ]),

  /* ── Drawing & painting ────────────────────────────────────────────── */
  p("pink-paint-brush", "Pink paint brush", "Drawing & painting", ["botanic", "nature"], [
    L("paper-scan", { paper: 0.5, toner: 0.2, lamp: 0.3, soft: 0.2, fade: 0.1 }),
    L("paper-texture", { kind: 11, opacity: 0.39, scale: 0.83, blend: 0 }),
    L("gradient-map", { ramp: "#0C1724@0,#5B2C6F@0.4,#C77DBA@0.75,#F7D6EC@1", contrast: 1.05 }),
    L("bloom", { intensity: 1.1, threshold: 0.2, radius: 50 }),
    L("texture-blur", { amount: 14, scale: 16, texture: 1, soft: 0.6 }),
    L("displacement", { amount: 12, map: 0, scale: 1.2 }),
  ]),
  p("cross-hatch", "Cross hatch", "Drawing & painting", ["vase", "stilllife"], [
    L("halftone", { mode: 1, shape: 4, cell: 5, gain: 0.15, texture: 0.6, ink: "#141414", paper: "#F4F0E8" }),
    L("curves", { master: "0,0.05 0.5,0.55 1,1" }),
  ]),
  p("pencil-drawing", "Pencil drawing", "Drawing & painting", ["portraits", "editorial"], [
    L("levels", { inBlack: 0, inWhite: 0.75, gamma: 1.5 }),
    L("risograph", { inks: 0, ink1: "#4A443B", ink2: "#A39B8C", paper: "#EDE6D6", grain: 1, misreg: 0, screen: 0, density: 0.7 }),
    L("paper-texture", { kind: 4, opacity: 1, blend: 1 }),
    L("paper-texture", { kind: 0, opacity: 0.3, blend: 4 }),
    L("curves", { master: "0,0.08 0.5,0.55 1,1" }),
  ]),
  p("cube-hatch", "Cube hatch", "Drawing & painting", ["portraits", "editorial"], [
    L("halftone", { mode: 0, shape: 3, cell: 4, gain: 0.1, misreg: 0.5, texture: 0.3 }),
    L("cubify", { size: 30, lens: 0.6, bevel: 0.2, gap: 0 }),
    L("curves", { master: "0,0.04 0.5,0.52 1,1" }),
  ]),
  p("pointillism", "Pointillism", "Drawing & painting", ["nature", "mountain"], [
    L("blur-sharp", { soften: 0.2, detail: 2, radius: 6 }),
    L("paper-scan", { paper: 0.3, toner: 0.1, lamp: 0.2, soft: 0.1 }),
    L("gaussian-blur", { radius: 2 }, { opacity: 0.5 }),
    L("halftone", { mode: 0, shape: 0, cell: 6, gain: 0.25, misreg: 3, texture: 0.4, paper: "#F2EEE4" }),
    L("scatter", { amount: 6, mode: 0, grain: 4 }),
  ]),
  p("stippling", "Stippling", "Drawing & painting", ["portraits"], [
    L("blur-sharp", { soften: 0.1, detail: 2.2, radius: 5 }),
    L("paper-scan", { paper: 0.6, toner: 0.3, lamp: 0.25, soft: 0.2 }),
    L("dither", { pattern: 22, palette: 0, colors: 2, strength: 1.4, pixel: 1, gamma: 0.8 }),
    L("curves", { master: "0,0 0.5,0.6 1,1" }),
  ]),
  p("scribble", "Scribble", "Drawing & painting", ["botanic", "nature"], [
    L("paper-texture", { kind: 4, opacity: 1, blend: 1 }),
    L("displacement", { amount: 25, map: 2, scale: 1.5 }),
    L("dither", { pattern: 17, palette: 3, colors: 4, strength: 1.2, pixel: 1, distance: 1, gamma: 0.8 }),
    L("texture-blur", { amount: 6, texture: 2, soft: 0.5 }, { opacity: 0.7 }),
  ]),
  p("pastel", "Pastel", "Drawing & painting", ["portraits", "botanic"], [
    L("blur-sharp", { soften: 0.6, detail: 0.6, radius: 10 }),
    L("paper-texture", { kind: 11, opacity: 0.79, blend: 3 }),
    L("paper-texture", { kind: 4, opacity: 0.52, blend: 1 }),
    L("texture-blur", { amount: 12, texture: 1, soft: 0.6 }),
  ]),
  p("spray-paint", "Spray paint", "Drawing & painting", ["portraits", "streets"], [
    L("gradient-map", { ramp: "#000000@0,#000000@0.35,#D3202A@0.55,#F7F2EC@1", contrast: 1.4 }),
    L("paper-texture", { kind: 6, opacity: 1, blend: 1 }),
    L("gaussian-blur", { radius: 6 }, { opacity: 0.61, blend: 2 }),
  ]),
  p("watercolor", "Watercolour", "Drawing & painting", ["botanic", "nature"], [
    L("texture-blur", { amount: 16, scale: 20, texture: 1, soft: 0.7 }),
    L("ink-bleed", { threshold: 0.5, bleed: 10, feather: 0.7 }, { opacity: 0.5, blend: 1 }),
    L("hue-saturation", { saturation: 0.15, lightness: 0.1 }),
    L("paper-texture", { kind: 4, opacity: 0.9, blend: 1 }),
  ]),
  p("old-painting", "Old painting", "Drawing & painting", ["portraits", "stilllife"], [
    L("exposure", { ev: 0.2 }),
    L("ink-bleed", { threshold: 0.45, bleed: 14, feather: 0.6 }, { opacity: 0.35, blend: 1 }),
    L("hue-saturation", { hue: 8, saturation: 0.09 }),
    L("bloom", { intensity: 0.8, threshold: 0.6, radius: 40 }),
    L("color-grading", { lift: "#2A1E14", liftAmt: 0.4, gain: "#F2D9A8", gainAmt: 0.35, saturation: 0.85 }),
    L("paper-texture", { kind: 11, opacity: 0.42, blend: 0 }),
    L("depth-of-field", { mode: 1, blur: 8, falloff: 0.6 }),
  ]),

  /* ── Film & TV ─────────────────────────────────────────────────────── */
  p("teen-drama", "Purple hour", "Film & TV", ["portraits", "editorial"], [
    L("color-grading", { lift: "#2A1453", liftAmt: 0.5, gammaC: "#8C5BD6", gammaAmt: 0.2, gain: "#F7C6F0", gainAmt: 0.3, saturation: 1.1, contrast: 1.1 }),
    L("halation", { amount: 0.6, threshold: 0.45, radius: 30, tint: "#FF3AA8" }),
    L("film-grain", { type: 4, amount: 0.3 }),
  ]),
  p("bleach-bypass", "Bleach bypass", "Film & TV", ["portraits", "streets"], [
    L("color-grading", { lift: "#1F2A22", liftAmt: 0.35, gain: "#E8E2C8", gainAmt: 0.2, saturation: 0.55, contrast: 1.3 }),
    L("contrast", { contrast: 0.35, crush: 0.04 }),
    L("film-grain", { type: 6, amount: 0.45, interval: 2 }),
  ]),
  p("revenge-yellow", "Revenge yellow", "Film & TV", ["portraits"], [
    L("color-grading", { lift: "#3A1A10", liftAmt: 0.4, gammaC: "#E2B04A", gammaAmt: 0.35, gain: "#FFE7A3", gainAmt: 0.5, saturation: 1.05, contrast: 1.15 }),
    L("paper-scan", { paper: 0.3, toner: 0.2, lamp: 0.2, soft: 0.2, fade: 0.1 }),
    L("film-grain", { type: 3, amount: 0.4 }),
  ]),
  p("northwest-woods", "Northwest woods", "Film & TV", ["forest", "nature"], [
    L("color-grading", { lift: "#0F1F18", liftAmt: 0.45, gammaC: "#5E7A52", gammaAmt: 0.2, gain: "#E8DDB8", gainAmt: 0.2, saturation: 0.75, contrast: 1.05 }),
    L("bloom", { intensity: 0.9, threshold: 0.75, radius: 50 }),
    L("film-grain", { type: 4, amount: 0.55, interval: 3 }),
  ]),
  p("liminal-mall", "Liminal mall", "Film & TV", ["interior", "room"], [
    L("vhs", { resolution: 420, colorDelay: 4.8, grain: 0.6, distortion: 0.05, wobble: 0.6, tapeCrease: 0.37, trackingNoise: 0, verticalJump: 0.01, sparkle: 0.3, saturation: 1, softness: 0.6, sharpening: 1.1 }),
    L("color-grading", { gammaC: "#C9C28E", gammaAmt: 0.2, saturation: 0.85 }),
  ]),
  p("neon-express", "Neon express", "Film & TV", ["nightlife", "highway"], [
    L("halation", { amount: 0.7, threshold: 0.6, radius: 18, tint: "#FF5A1F" }),
    L("color-grading", { lift: "#0B2A2E", liftAmt: 0.5, gain: "#FFD3A0", gainAmt: 0.3, saturation: 1.15 }),
    L("classic-film", { stock: 2, grain: 0.3 }),
    L("motion-blur", { distance: 10, angle: 0 }, { opacity: 0.3 }),
  ]),
  p("old-editorial", "Old editorial", "Film & TV", ["editorial", "portraits"], [
    L("color-grading", { lift: "#2B2420", liftAmt: 0.3, gain: "#F1E2C6", gainAmt: 0.25, saturation: 0.9 }),
    L("classic-film", { stock: 1, grain: 0.2, fade: 0.08 }),
    L("film-grain", { type: 7, amount: 0.5, highlights: 0.9, midtones: 0.7, shadows: 0.5, interval: 6 }),
  ]),
  p("handheld-portra", "Handheld portra", "Film & TV", ["film", "portraits"], [
    L("classic-film", { stock: 0, grain: 0.2 }),
    L("halation", { amount: 0.5, threshold: 0.45, radius: 20 }),
    L("vignette", { amount: 0.35, radius: 0.9, feather: 0.9 }),
    L("film-grain", { type: 2, amount: 0.7, interval: 1 }),
    L("camera-shake", { amount: 4, trail: 0.2, speed: 1.4, rotation: 0.15 }),
  ]),
  p("kodak-gold", "Gold 200", "Film & TV", ["nature", "film"], [
    L("classic-film", { stock: 1, grain: 0.25, fade: 0.05 }),
    L("film-grain", { type: 3, amount: 0.75, highlights: 0.95, midtones: 0.65, shadows: 0.45 }),
    L("vignette", { amount: 0.4, radius: 0.9, feather: 0.9 }),
  ]),
  p("sepia", "Sepia", "Film & TV", ["desert", "nature"], [
    L("bw-film", { stock: 1, contrast: 1.15, grain: 0.35, tone: 1, toneAmount: 0.75 }),
  ]),
  p("photo-booth", "Photo booth", "Film & TV", ["portraits", "editorial"], [
    L("paper-scan", { paper: 0.6, toner: 0.3, lamp: 0.2, soft: 0.25, fade: 0.2, paperColor: "#EDE4D2" }),
    L("curves", { master: "0,0.05 0.4,0.32 0.8,0.85 1,1" }),
    L("monochrome", { filter: 5, contrast: 1.4, tint: "#FFCC94", tintAmount: 0.5 }),
    L("vhs", { resolution: 420, colorDelay: 0, grain: 0, distortion: 0, wobble: 0.01, tapeCrease: 0, trackingNoise: 0, verticalJump: 0, sparkle: 0, flicker: 0, colorFringing: 0, saturation: 0, colorShift: 0.16, colorBlend: 0.45, softness: 0.4, sharpening: 0.33 }),
    L("gaussian-blur", { radius: 15 }, { opacity: 0.24 }),
  ]),
  p("vintage-soft-focus", "Vintage soft focus", "Film & TV", ["portraits", "editorial"], [
    L("color-matrix", { rr: 0.93, rg: 0.04, rb: 0.03, gr: 0.03, gg: 0.94, gb: 0.03, br: 0.04, bg: 0.04, bb: 0.84 }),
    L("gaussian-blur", { radius: 4 }, { opacity: 0.75, blend: 2 }),
    L("bloom", { intensity: 0.9, threshold: 0.5, radius: 45 }),
    L("film-grain", { type: 1, amount: 0.3, highlights: 0.45, midtones: 0.8, shadows: 0.65 }),
  ]),
  p("slow-shutter", "Slow shutter", "Film & TV", ["portraits", "dancer"], [
    L("camera-shake", { amount: 30, trail: 0.85, speed: 2.2, rotation: 0.1 }),
    L("frame-drop", { fps: 2, irregularity: 0.03 }),
    L("monochrome", { filter: 1, contrast: 1.3 }),
    L("film-grain", { type: 8, amount: 0.5 }),
  ]),
  p("motion-freeze", "Motion freeze", "Film & TV", ["portraits", "editorial"], [
    L("camera-shake", { amount: 22, trail: 0.7, speed: 2.5, rotation: 0.2 }),
    L("frame-drop", { fps: 4, irregularity: 0.03 }),
  ]),
  p("light-streaks", "Light streaks", "Film & TV", ["highway", "nightlife"], [
    L("motion-trails", { persistence: 0.9, drift: 3, angle: 180, mode: 0 }),
    L("motion-blur", { distance: 90, angle: 180 }, { opacity: 0.6, blend: 8 }),
    L("color-grading", { lift: "#071A2B", liftAmt: 0.5, gain: "#FFE0B0", gainAmt: 0.3, saturation: 1.2 }),
  ]),

  /* ── Retro & digital ───────────────────────────────────────────────── */
  p("old-tape", "Old tape", "Retro & digital", ["blossom", "nature"], [
    L("vhs", { resolution: 420, colorDelay: 8, grain: 0.66, distortion: 0, wobble: 0.5, tapeCrease: 0, trackingNoise: 0, verticalJump: 0, sparkle: 0.15, flicker: 0.04, saturation: 1.3, colorShift: 0.09, softness: 0.6, sharpening: 0.3 }),
    L("color-grading", { lift: "#20252A", liftAmt: 0.3, gain: "#FFE9D2", gainAmt: 0.2, saturation: 1.05 }),
  ]),
  p("home-video", "Home video", "Retro & digital", ["streets", "film"], [
    L("vhs", { resolution: 320, colorDelay: 5.8, grain: 0.9, distortion: 0.35, wobble: 0.9, tapeCrease: 0.6, trackingNoise: 0.7, verticalJump: 0.08, sparkle: 0.7, flicker: 0.08 }),
    L("text", { content: "PLAY ▶\nAM 11:42", font: 3, size: 0.05, x: 0.08, y: 0.9, align: 0, fill: "#F7F2EC" }),
  ]),
  p("teleshopping", "Teleshopping", "Retro & digital", ["ocean", "experimental"], [
    L("vhs", { resolution: 420, colorDelay: 4.1, grain: 1, distortion: 0.45, wobble: 0.6, verticalJump: 0.06, sparkle: 1.2, flicker: 0.03, saturation: 1.5, colorBlend: 0.44, softness: 2, sharpening: 0.97 }),
    L("star-glow", { intensity: 0.6, threshold: 0.8, length: 0.35, points: 1 }),
  ]),
  p("tv", "TV", "Retro & digital", ["portraits"], [
    L("ntsc", { ringing: 6, fringes: 8.5, saturation: 2.4, color1: 6, color2: 14.5 }),
    L("crt", { density: 4.6, curvature: 0.08, brightness: 2.2, bezel: 0, vignette: 0, gamma: 3.1 }),
    L("noise", { amount: 0.3, chroma: 0.25, speed: 30 }),
  ]),
  p("broadcast", "Broadcast", "Retro & digital", ["editorial", "portraits"], [
    L("ntsc", { ringing: 21, fringes: 4, saturation: 3.2, encoding: 2, smear: 0.08, color1: 12, color2: 16 }),
    L("crt", { density: 3.8, curvature: 0.02, brightness: 2.6, vignette: 8, gamma: 4 }),
  ]),
  p("cyberpunk", "Cyberpunk", "Retro & digital", ["nightlife", "experimental"], [
    L("rgb-shift", { mode: 0, amount: 14, angle: 0 }),
    L("ntsc", { ringing: 5, saturation: 2.3, smear: -0.12, color1: 3 }),
    L("thermal", { palette: 4, contrast: 1.2, offset: 0 }, { opacity: 0.55, blend: 3 }),
    L("blob-tracker", { cells: 10, threshold: 0.45, links: 0.5, labels: 1 }),
  ]),
  p("thermal-camera", "Thermal camera", "Retro & digital", ["portraits", "experimental"], [
    L("thermal", { palette: 0, contrast: 1.5, offset: 0.05, blur: 4, noise: 0.05 }),
    L("vhs", { resolution: 1024, colorDelay: 4.1, grain: 0.48, wobble: 0, tapeCrease: 0, trackingNoise: 0, sparkle: 0.8, flicker: 0.19, saturation: 1.16, colorShift: 0.27, colorBlend: 0.52, softness: 1, sharpening: 0.25 }),
    L("bloom", { intensity: 1.2, threshold: 0.7, radius: 30 }),
  ]),
  p("gameboy-camera", "Pocket camera", "Retro & digital", ["portraits"], [
    L("dither", { pattern: 1, palette: 1, colors: 4, strength: 1, pixel: 3, distance: 1, gamma: 0.9 }),
    L("curves", { master: "0,0 0.3,0.22 0.7,0.82 1,1" }),
  ]),
  p("nokia-3310", "Brick phone", "Retro & digital", ["portraits"], [
    L("monochrome", { filter: 0, contrast: 1.2 }),
    L("dither", { pattern: 13, palette: 12, colors: 2, strength: 1, pixel: 3, distance: 0, gamma: 2.2 }),
  ]),
  p("ps1", "PS1", "Retro & digital", ["editorial", "portraits"], [
    L("dither", { pattern: 1, palette: 7, colors: 16, strength: 1.3, pixel: 2, distance: 1, gamma: 1.2 }),
    L("led-screen", { pixelSize: 1.3, gap: 0, pixelBlur: 0, rgb: 0 }),
    L("curves", { master: "0,0 0.5,0.55 1,1" }),
    L("gaussian-blur", { radius: 1.6 }),
  ]),
  p("apple-ii-palms", "Apple II", "Retro & digital", ["palms", "nature"], [
    L("micro-8bit", { mode: 0, dither: 1, exposure: 0.2, bleed: 8, lumaBlur: 3.5 }),
    L("crt", { density: 6, curvature: 0.12, brightness: 2.2, vignette: 6, layout: 1 }),
  ]),
  p("mac-classic", "MacPaint", "Retro & digital", ["botanic", "flower"], [
    L("paint-1bit", { width: 342, threshold: 0.45, contrast: 2.4, fill: 0, edges: 1 }),
  ]),
  p("msx-ascii", "Terminal ASCII", "Retro & digital", ["nature", "architecture"], [
    L("ascii", { charSet: 1, density: 70, contrast: 1.2, aspect: 0.55, colorMode: 0, fg: "#3CFF6E", bg: "#001A0B" }),
    L("bloom", { intensity: 1.6, threshold: 0.4, radius: 20, tint: "#B6FFC8" }),
    L("crt", { density: 5.5, curvature: 0.1, bezel: 0.03, brightness: 1.6, vignette: 10, dots: 0 }),
  ]),
  p("ascii-cut", "ASCII cut", "Retro & digital", ["tree", "nature"], [
    L("ascii", { charSet: 1, density: 60, contrast: 1.8, aspect: 0.55, cutDarks: 0.12, cutLights: 0.05, colorMode: 0, fg: "#000000", bg: "#FFFFFF", invert: 1 }),
    L("grid-split", { cols: 14, rows: 18, offset: 0, zoom: 0, mirror: 0, lines: 0 }),
  ]),
  p("high-tech-low-life", "High-tech low-life", "Retro & digital", ["portraits"], [
    L("ascii", { charSet: 2, density: 60, contrast: 1.4, cutDarks: 0.15, cutLights: 0, colorMode: 2, bg: "#050505" }),
    L("gaussian-blur", { radius: 7 }, { opacity: 0.39 }),
  ]),
  p("led-wall", "LED wall", "Retro & digital", ["nightlife", "portraits"], [
    L("led-screen", { pixelSize: 3.7, gap: 0.04, pixelBlur: 0.5, rgb: 1, boost: 1.4 }),
    L("bloom", { intensity: 1, threshold: 0.4, radius: 24 }),
  ]),
  p("grunge-dither", "Grunge dither", "Retro & digital", ["portraits", "editorial"], [
    L("dither", { pattern: 3, palette: 19, colors: 5, strength: 1.4, pixel: 3, distance: 1, gamma: 1.8 }),
    L("gaussian-blur", { radius: 20 }, { opacity: 0.17, blend: 2 }),
  ]),
  p("hot-light-glow", "Hot light glow", "Retro & digital", ["nightlife", "portraits"], [
    L("dither", { pattern: 6, palette: 18, colors: 5, strength: 1.4, pixel: 3, gamma: 1.8 }),
    L("star-glow", { intensity: 1.2, threshold: 0.7, length: 0.25 }),
    L("gaussian-blur", { radius: 20 }, { opacity: 0.17, blend: 2 }),
  ]),
  p("damaged-jpeg", "Damaged JPEG", "Retro & digital", ["botanic", "flower"], [
    L("jpeg-glitch", { quality: 0.12, corrupt: 0.55, block: 8, chroma: 0.8, ringing: 0.7 }),
    L("glitch", { amount: 0.25, blockSize: 60, split: 0.3, tear: 0.2 }),
  ]),
  p("jpeg-compression", "JPEG compression", "Retro & digital", ["fire", "experimental"], [
    L("jpeg-glitch", { quality: 0.02, corrupt: 0.1, block: 16, chroma: 1, ringing: 1 }),
  ]),
  p("tile-shift", "Tile shift", "Retro & digital", ["sky", "nature"], [
    L("grid-split", { cols: 7, rows: 9, offset: 0.35, zoom: 0.25, mirror: 0.1, lines: 0 }),
  ]),
  p("glitch-blur", "Glitch blur", "Retro & digital", ["portraits", "nightlife"], [
    L("glitch", { amount: 0.6, blockSize: 120, split: 0.6, tear: 0.5, speed: 1.5 }),
    L("gaussian-blur", { radius: 10 }, { opacity: 0.6 }),
  ]),
  p("bad-signal", "Bad signal", "Retro & digital", ["portraits", "editorial"], [
    L("modulation", { frequency: 130, depth: 22, angle: 0, palette: 2, sharp: 0.7 }),
    L("motion-blur", { distance: 8, angle: 166 }, { opacity: 0.7 }),
  ]),
  p("rgb-hatch", "RGB hatch", "Retro & digital", ["portraits", "editorial"], [
    L("halftone", { mode: 0, shape: 3, cell: 4, gain: 0.1, misreg: 2 }),
    L("cubify", { size: 22, lens: 0.3, bevel: 0.1, gap: 0.02 }),
    L("rgb-shift", { mode: 0, amount: 6 }),
  ]),
  p("star-burst", "Star burst", "Retro & digital", ["botanic", "flower"], [
    L("star-glow", { intensity: 2.4, threshold: 0.35, length: 0.3, points: 0, angle: 0 }),
    L("modulation", { frequency: 220, depth: 30, angle: 0, palette: 0, sharp: 0.6 }),
  ]),

  /* ── Looks ─────────────────────────────────────────────────────────── */
  p("acid-dream", "Acid dream", "Looks", ["interior", "architecture"], [
    L("motion-trails", { persistence: 0.6, drift: 1 }),
    L("thermal", { palette: 1, contrast: 1.2, offset: -0.1 }, { opacity: 0.35, blend: 4 }),
    L("color-grading", { saturation: 1.4, contrast: 1.1 }),
  ]),
  p("washed-green", "Washed green", "Looks", ["nature", "mountain"], [
    L("halation", { amount: 0.6, threshold: 0.35, radius: 10 }),
    L("color-grading", { lift: "#3C5A44", liftAmt: 0.5, gammaC: "#9AB88A", gammaAmt: 0.25, gain: "#E6F0DC", gainAmt: 0.2, saturation: 1.2 }),
    L("contrast", { contrast: -0.3, fade: 0.2 }),
  ]),
  p("heatwave", "Heatwave", "Looks", ["desert"], [
    L("exposure", { ev: 0.6, rolloff: 0.6 }),
    L("color-balance", { sR: -0.1, sB: 0.35, hR: 0.25, hG: 0.05, hB: -0.2 }),
    L("hue-saturation", { saturation: 0.35, vibrance: 0.3 }),
    L("motion-blur", { distance: 20, angle: 0 }, { opacity: 0.3 }),
  ]),
  p("polaroid-600", "Polaroid 600", "Looks", ["botanic", "flower"], [
    L("instant-film", { warmth: 0.15, fade: 0.12, soften: 0.4, chem: 0.35, vignette: 0.3, frame: 1, border: 0.07 }),
  ]),
  p("kind-of-blue", "A kind of blue", "Looks", ["ocean", "sky"], [
    L("monochrome", { filter: 5, contrast: 1.3, tint: "#0054FF", tintAmount: 0.9 }),
    L("noise", { amount: 0.75, size: 0.5, floor: 0.11, chroma: 1, shadow: 0.2, midtone: 0.48 }),
    L("gaussian-blur", { radius: 8, axis: 1 }, { opacity: 0.59 }),
  ]),
  p("y2k-street", "Y2K street", "Looks", ["editorial", "streets"], [
    L("color-grading", { gammaC: "#9FB37D", gammaAmt: 0.15, saturation: 0.9 }),
    L("paper-scan", { paper: 0.4, toner: 0.2, lamp: 0.35, soft: 0.15, fade: 0.15 }),
    L("contrast", { contrast: -0.3, pivot: 0.52 }),
    L("star-glow", { intensity: 0.4, threshold: 0.62 }),
  ]),
  p("y2k-blue", "Y2K blue", "Looks", ["portraits", "editorial"], [
    L("monochrome", { filter: 5, contrast: 1.2, tint: "#0054FF", tintAmount: 0.85 }),
    L("noise", { amount: 0.75, size: 0.5, floor: 0.11, chroma: 1, shadow: 0.2, midtone: 0.48 }),
    L("gaussian-blur", { radius: 8, axis: 1 }, { opacity: 0.5 }),
  ]),
  p("y2k-summer", "Y2K summer", "Looks", ["editorial", "portraits"], [
    L("paper-scan", { paper: 0.7, toner: 0.2, lamp: 0.3, soft: 0.2 }),
    L("star-glow", { intensity: 0.4, threshold: 0.35 }),
    L("color-grading", { lift: "#2C3E5A", liftAmt: 0.3, gain: "#FFEBC8", gainAmt: 0.35, saturation: 0.8 }),
  ]),
  p("infrared-pink", "Infrared pink", "Looks", ["palms", "car"], [
    L("infrared-film", { mode: 0, strength: 1, foliage: 1.4, glow: 0.4 }),
    L("duotone", { dark: "#000A52", light: "#E357FF", contrast: 1.1 }, { opacity: 0.6, blend: 4 }),
    L("star-glow", { intensity: 0.25, threshold: 0.75 }),
  ]),
  p("red-lights", "Red lights", "Looks", ["portraits"], [
    L("duotone", { dark: "#000000", light: "#D60000", contrast: 1.4 }),
    L("film-grain", { type: 3, amount: 1, highlights: 1, shadows: 1, interval: 1 }),
  ]),
  p("luma-pulse", "Luma pulse", "Looks", ["botanic", "experimental"], [
    L("gradient-map", { ramp: "#2CB34A@0,#9FE03A@0.3,#FF7A1A@0.6,#E8112D@1", contrast: 1.2 }, { mods: { offset: { shape: "sine", cycles: 1, depth: 0.6, phase: 0 } } }),
    L("noise", { amount: 1.8, size: 0.7, floor: 0.03, chroma: 0 }),
    L("gaussian-blur", { radius: 6 }),
  ]),
  p("icy-tones", "Icy tones", "Looks", ["ocean", "nature"], [
    L("color-grading", { lift: "#0A2233", liftAmt: 0.55, gammaC: "#5C8AA6", gammaAmt: 0.3, gain: "#E6F4FF", gainAmt: 0.3, saturation: 0.8, contrast: 1.1 }),
  ]),
  p("angelic", "Angelic", "Looks", ["portraits", "sculpture"], [
    L("monochrome", { filter: 4, contrast: 0.9, tint: "#9EC3E6", tintAmount: 0.5 }),
    L("gaussian-blur", { radius: 25 }, { opacity: 0.5, blend: 2 }),
    L("levels", { inBlack: 0.05, inWhite: 0.85, gamma: 1.3 }),
  ]),
  p("radiant", "Radiant", "Looks", ["portraits", "editorial"], [
    L("duotone", { dark: "#6BFC94", light: "#F0290F", contrast: 0.9 }),
    L("depth-of-field", { mode: 1, blur: 30, falloff: 0.6 }),
    L("noise", { amount: 0.3, floor: 0.3, chroma: 1 }),
  ]),
  p("blue-steel", "Blue steel", "Looks", ["sculpture", "portraits"], [
    L("monochrome", { filter: 5, contrast: 1.5, tint: "#9CB4D0", tintAmount: 0.6 }),
    L("dither", { pattern: 3, palette: 13, colors: 8, strength: 0.6, pixel: 1, gamma: 1.3 }),
    L("film-grain", { type: 7, amount: 1, highlights: 0.9, shadows: 1, interval: 10 }),
  ]),
  p("tonal-compression", "Tonal compression", "Looks", ["architecture", "interior"], [
    L("curves", { master: "0,0.12 0.3,0.33 0.7,0.66 1,0.86" }),
    L("color-grading", { gammaC: "#C8A56F", gammaAmt: 0.2, saturation: 0.95 }),
  ]),
  p("orb", "Orb", "Looks", ["experimental", "nightlife"], [
    L("gaussian-blur", { radius: 44 }),
    L("rect-to-polar", { rotation: 16, zoom: 1.4, seam: 0.2 }),
    L("vignette", { amount: 1, radius: 0.35, feather: 0.25, roundness: 1 }),
    L("rgb-shift", { mode: 1, amount: 18 }),
  ]),
  p("ghosts", "Ghosts", "Looks", ["portraits", "streets"], [
    L("gaussian-blur", { radius: 1.2 }, { opacity: 0.45 }),
    L("monochrome", { contrast: 1.1 }),
    L("motion-trails", { persistence: 0.8, drift: 2, mode: 1 }),
    L("noise", { amount: 1.8, size: 0.75, floor: 0.07, chroma: 0.1 }),
    L("gaussian-blur", { radius: 10 }, { opacity: 0.2 }),
    L("vignette", { amount: -0.6, radius: 0.53, feather: 0.44, tint: "#FFFFFF" }),
  ]),
  p("strobe", "Strobe", "Looks", ["portraits", "nightlife"], [
    L("levels", { inBlack: 0.15, inWhite: 0.7 }, { mods: { inWhite: { shape: "square", cycles: 6, depth: 0.5, phase: 0 } } }),
    L("bloom", { intensity: 1.5, threshold: 0.4, radius: 60 }),
  ]),
];

export const presetById = new Map(BUILTIN_PRESETS.map((x) => [x.id, x]));
