import { BLUR_FRAG } from "../../engine/glsl";
import { angle, hero, range, select, single, toggle, type EffectDef } from "../types";

/** Golden-angle bokeh gather; highlights are boosted so they bloom into discs. */
const BOKEH = `
vec3 bokeh(sampler2D t, vec2 uv, vec2 radius, float boost, int shape, float rotA) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 80; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 80.0);
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * r;
    if (shape == 1) {
      float ang = atan(o.y, o.x) + rotA;
      float k = cos(PI / 6.0) / cos(mod(ang, PI / 3.0) - PI / 6.0);
      o *= k;
    }
    vec3 c = texture(t, uv + o * radius).rgb;
    float w = 1.0 + pow(luma(c), 4.0) * boost * 12.0;
    acc += c * w;
    wsum += w;
  }
  return acc / wsum;
}
`;

/** Big radii run at reduced resolution: smoother (no tap gaps) and much cheaper. */
const blurScale = (v: Record<string, number | string>) => { const r = Number(v.radius); return r > 120 ? 0.25 : r > 40 ? 0.5 : 1; };
const pxRad = (v: Record<string, number | string>, key: string) => Number(v[key]) / 1080;

export const blur: EffectDef[] = [
  {
    id: "gaussian-blur",
    name: "Gaussian blur",
    category: "Blur",
    description: "Smooth separable blur that stays proportional at any export size.",
    keywords: "soft defocus smooth",
    preview: "woman:1",
    params: [hero("radius", "Radius", 0, 200, 24, 0.5, { unit: "px" }), select("axis", "Axis", ["Both", "Horizontal", "Vertical"])],
    passes: [
      { id: "h", frag: BLUR_FRAG, inputs: ["input"], scale: blurScale, uniforms: (v) => ({ uDir: [Number(v.axis) === 2 ? 0 : 1, 0], uRadius: pxRad(v, "radius") }) },
      { id: "v", frag: BLUR_FRAG, inputs: ["h"], scale: blurScale, uniforms: (v) => ({ uDir: [0, Number(v.axis) === 1 ? 0 : 1], uRadius: pxRad(v, "radius") }) },
    ],
  },
  {
    id: "lens-blur",
    name: "Lens blur",
    category: "Blur",
    description: "Lens bokeh: bright points bloom into circular or hexagonal discs.",
    keywords: "bokeh lens defocus disc aperture",
    preview: "flower:3",
    params: [
      hero("radius", "Radius", 0, 120, 28, 0.5, { unit: "px" }),
      hero("highlights", "Highlight boost", 0, 1, 0.5),
      select("aperture", "Aperture", ["Circle", "Hexagon"]),
      range("rotation", "Blade rotation", 0, 60, 0, 1, { unit: "°" }),
    ],
    passes: single(BOKEH + `
void main() {
  vec2 r = refPx(u_radius);
  fragColor = vec4(bokeh(uTex0, vUv, r, u_highlights, int(u_aperture + 0.5), radians(u_rotation)), 1.0);
}`),
  },
  {
    id: "circular-blur",
    name: "Circular blur",
    category: "Blur",
    description: "Copies of the image spun around each point on a ring, like a camera rotated during exposure; decay fades the outer copies.",
    keywords: "ring spin rotational echo multiple exposure",
    preview: "botanic:8",
    params: [
      hero("radius", "Radius", 0, 100, 24, 0.01, { unit: "px" }),
      hero("repetitions", "Repetitions", 3, 23, 8, 1),
      range("passes", "Passes", 1, 4, 1, 1),
      range("decay", "Decay", 0, 1, 0.4),
    ],
    passes: single(`
void main() {
  vec4 acc = vec4(0.0); float wsum = 0.0;
  float r = u_radius * refScale();
  for (int ring = 1; ring <= 4; ring++) {
    if (float(ring) > u_passes) break;
    float rr = r * float(ring) / u_passes;
    float w = pow(1.0 - u_decay * 0.9, float(ring - 1));
    for (int i = 0; i < 23; i++) {
      if (float(i) >= u_repetitions) break;
      float a = TAU * float(i) / u_repetitions + float(ring) * 0.37;
      acc += texture(uTex0, vUv + vec2(cos(a), sin(a)) * rr / uRes) * w;
      wsum += w;
    }
  }
  vec4 c = texture(uTex0, vUv);
  acc += c * (1.0 - u_decay) * 2.0;
  wsum += (1.0 - u_decay) * 2.0;
  fragColor = acc / wsum;
}`),
  },
  {
    id: "motion-blur",
    name: "Motion blur",
    category: "Blur",
    description: "Directional streak blur, centred or trailing, like a panning shutter.",
    keywords: "directional speed streak pan",
    preview: "dancer:1",
    params: [hero("distance", "Distance", 0, 300, 60, 1, { unit: "px" }), angle("angle", "Angle", 0), select("mode", "Mode", ["Centred", "Trailing"]), range("boost", "Highlight boost", 0, 1, 0.2)],
    passes: single(`
void main() {
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * refPx(u_distance);
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 48; i++) {
    float t = float(i) / 47.0;
    t = u_mode < 0.5 ? t - 0.5 : -t;
    vec3 c = texture(uTex0, vUv + dir * t).rgb;
    float w = 1.0 + pow(luma(c), 3.0) * u_boost * 6.0;
    acc += c * w; wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}`),
  },
  {
    id: "radial-blur",
    name: "Radial blur",
    category: "Blur",
    description: "Spin blur around a movable centre, sharp at the middle.",
    keywords: "spin rotate circular swirl",
    preview: "tower:0",
    handles: [{ x: "cx", y: "cy", label: "Centre" }],
    params: [hero("amount", "Angle", 0, 45, 8, 0.1, { unit: "°" }), range("cx", "Centre X", 0, 1, 0.5), range("cy", "Centre Y", 0, 1, 0.5), range("falloff", "Sharp centre", 0, 1, 0.3)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 p = (vUv - c) * vec2(aspect(), 1.0);
  float k = smoothstep(0.0, max(u_falloff, 0.001), length(p));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    float a = (float(i) / 39.0 - 0.5) * radians(u_amount) * k;
    vec2 q = rot(a) * p;
    acc += texture(uTex0, q / vec2(aspect(), 1.0) + c).rgb;
  }
  fragColor = vec4(acc / 40.0, 1.0);
}`),
  },
  {
    id: "zoom-blur",
    name: "Zoom blur",
    category: "Blur",
    description: "Streaks rushing out from a focal point, like zooming the lens mid-exposure.",
    keywords: "zoom burst speed tunnel",
    preview: "forest:1",
    handles: [{ x: "cx", y: "cy", label: "Focus" }],
    params: [hero("amount", "Amount", 0, 1, 0.3), range("cx", "Centre X", 0, 1, 0.5), range("cy", "Centre Y", 0, 1, 0.5), range("clear", "Clear centre", 0, 0.6, 0.1), range("boost", "Highlight boost", 0, 1, 0.3)],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = vUv - c;
  float k = smoothstep(u_clear, u_clear + 0.25, length(d * vec2(aspect(), 1.0)));
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 48; i++) {
    float t = float(i) / 47.0;
    vec3 s = texture(uTex0, c + d * (1.0 - t * u_amount * k)).rgb;
    float w = 1.0 + pow(luma(s), 3.0) * u_boost * 6.0;
    acc += s * w; wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}`),
  },
  {
    id: "blur-sharp",
    name: "Blur/sharp",
    category: "Blur",
    description: "Frequency split: soften the broad tones while crisping fine texture, or the reverse.",
    keywords: "frequency separation clarity dreamy",
    preview: "greenhouse:1",
    params: [hero("soften", "Soften tones", 0, 1, 0.5), hero("detail", "Fine detail", -1, 3, 1.2), range("radius", "Split radius", 1, 40, 8, 0.5, { unit: "px" })],
    passes: single(`
void main() {
  vec3 c = texture(uTex0, vUv).rgb;
  vec3 lo = blur13(uTex0, vUv, refPx(u_radius)).rgb;
  vec3 lo2 = blur13(uTex0, vUv, refPx(u_radius * 2.5)).rgb;
  vec3 hi = c - lo;
  vec3 base = mix(lo, lo2, u_soften);
  fragColor = vec4(sat(base + hi * u_detail), 1.0);
}`),
  },
  {
    id: "depth-of-field",
    name: "Depth of field",
    category: "Blur",
    description: "Tilt-shift focus: a sharp band (or spot) with bokeh growing away from it.",
    keywords: "tilt shift miniature focus bokeh",
    preview: "highway:0",
    handles: [{ x: "fx", y: "fy", label: "Focus" }],
    params: [
      select("mode", "Focus", ["Band", "Spot"]),
      hero("blur", "Max blur", 0, 80, 26, 0.5, { unit: "px" }),
      hero("size", "Focus size", 0, 0.8, 0.15),
      range("fx", "Focus X", 0, 1, 0.5),
      range("fy", "Focus Y", 0, 1, 0.5),
      angle("tilt", "Band angle", 0),
      range("falloff", "Falloff", 0.05, 1, 0.35),
      range("highlights", "Highlight boost", 0, 1, 0.4),
      range("saturation", "Miniature saturation", 0.5, 2, 1.15),
    ],
    passes: single(BOKEH + `
void main() {
  vec2 p = (vUv - vec2(u_fx, u_fy)) * vec2(aspect(), 1.0);
  float d = u_mode < 0.5 ? abs(dot(p, vec2(-sin(radians(u_tilt)), cos(radians(u_tilt))))) : length(p);
  float k = smoothstep(u_size, u_size + u_falloff, d);
  vec3 c = k > 0.01 ? bokeh(uTex0, vUv, refPx(u_blur * k), u_highlights, 0, 0.0) : texture(uTex0, vUv).rgb;
  fragColor = vec4(saturation(c, u_saturation), 1.0);
}`),
  },
  {
    id: "camera-shake",
    name: "Camera shake",
    category: "Blur",
    description: "Handheld jitter: a shaky multi-exposure trail that moves over time.",
    keywords: "handheld shake jitter double exposure",
    preview: "man:5",
    animated: true,
    params: [hero("amount", "Amount", 0, 60, 14, 0.5, { unit: "px" }), hero("trail", "Trail", 0, 1, 0.6), range("speed", "Speed", 0, 4, 1), range("rotation", "Rotation", 0, 1, 0.2), toggle("rgb", "RGB separation")],
    passes: single(`
vec2 shake(float t) { return vec2(snoise(vec2(t, 1.3)), snoise(vec2(t, 7.9))); }
void main() {
  float t = uTime * u_speed + uSeed * 10.0;
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i) / 15.0;
    float tt = t - fi * u_trail * 0.6;
    vec2 o = shake(tt) * refPx(u_amount);
    float r = snoise(vec2(tt, 3.3)) * u_rotation * 0.03;
    vec2 uv = rot(r) * (vUv - 0.5) + 0.5 + o;
    float w = exp(-fi * 3.0);
    vec3 c = u_rgb > 0.5 ? vec3(texture(uTex0, uv + o * 0.3).r, texture(uTex0, uv).g, texture(uTex0, uv - o * 0.3).b) : texture(uTex0, uv).rgb;
    acc += c * w; wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}`),
  },
  {
    id: "motion-trails",
    name: "Motion trails",
    category: "Blur",
    description: "Persistence of vision: each frame lingers and drifts, leaving light trails (great on video).",
    keywords: "trails echo afterimage long exposure feedback",
    preview: "highway:1",
    animated: true,
    params: [hero("persistence", "Persistence", 0, 0.98, 0.85), hero("drift", "Drift", 0, 20, 2, 0.1, { unit: "px" }), angle("angle", "Drift angle", 90), select("mode", "Accumulate", ["Lighten", "Average", "Screen"]), range("zoom", "Zoom drift", -0.02, 0.02, 0, 0.001)],
    passes: [{
      id: "fb",
      feedback: true,
      inputs: ["input", "prev"],
      frag: `
void main() {
  vec4 cur = texture(uTex0, vUv);
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * refPx(u_drift);
  vec2 puv = (vUv - 0.5) * (1.0 - u_zoom) + 0.5 - dir;
  vec3 prev = texture(uTex1, puv).rgb * u_persistence;
  int m = int(u_mode + 0.5);
  vec3 o = m == 0 ? max(cur.rgb, prev) : m == 1 ? mix(cur.rgb, prev / max(u_persistence, 1e-3), u_persistence) : blendScreen(cur.rgb, prev);
  if (uHasPrev < 0.5) o = cur.rgb;
  fragColor = vec4(sat(o), 1.0);
}`,
    }],
  },
  {
    id: "texture-blur",
    name: "Texture blur",
    category: "Blur",
    description: "Blur seen through frosted or reeded glass: displaced by a noise texture before smearing.",
    keywords: "frosted glass smudge organic diffuse",
    preview: "face:5",
    params: [hero("amount", "Amount", 0, 60, 18, 0.5, { unit: "px" }), hero("scale", "Texture scale", 1, 60, 12, 0.5), select("texture", "Texture", ["Frosted", "Smudge", "Streaks"]), range("soft", "Softness", 0, 1, 0.5)],
    passes: single(`
vec2 disp(vec2 px) {
  int t = int(u_texture + 0.5);
  if (t == 0) return hash22(floor(px / max(u_scale * 0.2, 1.0))) - 0.5;
  if (t == 1) return vec2(sfbm(px / (u_scale * 6.0)), sfbm(px / (u_scale * 6.0) + 9.0));
  return vec2(sfbm(vec2(px.x / (u_scale * 0.8), px.y / (u_scale * 30.0))), 0.0);
}
void main() {
  vec2 px = refCoord(vUv);
  vec2 o = disp(px) * refPx(u_amount) * 2.0;
  vec3 c = mix(texture(uTex0, vUv + o).rgb, blur13(uTex0, vUv + o, refPx(u_amount * 0.5)).rgb, u_soft);
  fragColor = vec4(c, 1.0);
}`),
  },
];
