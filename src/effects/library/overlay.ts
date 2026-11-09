import { glyphAtlas, gradientLut, imageTexture, textTexture, TEXT_FONTS } from "../../lib/textures";
import { angle, color, gradient, group, hero, image, range, select, single, text, toggle, type EffectDef } from "../types";
import { BLEND_MODES } from "../../engine/glsl";

/**
 * Photographed surfaces for the Texture effect (Unsplash, free licence; credited in the README).
 * Image ids are hot-linked from images.unsplash.com as the Unsplash guidelines require.
 */
export const TEXTURES = [
  { name: "Crumpled paper", id: "1776278515793-c4d7fbf04369", by: "sigmund" },
  { name: "Crumpled kraft", id: "1603484477859-abe6a73f9366", by: "sjobjio" },
  { name: "Folded paper", id: "1691415780572-de7c176a3b18", by: "bartco86" },
  { name: "Lined paper", id: "1783700697126-8055c3c15baa", by: "umuthasanoglu" },
  { name: "Thin paper", id: "1737276746515-19ea864a6b80", by: "sanches812" },
  { name: "Tracing paper", id: "1707134657472-51902d2854a4", by: "heathergreengreen" },
  { name: "Cardboard", id: "1776278515671-fe179ba9cfd3", by: "sigmund" },
  { name: "Paper towel", id: "1771231591303-8e0daa821513", by: "msaimakin" },
  { name: "Cracked paint", id: "1475965894430-b05c9d13568a", by: "creativejunkie" },
  { name: "Broken glass", id: "1767044202331-c3a0a7cbdf43", by: "leftfield_corn" },
  { name: "Dust", id: "1768956463493-a8118a41b629", by: "linusbelanger" },
  { name: "Linen", id: "1764437835706-ba9d63250bd2", by: "loganvoss" },
];
const textureUrl = (i: number) => `https://images.unsplash.com/photo-${(TEXTURES[i] ?? TEXTURES[0]).id}?w=2000&q=80&auto=format`;

const DEFAULT_MIX_IMAGE = "https://images.unsplash.com/photo-1547070451-ce386c65160a?w=1600&q=80&auto=format";

export const overlay: EffectDef[] = [
  {
    id: "text",
    name: "Text",
    category: "Overlay",
    description: "Type set in the brand faces, placed, rotated and tracked — with outline, shadow or knockout.",
    keywords: "type typography title caption words font",
    preview: "citynight:2",
    handles: [{ x: "x", y: "y", label: "Text" }],
    params: [
      text("content", "Text", "THE CHAOS\nTO CREATE", { multiline: true, maxLength: 400 }),
      select("font", "Font", TEXT_FONTS.map((f) => f.label)),
      hero("size", "Size", 0.02, 1, 0.12),
      range("weight", "Weight", 100, 900, 400, 100),
      range("tracking", "Tracking", -0.1, 1, 0.3),
      select("align", "Align", ["Left", "Centre", "Right"], 1),
      angle("rotation", "Rotation", 0),
      range("x", "Position X", 0, 1, 0.5),
      range("y", "Position Y", 0, 1, 0.5),
      color("fill", "Colour", "#F7F2EC"),
      select("mode", "Mode", ["Fill", "Outline", "Knockout", "Invert"]),
      ...group("Effects", [range("outline", "Outline width", 0, 10, 2, 0.1, { unit: "px" }), range("shadow", "Shadow", 0, 1, 0), range("glow", "Glow", 0, 1, 0)]),
    ],
    aux: (v) => [textTexture(String(v.content), Number(v.font), Number(v.weight), Number(v.tracking), Number(v.align))],
    passes: single(`
float cover(vec2 uv) {
  vec2 p = (uv - vec2(u_x, u_y)) * vec2(aspect(), 1.0);
  p = rot(-radians(u_rotation)) * p;
  float h = u_size * uAuxRes0.y / 190.0;
  vec2 box = vec2(h * uAuxRes0.x / uAuxRes0.y, h);
  vec2 t = p / box + 0.5;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return 0.0;
  return texture(uAux0, t).r;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float a = cover(vUv);
  int m = int(u_mode + 0.5);
  vec3 o = c.rgb;
  if (u_shadow > 0.0) o = mix(o, vec3(0.0), cover(vUv - refPx(6.0) * vec2(-1.0, 1.0)) * u_shadow * 0.7);
  if (u_glow > 0.0) { float g = 0.0; for (int i = 0; i < 8; i++) { float an = float(i) * 0.785; g += cover(vUv + vec2(cos(an), sin(an)) * refPx(10.0)); } o = blendScreen(o, u_fill * g / 8.0 * u_glow); }
  if (m == 0) o = mix(o, u_fill, a);
  else if (m == 1) {
    float r = 0.0;
    for (int i = 0; i < 12; i++) { float an = float(i) * 0.5236; r = max(r, cover(vUv + vec2(cos(an), sin(an)) * refPx(u_outline))); }
    o = mix(o, u_fill, sat(r - a));
  }
  else if (m == 2) o = mix(u_fill, o, a);
  else o = mix(o, 1.0 - o, a);
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "paper-texture",
    name: "Layer mix",
    category: "Overlay",
    description: "Real photographed surfaces (Unsplash) laid over the image: crumpled, folded, lined, thin and tracing paper, cardboard, paper towel, cracked paint, broken glass, dust and linen. The texture is neutralised so it adds relief and grain without shifting exposure.",
    keywords: "paper crumpled folded tracing overlay texture surface cracks glass canvas towel linen dust",
    preview: "editorial:12",
    params: [
      select("kind", "Texture", TEXTURES.map((t) => t.name)),
      hero("opacity", "Opacity", 0, 1, 0.8),
      hero("scale", "Scale", 0.5, 3, 1),
      range("rotation", "Rotation", -180, 180, 0, 1, { unit: "°" }),
      select("blend", "Blend", ["Overlay", "Multiply", "Screen", "Soft light", "Light relief"]),
      range("contrast", "Texture contrast", 0, 3, 1.8),
      range("displace", "Displace image", 0, 1, 0.2),
      range("color", "Texture colour", 0, 1, 0),
    ],
    aux: (v) => [imageTexture(textureUrl(Number(v.kind) | 0))],
    passes: single(`
vec2 texUv(vec2 uv) {
  // Cover-fit the photo to the frame, then scale and rotate around the centre.
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0);
  p = rot(radians(u_rotation)) * p / u_scale;
  float ta = uAuxRes0.x / max(uAuxRes0.y, 1.0);
  // Height-based cover: the texture always fills the frame, whatever either aspect is.
  float s = max(1.0, aspect() / ta);
  return p / vec2(s * ta, s) + 0.5;
}
float tl(vec2 uv) { return luma(texture(uAux0, uv).rgb); }
void main() {
  vec2 tuv = texUv(vUv);
  vec3 tex = texture(uAux0, tuv).rgb;
  // Local mean of the texture (wide 9-tap) so the overlay is centred on mid-grey.
  float m = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) m += tl(tuv + vec2(float(i), float(j)) * 0.04);
  m /= 9.0;
  float d = (luma(tex) - m) * u_contrast;
  // Relief from the photo itself: its luminance gradient lights the surface and nudges the image.
  vec2 e = 1.5 / uAuxRes0;
  vec2 grad = vec2(tl(tuv + vec2(e.x, 0.0)) - tl(tuv - vec2(e.x, 0.0)), tl(tuv + vec2(0.0, e.y)) - tl(tuv - vec2(0.0, e.y)));
  vec4 c = texture(uTex0, vUv + grad * 0.02 * u_displace);
  vec3 t3 = mix(vec3(0.5 + d), 0.5 + (tex - m) * u_contrast, u_color);
  int b = int(u_blend + 0.5);
  vec3 o;
  if (b == 0) o = blendOverlay(c.rgb, sat(t3));
  else if (b == 1) o = c.rgb * sat(mix(vec3(1.0 + min(d, 0.0) * 2.0), tex / max(m, 0.05), u_color));
  else if (b == 2) o = blendScreen(c.rgb, sat(vec3(max(d, 0.0) * 2.0)));
  else if (b == 3) o = blendSoftLight(c.rgb, sat(t3));
  else o = c.rgb * (1.0 + dot(grad, vec2(-0.7, 0.7)) * 4.0 * u_contrast + d * 0.5);
  fragColor = vec4(mix(c.rgb, sat(o), u_opacity), c.a);
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
    name: "Blob tracker",
    category: "Overlay",
    description: "Computer-vision overlay: tracking boxes lock onto high-contrast regions, with IDs and links.",
    keywords: "tracking boxes cv detection hud surveillance",
    preview: "street:0",
    animated: true,
    params: [
      hero("cells", "Grid", 4, 40, 14, 1),
      hero("threshold", "Sensitivity", 0, 1, 0.45),
      range("links", "Links", 0, 1, 0.5),
      range("labels", "Labels", 0, 1, 1),
      range("fill", "Box fill", 0, 1, 0.12),
      color("tint", "Colour", "#4CFF7A"),
      toggle("animate", "Jitter", 1),
    ],
    aux: () => [glyphAtlas("0123456789ABCDEF")],
    passes: single(`
float interest(vec2 cell, vec2 g) {
  vec2 c = (cell + 0.5) / g;
  vec2 o = 0.3 / g;
  float a = luma(texture(uTex0, c).rgb);
  float b = luma(texture(uTex0, c + o).rgb);
  float d = luma(texture(uTex0, c - o).rgb);
  float e = luma(texture(uTex0, c + vec2(o.x, -o.y)).rgb);
  float f = luma(texture(uTex0, c + vec2(-o.x, o.y)).rgb);
  float lo = min(min(min(a, b), min(d, e)), f);
  float hi = max(max(max(a, b), max(d, e)), f);
  return (hi - lo) * 2.2 + a * 0.35;
}
float glyph(vec2 p, float idx) { if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0; return texture(uAux0, vec2((idx + 0.2 + p.x * 0.6) / 16.0, p.y)).r; }
void main() {
  vec3 c = texture(uTex0, vUv).rgb;
  vec2 g = vec2(floor(u_cells * aspect()), u_cells);
  vec2 cell = floor(vUv * g);
  vec2 f = fract(vUv * g);
  float t = u_animate > 0.5 ? floor(uTime * 8.0) : 0.0;
  float line = 0.0; float fillA = 0.0; float txt = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cc = cell + vec2(float(i), float(j));
    float k = interest(cc, g);
    if (k < 1.0 - u_threshold || hash12(cc + uSeed) > 0.55) continue;
    vec2 jit = (hash22(cc + t) - 0.5) * 0.15;
    vec2 size = 0.4 + hash22(cc + 3.0) * 0.9;
    vec2 q = (vUv * g - (cc + 0.5 + jit)) / size;
    vec2 aq = abs(q);
    float w = 1.5 / (uRes.y / g.y) / min(size.x, size.y);
    float edge = step(max(aq.x, aq.y), 0.5) * step(0.5 - w * 1.5, max(aq.x, aq.y));
    line = max(line, edge);
    fillA = max(fillA, step(max(aq.x, aq.y), 0.5));
    vec2 lp = (q - vec2(-0.5, 0.52)) * vec2(size.x * 6.0, size.y * 4.0) / vec2(0.62, 1.0);
    float id = floor(hash12(cc) * 65535.0);
    for (int d = 0; d < 4; d++) {
      float digit = mod(floor(id / pow(16.0, float(3 - d))), 16.0);
      txt = max(txt, glyph(lp - vec2(float(d), 0.0), digit) * u_labels);
    }
  }
  // Links: thin lines from this cell's box to the next active cell to the right.
  float k0 = interest(cell, g);
  float k1 = interest(cell + vec2(1.0, 1.0), g);
  if (k0 >= 1.0 - u_threshold && k1 >= 1.0 - u_threshold && hash12(cell + uSeed) <= 0.55 && hash12(cell + 1.0 + uSeed) <= 0.55) {
    float dl = abs(f.y - f.x) * uRes.y / g.y;
    line = max(line, step(dl, 1.0) * u_links);
  }
  vec3 o = mix(c, u_tint, fillA * u_fill);
  o = mix(o, u_tint, max(line, txt));
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "layer-mix",
    name: "Layer mix",
    category: "Overlay",
    description: "Blend a second image (Unsplash, URL or upload) over the stack with any blend mode.",
    keywords: "double exposure blend overlay texture image composite",
    preview: "smoke:2",
    params: [
      image("image", "Image", DEFAULT_MIX_IMAGE),
      select("mode", "Blend", [...BLEND_MODES], 2),
      hero("amount", "Amount", 0, 1, 0.7),
      range("scale", "Scale", 0.2, 4, 1),
      range("x", "Offset X", -1, 1, 0),
      range("y", "Offset Y", -1, 1, 0),
      select("fit", "Fit", ["Cover", "Tile"]),
      toggle("lumaMask", "Mask by brightness"),
    ],
    aux: (v) => [imageTexture(String(v.image))],
    passes: single(`
vec3 setLum(vec3 c, float l) { return c + (l - luma(c)); }
vec3 blendAll(vec3 b, vec3 s, int m) {
  if (m == 1) return b * s;
  if (m == 2) return blendScreen(b, s);
  if (m == 3) return blendOverlay(b, s);
  if (m == 4) return blendSoftLight(b, s);
  if (m == 5) return min(b + s, 1.0);
  if (m == 6) return abs(b - s);
  if (m == 7) return min(b, s);
  if (m == 8) return max(b, s);
  if (m == 9) return sat(setLum(s, luma(b)));
  if (m == 10) return sat(setLum(b, luma(s)));
  if (m == 11) return b / max(1.0 - s, 1e-3);
  if (m == 12) return 1.0 - (1.0 - b) / max(s, 1e-3);
  if (m == 13) return b + s - 2.0 * b * s;
  if (m == 14) { vec3 hb = rgb2hsv(b); vec3 hs = rgb2hsv(s); return hsv2rgb(vec3(hs.x, hb.y, hb.z)); }
  return s;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float ia = uAuxRes0.x / max(uAuxRes0.y, 1.0);
  vec2 p = (vUv - 0.5 - vec2(u_x, u_y) * 0.5) / u_scale;
  if (u_fit < 0.5) { if (ia > aspect()) p.x *= aspect() / ia; else p.y *= ia / aspect(); }
  else p *= vec2(aspect() / ia, 1.0) * 2.0;
  vec3 s = texture(uAux0, p + 0.5).rgb;
  float k = u_amount * (u_lumaMask > 0.5 ? luma(s) : 1.0);
  fragColor = vec4(mix(c.rgb, sat(blendAll(c.rgb, s, int(u_mode + 0.5))), k), c.a);
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
