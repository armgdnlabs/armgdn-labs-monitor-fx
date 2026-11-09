import type { Category, EffectDef } from "../effects/types";
import { getPhoto, photoFrom } from "./photos";

/**
 * Preview photos are chosen by mood, so each card shows its effect on a picture that suits
 * it (tape on night streets, risograph on flowers, film on film). Tags are photo groups from
 * data/photos.ts and data/feed.ts; the pick inside a pool is stable per item.
 */
const CATEGORY_MOODS: Record<Category, string[]> = {
  Adjust: ["nature", "interior", "streets", "film"],
  Color: ["editorial", "portraits", "experimental"],
  Film: ["film", "streets", "editorial"],
  Retro: ["portraits", "nightlife", "editorial"],
  Glitch: ["nightlife", "experimental", "editorial"],
  Print: ["botanic", "editorial", "portraits"],
  Draw: ["portraits", "botanic", "nature"],
  Blur: ["nightlife", "streets", "editorial"],
  Distort: ["botanic", "experimental", "interior"],
  Overlay: ["portraits", "editorial", "film"],
};

const EFFECT_MOODS: Record<string, string[]> = {
  vhs: ["nightlife", "streets"],
  ntsc: ["portraits", "editorial"],
  crt: ["portraits", "editorial"],
  "led-screen": ["nightlife"],
  "micro-8bit": ["palms", "nature"],
  "paint-1bit": ["botanic", "flower"],
  ascii: ["nature", "tree"],
  dither: ["nature", "mountain"],
  "pocket-cam": ["portraits"],
  "lcd-phone": ["portraits"],
  "console-32": ["editorial"],
  "matrix-rain": ["portraits", "nightlife"],
  "pixel-sort": ["fire", "desert"],
  glitch: ["portraits", "editorial"],
  "jpeg-glitch": ["botanic", "flower"],
  "rgb-shift": ["portraits"],
  "frame-drop": ["streets"],
  modulation: ["fruit", "stilllife"],
  stripe: ["experimental"],
  "grid-split": ["celltower", "interior"],
  halation: ["nightlife", "subway"],
  bloom: ["hands", "botanic"],
  "star-glow": ["nightlife", "highway"],
  "infrared-film": ["nature", "forest"],
  "instant-film": ["portraits", "film"],
  "bw-film": ["desert", "nature"],
  "vintage-film": ["nature", "film"],
  "classic-film": ["film", "nature"],
  "light-leak": ["film", "editorial"],
  thermal: ["portraits", "experimental"],
  threshold: ["horse", "portraits"],
  monochrome: ["hands", "sculpture"],
  duotone: ["interior", "room"],
  "gradient-map": ["portraits", "sculpture"],
  "zoom-blur": ["nature", "forest"],
  "radial-blur": ["dancer", "editorial"],
  "motion-blur": ["dancer", "streets"],
  "motion-trails": ["highway", "nightlife"],
  "depth-of-field": ["nightlife"],
  "camera-shake": ["portraits", "editorial"],
  "circular-blur": ["botanic", "flower"],
  "texture-blur": ["portraits"],
  "reeded-glass": ["botanic", "fruit"],
  kaleidoscope: ["botanic", "experimental"],
  "rect-to-polar": ["meadow", "nature"],
  "polar-to-rect": ["portraits"],
  swirl: ["botanic"],
  ripple: ["ocean", "experimental"],
  cubify: ["interior"],
  perspective: ["editorial", "fashion"],
  scatter: ["portraits", "editorial"],
  "paper-texture": ["editorial", "botanic"],
  text: ["surface", "experimental"],
  "blob-tracker": ["portraits"],
  risograph: ["botanic", "butterfly"],
  halftone: ["botanic", "bird"],
  "ink-bleed": ["surface", "experimental"],
  "paper-scan": ["sky", "ocean"],
  emboss: ["botanic", "sculpture"],
  bevel: ["surface"],
};

export function effectPreview(e: EffectDef): string {
  const tags = EFFECT_MOODS[e.id] ?? CATEGORY_MOODS[e.category];
  const pick = photoFrom(tags, e.id);
  return getPhoto(pick) ? pick : e.preview ?? "film:0";
}

export function moodPhoto(tags: string[], seed: string): string {
  return photoFrom(tags, seed);
}
