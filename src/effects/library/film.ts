import { BLUR_FRAG } from "../../engine/glsl";
import { color, group, hero, range, select, single, toggle, type EffectDef, type PassDef } from "../types";

const rad = (px: number) => px / 1080;

/** Shared film helpers: grain that follows exposure, and a soft vignette. */
const FILM = `
float filmGrain(vec2 uv, float size, float t) {
  vec2 px = refCoord(uv);
  return grainAt(px, size, floor(t * 24.0) / 24.0 + uSeed);
}
float vig(vec2 uv, float amount, float radius) {
  vec2 d = (uv - 0.5) * vec2(aspect(), 1.0) / max(aspect(), 1.0);
  return 1.0 - amount * smoothstep(radius, radius + 0.55, length(d) * 1.35);
}
`;

/** Highlight extraction with a soft knee. */
const BRIGHT_FRAG = `
uniform float uThreshold;
uniform float uKnee;
uniform vec3 uTint;
void main() {
  vec3 c = texture(uTex0, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(uKnee, 1e-4);
  float soft = clamp(l - uThreshold + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k);
  float w = max(soft, l - uThreshold) / max(l, 1e-4);
  fragColor = vec4(c * w * uTint, 1.0);
}`;

const STREAK_FRAG = `
uniform vec2 uDir;
uniform float uLength;
uniform float uWeight;
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  vec2 step = uDir * uLength / 24.0 * vec2(1.0 / aspect(), 1.0);
  for (int i = -24; i <= 24; i++) {
    float t = float(i);
    float w = exp(-abs(t) / 7.0);
    acc += texture(uTex0, vUv + step * t).rgb * w;
    wsum += w;
  }
  // uTex1 carries the streaks accumulated by earlier passes (black for the first).
  fragColor = vec4(texture(uTex1, vUv).rgb + acc / wsum * uWeight * 6.0, 1.0);
}`;

function blurPair(id: string, from: string, scale: number, radius: (v: Record<string, number | string>) => number): PassDef[] {
  return [
    { id: `${id}h`, frag: BLUR_FRAG, inputs: [from], scale, uniforms: (v) => ({ uDir: [1, 0], uRadius: radius(v) }) },
    { id: `${id}v`, frag: BLUR_FRAG, inputs: [`${id}h`], scale, uniforms: (v) => ({ uDir: [0, 1], uRadius: radius(v) }) },
  ];
}

export const film: EffectDef[] = [
  {
    id: "classic-film",
    name: "Classic Film",
    category: "Film",
    description: "Colour negative stock emulation: print curve, crossover tint, grain and halation-free glow.",
    keywords: "analog negative stock 35mm portra gold cinestill",
    preview: "mountain:1",
    animated: true,
    params: [
      select("stock", "Stock", ["Warm portrait 400", "Consumer gold 200", "Cine tungsten 800", "Slide saturated 50", "Expired"]),
      hero("exposure", "Exposure", -1.5, 1.5, 0.1, 0.01, { unit: "EV" }),
      hero("grain", "Grain", 0, 1, 0.35),
      range("grainSize", "Grain size", 0.5, 4, 1.4, 0.05),
      range("fade", "Fade", 0, 0.3, 0.06),
      range("vignette", "Vignette", 0, 1, 0.25),
      range("strength", "Strength", 0, 1, 1),
    ],
    passes: single(FILM + `
void main() {
  vec4 c = texture(uTex0, vUv);
  int s = int(u_stock + 0.5);
  vec3 shadow = vec3(0.0, 0.03, 0.05); vec3 high = vec3(0.04, 0.02, -0.03); float satur = 1.0; float k = 1.15;
  if (s == 1) { shadow = vec3(0.02, 0.0, 0.04); high = vec3(0.07, 0.04, -0.06); satur = 1.15; k = 1.2; }
  if (s == 2) { shadow = vec3(-0.02, 0.04, 0.09); high = vec3(0.02, 0.0, -0.02); satur = 0.95; k = 1.25; }
  if (s == 3) { shadow = vec3(0.0, 0.0, 0.03); high = vec3(0.02, 0.02, -0.02); satur = 1.4; k = 1.4; }
  if (s == 4) { shadow = vec3(0.08, 0.0, 0.1); high = vec3(0.08, 0.06, -0.1); satur = 0.75; k = 0.95; }
  vec3 l = srgb2lin(c.rgb) * exp2(u_exposure);
  // Filmic print curve (Hable-style shoulder), then back to display.
  vec3 x = max(l * 1.6, 0.0);
  vec3 t = (x * (0.22 * x + 0.03) + 0.002) / (x * (0.22 * x + 0.3) + 0.06) - 0.033;
  vec3 o = lin2srgb(t / 0.77);
  o = (o - 0.5) * k + 0.5;
  float y = luma(sat(o));
  o += shadow * (1.0 - smoothstep(0.0, 0.5, y)) + high * smoothstep(0.5, 1.0, y);
  o = saturation(sat(o), satur);
  o = mix(vec3(u_fade), vec3(1.0 - u_fade * 0.4), o);
  float g = filmGrain(vUv, u_grainSize, uTime) * u_grain * 0.18 * (1.0 - abs(y - 0.45) * 1.1);
  o += g;
  o *= vig(vUv, u_vignette, 0.35);
  fragColor = vec4(mix(c.rgb, sat(o), u_strength), c.a);
}`),
  },
  {
    id: "vintage-film",
    name: "Vintage Film",
    category: "Film",
    description: "Faded, colour-shifted old prints: lifted blacks, warm cast, dust and a soft edge leak.",
    keywords: "faded old retro 70s print",
    preview: "car:1",
    animated: true,
    params: [
      hero("age", "Age", 0, 1, 0.6),
      hero("warmth", "Warmth", -1, 1, 0.45),
      range("fade", "Fade", 0, 0.5, 0.18),
      range("grain", "Grain", 0, 1, 0.45),
      range("dust", "Dust", 0, 1, 0.35),
      range("leak", "Light leak", 0, 1, 0.3),
      range("vignette", "Vignette", 0, 1, 0.45),
    ],
    passes: single(FILM + `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 o = c.rgb;
  o = mix(o, vec3(dot(o, vec3(0.393, 0.769, 0.189)), dot(o, vec3(0.349, 0.686, 0.168)), dot(o, vec3(0.272, 0.534, 0.131))), u_age * 0.45);
  o = saturation(o, 1.0 - u_age * 0.35);
  o += vec3(0.06, 0.01, -0.05) * u_warmth;
  o.b = mix(o.b, o.b * 0.85 + 0.08, u_age);
  o = mix(vec3(u_fade, u_fade * 0.85, u_fade * 0.8), vec3(1.0 - u_fade * 0.15, 0.97 - u_fade * 0.2, 0.9 - u_fade * 0.3), sat(o));
  float tt = floor(uTime * 12.0);
  o += filmGrain(vUv, 1.6, uTime) * u_grain * 0.16;
  vec2 px = refCoord(vUv) + hash22(vec2(tt, 3.0)) * 900.0;
  float speck = smoothstep(0.985 - u_dust * 0.02, 1.0, hash12(floor(px / 3.0))) * step(0.6, vnoise(px * 0.01 + tt));
  o = mix(o, vec3(0.95, 0.92, 0.85) * (hash12(floor(px / 3.0) + 1.0) > 0.5 ? 1.0 : 0.15), speck * u_dust);
  vec2 lp = vec2(vUv.x * 1.2 - 0.1, vUv.y);
  float leak = smoothstep(0.35, 0.0, lp.x + sin(vUv.y * 3.0 + uSeed) * 0.08) * u_leak;
  o = blendScreen(o, vec3(1.0, 0.35, 0.1) * leak);
  o *= vig(vUv, u_vignette, 0.3);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "bw-film",
    name: "Black & White",
    category: "Film",
    description: "Panchromatic B&W stocks: spectral response, characteristic curve, grain and toning.",
    keywords: "black white silver gelatin tri-x hp5 monochrome",
    preview: "bw:1",
    animated: true,
    params: [
      select("stock", "Stock", ["Push 400 (gritty)", "Fine 100 (smooth)", "High key", "Ortho (red-blind)"]),
      select("filter", "Lens filter", ["None", "Yellow", "Orange", "Red", "Green"]),
      hero("contrast", "Contrast", 0.5, 2.5, 1.25),
      hero("grain", "Grain", 0, 1, 0.5),
      select("tone", "Toning", ["None", "Sepia", "Selenium", "Cyanotype"]),
      range("toneAmount", "Toning amount", 0, 1, 0.4),
    ],
    passes: single(FILM + `
void main() {
  vec4 c = texture(uTex0, vUv);
  int st = int(u_stock + 0.5);
  int f = int(u_filter + 0.5);
  vec3 w = vec3(0.3, 0.59, 0.11);
  if (st == 3) w = vec3(0.02, 0.48, 0.5);
  if (f == 1) w *= vec3(1.2, 1.05, 0.35);
  if (f == 2) w *= vec3(1.6, 0.9, 0.15);
  if (f == 3) w *= vec3(2.4, 0.5, 0.05);
  if (f == 4) w *= vec3(0.5, 1.4, 0.4);
  w /= (w.r + w.g + w.b);
  float l = dot(c.rgb, w);
  float k = u_contrast * (st == 0 ? 1.15 : st == 2 ? 0.8 : 1.0);
  l = st == 2 ? pow(l, 0.7) : l;
  l = sat((l - 0.5) * k + 0.5);
  l = l * l * (3.0 - 2.0 * l) * 0.35 + l * 0.65;
  float gs = st == 0 ? 1.9 : st == 1 ? 0.9 : 1.3;
  l += filmGrain(vUv, gs, uTime) * u_grain * (st == 0 ? 0.22 : 0.12) * (1.0 - abs(l - 0.5));
  vec3 o = vec3(sat(l));
  int tn = int(u_tone + 0.5);
  vec3 tint = tn == 1 ? vec3(1.07, 0.95, 0.78) : tn == 2 ? vec3(0.96, 0.92, 1.02) : vec3(0.75, 0.9, 1.15);
  if (tn > 0) o = mix(o, sat(o * tint + (tn == 3 ? vec3(0.0, 0.03, 0.08) * (1.0 - l) : vec3(0.0))), u_toneAmount);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "infrared-film",
    name: "Infrared Film",
    category: "Film",
    description: "Colour-infrared false colour (foliage turns red/pink) or B&W infrared with glowing leaves.",
    keywords: "aerochrome ir false color foliage pink",
    preview: "forest:0",
    params: [
      select("mode", "Mode", ["Colour IR", "B&W IR", "Gold IR"]),
      hero("strength", "Strength", 0, 1, 1),
      hero("foliage", "Foliage response", 0, 2, 1.1),
      range("glow", "Glow", 0, 1, 0.35),
      range("grain", "Grain", 0, 1, 0.25),
    ],
    passes: single(FILM + `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 b = blur13(uTex0, vUv, refPx(10.0)).rgb;
  float veg = sat((c.g - max(c.r, c.b) * 0.85) * 4.0 * u_foliage + 0.15 * u_foliage);
  int m = int(u_mode + 0.5);
  vec3 o;
  if (m == 0) {
    o = vec3(c.g * 0.9 + veg * 0.6, c.r * 0.85, c.g * 0.4 + c.b * 0.6);
    o = mix(o, vec3(1.0, 0.25, 0.45), veg * 0.45);
  } else if (m == 1) {
    float l = luma(c.rgb) * 0.6 + veg * 0.7 - c.b * 0.25;
    o = vec3(sat(l * 1.2));
  } else {
    o = vec3(c.g * 0.9 + veg * 0.5, c.g * 0.7 + veg * 0.35, c.b * 0.5);
    o = mix(o, vec3(1.0, 0.7, 0.2), veg * 0.4);
  }
  o = blendScreen(o, b * veg * u_glow);
  o += filmGrain(vUv, 1.3, 0.0) * u_grain * 0.12;
  fragColor = vec4(mix(c.rgb, sat(o), u_strength), c.a);
}`),
  },
  {
    id: "instant-film",
    name: "Instant Film",
    category: "Film",
    description: "Instant print chemistry: cyan shadows, creamy highlights, soft focus and an optional frame.",
    keywords: "polaroid instax integral print frame",
    preview: "woman:0",
    params: [
      hero("warmth", "Warmth", -1, 1, 0.3),
      hero("fade", "Fade", 0, 0.4, 0.14),
      range("soften", "Soft focus", 0, 1, 0.35),
      range("chem", "Chemical edge", 0, 1, 0.4),
      range("vignette", "Vignette", 0, 1, 0.35),
      ...group("Frame", [toggle("frame", "Show frame", 1), color("frameColor", "Colour", "#F4F1EA"), range("border", "Border", 0, 0.15, 0.05)]),
    ],
    passes: single(FILM + `
void main() {
  float b = u_frame > 0.5 ? u_border : 0.0;
  vec2 lo = vec2(b / aspect(), b * 3.2);
  vec2 hi = vec2(1.0 - b / aspect(), 1.0 - b);
  vec2 uv = (vUv - lo) / (hi - lo);
  vec4 c = texture(uTex0, uv);
  vec3 s = blur13(uTex0, uv, refPx(6.0)).rgb;
  vec3 o = mix(c.rgb, blendScreen(c.rgb, s) * 0.95, u_soften * 0.6);
  float y = luma(o);
  o += vec3(-0.03, 0.02, 0.06) * (1.0 - smoothstep(0.0, 0.45, y));
  o += vec3(0.05, 0.03, -0.04) * smoothstep(0.55, 1.0, y) * (1.0 + u_warmth);
  o = mix(vec3(u_fade * 0.9, u_fade, u_fade * 1.1), vec3(0.98, 0.96, 0.9), sat(o));
  o = saturation(o, 0.85);
  vec2 e = min(uv, 1.0 - uv);
  float edge = smoothstep(0.0, 0.08, min(e.x * aspect(), e.y) + fbm(uv * 12.0 + uSeed) * 0.04);
  o = mix(o * vec3(0.85, 0.95, 1.05) + vec3(0.02, 0.05, 0.02), o, mix(1.0, edge, u_chem));
  o *= vig(uv, u_vignette, 0.3);
  bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  vec3 frame = u_frameColor * (0.97 + paperTex(refCoord(vUv)) * 0.05);
  fragColor = vec4(inside ? sat(o) : frame, 1.0);
}`),
  },
  {
    id: "film-grain",
    name: "Film grain",
    category: "Film",
    description: "Grain modelled per film stock: clumped silver or dye-cloud grain in linear light, with its own response across shadows, midtones and highlights.",
    keywords: "noise grain texture analog stock 35mm 16mm super8",
    preview: "film:4",
    animated: true,
    params: [
      select("type", "Stock", ["Fine 50", "Portrait 160", "Portrait 400", "Gold 200", "Cine 500T", "Cine 50D", "Tri-X 400", "HP 800", "Delta 3200", "Super 8", "16 mm", "Push 1600", "Instant", "Expired", "Xerox"], 2),
      hero("amount", "Amount", 0, 1, 0.5),
      hero("size", "Size", 0.5, 3, 1, 0.01),
      ...group("Response", [range("shadows", "Shadows", 0, 1, 0.5), range("midtones", "Midtones", 0, 1, 1), range("highlights", "Highlights", 0, 1, 0.5)]),
      range("chroma", "Colour", 0, 1, 0.5),
      range("interval", "Frame interval", 0, 60, 0, 1),
    ],
    passes: single(`
// Per stock: x = base size (ref px), y = roughness, z = colour (dye clouds), w = strength.
vec4 stock(int t) {
  if (t == 0) return vec4(0.7, 0.2, 0.5, 0.45);
  if (t == 1) return vec4(0.9, 0.3, 0.6, 0.6);
  if (t == 2) return vec4(1.15, 0.4, 0.7, 0.8);
  if (t == 3) return vec4(1.1, 0.45, 0.8, 0.85);
  if (t == 4) return vec4(1.3, 0.5, 0.75, 0.95);
  if (t == 5) return vec4(0.8, 0.25, 0.6, 0.55);
  if (t == 6) return vec4(1.4, 0.7, 0.0, 1.0);
  if (t == 7) return vec4(1.6, 0.75, 0.0, 1.1);
  if (t == 8) return vec4(2.2, 0.9, 0.0, 1.35);
  if (t == 9) return vec4(2.8, 0.8, 0.9, 1.5);
  if (t == 10) return vec4(2.0, 0.6, 0.8, 1.2);
  if (t == 11) return vec4(2.0, 0.95, 0.6, 1.4);
  if (t == 12) return vec4(1.2, 0.3, 0.4, 0.7);
  if (t == 13) return vec4(1.8, 0.85, 1.0, 1.3);
  return vec4(1.0, 1.0, 0.0, 1.6);
}
float clump(vec2 p, float rough, float t) {
  // Two octaves of smooth noise plus a crisp per-crystal hash, mixed by roughness.
  float a = snoise(p + t * 17.31) * 0.6 + snoise(p * 2.07 + t * 9.7 + 13.0) * 0.4;
  float b = (hash12(floor(p * 1.6) + t * 31.0) - 0.5) * 2.0;
  return mix(a, b, rough * 0.55);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec4 st = stock(int(u_type + 0.5));
  float t = floor(uTime * 24.0 / max(u_interval, 1.0)) + uSeed;
  vec2 p = refCoord(vUv) / (st.x * u_size);
  float g = clump(p, st.y, t);
  vec3 gc = vec3(clump(p + 21.7, st.y, t), clump(p + 47.3, st.y, t), clump(p + 83.9, st.y, t));
  vec3 n = mix(vec3(g), gc, st.z * u_chroma);
  // Response: grain is most visible in the midtones of a negative.
  float y = luma(c.rgb);
  float resp = mix(mix(u_shadows, u_midtones, smoothstep(0.0, 0.45, y)), u_highlights, smoothstep(0.55, 1.0, y));
  vec3 lin = srgb2lin(c.rgb);
  lin *= 1.0 + n * u_amount * st.w * 0.55 * resp;
  lin += n * u_amount * st.w * 0.02 * resp;
  // Xerox: harsh toner speckle on top.
  if (int(u_type + 0.5) == 14) lin = mix(lin, vec3(step(0.5, luma(lin) + g * 0.3 * u_amount)), 0.25 * u_amount);
  fragColor = vec4(sat(lin2srgb(lin)), c.a);
}`),
  },
  {
    id: "halation",
    name: "Halation",
    category: "Film",
    description: "Red-orange glow bleeding around highlights, as light bounces off the film base.",
    keywords: "cinestill glow red halo highlights",
    preview: "subway:0",
    params: [
      hero("amount", "Amount", 0, 2, 0.9),
      hero("threshold", "Threshold", 0, 1, 0.62),
      hero("radius", "Radius", 2, 80, 22, 0.5, { unit: "px" }),
      color("tint", "Tint", "#FF3A10"),
      range("knee", "Knee", 0.01, 0.5, 0.12),
    ],
    passes: [
      { id: "bright", frag: BRIGHT_FRAG, inputs: ["input"], scale: 0.5, uniforms: (v) => ({ uThreshold: Number(v.threshold), uKnee: Number(v.knee), uTint: [1, 1, 1] }) },
      ...blurPair("a", "bright", 0.5, (v) => rad(Number(v.radius) * 0.5)),
      ...blurPair("b", "av", 0.25, (v) => rad(Number(v.radius) * 1.6)),
      {
        id: "out",
        inputs: ["input", "av", "bv"],
        frag: `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 h = texture(uTex1, vUv).rgb * 0.6 + texture(uTex2, vUv).rgb * 0.8;
  float hl = luma(h);
  vec3 glow = u_tint * hl * u_amount * 1.6;
  vec3 o = blendScreen(c.rgb, glow * (1.0 - luma(c.rgb) * 0.4));
  fragColor = vec4(sat(o), c.a);
}`,
      },
    ],
  },
  {
    id: "bloom",
    name: "Bloom",
    category: "Film",
    description: "Two-octave highlight glow with a soft-knee threshold and colour tint.",
    keywords: "glow dreamy light bleed",
    preview: "hands:2",
    params: [
      hero("intensity", "Intensity", 0, 3, 1.1),
      hero("threshold", "Threshold", 0, 1, 0.55),
      hero("radius", "Radius", 2, 120, 30, 0.5, { unit: "px" }),
      range("knee", "Knee", 0.01, 0.5, 0.2),
      color("tint", "Tint", "#FFF4E6"),
      select("mode", "Mode", ["Screen", "Add"]),
    ],
    passes: [
      { id: "bright", frag: BRIGHT_FRAG, inputs: ["input"], scale: 0.5, uniforms: (v) => ({ uThreshold: Number(v.threshold), uKnee: Number(v.knee), uTint: [1, 1, 1] }) },
      ...blurPair("a", "bright", 0.5, (v) => rad(Number(v.radius) * 0.4)),
      ...blurPair("b", "av", 0.25, (v) => rad(Number(v.radius) * 1.5)),
      {
        id: "out",
        inputs: ["input", "av", "bv"],
        frag: `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 g = (texture(uTex1, vUv).rgb * 0.55 + texture(uTex2, vUv).rgb * 0.75) * u_tint * u_intensity;
  vec3 o = u_mode > 0.5 ? c.rgb + g : blendScreen(c.rgb, g);
  fragColor = vec4(sat(o), c.a);
}`,
      },
    ],
  },
  {
    id: "star-glow",
    name: "Star glow",
    category: "Film",
    description: "Cross-screen filter: highlights flare into 4, 6 or 8-point stars.",
    keywords: "star filter cross flare sparkle",
    preview: "citynight:0",
    params: [
      hero("intensity", "Intensity", 0, 3, 1.2),
      hero("threshold", "Threshold", 0.3, 1, 0.75),
      hero("length", "Length", 0.02, 0.6, 0.18),
      select("points", "Points", ["4", "6", "8"]),
      range("angle", "Angle", 0, 180, 45, 1, { unit: "°" }),
      color("tint", "Tint", "#FFF1DD"),
    ],
    passes: [
      { id: "bright", frag: BRIGHT_FRAG, inputs: ["input"], scale: 0.5, uniforms: (v) => ({ uThreshold: Number(v.threshold), uKnee: 0.1, uTint: [1, 1, 1] }) },
      ...[0, 1, 2, 3].map((i): PassDef => ({
        id: `s${i}`,
        frag: STREAK_FRAG,
        inputs: i === 0 ? ["bright"] : ["bright", `s${i - 1}`],
        scale: 0.5,
        uniforms: (v) => {
          const lines = [2, 3, 4][Number(v.points) | 0];
          const a = ((Number(v.angle) + (i * 180) / lines) * Math.PI) / 180;
          return { uDir: [Math.cos(a), Math.sin(a)], uLength: Number(v.length), uWeight: i < lines ? 1 : 0 };
        },
      })),
      {
        id: "out",
        inputs: ["input", "s3"],
        frag: `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 s = texture(uTex1, vUv).rgb;
  fragColor = vec4(sat(blendScreen(c.rgb, s * u_tint * u_intensity)), c.a);
}`,
      },
    ],
  },
  {
    id: "vignette",
    name: "Vignette",
    category: "Film",
    description: "Lens falloff with movable centre, roundness, feather and colour.",
    keywords: "darken edges falloff",
    preview: "stilllife:0",
    handles: [{ x: "cx", y: "cy", label: "Centre" }],
    params: [
      hero("amount", "Amount", -1, 1, 0.55),
      hero("radius", "Radius", 0, 1.5, 0.55),
      hero("feather", "Feather", 0.01, 1.5, 0.6),
      range("roundness", "Roundness", 0, 1, 0.6),
      color("tint", "Colour", "#000000"),
      range("cx", "Centre X", 0, 1, 0.5),
      range("cy", "Centre Y", 0, 1, 0.5),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 d = vUv - vec2(u_cx, u_cy);
  d.x *= mix(1.0, aspect(), u_roundness);
  float r = length(d) * 1.4;
  float v = smoothstep(u_radius, u_radius + u_feather, r);
  vec3 o = u_amount >= 0.0 ? mix(c.rgb, u_tint, v * u_amount) : mix(c.rgb, vec3(1.0), v * -u_amount);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "light-leak",
    name: "Light leak",
    category: "Film",
    description: "Warm light fogging the film from an edge, drifting slowly over time.",
    keywords: "leak flare fog burn",
    preview: "beach:1",
    animated: true,
    params: [
      hero("amount", "Amount", 0, 1.5, 0.75),
      select("edge", "Edge", ["Left", "Right", "Top", "Bottom", "Corner"]),
      color("color1", "Colour A", "#FF4A1C"),
      color("color2", "Colour B", "#FFC46B"),
      range("size", "Size", 0.1, 1, 0.45),
      range("drift", "Drift speed", 0, 1, 0.25),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  int e = int(u_edge + 0.5);
  float d = e == 0 ? vUv.x : e == 1 ? 1.0 - vUv.x : e == 2 ? 1.0 - vUv.y : e == 3 ? vUv.y : length(vUv - vec2(0.0, 1.0)) * 0.8;
  float along = e < 2 ? vUv.y : vUv.x;
  float t = uTime * u_drift + uSeed;
  float n = sfbm(vec2(along * 2.0, t * 0.6)) * 0.25;
  float leak = smoothstep(u_size, 0.0, d + n);
  vec3 col = mix(u_color1, u_color2, sat(sfbm(vec2(along * 3.0 + 5.0, t)) + 0.5));
  fragColor = vec4(sat(blendScreen(c.rgb, col * leak * u_amount)), c.a);
}`),
  },
  {
    id: "dust-scratches",
    name: "Dust & scratches",
    category: "Film",
    description: "Projected film damage: specks, hairs and vertical scratches that flicker per frame.",
    keywords: "damage dirt hair scratch projector",
    preview: "dancer:1",
    animated: true,
    params: [hero("dust", "Dust", 0, 1, 0.5), hero("scratches", "Scratches", 0, 1, 0.4), range("hairs", "Hairs", 0, 1, 0.3), range("flicker", "Flicker", 0, 1, 0.2), select("polarity", "Polarity", ["Mixed", "Dark", "Light"])],
    passes: single(`
float hair(vec2 p, vec2 o, float a) {
  p -= o;
  p = rot(a) * p;
  float y = p.y + sin(p.x * 18.0 + a * 7.0) * 0.012;
  return smoothstep(0.0025, 0.0, abs(y)) * smoothstep(0.08, 0.0, abs(p.x));
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float f = floor(uTime * 18.0) + uSeed * 31.0;
  vec2 px = refCoord(vUv);
  vec2 g = floor(px / 6.0);
  float spec = step(1.0 - u_dust * 0.004, hash12(g + f * 7.13)) * smoothstep(0.5, 0.0, length(fract(px / 6.0) - 0.5));
  float sx = hash11(f * 0.37);
  float scratch = smoothstep(0.0015, 0.0, abs(vUv.x - sx - sin(vUv.y * 20.0 + f) * 0.002)) * step(0.55, hash11(f + 3.0)) * u_scratches;
  scratch += smoothstep(0.001, 0.0, abs(vUv.x - hash11(f * 1.7 + 9.0))) * step(0.8, hash11(f + 5.0)) * u_scratches;
  float h = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = f + float(i) * 13.0;
    if (hash11(fi * 0.71) < u_hairs) h += hair(vUv * vec2(aspect(), 1.0), hash22(vec2(fi, 2.0)) * vec2(aspect(), 1.0), hash11(fi) * 6.28);
  }
  float dmg = sat(spec + scratch + h);
  int pol = int(u_polarity + 0.5);
  float s = pol == 1 ? -1.0 : pol == 2 ? 1.0 : (hash11(f) > 0.5 ? 1.0 : -1.0);
  vec3 o = c.rgb + s * dmg * 0.8;
  o *= 1.0 + (hash11(f * 0.13) - 0.5) * u_flicker * 0.15;
  fragColor = vec4(sat(o), c.a);
}`),
  },
];
