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

EFFECTS.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));

const byId = new Map(EFFECTS.map((e) => [e.id, e]));

/** Ids from earlier versions, so old share links and saved presets keep working. */
const ALIASES: Record<string, string> = {
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

export function searchEffects(query: string, list: EffectDef[] = EFFECTS): EffectDef[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((e) => {
    const hay = `${e.name} ${e.id} ${e.category} ${e.keywords ?? ""} ${e.description}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
