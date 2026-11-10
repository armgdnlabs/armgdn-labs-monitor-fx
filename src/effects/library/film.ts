import { BLUR_FRAG } from "../../engine/glsl";
import { gradientLut } from "../../lib/textures";
import { color, gradient, group, hero, range, select, single, toggle, type EffectDef, type PassDef } from "../types";



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


/**
 * One film-look shader for every stock table. Each stock is 16 numbers:
 * contrast, saturation, fade, warmth | shadow tint rgb, grain | highlight tint rgb, grain size |
 * vignette, halation, mono (1 panchromatic, 2 orthochromatic), infrared mode.
 */
const FILM_LOOK = `
uniform vec4 uA;
uniform vec4 uB;
uniform vec4 uC;
uniform vec4 uD;
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 x = c.rgb;
  int ir = int(uD.w + 0.5);
  if (ir > 0) {
    // Infrared: chlorophyll reflects IR, so foliage (green-dominant) turns bright.
    float fol = sat((x.g - max(x.r, x.b)) * 3.0 + 0.15);
    if (ir == 1) x = vec3(x.g * 1.05 + fol * 0.65, x.r * 0.85, x.b * 0.9 + fol * 0.15);
    else if (ir == 2) x = vec3(x.g * 1.0 + fol * 0.35, x.r * 0.8 + fol * 0.25, x.b * 1.25);
    else if (ir == 3) x = vec3(x.g + fol * 0.55, x.g * 0.8 + fol * 0.4, x.b * 0.55);
    else if (ir == 4) x = vec3(dot(x, vec3(0.25, 1.05, -0.2)) + fol * 0.55);
    else x = vec3(x.g * 0.9 + fol * 0.5, x.r * 0.55, x.b * 1.1 + fol * 0.45);
  }
  if (uD.z > 0.5) x = vec3(uD.z > 1.5 ? dot(x, vec3(0.04, 0.5, 0.46)) : luma(x));
  x *= vec3(1.0 + uA.w * 0.12, 1.0 + uA.w * 0.02, 1.0 - uA.w * 0.14);
  x = mix(vec3(luma(x)), x, uA.y);
  // Film curve: contrast around a low pivot with a soft toe and shoulder.
  x = sat((x - 0.42) * uA.x + 0.42);
  x = mix(x, x * x * (3.0 - 2.0 * x), 0.35);
  float l = luma(x);
  x *= mix(uB.rgb, uC.rgb, smoothstep(0.15, 0.85, l));
  x = x * (1.0 - uA.z) + uA.z * vec3(0.9, 0.88, 0.86) * 0.35 + uA.z * 0.0;
  x += uA.z * 0.35 * (1.0 - l);
  if (uD.y > 0.0) {
    vec3 h = blur13(uTex0, vUv, refPx(18.0)).rgb;
    x = blendScreen(x, vec3(1.0, 0.25, 0.08) * smoothstep(0.6, 1.0, luma(h)) * uD.y);
  }
  float g = grainAt(refCoord(vUv), uC.w, floor(uTime * 24.0) / 24.0 + uSeed);
  x += g * uB.w * 0.07 * (1.0 - abs(l - 0.5));
  vec2 d = (vUv - 0.5) * vec2(aspect(), 1.0) / max(aspect(), 1.0);
  x *= 1.0 - uD.x * smoothstep(0.35, 0.95, length(d) * 1.35);
  fragColor = vec4(mix(c.rgb, sat(x), u_amount), c.a);
}`;

function lookUniforms(table: number[][], type: number) {
  const s = table[Math.max(0, Math.min(table.length - 1, Math.round(type)))];
  return { uA: s.slice(0, 4), uB: s.slice(4, 8), uC: s.slice(8, 12), uD: s.slice(12, 16) };
}

/** One star-filter streak; each pass adds its streak to the ones before it. */
const STAR_FRAG = `
uniform vec2 uDir;
uniform float uLength;
uniform float uWeight;
uniform float uFirst;
uniform float uFall;
void main() {
  vec3 acc = vec3(0.0);
  vec2 stp = uDir * uLength / 24.0 * vec2(1.0 / aspect(), 1.0);
  for (int i = -24; i <= 24; i++) {
    float t = float(i);
    acc += texture(uTex0, vUv + stp * t).rgb * exp(-abs(t) / (24.0 * uFall * 0.5));
  }
  vec3 prev = uFirst > 0.5 ? vec3(0.0) : texture(uTex1, vUv).rgb;
  fragColor = vec4(prev + acc / 24.0 * uWeight, 1.0);
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
    description: "Colour negative and slide stocks.",
    keywords: "film stock negative 35mm analog",
    params: [
      select("type", "Type", ["Portrait 160","Portrait 400","Gold 200","Consumer 400","Green 400","Pastel 400H","Vivid 100","Tungsten 800","Cine 500T","Cine 50D","Slide 50","Slide 100","Expired","Cross-processed","Bleach bypass"]),
      hero("amount", "Amount", 0, 1, 1),
    ],
    passes: single(FILM_LOOK, { uniforms: (v) => lookUniforms([[1,0.92,0.04,0.12,0.98,1,1.03,0.25,1.03,1,0.95,1,0.15,0.1,0,0],[1.05,0.95,0.05,0.15,0.97,1,1.04,0.35,1.04,1,0.94,1.1,0.2,0.15,0,0],[1.1,1.12,0.03,0.3,0.98,0.98,1,0.35,1.07,1,0.88,1.1,0.25,0.1,0,0],[1.15,1.18,0.02,0.18,0.96,1,1.02,0.45,1.05,1,0.92,1.2,0.25,0.1,0,0],[1.08,1.05,0.04,-0.05,0.95,1.04,0.98,0.45,1,1.03,0.95,1.2,0.2,0.1,0,0],[0.92,0.88,0.08,0.02,0.98,1.03,1.04,0.35,1.02,1.02,1,1.1,0.15,0.1,0,0],[1.2,1.3,0,0.1,0.97,0.99,1.04,0.2,1.03,1,0.95,0.9,0.2,0.05,0,0],[1.1,1.05,0.03,-0.35,0.95,1,1.08,0.5,1,1,1,1.3,0.2,0.6,0,0],[1.05,0.98,0.04,-0.2,0.94,1.02,1.08,0.45,1.04,1,0.94,1.2,0.2,0.35,0,0],[1.02,1,0.03,0.08,0.96,1.01,1.04,0.2,1.03,1,0.96,0.9,0.15,0.15,0,0],[1.3,1.4,0,0.05,0.94,0.98,1.08,0.15,1.02,1,0.98,0.8,0.3,0,0,0],[1.22,1.2,0,0,0.96,1,1.05,0.2,1,1,1,0.9,0.25,0,0,0],[0.9,0.8,0.12,0.25,1.05,0.95,1.08,0.6,1.05,1,0.85,1.4,0.35,0.1,0,0],[1.35,1.3,0.04,0,0.85,1.05,1.15,0.4,1.1,1.08,0.75,1.2,0.3,0.05,0,0],[1.4,0.45,0.02,0,0.98,1,1.02,0.5,1,1,1,1.2,0.3,0,0,0]], Number(v.type)) }),
  },
  {
    id: "vintage-film",
    name: "Vintage Film",
    category: "Film",
    description: "Aged prints and old processes.",
    keywords: "old faded retro print 70s",
    params: [
      select("type", "Type", ["Seventies","Sixties","Faded print","Sun bleached","Yellowed","Magenta cast","Teal & cream","Drugstore","Box camera"]),
      hero("amount", "Amount", 0, 1, 1),
    ],
    passes: single(FILM_LOOK, { uniforms: (v) => lookUniforms([[1.05,1.1,0.1,0.45,1.05,0.95,0.88,0.45,1.08,1,0.82,1.2,0.35,0.1,0,0],[0.95,0.85,0.12,0.3,1,1,0.95,0.5,1.06,1.02,0.9,1.3,0.4,0.05,0,0],[0.85,0.75,0.18,0.2,1.04,1,1.04,0.4,1.04,1,0.94,1.2,0.3,0,0,0],[0.8,0.6,0.22,0.3,1.06,1.02,0.96,0.35,1.04,1.03,0.92,1.1,0.25,0,0,0],[0.95,0.8,0.12,0.6,1.02,1,0.85,0.45,1.1,1.05,0.75,1.2,0.4,0,0,0],[0.95,0.9,0.12,0.15,1.08,0.9,1.05,0.45,1.06,0.95,1,1.2,0.35,0,0,0],[1,0.85,0.1,0.1,0.88,1.03,1.08,0.4,1.07,1.03,0.9,1.1,0.3,0.05,0,0],[1.1,1.05,0.06,0.25,0.98,1.02,0.98,0.6,1.05,1,0.9,1.5,0.35,0.1,0,0],[1.15,0.7,0.1,0.35,1.02,0.98,0.94,0.7,1.05,1,0.88,1.8,0.65,0,0,0]], Number(v.type)) }),
  },
  {
    id: "bw-film",
    name: "Black & White",
    category: "Film",
    description: "Black-and-white stocks and toning.",
    keywords: "monochrome silver gelatin film noir",
    params: [
      select("type", "Type", ["Classic 400","Grainy 400","Fine 100","Push 3200","Orthochromatic","Sepia toned","Selenium toned"]),
      hero("amount", "Amount", 0, 1, 1),
    ],
    passes: single(FILM_LOOK, { uniforms: (v) => lookUniforms([[1.25,0,0.03,0,1,1,1,0.45,1,1,1,1.2,0.2,0,1,0],[1.4,0,0.02,0,1,1,1,0.7,1,1,1,1.6,0.25,0,1,0],[1.15,0,0.02,0,1,1,1,0.2,1,1,1,0.8,0.15,0,1,0],[1.6,0,0,0,1,1,1,0.95,1,1,1,2.2,0.3,0,1,0],[1.35,0,0.02,0,1,1,1,0.4,1,1,1,1,0.2,0,2,0],[1.15,0,0.06,0,1.12,0.98,0.82,0.35,1.06,1,0.88,1.1,0.25,0,1,0],[1.2,0,0.04,0,0.94,0.96,1.06,0.35,1.03,1,0.98,1.1,0.2,0,1,0]], Number(v.type)) }),
  },
  {
    id: "infrared-film",
    name: "Infrared Film",
    category: "Film",
    description: "Infrared emulsions: foliage turns bright.",
    keywords: "ir false colour aerochrome",
    params: [
      select("type", "Type", ["False-colour","Blue sky IR","Gold IR","B&W IR","Purple IR"]),
      hero("amount", "Amount", 0, 1, 1),
    ],
    passes: single(FILM_LOOK, { uniforms: (v) => lookUniforms([[1.1,1.2,0.03,0,1,1,1,0.35,1,1,1,1.2,0.2,0.2,0,1],[1.15,1.1,0.02,-0.2,0.95,1,1.1,0.3,1,1,1,1.1,0.2,0.2,0,2],[1.1,1.1,0.03,0.4,1,1,0.9,0.35,1.08,1,0.8,1.2,0.2,0.2,0,3],[1.25,0,0.02,0,1,1,1,0.4,1,1,1,1.3,0.3,0.35,1,4],[1.1,1.15,0.03,-0.1,1,0.95,1.08,0.35,1.05,0.95,1.05,1.2,0.25,0.2,0,5]], Number(v.type)) }),
  },
  {
    id: "instant-film",
    name: "Instant Film",
    category: "Film",
    description: "Instant print chemistry.",
    keywords: "polaroid instant print integral",
    params: [
      select("type", "Type", ["Integral 600","SX-70","Peel-apart","Mini","Wide","Expired integral","Cold integral","Warm integral","Monochrome instant","Blue cast","Green cast","Faded","High key"]),
      hero("amount", "Amount", 0, 1, 1),
    ],
    passes: single(FILM_LOOK, { uniforms: (v) => lookUniforms([[0.95,0.95,0.08,0.15,0.96,1.02,1.05,0.2,1.05,1.02,0.94,1,0.35,0.1,0,0],[0.9,0.85,0.1,0.3,1.02,0.98,0.96,0.2,1.08,1.03,0.86,1,0.4,0.1,0,0],[1.05,1,0.06,0.05,0.95,1,1.06,0.25,1.03,1,0.97,1,0.3,0.05,0,0],[1.1,1.1,0.04,0.1,0.97,1,1.04,0.15,1.04,1,0.96,0.9,0.3,0.05,0,0],[1,1,0.05,0.08,0.98,1,1.03,0.2,1.03,1,0.97,1,0.25,0.05,0,0],[0.85,0.75,0.15,0.35,1.08,0.95,1.02,0.35,1.1,1,0.85,1.2,0.5,0.1,0,0],[0.95,0.9,0.08,-0.25,0.9,1.02,1.12,0.2,1,1.02,1.06,1,0.35,0.05,0,0],[0.95,1,0.08,0.4,1.04,0.98,0.92,0.2,1.1,1.03,0.85,1,0.35,0.1,0,0],[1.1,0,0.08,0,1,1,1.02,0.2,1.02,1,0.98,1,0.35,0,1,0],[0.95,0.9,0.1,-0.15,0.88,0.98,1.15,0.25,1,1.03,1.05,1,0.35,0.05,0,0],[0.95,0.9,0.1,0,0.9,1.08,0.95,0.25,1,1.04,0.95,1,0.35,0.05,0,0],[0.8,0.7,0.2,0.2,1.04,1,1.02,0.25,1.04,1,0.95,1,0.4,0,0,0],[0.85,0.9,0.12,0.1,1,1,1.02,0.15,1.02,1,0.98,0.9,0.2,0,0,0]], Number(v.type)) }),
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
      select("type", "Stock", ["Fine 50", "Portrait 160", "Portrait 400", "Gold 200", "Cine 500T", "Cine 50D", "Tri-X 400", "HP 800", "Delta 3200", "Super 8", "16 mm", "Push 1600", "Instant", "Expired", "Xerox", "Fine 100", "Cine 250D", "Expired 800"], 0),
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
  if (t == 15) return vec4(0.75, 0.22, 0.55, 0.5);
  if (t == 16) return vec4(1.0, 0.35, 0.65, 0.7);
  if (t == 17) return vec4(2.4, 0.9, 1.0, 1.45);
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
    description: "Highlights bleed back through the film base as a coloured halo.",
    keywords: "cinestill glow red halo highlights",
    params: [
      hero("threshold", "Threshold", 0, 1, 0.6),
      range("knee", "Knee", 0.01, 0.8, 0.25),
      range("boost", "Boost", 0, 1, 0.5),
      ...group("Diffusion", [range("local", "Local diffusion", 0.005, 0.2, 0.04, 0.005), range("global", "Global diffusion", 0, 0.4, 0.12, 0.005)]),
      hero("intensity", "Intensity", 0, 1, 0.7),
      hero("hue", "Hue", 0, 1, 0.5),
      range("background", "Background gain", 0, 1, 0.85),
      range("compensation", "Compensation", 0, 1, 0.5),
    ],
    passes: [
      { id: "bright", frag: BRIGHT_FRAG, inputs: ["input"], scale: 0.5, uniforms: (v) => ({ uThreshold: Number(v.threshold), uKnee: Number(v.knee), uTint: [1, 1, 1] }) },
      ...blurPair("a", "bright", 0.5, (v) => Number(v.local) * 1.2),
      ...blurPair("b", "av", 0.25, (v) => Math.max(Number(v.global), 0.002) * 1.2),
      {
        id: "out",
        inputs: ["input", "av", "bv"],
        frag: `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 h = texture(uTex1, vUv).rgb * (1.0 + u_boost * 2.0) + texture(uTex2, vUv).rgb * (0.6 + u_boost);
  // Hue 0.5 is the classic red-orange; the slider walks the halo around the wheel.
  vec3 tint = hsv2rgb(vec3(fract(0.02 + (u_hue - 0.5) * 0.6), 0.92, 1.0));
  vec3 glow = tint * luma(h) * u_intensity * 1.8;
  // Compensation darkens the source where the halo lands so total light stays similar.
  vec3 base = c.rgb * mix(1.0, u_background, luma(h)) * (1.0 - u_compensation * luma(glow) * 0.4);
  fragColor = vec4(sat(blendScreen(base, glow)), c.a);
}`,
      },
    ],
  },
  {
    id: "bloom",
    name: "Bloom",
    category: "Film",
    description: "HDR-style glow from bright areas, with a tonemapper.",
    keywords: "glow dreamy light bleed",
    params: [
      hero("threshold", "Threshold", 0.1, 2, 0.8),
      hero("intensity", "Intensity", 0, 5, 1.5),
      range("knee", "Knee", 0, 2, 0.4),
      hero("factor", "Bloom factor", 0, 1, 0.6),
      select("blend", "Blend mode", ["Add", "Screen"]),
      select("tonemapper", "Tonemapper", ["None", "Reinhard", "ACES", "Filmic", "Uncharted", "Lottes", "Hable soft", "Clamp"]),
    ],
    passes: [
      { id: "bright", frag: BRIGHT_FRAG, inputs: ["input"], scale: 0.5, uniforms: (v) => ({ uThreshold: Number(v.threshold) * 0.5, uKnee: Math.max(Number(v.knee) * 0.25, 0.01), uTint: [1, 1, 1] }) },
      ...blurPair("a", "bright", 0.5, () => 0.012),
      ...blurPair("b", "av", 0.25, () => 0.035),
      ...blurPair("c", "bv", 0.125, () => 0.09),
      {
        id: "out",
        inputs: ["input", "av", "bv", "cv"],
        frag: `
vec3 tm(vec3 x, int t) {
  if (t == 1) return x / (1.0 + x);
  if (t == 2) return sat((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
  if (t == 3) { x = max(vec3(0.0), x - 0.004); return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06); }
  if (t == 4) { vec3 a = ((x * (0.15 * x + 0.05) + 0.004) / (x * (0.15 * x + 0.5) + 0.06)) - 0.0667; return a / 0.8; }
  if (t == 5) return x / (1.0 + luma(x));
  if (t == 6) return 1.0 - exp(-x * 1.2);
  return sat(x);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  // The bloom factor tilts energy from the tight octave to the wide ones.
  float f = u_factor;
  vec3 b = texture(uTex1, vUv).rgb * (1.0 - f) + texture(uTex2, vUv).rgb * 0.8 + texture(uTex3, vUv).rgb * f * 1.4;
  vec3 lin = srgb2lin(c.rgb);
  vec3 g = srgb2lin(b) * u_intensity * 0.4;
  vec3 o = u_blend > 0.5 ? 1.0 - (1.0 - lin) * (1.0 - g) : lin + g;
  int t = int(u_tonemapper + 0.5);
  o = t == 0 ? o : tm(o, t);
  fragColor = vec4(sat(lin2srgb(o)), c.a);
}`,
      },
    ],
  },
  {
    id: "star-glow",
    name: "Star glow",
    category: "Film",
    description: "Cross-screen filter streaks from highlights.",
    keywords: "star filter cross screen sparkle streak",
    params: [
      hero("threshold", "Threshold", 0, 4, 0.5),
      range("knee", "Knee", 0, 2, 0.05),
      hero("intensity", "Intensity", 0, 4, 0.5),
      range("boost", "Highlight boost", 0, 1, 0),
      hero("streaks", "Streaks", 1, 8, 3, 1),
      range("samples", "Sample count", 10, 60, 30, 1),
      range("length", "Length", 0.5, 200, 80, 0.1),
      range("alternate", "Alternate", 0.1, 1, 1),
      range("falloff", "Falloff", 0.1, 1.5, 0.45),
      range("angle", "Angle", -180, 180, 0, 1, { unit: "°" }),
      ...group("Colour", [range("colorize", "Colorize", 0, 1, 1), gradient("ramp", "Gradient map", "#F4F8FF@0,#FFE3B0@1"), range("shift", "Gradient shift", -1, 1, 0)]),
    ],
    aux: (v) => [gradientLut(String(v.ramp))],
    passes: [
      { id: "bright", frag: BRIGHT_FRAG, inputs: ["input"], scale: 0.5, uniforms: (v) => ({ uThreshold: 0.7 + Number(v.threshold) * 0.075, uKnee: Math.max(Number(v.knee) * 0.25, 0.01), uTint: [1, 1, 1] }) },
      ...Array.from({ length: 8 }, (_, i): PassDef => ({
        id: `s${i}`,
        frag: STAR_FRAG,
        inputs: ["bright", i === 0 ? "bright" : `s${i - 1}`],
        scale: 0.5,
        uniforms: (v) => {
          const n = Math.max(1, Math.round(Number(v.streaks)));
          const a = (Number(v.angle) * Math.PI) / 180 + (i * Math.PI) / n;
          // Alternate shortens every second streak, like a 4+4 point filter.
          const len = (Number(v.length) / 1080) * (i % 2 ? Number(v.alternate) : 1);
          return { uDir: [Math.cos(a), Math.sin(a)], uLength: len, uWeight: i < n ? 1 : 0, uFirst: i === 0 ? 1 : 0, uFall: Number(v.falloff) };
        },
      })),
      {
        id: "out",
        inputs: ["input", "s7"],
        frag: `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 s = texture(uTex1, vUv).rgb;
  float l = luma(s);
  vec3 col = mix(s, lut1(uAux0, fract(sat(l) + u_shift + 1.0), 0.0, 1.0) * l * 1.5, u_colorize);
  col *= u_intensity * 0.6 * (1.0 + u_boost * 3.0);
  fragColor = vec4(sat(blendScreen(c.rgb, col)), c.a);
}`,
      },
    ],
  },
  {
    id: "vignette",
    name: "Vignette",
    category: "Film",
    description: "Edge darkening (or lightening) with shapes and blend types.",
    keywords: "edges dark corners frame",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [
      select("shape", "Border shape", ["Ellipse", "Circle", "Rectangle", "Rounded", "Diamond", "Star"]),
      hero("size", "Size", 0.05, 2, 0.65),
      range("anamorphism", "Anamorphism", 0.25, 4, 1),
      range("rotation", "Rotation", -180, 180, 0, 0.1, { unit: "°" }),
      range("cx", "Center X", 0, 1, 0.5),
      range("cy", "Center Y", 0, 1, 0.5),
      hero("softness", "Softness", 0, 1, 1),
      range("transparency", "Transparency", 0, 1, 1),
      color("color", "Color", "#000000"),
      select("composite", "Composite type", ["Normal", "Multiply", "Screen", "Overlay", "Soft light", "Add", "Color burn", "Color dodge", "Luminosity", "Exposure"]),
      hero("blend", "Blend", 0, 1, 1),
      toggle("dither", "Dithering", 1),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 p = (vUv - vec2(u_cx, u_cy)) * vec2(aspect(), 1.0);
  p = rot(radians(u_rotation)) * p;
  p.x /= u_anamorphism;
  int s = int(u_shape + 0.5);
  float d;
  if (s == 0) d = length(p * vec2(1.0 / max(aspect(), 1.0), 1.0)) * 1.6;
  else if (s == 1) d = length(p) * 1.6;
  else if (s == 2) d = max(abs(p.x) / aspect(), abs(p.y)) * 2.0;
  else if (s == 3) { vec2 q = abs(p) / vec2(aspect(), 1.0) * 2.0; d = pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25); }
  else if (s == 4) d = (abs(p.x) / aspect() + abs(p.y)) * 1.5;
  else { float a = atan(p.y, p.x); d = length(p) * 1.6 * (1.0 + 0.25 * cos(a * 5.0)); }
  float m = smoothstep(u_size, u_size + max(u_softness, 0.002) * 1.2, d);
  if (u_dither > 0.5) m += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  m *= u_transparency;
  int k = int(u_composite + 0.5);
  vec3 v = u_color;
  vec3 o;
  if (k == 0) o = mix(c.rgb, v, m);
  else if (k == 1) o = c.rgb * mix(vec3(1.0), v, m);
  else if (k == 2) o = blendScreen(c.rgb, v * m);
  else if (k == 3) o = mix(c.rgb, blendOverlay(c.rgb, v), m);
  else if (k == 4) o = mix(c.rgb, blendSoftLight(c.rgb, v), m);
  else if (k == 5) o = c.rgb + v * m;
  else if (k == 6) o = mix(c.rgb, 1.0 - (1.0 - c.rgb) / max(v, 0.01), m);
  else if (k == 7) o = mix(c.rgb, c.rgb / max(1.0 - v, 0.01), m);
  else if (k == 8) o = mix(c.rgb, c.rgb * (luma(v) / max(luma(c.rgb), 1e-3)), m);
  else o = c.rgb * exp2(-m * 3.0 * (1.0 - luma(v)) + m * 3.0 * luma(v));
  fragColor = vec4(sat(mix(c.rgb, o, u_blend)), c.a);
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
