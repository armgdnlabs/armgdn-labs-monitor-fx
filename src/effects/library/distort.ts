import { angle, hero, range, select, single, toggle, type EffectDef } from "../types";

const EDGE = `
vec4 sampleEdge(vec2 uv, int mode) {
  if (mode == 1) uv = fract(uv);
  else if (mode == 2) uv = mirrorUv(uv);
  else if (mode == 3 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) return vec4(0.0, 0.0, 0.0, 1.0);
  return texture(uTex0, uv);
}
`;
const edgeParam = (def = 0) => select("edge", "Edges", ["Clamp", "Repeat", "Mirror", "Black"], def);

export const distort: EffectDef[] = [
  {
    id: "elastic-grid",
    name: "Elastic grid",
    category: "Distort",
    description: "A rubber-sheet warp: a coarse grid of control points pushed around by smooth noise.",
    keywords: "warp liquify rubber mesh",
    preview: "man:0",
    animated: true,
    params: [hero("amount", "Amount", 0, 120, 30, 0.5, { unit: "px" }), hero("cells", "Grid cells", 1, 20, 4, 0.5), range("speed", "Animate", 0, 2, 0), toggle("showGrid", "Show grid"), edgeParam(2)],
    passes: single(EDGE + `
vec2 ctrl(vec2 g, float t) { return vec2(snoise(g * 0.71 + t + uSeed), snoise(g * 0.71 + 19.0 - t + uSeed)); }
void main() {
  vec2 p = vUv * u_cells * vec2(aspect(), 1.0);
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float t = uTime * u_speed;
  vec2 d = mix(mix(ctrl(i, t), ctrl(i + vec2(1.0, 0.0), t), u.x), mix(ctrl(i + vec2(0.0, 1.0), t), ctrl(i + 1.0, t), u.x), u.y);
  vec2 uv = vUv + d * refPx(u_amount);
  vec4 c = sampleEdge(uv, int(u_edge + 0.5));
  if (u_showGrid > 0.5) {
    vec2 g = abs(fract(uv * u_cells * vec2(aspect(), 1.0)) - 0.5);
    c.rgb = mix(c.rgb, vec3(1.0), smoothstep(0.485, 0.5, max(g.x, g.y)) * 0.7);
  }
  fragColor = c;
}`),
  },
  {
    id: "reeded-glass",
    name: "Reeded glass",
    category: "Distort",
    description: "Fluted glass panel: vertical ribs refract the image, with soft highlights on each rib.",
    keywords: "fluted ribbed glass refraction",
    preview: "subway:1",
    params: [hero("ribs", "Rib width", 4, 120, 26, 0.5, { unit: "px" }), hero("refraction", "Refraction", 0, 2, 0.8), angle("angle", "Angle", 0), range("frost", "Frost", 0, 1, 0.25), range("highlight", "Highlights", 0, 1, 0.3)],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv);
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  float x = dot(px, dir) / u_ribs;
  float f = fract(x) - 0.5;
  float slope = f * 2.0;
  vec2 off = dir * slope * refPx(u_ribs * u_refraction);
  vec3 c = mix(texture(uTex0, vUv + off).rgb, blur13(uTex0, vUv + off, refPx(u_ribs * 0.15)).rgb, u_frost);
  float hl = pow(1.0 - abs(f + 0.2) * 2.0, 6.0) * u_highlight;
  float sh = smoothstep(0.35, 0.5, abs(f)) * 0.15;
  fragColor = vec4(sat(c + hl * 0.5 - sh), 1.0);
}`),
  },
  {
    id: "cubify",
    name: "Cubify",
    category: "Distort",
    description: "Glass block wall: each tile is a little lens that flips and magnifies what's behind it.",
    keywords: "glass blocks tiles lens grid",
    preview: "fruit:3",
    params: [hero("size", "Tile size", 8, 200, 48, 1, { unit: "px" }), hero("lens", "Lens strength", -1, 1, 0.6), range("bevel", "Bevel", 0, 1, 0.4), range("gap", "Mortar", 0, 0.2, 0.03)],
    passes: single(`
void main() {
  float ps = u_size * refScale();
  vec2 p = vUv * uRes / ps;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  vec2 lf = f * (1.0 - u_lens * (0.6 - dot(f, f) * 1.2));
  vec2 uv = (cell + 0.5 + lf) * ps / uRes;
  vec3 c = texture(uTex0, uv).rgb;
  float e = max(abs(f.x), abs(f.y));
  c *= 1.0 - smoothstep(0.3, 0.5, e) * u_bevel * 0.5;
  c += smoothstep(0.42, 0.5, e) * u_bevel * 0.15 * step(f.x + f.y, 0.0);
  c = mix(c, vec3(0.05), smoothstep(0.5 - u_gap, 0.5 - u_gap + 0.01, e));
  fragColor = vec4(sat(c), 1.0);
}`),
  },
  {
    id: "perspective",
    name: "Perspective",
    category: "Distort",
    description: "Tilt the image in 3D: pitch, yaw, roll, field of view and distance.",
    keywords: "3d tilt rotate keystone plane",
    preview: "fashion:4",
    params: [angle("pitch", "Pitch", 25), angle("yaw", "Yaw", -20), angle("roll", "Roll", 0), hero("fov", "Field of view", 10, 120, 50, 1, { unit: "°" }), hero("zoom", "Zoom", 0.3, 3, 1), select("edge", "Edges", ["Black", "Repeat", "Mirror"])],
    passes: single(`
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  float f = 0.5 / tan(radians(u_fov) * 0.5);
  vec3 rd = normalize(vec3(p, f));
  float cp = cos(radians(u_pitch)), sp = sin(radians(u_pitch));
  float cy = cos(radians(u_yaw)), sy = sin(radians(u_yaw));
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 R = ry * rx;
  vec3 n = R * vec3(0.0, 0.0, 1.0);
  vec3 C = vec3(0.0, 0.0, f / u_zoom);
  float denom = dot(rd, n);
  float t = dot(C, n) / denom;
  vec3 hit = rd * t - C;
  vec2 q = vec2(dot(hit, R * vec3(1.0, 0.0, 0.0)), dot(hit, R * vec3(0.0, 1.0, 0.0))) * u_zoom;
  q = rot(radians(u_roll)) * q;
  vec2 uv = q / vec2(aspect(), 1.0) + 0.5;
  int e = int(u_edge + 0.5);
  if (denom <= 0.0 || t < 0.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (e == 1) uv = fract(uv); else if (e == 2) uv = mirrorUv(uv);
  else if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  fragColor = texture(uTex0, uv);
}`),
  },
  {
    id: "pinch",
    name: "Pinch",
    category: "Distort",
    description: "Pull the image into a point or balloon it outward around a movable centre.",
    keywords: "bulge fisheye pinch punch inflate",
    preview: "flower:4",
    handles: [{ x: "cx", y: "cy", label: "Centre" }],
    params: [hero("amount", "Amount", -1, 1, 0.5), hero("radius", "Radius", 0.05, 1.2, 0.45), range("cx", "Centre X", 0, 1, 0.5), range("cy", "Centre Y", 0, 1, 0.5)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = (vUv - c) * vec2(aspect(), 1.0);
  float r = length(d) / u_radius;
  vec2 uv = vUv;
  if (r < 1.0) {
    // r^p with p > 1 samples nearer the centre (bulge); p < 1 pushes outward (pinch).
    float p = 1.0 + u_amount * 0.9;
    uv = c + d * pow(max(r, 1e-4), p - 1.0) / vec2(aspect(), 1.0);
  }
  fragColor = texture(uTex0, uv);
}`),
  },
  {
    id: "polar-to-rect",
    name: "Polar to rectangular",
    category: "Distort",
    description: "Unwraps the image around its centre into a strip — circles become lines.",
    keywords: "unwrap polar coordinates panorama",
    preview: "woman:2",
    params: [hero("rotation", "Rotation", 0, 1, 0), hero("radius", "Radius", 0.1, 1, 0.5), toggle("flip", "Flip")],
    passes: single(`
void main() {
  float a = (vUv.x + u_rotation) * TAU;
  float r = (u_flip > 0.5 ? 1.0 - vUv.y : vUv.y) * u_radius;
  vec2 uv = 0.5 + vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.0) * min(aspect(), 1.0);
  fragColor = texture(uTex0, uv);
}`),
  },
  {
    id: "rect-to-polar",
    name: "Rectangular to polar",
    category: "Distort",
    description: "Wraps the image into a circle — horizons become tiny planets.",
    keywords: "tiny planet little planet polar wrap",
    preview: "meadow:1",
    params: [hero("rotation", "Rotation", 0, 1, 0.25), hero("zoom", "Zoom", 0.3, 2, 1), toggle("invert", "Inside out"), range("seam", "Seam blend", 0, 0.2, 0.04)],
    passes: single(`
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0) / u_zoom;
  float a = fract(atan(p.y, p.x) / TAU + u_rotation);
  float r = length(p) * 2.0;
  if (u_invert > 0.5) r = 1.0 - r;
  vec2 uv = vec2(a, 1.0 - clamp(r, 0.0, 1.0));
  vec3 c = texture(uTex0, uv).rgb;
  if (a < u_seam) c = mix(texture(uTex0, vec2(a + 1.0 - u_seam * 2.0, uv.y)).rgb, c, a / max(u_seam, 1e-4));
  fragColor = vec4(c, 1.0);
}`),
  },
  {
    id: "ripple",
    name: "Ripple",
    category: "Distort",
    description: "Concentric water ripples spreading from a point, with shading on the wave fronts.",
    keywords: "water waves drop pond",
    preview: "ocean:0",
    animated: true,
    handles: [{ x: "cx", y: "cy", label: "Origin" }],
    params: [hero("amplitude", "Amplitude", 0, 40, 10, 0.5, { unit: "px" }), hero("wavelength", "Wavelength", 5, 300, 60, 1, { unit: "px" }), range("speed", "Speed", 0, 3, 0.6), range("decay", "Decay", 0, 3, 1), range("shade", "Shading", 0, 1, 0.3), range("cx", "Centre X", 0, 1, 0.5), range("cy", "Centre Y", 0, 1, 0.5)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = (vUv - c) * vec2(aspect(), 1.0);
  float r = length(d) * uRes.y / refScale();
  float ph = r / u_wavelength * TAU - uTime * u_speed * 6.0;
  float att = exp(-length(d) * u_decay * 2.0);
  float w = sin(ph) * att;
  vec2 dir = d / max(length(d), 1e-4);
  vec2 uv = vUv + dir / vec2(aspect(), 1.0) * w * refPx(u_amplitude).y;
  vec3 col = texture(uTex0, uv).rgb;
  col += cos(ph) * att * u_shade * 0.15;
  fragColor = vec4(sat(col), 1.0);
}`),
  },
  {
    id: "swirl",
    name: "Swirl",
    category: "Distort",
    description: "Twist the image around a centre, strongest in the middle.",
    keywords: "twirl twist vortex spiral",
    preview: "smoke:0",
    handles: [{ x: "cx", y: "cy", label: "Centre" }],
    params: [hero("amount", "Twist", -720, 720, 240, 1, { unit: "°" }), hero("radius", "Radius", 0.05, 1.5, 0.5), range("cx", "Centre X", 0, 1, 0.5), range("cy", "Centre Y", 0, 1, 0.5)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = (vUv - c) * vec2(aspect(), 1.0);
  float r = length(d) / u_radius;
  float k = smoothstep(1.0, 0.0, r);
  d = rot(radians(u_amount) * k * k) * d;
  fragColor = texture(uTex0, c + d / vec2(aspect(), 1.0));
}`),
  },
  {
    id: "scatter",
    name: "Scatter",
    category: "Distort",
    description: "Pixels spray outward like sand — diffuse, directional or brightness-driven.",
    keywords: "diffuse spray sand disperse particles",
    preview: "smoke:1",
    animated: true,
    params: [hero("amount", "Distance", 0, 120, 20, 0.5, { unit: "px" }), select("mode", "Mode", ["Random", "Directional", "By brightness"]), angle("angle", "Direction", 90), range("grain", "Grain size", 1, 12, 1, 0.5, { unit: "px" }), toggle("animate", "Animate")],
    passes: single(`
void main() {
  vec2 px = floor(refCoord(vUv) / u_grain);
  float t = u_animate > 0.5 ? floor(uTime * 12.0) : 0.0;
  vec2 r = hash22(px + t + uSeed) - 0.5;
  int m = int(u_mode + 0.5);
  vec2 o = r * 2.0;
  if (m == 1) { vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))); o = dir * (r.x + 0.5) * 2.0 + vec2(-dir.y, dir.x) * r.y * 0.3; }
  if (m == 2) o *= luma(texture(uTex0, vUv).rgb) * 2.0;
  fragColor = texture(uTex0, vUv + o * refPx(u_amount));
}`),
  },
  {
    id: "displacement",
    name: "Displacement",
    category: "Distort",
    description: "Push pixels by a map: flowing noise, the image's own brightness, or its edges.",
    keywords: "displace map liquid warp flow",
    preview: "pinkflower:2",
    animated: true,
    params: [hero("amount", "Amount", 0, 150, 30, 0.5, { unit: "px" }), select("map", "Map", ["Flow noise", "Brightness", "Turbulence", "Edges"]), hero("scale", "Map scale", 0.1, 5, 1), range("speed", "Animate", 0, 2, 0), angle("angle", "Direction (brightness)", 45)],
    passes: single(`
void main() {
  vec2 px = refCoord(vUv) * 0.003 * u_scale;
  float t = uTime * u_speed + uSeed;
  int m = int(u_map + 0.5);
  vec2 o;
  if (m == 0) o = vec2(sfbm(px + t * 0.3), sfbm(px + 31.0 - t * 0.3));
  else if (m == 1) { float l = luma(blur13(uTex0, vUv, refPx(6.0 / u_scale)).rgb) - 0.5; o = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * l * 2.0; }
  else if (m == 2) { vec2 q = vec2(sfbm(px * 2.0 + t), sfbm(px * 2.0 + 7.0)); o = vec2(sfbm(px * 3.0 + q * 2.0), sfbm(px * 3.0 + q * 2.0 + 13.0)); }
  else { vec3 s = sobel(uTex0, vUv, refPx(2.0 / u_scale)); o = s.yz * 0.5; }
  fragColor = texture(uTex0, vUv + o * refPx(u_amount));
}`),
  },
  {
    id: "transform",
    name: "Transform",
    category: "Distort",
    description: "Scale, rotate, offset and tile the image — with mirrored repeats for patterns.",
    keywords: "scale rotate move tile repeat pattern kaleidoscope",
    preview: "butterfly:1",
    params: [hero("scale", "Scale", 0.1, 4, 1), angle("rotate", "Rotate", 0), range("x", "Offset X", -1, 1, 0), range("y", "Offset Y", -1, 1, 0), select("edge", "Edges", ["Clamp", "Repeat", "Mirror", "Black"], 2), toggle("flipX", "Flip horizontal"), toggle("flipY", "Flip vertical")],
    passes: single(EDGE + `
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  p = rot(-radians(u_rotate)) * p / u_scale - vec2(u_x, u_y);
  p /= vec2(aspect(), 1.0);
  vec2 uv = p + 0.5;
  if (u_flipX > 0.5) uv.x = 1.0 - uv.x;
  if (u_flipY > 0.5) uv.y = 1.0 - uv.y;
  fragColor = sampleEdge(uv, int(u_edge + 0.5));
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
