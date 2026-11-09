import { curvesLut } from "../../lib/textures";
import { color, curve, group, hero, range, select, single, toggle, type EffectDef } from "../types";

export const adjust: EffectDef[] = [
  {
    id: "curves",
    name: "Curves",
    category: "Adjust",
    description: "Tone curves for the composite and each channel, with smooth monotone interpolation.",
    keywords: "tone curve rgb contrast fade matte",
    preview: "mountain:0",
    params: [
      curve("master", "RGB", "0,0 0.25,0.22 0.75,0.8 1,1", "#F7F2EC"),
      curve("red", "Red", "0,0 1,1", "#D3202A"),
      curve("green", "Green", "0,0 1,1", "#5FAF5F"),
      curve("blue", "Blue", "0,0 1,1", "#4F7FD8"),
      range("mix", "Mix", 0, 1, 1),
    ],
    aux: (v) => [curvesLut([String(v.master), String(v.red), String(v.green), String(v.blue)])],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 m = vec3(lut1(uAux0, c.r, 0.0, 4.0).r, lut1(uAux0, c.g, 0.0, 4.0).r, lut1(uAux0, c.b, 0.0, 4.0).r);
  vec3 o = vec3(lut1(uAux0, m.r, 1.0, 4.0).r, lut1(uAux0, m.g, 2.0, 4.0).r, lut1(uAux0, m.b, 3.0, 4.0).r);
  fragColor = vec4(mix(c.rgb, o, u_mix), c.a);
}`),
  },
  {
    id: "levels",
    name: "Levels",
    category: "Adjust",
    description: "Input black/white points, midtone gamma and output range, per channel.",
    keywords: "black point white point gamma clip",
    preview: "citynight:1",
    params: [
      select("channel", "Channel", ["RGB", "Red", "Green", "Blue"]),
      hero("inBlack", "In black", 0, 1, 0.06),
      hero("inWhite", "In white", 0, 1, 0.94),
      hero("gamma", "Gamma", 0.1, 3, 1.1),
      range("outBlack", "Out black", 0, 1, 0),
      range("outWhite", "Out white", 0, 1, 1),
    ],
    passes: single(`
float lv(float x) {
  x = sat((x - u_inBlack) / max(u_inWhite - u_inBlack, 1e-3));
  x = pow(x, 1.0 / u_gamma);
  return mix(u_outBlack, u_outWhite, x);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o = vec3(lv(c.r), lv(c.g), lv(c.b));
  int ch = int(u_channel + 0.5);
  if (ch == 1) o = vec3(o.r, c.g, c.b);
  if (ch == 2) o = vec3(c.r, o.g, c.b);
  if (ch == 3) o = vec3(c.r, c.g, o.b);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "exposure",
    name: "Exposure",
    category: "Adjust",
    description: "Photographic exposure in stops (linear light), with offset and highlight roll-off.",
    keywords: "brightness stops ev",
    preview: "horse:0",
    params: [
      hero("ev", "Exposure", -4, 4, 0.6, 0.01, { unit: "EV" }),
      range("offset", "Offset", -0.2, 0.2, 0),
      hero("rolloff", "Highlight roll-off", 0, 1, 0.5),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 l = srgb2lin(c.rgb) * exp2(u_ev) + u_offset;
  // Soft shoulder: compress values above 1 instead of hard clipping.
  vec3 k = vec3(u_rolloff * 0.8 + 0.001);
  vec3 sh = 1.0 - k + k * (1.0 - exp(-(l - (1.0 - k)) / k));
  l = mix(l, sh, step(1.0 - k, l) * step(0.001, u_rolloff));
  fragColor = vec4(lin2srgb(l), c.a);
}`),
  },
  {
    id: "contrast",
    name: "Contrast",
    category: "Adjust",
    description: "S-curve contrast around a movable pivot, plus brightness and black/white crush.",
    keywords: "punch brightness pivot",
    preview: "room:0",
    params: [
      hero("contrast", "Contrast", -1, 1, 0.35),
      hero("pivot", "Pivot", 0.1, 0.9, 0.5),
      range("brightness", "Brightness", -0.5, 0.5, 0),
      range("crush", "Black crush", 0, 0.3, 0),
      range("fade", "Fade", 0, 0.3, 0),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 x = sat(c.rgb + u_brightness);
  float k = u_contrast >= 0.0 ? 1.0 + u_contrast * 4.0 : 1.0 / (1.0 - u_contrast * 3.0);
  vec3 lo = u_pivot * pow(x / u_pivot, vec3(k));
  vec3 hi = 1.0 - (1.0 - u_pivot) * pow((1.0 - x) / (1.0 - u_pivot), vec3(k));
  vec3 o = mix(lo, hi, step(u_pivot, x));
  o = sat((o - u_crush) / (1.0 - u_crush));
  o = mix(vec3(u_fade), vec3(1.0 - u_fade * 0.3), o);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "hue-saturation",
    name: "Hue/saturation",
    category: "Adjust",
    description: "Hue rotation, saturation, vibrance and lightness in OKLab, or colorize to one hue.",
    keywords: "hue shift saturate desaturate vibrance colorize",
    preview: "fire:1",
    params: [
      hero("hue", "Hue", -180, 180, 30, 1, { unit: "°" }),
      hero("saturation", "Saturation", -1, 1, 0.2),
      range("vibrance", "Vibrance", -1, 1, 0),
      range("lightness", "Lightness", -1, 1, 0),
      ...group("Colorize", [toggle("colorize", "Colorize"), color("tint", "Tint", "#D3202A"), range("tintAmount", "Strength", 0, 1, 0.8)]),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lab = rgb2oklab(c.rgb);
  float ch = length(lab.yz);
  float h = atan(lab.z, lab.y) + radians(u_hue);
  float vib = 1.0 + u_vibrance * (1.0 - smoothstep(0.0, 0.2, ch));
  ch *= (1.0 + u_saturation) * vib;
  lab.x = u_lightness > 0.0 ? mix(lab.x, 1.0, u_lightness) : lab.x * (1.0 + u_lightness);
  lab.yz = ch * vec2(cos(h), sin(h));
  vec3 o = oklab2rgb(lab);
  if (u_colorize > 0.5) {
    vec3 t = rgb2oklab(u_tint);
    vec3 cz = oklab2rgb(vec3(lab.x, t.yz * u_tintAmount));
    o = cz;
  }
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "hue-curves",
    name: "Hue curves",
    category: "Adjust",
    description: "Shift hue, saturation or lightness of specific hues. 0.5 on each curve is neutral.",
    keywords: "selective color hue vs sat secondary",
    preview: "street:0",
    params: [
      curve("hueHue", "Hue vs hue", "0,0.5 0.25,0.5 0.4,0.62 0.55,0.5 1,0.5", "#F7F2EC"),
      curve("hueSat", "Hue vs sat", "0,0.5 0.12,0.75 0.35,0.5 0.6,0.3 1,0.5", "#D3202A"),
      curve("hueLum", "Hue vs light", "0,0.5 1,0.5", "#85827D"),
      curve("lumSat", "Light vs sat", "0,0.4 0.5,0.5 1,0.45", "#BDB9B2"),
    ],
    aux: (v) => [curvesLut([String(v.hueHue), String(v.hueSat), String(v.hueLum), String(v.lumSat)])],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 hsv = rgb2hsv(c.rgb);
  float h = hsv.x;
  float dh = lut1(uAux0, h, 0.0, 4.0).r - 0.5;
  float ds = lut1(uAux0, h, 1.0, 4.0).r * 2.0;
  float dl = lut1(uAux0, h, 2.0, 4.0).r - 0.5;
  float dsl = lut1(uAux0, luma(c.rgb), 3.0, 4.0).r * 2.0;
  float wsat = smoothstep(0.02, 0.2, hsv.y);
  hsv.x = fract(h + dh * wsat);
  hsv.y = sat(hsv.y * mix(1.0, ds * dsl, wsat));
  vec3 o = hsv2rgb(hsv);
  o = sat(o + dl * wsat * 0.8);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "color-balance",
    name: "Color balance",
    category: "Adjust",
    description: "Push shadows, midtones and highlights toward cyan/red, magenta/green and yellow/blue.",
    keywords: "split toning shadows highlights",
    preview: "beach:0",
    params: [
      ...group("Shadows", [range("sR", "Cyan · Red", -1, 1, -0.15), range("sG", "Magenta · Green", -1, 1, 0.05), range("sB", "Yellow · Blue", -1, 1, 0.25)]),
      ...group("Midtones", [range("mR", "Cyan · Red", -1, 1, 0.05), range("mG", "Magenta · Green", -1, 1, 0), range("mB", "Yellow · Blue", -1, 1, -0.05)]),
      ...group("Highlights", [range("hR", "Cyan · Red", -1, 1, 0.2), range("hG", "Magenta · Green", -1, 1, 0.05), range("hB", "Yellow · Blue", -1, 1, -0.2)]),
      toggle("preserve", "Preserve luminosity", 1),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = luma(c.rgb);
  float ws = 1.0 - smoothstep(0.0, 0.5, l);
  float wh = smoothstep(0.5, 1.0, l);
  float wm = 1.0 - ws - wh;
  vec3 shift = (vec3(u_sR, u_sG, u_sB) * ws + vec3(u_mR, u_mG, u_mB) * wm + vec3(u_hR, u_hG, u_hB) * wh) * 0.25;
  vec3 o = sat(c.rgb + shift);
  if (u_preserve > 0.5) o = sat(o + (l - luma(o)));
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "color-temperature",
    name: "Color temperature",
    category: "Adjust",
    description: "White balance in linear light: warm/cool along the Planckian axis, green/magenta tint.",
    keywords: "white balance warm cool tint kelvin",
    preview: "sky:0",
    params: [hero("temperature", "Temperature", -1, 1, -0.35), hero("tint", "Tint", -1, 1, 0.05), range("strength", "Strength", 0, 1, 1)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 l = srgb2lin(c.rgb);
  float t = u_temperature * 0.45;
  vec3 wb = vec3(1.0 + t, 1.0 + t * 0.15 - u_tint * 0.25, 1.0 - t);
  wb /= luma(wb);
  vec3 o = lin2srgb(l * mix(vec3(1.0), wb, u_strength));
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "rgb-gain",
    name: "RGB gain",
    category: "Adjust",
    description: "Per-channel gain, gamma and offset — the primary grading controls of a colour corrector.",
    keywords: "channel gain lift offset",
    preview: "fruit:1",
    params: [
      ...group("Gain", [range("gR", "Red", 0, 2, 1.2), range("gG", "Green", 0, 2, 0.95), range("gB", "Blue", 0, 2, 0.85)]),
      ...group("Gamma", [range("yR", "Red", 0.2, 3, 1), range("yG", "Green", 0.2, 3, 1), range("yB", "Blue", 0.2, 3, 1)]),
      ...group("Offset", [range("oR", "Red", -0.3, 0.3, 0), range("oG", "Green", -0.3, 0.3, 0), range("oB", "Blue", -0.3, 0.3, 0.02)]),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o = pow(c.rgb * vec3(u_gR, u_gG, u_gB), 1.0 / vec3(u_yR, u_yG, u_yB)) + vec3(u_oR, u_oG, u_oB);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "color-matrix",
    name: "Color matrix",
    category: "Adjust",
    description: "Channel mixer: rebuild each output channel from the input channels.",
    keywords: "channel mixer swap matrix infrared",
    preview: "pinkflower:0",
    params: [
      ...group("Red out", [range("rr", "From red", -2, 2, 0.4), range("rg", "From green", -2, 2, 0.6), range("rb", "From blue", -2, 2, 0)]),
      ...group("Green out", [range("gr", "From red", -2, 2, 0.1), range("gg", "From green", -2, 2, 0.2), range("gb", "From blue", -2, 2, 0.7)]),
      ...group("Blue out", [range("br", "From red", -2, 2, 0.9), range("bg", "From green", -2, 2, 0), range("bb", "From blue", -2, 2, 0.1)]),
      toggle("mono", "Monochrome"),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o = vec3(dot(c.rgb, vec3(u_rr, u_rg, u_rb)), dot(c.rgb, vec3(u_gr, u_gg, u_gb)), dot(c.rgb, vec3(u_br, u_bg, u_bb)));
  if (u_mono > 0.5) o = vec3(o.r);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "color-grading",
    name: "Color grading",
    category: "Adjust",
    description: "Lift / gamma / gain colour wheels with a global saturation and contrast trim.",
    keywords: "lift gamma gain wheels teal orange cinematic",
    preview: "ocean:2",
    params: [
      ...group("Lift (shadows)", [color("lift", "Colour", "#2b4a66"), range("liftAmt", "Amount", 0, 1, 0.35)]),
      ...group("Gamma (mids)", [color("gammaC", "Colour", "#b8a48a"), range("gammaAmt", "Amount", 0, 1, 0.2)]),
      ...group("Gain (highs)", [color("gain", "Colour", "#ffd7a8"), range("gainAmt", "Amount", 0, 1, 0.35)]),
      range("saturation", "Saturation", 0, 2, 0.95),
      range("contrast", "Contrast", 0.5, 1.5, 1.05),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 lift = (u_lift - luma(u_lift)) * u_liftAmt * 0.6;
  vec3 gain = 1.0 + (u_gain - luma(u_gain)) * u_gainAmt * 0.9;
  vec3 gam = 1.0 - (u_gammaC - luma(u_gammaC)) * u_gammaAmt * 0.9;
  vec3 o = c.rgb * gain + lift * (1.0 - c.rgb);
  o = pow(sat(o), max(gam, vec3(0.2)));
  o = (o - 0.5) * u_contrast + 0.5;
  o = saturation(sat(o), u_saturation);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "sharpen",
    name: "Sharpen",
    category: "Adjust",
    description: "Unsharp mask with radius, amount and a threshold that protects flat areas.",
    keywords: "detail clarity unsharp",
    preview: "face:0",
    params: [hero("amount", "Amount", 0, 3, 1.2), hero("radius", "Radius", 0.5, 12, 2, 0.1, { unit: "px" }), range("threshold", "Threshold", 0, 0.2, 0.01), toggle("lumaOnly", "Luminance only", 1)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 b = blur13(uTex0, vUv, refPx(u_radius)).rgb;
  vec3 d = c.rgb - b;
  if (u_lumaOnly > 0.5) d = vec3(luma(d));
  float m = smoothstep(u_threshold, u_threshold * 2.0 + 1e-3, abs(luma(c.rgb - b)));
  fragColor = vec4(sat(c.rgb + d * u_amount * m), c.a);
}`),
  },
];
