import { glyphAtlas, gradientLut, imageTexture, textTexture, TEXT_FONTS } from "../../lib/textures";
import { angle, color, gradient, group, hero, image, range, select, single, text, toggle, type EffectDef } from "../types";
import { BLEND_MODES } from "../../engine/glsl";

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
    name: "Texture",
    category: "Overlay",
    description: "Procedural surfaces laid over the image: crumpled, folded, tracing and thin paper, cardboard, paper towel, cracked paint, broken glass, dust and canvas. Blend, scale and rotate them like a texture layer.",
    keywords: "paper crumpled folded tracing overlay texture surface cracks glass canvas towel",
    preview: "editorial:12",
    params: [
      select("kind", "Texture", ["Crumpled paper", "Folded paper", "Tracing paper", "Thin paper", "Cardboard", "Paper towel", "Cracked paint", "Broken glass", "Dust & scratches", "Canvas"]),
      hero("opacity", "Opacity", 0, 1, 0.8),
      hero("scale", "Scale", 0.25, 4, 1),
      range("rotation", "Rotation", -180, 180, 0, 1, { unit: "°" }),
      select("blend", "Blend", ["Overlay", "Multiply", "Screen", "Soft light", "Emboss (light)"]),
      range("relief", "Relief", 0, 2, 1),
      range("displace", "Displace image", 0, 1, 0.25),
      color("tint", "Paper tint", "#F2EEE6"),
      range("tintAmount", "Tint amount", 0, 1, 0),
      range("variation", "Variation", 0, 100, 0, 1),
    ],
    passes: single(`
float creases(vec2 p) {
  // Crumpled paper: sharp ridges from layered Voronoi cell borders.
  vec2 a = worley(p * 3.0); vec2 b = worley(p * 7.0 + 3.1); vec2 c = worley(p * 15.0 + 7.7);
  return (a.y - a.x) * 0.55 + (b.y - b.x) * 0.3 + (c.y - c.x) * 0.15;
}
float heightAt(vec2 p, int k, float s) {
  if (k == 0) return creases(p) * 1.2 + fbm(p * 18.0) * 0.08;
  if (k == 1) {
    // Folded: a few straight folds with soft shading on either side.
    float h = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 n = normalize(vec2(cos(fi * 2.3 + s), sin(fi * 2.3 + s)));
      float d = dot(p - vec2(0.5 + 0.2 * sin(fi * 1.7 + s), 0.5 + 0.2 * cos(fi * 2.9 + s)), n);
      h += exp(-abs(d) * 40.0) * (mod(fi, 2.0) * 2.0 - 1.0) * 0.6 + smoothstep(0.0, 0.3, abs(d)) * 0.05;
    }
    return h + fbm(p * 30.0) * 0.05;
  }
  if (k == 2) return fbm(p * 6.0) * 0.25 + fbm(p * vec2(80.0, 12.0)) * 0.1;
  if (k == 3) return fbm(p * vec2(120.0, 30.0)) * 0.25 + fbm(p * 4.0) * 0.2;
  if (k == 4) return abs(sin(p.y * 60.0)) * 0.3 + fbm(p * 40.0) * 0.25;
  if (k == 5) {
    // Paper towel: embossed swirl quilting.
    vec2 q = p * 9.0; vec2 f = fract(q) - 0.5;
    float r = length(f);
    float sw = sin(r * 30.0 - atan(f.y, f.x) * 2.0) * 0.5 + 0.5;
    return sw * smoothstep(0.5, 0.3, r) * 0.6 + fbm(p * 60.0) * 0.15;
  }
  if (k == 6) { vec2 w = worley(p * 6.0); return smoothstep(0.0, 0.06, w.y - w.x) * 0.8 + fbm(p * 12.0) * 0.2; }
  if (k == 7) { vec2 w = worley(p * 2.5 + 1.3); return (1.0 - smoothstep(0.0, 0.02, w.y - w.x)) + w.x * 0.3; }
  if (k == 8) {
    float d = step(0.9985, hash12(floor(p * 900.0)));
    float sc = step(0.995, hash11(floor(p.x * 300.0))) * step(0.3, fbm(vec2(p.x * 300.0, p.y * 3.0)));
    return d + sc * 0.7 + fbm(p * 5.0) * 0.1;
  }
  vec2 q = p * vec2(140.0, 140.0);
  return (sin(q.x) * 0.5 + 0.5) * (sin(q.y) * 0.5 + 0.5) * 0.4 + fbm(p * 30.0) * 0.2;
}
void main() {
  int k = int(u_kind + 0.5);
  float s = u_variation * 0.173;
  vec2 p = vUv - 0.5;
  p.x *= aspect();
  p = rot(radians(u_rotation)) * p / u_scale + 0.5 + s;
  float e = 0.0015 / u_scale;
  float h = heightAt(p, k, s);
  float hx = heightAt(p + vec2(e, 0.0), k, s) - h;
  float hy = heightAt(p + vec2(0.0, e), k, s) - h;
  vec2 grad = vec2(hx, hy) / e;
  vec3 n = normalize(vec3(-grad * 0.12 * u_relief, 1.0));
  float light = dot(n, normalize(vec3(-0.5, 0.6, 0.65))) * 0.5 + 0.5;
  vec2 duv = vUv + grad * 0.00025 * u_displace / u_scale;
  vec4 c = texture(uTex0, duv);
  float tex = sat(light);
  if (k == 7) tex = mix(tex, 1.0 - h, 0.5);
  vec3 t3 = mix(vec3(tex), vec3(tex) * u_tint, u_tintAmount);
  int b = int(u_blend + 0.5);
  vec3 o;
  if (b == 0) o = blendOverlay(c.rgb, t3);
  else if (b == 1) o = c.rgb * (t3 * 0.6 + 0.4) * 1.25;
  else if (b == 2) o = blendScreen(c.rgb, t3 * 0.7);
  else if (b == 3) o = blendSoftLight(c.rgb, t3);
  else o = c.rgb * (0.45 + light * 1.1);
  o = mix(o, o * u_tint, u_tintAmount * 0.6);
  fragColor = vec4(mix(c.rgb, sat(o), u_opacity), c.a);
}`),
  },
  {
    id: "noise",
    name: "Noise",
    category: "Overlay",
    description: "Sensor-style noise with luma and chroma components, a noise floor and per-tone response; static or refreshed at a set rate.",
    keywords: "static grain texture overlay tv snow sensor iso",
    preview: "portraits:2",
    animated: true,
    params: [
      hero("amount", "Amount", 0, 3, 0.9),
      hero("size", "Size", 0.5, 3, 1),
      hero("speed", "Speed (fps)", 0, 60, 0, 1),
      range("floor", "Floor", 0, 0.3, 0.02),
      range("chroma", "Chroma", 0, 1, 0.8),
      ...group("Response", [range("shadow", "Shadow", 0, 1, 1), range("midtone", "Mid-tone", 0, 1, 0.5), range("highlight", "Highlight", 0, 1, 0.8)]),
      select("type", "Type", ["Sensor", "TV static", "Simplex", "Cellular", "Fibres"]),
    ],
    passes: single(`
float n1(vec2 p, int t, float time) {
  if (t == 0) return hash12(floor(p) + time * 71.0) + hash12(floor(p) * 1.37 + time * 17.0) - 1.0;
  if (t == 1) return hash12(floor(p * vec2(1.0, 0.5)) + time * 71.0) * 2.0 - 1.0;
  if (t == 2) return snoise(p * 0.08 + time);
  if (t == 3) return worley(p * 0.05 + time).x * 2.0 - 1.0;
  return smoothstep(0.4, 0.6, fbm(vec2(p.x * 0.01, p.y * 0.2) + time)) * 2.0 - 1.0;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 px = refCoord(vUv) / u_size;
  float time = u_speed > 0.5 ? floor(uTime * u_speed) : 0.0;
  time += uSeed;
  int t = int(u_type + 0.5);
  float l = n1(px, t, time);
  vec3 ch = vec3(n1(px + 17.0, t, time), n1(px + 41.0, t, time), n1(px + 73.0, t, time));
  float y = luma(c.rgb);
  float resp = mix(mix(u_shadow, u_midtone, smoothstep(0.0, 0.45, y)), u_highlight, smoothstep(0.55, 1.0, y));
  vec3 n = mix(vec3(l), ch, u_chroma) * 0.12 * u_amount * resp;
  vec3 o = c.rgb + n + u_floor * (vec3(l) * 0.5 + 0.5) * u_amount;
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
