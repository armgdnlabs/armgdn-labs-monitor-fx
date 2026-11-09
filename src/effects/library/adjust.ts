import { curvesLut } from "../../lib/textures";
import { color, curve, group, hero, range, select, single, toggle, type EffectDef } from "../types";

/** Tint from a colour: grey means none; hue and saturation of the colour set direction and amount. */
const TINT = `
vec3 tintOf(vec3 c) { return c / max(luma(c), 1e-3); }
`;

/** Zone name and the key prefix of its params (k = black, x = specular). */
const ZONES: [string, string][] = [["Black", "k"], ["Shadow", "s"], ["Light", "l"], ["Highlight", "h"], ["Specular", "x"]];

export const adjust: EffectDef[] = [
  {
    id: "curves",
    name: "Curves",
    category: "Adjust",
    description: "Tone curves for the composite and each channel.",
    keywords: "tone curve rgb contrast fade matte",
    params: [
      select("mode", "Apply mode", ["RGB", "Luminance"]),
      curve("master", "RGB curve", "0,0 0.25,0.22 0.75,0.8 1,1", "#F7F2EC"),
      curve("red", "Red channel", "0,0 1,1", "#D3202A"),
      curve("green", "Green channel", "0,0 1,1", "#5FAF5F"),
      curve("blue", "Blue channel", "0,0 1,1", "#4F7FD8"),
    ],
    aux: (v) => [curvesLut([String(v.master), String(v.red), String(v.green), String(v.blue)])],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o;
  if (u_mode > 0.5) {
    // Luminance mode: the RGB curve changes brightness only, hue and saturation are kept.
    float l = luma(c.rgb);
    float nl = lut1(uAux0, l, 0.0, 4.0).r;
    o = c.rgb * (nl / max(l, 1e-3));
  } else {
    o = vec3(lut1(uAux0, c.r, 0.0, 4.0).r, lut1(uAux0, c.g, 0.0, 4.0).r, lut1(uAux0, c.b, 0.0, 4.0).r);
  }
  o = vec3(lut1(uAux0, o.r, 1.0, 4.0).r, lut1(uAux0, o.g, 2.0, 4.0).r, lut1(uAux0, o.b, 3.0, 4.0).r);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "levels",
    name: "Levels",
    category: "Adjust",
    description: "Input and output levels with a midpoint.",
    keywords: "black point white point gamma clip",
    params: [
      ...group("Input levels", [range("inBlack", "Input black", 0, 1, 0), range("inWhite", "Input white", 0, 1, 1)]),
      hero("midpoint", "Midpoint", 0.2, 5, 1),
      ...group("Output levels", [range("outBlack", "Output black", 0, 1, 0), range("outWhite", "Output white", 0, 1, 1)]),
      toggle("lumaOnly", "Affect luma only"),
    ],
    passes: single(`
vec3 lv(vec3 x) {
  x = sat((x - u_inBlack) / max(u_inWhite - u_inBlack, 1e-3));
  x = pow(x, vec3(1.0 / u_midpoint));
  return mix(vec3(u_outBlack), vec3(u_outWhite), x);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o;
  if (u_lumaOnly > 0.5) { float l = luma(c.rgb); o = c.rgb * (lv(vec3(l)).x / max(l, 1e-3)); }
  else o = lv(c.rgb);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "exposure",
    name: "Exposure",
    category: "Adjust",
    description: "Exposure in stops, in linear light.",
    keywords: "brightness stops ev",
    params: [
      hero("exposure", "Exposure", -5, 5, 0),
      hero("gamma", "Gamma", 0.5, 10, 2.2),
      range("gamut", "Gamut mapping", 0, 1, 0),
      toggle("reinhard", "Reinhard"),
      toggle("clipping", "Show clipping"),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lin = pow(max(c.rgb, 0.0), vec3(u_gamma)) * exp2(u_exposure);
  if (u_reinhard > 0.5) lin = lin / (1.0 + lin);
  // Gamut mapping: desaturate toward luminance instead of clipping channels separately.
  float mx = max(lin.r, max(lin.g, lin.b));
  if (mx > 1.0) { float l = min(luma(lin), 1.0); lin = mix(lin, l + (lin - l) * (1.0 - l) / max(mx - l, 1e-4), u_gamut); }
  vec3 o = pow(sat(lin), vec3(1.0 / u_gamma));
  if (u_clipping > 0.5) { if (mx > 1.0) o = vec3(1.0, 0.0, 0.0); if (max(o.r, max(o.g, o.b)) < 0.002) o = vec3(0.0, 0.0, 1.0); }
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "contrast",
    name: "Contrast",
    category: "Adjust",
    description: "S-curve contrast around a pivot.",
    keywords: "punch flat",
    params: [
      hero("strength", "Contrast strength", -2, 2, 0.2, 0.1),
      hero("pivot", "Pivot point", 0, 1, 0.5),
      range("output", "Output mapping", 0, 1, 1),
      range("gamma", "Gamma", 0.2, 5, 2.2),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 x = pow(max(c.rgb, 0.0), vec3(1.0 / u_gamma * 2.2));
  float k = exp(u_strength * 1.2);
  vec3 lo = u_pivot * pow(x / max(u_pivot, 1e-3), vec3(k));
  vec3 hi = 1.0 - (1.0 - u_pivot) * pow((1.0 - x) / max(1.0 - u_pivot, 1e-3), vec3(k));
  vec3 s = mix(lo, hi, step(u_pivot, x));
  // Output mapping blends between the raw curve and one renormalised to full range.
  vec3 o = mix(x, s, u_output);
  o = pow(sat(o), vec3(u_gamma / 2.2));
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "hue-saturation",
    name: "Hue/saturation",
    category: "Adjust",
    description: "Hue rotation and saturation.",
    keywords: "color hue shift saturation",
    params: [
      hero("hue", "Hue rotation", 0, 360, 0, 1, { unit: "°" }),
      hero("saturation", "Saturation", 0, 5, 1),
      toggle("invert", "Invert colors"),
      toggle("preserve", "Preserve lightness", 1),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lab = rgb2oklab(c.rgb);
  float a = radians(u_hue);
  lab.yz = mat2(cos(a), sin(a), -sin(a), cos(a)) * lab.yz * u_saturation;
  vec3 o = oklab2rgb(lab);
  if (u_preserve < 0.5) o = hsv2rgb(vec3(fract(rgb2hsv(c.rgb).x + u_hue / 360.0), sat(rgb2hsv(c.rgb).y * u_saturation), rgb2hsv(c.rgb).z));
  if (u_invert > 0.5) o = 1.0 - o;
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "hue-curves",
    name: "Hue curves",
    category: "Adjust",
    description: "Shift hue, saturation or luminance of chosen hues. 0.5 is neutral.",
    keywords: "selective color hue vs sat secondary",
    params: [
      select("model", "Model", ["HSV", "Oklab"]),
      curve("hueHue", "Hue vs Hue", "0,0.5 1,0.5", "#F7F2EC"),
      curve("hueSat", "Hue vs Saturation", "0,0.5 1,0.5", "#D3202A"),
      curve("hueLum", "Hue vs Luminance", "0,0.5 1,0.5", "#85827D"),
      range("hueSoft", "Hue softness", 0, 0.25, 0.025, 0.005),
      range("lumaSoft", "Luma softness", 0, 0.35, 0.08, 0.005),
      hero("amount", "Amount", 0, 1, 1),
    ],
    aux: (v) => [curvesLut([String(v.hueHue), String(v.hueSat), String(v.hueLum), "0,1 1,1"])],
    passes: single(`
vec3 curvesAt(float h) {
  // Averaging the curves over a hue window softens hard selections.
  vec3 acc = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    float x = fract(h + float(i) * u_hueSoft * 0.5);
    acc += vec3(lut1(uAux0, x, 0.0, 4.0).r, lut1(uAux0, x, 1.0, 4.0).r, lut1(uAux0, x, 2.0, 4.0).r);
  }
  return acc / 5.0;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 hsv = rgb2hsv(c.rgb);
  vec3 k = curvesAt(hsv.x);
  // Very dark, very bright and grey pixels have no meaningful hue; fade the change there.
  float w = smoothstep(0.0, 0.15, hsv.y) * smoothstep(0.0, u_lumaSoft + 0.02, hsv.z) * smoothstep(1.0, 1.0 - u_lumaSoft - 0.02, luma(c.rgb) * (1.0 - hsv.y));
  vec3 o;
  if (u_model < 0.5) {
    hsv.x = fract(hsv.x + (k.x - 0.5) * w);
    hsv.y = sat(hsv.y * mix(1.0, k.y * 2.0, w));
    o = hsv2rgb(hsv);
  } else {
    vec3 lab = rgb2oklab(c.rgb);
    float a = (k.x - 0.5) * TAU * w;
    lab.yz = mat2(cos(a), sin(a), -sin(a), cos(a)) * lab.yz * mix(1.0, k.y * 2.0, w);
    o = oklab2rgb(lab);
  }
  o *= 1.0 + (k.z - 0.5) * 1.6 * w;
  fragColor = vec4(mix(c.rgb, sat(o), u_amount), c.a);
}`),
  },
  {
    id: "color-balance",
    name: "Color balance",
    category: "Adjust",
    description: "Shift red, green and blue in linear light.",
    keywords: "white balance cast",
    params: [
      hero("red", "Red", -1, 1, 0),
      hero("green", "Green", -1, 1, 0),
      hero("blue", "Blue", -1, 1, 0),
      toggle("keepLuma", "Keep luma"),
      range("gamma", "Gamma", 0.2, 5, 2),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lin = pow(max(c.rgb, 0.0), vec3(u_gamma));
  vec3 o = lin * exp2(vec3(u_red, u_green, u_blue) * 1.5);
  if (u_keepLuma > 0.5) o *= luma(lin) / max(luma(o), 1e-4);
  fragColor = vec4(sat(pow(max(o, 0.0), vec3(1.0 / u_gamma))), c.a);
}`),
  },
  {
    id: "color-temperature",
    name: "Color temperature",
    category: "Adjust",
    description: "White balance in kelvin, separately for shadows and highlights.",
    keywords: "white balance warm cool kelvin",
    params: [
      hero("shadowK", "Shadow temperature", 2000, 10000, 6500, 1, { unit: "K" }),
      hero("highlightK", "Highlight temperature", 2000, 10000, 6500, 1, { unit: "K" }),
      range("gamma", "Gamma", 0.5, 10, 2.2),
    ],
    passes: single(`
// Blackbody white point (Tanner Helland's fit), normalised to 6500 K.
vec3 kelvin(float k) {
  float t = k / 100.0;
  vec3 c;
  c.r = t <= 66.0 ? 1.0 : sat(1.2929 * pow(t - 60.0, -0.1332));
  c.g = t <= 66.0 ? sat(0.3901 * log(t) - 0.6318) : sat(1.1298 * pow(t - 60.0, -0.0755));
  c.b = t >= 66.0 ? 1.0 : t <= 19.0 ? 0.0 : sat(0.5432 * log(t - 10.0) - 1.1963);
  return c;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lin = pow(max(c.rgb, 0.0), vec3(u_gamma));
  vec3 ref = kelvin(6500.0);
  // Neutral is 6500 K; a lower setting means the light was warm, so the image is cooled.
  vec3 ws = ref / max(kelvin(u_shadowK), 0.02);
  vec3 wh = ref / max(kelvin(u_highlightK), 0.02);
  ws /= luma(ws); wh /= luma(wh);
  vec3 w = mix(ws, wh, smoothstep(0.05, 0.6, luma(lin)));
  fragColor = vec4(sat(pow(lin * w, vec3(1.0 / u_gamma))), c.a);
}`),
  },
  {
    id: "rgb-gain",
    name: "RGB Gain",
    category: "Adjust",
    description: "Per-channel midpoint (lift), gain and gamma.",
    keywords: "lift gamma gain channel",
    params: [
      ...group("Midpoint", [range("rMid", "Red midpoint", 0, 1, 0), range("gMid", "Green midpoint", 0, 1, 0), range("bMid", "Blue midpoint", 0, 1, 0)]),
      ...group("Gain", [range("rGain", "Red gain", 0, 5, 1), range("gGain", "Green gain", 0, 5, 1), range("bGain", "Blue gain", 0, 5, 1)]),
      ...group("Gamma", [range("rGamma", "Red gamma", 0.2, 5, 1), range("gGamma", "Green gamma", 0.2, 5, 1), range("bGamma", "Blue gamma", 0.2, 5, 1)]),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 mid = vec3(u_rMid, u_gMid, u_bMid);
  vec3 o = (mid + c.rgb * (1.0 - mid)) * vec3(u_rGain, u_gGain, u_bGain);
  o = pow(max(o, 0.0), 1.0 / vec3(u_rGamma, u_gGamma, u_bGamma));
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "color-matrix",
    name: "Color matrix",
    category: "Adjust",
    description: "3×3 channel mixer with offsets.",
    keywords: "channel mixer swap",
    params: [
      ...group("Red", [range("rr", "Red from Red", -2, 2, 1), range("rg", "Red from Green", -2, 2, 0), range("rb", "Red from Blue", -2, 2, 0)]),
      ...group("Green", [range("gr", "Green from Red", -2, 2, 0), range("gg", "Green from Green", -2, 2, 1), range("gb", "Green from Blue", -2, 2, 0)]),
      ...group("Blue", [range("br", "Blue from Red", -2, 2, 0), range("bg", "Blue from Green", -2, 2, 0), range("bb", "Blue from Blue", -2, 2, 1)]),
      ...group("Offset", [range("ro", "Red offset", -2, 2, 0), range("go", "Green offset", -2, 2, 0), range("bo", "Blue offset", -2, 2, 0)]),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o = vec3(
    dot(c.rgb, vec3(u_rr, u_rg, u_rb)) + u_ro,
    dot(c.rgb, vec3(u_gr, u_gg, u_gb)) + u_go,
    dot(c.rgb, vec3(u_br, u_bg, u_bb)) + u_bo);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "color-grading",
    name: "Color grading",
    category: "Adjust",
    description: "Six tonal zones measured in stops, each with tint, exposure and saturation.",
    keywords: "lift gamma gain wheels grade cinematic zones",
    params: [
      ...group("Main", [color("gTint", "Global tint", "#808080"), range("gExp", "Global exposure", -4, 4, 0), range("gSat", "Global saturation", 0, 2, 1, 0.1)]),
      ...ZONES.flatMap(([z, k]) => group(z, [
        color(`${k}Tint`, `${z} tint`, "#808080"),
        range(`${k}Exp`, `${z} exposure`, -4, 4, 0),
        range(`${k}Sat`, `${z} saturation`, 0, 2, 1),
      ])),
      ...group("Zones", [
        range("z1", "Black | Shadow", -8, -1, -4, 0.05),
        range("z2", "Shadow | Light", -3, 1.5, 0, 0.05),
        range("z3", "Light | Highlight", 0, 2.4, 1.2, 0.05),
        range("z4", "Highlight | Specular", 0.5, 2.5, 2, 0.05),
        range("falloff", "Zone falloff", 0.25, 2.5, 1),
        toggle("show", "Show zones"),
        range("strength", "Strength", 0, 1, 1),
      ]),
    ],
    passes: single(TINT + `
void zoneApply(inout vec3 lin, float w, vec3 tint, float ex, float s) {
  if (w <= 0.0) return;
  vec3 t = tintOf(tint);
  // Zone exposure is gentler than global: half a stop per unit, so zones blend without clipping.
  vec3 g = lin * mix(vec3(1.0), t, w) * exp2(ex * w * 0.5);
  float l = luma(g);
  lin = mix(vec3(l), g, mix(1.0, s, w));
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lin = srgb2lin(c.rgb);
  // Stops relative to middle grey.
  float st = log2(max(luma(lin), 1e-5) / 0.18);
  float f = u_falloff;
  float w0 = 1.0 - smoothstep(u_z1 - f, u_z1 + f, st);
  float w1 = smoothstep(u_z1 - f, u_z1 + f, st) * (1.0 - smoothstep(u_z2 - f, u_z2 + f, st));
  float w2 = smoothstep(u_z2 - f, u_z2 + f, st) * (1.0 - smoothstep(u_z3 - f * 0.5, u_z3 + f * 0.5, st));
  float w3 = smoothstep(u_z3 - f * 0.5, u_z3 + f * 0.5, st) * (1.0 - smoothstep(u_z4 - f * 0.5, u_z4 + f * 0.5, st));
  float w4 = smoothstep(u_z4 - f * 0.5, u_z4 + f * 0.5, st);
  if (u_show > 0.5) {
    vec3 z = w0 * vec3(0.05) + w1 * vec3(0.2, 0.25, 0.5) + w2 * vec3(0.4, 0.6, 0.3) + w3 * vec3(0.9, 0.7, 0.3) + w4 * vec3(1.0);
    fragColor = vec4(z, c.a); return;
  }
  vec3 o = lin;
  zoneApply(o, w0, u_kTint, u_kExp, u_kSat);
  zoneApply(o, w1, u_sTint, u_sExp, u_sSat);
  zoneApply(o, w2, u_lTint, u_lExp, u_lSat);
  zoneApply(o, w3, u_hTint, u_hExp, u_hSat);
  zoneApply(o, w4, u_xTint, u_xExp, u_xSat);
  zoneApply(o, 1.0, u_gTint, u_gExp, u_gSat);
  fragColor = vec4(sat(lin2srgb(mix(lin, o, u_strength))), c.a);
}`),
  },
];
