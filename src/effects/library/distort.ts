import { curvesLut } from "../../lib/textures";
import { surfaceTexture, SURFACE_NAMES } from "../../lib/surfaces";
import { angle, color, curve, group, hero, range, select, single, toggle, type EffectDef } from "../types";


export const distort: EffectDef[] = [
  {
    id: "elastic-grid",
    name: "Elastic grid",
    category: "Distort",
    description: "Grid cells stretch toward or away from a point, with drifting noise.",
    keywords: "grid stretch elastic mesh warp",
    animated: (v) => Number(v.noiseBlend) > 0,
    handles: [{ x: "cx", y: "cy", label: "Dot" }],
    params: [
      range("gx", "Grid X divisions", 1, 64, 8, 1),
      range("gy", "Grid Y divisions", 1, 64, 8, 1),
      range("cx", "Dot position X", 0, 1, 0.5), range("cy", "Dot position Y", 0, 1, 0.5),
      hero("stretch", "Stretch amount", -1, 1, -0.7),
      hero("radius", "Effect radius", 0.01, 1, 0.5),
      range("noiseSize", "Noise size", 0.1, 32, 4),
      range("noiseSpeed", "Noise speed", 0.2, 5, 0.5),
      range("noiseBlend", "Noise blend", 0, 1, 0.5),
      range("noiseLoop", "Noise loop (sec)", 0, 20, 5),
    ],
    passes: single(`
void main() {
  vec2 n = vec2(u_gx, u_gy);
  vec2 g = vUv * n;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 cc = (cell + 0.5) / n;
  vec2 dp = (cc - vec2(u_cx, u_cy)) * vec2(aspect(), 1.0);
  float infl = exp(-dot(dp, dp) / max(u_radius * u_radius * 0.5, 1e-4));
  float lt = u_noiseLoop > 0.0 ? mod(uTime, u_noiseLoop) / u_noiseLoop * TAU : uTime;
  vec2 nz = vec2(snoise(cell / u_noiseSize + vec2(cos(lt), sin(lt)) * u_noiseSpeed), snoise(cell / u_noiseSize + 9.0 + vec2(sin(lt), cos(lt)) * u_noiseSpeed));
  // Each cell remaps its local coordinate with a power curve: <0 pinches, >0 bulges.
  float k = u_stretch * infl + nz.x * u_noiseBlend * 0.5;
  vec2 e = exp2(vec2(k, k + nz.y * u_noiseBlend * 0.3) * 2.0);
  vec2 lf = mix(pow(f, e), 1.0 - pow(1.0 - f, e), smoothstep(0.0, 1.0, f));
  fragColor = texture(uTex0, (cell + lf) / n);
}`),
  },
  {
    id: "reeded-glass",
    name: "Reeded glass",
    category: "Distort",
    description: "Fluted or bubbled glass: each rib refracts and splits colour; the pattern can slide.",
    keywords: "fluted glass ribbed refraction bathroom",
    animated: (v) => Number(v.shiftSpeed) > 0 && Number(v.shiftLoop) > 0,
    params: [
      hero("amount", "Amount", 0, 10, 1),
      hero("dispersion", "Dispersion", 0, 0.5, 0.3, 0.001),
      range("reflection", "Reflection", 0, 1, 0),
      range("reflectionScale", "Reflection scale", 0.1, 2, 1, 0.05),
      select("pattern", "Pattern type", ["Ribs", "Bubbles", "Hexagons", "Waves"]),
      hero("repeats", "Pattern repeats", 1, 64, 7, 1),
      range("angle", "Pattern angle", 0, 360, 0, 1, { unit: "°" }),
      range("contrast", "Pattern contrast", 0.1, 5, 4, 0.05),
      range("shiftSpeed", "Shift speed", 0, 2, 1, 0.1),
      range("shiftLoop", "Shift loop (sec)", 0, 10, 5, 0.5),
      range("imperf", "Imperfections", 0, 1, 0.3),
      range("imperfScale", "Imperfections scale", 0.2, 25, 10, 0.1),
    ],
    passes: single(`
// Height of the glass surface (0..1) and its slope, in pattern space.
float surf(vec2 p) {
  int t = int(u_pattern + 0.5);
  if (t == 0) { float f = fract(p.x) - 0.5; return 1.0 - pow(abs(f) * 2.0, 2.0); }
  if (t == 1) { vec2 f = fract(p + vec2(0.5 * mod(floor(p.y), 2.0), 0.0)) - 0.5; return sat(1.0 - dot(f, f) * 4.0); }
  if (t == 2) { vec2 w = worley(p * 0.7); return sat(1.0 - w.x * 1.8); }
  return 0.5 + 0.5 * sin(p.x * TAU + sin(p.y * 2.0) * 1.5);
}
void main() {
  vec2 d = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  vec2 q = (vUv - 0.5) * vec2(aspect(), 1.0);
  vec2 p = vec2(dot(q, d), dot(q, vec2(-d.y, d.x))) * u_repeats;
  float loop = max(u_shiftLoop, 0.001);
  // Slides a whole number of ribs per loop so the animation loops seamlessly.
  if (u_shiftLoop > 0.0 && u_shiftSpeed > 0.0) p.x += fract(uTime / loop) * max(1.0, floor(u_shiftSpeed * 3.0 + 0.5));
  p += vec2(snoise(q * u_imperfScale), snoise(q * u_imperfScale + 5.0)) * u_imperf * 0.15;
  float e = 0.01;
  float h = surf(p);
  vec2 g = vec2(surf(p + vec2(e, 0.0)) - h, surf(p + vec2(0.0, e)) - h) / e;
  g = sign(g) * pow(abs(g) / 8.0, vec2(1.0 / u_contrast)) * 8.0;
  vec2 gw = (d * g.x + vec2(-d.y, d.x) * g.y) / vec2(aspect(), 1.0);
  vec2 off = gw * 0.004 * u_amount;
  // Dispersion: red bends least, blue most.
  float r = texture(uTex0, vUv + off * (1.0 - u_dispersion)).r;
  float gg = texture(uTex0, vUv + off).g;
  float b = texture(uTex0, vUv + off * (1.0 + u_dispersion)).b;
  vec3 o = vec3(r, gg, b);
  float spec = pow(sat(dot(normalize(vec3(-g * 0.15 * u_reflectionScale, 1.0)), normalize(vec3(-0.4, 0.5, 0.8)))), 40.0);
  o += spec * u_reflection;
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "cubify",
    name: "Cubify",
    category: "Distort",
    description: "The image refracted through a grid of glass cubes.",
    keywords: "cubes glass blocks tiles bevel",
    animated: (v) => Math.abs(Number(v.speedX)) + Math.abs(Number(v.speedY)) > 0.001,
    params: [
      hero("size", "Cube size", 0, 8, 1.1),
      range("stretch", "Cube stretch", -1, 1, 0),
      hero("depth", "Depth distortion", 0, 5, 1.8),
      toggle("hard", "Hard edges"),
      range("rotation", "Rotation angle", 0, 90, 0, 1, { unit: "°" }),
      range("ox", "Position offset X", -1, 1, 0),
      range("oy", "Position offset Y", -1, 1, 0),
      range("speedX", "Animation speed X", -1, 1, 0),
      range("speedY", "Animation speed Y", -1, 1, 0),
      hero("dispersion", "Dispersion", 0, 1, 0, 0.001),
    ],
    passes: single(`
void main() {
  float cs = exp2(u_size) * 0.01;
  vec2 q = (vUv - 0.5) * vec2(aspect(), 1.0);
  q = rot(radians(u_rotation)) * q;
  q += vec2(u_ox, u_oy) + vec2(u_speedX, u_speedY) * uTime * 0.05;
  vec2 sz = cs * vec2(exp2(u_stretch), exp2(-u_stretch));
  vec2 cell = floor(q / sz);
  vec2 f = fract(q / sz) - 0.5;
  // Each cube is a lens: off-centre points bend back toward the centre.
  float edge = u_hard > 0.5 ? 1.0 : smoothstep(0.5, 0.3, max(abs(f.x), abs(f.y)));
  vec2 bend = f * u_depth * 0.5 * edge * sz;
  vec2 back = rot(-radians(u_rotation)) * bend / vec2(aspect(), 1.0);
  float r = texture(uTex0, vUv - back * (1.0 + u_dispersion)).r;
  float g = texture(uTex0, vUv - back).g;
  float b = texture(uTex0, vUv - back * (1.0 - u_dispersion)).b;
  vec3 o = vec3(r, g, b) * (1.0 - smoothstep(0.42, 0.5, max(abs(f.x), abs(f.y))) * 0.25);
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "perspective",
    name: "Perspective",
    category: "Distort",
    description: "The image as a plane seen by a 3D camera.",
    keywords: "3d tilt plane camera rotate",
    params: [
      hero("zoom", "Camera zoom", -5, 5, 0.17),
      hero("fov", "Field of view", 10, 170, 60, 0.01, { unit: "°" }),
      range("camX", "Camera position X", -1, 1, 0),
      range("camY", "Camera position Y", -1, 1, 0),
      hero("rx", "Rotate X", -90, 90, -25, 0.01, { unit: "°" }),
      range("ry", "Rotate Y", -90, 90, 0, 0.01, { unit: "°" }),
      range("rz", "Rotate Z", -90, 90, 0, 0.01, { unit: "°" }),
      color("bg", "Background color", "#000000"),
      range("bgOpacity", "Background opacity", 0, 1, 0),
      ...group("Depth", [toggle("depthAlpha", "Depth-based alpha"), range("depthKey", "Depth key value", -3, 3, -0.79), range("depthRange", "Depth range", 0, 3, 1.89), toggle("invertDepth", "Invert depth", 1)]),
    ],
    passes: single(`
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }
void main() {
  vec4 src = texture(uTex0, vUv);
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  float f = 0.5 / tan(radians(u_fov) * 0.5);
  float dist = f * exp(-u_zoom * 0.3);
  vec3 ro = vec3(u_camX, u_camY, -dist);
  vec3 rd = normalize(vec3(p, f));
  mat3 R = rotZ(radians(u_rz)) * rotY(radians(u_ry)) * rotX(radians(u_rx));
  vec3 n = R * vec3(0.0, 0.0, -1.0);
  vec3 o = R * vec3(0.0);
  float den = dot(rd, n);
  vec4 bgc = vec4(u_bg, u_bgOpacity);
  if (abs(den) < 1e-5) { fragColor = bgc; return; }
  float t = dot(o - ro, n) / den;
  if (t <= 0.0) { fragColor = bgc; return; }
  vec3 hit = ro + rd * t;
  vec3 local = transpose(R) * hit;
  vec2 uv = local.xy / vec2(aspect(), 1.0) + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { fragColor = bgc; return; }
  vec4 c = texture(uTex0, uv);
  if (u_depthAlpha > 0.5) {
    float depth = (t - dist) * (u_invertDepth > 0.5 ? -1.0 : 1.0);
    c.a *= sat(1.0 - (depth - u_depthKey) / max(u_depthRange, 1e-3));
    c = mix(bgc, c, c.a);
  }
  fragColor = c;
}`),
  },
  {
    id: "pinch",
    name: "Pinch",
    category: "Distort",
    description: "Pulls the image toward (or pushes it from) a point.",
    keywords: "bulge pinch fisheye lens squeeze",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [hero("strength", "Strength", -1, 1, 0.4), hero("radius", "Radius", 0.01, 2, 1.5), range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 p = (vUv - c) * vec2(aspect(), 1.0);
  float r = length(p) / (u_radius * 0.5);
  if (r < 1.0) {
    float k = pow(r, 1.0 + u_strength * 1.5) / max(r, 1e-4);
    p *= mix(1.0, k, smoothstep(1.0, 0.0, r) * 1.0 + 0.0);
  }
  fragColor = texture(uTex0, p / vec2(aspect(), 1.0) + c);
}`),
  },
  {
    id: "polar-to-rect",
    name: "Polar to rectangular",
    category: "Distort",
    description: "Unwraps the image around a centre into a strip.",
    keywords: "unwrap polar coordinates panorama",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5), hero("angle", "Angle", 0, 360, 0, 1, { unit: "°" }), hero("radius", "Radius", 0, 3, 1), hero("distortion", "Distortion", -1, 1, 0)],
    passes: single(`
void main() {
  float a = vUv.x * TAU + radians(u_angle);
  // Distortion bends the radial mapping (log-like for negative, squared for positive).
  float t = vUv.y;
  t = u_distortion >= 0.0 ? mix(t, t * t, u_distortion) : mix(t, sqrt(t), -u_distortion);
  float r = t * u_radius * 0.5;
  vec2 p = vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.0);
  fragColor = texture(uTex0, vec2(u_cx, u_cy) + p);
}`),
  },
  {
    id: "rect-to-polar",
    name: "Rectangular to polar",
    category: "Distort",
    description: "Wraps the image into a circle (tiny planet).",
    keywords: "tiny planet polar wrap circle",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5), hero("angle", "Angle", 0, 360, 0, 1, { unit: "°" }), hero("radius", "Radius", 0, 3, 1), hero("distortion", "Distortion", -1, 1, 0.2), range("overlap", "Overlap", 0, 0.5, 0)],
    passes: single(`
void main() {
  vec2 p = (vUv - vec2(u_cx, u_cy)) * vec2(aspect(), 1.0);
  float a = atan(p.y, p.x) - radians(u_angle);
  float x = fract(a / TAU);
  float r = length(p) / max(u_radius * 0.5, 1e-3);
  r = u_distortion >= 0.0 ? mix(r, sqrt(r), u_distortion) : mix(r, r * r, -u_distortion);
  vec4 c = texture(uTex0, vec2(x, 1.0 - sat(r)));
  // Overlap blends across the seam so it disappears.
  if (u_overlap > 0.0) {
    vec4 c2 = texture(uTex0, vec2(fract(x + 0.5), 1.0 - sat(r)));
    float w = smoothstep(u_overlap, 0.0, min(x, 1.0 - x));
    c = mix(c, c2, w * 0.5);
  }
  fragColor = c;
}`),
  },
  {
    id: "ripple",
    name: "Ripple",
    category: "Distort",
    description: "Concentric water rings from a point, optionally animated and dispersed.",
    keywords: "water rings waves drop pond",
    animated: (v) => Math.abs(Number(v.speed)) > 0.001,
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [hero("amplitude", "Amplitude", 0, 0.2, 0.035, 0.001), hero("frequency", "Frequency", 0, 200, 50), range("phase", "Phase", 0, 360, 0, 1, { unit: "°" }), range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5), range("speed", "Animation speed", -10, 10, 0.8), hero("dispersion", "Dispersion", 0, 1, 0, 0.001)],
    passes: single(`
vec2 disp(float k) {
  vec2 p = (vUv - vec2(u_cx, u_cy)) * vec2(aspect(), 1.0);
  float r = length(p);
  float w = sin(r * u_frequency * (1.0 + k) - uTime * u_speed * 4.0 + radians(u_phase));
  return p / max(r, 1e-4) * w * u_amplitude * 0.3 / vec2(aspect(), 1.0);
}
void main() {
  float r = texture(uTex0, vUv + disp(-u_dispersion * 0.1)).r;
  float g = texture(uTex0, vUv + disp(0.0)).g;
  float b = texture(uTex0, vUv + disp(u_dispersion * 0.1)).b;
  fragColor = vec4(r, g, b, 1.0);
}`),
  },
  {
    id: "swirl",
    name: "Swirl",
    category: "Distort",
    description: "Twists the image around a point, with an optional wavy twist.",
    keywords: "twirl twist vortex spiral",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [hero("strength", "Strength", -5, 5, 0.66), hero("frequency", "Frequency", 1, 100, 41.4, 0.1), range("amplitude", "Amplitude", 0, 1.5, 0), range("phase", "Phase", 0, 360, 0, 1, { unit: "°" }), range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 p = (vUv - c) * vec2(aspect(), 1.0);
  float r = length(p);
  float a = u_strength * exp(-r * 2.0) * 2.0 + sin(r * u_frequency + radians(u_phase)) * u_amplitude;
  fragColor = texture(uTex0, rot(a) * p / vec2(aspect(), 1.0) + c);
}`),
  },
  {
    id: "scatter",
    name: "Scatter",
    category: "Distort",
    description: "The image redrawn as scattered sprites on a jittered grid, sized by brightness.",
    keywords: "dots sprites confetti stipple shapes particles",
    params: [
      select("shape", "Shape", ["Circle", "Square", "Star", "Heart", "Triangle", "Ring"]),
      hero("size", "Size", 0.05, 10, 0.52),
      range("minSize", "Min size", 0, 3, 0.2),
      range("maxSize", "Max size", 0, 3, 3),
      range("widthVar", "Width variance", 0, 0.5, 0),
      range("rotVar", "Rotation variance", 0, 1, 1),
      ...group("Color", [select("colorMode", "Color", ["Sprite color", "Source", "Source + variation"], 2), color("spriteColor", "Sprite color", "#FFFFFF"), range("colorVar", "Color variation", 0, 1, 1)]),
      ...group("Selection", [select("mode", "Mode", ["Over image", "Bright areas", "Dark areas", "Key color", "Edges", "On background"]), color("bg", "Background color", "#000000"), range("threshold", "Threshold", 0, 1, 0.7), color("key", "Key color", "#FFFFFF")]),
      ...group("Grid", [hero("density", "Density", 2, 300, 60, 1), range("gridAngle", "Grid angle", -90, 90, 0, 1), range("spread", "Spread", 0, 1, 1), range("seed", "Seed", 0, 100, 0, 1)]),
      ...group("Mask", [toggle("maskOn", "Enable"), toggle("maskInvert", "Invert"), range("mcx", "Center X", 0, 1, 0.5), range("mcy", "Center Y", 0, 1, 0.5), range("maskSize", "Size", 0, 2, 0.5), range("maskSoft", "Softness", 0, 1, 0.5)]),
      ...group("Drop shadow", [range("shOpacity", "Opacity", 0, 1, 0), color("shColor", "Shadow color", "#000000"), range("shAngle", "Angle", -180, 180, -45, 1), range("shDist", "Distance", 0, 1, 0.15), range("shSpread", "Spread", 0, 1, 0), range("shBlur", "Blur", 0, 4, 0.3)]),
    ],
    passes: single(`
float sdShape(vec2 p, int s) {
  if (s == 1) { vec2 d = abs(p) - 0.42; return max(d.x, d.y); }
  if (s == 2) { float a = atan(p.y, p.x); float r = 0.42 * (0.55 + 0.45 * cos(a * 5.0)); return length(p) - r; }
  if (s == 3) { p.y += 0.12; vec2 q = vec2(abs(p.x), p.y); float d = length(q - vec2(0.18, 0.12)) - 0.22; return min(d, max(-p.y - 0.3 + q.x * 0.9, q.x + p.y * 0.9 - 0.24)); }
  if (s == 4) { vec2 q = vec2(abs(p.x), p.y + 0.1); return max(q.x * 0.87 + q.y * 0.5, -q.y) - 0.3; }
  if (s == 5) return abs(length(p) - 0.32) - 0.1;
  return length(p) - 0.45;
}
float selectW(vec3 s, vec2 uv) {
  int m = int(u_mode + 0.5);
  float l = luma(s);
  if (m == 1) return step(1.0 - u_threshold, l);
  if (m == 2) return step(l, u_threshold);
  if (m == 3) return step(length(s - u_key), u_threshold);
  if (m == 4) return step(1.0 - u_threshold, sobel(uTex0, uv, refPx(2.0)).x * 2.0);
  return 1.0;
}
// Coverage and colour of the sprites at uv (searches the 3×3 neighbouring cells).
vec4 sprites(vec2 uv) {
  float cell = 1.0 / u_density;
  vec2 g = rot(radians(u_gridAngle)) * ((uv - 0.5) * vec2(aspect(), 1.0)) / cell;
  vec2 base = floor(g);
  vec4 best = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = base + vec2(i, j);
    vec2 h = hash22(id + u_seed * 1.31);
    vec2 cpos = id + 0.5 + (h - 0.5) * u_spread;
    vec2 suv = (rot(-radians(u_gridAngle)) * (cpos * cell)) / vec2(aspect(), 1.0) + 0.5;
    vec3 s = texture(uTex0, suv).rgb;
    if (selectW(s, suv) < 0.5) continue;
    // Sprite radius in cells: Min size applies to darks, Max size to lights.
    // Size is absolute (calibrated at density 60): more density means more, not smaller, sprites.
    float sz = u_size * 0.9 * mix(u_minSize, u_maxSize, luma(s)) * u_density / 60.0;
    if (u_minSize + u_maxSize <= 0.0 || sz <= 0.01) continue;
    vec2 p = g - cpos;
    p = rot(h.x * TAU * u_rotVar) * p;
    p.x *= 1.0 + (h.y - 0.5) * u_widthVar * 2.0;
    float d = sdShape(p / sz, int(u_shape + 0.5)) * sz;
    float cov = smoothstep(0.03, -0.03, d);
    if (cov > best.a) {
      int cm = int(u_colorMode + 0.5);
      vec3 col = cm == 0 ? u_spriteColor : cm == 1 ? s : s * (1.0 + (hash12(id + 7.0) - 0.5) * u_colorVar * 0.8);
      best = vec4(col, cov);
    }
  }
  return best;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  int m = int(u_mode + 0.5);
  vec3 base = m == 5 ? u_bg : c.rgb;
  if (u_shOpacity > 0.0) {
    vec2 off = vec2(cos(radians(u_shAngle)), sin(radians(u_shAngle))) * u_shDist * 0.05;
    float sh = sprites(vUv - off).a;
    base = mix(base, u_shColor, sat(sh * (1.0 + u_shSpread * 2.0)) * u_shOpacity);
  }
  vec4 sp = sprites(vUv);
  vec3 o = mix(base, sp.rgb, sp.a);
  if (u_maskOn > 0.5) {
    float d = length((vUv - vec2(u_mcx, u_mcy)) * vec2(aspect(), 1.0));
    float mk = smoothstep(u_maskSize * 0.5, u_maskSize * 0.5 * (1.0 - u_maskSoft) - 0.001, d);
    if (u_maskInvert > 0.5) mk = 1.0 - mk;
    o = mix(c.rgb, o, mk);
  }
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "displacement",
    name: "Displacement",
    category: "Distort",
    description: "Pushes the image around using a photographed texture as the displacement map.",
    keywords: "warp texture map distort glass liquid",
    params: [
      select("texture", "Texture", SURFACE_NAMES, 28),
      select("fit", "Fit type", ["Fill", "Stretch", "Tile"]),
      range("texScale", "Texture scale", 1, 5, 1),
      curve("mapCurve", "Map curve", "0,0 1,1", "#F7F2EC"),
      select("direction", "Direction", ["XY", "X", "Y"]),
      range("mapBlur", "Map blur", 0, 50, 0, 0.1),
      hero("amount", "Amount", 0, 10, 1),
      toggle("debug", "Debug map"),
    ],
    aux: (v) => [surfaceTexture(Number(v.texture)), curvesLut([String(v.mapCurve), "0,0 1,1", "0,0 1,1", "0,0 1,1"])],
    passes: single(`
vec2 tuv(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0) / u_texScale;
  float ta = uAuxRes0.x / max(uAuxRes0.y, 1.0);
  int fit = int(u_fit + 0.5);
  if (fit == 1) return p / vec2(aspect(), 1.0) + 0.5;
  if (fit == 2) return p * uRes.y / (uAuxRes0.y * refScale()) * vec2(1.0 / ta, 1.0) + 0.5;
  float s = max(1.0, aspect() / ta);
  return p / vec2(s * ta, s) + 0.5;
}
vec2 mapAt(vec2 t) {
  float b = u_mapBlur * 0.0006;
  vec3 m = b > 0.0 ? blur13(uAux0, t, vec2(b)).rgb : texture(uAux0, t).rgb;
  // Red pushes along X, green along Y (the same for grey maps); mid-grey stays put.
  return vec2(lut1(uAux1, m.r, 0.0, 4.0).r, lut1(uAux1, m.g, 0.0, 4.0).r);
}
void main() {
  vec2 h = mapAt(tuv(vUv));
  if (u_debug > 0.5) { fragColor = vec4(vec3(h.x), 1.0); return; }
  int d = int(u_direction + 0.5);
  vec2 off = (h - 0.5) * vec2(d == 2 ? 0.0 : 1.0, d == 1 ? 0.0 : 1.0);
  fragColor = texture(uTex0, vUv + off * u_amount * 0.06 * vec2(1.0 / aspect(), 1.0));
}`),
  },
  {
    id: "transform",
    name: "Transform",
    category: "Distort",
    description: "Move, scale and rotate, with mirror symmetry around axes.",
    keywords: "scale rotate kaleidoscope mirror symmetry move",
    handles: [{ x: "ix", y: "iy", label: "Input" }, { x: "ox", y: "oy", label: "Output" }],
    params: [
      range("ix", "Input center X", 0, 1, 0.5), range("iy", "Input center Y", 0, 1, 0.5),
      range("ox", "Output center X", 0, 1, 0.5), range("oy", "Output center Y", 0, 1, 0.5),
      hero("scale", "Scale amount", -3, 3, 0.39),
      hero("rotation", "Rotation", 0, 360, 0, 1, { unit: "°" }),
      hero("axes", "Symmetry axes", 0, 16, 5, 1),
      range("axisAngle", "Axis angle", 0, 360, 0, 1, { unit: "°" }),
      color("bg", "Background color", "#000000"),
      range("bgOpacity", "Background opacity", 0, 1, 0),
    ],
    passes: single(`
void main() {
  vec2 p = (vUv - vec2(u_ox, u_oy)) * vec2(aspect(), 1.0);
  p = rot(radians(u_rotation)) * p * exp2(-u_scale);
  if (u_axes >= 1.0) {
    // Mirror symmetry: fold the angle into one wedge and reflect alternate wedges.
    float n = u_axes;
    float a = atan(p.y, p.x) - radians(u_axisAngle);
    float w = PI / n;
    a = abs(mod(a, 2.0 * w) - w);
    p = vec2(cos(a), sin(a)) * length(p);
  }
  vec2 uv = p / vec2(aspect(), 1.0) + vec2(u_ix, u_iy);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { fragColor = vec4(u_bg, u_bgOpacity); return; }
  fragColor = texture(uTex0, uv);
}`),
  },
  {
    id: "kaleidoscope",
    name: "Kaleidoscope",
    category: "Distort",
    description: "Mirror segments around a centre into a symmetric mandala.",
    keywords: "mirror symmetry mandala segments",
    preview: "butterfly:2",
    animated: true,
    params: [hero("segments", "Segments", 2, 24, 8, 1), angle("rotate", "Rotate", 0), hero("zoom", "Zoom", 0.2, 3, 1), range("spin", "Spin speed", -1, 1, 0), range("ox", "Source X", -0.5, 0.5, 0), range("oy", "Source Y", -0.5, 0.5, 0)],
    passes: single(`
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  float a = atan(p.y, p.x) + radians(u_rotate) + uTime * u_spin;
  float r = length(p) / u_zoom;
  float seg = TAU / u_segments;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r + vec2(u_ox, u_oy);
  fragColor = texture(uTex0, mirrorUv(q / vec2(aspect(), 1.0) + 0.5));
}`),
  },
  {
    id: "fisheye",
    name: "Spherize",
    category: "Distort",
    description: "Wide-angle lens: barrel (fisheye) or pincushion distortion with optional circular crop.",
    keywords: "fisheye lens barrel pincushion sphere",
    preview: "street:1",
    params: [hero("amount", "Amount", -1, 1, 0.55), toggle("circle", "Circular frame"), range("zoom", "Zoom", 0.5, 2, 1)],
    passes: single(`
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= aspect();
  float r = length(p);
  float k = u_amount;
  vec2 q = k > 0.0 ? p * (1.0 - k * 0.5 + k * 0.5 * sqrt(max(1.0 - r * r * 0.25, 0.0))) : p * (1.0 - k * r * r * 0.25);
  q /= u_zoom;
  q.x /= aspect();
  vec2 uv = q * 0.5 + 0.5;
  vec4 c = texture(uTex0, uv);
  if (u_circle > 0.5) c.rgb *= 1.0 - smoothstep(0.98, 1.0, length((vUv - 0.5) * 2.0 * vec2(aspect() / max(aspect(), 1.0), 1.0 / max(1.0 / aspect(), 1.0))));
  fragColor = c;
}`),
  },
  {
    id: "wave",
    name: "Wave",
    category: "Distort",
    description: "Sine displacement along one axis — flags, heat haze or psychedelic wobble.",
    keywords: "sine wobble flag heat haze",
    preview: "palms:2",
    animated: true,
    params: [hero("amplitude", "Amplitude", 0, 80, 12, 0.5, { unit: "px" }), hero("wavelength", "Wavelength", 10, 800, 200, 1, { unit: "px" }), select("axis", "Axis", ["Horizontal", "Vertical", "Both"]), range("speed", "Speed", 0, 4, 0.5), range("turbulence", "Turbulence", 0, 1, 0.1)],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  float t = uTime * u_speed * 3.0;
  float n = snoise(px * 0.004 + t * 0.2) * u_turbulence * 3.0;
  float dx = sin(px.y / u_wavelength * TAU + t + n);
  float dy = sin(px.x / u_wavelength * TAU + t * 0.8 + n);
  int a = int(u_axis + 0.5);
  vec2 o = vec2(a != 1 ? dx : 0.0, a != 0 ? dy : 0.0) * refPx(u_amplitude);
  fragColor = texture(uTex0, vUv + o);
}`),
  },
];
