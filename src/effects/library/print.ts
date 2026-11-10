import { surfaceTexture } from "../../lib/surfaces";
import { angle, color, group, hero, range, select, single, toggle, type EffectDef } from "../types";


/** Printing inks (process, riso-style spot and metallic), shared by halftone and risograph. */
const INKS: [string, string][] = [
  ["Black", "#1A1A1A"], ["Gray", "#7A7A7A"], ["Warm gray", "#8C8379"], ["Blue", "#0078BF"], ["Cyan", "#00AEEF"],
  ["Aqua", "#5EC8E5"], ["Teal", "#00838A"], ["Green", "#00A95C"], ["Kelly green", "#67B346"], ["Mint", "#82D8D5"],
  ["Fluorescent green", "#44D62C"], ["Light lime", "#E3ED55"], ["Lemon", "#FFE900"], ["Yellow", "#FFF200"], ["Sunflower", "#FFB511"],
  ["Orange", "#FF6C2F"], ["Fluorescent orange", "#FF7477"], ["Bright red", "#F15060"], ["Red", "#E52D2D"], ["Brick", "#A75154"],
  ["Fluorescent pink", "#FF48B0"], ["Pink", "#F984CA"], ["Light pink", "#F6B9D3"], ["Coral", "#FF8E91"], ["Burgundy", "#914E72"],
  ["Plum", "#845991"], ["Purple", "#765BA7"], ["Violet", "#9D7AD2"], ["Lavender", "#B8A6E0"], ["Medium blue", "#3255A4"],
  ["Magenta", "#EC008C"], ["Federal blue", "#3D5588"], ["Navy", "#1F2A44"], ["Brown", "#925F52"], ["Metallic gold", "#B7A16A"],
  ["Silver", "#BCC0C4"],
];
const INK_NAMES = INKS.map((i) => i[0]);

/** Surface materials for emboss and bevel. */
const MATERIALS: [string, string][] = [
  ["Chrome", "#D8DEE6"], ["Silver", "#C0C4C8"], ["Steel", "#8E99A3"], ["Gold", "#D4AF37"], ["Rose gold", "#E0A899"],
  ["Copper", "#B87333"], ["Bronze", "#9C7A3C"], ["Brass", "#C9A646"], ["Plaster", "#EDE8DF"], ["Clay", "#B5654D"],
  ["Stone", "#8C8780"], ["Marble", "#E8E6E1"], ["Paper", "#F2EEE6"], ["Ivory", "#F4EEDC"], ["Black plastic", "#1C1C1E"],
  ["White plastic", "#F5F5F2"], ["Red plastic", "#D3202A"], ["Blue plastic", "#2F5DB3"], ["Jade", "#4E9F7A"], ["Obsidian", "#2B2A33"],
  ["Rubber", "#2E2E2E"], ["Wax", "#E9D8A6"], ["Glass", "#BFD9E3"], ["Ice", "#DDF0F7"], ["Neon pink", "#FF4FB8"],
  ["Neon green", "#57FF7A"], ["Neon blue", "#3FA9FF"], ["Cobalt", "#1F46A3"], ["Emerald", "#1E8F5E"], ["Ruby", "#9B111E"],
  ["Pewter", "#9A9A98"], ["Graphite", "#4A4B4D"], ["Bone", "#E3DAC9"], ["Sand", "#C9B48A"], ["Wood", "#8B5E3C"],
  ["Concrete", "#A4A19B"],
];
const MATERIAL_NAMES = MATERIALS.map((m) => m[0]);

const glslPalette = (fn: string, list: [string, string][]) => {
  const v = list.map(([, h]) => {
    const n = parseInt(h.slice(1), 16);
    return `vec3(${(((n >> 16) & 255) / 255).toFixed(3)}, ${(((n >> 8) & 255) / 255).toFixed(3)}, ${((n & 255) / 255).toFixed(3)})`;
  });
  return `vec3 ${fn}(float i) {\n  vec3 p[${v.length}] = vec3[${v.length}](${v.join(", ")});\n  return p[int(clamp(i, 0.0, ${v.length - 1}.0) + 0.5)];\n}\n`;
};
const INK_GLSL = glslPalette("inkColor", INKS) + glslPalette("materialColor", MATERIALS);

export const print: EffectDef[] = [
  {
    id: "halftone",
    name: "Halftone screen",
    category: "Print",
    description: "Four-ink screened print: separation with black generation, angled screens, dot gain.",
    keywords: "cmyk dots print newspaper comic screen",
    params: [
      select("pattern", "Pattern", ["Dot", "Ellipse", "Square", "Line", "Cross", "Diamond", "Ring"]),
      hero("frequency", "Frequency", 10, 300, 80, 1),
      color("paper", "Paper color", "#EFF1F5"),
      ...group("Separation", [range("blackGen", "Black generation", 0, 1, 0.5), range("totalInk", "Total ink", 200, 400, 300, 5)]),
      ...group("Press", [range("dotGain", "Dot gain", 0, 0.4, 0.05), hero("density", "Ink density", 0, 1, 1), range("rough", "Edge roughness", 0, 1, 0.3), range("seed", "Seed", 0, 100, 0, 1)]),
      ...group("Ink 1", [toggle("ink1On", "Enable", 1), select("ink1", "Color", INK_NAMES, 4), range("ink1Angle", "Angle", -90, 90, 15, 0.5, { unit: "°" }), range("ink1X", "Shift X", -20, 20, 0, 0.5), range("ink1Y", "Shift Y", -20, 20, 0, 0.5)]),
      ...group("Ink 2", [toggle("ink2On", "Enable", 1), select("ink2", "Color", INK_NAMES, 30), range("ink2Angle", "Angle", -90, 90, 75, 0.5, { unit: "°" }), range("ink2X", "Shift X", -20, 20, 0, 0.5), range("ink2Y", "Shift Y", -20, 20, 0, 0.5)]),
      ...group("Ink 3", [toggle("ink3On", "Enable", 1), select("ink3", "Color", INK_NAMES, 13), range("ink3Angle", "Angle", -90, 90, 0, 0.5, { unit: "°" }), range("ink3X", "Shift X", -20, 20, 0, 0.5), range("ink3Y", "Shift Y", -20, 20, 0, 0.5)]),
      ...group("Ink 4", [toggle("ink4On", "Enable", 1), select("ink4", "Color", INK_NAMES, 0), range("ink4Angle", "Angle", -90, 90, 45, 0.5, { unit: "°" }), range("ink4X", "Shift X", -20, 20, 0, 0.5), range("ink4Y", "Shift Y", -20, 20, 0, 0.5)]),
    ],
    passes: single(INK_GLSL + `
float spot(vec2 p, int pat) {
  vec2 f = fract(p) - 0.5;
  if (pat == 1) return length(f * vec2(0.7, 1.3));
  if (pat == 2) return max(abs(f.x), abs(f.y)) * 1.12;
  if (pat == 3) return abs(f.y) * 1.4;
  if (pat == 4) return min(abs(f.x), abs(f.y)) * 2.2;
  if (pat == 5) return (abs(f.x) + abs(f.y)) * 0.8;
  if (pat == 6) return abs(length(f) - 0.3) * 2.0 + 0.1;
  return length(f);
}
float screenInk(float cov, float ang, vec2 shift) {
  float cell = uRes.y / u_frequency;
  vec2 p = rot(radians(ang)) * ((vUv * uRes - shift * refScale()) / cell);
  float rough = (vnoise(vUv * uRes * 0.35 + u_seed) - 0.5) * u_rough * 0.25;
  // Dot gain swells mid-tone dots the way ink spreads into paper.
  float c = sat(cov + u_dotGain * cov * (1.0 - cov) * 4.0);
  float r = sqrt(c) * 0.62;
  float d = spot(p, int(u_pattern + 0.5));
  float aa = fwidth(d) + 0.02;
  return smoothstep(r + aa, r - aa, d + rough) * step(0.002, c);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 A = 1.0 - c.rgb;
  vec4 ons = vec4(u_ink1On, u_ink2On, u_ink3On, u_ink4On);
  vec3 inks[4] = vec3[4](inkColor(u_ink1), inkColor(u_ink2), inkColor(u_ink3), inkColor(u_ink4));
  // Black generation: the darkest ink takes over the grey component first.
  float covs[4];
  int darkest = 0; float dl = 9.0;
  for (int i = 0; i < 4; i++) { float l = luma(inks[i]); if (ons[i] > 0.5 && l < dl) { dl = l; darkest = i; } }
  for (int i = 0; i < 4; i++) covs[i] = 0.0;
  if (dl < 0.3) {
    float k = min(A.r, min(A.g, A.b)) * u_blackGen;
    covs[darkest] = k;
    A -= k * (1.0 - inks[darkest]);
  }
  for (int i = 0; i < 4; i++) {
    if (ons[i] < 0.5 || (i == darkest && dl < 0.3)) continue;
    vec3 ab = 1.0 - inks[i];
    float cov = sat(dot(A, ab) / max(dot(ab, ab), 1e-3));
    covs[i] = cov;
    A = max(A - cov * ab, 0.0);
  }
  // Total ink limit (percent of solid coverage summed over inks).
  float tot = (covs[0] + covs[1] + covs[2] + covs[3]) * 100.0;
  float lim = tot > u_totalInk ? u_totalInk / tot : 1.0;
  vec3 o = u_paper;
  vec2 shifts[4] = vec2[4](vec2(u_ink1X, u_ink1Y), vec2(u_ink2X, u_ink2Y), vec2(u_ink3X, u_ink3Y), vec2(u_ink4X, u_ink4Y));
  float angs[4] = float[4](u_ink1Angle, u_ink2Angle, u_ink3Angle, u_ink4Angle);
  for (int i = 0; i < 4; i++) {
    if (ons[i] < 0.5) continue;
    float d = screenInk(covs[i] * lim, angs[i], shifts[i]);
    o *= mix(vec3(1.0), inks[i], d * u_density);
  }
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "risograph",
    name: "Risograph",
    category: "Print",
    description: "Stencil-duplicator print: each ink is pulled from chosen hues, with grain and misregistration.",
    keywords: "riso print zine fluorescent pink stencil",
    params: [
      color("paper", "Paper color", "#F5F1E8"),
      ...group("Grain", [range("grainScale", "Grain scale", 0.1, 3, 0.18), range("grainOpacity", "Grain opacity", 0, 1, 0.85), range("grainSoft", "Grain softness", 0, 0.5, 0.5), range("grainContrast", "Grain contrast", 0.5, 3, 1)]),
      ...group("Ink 1", [toggle("r1On", "Ink 1", 1), select("r1", "Color 1", INK_NAMES, 20), range("r1reds", "Ink 1 reds", -2, 3, -0.78), range("r1yellows", "Ink 1 yellows", -2, 3, 1.9), range("r1greens", "Ink 1 greens", -2, 3, 3), range("r1cyans", "Ink 1 cyans", -2, 3, 3), range("r1blues", "Ink 1 blues", -2, 3, 3), range("r1magentas", "Ink 1 magentas", -2, 3, 3), range("r1X", "Ink 1 shift X", -20, 20, 0, 0.5), range("r1Y", "Ink 1 shift Y", -20, 20, 0, 0.5)]),
      ...group("Ink 2", [toggle("r2On", "Ink 2", 1), select("r2", "Color 2", INK_NAMES, 4), range("r2reds", "Ink 2 reds", -2, 3, 2.08), range("r2yellows", "Ink 2 yellows", -2, 3, 1.5), range("r2greens", "Ink 2 greens", -2, 3, -2), range("r2cyans", "Ink 2 cyans", -2, 3, -0.5), range("r2blues", "Ink 2 blues", -2, 3, 0.96), range("r2magentas", "Ink 2 magentas", -2, 3, -2), range("r2X", "Ink 2 shift X", -20, 20, 0, 0.5), range("r2Y", "Ink 2 shift Y", -20, 20, 0, 0.5)]),
      ...group("Ink 3", [toggle("r3On", "Ink 3", 1), select("r3", "Color 3", INK_NAMES, 13), range("r3reds", "Ink 3 reds", -2, 3, 0.44), range("r3yellows", "Ink 3 yellows", -2, 3, -2), range("r3greens", "Ink 3 greens", -2, 3, 3), range("r3cyans", "Ink 3 cyans", -2, 3, 3), range("r3blues", "Ink 3 blues", -2, 3, 3), range("r3magentas", "Ink 3 magentas", -2, 3, 3), range("r3X", "Ink 3 shift X", -20, 20, 0, 0.5), range("r3Y", "Ink 3 shift Y", -20, 20, 0, 0.5)]),
      ...group("Ink 4", [toggle("r4On", "Ink 4", 0), select("r4", "Color 4", INK_NAMES, 0), range("r4reds", "Ink 4 reds", -2, 3, 0.4), range("r4yellows", "Ink 4 yellows", -2, 3, 0.6), range("r4greens", "Ink 4 greens", -2, 3, 0.4), range("r4cyans", "Ink 4 cyans", -2, 3, 0.6), range("r4blues", "Ink 4 blues", -2, 3, 0.2), range("r4magentas", "Ink 4 magentas", -2, 3, 0.8), range("r4X", "Ink 4 shift X", -20, 20, 0, 0.5), range("r4Y", "Ink 4 shift Y", -20, 20, 0, 0.5)]),
    ],
    passes: single(INK_GLSL + `
// Membership of a hue in six bands (reds, yellows, greens, cyans, blues, magentas).
float band(float h, float c) { float d = abs(fract(h - c + 0.5) - 0.5); return smoothstep(1.0 / 6.0, 0.0, d); }
float hueW(vec3 hsv, float r, float y, float g, float cy, float b, float m) {
  float h = hsv.x;
  return band(h, 0.0) * r + band(h, 1.0 / 6.0) * y + band(h, 2.0 / 6.0) * g + band(h, 3.0 / 6.0) * cy + band(h, 4.0 / 6.0) * b + band(h, 5.0 / 6.0) * m;
}
float grainAtPx(vec2 uv, float k) {
  vec2 p = refCoord(uv) / max(u_grainScale * 6.0, 0.3);
  float n = vnoise(p + k * 17.0) * 0.6 + hash12(floor(p * 2.0) + k) * 0.4;
  return sat((n - 0.5) * u_grainContrast + 0.5);
}
float layer(float amt, float k) {
  float n = grainAtPx(vUv, k);
  float e = max(u_grainSoft * 0.3, 0.01);
  float cov = smoothstep(n - e, n + e, amt);
  return mix(amt, cov, u_grainOpacity * 0.6);
}
// Ink amounts that reproduce colour c on the paper: non-negative least squares on absorption
// (Gauss-Seidel, a few sweeps), then each ink's hue sliders push it up or down in coloured areas.
vec4 separate(vec3 c, mat4x3 A, vec4 on) {
  vec3 target = max(u_paper - c, 0.0);
  vec4 x = vec4(0.0);
  for (int it = 0; it < 10; it++) {
    for (int k = 0; k < 4; k++) {
      if (on[k] < 0.5) continue;
      vec3 r = target - (A[0] * x[0] + A[1] * x[1] + A[2] * x[2] + A[3] * x[3]);
      x[k] = clamp(x[k] + dot(r, A[k]) / max(dot(A[k], A[k]), 1e-3), 0.0, 1.0);
    }
  }
  return x * on;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 px = 1.0 / uRes * refScale();
  vec3 I1 = inkColor(u_r1), I2 = inkColor(u_r2), I3 = inkColor(u_r3), I4 = inkColor(u_r4);
  mat4x3 A = mat4x3(u_paper * (1.0 - I1), u_paper * (1.0 - I2), u_paper * (1.0 - I3), u_paper * (1.0 - I4));
  vec4 on = vec4(u_r1On, u_r2On, u_r3On, u_r4On);
  // Each ink is separated from its own (shifted) sample so misregistration looks like misregistration.
  vec3 c1 = texture(uTex0, vUv - vec2(u_r1X, u_r1Y) * px).rgb, c2 = texture(uTex0, vUv - vec2(u_r2X, u_r2Y) * px).rgb;
  vec3 c3 = texture(uTex0, vUv - vec2(u_r3X, u_r3Y) * px).rgb, c4 = texture(uTex0, vUv - vec2(u_r4X, u_r4Y) * px).rgb;
  vec4 x = vec4(separate(c1, A, on).x, separate(c2, A, on).y, separate(c3, A, on).z, separate(c4, A, on).w);
  vec3 h1 = rgb2hsv(c1), h2 = rgb2hsv(c2), h3 = rgb2hsv(c3), h4 = rgb2hsv(c4);
  x.x *= clamp(1.0 + hueW(h1, u_r1reds, u_r1yellows, u_r1greens, u_r1cyans, u_r1blues, u_r1magentas) * 0.12 * h1.y, 0.0, 2.0);
  x.y *= clamp(1.0 + hueW(h2, u_r2reds, u_r2yellows, u_r2greens, u_r2cyans, u_r2blues, u_r2magentas) * 0.12 * h2.y, 0.0, 2.0);
  x.z *= clamp(1.0 + hueW(h3, u_r3reds, u_r3yellows, u_r3greens, u_r3cyans, u_r3blues, u_r3magentas) * 0.12 * h3.y, 0.0, 2.0);
  x.w *= clamp(1.0 + hueW(h4, u_r4reds, u_r4yellows, u_r4greens, u_r4cyans, u_r4blues, u_r4magentas) * 0.12 * h4.y, 0.0, 2.0);
  vec3 o = u_paper;
  o *= mix(vec3(1.0), I1, layer(sat(x.x), 1.0) * on.x);
  o *= mix(vec3(1.0), I2, layer(sat(x.y), 2.0) * on.y);
  o *= mix(vec3(1.0), I3, layer(sat(x.z), 3.0) * on.z);
  o *= mix(vec3(1.0), I4, layer(sat(x.w), 4.0) * on.w);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "paper-scan",
    name: "Paper scan",
    category: "Print",
    description: "The image printed on paper and scanned back: real paper texture, tone and scanner wobble.",
    keywords: "scan paper print texture photocopy",
    params: [
      select("textureMode", "Texture mode", ["Thin paper", "Crumpled paper"]),
      hero("opacity", "Opacity", 0, 1, 1),
      range("texScale", "Texture scale", 1, 3, 1),
      hero("brightness", "Brightness", -1, 1, 0),
      hero("contrast", "Contrast", 0, 3, 1),
      range("distortion", "Distortion", 0, 3, 1, 0.1),
      range("distScale", "Distortion scale", 300, 1000, 500, 1),
    ],
    aux: (v) => [surfaceTexture(Number(v.textureMode) > 0.5 ? 1 : 3)],
    passes: single(`
vec2 warp(vec2 uv) {
  // Paper never lies flat on the glass: a slow, smooth warp, a few pixels at most.
  vec2 q = uv * vec2(aspect(), 1.0) * (1000.0 / u_distScale) * 2.0 + uSeed * 0.37;
  return vec2(fbm(q), fbm(q + 5.2)) - 0.5;
}
void main() {
  vec2 uv = vUv + warp(vUv) * refPx(u_distortion * 6.0);
  // Scanner optics: a touch softer than the original.
  vec3 x = blur13(uTex0, uv, refPx(0.6)).rgb;
  // Brightness fades the print towards paper white (or darkens it below zero).
  x = u_brightness >= 0.0 ? mix(x, vec3(1.0), u_brightness * 0.6) : x * (1.0 + u_brightness);
  // The paper, tiled at its scanned resolution so fibres stay fine; contrast sets how much it shows.
  vec2 tp = (vUv - 0.5) * uRes / (uAuxRes0 * refScale() * u_texScale * 0.6) + 0.5;
  float paper = luma(texture(uAux0, tp).rgb);
  float pm = (paper / 0.85 - 1.0) * u_contrast * 0.45;
  // Ink sits in the paper: blacks lift to the scan floor, the tooth shows most in highlights.
  vec3 ink = mix(vec3(0.04), vec3(1.0), x);
  vec3 printed = ink * (1.0 + pm * (0.35 + 0.65 * luma(x)));
  printed = mix(printed, vec3(luma(printed)), 0.06) + (hash12(vUv * uRes + uSeed) - 0.5) * 0.02;
  fragColor = vec4(sat(mix(texture(uTex0, vUv).rgb, printed, u_opacity)), 1.0);
}`),
  },
  {
    id: "paper-cutout",
    name: "Paper cutout",
    category: "Print",
    description: "The image cut into torn paper pieces, shifted, rotated and laid on a background.",
    keywords: "collage torn paper pieces cut",
    params: [
      hero("columns", "Columns", 1, 16, 4, 1),
      hero("rows", "Rows", 1, 16, 4, 1),
      range("missing", "Missing pieces", 0, 100, 0, 1),
      range("seed", "Seed", 0, 100, 0, 1),
      range("rotation", "Rotation", 0, 180, 4, 0.1, { unit: "°" }),
      ...group("Variation", [range("sizeVar", "Size variation", 0, 2, 0), range("widthVar", "Width variation", 0, 2, 0), range("heightVar", "Height variation", 0, 2, 0), range("uvShift", "UV shift", 0, 1, 0.15), range("colorVar", "Color variation", 0, 1, 0.3)]),
      ...group("Edges", [range("tear", "Tear size", 0, 1, 0.65), range("chunk", "Chunk size", 0, 1, 0.7), range("rough", "Roughness", 0, 5, 0.7), range("whiteEdge", "White edge", 0, 1, 0.25), range("uneven", "Unevenness", 0, 1, 0.5), range("shadow", "Shadow", 0, 1, 0.5)]),
      ...group("Background", [toggle("bgImage", "Background image", 1), color("bg", "Background color", "#000000")]),
    ],
    passes: single(`
// Signed distance to a torn piece centred in its tile (negative inside).
float piece(vec2 p, vec2 cell, out vec2 local, out float hidden) {
  vec2 n = vec2(u_columns, u_rows);
  vec2 h = hash22(cell + u_seed * 1.37);
  float h3 = hash12(cell * 1.7 + u_seed);
  hidden = step(h3, u_missing / 100.0);
  vec2 c = (cell + 0.5) / n;
  // Pieces only ever grow from their cell, so neighbours overlap instead of leaving gaps.
  vec2 half_ = 0.5 / n * (1.0 + h * vec2(u_widthVar, u_heightVar) * 0.5) * (1.0 + h3 * u_sizeVar * 0.5);
  float a = radians((h.x - 0.5) * 2.0 * u_rotation);
  vec2 q = rot(a) * ((p - c) * vec2(aspect(), 1.0)) / vec2(aspect(), 1.0);
  local = q / (half_ * 2.0) + 0.5;
  vec2 d = abs(q) - half_ * 1.04;
  float box = max(d.x, d.y) / max(half_.y, 1e-3);
  // Torn edge: fractal wobble; chunk size scales the bites, roughness the fine fibre.
  float tear = (fbm(q * vec2(aspect(), 1.0) * (6.0 + (1.0 - u_chunk) * 30.0) + cell * 3.1) - 0.5) * u_tear * 0.25;
  tear += (vnoise(q * 400.0 + cell) - 0.5) * u_rough * 0.02;
  tear += (h.y - 0.5) * u_uneven * 0.05 * sin(q.x * 40.0 + q.y * 31.0);
  return box + tear;
}
void main() {
  vec2 n = vec2(u_columns, u_rows);
  vec2 base = floor(vUv * n);
  vec3 bg = u_bgImage > 0.5 ? texture(uTex0, vUv).rgb * 0.35 : u_bg;
  vec3 o = bg;
  float shadowAcc = 0.0;
  float best = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cell = base + vec2(i, j);
    if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= n.x || cell.y >= n.y) continue;
    vec2 local; float hidden;
    float order = hash12(cell + 91.0 + u_seed);
    float ds = piece(vUv + refPx(6.0) * vec2(-1.0, 1.0), cell, local, hidden);
    if (hidden < 0.5) shadowAcc = max(shadowAcc, smoothstep(0.08, -0.05, ds));
    float d = piece(vUv, cell, local, hidden);
    if (hidden > 0.5 || d > 0.0 || order < best) continue;
    best = order;
    vec2 h = hash22(cell + 3.0 + u_seed);
    vec2 suv = ((cell + local) / n) + (h - 0.5) * u_uvShift * 0.2;
    vec3 col = texture(uTex0, suv).rgb;
    col *= 1.0 + (hash12(cell + 5.0) - 0.5) * u_colorVar * 0.5;
    col = mix(col, col.gbr, (hash12(cell + 8.0) - 0.5) * u_colorVar * 0.15);
    // White paper fibre at the torn edge.
    float edge = smoothstep(-u_whiteEdge * 0.12 - 0.002, 0.0, d);
    col = mix(col, vec3(0.96, 0.95, 0.92), edge * step(0.001, u_whiteEdge));
    o = col;
  }
  if (best < 0.0) o = bg * (1.0 - shadowAcc * u_shadow * 0.7);
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "ink-bleed",
    name: "Ink bleed",
    category: "Print",
    description: "Dark ink seeps outward through paper fibres along a flow direction.",
    keywords: "bleed ink wet paper spread capillary",
    animated: (v) => Number(v.reset) > 0,
    params: [
      hero("spread", "Spread", 0, 30, 5, 0.5),
      range("decay", "Decay", 0, 0.2, 0, 0.001),
      hero("intensity", "Intensity", 0, 1, 0.15),
      range("dirX", "Direction X", -1, 1, 0),
      range("dirY", "Direction Y", -1, 1, -0.3),
      range("noiseSize", "Noise size", 4, 120, 90, 1),
      ...group("Grain", [range("grain", "Grain", 0, 1, 0.4), range("grainSize", "Grain size", 0.5, 3, 1, 0.1)]),
      ...group("Mask", [range("maskLo", "Mask contrast low", 0, 1, 0.2), range("maskHi", "Mask contrast high", 0, 1, 0.8), range("maskStrength", "Mask strength", 0, 1, 1), toggle("showMask", "Show mask")]),
      range("reset", "Ink reset (sec)", 0, 10, 0, 1),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float grow = u_reset > 0.0 ? fract(uTime / u_reset) : 1.0;
  // Spread is in units of ~14 reference pixels: ink travels far, in furry, noise-shaped blots.
  float r = u_spread * 14.0 * grow;
  vec2 flow = vec2(u_dirX, u_dirY);
  float ink = 1.0 - luma(c.rgb);
  vec3 darkest = c.rgb;
  // Gather from a noisy neighbourhood biased upstream; ink only ever darkens.
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    float a = fi * 2.39996;
    float rr = sqrt((fi + 0.5) / 40.0);
    vec2 o = vec2(cos(a), sin(a)) * rr;
    float fib = vnoise(vUv * uRes / refScale() / u_noiseSize * 6.0 + o * 3.0 + uSeed);
    vec2 off = (o * fib * 1.6 - flow * rr) * refPx(r);
    vec3 s = texture(uTex0, vUv + off).rgb;
    float m = smoothstep(u_maskLo, u_maskHi, 1.0 - luma(s));
    float w = exp(-rr * u_decay * 40.0) * mix(1.0, m, u_maskStrength);
    darkest = mix(darkest, min(darkest, s), sat(w * u_intensity * 4.0));
  }
  float g = (hash12(floor(refCoord(vUv) / u_grainSize) + uSeed) - 0.5) * u_grain * 0.15;
  vec3 o = darkest + g * (1.0 - luma(darkest));
  if (u_showMask > 0.5) o = vec3(smoothstep(u_maskLo, u_maskHi, ink));
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "emboss",
    name: "Emboss",
    category: "Print",
    description: "Relief from image brightness, lit from a direction, in a chosen material colour.",
    keywords: "relief metal plate stamp 3d",
    animated: (v) => Math.abs(Number(v.animX)) + Math.abs(Number(v.animY)) > 0.001,
    params: [
      hero("scale", "Scale", 0, 10, 4, 0.1),
      select("color", "Color", MATERIAL_NAMES, 30),
      ...group("Light", [range("lightX", "Light direction X", -1, 1, -0.6), range("lightY", "Light direction Y", -1, 1, 0.6), range("animX", "Light animation X", -1, 1, 0), range("animY", "Light animation Y", -1, 1, 0)]),
      ...group("Shadow", [range("shadowX", "Shadow direction X", -1, 1, 0.6), range("shadowY", "Shadow direction Y", -1, 1, -0.6), toggle("lockShadow", "Lock shadow"), hero("shadowIntensity", "Shadow intensity", 0, 2, 0.5, 0.1), range("shadowBlur", "Shadow blur", 0, 10, 0, 0.5)]),
      ...group("Highlight", [range("highlight", "Highlight intensity", 0, 2, 0.3, 0.1), range("highlightDist", "Highlight distance", 0, 20, 2, 0.5)]),
      range("gradient", "Gradient strength", 0, 1, 0.2),
      range("depthDark", "Depth darkening", 0, 1, 0.3),
    ],
    passes: single(INK_GLSL + `
float H(vec2 uv) { return luma(texture(uTex0, uv).rgb); }
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 L = normalize(vec2(u_lightX, u_lightY) + vec2(cos(uTime * u_animX * 2.0), sin(uTime * u_animY * 2.0)) * step(0.001, abs(u_animX) + abs(u_animY)) + 1e-4);
  vec2 S = u_lockShadow > 0.5 ? -L : normalize(vec2(u_shadowX, u_shadowY) + 1e-4);
  vec2 e = refPx(1.0);
  float h = H(vUv);
  vec2 g = vec2(H(vUv + vec2(e.x, 0.0)) - H(vUv - vec2(e.x, 0.0)), H(vUv + vec2(0.0, e.y)) - H(vUv - vec2(0.0, e.y)));
  vec3 n = normalize(vec3(-g * u_scale * 4.0, 1.0));
  float diff = dot(n, normalize(vec3(L, 0.8))) * 0.5 + 0.5;
  // Cast shadow: higher ground in the light's direction shades this point.
  float sh = 0.0;
  for (int i = 1; i <= 6; i++) {
    vec2 o = S * refPx(float(i) * (1.0 + u_shadowBlur * 0.5));
    sh = max(sh, H(vUv - o) - h - float(i) * 0.01);
  }
  float hl = max(H(vUv + L * refPx(u_highlightDist)) - h, 0.0);
  vec3 mat = materialColor(u_color);
  vec3 o = mat * mix(0.5, diff * 1.4, 1.0) * (1.0 - h * u_depthDark * 0.5 + u_depthDark * 0.25);
  o *= 1.0 - sat(sh * 6.0) * u_shadowIntensity * 0.6;
  o += hl * u_highlight * 2.0;
  o = mix(o, o * (0.6 + (1.0 - vUv.y) * 0.8), u_gradient);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "bevel",
    name: "Bevel",
    category: "Print",
    description: "Shapes from the image extruded with a bevel profile and a material.",
    keywords: "3d chrome metal extrude letterpress",
    params: [
      select("shapeFrom", "Shape from", ["Luma", "Alpha"]),
      hero("threshold", "Threshold", 0.01, 0.99, 0.5),
      toggle("invert", "Invert mask"),
      hero("size", "Size", 1, 1000, 40, 1),
      range("depth", "Depth", 0, 4, 2, 0.05),
      select("direction", "Direction", ["Inner", "Outer", "Both"], 2),
      select("profile", "Profile", ["Linear", "Round", "Cove", "Ogee", "Chisel", "Step", "Pillow", "Ridge", "Double", "Soft", "Sharp", "Wave", "Groove", "Bulb", "Sine", "Inverse round", "Plateau", "Triple step", "Ripple"]),
      select("material", "Material", MATERIAL_NAMES, 2),
      range("lightX", "Light direction X", -1, 1, -0.5),
      range("lightY", "Light direction Y", -1, 1, 0.6),
      ...group("Surface", [select("blend", "Blend mode", ["Normal", "Multiply", "Screen", "Overlay", "Soft light", "Add", "Difference", "Darken", "Lighten", "Color", "Luminosity", "Color dodge", "Color burn"]), range("opacity", "Opacity", 0, 1, 1), range("innerFill", "Inner fill", 0, 1, 1), range("outerFill", "Outer fill", 0, 1, 0)]),
    ],
    passes: single(INK_GLSL + `
float inside(vec2 uv) {
  vec4 c = texture(uTex0, uv);
  int s = int(u_shapeFrom + 0.5);
  float v = s == 1 ? c.a : luma(c.rgb);
  float m = step(u_threshold, v);
  return u_invert > 0.5 ? 1.0 - m : m;
}
float prof(float t, int p) {
  if (p == 1) return sqrt(1.0 - (1.0 - t) * (1.0 - t));
  if (p == 2) return 1.0 - sqrt(1.0 - t * t);
  if (p == 3) return smoothstep(0.0, 1.0, t);
  if (p == 4) return min(t * 2.0, 1.0);
  if (p == 5) return floor(t * 3.0 + 0.5) / 3.0;
  if (p == 6) return sin(t * PI * 0.5);
  if (p == 7) return 1.0 - abs(t - 0.5) * 2.0;
  if (p == 8) return fract(t * 2.0) * 0.5 + step(0.5, t) * 0.5;
  if (p == 9) return t * t * (3.0 - 2.0 * t) * 0.8 + t * 0.2;
  if (p == 10) return pow(t, 0.3);
  if (p == 11) return t + sin(t * TAU * 2.0) * 0.08;
  if (p == 12) return t - sin(t * PI) * 0.4;
  if (p == 13) return pow(sin(t * PI * 0.5), 3.0);
  if (p == 14) return 0.5 - 0.5 * cos(t * PI);
  if (p == 15) return 1.0 - sqrt(1.0 - t);
  if (p == 16) return min(t * 3.0, 1.0);
  if (p == 17) return floor(t * 4.0) / 3.0;
  if (p == 18) return t + sin(t * TAU * 4.0) * 0.04;
  return t;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float m = inside(vUv);
  // Approximate distance to the shape edge by searching rings outward.
  float r = u_size * refScale();
  float dist = r;
  for (int k = 1; k <= 12; k++) {
    float rr = r * float(k) / 12.0;
    float hit = 0.0;
    for (int a = 0; a < 12; a++) {
      float ang = float(a) * TAU / 12.0 + float(k) * 0.3;
      if (inside(vUv + vec2(cos(ang), sin(ang)) * rr / uRes) != m) hit = 1.0;
    }
    if (hit > 0.5) { dist = rr; break; }
  }
  float t = sat(dist / r);
  int p = int(u_profile + 0.5);
  int dir = int(u_direction + 0.5);
  float side = dir == 0 ? m : dir == 1 ? 1.0 - m : 1.0;
  float hgt = prof(t, p) * u_depth * side;
  // Normal from the height field around this point.
  vec2 ex = vec2(2.0, 0.0) / uRes;
  float hx = prof(sat(dist / r + 0.02), p) - prof(sat(dist / r - 0.02), p);
  vec2 gradDir = vec2(dFdx(hgt), dFdy(hgt));
  vec3 n = normalize(vec3(-gradDir * 40.0 + ex * 0.0 * hx, 1.0));
  vec3 Ld = normalize(vec3(u_lightX, u_lightY, 0.9));
  float diff = max(dot(n, Ld), 0.0);
  float spec = pow(max(dot(reflect(-Ld, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  vec3 mat = materialColor(u_material);
  vec3 env = mix(mat * 0.35, mat * 1.2, n.y * 0.5 + 0.5);
  vec3 lit = env * (0.35 + diff * 0.9) + spec * 0.8;
  float fill = m > 0.5 ? u_innerFill : u_outerFill;
  vec3 surf = mix(c.rgb, lit, fill * (m > 0.5 ? 1.0 : step(0.001, u_outerFill)));
  int b = int(u_blend + 0.5);
  vec3 o = b == 1 ? c.rgb * surf : b == 2 ? blendScreen(c.rgb, surf) : b == 3 ? blendOverlay(c.rgb, surf) : b == 4 ? blendSoftLight(c.rgb, surf) : b == 5 ? c.rgb + surf : b == 6 ? abs(c.rgb - surf) : b == 7 ? min(c.rgb, surf) : b == 8 ? max(c.rgb, surf) : surf;
  fragColor = vec4(sat(mix(c.rgb, o, u_opacity)), c.a);
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
