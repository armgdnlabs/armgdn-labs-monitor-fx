import { color, group, hero, range, select, single, toggle, type EffectDef } from "../types";

/** JPEG helpers shared by the JPEG glitch passes. */
const JPEG_COMMON = `
// Standard JPEG quantisation tables (luminance, chrominance), row-major 8×8.
float qTable(int i, int chroma) {
  int L[64] = int[64](16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99);
  int C[64] = int[64](17,18,24,47,99,99,99,99,18,21,26,66,99,99,99,99,24,26,56,99,99,99,99,99,47,66,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99);
  return float(chroma == 0 ? L[i] : C[i]);
}
float cu(float u) { return u < 0.5 ? 0.70710678 : 1.0; }
vec3 toYcc(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.1687, -0.3313, 0.5)), dot(c, vec3(0.5, -0.4187, -0.0813))); }
vec3 toRgb(vec3 y) { return vec3(y.x + 1.402 * y.z, y.x - 0.34414 * y.y - 0.71414 * y.z, y.x + 1.772 * y.y); }
`;

export const glitch: EffectDef[] = [
  {
    id: "glitch",
    name: "Glitch",
    category: "Glitch",
    description: "Displaced slices with per-channel shifts above a noise threshold.",
    keywords: "digital error corrupt slice",
    animated: true,
    params: [
      hero("scale", "Glitch scale", 0, 5, 0.38),
      hero("offset", "Offset scale", 0, 5, 3.44),
      range("angle", "Angle", 0, 180, 34, 1, { unit: "°" }),
      ...group("Shift strength", [range("rS", "Red shift strength", 0, 1, 0.29), range("gS", "Green shift strength", 0, 1, 0.29), range("bS", "Blue shift strength", 0, 1, 0.25)]),
      ...group("Threshold", [range("rT", "Red threshold", 0, 1, 0.76), range("gT", "Green threshold", 0, 1, 0.9), range("bT", "Blue threshold", 0, 1, 0.66)]),
      range("seed", "Random seed", 0, 1, 0.365, 0.001),
    ],
    passes: single(`
float slice(vec2 uv, float sd) {
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  vec2 nrm = vec2(-dir.y, dir.x);
  float s = dot((uv - 0.5) * vec2(aspect(), 1.0), nrm);
  // Bands of varying height; the scale sets how fine they are.
  float band = floor(s * (6.0 + u_scale * 30.0) + sd * 13.0);
  return hash11(band * 1.37 + sd * 7.1 + floor(uTime * 8.0) * 0.173);
}
vec3 shift(vec2 uv, float n, float th, float st, float sd) {
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  float on = step(th, n);
  float amt = (hash11(n * 91.7 + sd) - 0.5) * u_offset * st * 0.12 * on;
  return texture(uTex0, uv + dir * amt / vec2(aspect(), 1.0)).rgb;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float sd = u_seed * 100.0 + uSeed;
  float n = slice(vUv, sd);
  float r = shift(vUv, n, u_rT, u_rS, sd).r;
  float g = shift(vUv, slice(vUv, sd + 1.0), u_gT, u_gS, sd + 1.0).g;
  float b = shift(vUv, slice(vUv, sd + 2.0), u_bT, u_bS, sd + 2.0).b;
  fragColor = vec4(r, g, b, c.a);
}`),
  },
  {
    id: "pixel-sort",
    name: "Pixel sort",
    category: "Glitch",
    description: "True GPU pixel sorting along any angle, inside a mask.",
    keywords: "sort melt drip streak asendorf",
    params: [
      hero("angle", "Angle", 0, 360, 0, 1, { unit: "°" }),
      select("sortBy", "Sort by", ["Luminance", "Hue", "Saturation", "Red"]),
      select("maskBy", "Mask by", ["Luminance", "Hue", "Saturation", "Key color"]),
      color("key", "Key color", "#FFFFFF"),
      hero("lo", "Threshold low", 0, 1, 0.25),
      hero("hi", "Threshold high", 0, 1, 0.8),
      toggle("invert", "Invert mask"),
      ...group("Cells", [range("amount", "Amount", 0, 1, 0.5), range("patch", "Patch size", 1, 512, 48, 1), select("mode", "Mode", ["Ascending", "Descending"])]),
    ],
    passes: [
      {
        // Rotate so the sort axis is vertical. Output: the sort mask (white = sortable).
        id: "mask",
        inputs: ["input"],
        frag: `
float maskVal(vec3 c) {
  int m = int(u_maskBy + 0.5);
  if (m == 1) return rgb2hsv(c).x;
  if (m == 2) return rgb2hsv(c).y;
  if (m == 3) return 1.0 - length(c - u_key) / 1.732;
  return luma(c);
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  p = rot(radians(u_angle)) * p;
  vec2 uv = p / vec2(aspect(), 1.0) + 0.5;
  vec3 c = texture(uTex0, clamp(uv, 0.0, 1.0)).rgb;
  float k = maskVal(c);
  float on = step(u_lo, k) * step(k, u_hi);
  if (u_invert > 0.5) on = 1.0 - on;
  // Patches: break long spans so sorted runs stop at random lengths.
  float span = floor(gl_FragCoord.y / max(u_patch * refScale(), 1.0));
  on *= step(0.15, hash12(vec2(floor(gl_FragCoord.x), span) + uSeed));
  fragColor = vec4(vec3(on), 1.0);
}`,
      },
      {
        id: "rot",
        inputs: ["input"],
        frag: `
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  p = rot(radians(u_angle)) * p;
  fragColor = vec4(texture(uTex0, clamp(p / vec2(aspect(), 1.0) + 0.5, 0.0, 1.0)).rgb, 1.0);
}`,
      },
      {
        id: "sort",
        inputs: ["rot", "mask"],
        repeat: (v, ctx) => Math.min(Number(v.amount) * ctx.height, 900),
        frag: `
float key(vec3 c) {
  int k = int(u_sortBy + 0.5);
  if (k == 1) return rgb2hsv(c).x;
  if (k == 2) return rgb2hsv(c).y;
  if (k == 3) return c.r;
  return luma(c);
}
void main() {
  vec2 px = floor(vUv * uRes);
  float parity = mod(px.y + uIter, 2.0);
  float dir = parity < 0.5 ? 1.0 : -1.0;
  vec2 opx = px + vec2(0.0, dir);
  vec4 self = texture(uTex0, (px + 0.5) / uRes);
  if (opx.y < 0.0 || opx.y >= uRes.y || texture(uTex1, (px + 0.5) / uRes).r < 0.5 || texture(uTex1, (opx + 0.5) / uRes).r < 0.5) { fragColor = self; return; }
  vec4 other = texture(uTex0, (opx + 0.5) / uRes);
  float ks = key(self.rgb), ko = key(other.rgb);
  bool asc = u_mode < 0.5;
  bool keepSmaller = asc ? dir < 0.0 : dir > 0.0;
  fragColor = (keepSmaller ? ko < ks : ko > ks) ? other : self;
}`,
      },
      {
        id: "back",
        inputs: ["sort", "input"],
        frag: `
void main() {
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  p = rot(-radians(u_angle)) * p;
  vec2 uv = p / vec2(aspect(), 1.0) + 0.5;
  vec4 src = texture(uTex1, vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { fragColor = src; return; }
  fragColor = vec4(texture(uTex0, uv).rgb, src.a);
}`,
      },
    ],
  },
  {
    id: "jpeg-glitch",
    name: "JPEG glitch",
    category: "Glitch",
    description: "A real JPEG pipeline (8×8 DCT, quantisation, inverse DCT) you can break at every stage.",
    keywords: "compression artifact blocks datamosh corrupt dct",
    params: [
      hero("compression", "Compression", 0, 100, 96, 1),
      range("block", "Block size", 1, 16, 1, 1),
      range("acGain", "AC gain", -2, 2, 1),
      ...group("Corruption", [
        hero("corruption", "Corruption", 0, 100, 0, 1),
        range("detail", "Detail loss", 0, 100, 100, 1),
        range("start", "Start", 0, 100, 0, 0.1),
        range("end", "End", 0, 100, 100, 0.1),
        range("seed", "Seed", 1, 9999, 1, 1),
        range("bytes", "Breaking bytes", 0, 64, 0, 1),
        range("maxRandom", "Max random value", 1, 255, 255, 1),
        range("chromaLuma", "Chroma / luma", -1, 1, 0),
        range("mismatch", "Decoder mismatch", 0, 100, 0, 1),
      ]),
      ...group("Quantization table", [range("qtcPos", "QTC position", -1, 63, -1, 1), range("qtcValue", "QTC value", 1, 255, 16, 1), select("qtcTarget", "QTC target", ["Luma", "Chroma", "Both"], 2)]),
      ...group("Decode stages", [toggle("idct", "Inverse DCT", 1), toggle("ycc", "YCbCr to RGB", 1), toggle("dequant", "Dequantize", 1)]),
    ],
    passes: [
      {
        // Forward DCT: each texel holds coefficient (u,v) of its 8×8 block, per YCbCr channel.
        id: "dct",
        inputs: ["input"],
        scale: (v) => 1 / Math.max(1, Number(v.block)),
        frag: JPEG_COMMON + `
void main() {
  vec2 px = floor(vUv * uRes);
  vec2 b0 = floor(px / 8.0) * 8.0;
  vec2 uv = mod(px, 8.0);
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    vec3 f = toYcc(texture(uTex0, (b0 + vec2(x, y) + 0.5) / uRes).rgb) * 255.0 - vec3(128.0, 0.0, 0.0);
    acc += f * cos((2.0 * float(x) + 1.0) * uv.x * PI / 16.0) * cos((2.0 * float(y) + 1.0) * uv.y * PI / 16.0);
  }
  fragColor = vec4(acc * 0.25 * cu(uv.x) * cu(uv.y) / 255.0, 1.0);
}`,
      },
      {
        // Quantise, corrupt, dequantise.
        id: "q",
        inputs: ["dct"],
        scale: (v) => 1 / Math.max(1, Number(v.block)),
        frag: JPEG_COMMON + `
void main() {
  vec2 px = floor(vUv * uRes);
  vec2 blk = floor(px / 8.0);
  vec2 uv = mod(px, 8.0);
  int i = int(uv.y * 8.0 + uv.x);
  vec3 F = texture(uTex0, vUv).rgb * 255.0;
  float q = u_compression;
  float scale = q < 50.0 ? 5000.0 / max(q, 1.0) : 200.0 - 2.0 * q;
  scale = (100.0 - q) < 0.5 ? 1.0 : scale;
  vec3 Q;
  for (int c = 0; c < 3; c++) {
    float t = max(1.0, floor((qTable(i, c == 0 ? 0 : 1) * scale + 50.0) / 100.0));
    int tgt = int(u_qtcTarget + 0.5);
    if (int(u_qtcPos) == i && (tgt == 2 || (tgt == 0 && c == 0) || (tgt == 1 && c > 0))) t = u_qtcValue;
    Q[c] = t;
  }
  if (i > 0) F *= u_acGain;
  // Detail loss: how much of the rounding error is kept (100 = real quantisation).
  vec3 qv = mix(F / Q, floor(F / Q + 0.5), u_detail / 100.0);
  // Corruption inside the Start..End band (percent from the top).
  float yPct = (1.0 - vUv.y) * 100.0;
  float h = hash12(blk + u_seed * 0.0137);
  if (yPct >= u_start && yPct <= u_end && h < u_corruption / 100.0) {
    float k = hash12(blk * 1.7 + float(i) + u_seed);
    if (float(i) < u_bytes || k < u_bytes / 64.0) {
      // A corrupted byte: a random quantised value (scaled so a full 255 is a heavy hit, not a white-out).
      vec3 r = (hash32(blk + float(i) * 3.1 + u_seed) * 2.0 - 1.0) * u_maxRandom * 0.15;
      vec3 w = vec3(1.0 - max(u_chromaLuma, 0.0), 1.0 + min(u_chromaLuma, 0.0), 1.0 + min(u_chromaLuma, 0.0));
      w = vec3(u_chromaLuma > 0.0 ? 1.0 - u_chromaLuma : 1.0, u_chromaLuma < 0.0 ? 1.0 + u_chromaLuma : 1.0, u_chromaLuma < 0.0 ? 1.0 + u_chromaLuma : 1.0);
      qv += r * w;
    }
  }
  // Decoder mismatch: some blocks are dequantised with the other table.
  vec3 D = Q;
  if (hash12(blk * 2.3 + u_seed + 5.0) < u_mismatch / 100.0) D = vec3(Q.y, Q.x, Q.x);
  vec3 o = u_dequant > 0.5 ? qv * D : qv;
  fragColor = vec4(o / 255.0, 1.0);
}`,
      },
      {
        id: "idct",
        inputs: ["q"],
        scale: (v) => 1 / Math.max(1, Number(v.block)),
        frag: JPEG_COMMON + `
void main() {
  vec2 px = floor(vUv * uRes);
  vec2 b0 = floor(px / 8.0) * 8.0;
  vec2 xy = mod(px, 8.0);
  vec3 f = vec3(0.0);
  if (u_idct < 0.5) { f = texture(uTex0, vUv).rgb * 255.0 * 0.125 + vec3(128.0, 0.0, 0.0); }
  else {
    for (int v = 0; v < 8; v++) for (int u = 0; u < 8; u++) {
      vec3 F = texture(uTex0, (b0 + vec2(u, v) + 0.5) / uRes).rgb * 255.0;
      f += cu(float(u)) * cu(float(v)) * F * cos((2.0 * xy.x + 1.0) * float(u) * PI / 16.0) * cos((2.0 * xy.y + 1.0) * float(v) * PI / 16.0);
    }
    f = f * 0.25 + vec3(128.0, 0.0, 0.0);
  }
  vec3 y = f / 255.0;
  vec3 o = u_ycc > 0.5 ? toRgb(y) : vec3(y.x, y.y + 0.5, y.z + 0.5);
  fragColor = vec4(sat(o), 1.0);
}`,
      },
      {
        // Upscale with hard pixels so big block sizes stay blocky.
        id: "out",
        inputs: ["idct", "input"],
        frag: `
void main() {
  vec2 t = uTexRes0;
  vec2 uv = (floor(vUv * t) + 0.5) / t;
  fragColor = vec4(texture(uTex0, uv).rgb, texture(uTex1, vUv).a);
}`,
      },
    ],
  },
  {
    id: "rgb-shift",
    name: "RGB Shift",
    category: "Glitch",
    description: "Red and blue offsets, from a straight shift to radial aberration.",
    keywords: "chromatic aberration split prism",
    handles: [{ x: "cx", y: "cy", label: "Aberration center" }],
    params: [
      hero("red", "Red offset", -0.2, 0.2, 0.2, 0.001),
      hero("blue", "Blue offset", -0.2, 0.2, 0.2, 0.001),
      hero("stretch", "Stretch ratio", -2, 2, 1.3),
      range("cx", "Center X", 0, 1, 0.5),
      range("cy", "Center Y", 0, 1, 0.5),
    ],
    passes: single(`
vec2 shifted(vec2 uv, float off) {
  vec2 c = vec2(u_cx, u_cy);
  // Stretch ratio blends a straight sideways shift (0) into scaling about the centre (±).
  vec2 lin = vec2(off * 0.25, 0.0) * (1.0 - min(abs(u_stretch), 1.0));
  return uv - lin - (uv - c) * off * u_stretch * 0.5;
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float r = texture(uTex0, shifted(vUv, u_red)).r;
  float b = texture(uTex0, shifted(vUv, -u_blue)).b;
  fragColor = vec4(r, c.g, b, c.a);
}`),
  },
  {
    id: "echo",
    name: "Echo",
    category: "Glitch",
    description: "Stuttering playback: frames hold and repeat, with echo trails and offset ghosts (best on video or with animated layers).",
    keywords: "stutter echo feedback trails freeze lag",
    preview: "dancer:2",
    animated: true,
    params: [hero("drop", "Drop rate", 0, 1, 0.4), hero("echo", "Echo", 0, 0.98, 0.6), range("offset", "Ghost offset", 0, 40, 6, 0.5, { unit: "px" }), range("hold", "Hold frames", 1, 12, 3, 1)],
    passes: [{
      id: "fb",
      feedback: true,
      inputs: ["input", "prev"],
      frag: `
void main() {
  vec4 cur = texture(uTex0, vUv);
  float f = floor(uFrame / u_hold);
  bool dropped = hash11(f + uSeed) < u_drop;
  vec3 prev = texture(uTex1, vUv - refPx(u_offset) * vec2(1.0, 0.3)).rgb;
  vec3 o = dropped ? prev : mix(cur.rgb, max(cur.rgb, prev), u_echo);
  if (uHasPrev < 0.5) o = cur.rgb;
  fragColor = vec4(o, 1.0);
}`,
    }],
  },
  {
    id: "frame-drop",
    name: "Frame drop",
    category: "Glitch",
    description: "Holds frames to a lower, uneven frame rate so everything beneath it stutters like dropped video or stop motion.",
    keywords: "stutter choppy fps stop motion low framerate hold",
    preview: "streets:4",
    animated: true,
    params: [
      hero("fps", "FPS", 1, 30, 8, 1),
      hero("irregularity", "Irregularity", 0, 1, 0.35),
      range("opacity", "Live frame opacity", 0, 1, 0),
    ],
    passes: [
      {
        // Holds the last captured frame; alpha stores which tick it belongs to.
        id: "hold",
        feedback: true,
        inputs: ["input", "prev"],
        frag: `
void main() {
  float base = floor(uTime * u_fps);
  // Uneven cadence: some ticks are skipped, so held frames last one, two or three ticks.
  float skip = step(1.0 - u_irregularity * 0.7, hash11(base * 1.17 + uSeed));
  float code = mod(base - skip, 997.0);
  vec4 prev = texture(uTex1, vUv);
  bool fresh = uHasPrev < 0.5 || abs(prev.a - code) > 0.5;
  fragColor = fresh ? vec4(texture(uTex0, vUv).rgb, code) : prev;
}`,
      },
      {
        id: "out",
        inputs: ["hold", "input"],
        frag: `
void main() {
  vec3 held = texture(uTex0, vUv).rgb;
  vec4 live = texture(uTex1, vUv);
  fragColor = vec4(mix(held, live.rgb, u_opacity), live.a);
}`,
      },
    ],
  },
  {
    id: "modulation",
    name: "Modulation",
    category: "Glitch",
    description: "Frequency-modulated scan lines: brightness bends each line's phase.",
    keywords: "fm signal waves lines oscilloscope",
    params: [
      range("resolution", "Resolution", 256, 2048, 1024, 16),
      hero("waveScale", "Wave scale", 10, 500, 420, 5),
      hero("fm", "FM sensitivity", 0.1, 1, 0.25, 0.05),
      hero("strength", "Signal strength", 0.1, 20, 0.2, 0.1),
      select("direction", "Wave direction", ["Horizontal", "Vertical", "Diagonal", "Radial"]),
      range("phase", "Phase", 0, 10, 0),
      range("lineWidth", "Line width", 1.05, 10, 1.05, 0.05),
      ...group("Channels", [toggle("r", "Red channel", 1), toggle("g", "Green channel", 1), toggle("b", "Blue channel", 1)]),
    ],
    passes: single(`
float carrier(vec2 uv) {
  int d = int(u_direction + 0.5);
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0);
  if (d == 0) return uv.y;
  if (d == 1) return uv.x * aspect();
  if (d == 2) return (p.x + p.y) * 0.7071;
  return length(p);
}
float wave(vec2 uv, float v) {
  float x = carrier(uv) * u_waveScale;
  // FM: the signal integrates into phase, so bright areas bunch the lines together.
  float ph = x + v * u_strength * u_fm * 12.0 + u_phase;
  float s = 0.5 + 0.5 * cos(ph * TAU);
  return pow(s, u_lineWidth * u_lineWidth);
}
void main() {
  vec2 q = floor(vUv * u_resolution) / u_resolution;
  vec4 c = texture(uTex0, q);
  vec3 o = c.rgb;
  if (u_r > 0.5) o.r = wave(vUv, c.r);
  if (u_g > 0.5) o.g = wave(vUv, c.g);
  if (u_b > 0.5) o.b = wave(vUv, c.b);
  fragColor = vec4(o, 1.0);
}`),
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Glitch",
    description: "Stripes whose thickness follows brightness, optionally split per channel.",
    keywords: "lines rings op art pattern",
    animated: (v) => Math.abs(Number(v.speed)) > 0.001,
    params: [
      hero("reps", "Repetitions", 5, 60, 33, 1),
      range("minT", "Minimum thickness", 0.001, 0.1, 0.001, 0.001),
      range("maxT", "Maximum thickness", 0.1, 1, 1),
      hero("angle", "Angle", 0, 360, 90, 1, { unit: "°" }),
      range("soft", "Edge softness", 0, 1, 0.5),
      select("pattern", "Pattern type", ["Lines", "Rings"], 1),
      range("speed", "Animation speed", -5, 5, 0),
      ...group("Colour", [toggle("colorMode", "Color mode", 1), range("rShift", "Red shift", 0, 1, 0.1), range("gShift", "Green shift", 0, 1, 0), range("bShift", "Blue shift", 0, 1, 0)]),
      ...group("Row shift", [toggle("shift", "Shift"), range("rowFreq", "Row shift freq", 1, 50, 8, 1)]),
    ],
    passes: single(`
float coordAt(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0);
  if (u_pattern > 0.5) return length(p);
  vec2 d = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  return dot(p, d) + 0.5;
}
float stripe(float x, float v) {
  float th = mix(u_minT, u_maxT, v);
  float f = abs(fract(x) - 0.5) * 2.0;
  float e = max(u_soft * 0.25, 0.002);
  return smoothstep(th + e, th - e, f);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float x = coordAt(vUv) * u_reps - uTime * u_speed;
  if (u_shift > 0.5) x += (hash11(floor(vUv.y * u_rowFreq) + uSeed) - 0.5) * 2.0;
  vec3 o;
  if (u_colorMode > 0.5) o = vec3(stripe(x + u_rShift, c.r), stripe(x + u_gShift, c.g), stripe(x + u_bShift, c.b));
  else o = vec3(stripe(x, luma(c.rgb)));
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "grid-split",
    name: "Grid split",
    category: "Glitch",
    description: "Splits the frame into tiles that merge, shift, stretch, rotate, hide and get guides.",
    keywords: "tiles grid shift mosaic guides",
    animated: (v) => Number(v.noise) > 0 && Number(v.noiseSpeed) > 0,
    params: [
      hero("density", "Grid density", 1, 64, 8, 1),
      range("gridAspect", "Grid aspect", -1, 1, 0),
      range("seed", "Seed", 0, 1000, 1, 1),
      ...group("Irregularity", [range("activation", "Activation level", 0, 1, 0.3), range("softness", "Softness", 0, 1, 0.5), range("noise", "Noise", 0, 1, 1), range("noiseSize", "Noise size", 0.02, 2, 0.25), range("noiseSpeed", "Noise speed", 0, 4, 0.5), range("mergeCutoff", "Merge cutoff", 0, 1, 0), range("mergeDepth", "Merge depth", 0, 8, 5, 1)]),
      ...group("Tile transforms", [range("shiftX", "UV shift X", -1, 1, 0.1), range("shiftY", "UV shift Y", -1, 1, 0), range("stretchX", "UV stretch X", -1, 1, 0), range("stretchY", "UV stretch Y", -1, 1, 0), range("tileRot", "Tile rotation", -360, 360, 0, 1), range("variation", "Tile variation", 0, 1, 1)]),
      ...group("Grid guides", [range("strokes", "Grid strokes", 0, 20, 1.5, 0.1), range("gap", "Tile gap", 0, 40, 6, 0.5), color("strokeColor", "Grid stroke color", "#0F0F12"), range("marker", "Tile center marker", 0, 20, 5.1, 0.1), select("markerShape", "Marker shape", ["Dot", "Square", "Cross", "Plus", "Ring", "Diamond"], 2), range("markerStroke", "Marker stroke", 0.5, 6, 1.5, 0.1), color("markerColor", "Center marker color", "#75FF38"), toggle("guidesHidden", "Guides on hidden tiles", 1), toggle("guidesShown", "Guides on revealed tiles")]),
      ...group("Hide tiles", [range("hide", "Hide tiles", 0, 1, 0), color("bg", "Background color", "#09090B"), range("bgCutoff", "Background cutoff", 0, 1, 0)]),
    ],
    passes: single(`
float field(vec2 p) { return u_noise > 0.0 ? mix(0.5, vnoise(p / max(u_noiseSize, 0.02) * 3.0 + uTime * u_noiseSpeed + u_seed), u_noise) : 0.5; }
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 n = vec2(u_density * aspect() * exp2(u_gridAspect), u_density * exp2(-u_gridAspect));
  vec2 g = vUv * n;
  vec2 cell = floor(g);
  vec2 size = vec2(1.0);
  // Merge: neighbouring tiles fuse into 2×, 4×… blocks where noise is under the cutoff.
  for (int k = 1; k <= 8; k++) {
    if (float(k) > u_mergeDepth) break;
    vec2 big = floor(cell / exp2(float(k)));
    if (hash12(big + u_seed * 0.31 + float(k)) < u_mergeCutoff) { size = vec2(exp2(float(k))); cell = big * size; }
  }
  vec2 local = (g - cell) / size;
  vec2 center = (cell + size * 0.5) / n;
  float rnd = hash12(cell + u_seed);
  float act = smoothstep(u_activation - u_softness * 0.5, u_activation + u_softness * 0.5 + 1e-3, field(center) * 0.6 + rnd * 0.4);
  float v = mix(1.0, rnd * 2.0 - 1.0, u_variation) * act;
  // Tile transform: shift, stretch and rotate the source inside the tile.
  vec2 q = local - 0.5;
  q = rot(radians(u_tileRot * v)) * q;
  q /= 1.0 + vec2(u_stretchX, u_stretchY) * v;
  vec2 suv = center + q * size / n + vec2(u_shiftX, u_shiftY) * v * size / n;
  vec3 o = texture(uTex0, suv).rgb;
  bool hidden = hash12(cell + u_seed + 9.0) < u_hide || (u_bgCutoff > 0.0 && luma(o) < u_bgCutoff);
  if (hidden) o = u_bg;
  // Gap between tiles.
  vec2 px = local * size / n * uRes;
  vec2 tilePx = size / n * uRes;
  float gp = u_gap * refScale() * 0.5;
  if (any(lessThan(px, vec2(gp))) || any(greaterThan(px, tilePx - gp))) o = u_bg;
  bool guides = hidden ? u_guidesHidden > 0.5 : u_guidesShown > 0.5;
  if (guides || u_strokes > 0.0) {
    float sw = u_strokes * refScale();
    float edge = min(min(px.x, px.y), min(tilePx.x - px.x, tilePx.y - px.y));
    if (u_strokes > 0.0 && edge < sw) o = u_strokeColor;
  }
  if (guides && u_marker > 0.0) {
    vec2 d = (local - 0.5) * tilePx;
    float r = u_marker * refScale();
    float w = u_markerStroke * refScale();
    int s = int(u_markerShape + 0.5);
    float m = 0.0;
    if (s == 0) m = step(length(d), r);
    else if (s == 1) m = step(max(abs(d.x), abs(d.y)), r);
    else if (s == 2) m = step(abs(abs(d.x) - abs(d.y)), w) * step(max(abs(d.x), abs(d.y)), r);
    else if (s == 3) m = step(min(abs(d.x), abs(d.y)), w * 0.5) * step(max(abs(d.x), abs(d.y)), r);
    else if (s == 4) m = step(abs(length(d) - r), w * 0.5);
    else m = step(abs(abs(d.x) + abs(d.y) - r), w * 0.7);
    if (m > 0.5) o = u_markerColor;
  }
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "datamosh",
    name: "Datamosh",
    category: "Glitch",
    description: "P-frame bleed: blocks keep moving with stale motion while new detail smears through.",
    keywords: "mosh bleed melt compression motion vectors",
    preview: "concert:0",
    animated: true,
    params: [hero("amount", "Amount", 0, 1, 0.6), hero("motion", "Motion", 0, 40, 8, 0.5, { unit: "px" }), range("block", "Block size", 8, 64, 16, 1, { unit: "px" }), range("refresh", "Keyframe every", 10, 300, 90, 1, { unit: "fr" })],
    passes: [{
      id: "fb",
      feedback: true,
      inputs: ["input", "prev"],
      frag: `
void main() {
  vec4 cur = texture(uTex0, vUv);
  vec2 bsz = vec2(u_block * refScale());
  vec2 b = floor(vUv * uRes / bsz);
  float t = floor(uFrame / 3.0);
  vec2 mv = vec2(snoise(b * 0.15 + uSeed), snoise(b * 0.15 + 31.0 + uSeed)) * refPx(u_motion);
  vec3 prev = texture(uTex1, vUv - mv).rgb;
  bool key = mod(uFrame, u_refresh) < 1.0 || uHasPrev < 0.5;
  float moshed = step(hash12(b + floor(uFrame / u_refresh)), u_amount);
  vec3 o = key ? cur.rgb : mix(cur.rgb, prev + (cur.rgb - texture(uTex0, vUv - mv).rgb) * 0.5, moshed);
  fragColor = vec4(sat(o), 1.0);
}`,
    }],
  },
  {
    id: "slit-scan",
    name: "Slit-scan",
    category: "Glitch",
    description: "Scanner-style time smear: each frame contributes one slit, pushing older slits away.",
    keywords: "time displacement scanner smear",
    preview: "dancer:3",
    animated: true,
    params: [select("direction", "Direction", ["Vertical", "Horizontal"]), hero("slit", "Slit position", 0, 1, 0.5), hero("speed", "Speed", 1, 20, 4, 1, { unit: "px" }), toggle("mirror", "Mirror")],
    passes: [{
      id: "fb",
      feedback: true,
      inputs: ["input", "prev"],
      frag: `
void main() {
  bool v = u_direction < 0.5;
  float pos = v ? vUv.y : vUv.x;
  float s = refPx(u_speed).y * (v ? 1.0 : uRes.y / uRes.x);
  float d = pos - u_slit;
  if (u_mirror > 0.5) d = abs(d);
  vec4 cur = texture(uTex0, vUv);
  if (uHasPrev < 0.5) { fragColor = cur; return; }
  if (abs(d) < s) { fragColor = texture(uTex0, v ? vec2(vUv.x, u_slit) : vec2(u_slit, vUv.y)); return; }
  vec2 shift = v ? vec2(0.0, sign(pos - u_slit) * s) : vec2(sign(pos - u_slit) * s, 0.0);
  fragColor = texture(uTex1, vUv - shift);
}`,
    }],
  },
];
