import { angle, color, hero, range, select, single, toggle, type EffectDef } from "../types";

/** Generalised Kuwahara (4 sectors) with a configurable sample stride. */
const KUWAHARA = `
vec3 kuwahara(sampler2D t, vec2 uv, float radiusPx) {
  vec2 st = vec2(radiusPx / 4.0) / uRes;
  vec3 m[4]; vec3 s[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
  for (int j = 0; j <= 4; j++) for (int i = 0; i <= 4; i++) {
    vec3 a = texture(t, uv + vec2(-float(i), -float(j)) * st).rgb; m[0] += a; s[0] += a * a;
    vec3 b = texture(t, uv + vec2(float(i), -float(j)) * st).rgb; m[1] += b; s[1] += b * b;
    vec3 c = texture(t, uv + vec2(float(i), float(j)) * st).rgb; m[2] += c; s[2] += c * c;
    vec3 d = texture(t, uv + vec2(-float(i), float(j)) * st).rgb; m[3] += d; s[3] += d * d;
  }
  float best = 1e9; vec3 outc = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    vec3 mean = m[k] / 25.0;
    vec3 v = abs(s[k] / 25.0 - mean * mean);
    float var = v.r + v.g + v.b;
    if (var < best) { best = var; outc = mean; }
  }
  return outc;
}
`;

/** Extended difference-of-Gaussians edge response (1 = paper, 0 = line). */
const XDOG = `
float xdog(sampler2D t, vec2 uv, float sigma, float k, float tau, float eps, float phi) {
  float g1 = luma(blur13(t, uv, refPx(sigma)).rgb);
  float g2 = luma(blur13(t, uv, refPx(sigma * k)).rgb);
  float d = g1 - tau * g2;
  return d >= eps ? 1.0 : 1.0 + tanh(phi * (d - eps));
}
`;

export const draw: EffectDef[] = [
  {
    id: "pencil",
    name: "Pencil sketch",
    category: "Draw",
    description: "Graphite drawing: XDoG contour lines with directional shading strokes on toothy paper.",
    keywords: "sketch drawing graphite xdog lines",
    preview: "woman:5",
    params: [
      hero("lines", "Line weight", 0.5, 6, 1.6, 0.05),
      hero("shading", "Shading", 0, 1, 0.65),
      range("detail", "Detail", 0.85, 1, 0.97, 0.001),
      angle("strokeAngle", "Stroke angle", 35),
      range("tooth", "Paper tooth", 0, 1, 0.5),
      color("graphite", "Graphite", "#2B2A28"),
      color("paper", "Paper", "#F2EEE6"),
      toggle("color", "Coloured pencil"),
    ],
    passes: single(XDOG + `
void main() {
  vec2 px = refCoord(vUv);
  float line = xdog(uTex0, vUv, u_lines, 1.6, u_detail, 0.0, 60.0);
  vec3 c = texture(uTex0, vUv).rgb;
  float l = luma(blur13(uTex0, vUv, refPx(3.0)).rgb);
  vec2 sp = rot(radians(u_strokeAngle)) * px;
  float stroke = sin(sp.y * 0.9 + vnoise(sp * vec2(0.02, 0.3)) * 6.0) * 0.5 + 0.5;
  float stroke2 = sin((rot(1.1) * px).y * 0.7 + vnoise(px * 0.05) * 5.0) * 0.5 + 0.5;
  float tone = 1.0 - l;
  float shade = smoothstep(stroke * 0.9, stroke * 0.9 + 0.3, tone) * 0.6 + smoothstep(0.55 + stroke2 * 0.4, 0.95 + stroke2 * 0.4, tone) * 0.4;
  float tooth = mix(1.0, smoothstep(0.25, 0.75, paperTex(px * 1.6)), u_tooth);
  float dark = sat((1.0 - line) * 0.95 + shade * u_shading * tooth);
  vec3 ink = u_color > 0.5 ? saturation(c, 1.2) * 0.75 : u_graphite;
  vec3 paper = u_paper * (0.97 + paperTex(px) * 0.05);
  fragColor = vec4(mix(paper, ink, dark), 1.0);
}`),
  },
  {
    id: "cross-hatch",
    name: "Cross hatch",
    category: "Draw",
    description: "Pen-and-ink hatching: up to four line layers build up tone, plus contour edges.",
    keywords: "hatching pen ink engraving comic",
    preview: "vase:1",
    params: [
      hero("spacing", "Line spacing", 2, 24, 7, 0.25, { unit: "px" }),
      hero("weight", "Line weight", 0.1, 1, 0.35),
      angle("angle", "Base angle", 45),
      range("layers", "Layers", 1, 4, 4, 1),
      range("edges", "Contours", 0, 1, 0.6),
      range("wobble", "Hand wobble", 0, 1, 0.3),
      color("ink", "Ink", "#141414"),
      color("paper", "Paper", "#F4F0E8"),
    ],
    passes: single(`
float hatch(vec2 px, float a, float tone, float thr) {
  vec2 p = rot(a) * px;
  p.y += vnoise(p * 0.02) * u_wobble * 4.0;
  float d = abs(fract(p.y / u_spacing) - 0.5) * u_spacing;
  float w = u_weight * u_spacing * 0.5 * smoothstep(thr, thr + 0.25, tone);
  return 1.0 - smoothstep(w - 0.6, w + 0.6, d);
}
void main() {
  vec2 px = refCoord(vUv);
  float tone = 1.0 - luma(blur13(uTex0, vUv, refPx(1.5)).rgb);
  float a = radians(u_angle);
  float ink = hatch(px, a, tone, 0.15);
  if (u_layers > 1.5) ink = max(ink, hatch(px, a + 1.5708, tone, 0.35));
  if (u_layers > 2.5) ink = max(ink, hatch(px, a + 0.7854, tone, 0.55));
  if (u_layers > 3.5) ink = max(ink, hatch(px * 1.7, a - 0.7854, tone, 0.75));
  float e = sobel(uTex0, vUv, refPx(1.2)).x;
  ink = max(ink, smoothstep(0.25, 0.6, e) * u_edges);
  vec3 paper = u_paper * (0.97 + paperTex(px) * 0.05);
  fragColor = vec4(mix(paper, u_ink, ink), 1.0);
}`),
  },
  {
    id: "stipple",
    name: "Stippling",
    category: "Draw",
    description: "Dot-by-dot shading: jittered dots grow with darkness, never overlapping the grid.",
    keywords: "dots pointillist pen ink stipple",
    preview: "man:3",
    params: [
      hero("size", "Dot spacing", 2, 30, 6, 0.25, { unit: "px" }),
      hero("contrast", "Contrast", 0.5, 3, 1.3),
      range("jitter", "Jitter", 0, 1, 0.8),
      range("minDot", "Min dot", 0, 0.5, 0.02),
      color("ink", "Ink", "#121212"),
      color("paper", "Paper", "#F6F3EC"),
      toggle("color", "Source colour"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv) / u_size;
  vec2 cell = floor(px);
  float ink = 0.0;
  vec3 col = u_ink;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(float(i), float(j));
    vec2 o = 0.5 + (hash22(c + uSeed) - 0.5) * u_jitter * 0.7;
    vec2 cpx = (c + o) * u_size * refScale();
    vec3 s = texture(uTex0, cpx / uRes).rgb;
    float dark = sat((1.0 - luma(s) - 0.5) * u_contrast + 0.5);
    float r = sqrt(dark) * 0.62 + (dark > 0.02 ? u_minDot : 0.0);
    float d = length(px - c - o);
    float a = 1.0 - smoothstep(r - 0.08, r + 0.08, d);
    if (a > ink) { ink = a; col = u_color > 0.5 ? s * 0.8 : u_ink; }
  }
  fragColor = vec4(mix(u_paper, col, ink), 1.0);
}`),
  },
  {
    id: "pointillism",
    name: "Pointillism",
    category: "Draw",
    description: "Neo-impressionist colour dots in two offset layers, with optional complementary flecks.",
    keywords: "seurat dots painting colour",
    preview: "mountain:3",
    params: [
      hero("size", "Dot size", 3, 30, 8, 0.25, { unit: "px" }),
      hero("saturation", "Saturation", 0.5, 2, 1.35),
      range("jitter", "Jitter", 0, 1, 0.9),
      range("complement", "Complementary flecks", 0, 1, 0.25),
      color("paper", "Canvas", "#F2EEE4"),
    ],
    passes: single(`
vec4 layer(vec2 px, float off, float scale) {
  vec2 p = px / (u_size * scale) + off;
  vec2 cell = floor(p);
  vec4 best = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(float(i), float(j));
    vec2 o = 0.5 + (hash22(c + off * 13.0 + uSeed) - 0.5) * u_jitter;
    vec2 cpx = (c + o - off) * u_size * scale * refScale();
    vec3 s = saturation(texture(uTex0, cpx / uRes).rgb, u_saturation);
    if (hash12(c + 5.0 + off) < u_complement * 0.3) s = mix(s, 1.0 - s, 0.5);
    float r = 0.42 + hash12(c + 9.0) * 0.12;
    float d = length(p - c - o);
    float a = 1.0 - smoothstep(r - 0.06, r + 0.06, d);
    if (a > best.a) best = vec4(sat(s), a);
  }
  return best;
}
void main() {
  vec2 px = refCoord(vUv);
  vec4 a = layer(px, 0.0, 1.0);
  vec4 b = layer(px, 0.5, 0.8);
  vec3 o = u_paper;
  o = mix(o, b.rgb, b.a * 0.9);
  o = mix(o, a.rgb, a.a);
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "oil-paint",
    name: "Oil paint",
    category: "Draw",
    description: "Kuwahara-filtered colour patches with impasto brush relief lit from the side.",
    keywords: "painting kuwahara brush impasto canvas",
    preview: "blossom:1",
    params: [
      hero("brush", "Brush size", 2, 40, 10, 0.5, { unit: "px" }),
      hero("impasto", "Impasto", 0, 2, 0.8),
      range("saturation", "Saturation", 0.5, 2, 1.15),
      range("canvas", "Canvas weave", 0, 1, 0.35),
      angle("light", "Light angle", 135),
    ],
    passes: single(KUWAHARA + `
void main() {
  vec3 c = kuwahara(uTex0, vUv, u_brush * refScale());
  vec2 px = refCoord(vUv);
  vec2 e = vec2(1.0, 0.0);
  float hx = luma(kuwahara(uTex0, vUv + refPx(u_brush * 0.25) * e.xy, u_brush * refScale() * 0.6)) - luma(c);
  float hy = luma(kuwahara(uTex0, vUv + refPx(u_brush * 0.25) * e.yx, u_brush * refScale() * 0.6)) - luma(c);
  vec3 n = normalize(vec3(-hx * u_impasto * 4.0, -hy * u_impasto * 4.0, 1.0));
  vec3 L = normalize(vec3(cos(radians(u_light)), sin(radians(u_light)), 1.0));
  float lit = 0.75 + dot(n, L) * 0.35;
  float weave = (sin(px.x * 1.4) * sin(px.y * 1.4)) * 0.5 + 0.5;
  vec3 o = saturation(c, u_saturation) * lit * (1.0 - u_canvas * 0.08 + weave * u_canvas * 0.08);
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "watercolor",
    name: "Watercolour",
    category: "Draw",
    description: "Wet-in-wet washes: soft colour pools, pigment-darkened edges and paper granulation.",
    keywords: "aquarelle wash paint wet",
    preview: "greenhouse:0",
    params: [
      hero("wash", "Wash size", 2, 30, 9, 0.5, { unit: "px" }),
      hero("edges", "Edge darkening", 0, 1, 0.55),
      range("granulation", "Granulation", 0, 1, 0.5),
      range("bleed", "Bleed", 0, 1, 0.4),
      range("lighten", "Lighten", 0, 1, 0.25),
      color("paper", "Paper", "#F7F3EA"),
    ],
    passes: single(KUWAHARA + `
void main() {
  vec2 px = refCoord(vUv);
  vec2 wob = vec2(sfbm(px * 0.01), sfbm(px * 0.01 + 7.0)) * refPx(u_wash * u_bleed);
  vec3 c = kuwahara(uTex0, vUv + wob, u_wash * refScale());
  c = mix(c, vec3(1.0), u_lighten * 0.5);
  float e = sobel(uTex0, vUv + wob, refPx(u_wash * 0.5)).x;
  c *= 1.0 - smoothstep(0.05, 0.5, e) * u_edges * 0.35;
  float gran = paperTex(px * 2.0);
  c *= 1.0 - u_granulation * 0.18 * (1.0 - gran) * (1.0 - luma(c));
  vec3 o = u_paper * mix(vec3(1.0), c, 0.92);
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "scribble",
    name: "Scribble",
    category: "Draw",
    description: "Curly ballpoint scribbles that pile up in the shadows, following a flow field.",
    keywords: "ballpoint pen doodle lines flow",
    preview: "meadow:0",
    params: [
      hero("density", "Density", 0.2, 3, 1.4),
      hero("curl", "Curl", 0, 3, 1.2),
      range("weight", "Line weight", 0.2, 3, 1, 0.05),
      select("inkMode", "Ink", ["Source colour", "Ballpoint blue", "Black"]),
      color("paper", "Paper", "#F5F2EA"),
    ],
    passes: single(`
float strokes(vec2 px, float scale, float seed) {
  float a = snoise(px * 0.004 * scale + seed) * PI * u_curl;
  vec2 d = vec2(cos(a), sin(a));
  float v = dot(px, vec2(-d.y, d.x)) / (5.0 / u_density);
  float wob = snoise(px * 0.02 + seed) * 1.5;
  float line = abs(fract(v + wob) - 0.5);
  return 1.0 - smoothstep(0.05 * u_weight, 0.12 * u_weight, line);
}
void main() {
  vec2 px = refCoord(vUv);
  vec3 c = texture(uTex0, vUv).rgb;
  float tone = 1.0 - luma(blur13(uTex0, vUv, refPx(3.0)).rgb);
  float ink = strokes(px, 1.0, uSeed) * smoothstep(0.1, 0.4, tone);
  ink = max(ink, strokes(px * 1.3, 1.7, 9.0 + uSeed) * smoothstep(0.4, 0.7, tone));
  ink = max(ink, strokes(px * 0.8, 2.3, 21.0 + uSeed) * smoothstep(0.65, 0.9, tone));
  int m = int(u_inkMode + 0.5);
  vec3 inkC = m == 0 ? saturation(c, 1.3) * 0.7 : m == 1 ? vec3(0.1, 0.16, 0.55) : vec3(0.08);
  fragColor = vec4(mix(u_paper, inkC, ink * 0.92), 1.0);
}`),
  },
  {
    id: "pastel",
    name: "Pastel",
    category: "Draw",
    description: "Soft chalk pastel: blended colour fields that skip over the paper's tooth.",
    keywords: "chalk crayon soft drawing",
    preview: "woman:0",
    params: [
      hero("blend", "Blending", 1, 20, 6, 0.5, { unit: "px" }),
      hero("tooth", "Paper tooth", 0, 1, 0.55),
      range("chalk", "Chalkiness", 0, 1, 0.45),
      angle("strokeAngle", "Stroke angle", 60),
      color("paper", "Paper", "#E9E4DA"),
    ],
    passes: single(KUWAHARA + `
void main() {
  vec2 px = refCoord(vUv);
  vec2 sp = rot(radians(u_strokeAngle)) * px;
  vec2 j = vec2(vnoise(sp * vec2(0.02, 0.4)), vnoise(sp * vec2(0.4, 0.02) + 3.0)) - 0.5;
  vec3 c = kuwahara(uTex0, vUv + j * refPx(u_blend), u_blend * refScale());
  c = mix(c, vec3(luma(c)) * 0.3 + c * 0.7 + 0.12, u_chalk * 0.6);
  float tooth = paperTex(px * 2.5);
  float streak = vnoise(sp * vec2(0.6, 0.03)) * 0.6 + vnoise(sp * vec2(1.4, 0.08)) * 0.4;
  float skip = smoothstep(0.42, 0.62, tooth * 0.6 + streak * 0.5 + (luma(c) - 0.5) * 0.3) * u_tooth;
  vec3 o = mix(c * (0.9 + streak * 0.2), u_paper, skip * 0.85);
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "spray-paint",
    name: "Spray paint",
    category: "Draw",
    description: "Stencilled aerosol: posterised shapes with speckled overspray and drips.",
    keywords: "graffiti stencil aerosol street art",
    preview: "man:4",
    params: [
      hero("levels", "Stencil layers", 2, 5, 3, 1),
      hero("overspray", "Overspray", 0, 1, 0.6),
      range("drips", "Drips", 0, 1, 0.3),
      select("colors", "Colours", ["Red & black", "Source", "Neon", "Mono"]),
      color("wall", "Wall", "#E8E4DC"),
    ],
    passes: single(`
vec3 paint(float lv, vec3 src) {
  int m = int(u_colors + 0.5);
  if (m == 1) return src;
  if (m == 2) return mix(vec3(0.05, 0.0, 0.15), mix(vec3(1.0, 0.1, 0.6), vec3(0.2, 1.0, 0.9), lv), step(0.01, lv));
  if (m == 3) return vec3(lv);
  return mix(vec3(0.05), mix(vec3(0.85, 0.08, 0.05), vec3(1.0, 0.75, 0.6), smoothstep(0.6, 1.0, lv)), step(0.01, lv));
}
void main() {
  vec2 px = refCoord(vUv);
  float n = (hash12(floor(px * 1.2) + uSeed) - 0.5);
  vec2 jit = vec2(hash12(floor(px) + 2.0), hash12(floor(px) + 5.0)) - 0.5;
  vec2 uv = vUv + jit * refPx(14.0 * u_overspray) * step(0.5, hash12(floor(px * 0.7)));
  vec3 src = blur13(uTex0, uv, refPx(2.0)).rgb;
  float l = luma(src) + n * 0.15 * u_overspray;
  float lv = floor(sat(l) * u_levels) / max(u_levels - 1.0, 1.0);
  float dripX = floor(px.x / 6.0);
  float drip = step(1.0 - u_drips * 0.08, hash11(dripX + uSeed)) * step(fract(vUv.y * 0.5 + hash11(dripX) * 0.5), hash11(dripX + 3.0) * 0.4);
  vec3 col = paint(lv, src);
  vec3 wall = u_wall * (0.92 + paperTex(px * 0.5) * 0.16);
  float cover = smoothstep(0.0, 0.2, 1.0 - lv) + drip;
  vec3 o = mix(wall, col, sat(lv < 0.99 || int(u_colors + 0.5) == 1 ? 1.0 : cover));
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "edge-detect",
    name: "Edge detect",
    category: "Draw",
    description: "Sobel edges as clean line art, inverted ink, coloured edges or a neon glow.",
    keywords: "outline lines sobel neon",
    preview: "architecture:0",
    params: [
      select("mode", "Mode", ["Ink on paper", "White on black", "Colour edges", "Neon"]),
      hero("thickness", "Thickness", 0.5, 6, 1.2, 0.05, { unit: "px" }),
      hero("threshold", "Threshold", 0, 1, 0.2),
      range("smooth", "Pre-blur", 0, 6, 1, 0.1, { unit: "px" }),
      color("neon", "Neon colour", "#FF2E63"),
    ],
    passes: single(`
void main() {
  vec2 t = refPx(u_thickness);
  vec3 s = sobel(uTex0, vUv, t);
  if (u_smooth > 0.01) s = (s + sobel(uTex0, vUv + refPx(u_smooth) * 0.5, t) + sobel(uTex0, vUv - refPx(u_smooth) * 0.5, t)) / 3.0;
  float e = smoothstep(u_threshold, u_threshold + 0.15, s.x);
  vec3 c = texture(uTex0, vUv).rgb;
  int m = int(u_mode + 0.5);
  vec3 o;
  if (m == 0) o = mix(vec3(0.96, 0.94, 0.9), vec3(0.06), e);
  else if (m == 1) o = vec3(e);
  else if (m == 2) o = saturation(c, 1.6) * e * 1.4;
  else { vec3 g = blur13(uTex0, vUv, refPx(6.0)).rgb; float eg = smoothstep(u_threshold, u_threshold + 0.4, sobel(uTex0, vUv, refPx(u_thickness * 3.0)).x); o = u_neon * (e * 1.4 + eg * 0.6) + vec3(1.0) * e * 0.4; }
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "contour",
    name: "Contour lines",
    category: "Draw",
    description: "Topographic iso-lines traced through the image's brightness.",
    keywords: "topographic isolines map elevation",
    preview: "desert:0",
    params: [
      hero("count", "Lines", 3, 80, 22, 1),
      hero("thickness", "Thickness", 0.3, 4, 1.1, 0.05, { unit: "px" }),
      range("smooth", "Smoothing", 0, 12, 4, 0.1, { unit: "px" }),
      select("mode", "Mode", ["Lines on paper", "Lines over image", "Filled bands"]),
      color("ink", "Ink", "#D3202A"),
      color("paper", "Paper", "#0A0A0A"),
      range("major", "Major line every", 0, 10, 5, 1),
    ],
    passes: single(`
void main() {
  float l = luma(blur13(uTex0, vUv, refPx(u_smooth)).rgb) * u_count;
  float f = abs(fract(l) - 0.5);
  float w = fwidth(l) * u_thickness * refScale();
  bool major = u_major > 0.5 && mod(floor(l + 0.5), u_major) < 0.5;
  float line = 1.0 - smoothstep(w * 0.5, w * (major ? 2.2 : 1.2), 0.5 - f);
  vec3 c = texture(uTex0, vUv).rgb;
  int m = int(u_mode + 0.5);
  vec3 o;
  if (m == 0) o = mix(u_paper, u_ink, line);
  else if (m == 1) o = mix(c * 0.85, u_ink, line);
  else o = mix(mix(u_paper, u_ink, floor(l) / u_count), vec3(luma(u_paper) > 0.5 ? 0.0 : 1.0), line * 0.6);
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "engraving",
    name: "Engraving",
    category: "Draw",
    description: "Banknote line engraving: parallel lines swell with darkness and bend with the form.",
    keywords: "intaglio currency lines etching woodcut",
    preview: "sculpture:1",
    params: [
      hero("spacing", "Line spacing", 2, 20, 5, 0.25, { unit: "px" }),
      hero("bend", "Contour bend", 0, 30, 10, 0.5),
      angle("angle", "Angle", 20),
      range("contrast", "Contrast", 0.5, 3, 1.3),
      color("ink", "Ink", "#1A1A2A"),
      color("paper", "Paper", "#F3EFE4"),
    ],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  float l = luma(blur13(uTex0, vUv, refPx(2.0)).rgb);
  float h = luma(blur13(uTex0, vUv, refPx(20.0)).rgb);
  vec2 p = rot(radians(u_angle)) * px;
  float v = p.y / u_spacing + h * u_bend;
  float d = abs(fract(v) - 0.5);
  float tone = sat((1.0 - l - 0.5) * u_contrast + 0.5);
  float w = tone * 0.5;
  float aa = fwidth(v) * 0.8;
  float ink = 1.0 - smoothstep(w - aa, w + aa, d);
  fragColor = vec4(mix(u_paper, u_ink, ink), 1.0);
}`),
  },
  {
    id: "dot-matrix",
    name: "Dot matrix",
    category: "Draw",
    description: "A regular grid of dots sized by brightness, square or hex, mono or full colour.",
    keywords: "dots grid halftone led pattern",
    preview: "fashion:3",
    params: [
      hero("size", "Grid size", 3, 60, 12, 0.5, { unit: "px" }),
      select("grid", "Grid", ["Square", "Hex"]),
      select("shape", "Dot", ["Circle", "Square", "Diamond"]),
      range("scale", "Dot scale", 0.2, 1.5, 1),
      select("colorMode", "Colour", ["Source", "Mono", "Inverted"]),
      color("ink", "Ink", "#F7F2EC"),
      color("bg", "Background", "#0A0A0A"),
    ],
    passes: single(`
void main() {
  vec2 px = vUv * uRes / (u_size * refScale());
  if (u_grid > 0.5) px.x += mod(floor(px.y), 2.0) * 0.5;
  vec2 cell = floor(px);
  vec2 local = fract(px) - 0.5;
  vec2 cc = cell + 0.5;
  if (u_grid > 0.5) cc.x -= mod(floor(px.y), 2.0) * 0.5;
  vec3 s = texture(uTex0, cc * u_size * refScale() / uRes).rgb;
  float l = luma(s);
  int m = int(u_colorMode + 0.5);
  float v = m == 2 ? 1.0 - l : l;
  int sh = int(u_shape + 0.5);
  float d = sh == 1 ? max(abs(local.x), abs(local.y)) : sh == 2 ? (abs(local.x) + abs(local.y)) * 0.75 : length(local);
  float r = sqrt(v) * 0.5 * u_scale;
  float aa = fwidth(d);
  float dotA = 1.0 - smoothstep(r - aa, r + aa, d);
  vec3 ink = m == 0 ? s * 1.15 : u_ink;
  fragColor = vec4(mix(u_bg, ink, dotA), 1.0);
}`),
  },
  {
    id: "mosaic",
    name: "Mosaic",
    category: "Draw",
    description: "Voronoi tiles filled with the colour beneath, separated by grout.",
    keywords: "voronoi tiles stained glass cells",
    preview: "architecture:1",
    params: [hero("size", "Tile size", 4, 80, 18, 0.5, { unit: "px" }), hero("grout", "Grout", 0, 0.3, 0.06), range("jitter", "Irregularity", 0, 1, 0.9), color("groutColor", "Grout colour", "#141414"), range("bevel", "Tile bevel", 0, 1, 0.3)],
    passes: single(`
void main() {
  vec2 p = refCoord(vUv) / u_size;
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 8.0; float md2 = 8.0; vec2 mc = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.5 + (hash22(n + g + uSeed) - 0.5) * u_jitter;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md2 = md; md = d; mc = n + g + o; }
    else if (d < md2) md2 = d;
  }
  float edge = sqrt(md2) - sqrt(md);
  vec3 c = texture(uTex0, mc * u_size * refScale() / uRes).rgb;
  c *= 1.0 - u_bevel * 0.3 * sqrt(md);
  float g = 1.0 - smoothstep(u_grout, u_grout + 0.04, edge);
  fragColor = vec4(mix(c, u_groutColor, g), 1.0);
}`),
  },
  {
    id: "pixelate",
    name: "Pixelate",
    category: "Draw",
    description: "Large pixels in square, hexagon, triangle or circle cells, with optional gaps.",
    keywords: "pixel mosaic blocks censor 8-bit",
    preview: "car:2",
    params: [hero("size", "Pixel size", 2, 120, 16, 0.5, { unit: "px" }), select("shape", "Cell", ["Square", "Hexagon", "Triangle", "Circle"]), range("gap", "Gap", 0, 0.5, 0), color("gapColor", "Gap colour", "#0A0A0A"), range("levels", "Colour levels", 2, 256, 256, 1)],
    passes: single(`
vec2 hexCenter(vec2 p) {
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  return dot(a, a) < dot(b, b) ? p - a : p - b;
}
void main() {
  float ps = u_size * refScale();
  vec2 p = vUv * uRes / ps;
  int s = int(u_shape + 0.5);
  vec2 c; float d;
  if (s == 1) { c = hexCenter(p); vec2 q = abs(p - c); d = max(q.x * 0.866 + q.y * 0.5, q.y) * 1.155; }
  else if (s == 2) {
    vec2 cell = floor(p); vec2 f = fract(p);
    bool up = f.x + f.y < 1.0;
    c = cell + (up ? vec2(0.333) : vec2(0.667));
    d = up ? max(max(-f.x, -f.y), f.x + f.y - 1.0) + 0.5 : max(max(f.x - 1.0, f.y - 1.0), 1.0 - f.x - f.y) + 0.5;
  } else { c = floor(p) + 0.5; vec2 q = abs(p - c); d = s == 3 ? length(q) : max(q.x, q.y); }
  vec3 col = texture(uTex0, c * ps / uRes).rgb;
  col = floor(col * (u_levels - 1.0) + 0.5) / (u_levels - 1.0);
  float edge = s == 3 ? 0.5 - u_gap * 0.5 : 0.5 - u_gap * 0.5;
  float inside = 1.0 - smoothstep(edge - 0.02, edge, d);
  if (u_gap < 0.001 && s != 3) inside = 1.0;
  fragColor = vec4(mix(u_gapColor, col, inside), 1.0);
}`),
  },
  {
    id: "wave-lines",
    name: "Wave lines",
    category: "Draw",
    description: "Horizontal lines displaced by brightness — a ridge-plot of the image.",
    keywords: "ridge lines joy plot oscilloscope lines",
    preview: "face:4",
    params: [
      hero("lines", "Lines", 10, 200, 70, 1),
      hero("amplitude", "Amplitude", 0, 3, 1),
      range("thickness", "Thickness", 0.3, 4, 1.2, 0.05, { unit: "px" }),
      color("ink", "Ink", "#F7F2EC"),
      color("bg", "Background", "#0A0A0A"),
      toggle("color", "Source colour"),
    ],
    passes: single(`
void main() {
  float n = u_lines;
  float y = vUv.y * n;
  float ink = 0.0; vec3 col = u_ink;
  for (int k = -2; k <= 2; k++) {
    float row = floor(y) + float(k);
    vec2 uv = vec2(vUv.x, (row + 0.5) / n);
    vec3 s = texture(uTex0, uv).rgb;
    float h = luma(s) * u_amplitude * 1.6;
    float ly = row + 0.5 + h;
    float d = abs(y - ly) * uRes.y / n;
    float w = u_thickness * refScale() * (0.6 + luma(s));
    float a = 1.0 - smoothstep(w * 0.5, w * 0.5 + 1.0, d);
    if (a > ink) { ink = a; col = u_color > 0.5 ? s * 1.2 : u_ink; }
  }
  fragColor = vec4(mix(u_bg, col, ink), 1.0);
}`),
  },
];
