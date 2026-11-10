import { surfaceTexture, SURFACE_NAMES } from "../../lib/surfaces";
import { BLUR_FRAG } from "../../engine/glsl";
import { group, hero, range, select, single, toggle, type EffectDef } from "../types";

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

const gScale = (v: Record<string, number | string>) => { const r = Number(v.strength) * 1.6; return r > 120 ? 0.25 : r > 40 ? 0.5 : 1; };

/**
 * Elliptical focus mask shared by motion blur and depth of field: 0 at the centre,
 * rising to 1 outside the radius with the given falloff (inverted by u_mInvert).
 */
const MASK_GLSL = `
float focusMask(vec2 uv) {
  vec2 p = (uv - vec2(u_mx, u_my)) * vec2(aspect(), 1.0);
  p = rot(radians(u_mRot)) * p;
  p.x /= 1.0 + u_mStretch;
  float d = length(p) / max(u_mRadius * 0.5, 1e-3);
  float m = sat(pow(max(d - 1.0, 0.0), 1.0 / u_mFalloff) * u_mFalloff * 0.5);
  m = smoothstep(0.0, 1.0, m);
  return u_mInvert > 0.5 ? 1.0 - m : m;
}
`;

export const blur: EffectDef[] = [
  {
    id: "gaussian-blur",
    name: "Gaussian blur",
    category: "Blur",
    description: "Separable Gaussian blur.",
    keywords: "soft defocus smooth",
    params: [hero("strength", "Strength", 0.3, 50, 14, 0.01), hero("aspect", "Aspect", -2, 2, 0)],
    passes: [
      { id: "h", frag: BLUR_FRAG, inputs: ["input"], scale: gScale, uniforms: (v) => ({ uDir: [1, 0], uRadius: (Number(v.strength) * 1.6 * Math.pow(2, Math.max(0, Number(v.aspect)))) / 1080 }) },
      { id: "v", frag: BLUR_FRAG, inputs: ["h"], scale: gScale, uniforms: (v) => ({ uDir: [0, 1], uRadius: (Number(v.strength) * 1.6 * Math.pow(2, Math.max(0, -Number(v.aspect)))) / 1080 }) },
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
    description: "Directional blur with an optional focus mask.",
    keywords: "speed movement streak directional",
    handles: [{ x: "mx", y: "my", label: "Mask" }],
    params: [
      hero("strength", "Strength", 0.3, 50, 20, 0.01),
      hero("angle", "Angle", 0, 360, 0, 1, { unit: "°" }),
      toggle("box", "Box"),
      toggle("both", "Both directions", 1),
      ...group("Mask", [toggle("mask", "Enable mask"), range("mx", "Mask center X", 0, 1, 0.5), range("my", "Mask center Y", 0, 1, 0.5), range("mRadius", "Mask radius", 0.01, 4, 0.35), range("mFalloff", "Mask falloff", 0.5, 6, 2, 0.1), range("mStretch", "Mask aspect stretch", 0, 5, 0, 0.05), range("mRot", "Mask rotation", -180, 180, 0, 1), toggle("mInvert", "Invert mask"), toggle("mDebug", "Debug mask")]),
    ],
    passes: single(MASK_GLSL + `
void main() {
  vec4 c = texture(uTex0, vUv);
  // The motion-blur mask marks where blur goes (inside the ellipse; invert for outside).
  float m = u_mask > 0.5 ? 1.0 - focusMask(vUv) : 1.0;
  if (u_mDebug > 0.5 && u_mask > 0.5) { fragColor = vec4(mix(c.rgb, vec3(1.0, 0.0, 0.0), m * 0.6), c.a); return; }
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * refPx(u_strength * 4.0) * m;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = 0; i < 48; i++) {
    float t = float(i) / 47.0;
    t = u_both > 0.5 ? t - 0.5 : -t;
    float w = u_box > 0.5 ? 1.0 : exp(-t * t * 8.0);
    acc += texture(uTex0, vUv + dir * t) * w; ws += w;
  }
  fragColor = acc / ws;
}`),
  },
  {
    id: "radial-blur",
    name: "Radial blur",
    category: "Blur",
    description: "Spin blur around a centre point.",
    keywords: "spin rotation swirl circular",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5), hero("angle", "Angle", 0, 90, 16, 1, { unit: "°" }), hero("samples", "Samples", 1, 100, 45, 1), toggle("box", "Box")],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec2 p = (vUv - c) * vec2(aspect(), 1.0);
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = 0; i < 100; i++) {
    if (float(i) >= u_samples) break;
    float t = u_samples > 1.0 ? float(i) / (u_samples - 1.0) - 0.5 : 0.0;
    float w = u_box > 0.5 ? 1.0 : exp(-t * t * 8.0);
    vec2 q = rot(radians(u_angle) * t) * p / vec2(aspect(), 1.0) + c;
    acc += texture(uTex0, q) * w; ws += w;
  }
  fragColor = acc / ws;
}`),
  },
  {
    id: "zoom-blur",
    name: "Zoom blur",
    category: "Blur",
    description: "Blur streaking out from a centre point.",
    keywords: "zoom burst speed tunnel",
    handles: [{ x: "cx", y: "cy", label: "Center" }],
    params: [range("cx", "Center X", 0, 1, 0.5), range("cy", "Center Y", 0, 1, 0.5), hero("strength", "Strength", 0, 1, 0.2), hero("samples", "Samples", 1, 100, 45, 1), toggle("box", "Box")],
    passes: single(`
void main() {
  vec2 c = vec2(u_cx, u_cy);
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = 0; i < 100; i++) {
    if (float(i) >= u_samples) break;
    float t = u_samples > 1.0 ? float(i) / (u_samples - 1.0) : 0.0;
    float w = u_box > 0.5 ? 1.0 : exp(-t * t * 3.0);
    acc += texture(uTex0, c + (vUv - c) * (1.0 - t * u_strength)) * w; ws += w;
  }
  fragColor = acc / ws;
}`),
  },
  {
    id: "blur-sharp",
    name: "Blur/sharp",
    category: "Blur",
    description: "One control from blur (positive) to sharpen (negative), with a detail threshold.",
    keywords: "unsharp mask detail clarity soften",
    params: [hero("blurriness", "Blurriness", -5, 1, -5, 0.01), hero("threshold", "Threshold", 0, 1, 1, 0.001), hero("ringing", "Ringing", 0, 1, 0.2)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  // Ringing widens the kernel, so sharpening halos spread further.
  float r = 1.0 + u_ringing * 6.0;
  vec3 lo = blur13(uTex0, vUv, refPx(r)).rgb;
  vec3 hi = c.rgb - lo;
  vec3 o;
  if (u_blurriness >= 0.0) o = mix(c.rgb, blur13(uTex0, vUv, refPx(2.0 + u_blurriness * 10.0)).rgb, u_blurriness);
  else {
    // Threshold: only detail whose contrast is below it gets boosted (1 = everything).
    float m = smoothstep(u_threshold, u_threshold * 0.7, length(hi) * 3.0) + step(0.999, u_threshold);
    o = c.rgb + hi * (-u_blurriness) * 0.8 * sat(m);
  }
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "depth-of-field",
    name: "Depth of field",
    category: "Blur",
    description: "Lens defocus outside a focus area, with a bladed aperture.",
    keywords: "bokeh tilt shift focus lens aperture",
    handles: [{ x: "mx", y: "my", label: "Focus" }],
    params: [
      range("mx", "Center X", 0, 1, 0.5),
      range("my", "Center Y", 0, 1, 0.5),
      hero("mRadius", "Radius", 0.01, 4, 0.35),
      range("mStretch", "Aspect stretch", 0, 5, 0, 0.05),
      range("mRot", "Mask rotation", -180, 180, 0, 1),
      range("mFalloff", "Falloff", 0.5, 6, 2, 0.1),
      hero("blur", "Blur strength", 0, 0.1, 0.01, 0.001),
      range("samples", "Samples", 10, 1000, 150, 10),
      ...group("Aperture", [range("blades", "Blades", 3, 10, 6, 1), range("roundness", "Blade roundness", 0, 1, 0), range("aRot", "Aperture rotation", -180, 180, 0, 1), range("feather", "Aperture feather", 0, 0.9, 0), range("anamorphic", "Anamorphic stretch", 1, 3, 1), range("cata", "Catadioptric", 0, 0.7, 0)]),
      toggle("mInvert", "Invert mask"),
      toggle("mDebug", "Debug mask"),
      toggle("aDebug", "Debug aperture"),
    ],
    passes: single(MASK_GLSL + `
// Polygon aperture radius at angle a (1 = circle when roundness is 1).
float aperture(float a) {
  float n = u_blades;
  float seg = TAU / n;
  float k = cos(PI / n) / cos(mod(a + radians(u_aRot), seg) - seg * 0.5);
  return mix(k, 1.0, u_roundness);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float m = focusMask(vUv);
  if (u_aDebug > 0.5) {
    vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0) * 2.4 * vec2(1.0 / u_anamorphic, 1.0);
    float r = length(p) / aperture(atan(p.y, p.x));
    float inside = step(r, 1.0) * step(u_cata, r) * mix(1.0, smoothstep(1.0, 1.0 - u_feather, r), step(0.001, u_feather));
    fragColor = vec4(vec3(inside), 1.0); return;
  }
  if (u_mDebug > 0.5) { fragColor = vec4(mix(c.rgb, vec3(1.0, 0.0, 0.0), m * 0.6), c.a); return; }
  float R = u_blur * m;
  if (R < 1e-4) { fragColor = c; return; }
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 1000; i++) {
    if (float(i) >= u_samples) break;
    float fi = float(i);
    float rr = sqrt((fi + 0.5) / u_samples);
    // Catadioptric (mirror) lenses have a central obstruction: donut bokeh.
    rr = mix(u_cata, 1.0, rr);
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * rr * aperture(a);
    o.x /= u_anamorphic;
    vec3 s = texture(uTex0, vUv + o * R * vec2(1.0 / aspect(), 1.0)).rgb;
    // Bright samples bloom into the aperture shape; feather fades the rim.
    float w = (1.0 + pow(luma(s), 4.0) * 8.0) * mix(1.0, 1.0 - rr * 0.7, u_feather);
    acc += s * w; ws += w;
  }
  fragColor = vec4(acc / ws, c.a);
}`),
  },
  {
    id: "camera-shake",
    name: "Camera shake",
    category: "Blur",
    description: "Handheld camera motion: pan, tilt, roll and zoom, with blur, randomness and pauses.",
    keywords: "handheld shake wobble tremor",
    animated: true,
    params: [
      hero("motion", "Motion scale", 0, 4, 2),
      hero("speed", "Speed scale", 0, 4, 0.899, 0.001),
      hero("blur", "Motion blur", 0, 1, 1),
      ...group("Pan / tilt / rotate", [range("pan", "Pan amplitude", 0, 1, 0.597, 0.001), range("tilt", "Tilt amplitude", 0, 1, 0.023, 0.001), range("roll", "Rotation amplitude", 0, 1, 0.1, 0.001), range("ptrSpeed", "PTR speed", 0, 4, 0.5, 0.001)]),
      ...group("Zoom", [range("zoom", "Zoom amplitude", 0, 1, 0, 0.001), range("zoomSpeed", "Zoom speed", 0, 4, 0, 0.001), range("phase", "Phase", 0, 1, 0.75, 0.001)]),
      ...group("Randomness", [range("randScale", "Randomness scale", 0, 2, 1, 0.001), range("randSpeed", "Randomness speed", 0, 4, 1.457, 0.001)]),
      ...group("Pauses", [range("pauseLen", "Pause length", 0, 1, 0.419, 0.001), range("pauseEvery", "Pause interval", 1, 60, 18, 1), range("pauseRand", "Pause randomness", 0, 1, 0.155, 0.001), range("rseed", "Random seed", 0, 100, 8, 1)]),
    ],
    passes: single(`
// Camera pose at time t: (x, y, roll, zoom).
vec4 pose(float t) {
  // Pauses: the operator holds still for part of every interval.
  float iv = u_pauseEvery * 0.25;
  float k = floor(t / iv);
  float f = fract(t / iv) + (hash11(k + u_rseed) - 0.5) * u_pauseRand;
  float hold = smoothstep(1.0 - u_pauseLen, 1.0 - u_pauseLen + 0.1, f);
  float tt = t * u_speed;
  float a = tt * u_ptrSpeed * 3.0 + u_phase * TAU;
  vec2 smooth_ = vec2(sin(a), sin(a * 1.31 + 1.7)) * vec2(u_pan, u_tilt);
  vec2 rnd = vec2(snoise(vec2(tt * u_randSpeed, u_rseed)), snoise(vec2(tt * u_randSpeed, u_rseed + 9.0))) * u_randScale * 0.5;
  float roll = (sin(a * 0.8 + 3.0) * 0.6 + snoise(vec2(tt * u_randSpeed * 0.7, u_rseed + 3.0)) * u_randScale * 0.4) * u_roll;
  float z = sin(tt * u_zoomSpeed * 3.0 + u_phase * TAU) * u_zoom;
  return vec4(smooth_ + rnd * (u_pan + u_tilt + 0.1), roll, z) * (1.0 - hold * 0.85) * u_motion;
}
vec2 apply(vec2 uv, vec4 p) {
  vec2 q = (uv - 0.5) * vec2(aspect(), 1.0);
  q = rot(p.z * 0.08) * q / (1.0 + p.w * 0.1 + 0.03 * u_motion);
  return q / vec2(aspect(), 1.0) + 0.5 + p.xy * 0.02;
}
void main() {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 12; i++) {
    float t = uTime - float(i) / 11.0 * u_blur / 24.0;
    acc += texture(uTex0, apply(vUv, pose(t)));
  }
  fragColor = acc / 12.0;
}`),
  },
  {
    id: "motion-trails",
    name: "Motion trails",
    category: "Blur",
    description: "Highlights leave fading light trails that drift and shake.",
    keywords: "trail echo light painting long exposure",
    params: [
      hero("threshold", "Threshold", 0, 4, 0.75),
      range("knee", "Knee", 0, 2, 0.12),
      hero("dimming", "Dimming", 0, 0.5, 0.06, 0.001),
      range("dirX", "Direction X", -1, 1, 0),
      range("dirY", "Direction Y", -1, 1, 0.5),
      range("shake", "Shake", 0, 5, 0.15),
      range("shakeSpeed", "Shake speed", 0, 10, 5),
      hero("intensity", "Intensity", 0, 3, 1),
      range("sourceDim", "Source dim", 0, 1, 0.75),
      select("blend", "Blend mode", ["Screen", "Add", "Lighten"]),
    ],
    passes: [
      {
        id: "fb",
        feedback: true,
        inputs: ["input", "prev"],
        frag: `
void main() {
  vec3 cur = texture(uTex0, vUv).rgb;
  float l = max(cur.r, max(cur.g, cur.b));
  float th = u_threshold * 0.25;
  float k = max(u_knee * 0.25, 1e-3);
  float s = clamp(l - th + k, 0.0, 2.0 * k); s = s * s / (4.0 * k);
  vec3 bright = cur * max(s, l - th) / max(l, 1e-4);
  vec2 sh = vec2(snoise(vec2(uTime * u_shakeSpeed, 1.0)), snoise(vec2(uTime * u_shakeSpeed, 7.0))) * u_shake;
  vec2 drift = (vec2(u_dirX, u_dirY) * 2.0 + sh) * refPx(1.0);
  vec3 prev = uHasPrev > 0.5 ? texture(uTex1, vUv - drift).rgb : vec3(0.0);
  fragColor = vec4(max(bright, prev * (1.0 - u_dimming)), 1.0);
}`,
      },
      {
        id: "out",
        inputs: ["input", "fb"],
        frag: `
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 t = texture(uTex1, vUv).rgb * u_intensity;
  vec3 base = c.rgb * (1.0 - u_sourceDim * 0.0) * mix(1.0, 0.6, u_sourceDim * 0.5);
  int b = int(u_blend + 0.5);
  vec3 o = b == 1 ? base + t : b == 2 ? max(base, t) : blendScreen(base, t);
  fragColor = vec4(sat(o), c.a);
}`,
      },
    ],
  },
  {
    id: "texture-blur",
    name: "Texture Blur",
    category: "Blur",
    description: "Blur shaped by a texture: the texture pushes samples, like looking through frosted or wet glass.",
    keywords: "frosted glass smudge texture distort blur",
    params: [
      select("texture", "Texture", SURFACE_NAMES, 20),
      select("fit", "Fit type", ["Fill", "Stretch", "Tile"]),
      range("texScale", "Texture scale", 1, 5, 1),
      hero("strength", "Blur strength", 0, 0.5, 0.5, 0.001),
      hero("boost", "Highlight boost", 0, 1, 0),
      hero("influence", "Texture influence", 0, 1, 1, 0.1),
    ],
    aux: (v) => [surfaceTexture(Number(v.texture))],
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
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 t = tuv(vUv);
  float h = luma(texture(uAux0, t).rgb);
  vec2 e = 2.0 / uAuxRes0;
  vec2 g = vec2(luma(texture(uAux0, t + vec2(e.x, 0.0)).rgb) - luma(texture(uAux0, t - vec2(e.x, 0.0)).rgb), luma(texture(uAux0, t + vec2(0.0, e.y)).rgb) - luma(texture(uAux0, t - vec2(0.0, e.y)).rgb));
  // The texture's slope steers a small blur kernel; flat areas still get a soft base blur.
  vec2 dir = g * 12.0 * u_influence + (hash22(floor(vUv * uRes * 0.5)) - 0.5) * (1.0 - u_influence) * 0.2;
  float R = u_strength * 0.08;
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i) / 15.0;
    vec2 o = (dir + vec2(cos(fi * 6.28), sin(fi * 6.28)) * 0.15 * (0.4 + h)) * R * fi;
    vec3 s = texture(uTex0, vUv + o).rgb;
    float w = 1.0 + pow(luma(s), 3.0) * u_boost * 6.0;
    acc += s * w; ws += w;
  }
  fragColor = vec4(acc / ws, c.a);
}`),
  },
];
