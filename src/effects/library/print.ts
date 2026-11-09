import { angle, color, group, hero, range, select, single, toggle, type EffectDef } from "../types";

/** Halftone dot shapes. local is -0.5..0.5 in cell units; negative result = inside the dot. */
const SCREEN = `
float dotShape(vec2 local, float v, int shape) {
  if (shape == 1) return length(local * vec2(1.0, 1.6)) - sqrt(v) * 0.62;
  if (shape == 2) return max(abs(local.x), abs(local.y)) - sqrt(v) * 0.5;
  if (shape == 3) return abs(local.y) - v * 0.5;
  if (shape == 4) return min(abs(local.x), abs(local.y)) - v * 0.26;
  return length(local) - sqrt(v) * 0.5642;
}
`;

export const print: EffectDef[] = [
  {
    id: "halftone",
    name: "Halftone screen",
    category: "Print",
    description: "Offset-print screens: CMYK at classic angles or a single ink, with dot shapes, gain and misregistration.",
    keywords: "cmyk dots screen print comic newspaper",
    preview: "sky:1",
    params: [
      select("mode", "Mode", ["CMYK", "Mono", "Duotone"]),
      select("shape", "Dot", ["Round", "Ellipse", "Square", "Line", "Cross"]),
      hero("cell", "Screen size", 2, 60, 9, 0.5, { unit: "px" }),
      angle("angle", "Screen angle", 45),
      hero("gain", "Dot gain", -0.5, 1, 0.15),
      range("gcr", "Black generation", 0, 1, 0.7),
      range("misreg", "Misregistration", 0, 6, 0.8, 0.1, { unit: "px" }),
      ...group("Inks", [color("ink", "Ink", "#0A0A0A"), color("ink2", "Second ink", "#D3202A"), color("paper", "Paper", "#F4EFE6")]),
      range("texture", "Paper texture", 0, 1, 0.3),
    ],
    passes: single(SCREEN + `
vec4 toCmyk(vec3 c, float gcr) {
  float k = (1.0 - max(c.r, max(c.g, c.b))) * gcr;
  vec3 cmy = (1.0 - c - k) / max(1.0 - k, 1e-3);
  return vec4(sat(cmy), k);
}
float ink(vec2 uv, float cellPx, float ang, int ch, int shape, float gain) {
  vec2 px = uv * uRes;
  mat2 r = rot(ang);
  vec2 p = r * px / cellPx;
  vec2 cell = floor(p) + 0.5;
  vec2 local = p - cell;
  vec2 cpx = transpose(r) * (cell * cellPx);
  vec3 c = texture(uTex0, cpx / uRes).rgb;
  float v;
  if (ch < 4) { vec4 k = toCmyk(c, u_gcr); v = ch == 0 ? k.x : ch == 1 ? k.y : ch == 2 ? k.z : k.w; }
  else if (ch == 4) v = 1.0 - luma(c);
  else v = sat((1.0 - luma(c)) * 1.6 - 0.6);
  v = sat(v + gain * v * (1.0 - v));
  float d = dotShape(local, v, shape) * cellPx;
  float w = max(fwidth(d), 0.6);
  return 1.0 - smoothstep(-w, w, d);
}
void main() {
  float cs = u_cell * refScale();
  int shape = int(u_shape + 0.5);
  int m = int(u_mode + 0.5);
  float a = radians(u_angle);
  vec2 mr = refPx(u_misreg);
  vec3 paper = u_paper * (1.0 - u_texture * 0.12 + paperTex(refCoord(vUv)) * u_texture * 0.12);
  vec3 o = paper;
  if (m == 0) {
    float c = ink(vUv + mr * vec2(1.0, 0.3), cs, a - radians(30.0), 0, shape, u_gain);
    float mg = ink(vUv - mr * vec2(0.4, 1.0), cs, a + radians(30.0), 1, shape, u_gain);
    float y = ink(vUv + mr * vec2(-0.7, 0.6), cs, a - radians(45.0), 2, shape, u_gain);
    float k = ink(vUv, cs, a, 3, shape, u_gain);
    o *= mix(vec3(1.0), vec3(0.0, 0.68, 0.94), c);
    o *= mix(vec3(1.0), vec3(0.93, 0.05, 0.55), mg);
    o *= mix(vec3(1.0), vec3(1.0, 0.93, 0.0), y);
    o *= mix(vec3(1.0), vec3(0.08), k);
  } else if (m == 1) {
    o = mix(paper, u_ink, ink(vUv, cs, a, 4, shape, u_gain));
  } else {
    float i1 = ink(vUv + mr, cs, a + radians(30.0), 4, shape, u_gain);
    float i2 = ink(vUv, cs, a, 5, shape, u_gain);
    o = paper * mix(vec3(1.0), u_ink2, i1) * mix(vec3(1.0), u_ink, i2);
  }
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "risograph",
    name: "Risograph",
    category: "Print",
    description: "Stencil-duplicator print: the image is separated into 2–3 spot inks, grained and misregistered.",
    keywords: "riso spot color zine fluorescent",
    preview: "flower:1",
    params: [
      select("inks", "Inks", ["Two", "Three"]),
      ...group("Inks", [color("ink1", "Ink 1", "#FF48B0"), color("ink2", "Ink 2", "#0078BF"), color("ink3", "Ink 3", "#FFE800"), color("paper", "Paper", "#F2EDE4")]),
      hero("grain", "Grain", 0, 1, 0.55),
      hero("misreg", "Misregistration", 0, 20, 4, 0.1, { unit: "px" }),
      select("screen", "Screen", ["Grain", "Halftone", "Solid"]),
      range("cell", "Halftone size", 2, 20, 6, 0.5, { unit: "px" }),
      range("density", "Ink density", 0.3, 1.5, 1),
    ],
    passes: single(`
vec3 densities(vec3 c, vec3 i1, vec3 i2, vec3 i3, bool three) {
  vec3 A = 1.0 - c;
  vec3 a = 1.0 - i1; vec3 b = 1.0 - i2; vec3 d = 1.0 - i3;
  if (!three) {
    float aa = dot(a, a), ab = dot(a, b), bb = dot(b, b);
    float det = aa * bb - ab * ab;
    float x = (dot(A, a) * bb - dot(A, b) * ab) / max(det, 1e-4);
    float y = (dot(A, b) * aa - dot(A, a) * ab) / max(det, 1e-4);
    return vec3(sat(x), sat(y), 0.0);
  }
  mat3 M = mat3(a, b, d);
  float det = determinant(M);
  if (abs(det) < 1e-4) return vec3(sat(dot(A, a) / dot(a, a)), 0.0, 0.0);
  vec3 s = inverse(M) * A;
  return sat(s);
}
float screenIt(float v, vec2 uv, float k, float salt) {
  int s = int(u_screen + 0.5);
  vec2 px = refCoord(uv);
  if (s == 2) return v;
  if (s == 1) {
    vec2 p = rot(0.26 + k) * px / u_cell;
    vec2 l = fract(p) - 0.5;
    float d = length(l) - sqrt(v) * 0.5642;
    return 1.0 - smoothstep(-0.08, 0.08, d);
  }
  float n = hash12(floor(px * 0.9) + salt) * 0.65 + vnoise(px * 0.35 + salt) * 0.35;
  return smoothstep(n - 0.12 * (1.0 - u_grain) - 0.02, n + 0.02, v);
}
void main() {
  bool three = u_inks > 0.5;
  vec2 mr = refPx(u_misreg);
  vec3 d1 = densities(texture(uTex0, vUv).rgb, u_ink1, u_ink2, u_ink3, three);
  vec3 d2 = densities(texture(uTex0, vUv - mr * vec2(1.0, -0.6)).rgb, u_ink1, u_ink2, u_ink3, three);
  vec3 d3 = densities(texture(uTex0, vUv + mr * vec2(0.5, 1.0)).rgb, u_ink1, u_ink2, u_ink3, three);
  float a = screenIt(sat(d1.x * u_density), vUv, 0.0, 1.0 + uSeed);
  float b = screenIt(sat(d2.y * u_density), vUv - mr * vec2(1.0, -0.6), 0.5, 7.0 + uSeed);
  float c = three ? screenIt(sat(d3.z * u_density), vUv + mr * vec2(0.5, 1.0), 1.0, 13.0 + uSeed) : 0.0;
  vec3 paper = u_paper * (0.96 + paperTex(refCoord(vUv)) * 0.08);
  vec3 o = paper * mix(vec3(1.0), u_ink1, a) * mix(vec3(1.0), u_ink2, b) * mix(vec3(1.0), u_ink3, c);
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "paper-scan",
    name: "Paper scan",
    category: "Print",
    description: "A print run through a flatbed: paper fibre, toner speckle, uneven lamp and soft focus.",
    keywords: "scanner scan paper texture print",
    preview: "sky:2",
    params: [
      hero("paper", "Paper", 0, 1, 0.6),
      hero("toner", "Toner noise", 0, 1, 0.4),
      range("lamp", "Uneven lamp", 0, 1, 0.35),
      range("soft", "Softness", 0, 1, 0.3),
      range("fade", "Ink fade", 0, 1, 0.25),
      color("paperColor", "Paper colour", "#EFE9DE"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  vec3 c = mix(texture(uTex0, vUv).rgb, blur13(uTex0, vUv, refPx(2.5)).rgb, u_soft);
  c = mix(c, vec3(1.0), u_fade * 0.35);
  float f = paperTex(px);
  vec3 paper = u_paperColor * (0.9 + f * 0.2);
  vec3 o = mix(c, c * paper, u_paper);
  float speck = smoothstep(0.92, 1.0, hash12(floor(px * 0.7) + uSeed)) * u_toner;
  o -= speck * 0.35 * (1.0 - luma(c) * 0.5);
  o += (vnoise(px * 0.2) - 0.5) * u_toner * 0.08;
  float lamp = 1.0 - u_lamp * 0.25 * (smoothstep(0.3, 1.0, vUv.x) + 0.3 * sin(vUv.y * 3.0 + uSeed));
  o *= lamp;
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "paper-cutout",
    name: "Paper cutout",
    category: "Print",
    description: "Stacked cut-paper layers: posterised tones, each casting a soft shadow on the one below.",
    keywords: "papercraft layers collage shadow",
    preview: "stilllife:1",
    params: [
      hero("layers", "Layers", 2, 10, 5, 1),
      hero("shadow", "Shadow", 0, 1, 0.6),
      angle("light", "Light angle", 135),
      range("depth", "Depth", 1, 20, 6, 0.5, { unit: "px" }),
      range("smooth", "Edge smoothing", 0, 12, 4, 0.5, { unit: "px" }),
      range("texture", "Paper texture", 0, 1, 0.5),
      select("colorMode", "Colours", ["Source", "Monochrome", "Warm paper"]),
    ],
    passes: single(`
float level(vec2 uv) {
  float l = luma(blur13(uTex0, uv, refPx(u_smooth)).rgb);
  return floor(l * u_layers) / u_layers;
}
void main() {
  float lv = level(vUv);
  vec2 dir = vec2(cos(radians(u_light)), sin(radians(u_light)));
  float sh = 0.0;
  for (int i = 1; i <= 6; i++) {
    float d = float(i) / 6.0;
    float l2 = level(vUv + dir * refPx(u_depth) * d);
    sh += step(lv + 0.001, l2) * (1.0 - d * 0.5);
  }
  sh = sat(sh / 4.0);
  vec3 src = blur13(uTex0, vUv, refPx(u_smooth * 2.0)).rgb;
  vec3 pc = floor(src * (u_layers - 1.0) + 0.5) / (u_layers - 1.0);
  int m = int(u_colorMode + 0.5);
  vec3 col = m == 0 ? mix(vec3(lv), pc, 0.75) * (0.75 + lv * 0.35) : m == 1 ? vec3(0.25 + lv * 0.75) : mix(vec3(0.42, 0.24, 0.2), vec3(0.98, 0.94, 0.86), lv);
  float edge = step(level(vUv + refPx(1.5) * dir), lv - 0.001);
  col += edge * 0.12;
  col *= 1.0 - u_texture * 0.15 + paperTex(refCoord(vUv) * 1.5) * u_texture * 0.15;
  col *= 1.0 - sh * u_shadow * 0.8;
  fragColor = vec4(sat(col), 1.0);
}`),
  },
  {
    id: "ink-bleed",
    name: "Ink bleed",
    category: "Print",
    description: "Ink soaking into absorbent paper: blotted, feathered edges around a hard threshold.",
    keywords: "blot spread wet ink stain",
    preview: "tree:0",
    params: [
      hero("threshold", "Threshold", 0, 1, 0.5),
      hero("bleed", "Bleed", 0, 30, 8, 0.5, { unit: "px" }),
      range("feather", "Feathering", 0, 1, 0.5),
      color("ink", "Ink", "#141414"),
      color("paper", "Paper", "#F1ECE2"),
      toggle("invert", "Invert"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  float n = sfbm(px * 0.02 + uSeed) * 0.5 + sfbm(px * 0.12) * 0.25 * u_feather;
  vec2 off = vec2(sfbm(px * 0.03 + 5.0), sfbm(px * 0.03 + 9.0)) * refPx(u_bleed * 0.6);
  float l = luma(blur13(uTex0, vUv + off, refPx(u_bleed)).rgb);
  if (u_invert > 0.5) l = 1.0 - l;
  float edge = l - u_threshold + n * 0.25;
  float inkAmt = 1.0 - smoothstep(-0.02, 0.02, edge);
  float halo = (1.0 - smoothstep(-0.08, 0.12, edge)) * 0.25 * u_feather;
  vec3 paper = u_paper * (0.95 + paperTex(px) * 0.1);
  fragColor = vec4(mix(paper, u_ink, sat(inkAmt + halo)), 1.0);
}`),
  },
  {
    id: "emboss",
    name: "Emboss",
    category: "Print",
    description: "Relief from luminance lit from a chosen angle; grey plate, tinted or over the colour.",
    keywords: "relief stamp raised lighting",
    preview: "sculpture:0",
    params: [
      hero("depth", "Depth", 0, 10, 3),
      angle("light", "Light angle", 135),
      range("radius", "Radius", 0.5, 6, 1.2, 0.1, { unit: "px" }),
      select("output", "Output", ["Plate", "Over colour", "Tinted"]),
      color("tint", "Tint", "#B9B3A8"),
    ],
    passes: single(`
void main() {
  vec2 t = refPx(u_radius);
  float hx = luma(texture(uTex0, vUv + vec2(t.x, 0.0)).rgb) - luma(texture(uTex0, vUv - vec2(t.x, 0.0)).rgb);
  float hy = luma(texture(uTex0, vUv + vec2(0.0, t.y)).rgb) - luma(texture(uTex0, vUv - vec2(0.0, t.y)).rgb);
  vec3 n = normalize(vec3(-hx * u_depth, -hy * u_depth, 0.25));
  vec3 L = normalize(vec3(cos(radians(u_light)), sin(radians(u_light)), 0.7));
  float sh = dot(n, L);
  vec3 c = texture(uTex0, vUv).rgb;
  int m = int(u_output + 0.5);
  vec3 o = m == 0 ? vec3(0.5 + (sh - L.z * 0.6) * 0.8) : m == 1 ? blendOverlay(c, vec3(sat(0.5 + (sh - L.z * 0.6)))) : u_tint * (0.55 + (sh - L.z * 0.6) * 0.9);
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "bevel",
    name: "Bevel",
    category: "Print",
    description: "Rounded relief with a reflective material: chrome, gold, plastic or stone.",
    keywords: "chrome metal 3d relief y2k liquid",
    preview: "vase:0",
    params: [
      select("material", "Material", ["Chrome", "Gold", "Plastic", "Stone"]),
      hero("depth", "Depth", 0, 20, 7),
      hero("softness", "Softness", 0.5, 20, 5, 0.1, { unit: "px" }),
      angle("light", "Light angle", 120),
      range("mix", "Mix", 0, 1, 1),
      range("threshold", "Shape threshold", 0, 1, 0),
    ],
    passes: single(`
float height(vec2 uv) {
  float l = luma(blur13(uTex0, uv, refPx(u_softness)).rgb);
  return u_threshold > 0.0 ? smoothstep(u_threshold - 0.15, u_threshold + 0.15, l) : l;
}
void main() {
  vec2 t = refPx(u_softness * 0.5 + 0.5);
  float hx = height(vUv + vec2(t.x, 0.0)) - height(vUv - vec2(t.x, 0.0));
  float hy = height(vUv + vec2(0.0, t.y)) - height(vUv - vec2(0.0, t.y));
  vec3 n = normalize(vec3(-hx * u_depth, -hy * u_depth, 1.0));
  vec3 L = normalize(vec3(cos(radians(u_light)), sin(radians(u_light)), 0.8));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-V, n);
  float diff = sat(dot(n, L));
  float spec = pow(sat(dot(reflect(-L, n), V)), 40.0);
  int m = int(u_material + 0.5);
  vec3 c = texture(uTex0, vUv).rgb;
  vec3 o;
  if (m == 0 || m == 1) {
    float env = R.y * 0.5 + 0.5;
    vec3 sky = m == 0 ? mix(vec3(0.05, 0.06, 0.08), vec3(0.95, 0.97, 1.0), smoothstep(0.35, 0.75, env)) : mix(vec3(0.25, 0.12, 0.02), vec3(1.0, 0.85, 0.45), smoothstep(0.3, 0.8, env));
    sky += sin(R.x * 9.0 + R.y * 4.0) * 0.08;
    o = sky + spec * 1.2;
  } else if (m == 2) o = c * (0.35 + diff * 0.75) + spec * 0.8;
  else o = vec3(0.6, 0.58, 0.55) * (0.3 + diff * 0.8) * (0.85 + fbm(refCoord(vUv) * 0.05) * 0.3);
  float mask = u_threshold > 0.0 ? height(vUv) : 1.0;
  fragColor = vec4(mix(c, sat(o), u_mix * mask), 1.0);
}`),
  },
  {
    id: "photocopy",
    name: "Photocopy",
    category: "Print",
    description: "Generation-loss photocopier: crushed contrast, toner grit, drum streaks and grey edges.",
    keywords: "xerox copy zine punk toner",
    preview: "man:2",
    params: [
      hero("contrast", "Contrast", 1, 6, 3),
      hero("threshold", "Threshold", 0, 1, 0.5),
      range("toner", "Toner grit", 0, 1, 0.5),
      range("streaks", "Drum streaks", 0, 1, 0.35),
      range("generation", "Generations", 0, 1, 0.3),
      color("tonerColor", "Toner", "#111111"),
      color("paper", "Paper", "#F2F0EB"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  vec2 uv = vUv + vec2(sin(vUv.y * 9.0 + uSeed) * 0.0015, 0.0) * u_generation;
  vec3 c = mix(texture(uTex0, uv).rgb, blur13(uTex0, uv, refPx(1.5)).rgb, u_generation);
  float l = luma(c);
  l = sat((l - u_threshold) * u_contrast + 0.5);
  float grit = (hash12(floor(px * 1.3) + uSeed) - 0.5) * u_toner * 0.6 + (vnoise(px * 0.08) - 0.5) * u_toner * 0.3;
  l = smoothstep(0.35, 0.65, l + grit);
  float streak = smoothstep(0.75, 1.0, vnoise(vec2(px.x * 0.05, 0.0) + uSeed * 3.0)) * u_streaks;
  float edge = smoothstep(0.08, 0.0, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y))) * u_generation;
  float inkAmt = sat(1.0 - l + streak * 0.5 + edge * 0.6);
  fragColor = vec4(mix(u_paper, u_tonerColor, inkAmt), 1.0);
}`),
  },
  {
    id: "stamp",
    name: "Print stamp",
    category: "Print",
    description: "Rubber-stamp impression: uneven ink coverage, eroded edges and pressure falloff.",
    keywords: "rubber stamp ink impression woodcut",
    preview: "bw:3",
    params: [
      hero("threshold", "Threshold", 0, 1, 0.55),
      hero("wear", "Wear", 0, 1, 0.5),
      range("pressure", "Uneven pressure", 0, 1, 0.4),
      color("ink", "Ink", "#2A2A2A"),
      color("paper", "Paper", "#F4F1EA"),
      toggle("invert", "Invert"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  float l = luma(texture(uTex0, vUv).rgb);
  if (u_invert > 0.5) l = 1.0 - l;
  float inkMask = 1.0 - smoothstep(u_threshold - 0.03, u_threshold + 0.03, l + (sfbm(px * 0.08 + uSeed) * 0.12) * u_wear);
  float cover = smoothstep(0.15, 0.6, vnoise(px * 0.012 + uSeed) + 0.4 - u_pressure * 0.4 * length(vUv - 0.4));
  float pores = 1.0 - step(1.0 - u_wear * 0.18, hash12(floor(px * 0.8))) * step(0.45, vnoise(px * 0.08));
  float amt = inkMask * mix(1.0, cover, u_pressure) * mix(1.0, pores, u_wear);
  vec3 paper = u_paper * (0.96 + paperTex(px) * 0.08);
  fragColor = vec4(mix(paper, u_ink, amt * 0.95), 1.0);
}`),
  },
  {
    id: "cyanotype",
    name: "Cyanotype",
    category: "Print",
    description: "Sun print in Prussian blue on cotton paper, with brushed emulsion edges.",
    keywords: "blueprint sun print prussian blue alternative process",
    preview: "woman:4",
    params: [
      hero("exposure", "Exposure", -1, 1, 0.1),
      hero("contrast", "Contrast", 0.5, 2.5, 1.3),
      range("brush", "Brushed edge", 0, 1, 0.4),
      range("texture", "Paper texture", 0, 1, 0.5),
      color("blue", "Blue", "#0B2E6B"),
      color("paper", "Paper", "#ECEBE4"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  float l = sat((luma(texture(uTex0, vUv).rgb) - 0.5) * u_contrast + 0.5 + u_exposure * 0.3);
  vec3 col = mix(u_blue, mix(vec3(0.55, 0.72, 0.85), u_paper, 0.6), smoothstep(0.0, 1.0, l));
  vec2 e = min(vUv, 1.0 - vUv) * vec2(aspect(), 1.0);
  float edge = smoothstep(0.0, 0.06, min(e.x, e.y) + sfbm(vec2(px.x * 0.004, px.y * 0.05)) * 0.05);
  col = mix(u_paper, col, mix(1.0, edge, u_brush));
  col *= 1.0 - u_texture * 0.1 + paperTex(px) * u_texture * 0.1;
  fragColor = vec4(sat(col), 1.0);
}`),
  },
  {
    id: "receipt",
    name: "Receipt",
    category: "Print",
    description: "Thermal printer output: coarse dither, faded heat banding and a torn paper edge.",
    keywords: "thermal printer till slip fax",
    preview: "dancer:4",
    params: [
      hero("dots", "Print width", 96, 576, 384, 1, { unit: "dots" }),
      hero("heat", "Print heat", 0.3, 1.5, 0.9),
      range("banding", "Banding", 0, 1, 0.4),
      range("fade", "Fade", 0, 1, 0.2),
      toggle("torn", "Torn edges", 1),
    ],
    passes: single(`
void main() {
  float ps = uRes.x / u_dots;
  vec2 cell = floor(vUv * uRes / ps);
  vec3 c = texture(uTex0, (cell + 0.5) * ps / uRes).rgb;
  float l = luma(c);
  float band = (vnoise(vec2(0.0, cell.y * 0.05 + uSeed)) - 0.5) * u_banding * 0.4;
  float heat = (1.0 - l) * u_heat + band;
  float on = step(bayer8(cell) * 0.9 + 0.05, heat);
  vec3 ink = mix(vec3(0.08), vec3(0.35), u_fade);
  vec3 paper = vec3(0.97, 0.965, 0.95) * (0.97 + hash12(cell) * 0.03);
  vec3 o = mix(paper, ink, on);
  if (u_torn > 0.5) {
    float edgeT = 0.02 + abs(fract(vUv.x * 30.0) - 0.5) * 0.02 + hash11(floor(vUv.x * 60.0)) * 0.006;
    if (vUv.y > 1.0 - edgeT || vUv.y < edgeT) o = vec3(0.05);
  }
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "crumpled-paper",
    name: "Crumpled paper",
    category: "Print",
    description: "The image printed on paper that was crumpled and flattened again, lit from above.",
    keywords: "wrinkled creased folded paper texture",
    preview: "flower:2",
    params: [hero("creases", "Creases", 2, 30, 9, 0.5), hero("depth", "Depth", 0, 2, 0.8), angle("light", "Light angle", 120), range("folds", "Hard folds", 0, 1, 0.3), color("paperTint", "Paper tint", "#F3EEE5"), range("inkFade", "Ink fade", 0, 1, 0.15)],
    passes: single(`
float creaseH(vec2 p) {
  float h = 0.0;
  float a = 1.0;
  for (int i = 0; i < 3; i++) {
    vec2 w = worley(p);
    h += w.x * a;
    p = p * 2.1 + 3.7;
    a *= 0.45;
  }
  return h;
}
void main() {
  vec2 p = vUv * vec2(aspect(), 1.0) * u_creases + uSeed;
  float e = 0.01;
  float h = creaseH(p);
  vec2 g = vec2(creaseH(p + vec2(e, 0.0)) - h, creaseH(p + vec2(0.0, e)) - h) / e;
  float fold = abs(fract(dot(vUv, vec2(0.7, 0.3)) * 2.0 + 0.5) - 0.5);
  g += vec2(0.7, 0.3) * sign(fract(dot(vUv, vec2(0.7, 0.3)) * 2.0) - 0.5) * u_folds * 0.6 * smoothstep(0.08, 0.0, fold);
  vec3 n = normalize(vec3(-g * u_depth * 0.08, 1.0));
  vec3 L = normalize(vec3(cos(radians(u_light)), sin(radians(u_light)), 1.2));
  float shade = 0.65 + dot(n, L) * 0.45;
  vec3 c = texture(uTex0, vUv + g * 0.0006 * u_depth).rgb;
  c = mix(c, vec3(1.0), u_inkFade * 0.4);
  vec3 o = c * u_paperTint * shade;
  fragColor = vec4(sat(o), 1.0);
}`),
  },
];
