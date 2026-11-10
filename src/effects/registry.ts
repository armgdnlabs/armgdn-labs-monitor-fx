import { adjust } from "./library/adjust";
import { blur } from "./library/blur";
import { color_ } from "./library/color";
import { distort } from "./library/distort";
import { draw } from "./library/draw";
import { film } from "./library/film";
import { glitch } from "./library/glitch";
import { pointFx } from "./library/point";
import { overlay } from "./library/overlay";
import { print } from "./library/print";
import { retro } from "./library/retro";
import { BASE_DEFAULTS } from "./baseDefaults";
import { CATEGORIES, type Category, type EffectDef } from "./types";

export const EFFECTS: EffectDef[] = [
  ...adjust,
  ...color_,
  ...film,
  ...retro,
  ...glitch,
  ...print,
  ...draw,
  ...blur,
  ...distort,
  ...overlay,
  ...pointFx,
];

// effect.app's starting values replace the code defaults (same keys, same types).
for (const e of EFFECTS) {
  const base = BASE_DEFAULTS[e.id];
  if (!base) continue;
  for (const p of e.params) {
    const v = base[p.key];
    if (v === undefined || typeof v !== typeof p.default) continue;
    if (p.type === "range") p.default = Math.min(p.max, Math.max(p.min, v as number));
    else if (p.type === "select") p.default = Math.min(p.options.length - 1, Math.max(0, v as number));
    else if (p.type === "toggle") p.default = (v ? 1 : 0) as 0 | 1;
    else (p as { default: number | string }).default = v;
  }
}

/**
 * The library shows the same 75 single effects as effect.app. Everything else that exists
 * in code (drawing styles, cyanotype, receipt…) is reachable only through old share links;
 * those looks are presets built from these 75.
 */
export const LIBRARY_IDS = ["curves","levels","exposure","contrast","hue-saturation","hue-curves","color-balance","color-temperature","rgb-gain","color-matrix","color-grading","gradient-map","thermal","threshold","monochrome","duotone","instant-film","infrared-film","classic-film","halation","film-grain","bw-film","vintage-film","star-glow","bloom","vignette","micro-8bit","paint-1bit","vhs","ascii","dither","crt","ntsc","led-screen","pixel-sort","grid-split","jpeg-glitch","frame-drop","modulation","glitch","rgb-shift","stripe","bevel","paper-cutout","risograph","ink-bleed","halftone","paper-scan","emboss","camera-shake","motion-trails","texture-blur","depth-of-field","circular-blur","motion-blur","radial-blur","zoom-blur","blur-sharp","gaussian-blur","scatter","displacement","reeded-glass","elastic-grid","cubify","ripple","transform","polar-to-rect","pinch","perspective","swirl","rect-to-polar","text","blob-tracker","layer-mix","noise"];
const CORE_SET = new Set(LIBRARY_IDS);
EFFECTS.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));

const byId = new Map(EFFECTS.map((e) => [e.id, e]));
/** Effects listed in the library (see LIBRARY_IDS). */
export const LIBRARY: EffectDef[] = EFFECTS.filter((e) => CORE_SET.has(e.id));

/** Ids from earlier versions, so old share links and saved presets keep working. */
const ALIASES: Record<string, string> = {
  "paper-texture": "layer-mix",
  analog: "classic-film",
  "black-white": "bw-film",
  "tilt-shift": "depth-of-field",
  "chromatic-aberration": "rgb-shift",
  "halftone-cmyk": "halftone",
  "halftone-mono": "halftone",
  bokeh: "lens-blur",
  "cursor-ripple": "ripple",
  "glitch-zone": "glitch",
  "smear-brush": "motion-trails",
  "texture-displacement": "displacement",
  "rgb-gain-gamma": "rgb-gain",
  "crt-screen": "crt",
  "apple-ii": "micro-8bit",
  macpaint: "paint-1bit",
  "film-classic": "classic-film",
  "film-vintage": "vintage-film",
  "film-bw": "bw-film",
  "film-infrared": "infrared-film",
  "film-instant": "instant-film",
  "blur-sharpen": "blur-sharp",
  "polar-to-rectangular": "polar-to-rect",
  "rectangular-to-polar": "rect-to-polar",
};

export function getEffect(id: string): EffectDef | undefined {
  return byId.get(id) ?? byId.get(ALIASES[id] ?? "");
}

export function effectsIn(category: Category | "All"): EffectDef[] {
  return category === "All" ? EFFECTS : EFFECTS.filter((e) => e.category === category);
}

export function searchEffects(query: string, list: EffectDef[] = LIBRARY): EffectDef[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((e) => {
    const hay = `${e.name} ${e.id} ${e.category} ${e.keywords ?? ""} ${e.description}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
