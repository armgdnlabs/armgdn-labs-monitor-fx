export const CATEGORIES = [
  "Adjust", "Color", "Film", "Retro", "Glitch", "Print", "Draw", "Blur", "Distort", "Overlay",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Numbers for range/select/toggle params; strings for colors ("#rrggbb"),
 * text, curves ("x,y x,y …") and gradients ("#rrggbb@pos,…").
 */
export type ParamValue = number | string;
export type ParamValues = Record<string, ParamValue>;

interface BaseParam {
  key: string;
  label: string;
  /** Inspector section ("Glow", "Grain" …). Params without a group go first. */
  group?: string;
}
export interface RangeParam extends BaseParam {
  type: "range";
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** Shown as a knob at the top of the inspector (2–3 per effect). */
  hero?: boolean;
}
export interface SelectParam extends BaseParam {
  type: "select";
  options: string[];
  default: number;
}
export interface ToggleParam extends BaseParam {
  type: "toggle";
  default: 0 | 1;
}
export interface ColorParam extends BaseParam {
  type: "color";
  default: string;
}
export interface TextParam extends BaseParam {
  type: "text";
  default: string;
  multiline?: boolean;
  maxLength?: number;
}
export interface CurveParam extends BaseParam {
  type: "curve";
  default: string;
  /** Stroke colour of the curve in the editor. */
  tint?: string;
}
export interface GradientParam extends BaseParam {
  type: "gradient";
  default: string;
}
export interface ImageParam extends BaseParam {
  type: "image";
  /** Image URL (https, blob: or data:). */
  default: string;
}
export type ParamDef = RangeParam | SelectParam | ToggleParam | ColorParam | TextParam | CurveParam | GradientParam | ImageParam;

export type UniformValue = number | readonly number[];

export interface PassContext {
  /** Working resolution of the layer (full-scale output). */
  width: number;
  height: number;
  time: number;
}

/**
 * One fragment-shader pass. Inputs are bound to uTex0..uTex3:
 * "input" = the layer's incoming image, "original" = the cropped source,
 * "prev" = this pass's own output from the previous frame (feedback passes),
 * any other string = the output of an earlier pass in the same effect.
 */
export interface PassDef {
  id: string;
  frag: string;
  inputs?: string[];
  /** Render scale relative to the working resolution (default 1). */
  scale?: number | ((values: ParamValues) => number);
  uniforms?: (values: ParamValues, ctx: PassContext) => Record<string, UniformValue>;
  /** Ping-pong this pass N times; iteration i reads iteration i-1 as its first input ("input" on i=0). */
  repeat?: (values: ParamValues, ctx: PassContext) => number;
  /** Keep this pass's output between frames and expose it as the "prev" input. */
  feedback?: boolean;
}

/** An auxiliary texture (LUT, glyph atlas, text, image) bound to uAux0..3. */
export interface AuxSpec {
  /** Cache key: the texture is rebuilt only when this changes. */
  key: string;
  build: () => TexImageSource | { width: number; height: number; data: Uint8Array };
  filter?: "nearest" | "linear";
  wrap?: "clamp" | "repeat";
}

export interface EffectDef {
  id: string;
  name: string;
  category: Category;
  description: string;
  keywords?: string;
  params: ParamDef[];
  passes: PassDef[];
  aux?: (values: ParamValues) => AuxSpec[];
  /** Effect output changes over time (grain, glitch…), so the preview must keep rendering. */
  animated?: boolean;
  /** On-canvas draggable points: pairs of 0..1 range params. */
  handles?: { x: string; y: string; label?: string }[];
  /** Photo key (see data/photos.ts) used for the library preview. */
  preview?: string;
}

export const single = (frag: string, extra: Partial<PassDef> = {}): PassDef[] => [{ id: "main", frag, inputs: ["input"], ...extra }];

export const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<RangeParam> = {}): RangeParam => ({
  key, label, type: "range", min, max, step, default: def, ...extra,
});
export const hero = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<RangeParam> = {}): RangeParam =>
  range(key, label, min, max, def, step, { ...extra, hero: true });
export const angle = (key: string, label: string, def = 0, extra: Partial<RangeParam> = {}): RangeParam =>
  range(key, label, -180, 180, def, 1, { unit: "°", ...extra });
export const select = (key: string, label: string, options: string[], def = 0, group?: string): SelectParam => ({
  key, label, type: "select", options, default: def, group,
});
export const toggle = (key: string, label: string, def: 0 | 1 = 0, group?: string): ToggleParam => ({ key, label, type: "toggle", default: def, group });
export const color = (key: string, label: string, def: string, group?: string): ColorParam => ({ key, label, type: "color", default: def, group });
export const text = (key: string, label: string, def: string, extra: Partial<TextParam> = {}): TextParam => ({ key, label, type: "text", default: def, ...extra });
export const curve = (key: string, label: string, def = "0,0 1,1", tint?: string): CurveParam => ({ key, label, type: "curve", default: def, tint });
export const image = (key: string, label: string, def: string): ImageParam => ({ key, label, type: "image", default: def });
export const gradient = (key: string, label: string, def: string): GradientParam => ({ key, label, type: "gradient", default: def });
/** Puts params into an inspector group. */
export const group = <T extends ParamDef>(name: string, params: T[]): T[] => params.map((p) => ({ ...p, group: name }));

export function defaultValues(effect: EffectDef): ParamValues {
  const v: ParamValues = {};
  for (const p of effect.params) v[p.key] = p.default;
  return v;
}

/** Params that become GLSL uniforms (text/curve/gradient feed aux textures instead). */
export function isUniformParam(p: ParamDef): boolean {
  return p.type === "range" || p.type === "select" || p.type === "toggle" || p.type === "color";
}
