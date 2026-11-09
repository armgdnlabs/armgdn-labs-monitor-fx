import { angle, color, hero, range, select, single, toggle, type EffectDef } from "../types";

export const glitch: EffectDef[] = [
  {
    id: "glitch",
    name: "Glitch",
    category: "Glitch",
    description: "Digital breakup: displaced blocks, channel splits, scanline tears and inverted slices.",
    keywords: "corrupt broken digital error",
    preview: "woman:3",
    animated: true,
    params: [
      hero("amount", "Amount", 0, 1, 0.5),
      hero("blockSize", "Block size", 4, 200, 48, 1, { unit: "px" }),
      range("split", "RGB split", 0, 1, 0.4),
      range("tear", "Line tear", 0, 1, 0.35),
      range("invert", "Inverted slices", 0, 1, 0.15),
      range("speed", "Speed", 0, 4, 1),
      toggle("freeze", "Freeze frame"),
    ],
    passes: single(`
void main() {
  float t = u_freeze > 0.5 ? uSeed : floor(uTime * 12.0 * u_speed) + uSeed * 13.0;
  vec2 px = refCoord(vUv);
  vec2 bs = vec2(u_blockSize * (1.0 + hash11(t) * 3.0), u_blockSize * 0.5);
  vec2 b = floor(px / bs);
  float r = hash12(b + t);
  vec2 uv = vUv;
  if (r < u_amount * 0.35) uv.x += (hash12(b + t + 1.7) - 0.5) * 0.25 * u_amount;
  float row = floor(px.y / (2.0 + hash11(t + 2.0) * 10.0));
  if (hash12(vec2(row, t)) < u_tear * 0.15) uv.x += (hash12(vec2(row, t + 9.0)) - 0.5) * 0.08;
  float sp = u_split * 0.012 * (0.5 + r);
  vec3 c = vec3(texture(uTex0, uv + vec2(sp, 0.0)).r, texture(uTex0, uv).g, texture(uTex0, uv - vec2(sp, sp * 0.3)).b);
  if (hash12(b * 1.3 + t + 4.0) < u_invert * u_amount * 0.2) c = 1.0 - c;
  if (hash12(b + t + 7.0) < u_amount * 0.04) c = vec3(hash12(b + t), hash12(b + t + 1.0), hash12(b + t + 2.0)) * step(0.5, luma(c));
  fragColor = vec4(c, 1.0);
}`),
  },
  {
    id: "pixel-sort",
    name: "Pixel sort",
    category: "Glitch",
    description: "True GPU pixel sorting (odd–even transposition) of spans selected by a brightness band.",
    keywords: "sort melt drip streak asendorf",
    preview: "fire:0",
    params: [
      select("direction", "Direction", ["Down", "Up", "Right", "Left"]),
      select("key", "Sort by", ["Brightness", "Hue", "Saturation", "Red"]),
      hero("lo", "Band low", 0, 1, 0.25),
      hero("hi", "Band high", 0, 1, 0.92),
      hero("length", "Sort distance", 8, 600, 220, 1, { unit: "px" }),
      range("breakup", "Span breakup", 0, 1, 0.15),
      toggle("reverse", "Reverse order"),
    ],
    passes: [{
      id: "sort",
      inputs: ["input", "input"],
      repeat: (v, ctx) => Math.min(Number(v.length) * (ctx.height / 1080), 900),
      frag: `
float key(vec3 c) {
  int k = int(u_key + 0.5);
  if (k == 1) return rgb2hsv(c).x;
  if (k == 2) return rgb2hsv(c).y;
  if (k == 3) return c.r;
  return luma(c);
}
bool inBand(vec2 uv, vec2 px) {
  float l = luma(texture(uTex1, uv).rgb);
  float n = hash12(floor(px / vec2(1.0, 18.0)) + uSeed);
  return l >= u_lo && l <= u_hi && n >= u_breakup * 0.5;
}
void main() {
  int d = int(u_direction + 0.5);
  bool vertical = d < 2;
  vec2 px = floor(vUv * uRes);
  float idx = vertical ? px.y : px.x;
  float parity = mod(idx + uIter, 2.0);
  float dir = parity < 0.5 ? 1.0 : -1.0;
  vec2 step1 = vertical ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  vec2 opx = px + step1 * dir;
  vec2 uv = (px + 0.5) / uRes;
  vec2 ouv = (opx + 0.5) / uRes;
  vec4 self = texture(uTex0, uv);
  if (opx.x < 0.0 || opx.y < 0.0 || opx.x >= uRes.x || opx.y >= uRes.y || !inBand(uv, px) || !inBand(ouv, opx)) { fragColor = self; return; }
  vec4 other = texture(uTex0, ouv);
  float ks = key(self.rgb);
  float ko = key(other.rgb);
  // Ascending toward +axis unless the direction or reverse flips it.
  bool asc = (d == 0 || d == 3);
  if (u_reverse > 0.5) asc = !asc;
  bool lowSide = dir > 0.0;
  bool keepSmaller = asc ? !lowSide : lowSide;
  bool swap = keepSmaller ? ko < ks : ko > ks;
  fragColor = swap ? other : self;
}`,
    }],
  },
  {
    id: "jpeg-glitch",
    name: "JPEG glitch",
    category: "Glitch",
    description: "Heavy JPEG compression: 8×8 block quantisation, chroma subsampling and corrupted slices.",
    keywords: "compression artifact blocks datamosh corrupt",
    preview: "pinkflower:1",
    params: [
      hero("quality", "Quality", 0, 1, 0.25),
      hero("corrupt", "Corruption", 0, 1, 0.35),
      range("block", "Block size", 4, 32, 8, 1, { unit: "px" }),
      range("chroma", "Chroma loss", 0, 1, 0.7),
      range("ringing", "Ringing", 0, 1, 0.5),
    ],
    passes: single(`
vec3 toYcc(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.1687, -0.3313, 0.5)) + 0.5, dot(c, vec3(0.5, -0.4187, -0.0813)) + 0.5); }
vec3 toRgb(vec3 y) { y.yz -= 0.5; return vec3(y.x + 1.402 * y.z, y.x - 0.34414 * y.y - 0.71414 * y.z, y.x + 1.772 * y.y); }
vec3 lowpass(vec2 uv, vec2 bsz, float n) {
  vec2 cell = floor(uv * uRes / bsz);
  vec2 f = fract(uv * uRes / bsz);
  vec2 g = f * (n - 1.0);
  vec2 i0 = floor(g);
  vec2 w = fract(g);
  vec2 base = cell * bsz / uRes;
  vec2 st = bsz / uRes / max(n - 1.0, 1.0);
  vec2 inset = bsz / uRes * 0.0625;
  vec3 a = texture(uTex0, base + inset + i0 * st * 0.875).rgb;
  vec3 b = texture(uTex0, base + inset + (i0 + vec2(1.0, 0.0)) * st * 0.875).rgb;
  vec3 c = texture(uTex0, base + inset + (i0 + vec2(0.0, 1.0)) * st * 0.875).rgb;
  vec3 d = texture(uTex0, base + inset + (i0 + vec2(1.0, 1.0)) * st * 0.875).rgb;
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
void main() {
  vec2 bsz = vec2(u_block * refScale());
  vec2 uv = vUv;
  vec2 cell = floor(uv * uRes / bsz);
  float row = cell.y;
  float t = uSeed * 7.0;
  if (hash11(row * 0.37 + t) < u_corrupt * 0.25) uv.x += floor(hash11(row + t) * 6.0 - 3.0) * bsz.x / uRes.x * 2.0;
  float n = mix(2.0, 5.0, u_quality);
  vec3 lp = lowpass(uv, bsz, n);
  vec3 full = texture(uTex0, uv).rgb;
  vec3 y = toYcc(mix(lp, full, u_quality * u_quality));
  vec3 ch = toYcc(lowpass(uv, bsz * 2.0, 2.0));
  y.yz = mix(y.yz, ch.yz, u_chroma);
  float q = mix(0.18, 0.02, u_quality);
  vec2 f = fract(uv * uRes / bsz);
  float ring = (sin(f.x * PI * 4.0) * sin(f.y * PI * 4.0)) * u_ringing * q * 0.6;
  y.x = floor((y.x + ring) / q + 0.5) * q;
  y.yz = floor(y.yz / (q * 1.6) + 0.5) * (q * 1.6);
  vec3 o = toRgb(y);
  vec2 bc = floor(uv * uRes / bsz);
  float h = hash12(bc + t);
  if (h < u_corrupt * 0.06) o = o.gbr;
  if (h > 1.0 - u_corrupt * 0.03) o = vec3(toRgb(vec3(y.x, ch.zy)));
  fragColor = vec4(sat(o), 1.0);
}`),
  },
  {
    id: "rgb-shift",
    name: "RGB shift",
    category: "Glitch",
    description: "Chromatic aberration: linear channel offset, radial lens fringing or full spectral dispersion.",
    keywords: "chromatic aberration split prism dispersion",
    preview: "face:3",
    params: [
      select("mode", "Mode", ["Linear", "Radial", "Spectral"]),
      hero("amount", "Amount", 0, 60, 12, 0.5, { unit: "px" }),
      angle("angle", "Angle", 0),
      range("falloff", "Edge falloff", 0, 1, 0.6),
    ],
    passes: single(`
void main() {
  int m = int(u_mode + 0.5);
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * refPx(u_amount);
  vec2 rd = (vUv - 0.5);
  float fall = mix(1.0, length(rd) * 2.0, u_falloff);
  vec2 rv = rd * refPx(u_amount).y * 6.0 * fall;
  vec3 c;
  if (m == 0) c = vec3(texture(uTex0, vUv + dir).r, texture(uTex0, vUv).g, texture(uTex0, vUv - dir).b);
  else if (m == 1) c = vec3(texture(uTex0, vUv + rv).r, texture(uTex0, vUv).g, texture(uTex0, vUv - rv).b);
  else {
    vec3 acc = vec3(0.0); vec3 wsum = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      float t = float(i) / 8.0;
      vec3 w = sat(vec3(1.0 - abs(t - 0.0) * 2.2, 1.0 - abs(t - 0.5) * 2.2, 1.0 - abs(t - 1.0) * 2.2));
      acc += texture(uTex0, vUv + rv * (t - 0.5) * 2.0).rgb * w;
      wsum += w;
    }
    c = acc / wsum;
  }
  fragColor = vec4(c, 1.0);
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
    description: "FM synthesis on the image: luminance bends a carrier wave into rainbow interference lines.",
    keywords: "fm frequency modulation rainbow interference op art",
    preview: "fruit:2",
    params: [
      hero("frequency", "Carrier", 5, 400, 90, 1),
      hero("depth", "Mod depth", 0, 60, 18, 0.1),
      angle("angle", "Angle", 90),
      select("palette", "Colour", ["Spectrum", "Source", "Mono", "Two-tone"]),
      color("c1", "Colour A", "#0A0A0A"),
      color("c2", "Colour B", "#F7F2EC"),
      range("mix", "Mix", 0, 1, 1),
      range("sharp", "Sharpness", 0, 1, 0.4),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 p = (vUv - 0.5) * vec2(aspect(), 1.0);
  float a = radians(u_angle);
  float x = dot(p, vec2(cos(a), sin(a)));
  float l = luma(blur13(uTex0, vUv, refPx(2.0)).rgb);
  float phase = x * u_frequency + l * u_depth;
  float w = sin(phase * TAU * 0.5);
  float s = mix(w * 0.5 + 0.5, smoothstep(-0.2, 0.2, w), u_sharp);
  int m = int(u_palette + 0.5);
  vec3 o;
  if (m == 0) o = hsv2rgb(vec3(fract(phase * 0.02 + l * 0.6), 0.85, 0.35 + s * 0.65));
  else if (m == 1) o = c.rgb * (0.25 + s * 1.1);
  else if (m == 2) o = vec3(s);
  else o = mix(u_c1, u_c2, s);
  fragColor = vec4(mix(c.rgb, sat(o), u_mix), 1.0);
}`),
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Glitch",
    description: "Op-art stripes whose thickness follows the image: linear, concentric or wave.",
    keywords: "lines op art concentric engraving",
    preview: "lips:1",
    params: [
      select("shape", "Shape", ["Linear", "Concentric", "Wave", "Spiral"]),
      hero("count", "Stripes", 10, 300, 70, 1),
      hero("response", "Response", 0, 2, 1),
      angle("angle", "Angle", 0),
      color("ink", "Ink", "#D3202A"),
      color("paper", "Paper", "#0A0A0A"),
      toggle("sourceColor", "Use source colour"),
      range("cx", "Centre X", 0, 1, 0.5),
      range("cy", "Centre Y", 0, 1, 0.5),
    ],
    handles: [{ x: "cx", y: "cy", label: "Centre" }],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 p = (vUv - vec2(u_cx, u_cy)) * vec2(aspect(), 1.0);
  p = rot(radians(u_angle)) * p;
  int s = int(u_shape + 0.5);
  float v;
  if (s == 0) v = p.y;
  else if (s == 1) v = length(p);
  else if (s == 2) v = p.y + sin(p.x * 12.0) * 0.03;
  else v = length(p) + atan(p.y, p.x) / TAU / u_count * 6.0;
  float l = luma(c.rgb);
  float stripe = fract(v * u_count);
  float width = sat((1.0 - l) * u_response);
  float on = aastep(width, abs(stripe - 0.5) * 2.0);
  vec3 ink = u_sourceColor > 0.5 ? c.rgb : u_ink;
  fragColor = vec4(mix(ink, u_paper, on), 1.0);
}`),
  },
  {
    id: "grid-split",
    name: "Grid split",
    category: "Glitch",
    description: "Slices the frame into a grid of offset, mirrored and zoomed tiles with blueprint lines.",
    keywords: "tiles grid mosaic offset mirror",
    preview: "celltower:0",
    params: [
      hero("cols", "Columns", 1, 24, 6, 1),
      hero("rows", "Rows", 1, 24, 8, 1),
      range("offset", "Tile offset", 0, 1, 0.25),
      range("zoom", "Tile zoom", 0, 1, 0.2),
      range("mirror", "Mirror chance", 0, 1, 0.2),
      range("lines", "Grid lines", 0, 1, 0.6),
      color("lineColor", "Line colour", "#F7F2EC"),
    ],
    passes: single(`
void main() {
  vec2 g = vec2(u_cols, u_rows);
  vec2 cell = floor(vUv * g);
  vec2 f = fract(vUv * g);
  vec2 h = hash22(cell + uSeed);
  vec2 lf = f;
  if (hash12(cell + 3.1 + uSeed) < u_mirror) lf.x = 1.0 - lf.x;
  float z = 1.0 - u_zoom * h.x * 0.6;
  lf = (lf - 0.5) * z + 0.5;
  vec2 uv = (cell + lf) / g + (h - 0.5) * u_offset / g;
  vec3 c = texture(uTex0, uv).rgb;
  vec2 e = min(f, 1.0 - f) * uRes / g;
  float line = 1.0 - smoothstep(0.5, 1.5, min(e.x, e.y) / refScale());
  fragColor = vec4(mix(c, u_lineColor, line * u_lines), 1.0);
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
