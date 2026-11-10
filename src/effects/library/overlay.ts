import { curvesLut, glyphAtlas, gradientLut, imageTexture, textTexture, TEXT_FONTS } from "../../lib/textures";
import { surfaceTexture, SURFACE_NAMES } from "../../lib/surfaces";
import { angle, color, curve, gradient, group, hero, image, range, select, single, text, toggle, type EffectDef } from "../types";
import { BLEND_MODES } from "../../engine/glsl";

const LM_BLENDS = ["Normal", "Multiply", "Screen", "Overlay", "Soft light", "Hard light", "Color dodge", "Hard mix"];

export const overlay: EffectDef[] = [
  {
    id: "text",
    name: "Text",
    category: "Overlay",
    description: "Set type on the image.",
    keywords: "type typography title caption words font",
    handles: [{ x: "x", y: "y", label: "Text" }],
    params: [
      text("content", "Text", "Type", { multiline: true, maxLength: 400 }),
      select("font", "Font", TEXT_FONTS.map((f) => f.label)),
      select("weight", "Weight", ["Light", "Regular", "Medium", "Bold", "Black"], 1),
      toggle("italic", "Italic"),
      select("align", "Align", ["Left", "Center", "Right"], 1),
      range("x", "Position X", 0, 1, 0.5),
      range("y", "Position Y", 0, 1, 0.5),
      hero("size", "Size", 0.01, 0.6, 0.12, 0.005),
      range("rotation", "Rotation", -360, 360, 0, 1, { unit: "°" }),
      range("lineHeight", "Line height", 0.5, 3, 1.2, 0.05),
      range("tracking", "Letter spacing", -0.1, 0.6, 0, 0.005),
      color("fill", "Text color", "#FFFFFF"),
      hero("opacity", "Opacity", 0, 1, 1),
      ...group("Stroke", [range("stroke", "Stroke width", 0, 30, 0, 0.5), color("strokeColor", "Stroke color", "#000000")]),
      select("blend", "Blend", BLEND_MODES as unknown as string[]),
    ],
    aux: (v) => [textTexture(String(v.content), Number(v.font), [300, 400, 500, 700, 900][Number(v.weight) | 0] ?? 400, Number(v.tracking), Number(v.align), Number(v.lineHeight), Number(v.italic) > 0.5)],
    passes: single(`
float cover(vec2 uv) {
  vec2 p = (uv - vec2(u_x, u_y)) * vec2(aspect(), 1.0);
  p = rot(-radians(u_rotation)) * p;
  // The texture is set at 160 px per line; size is the cap height as a fraction of the frame.
  float h = u_size * uAuxRes0.y / 160.0;
  vec2 box = vec2(h * uAuxRes0.x / uAuxRes0.y, h);
  vec2 t = p / box + 0.5;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return 0.0;
  return texture(uAux0, t).r;
}
vec3 blendTo(vec3 b, vec3 s, int m) {
  if (m == 1) return b * s;
  if (m == 2) return blendScreen(b, s);
  if (m == 3) return blendOverlay(b, s);
  if (m == 4) return blendSoftLight(b, s);
  if (m == 5) return b + s;
  if (m == 6) return abs(b - s);
  if (m == 7) return min(b, s);
  if (m == 8) return max(b, s);
  return s;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float a = cover(vUv);
  vec3 o = c.rgb;
  int m = int(u_blend + 0.5);
  if (u_stroke > 0.0) {
    float r = 0.0;
    for (int i = 0; i < 16; i++) { float an = float(i) * 0.3927; r = max(r, cover(vUv + vec2(cos(an), sin(an)) * refPx(u_stroke))); }
    o = mix(o, blendTo(o, u_strokeColor, m), sat(r - a) * u_opacity);
  }
  o = mix(o, blendTo(o, u_fill, m), a * u_opacity);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "noise",
    name: "Noise",
    category: "Overlay",
    description: "Photographic noise: Gaussian sensor noise with separate luma and chroma, soft film-grain clumps, TV static or coarse grain. Each frame is a fresh, independent field (it boils in place, never slides); speed 0 freezes it.",
    keywords: "static grain texture overlay tv snow sensor iso film",
    preview: "portraits:2",
    animated: (v) => Number(v.speed) > 0,
    params: [
      hero("amount", "Amount", 0, 3, 0.9),
      hero("size", "Size", 0.25, 3, 0.6),
      hero("speed", "Speed (fps)", 0, 60, 0, 1),
      select("type", "Type", ["Sensor", "Film grain", "TV static", "Coarse"]),
      range("floor", "Floor", 0, 0.3, 0.02),
      range("chroma", "Chroma", 0, 1, 0.6),
      ...group("Response", [range("shadow", "Shadow", 0, 1, 1), range("midtone", "Mid-tone", 0, 1, 0.6), range("highlight", "Highlight", 0, 1, 0.4)]),
    ],
    passes: single(`
// Approximately Gaussian, zero-mean noise from four hashes (central limit).
float gauss(vec2 p) { return (hash12(p) + hash12(p + 17.3) + hash12(p + 41.9) + hash12(p + 73.1) - 2.0) * 1.7; }
// Smoothly interpolated Gaussian lattice: soft clumps like film grain or a sensor's
// slightly blurred chroma.
float soft(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gauss(i), gauss(i + vec2(1, 0)), f.x), mix(gauss(i + vec2(0, 1)), gauss(i + 1.0), f.x), f.y);
}
float field(vec2 p, int t) {
  if (t == 0) return gauss(floor(p));
  if (t == 1) return soft(p) * 0.75 + soft(p * 2.1 + 7.0) * 0.45;
  if (t == 2) return gauss(floor(p * vec2(0.5, 1.0))) * 1.3;
  return soft(p * 0.35) * 1.1 + gauss(floor(p)) * 0.3;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  // Size 1 ≈ one pixel at 1080p; the grain stays the same relative size at any export size.
  vec2 px = refCoord(vUv) / u_size;
  float frame = u_speed > 0.5 ? floor(uTime * u_speed) : 0.0;
  // Each frame jumps to an unrelated offset so the noise re-rolls in place instead of sliding.
  vec2 jump = vec2(hash11(frame * 0.618 + uSeed), hash11(frame * 0.414 + uSeed + 3.0)) * 4096.0;
  int t = int(u_type + 0.5);
  float l = field(px + jump, t);
  // Chroma noise is softer and coarser than luma, as on a real sensor.
  vec2 cp = px * 0.5 + jump.yx;
  vec3 ch = vec3(soft(cp), soft(cp + 31.0), soft(cp + 67.0));
  ch -= dot(ch, vec3(0.333));
  float y = luma(c.rgb);
  float resp = mix(mix(u_shadow, u_midtone, smoothstep(0.0, 0.45, y)), u_highlight, smoothstep(0.55, 1.0, y));
  vec3 n = (vec3(l) + ch * u_chroma * 1.5) * 0.06 * u_amount * resp;
  vec3 o = c.rgb + n + u_floor * u_amount * (0.5 + 0.5 * l) * 0.5;
  if (t == 2) o = mix(c.rgb, vec3(l * 0.5 + 0.5), min(u_amount * 0.25, 1.0));
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "blob-tracker",
    name: "Blob Tracker",
    category: "Overlay",
    description: "Computer-vision overlay: boxes, centres, coordinates and links around regions near a key colour.",
    keywords: "tracking boxes cv detection hud surveillance",
    animated: true,
    params: [
      color("key", "Key color", "#FFFFFF"),
      hero("threshold", "Threshold", 0, 1, 0.55, 0.001),
      hero("persistence", "Persistence", 0.5, 0.99, 0.82),
      toggle("debug", "Debug mask"),
      ...group("Boxes", [toggle("randomPalette", "Random palette", 1), color("boxColor", "Box color", "#00F2FF"), select("palette", "Palette set", ["Neon", "Signal", "Mono", "Pastel"]), select("boxType", "Box type", ["Full", "Corners", "Brackets", "Dashed"], 1), select("boxBlend", "Box blend", ["Default", "Screen", "Difference", "Multiply"]), range("thickness", "Box thickness px", 0.5, 8, 1.5, 0.5), range("outline", "Box outline opacity", 0, 1, 1, 0.05), range("fill", "Box fill opacity", 0, 1, 0.12, 0.02)]),
      ...group("Centers", [select("centerType", "Center type", ["None", "Dot", "Cross", "Plus", "Square"], 4), range("centerSize", "Center size px", 1, 16, 3, 0.5)]),
      ...group("Captions", [select("captionPos", "Caption position", ["Off", "Top left", "Top", "Top right", "Right", "Bottom right", "Bottom", "Bottom left", "Left"], 1), range("captionSize", "Caption size px", 6, 48, 22, 1), range("captionBg", "Caption bg opacity", 0, 1, 0.45, 0.05)]),
      ...group("Lines", [select("lineType", "Line type", ["None", "Neighbours", "Chain", "To centre"], 1), select("lineStyle", "Line style", ["Solid", "Dashed", "Dotted", "Glow"], 2)]),
    ],
    aux: () => [glyphAtlas("0123456789XY")],
    passes: [
      {
        // Mask of pixels near the key colour, smoothed over time (persistence).
        id: "mask",
        feedback: true,
        inputs: ["input", "prev"],
        frag: `
void main() {
  vec3 c = texture(uTex0, vUv).rgb;
  float d = length(c - u_key) / 1.732;
  float m = smoothstep(u_threshold, u_threshold - 0.08, d);
  float prev = uHasPrev > 0.5 ? texture(uTex1, vUv).r : m;
  fragColor = vec4(vec3(mix(m, prev, u_persistence)), 1.0);
}`,
      },
      {
        id: "out",
        inputs: ["input", "mask"],
        frag: `
vec3 pal(float i) {
  int p = int(u_palette + 0.5);
  float h = fract(i * 0.618);
  if (p == 0) return hsv2rgb(vec3(h, 0.9, 1.0));
  if (p == 1) return mix(vec3(1.0, 0.15, 0.1), vec3(0.2, 1.0, 0.3), step(0.5, h));
  if (p == 2) return vec3(0.9 + h * 0.1);
  return hsv2rgb(vec3(h, 0.35, 1.0));
}
float glyph(vec2 p, float idx) { if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0; return texture(uAux0, vec2((idx + 0.2 + p.x * 0.6) / 12.0, p.y)).r; }
// Blob in cell: coverage and bounding box (min, max in cell-local 0..1).
vec4 bbox(vec2 cell, vec2 g, out float cov) {
  vec2 mn = vec2(1.0); vec2 mx = vec2(0.0); cov = 0.0;
  for (int j = 0; j < 6; j++) for (int i = 0; i < 6; i++) {
    vec2 l = (vec2(i, j) + 0.5) / 6.0;
    float m = texture(uTex1, (cell + l) / g).r;
    if (m > 0.5) { mn = min(mn, l - 0.08); mx = max(mx, l + 0.08); cov += 1.0 / 36.0; }
  }
  return vec4(mn, mx);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  if (u_debug > 0.5) { fragColor = vec4(mix(c.rgb, vec3(1.0, 0.0, 0.0), texture(uTex1, vUv).r * 0.7), c.a); return; }
  vec2 g = vec2(floor(10.0 * aspect() + 0.5), 10.0);
  vec2 cell = floor(vUv * g);
  vec2 cpx = uRes / g;
  vec3 o = c.rgb;
  float cov;
  vec4 b = bbox(cell, g, cov);
  if (cov > 0.04) {
    vec3 col = u_randomPalette > 0.5 ? pal(hash12(cell + uSeed)) : u_boxColor;
    vec2 l = fract(vUv * g);
    vec2 mn = clamp(b.xy, 0.0, 1.0), mx = clamp(b.zw, 0.0, 1.0);
    vec2 px = (l - mn) * cpx, size = (mx - mn) * cpx;
    float th = u_thickness * refScale();
    bool inBox = all(greaterThanEqual(px, vec2(0.0))) && all(lessThanEqual(px, size));
    float edge = inBox ? step(min(min(px.x, px.y), min(size.x - px.x, size.y - px.y)), th) : 0.0;
    int bt = int(u_boxType + 0.5);
    if (bt == 1) { vec2 q = min(px, size - px); edge *= step(min(q.x, q.y), th) * step(max(q.x, q.y), min(size.x, size.y) * 0.25); }
    if (bt == 2) { edge *= step(min(px.x, size.x - px.x), size.x * 0.12 + th); }
    if (bt == 3) { edge *= step(0.5, fract((px.x + px.y) / (6.0 * refScale()))); }
    int bl = int(u_boxBlend + 0.5);
    vec3 bc = bl == 1 ? blendScreen(o, col) : bl == 2 ? abs(o - col) : bl == 3 ? o * col : col;
    if (inBox) o = mix(o, bc, u_fill);
    o = mix(o, bc, edge * u_outline);
    // Centre marker.
    vec2 cc = (mn + mx) * 0.5 * cpx;
    vec2 d = l * cpx - cc;
    float cs = u_centerSize * refScale();
    int ct = int(u_centerType + 0.5);
    float cm = ct == 1 ? step(length(d), cs) : ct == 2 ? step(abs(abs(d.x) - abs(d.y)), th) * step(max(abs(d.x), abs(d.y)), cs * 2.0) : ct == 3 ? step(min(abs(d.x), abs(d.y)), th * 0.5) * step(max(abs(d.x), abs(d.y)), cs * 2.0) : ct == 4 ? step(abs(max(abs(d.x), abs(d.y)) - cs), th * 0.5) : 0.0;
    o = mix(o, col, cm);
    // Caption: X### Y### of the blob centre.
    int cp = int(u_captionPos + 0.5);
    if (cp > 0) {
      float ch = u_captionSize * refScale();
      vec2 anchor = vec2(cp == 1 || cp == 7 || cp == 8 ? mn.x : cp == 3 || cp == 4 || cp == 5 ? mx.x : (mn.x + mx.x) * 0.5, cp <= 3 ? mx.y : cp >= 5 && cp <= 7 ? mn.y : (mn.y + mx.y) * 0.5) * cpx;
      vec2 tp = (l * cpx - anchor - vec2(0.0, cp <= 3 ? 0.0 : -ch)) / vec2(ch * 0.6, ch);
      vec2 center = (cell + (mn + mx) * 0.5) / g;
      float X = floor(center.x * 999.0), Y = floor((1.0 - center.y) * 999.0);
      float t = 0.0; float digits[8] = float[8](10.0, floor(X / 100.0), mod(floor(X / 10.0), 10.0), mod(X, 10.0), 11.0, floor(Y / 100.0), mod(floor(Y / 10.0), 10.0), mod(Y, 10.0));
      for (int k = 0; k < 8; k++) t = max(t, glyph(tp - vec2(float(k), 0.0), digits[k]));
      bool inCap = tp.x >= 0.0 && tp.x <= 8.0 && tp.y >= 0.0 && tp.y <= 1.0;
      if (inCap) o = mix(o, vec3(0.0), u_captionBg);
      o = mix(o, col, t);
    }
  }
  // Links between neighbouring blobs.
  int lt = int(u_lineType + 0.5);
  if (lt > 0) {
    float cov2; bbox(cell + vec2(1.0, 0.0), g, cov2);
    float cov3; bbox(cell + vec2(0.0, 1.0), g, cov3);
    vec2 l = fract(vUv * g) * cpx;
    float th = max(u_thickness * 0.6, 0.8) * refScale();
    float on = 0.0;
    if (cov > 0.04 && cov2 > 0.04 && lt != 3) on = max(on, step(abs(l.y - cpx.y * 0.5), th));
    if (cov > 0.04 && cov3 > 0.04 && lt == 1) on = max(on, step(abs(l.x - cpx.x * 0.5), th));
    if (lt == 3 && cov > 0.04) { vec2 d = vUv - 0.5; vec2 n = normalize(vec2(-d.y, d.x)); on = max(on, step(abs(dot((vUv - (cell + 0.5) / g) * uRes, n)), th) * step(0.0, dot(d, (cell + 0.5) / g - 0.5))); }
    int ls = int(u_lineStyle + 0.5);
    float s = (l.x + l.y) / refScale();
    if (ls == 1) on *= step(0.5, fract(s / 10.0));
    if (ls == 2) on *= step(0.6, fract(s / 4.0));
    vec3 lc = u_randomPalette > 0.5 ? pal(hash12(cell + uSeed)) : u_boxColor;
    o = mix(o, lc, on * (ls == 3 ? 0.6 : 1.0));
  }
  fragColor = vec4(sat(o), c.a);
}`,
      },
    ],
  },
  {
    id: "layer-mix",
    name: "Layer mix",
    category: "Overlay",
    description: "Lay a texture or image over the stack with a blend mode, tone curve, blend-if ranges, chroma key and matte.",
    keywords: "texture paper overlay blend image composite double exposure crumpled folded grunge dust glass key",
    preview: "editorial:12",
    params: [
      ...group("Main", [
        select("texture", "Texture", SURFACE_NAMES, 8),
        image("custom", "Custom image", ""),
        select("fit", "Fit type", ["Fill", "Stretch", "Tile"]),
        select("blend", "Blend mode", LM_BLENDS, 1),
        hero("opacity", "Opacity", 0, 1, 1),
        hero("scale", "Scale", 0.1, 5, 1),
        range("rotation", "Rotation", -180, 180, 0, 1, { unit: "°" }),
      ]),
      ...group("Edit", [curve("curve", "Texture curve", "0,0 1,1"), select("channel", "Curve channel", ["Gray", "Red", "Green", "Blue"])]),
      ...group("Blend if", [
        range("thisLo", "This layer from", 0, 1, 0), range("thisHi", "This layer to", 0, 1, 1),
        range("underLo", "Underlying from", 0, 1, 0), range("underHi", "Underlying to", 0, 1, 1),
      ]),
      ...group("Key", [toggle("key", "Key"), color("keyColor", "Key color", "#00C745"), range("tolerance", "Tolerance", 0, 1, 0.05), range("softness", "Softness", 0, 0.5, 0.1), range("despill", "Despill", 0, 1, 1)]),
      ...group("Matte", [select("matte", "Matte", ["None", "Alpha", "Luma"]), toggle("invertMatte", "Invert matte")]),
    ],
    aux: (v) => [String(v.custom || "") ? imageTexture(String(v.custom)) : surfaceTexture(Number(v.texture)), curvesLut([String(v.curve)])],
    passes: single(`
vec2 texUv(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0);
  p = rot(radians(u_rotation)) * p / u_scale;
  float ta = uAuxRes0.x / max(uAuxRes0.y, 1.0);
  int fit = int(u_fit + 0.5);
  if (fit == 1) return p / vec2(aspect(), 1.0) + 0.5;
  if (fit == 2) return p * uRes.y / (uAuxRes0.y * refScale()) * vec2(1.0 / ta, 1.0) + 0.5;
  float s = max(1.0, aspect() / ta);
  return p / vec2(s * ta, s) + 0.5;
}
vec3 mixMode(vec3 b, vec3 s, int m) {
  if (m == 1) return b * s;
  if (m == 2) return blendScreen(b, s);
  if (m == 3) return blendOverlay(b, s);
  if (m == 4) return blendSoftLight(b, s);
  if (m == 5) return blendOverlay(s, b);
  if (m == 6) return b / max(1.0 - s, 1e-3);
  if (m == 7) return step(1.0, b + s);
  return s;
}
float band(float x, float lo, float hi) {
  if (lo <= 0.001 && hi >= 0.999) return 1.0;
  return smoothstep(lo - 0.04, lo + 0.04, x) * (1.0 - smoothstep(hi - 0.04, hi + 0.04, x));
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 tuv = texUv(vUv);
  bool outside = u_fit < 1.5 && (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0);
  vec4 t = texture(uAux0, tuv);
  // Tone curve on the texture: all channels (Gray) or one of them.
  int ch = int(u_channel + 0.5);
  vec3 tc = t.rgb;
  if (ch == 0) tc = vec3(lut1(uAux1, tc.r, 0.0, 1.0).r, lut1(uAux1, tc.g, 0.0, 1.0).r, lut1(uAux1, tc.b, 0.0, 1.0).r);
  else if (ch == 1) tc.r = lut1(uAux1, tc.r, 0.0, 1.0).r;
  else if (ch == 2) tc.g = lut1(uAux1, tc.g, 0.0, 1.0).r;
  else tc.b = lut1(uAux1, tc.b, 0.0, 1.0).r;
  float a = t.a;
  if (u_key > 0.5) {
    vec3 kd = rgb2oklab(tc) - rgb2oklab(u_keyColor);
    float d = length(kd.yz) + abs(kd.x) * 0.25;
    float k = smoothstep(u_tolerance * 0.5, u_tolerance * 0.5 + u_softness * 0.5 + 1e-3, d);
    a *= k;
    // Despill: pull the key hue out of what is left.
    vec3 kn = normalize(u_keyColor + 1e-3);
    float spill = max(0.0, dot(tc, kn) - luma(tc)) * u_despill;
    tc -= kn * spill * (1.0 - k);
  }
  int mt = int(u_matte + 0.5);
  float matte = mt == 1 ? t.a : mt == 2 ? luma(tc) : 1.0;
  if (u_invertMatte > 0.5 && mt > 0) matte = 1.0 - matte;
  float w = u_opacity * a * matte * band(luma(tc), u_thisLo, u_thisHi) * band(luma(c.rgb), u_underLo, u_underHi);
  if (outside) w = 0.0;
  vec3 o = mixMode(c.rgb, sat(tc), int(u_blend + 0.5));
  fragColor = vec4(mix(c.rgb, sat(o), w), c.a);
}`),
  },
  {
    id: "scanlines",
    name: "Scanlines",
    category: "Overlay",
    description: "Horizontal raster lines with optional rolling bar — the screen texture on its own.",
    keywords: "lines raster crt monitor overlay",
    preview: "neon:2",
    animated: true,
    params: [hero("lines", "Line spacing", 1.5, 20, 3, 0.25, { unit: "px" }), hero("amount", "Darkness", 0, 1, 0.45), range("roll", "Rolling bar", 0, 1, 0.2), range("speed", "Roll speed", 0, 2, 0.3), toggle("vertical", "Vertical")],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 px = refCoord(vUv);
  float coord = u_vertical > 0.5 ? px.x : px.y;
  float s = 0.5 + 0.5 * cos(coord / u_lines * TAU);
  float bar = smoothstep(0.0, 0.15, abs(fract(vUv.y - uTime * u_speed * 0.2) - 0.5) - 0.3) * u_roll;
  fragColor = vec4(c.rgb * (1.0 - u_amount * s) * (1.0 - bar * 0.15 + u_roll * 0.075), c.a);
}`),
  },
  {
    id: "grid-overlay",
    name: "Grid overlay",
    category: "Overlay",
    description: "Lab-equipment HUD: measurement grid, crosshair and registration marks.",
    keywords: "grid blueprint hud crosshair registration marks",
    preview: "celltower:1",
    params: [
      hero("spacing", "Grid spacing", 10, 300, 60, 1, { unit: "px" }),
      hero("opacity", "Opacity", 0, 1, 0.35),
      toggle("crosshair", "Crosshair", 1),
      toggle("marks", "Registration marks", 1),
      range("sub", "Sub-divisions", 1, 10, 4, 1),
      color("ink", "Colour", "#F7F2EC"),
    ],
    passes: single(`
float gridLine(vec2 px, float sp, float w) { vec2 g = abs(fract(px / sp + 0.5) - 0.5) * sp; return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.8, min(g.x, g.y)); }
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 px = (vUv - 0.5) * uRes / refScale();
  float m = gridLine(px, u_spacing, 1.0) * 0.8 + gridLine(px, u_spacing / u_sub, 0.6) * 0.3;
  if (u_crosshair > 0.5) {
    vec2 a = abs(px);
    m = max(m, (1.0 - smoothstep(0.6, 1.4, a.x)) * step(a.y, 60.0) + (1.0 - smoothstep(0.6, 1.4, a.y)) * step(a.x, 60.0));
    m = max(m, 1.0 - smoothstep(1.0, 2.0, abs(length(px) - 26.0)));
  }
  if (u_marks > 0.5) {
    vec2 h = uRes / refScale() * 0.5 - 40.0;
    vec2 q = abs(px) - h;
    float corner = step(abs(q.x), 16.0) * (1.0 - smoothstep(0.6, 1.4, abs(q.y))) + step(abs(q.y), 16.0) * (1.0 - smoothstep(0.6, 1.4, abs(q.x)));
    m = max(m, sat(corner));
  }
  fragColor = vec4(mix(c.rgb, u_ink, sat(m) * u_opacity), c.a);
}`),
  },
  {
    id: "gradient-overlay",
    name: "Gradient overlay",
    category: "Overlay",
    description: "Linear or radial colour gradient laid over the image with a blend mode.",
    keywords: "gradient tint wash sky fade",
    preview: "beach:2",
    handles: [{ x: "cx", y: "cy", label: "Origin" }],
    params: [
      gradient("ramp", "Gradient", "#FF4A1C@0,#3A0CA3@1"),
      select("shape", "Shape", ["Linear", "Radial"]),
      select("blend", "Blend", ["Soft light", "Overlay", "Screen", "Multiply", "Color", "Normal"]),
      hero("amount", "Amount", 0, 1, 0.6),
      angle("angle", "Angle", 90),
      range("cx", "Origin X", 0, 1, 0.5),
      range("cy", "Origin Y", 0, 1, 0.5),
      range("spread", "Spread", 0.1, 2, 1),
    ],
    aux: (v) => [gradientLut(String(v.ramp))],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 p = (vUv - vec2(u_cx, u_cy)) * vec2(aspect(), 1.0);
  float t = u_shape < 0.5 ? dot(p, vec2(cos(radians(u_angle)), sin(radians(u_angle)))) / u_spread + 0.5 : length(p) / u_spread * 1.4;
  vec3 g = lut1(uAux0, t, 0.0, 1.0);
  int b = int(u_blend + 0.5);
  vec3 o = b == 0 ? blendSoftLight(c.rgb, g) : b == 1 ? blendOverlay(c.rgb, g) : b == 2 ? blendScreen(c.rgb, g) : b == 3 ? c.rgb * g : b == 4 ? sat(g + (luma(c.rgb) - luma(g))) : g;
  fragColor = vec4(mix(c.rgb, o, u_amount), c.a);
}`),
  },
];
