import { glyphAtlas, paletteTex, sortByDensity } from "../../lib/textures";
import { color, group, hero, range, select, single, text, toggle, type EffectDef, type ParamValues } from "../types";
import { PALETTES, PALETTE_NAMES } from "./color";

export const CHARSETS = [
  { name: "Standard", chars: " .:-=+*#%@" },
  { name: "Detailed", chars: " .'`^\",:;Il!i><~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { name: "Blocks", chars: " ░▒▓█" },
  { name: "Binary", chars: " 01" },
  { name: "Hex", chars: " .:0123456789ABCDEF" },
  { name: "Lines", chars: " .,-~=≡#" },
  { name: "Minimal", chars: " .oO@" },
];
const EDGE_GLYPHS = "|/-\\";

function asciiRamp(v: ParamValues): string {
  const idx = Number(v.charSet) | 0;
  if (idx >= CHARSETS.length) return sortByDensity(" " + String(v.custom || "ARMGDN"));
  return CHARSETS[idx].chars;
}

/** Evenly spaced subset of a palette, so "colour count" always spans dark to light. */
function paletteSubset(colors: string[], count: number): string[] {
  const n = Math.max(2, Math.min(colors.length, Math.round(count)));
  if (n >= colors.length) return colors;
  return Array.from({ length: n }, (_, i) => colors[Math.round((i / (n - 1)) * (colors.length - 1))]);
}

/**
 * Shared NTSC helpers. The composite signal of an RGB colour at sample n on line `row` is
 * Y + I·cos φ + Q·sin φ with the colour subcarrier at a quarter of the sample rate
 * (four samples per cycle) and a half-cycle phase flip per line and per frame (dot crawl).
 */
const NTSC = `
float ntscPhase(float n, float row, float frame) { return n * PI * 0.5 + (row + frame) * PI; }
float composite(vec3 rgb, float ph) { vec3 yiq = rgb2yiq(rgb); return yiq.x + yiq.y * cos(ph) + yiq.z * sin(ph); }
float sinc(float x) { return abs(x) < 1e-4 ? 1.0 : sin(PI * x) / (PI * x); }
`;

export const retro: EffectDef[] = [
  /* ── VHS ─────────────────────────────────────────────────────────── */
  {
    id: "vhs",
    name: "VHS",
    category: "Retro",
    description: "Consumer tape playback, modelled on the signal: band-limited luma, low-bandwidth delayed chroma, peaking, tape geometry, dropouts and grain.",
    keywords: "tape vcr 80s 90s camcorder analog videotape",
    preview: "nightlife:0",
    animated: true,
    params: [
      hero("resolution", "Resolution", 128, 1024, 320, 1),
      hero("colorDelay", "Color delay", 0, 8, 5.8, 0.1),
      hero("grain", "Grain", 0, 2, 0.75),
      ...group("Tape", [
        range("distortion", "Distortion", 0, 2.5, 0.23),
        range("wobble", "Wobble", 0, 2, 0.6),
        range("tapeCrease", "Tape crease", 0, 2, 0.5),
        range("trackingNoise", "Tracking noise", 0, 2, 0.4),
        range("verticalJump", "Vertical jump", 0, 2, 0.05),
        range("sparkle", "Sparkle", 0, 2, 0.5),
        range("flicker", "Flicker", 0, 2, 0.06),
      ]),
      ...group("Color", [
        range("colorFringing", "Color fringing", 0, 2, 0.8),
        range("saturation", "Saturation", 0, 2.5, 1.15),
        range("colorShift", "Color shift", 0, 2, 0.1),
        range("colorBlend", "Color blend", 0, 1, 1),
      ]),
      ...group("Signal", [
        range("softness", "Softness", 0.4, 2, 0.8),
        range("sharpening", "Sharpening", 0, 2, 0.45),
      ]),
    ],
    passes: [
      {
        // Playback geometry + record bandwidth: luma and chroma are band-limited separately
        // (chroma ~1/8 of luma) and chroma lags behind luma by the colour delay.
        id: "tape",
        inputs: ["input"],
        frag: `
vec3 yiqAt(vec2 uv) { return rgb2yiq(texture(uTex0, uv).rgb); }
void main() {
  float frame = floor(uTime * 29.97);
  float seed = uSeed * 7.13;
  vec2 uv = vUv;
  // Vertical jump: rare whole-frame hops that settle back.
  float jt = floor(uTime * 1.5 + seed);
  float jumping = step(1.0 - u_verticalJump * 0.35, hash11(jt * 1.31 + 0.7));
  uv.y += jumping * (hash11(jt * 2.7) - 0.3) * 0.12 * exp(-fract(uTime * 1.5 + seed) * 7.0);
  uv.y = fract(uv.y);
  float line = floor(uv.y * 486.0);
  // Per-line timebase wobble.
  float wob = snoise(vec2(line * 0.045, uTime * 1.7 + seed)) * 0.7 + (hash12(vec2(line, frame)) - 0.5) * 0.6;
  float dx = wob * u_wobble * 0.0011;
  // Distortion: slow skew of the whole picture plus head-switching tear at the bottom.
  dx += (snoise(vec2(uv.y * 2.3, uTime * 0.35 + seed)) * 0.0022 + sin(uv.y * 9.0 + uTime) * 0.0007) * u_distortion;
  float head = smoothstep(0.045, 0.0, uv.y);
  dx += head * (0.012 + 0.03 * hash12(vec2(line, frame))) * u_distortion;
  // Tape crease: a thin band that drifts down the frame, tearing lines sideways.
  float cy = 1.1 - fract(uTime * 0.037 + seed * 0.11) * 1.3;
  float crease = exp(-pow((uv.y - cy) / 0.008, 2.0)) * u_tapeCrease;
  dx += crease * (hash12(vec2(line, frame + 3.0)) - 0.35) * 0.05;
  // Tracking error band: rolls slowly and shoves its lines sideways.
  float ty = 1.15 - fract(uTime * 0.061 + seed * 0.37) * 1.4;
  float track = smoothstep(0.06, 0.0, abs(uv.y - ty)) * u_trackingNoise;
  dx += track * (hash12(vec2(line * 0.5, frame)) - 0.5) * 0.04;
  uv.x += dx;

  // Luma: Gaussian band-limit to "resolution" samples across the frame.
  float lw = 1.0 / u_resolution;
  float sy = lw * u_softness * 0.55;
  float y = 0.0; float wy = 0.0;
  for (int i = -6; i <= 6; i++) {
    float k = float(i);
    float w = exp(-k * k / 18.0);
    y += yiqAt(uv + vec2(k * sy * 0.5, 0.0)).x * w;
    wy += w;
  }
  y /= wy;
  // Chroma: ~1/8 bandwidth, delayed to the right; I and Q misregister for colour fringing.
  float delay = u_colorDelay / 640.0;
  float sc = lw * 4.5 * (0.6 + u_softness * 0.4);
  float fr = u_colorFringing * 0.0025;
  vec2 iq = vec2(0.0); float wc = 0.0;
  for (int i = -6; i <= 6; i++) {
    float k = float(i);
    float w = exp(-k * k / 14.0);
    vec2 base = uv + vec2(k * sc * 0.45 - delay, 0.0);
    iq += vec2(yiqAt(base - vec2(fr, 0.0)).y, yiqAt(base + vec2(fr, 0.0)).z) * w;
    wc += w;
  }
  iq /= wc;
  // Colour shift: a fixed hue twist plus slow drift, as tapes wander between green and magenta.
  float a = u_colorShift * (0.9 + 0.35 * snoise(vec2(uTime * 0.21, seed)));
  iq = mat2(cos(a), sin(a), -sin(a), cos(a)) * iq * u_saturation;
  vec2 iqSharp = yiqAt(uv).yz * u_saturation;
  iq = mix(iqSharp, iq, u_colorBlend);
  // Dropout along the crease and the tracking band.
  y = mix(y, y * 0.6 + 0.25, crease * 0.6);
  fragColor = vec4(yiq2rgb(vec3(y, iq)), 1.0);
}`,
      },
      {
        // Playback electronics: peaking (the bright halo on edges), grain, chroma noise,
        // dropouts ("sparkle"), tracking noise bars and flicker.
        id: "deck",
        inputs: ["tape"],
        frag: `
void main() {
  float frame = floor(uTime * 29.97);
  float seed = uSeed * 7.13;
  vec2 uv = vUv;
  float line = floor(uv.y * 486.0);
  float lw = 1.0 / u_resolution;
  vec3 c = rgb2yiq(texture(uTex0, uv).rgb);
  float l1 = rgb2yiq(texture(uTex0, uv - vec2(lw * 1.6, 0.0)).rgb).x;
  float r1 = rgb2yiq(texture(uTex0, uv + vec2(lw * 1.6, 0.0)).rgb).x;
  // Peaking filter: boosts the luma high-pass, leaving the bright/dark halos tape is known for.
  c.x += u_sharpening * (c.x - (l1 + r1) * 0.5) * 1.3;
  // Grain: fresh every frame but fixed in place (it never scrolls); slightly wider than tall.
  vec2 gp = floor(vec2(uv.x * u_resolution * 1.5, uv.y * 486.0));
  float g = hash12(gp + vec2(frame * 13.1, frame * 7.7) + seed) + hash12(gp * 1.7 + frame * 3.1) - 1.0;
  c.x += g * u_grain * 0.055;
  // Chroma noise: low-frequency horizontal streaks.
  vec2 cp = vec2(floor(uv.x * u_resolution / 12.0), line);
  c.yz += (vec2(hash12(cp + frame), hash12(cp + frame + 91.0)) - 0.5) * u_grain * 0.05;
  // Sparkle: short white dropout streaks on random lines.
  float dl = hash12(vec2(line, frame + 17.0));
  if (dl < u_sparkle * 0.012) {
    float x0 = hash12(vec2(line, frame + 5.0));
    float len = 0.01 + 0.06 * hash12(vec2(line, frame + 9.0));
    float s = smoothstep(x0, x0 + 0.004, uv.x) * smoothstep(x0 + len, x0 + len * 0.6, uv.x);
    c.x = mix(c.x, 0.95, s);
    c.yz *= 1.0 - s;
  }
  // Tracking noise bars inside the rolling band.
  float ty = 1.15 - fract(uTime * 0.061 + seed * 0.37) * 1.4;
  float band = smoothstep(0.05, 0.0, abs(uv.y - ty)) * u_trackingNoise;
  float bar = step(0.55, hash12(vec2(floor(uv.x * 160.0), line + frame)));
  c.x = mix(c.x, 0.85 * bar, band * 0.55 * step(0.4, hash12(vec2(line, frame))));
  // Head-switching noise along the bottom edge.
  float head = smoothstep(0.03, 0.0, uv.y) * min(u_distortion, 1.0);
  c.x += head * (hash12(vec2(uv.x * 400.0, line + frame)) - 0.5) * 0.4;
  // Flicker.
  c.x *= 1.0 + (hash11(frame * 0.73 + seed) - 0.5) * u_flicker * 0.35;
  vec3 rgb = yiq2rgb(c);
  // Tape black level is slightly lifted and whites roll off.
  rgb = rgb * 0.94 + 0.025;
  fragColor = vec4(sat(rgb), 1.0);
}`,
      },
    ],
  },

  /* ── NTSC ────────────────────────────────────────────────────────── */
  {
    id: "ntsc",
    name: "NTSC",
    category: "Retro",
    description: "True composite video: encodes each line onto a colour subcarrier, then decodes with FIR filters. Dot crawl, rainbow fringes and ringing come from the signal.",
    keywords: "composite rf broadcast artifact dot crawl television",
    preview: "portraits:4",
    animated: true,
    params: [
      hero("ringing", "Ringing", 5, 30, 20, 1),
      hero("fringes", "Fringes", 1, 20, 1, 0.5),
      hero("saturation", "Saturation", 0, 5, 2, 0.1),
      range("encoding", "Encoding", 0.5, 5, 1, 0.1),
      range("noise", "Noise", 0, 1, 0.01),
      range("smear", "Smear", -0.2, 0.2, 0, 0.01),
      ...group("Chroma bandwidth", [
        range("color1", "Color 1 (I)", 1, 20, 8, 0.5),
        range("color2", "Color 2 (Q)", 1, 20, 11, 0.5),
      ]),
    ],
    passes: single(NTSC + `
void main() {
  float frame = mod(floor(uTime * 29.97), 2.0);
  // 640 composite samples per line (4 per subcarrier cycle), 480 lines.
  float samples = 640.0;
  float row = floor(vUv.y * 480.0);
  float n0 = floor(vUv.x * samples);
  float y = 0.0; float wy = 0.0;
  float ii = 0.0; float wi = 0.0;
  float qq = 0.0; float wq = 0.0;
  // Luma low-pass: windowed sinc. More "ringing" = longer, less damped kernel; more
  // "fringes" = a higher cutoff that lets the subcarrier through as rainbow fringes.
  float fc = mix(0.16, 0.26, (u_fringes - 1.0) / 19.0) / max(u_encoding * 0.6 + 0.4, 0.2);
  float damp = mix(12.0, 1.0, (u_ringing - 5.0) / 25.0);
  float si = 20.0 / u_color1;
  float sq = 20.0 / u_color2;
  for (int i = -16; i <= 16; i++) {
    float k = float(i);
    float n = n0 + k;
    vec2 suv = vec2((n + 0.5) / samples, vUv.y);
    float ph = ntscPhase(n, row, frame);
    float s = composite(texture(uTex0, suv).rgb, ph);
    s += (hash12(vec2(n, row + uTime * 60.0)) - 0.5) * u_noise * 0.6;
    float win = exp(-k * k / (damp * 24.0));
    float h = 2.0 * fc * sinc(2.0 * fc * k) * win;
    y += s * h; wy += h;
    float gi = exp(-k * k / (2.0 * si * si));
    float gq = exp(-k * k / (2.0 * sq * sq));
    ii += s * cos(ph) * gi; wi += gi;
    qq += s * sin(ph) * gq; wq += gq;
  }
  y /= wy;
  vec2 iq = vec2(ii / wi, qq / wq) * 2.0 * (u_saturation * 0.5);
  // Smear: the luma tail of a slow-recovering amplifier.
  if (abs(u_smear) > 0.001) {
    float dir = sign(u_smear);
    float acc = 0.0; float ws = 0.0;
    for (int i = 1; i <= 8; i++) {
      float k = float(i);
      vec2 suv = vec2((n0 - dir * k * 3.0 + 0.5) / samples, vUv.y);
      float w = exp(-k * 0.35);
      acc += rgb2yiq(texture(uTex0, suv).rgb).x * w; ws += w;
    }
    y += (acc / ws - y) * abs(u_smear) * 3.0;
  }
  fragColor = vec4(sat(yiq2rgb(vec3(y, iq))), 1.0);
}`),
  },

  /* ── CRT screen ──────────────────────────────────────────────────── */
  {
    id: "crt",
    name: "CRT screen",
    category: "Retro",
    description: "A curved tube seen from a distance: phosphor dot triads in linear light, beam gamma, bezel and vignette.",
    keywords: "monitor tube scanlines arcade phosphor television",
    preview: "portraits:9",
    params: [
      hero("density", "Density", 0.5, 10, 4.5),
      hero("curvature", "Curvature", 0.01, 0.7, 0.2),
      hero("brightness", "Brightness gain", 0, 10, 2.6),
      range("distance", "Distance", 1.5, 10, 2),
      range("bezel", "Bezel", 0, 1, 0.02),
      range("vignette", "Vignette", 0, 10, 6),
      ...group("Phosphor", [
        toggle("dots", "Phosphor dots", 1),
        select("layout", "Mask", ["Shadow mask (dots)", "Aperture grille", "Slot mask"]),
        range("size", "Dot size", 0.05, 0.5, 0.4),
        range("softness", "Dot softness", 0.001, 0.5, 0.1),
        range("gamma", "Gamma correction", 0.1, 10, 2.4),
      ]),
      ...group("Background", [color("bg", "Background", "#000000"), range("bgOpacity", "Background opacity", 0, 1, 1)]),
    ],
    passes: single(`
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= aspect();
  // Ray onto a sphere-ish screen: farther away = flatter, more curvature = rounder.
  float k = u_curvature * 0.6 / (0.4 + u_distance * 0.3);
  float r2 = dot(p, p);
  vec2 q = p * (1.0 + k * r2) / (1.0 + k * 0.5);
  q.x /= aspect();
  vec2 uv = q * 0.5 + 0.5;
  // Bezel: rounded rectangle, corners rounder with curvature.
  vec2 e = abs(q);
  float rad = 0.04 + u_curvature * 0.12;
  vec2 d2 = max(e - (1.0 - u_bezel * 0.15 - rad), 0.0);
  float edge = length(d2) - rad;
  float inside = smoothstep(0.004, -0.004, edge);
  vec4 bgc = vec4(u_bg, u_bgOpacity);
  if (inside <= 0.0) { fragColor = bgc; return; }
  uv = (uv - 0.5) / (1.0 - u_bezel * 0.15) + 0.5;
  vec3 c = srgb2lin(texture(uTex0, uv).rgb);
  c = pow(max(c, 0.0), vec3(u_gamma / 2.2));
  // Phosphor mask, in screen space so the tube's structure stays put.
  float pitch = max(2.0, 40.0 / u_density) * refScale();
  vec2 px = vUv * uRes / pitch;
  vec3 mask = vec3(1.0);
  if (u_dots > 0.5) {
    int L = int(u_layout + 0.5);
    vec2 cell = floor(px);
    vec2 f = fract(px);
    if (L == 0) {
      // Delta triads: alternate columns are offset by half a cell.
      vec2 g = vec2(px.x * 3.0, px.y + mod(floor(px.x * 1.5), 2.0) * 0.5);
      vec2 gf = fract(g) - 0.5;
      float ch = mod(floor(g.x), 3.0);
      float dot_ = smoothstep(u_size, u_size - u_softness, length(gf * vec2(1.0, 1.15)));
      mask = vec3(ch == 0.0 ? dot_ : 0.0, ch == 1.0 ? dot_ : 0.0, ch == 2.0 ? dot_ : 0.0);
    } else {
      float sx = f.x * 3.0;
      float ch = floor(sx);
      float stripe = smoothstep(u_size + 0.1, u_size + 0.1 - u_softness, abs(fract(sx) - 0.5));
      float slot = L == 2 ? smoothstep(0.5 - u_softness * 0.5, 0.42 - u_softness * 0.5, abs(fract(px.y + mod(cell.x, 2.0) * 0.5) - 0.5) - 0.05) : 1.0;
      mask = vec3(ch == 0.0 ? 1.0 : 0.0, ch == 1.0 ? 1.0 : 0.0, ch == 2.0 ? 1.0 : 0.0) * stripe * slot;
      // Beam scanlines with the aperture grille.
      float beam = mix(0.5, 1.0, luma(c));
      mask *= exp(-pow((f.y - 0.5) / (0.35 * beam), 2.0));
    }
    mask *= 3.0;
  } else {
    float f = fract(px.y);
    float beam = mix(0.45, 0.9, luma(c));
    mask = vec3(exp(-pow((f - 0.5) / (0.4 * beam), 2.0)) * 1.4);
  }
  vec3 lit = c * mask * u_brightness;
  // Halo from the glass spreading the brightest phosphors.
  vec3 halo = srgb2lin(blur13(uTex0, uv, refPx(6.0)).rgb) * 0.15 * u_brightness;
  vec3 col = lin2srgb(lit + halo);
  vec2 v = uv * (1.0 - uv);
  col *= pow(max(v.x * v.y * 16.0, 0.0), u_vignette * 0.04);
  fragColor = mix(bgc, vec4(sat(col), 1.0), inside);
}`),
  },

  /* ── LED screen ──────────────────────────────────────────────────── */
  {
    id: "led-screen",
    name: "LED screen",
    category: "Retro",
    description: "Billboard LED matrix: one colour per diode, RGB sub-diodes or solid cells, gaps and diode bloom.",
    keywords: "led matrix billboard jumbotron diodes stadium",
    preview: "nightlife:6",
    params: [
      hero("pixelSize", "Pixel size", 0.5, 10, 2.82),
      hero("gap", "Gap", 0, 0.2, 0.04),
      hero("pixelBlur", "Pixel blur", 0, 5, 0.6),
      toggle("rgb", "RGB mode", 1),
      toggle("transparent", "Transparent"),
      range("boost", "Brightness", 0.5, 3, 1.3),
    ],
    passes: single(`
void main() {
  float ps = u_pixelSize * 3.0 * refScale();
  vec2 cell = floor(vUv * uRes / ps);
  vec2 cuv = (cell + 0.5) * ps / uRes;
  vec2 o = vec2(ps) / uRes * 0.33;
  vec3 c = texture(uTex0, cuv).rgb * 0.4 + (texture(uTex0, cuv + o).rgb + texture(uTex0, cuv - o).rgb + texture(uTex0, cuv + vec2(o.x, -o.y)).rgb + texture(uTex0, cuv + vec2(-o.x, o.y)).rgb) * 0.15;
  vec2 f = fract(vUv * uRes / ps);
  float soft = 0.02 + u_pixelBlur * 0.06;
  vec3 col;
  float cover;
  if (u_rgb > 0.5) {
    // Three vertical sub-diodes per pixel.
    float sx = f.x * 3.0;
    float ch = floor(sx);
    float bx = abs(fract(sx) - 0.5);
    float by = abs(f.y - 0.5);
    float g = u_gap * 2.5;
    float m = smoothstep(0.5 - g, 0.5 - g - soft * 3.0, bx) * smoothstep(0.5 - g, 0.5 - g - soft, by);
    col = vec3(ch == 0.0 ? c.r : 0.0, ch == 1.0 ? c.g : 0.0, ch == 2.0 ? c.b : 0.0) * m * 3.0;
    cover = m;
  } else {
    float d = max(abs(f.x - 0.5), abs(f.y - 0.5));
    float m = smoothstep(0.5 - u_gap, 0.5 - u_gap - soft, d);
    col = c * m;
    cover = m;
  }
  col *= u_boost;
  // Diode bloom spills into the gaps.
  col += c * u_pixelBlur * 0.08 * (1.0 - cover);
  float a = u_transparent > 0.5 ? max(cover, luma(col)) : 1.0;
  fragColor = vec4(sat(col), a);
}`),
  },

  /* ── Apple II ────────────────────────────────────────────────────── */
  {
    id: "micro-8bit",
    name: "Apple II",
    category: "Retro",
    description: "Hi-res artifact colour, simulated end to end: the image is encoded to a 1-bit 560-dot line and decoded by an NTSC monitor, so colour appears the way it did on the machine.",
    keywords: "apple ii hi-res lo-res artifact color 1977 home computer",
    preview: "palms:0",
    params: [
      select("mode", "Mode", ["Hi-res colour", "Lo-res 16", "Monochrome"]),
      toggle("raster", "4:3 raster"),
      hero("exposure", "Exposure", -2, 2, 0),
      hero("dither", "Dither", 0, 1, 1),
      ...group("Encoding", [
        range("priority", "Color priority", 0, 1, 0.5),
        select("pattern", "Dither pattern", ["Bayer", "Blue noise", "Clustered"]),
      ]),
      ...group("NTSC decoder", [
        range("lumaBlur", "Luma blur", 1, 8, 4, 0.1),
        range("bleed", "Color bleed", 2, 8, 8, 0.1),
        range("tint", "Tint", -60, 60, 0, 0.5, { unit: "°" }),
        range("saturation", "Saturation", 0, 2, 1),
      ]),
      ...group("Monitor", [
        range("crtGamma", "CRT gamma", 0, 0.6, 0.3),
        color("phosphor", "Phosphor", "#4AFF70"),
        range("scanlines", "Scanlines", 0, 1, 0),
      ]),
    ],
    passes: single(NTSC + `
float threshAt(vec2 c, int p) {
  if (p == 0) return bayer8(c);
  if (p == 1) return fract(ign(c + seedOffset()) + bayer2(c) * 0.25);
  vec2 f = fract(c / 4.0) - 0.5; return sat(length(f) * 1.35);
}
vec3 lores(vec3 c) {
  // 16 lo-res colours (approximate NTSC renderings).
  vec3 pal[16] = vec3[16](vec3(0.0), vec3(0.89,0.12,0.38), vec3(0.38,0.31,0.74), vec3(1.0,0.27,0.99), vec3(0.0,0.64,0.38), vec3(0.61), vec3(0.08,0.81,0.99), vec3(0.82,0.76,1.0), vec3(0.38,0.45,0.0), vec3(1.0,0.42,0.24), vec3(0.61), vec3(1.0,0.63,0.82), vec3(0.08,0.96,0.24), vec3(0.82,0.87,0.53), vec3(0.45,1.0,0.82), vec3(1.0));
  vec3 lab = rgb2oklab(c); float best = 1e9; vec3 o = vec3(0.0);
  for (int i = 0; i < 16; i++) { vec3 d = rgb2oklab(pal[i]) - lab; float e = dot(d, d); if (e < best) { best = e; o = pal[i]; } }
  return o;
}
void main() {
  int mode = int(u_mode + 0.5);
  float dots = 560.0;
  float lines = u_raster > 0.5 ? 192.0 : floor(280.0 / aspect() + 0.5);
  float row = floor(vUv.y * lines);
  float ex = exp2(u_exposure);
  if (mode == 1) {
    // Lo-res: 40×48 blocks of 16 colours.
    vec2 blocks = vec2(40.0, u_raster > 0.5 ? 48.0 : floor(40.0 / aspect() * 1.2 + 0.5));
    vec2 b = floor(vUv * blocks);
    vec3 c = sat(texture(uTex0, (b + 0.5) / blocks).rgb * ex);
    c += (threshAt(b, int(u_pattern + 0.5)) - 0.5) * u_dither * 0.25;
    vec3 col = lores(sat(c));
    col *= 1.0 - u_scanlines * 0.5 * step(0.5, fract(vUv.y * lines));
    fragColor = vec4(pow(col, vec3(1.0 + u_crtGamma)), 1.0);
    return;
  }
  float n0 = floor(vUv.x * dots);
  // Decode: luma = moving average of the bits, chroma = demodulated bits.
  float y = 0.0; float wy = 0.0; vec2 iq = vec2(0.0); float wc = 0.0;
  float sl = u_lumaBlur * 0.6;
  float sc = u_bleed * 0.75;
  for (int i = -12; i <= 12; i++) {
    float k = float(i);
    float n = n0 + k;
    vec2 suv = vec2((n + 0.5) / dots, (row + 0.5) / lines);
    vec3 src = sat(texture(uTex0, suv).rgb * ex);
    float ph = n * PI * 0.5;
    // Target composite level for this dot; colour priority trades luma accuracy for hue.
    vec3 yiq = rgb2yiq(src);
    float target = yiq.x * (1.0 - u_priority * 0.35) + (yiq.y * cos(ph) + yiq.z * sin(ph)) * (0.6 + u_priority * 0.8);
    float th = mix(0.5, threshAt(vec2(n, row), int(u_pattern + 0.5)), u_dither);
    float bit = mode == 2 ? step(th, yiq.x) : step(th, target);
    float wl = exp(-k * k / (2.0 * sl * sl));
    float wcc = exp(-k * k / (2.0 * sc * sc));
    y += bit * wl; wy += wl;
    iq += bit * vec2(cos(ph), sin(ph)) * wcc; wc += wcc;
  }
  y /= wy;
  iq = iq / wc * 2.0;
  float a = radians(u_tint);
  iq = mat2(cos(a), sin(a), -sin(a), cos(a)) * iq * u_saturation * 1.4;
  vec3 col = mode == 2 ? u_phosphor * y * 1.2 : yiq2rgb(vec3(y, iq));
  col = pow(sat(col), vec3(1.0 + u_crtGamma));
  float f = fract(vUv.y * lines);
  col *= 1.0 - u_scanlines * 0.6 * smoothstep(0.55, 0.95, f);
  fragColor = vec4(col, 1.0);
}`),
  },

  /* ── MacPaint ────────────────────────────────────────────────────── */
  {
    id: "paint-1bit",
    name: "MacPaint",
    category: "Retro",
    description: "1-bit bitmap painting: tones become fill patterns at a fixed bitmap width, with sharpening, outlines and paper/ink colours.",
    keywords: "macintosh 1984 bitmap pattern fill monochrome 1-bit",
    preview: "botanic:3",
    params: [
      hero("width", "Bitmap width", 32, 1024, 342, 1),
      hero("threshold", "Threshold", 0, 1, 0.45, 0.001),
      hero("contrast", "Contrast", 0.1, 4, 2.2),
      select("fill", "Fills", ["Patterns", "Ordered dither", "Threshold"]),
      range("grain", "Grain", 0, 1, 0),
      ...group("Detail", [
        range("smooth", "Smooth", 0, 3, 1, 1),
        range("sharpen", "Sharpen", -1, 2, 0.4),
        range("radius", "Radius", 0.5, 5, 1.2, 0.1),
      ]),
      ...group("Edges", [
        select("edges", "Edges", ["Off", "Outline", "Outline only"], 1),
        range("edgeThreshold", "Edge threshold", 0.01, 1, 0.12),
        range("edgeWidth", "Edge width", 0.5, 3, 1.1, 0.1),
      ]),
      ...group("Colours", [color("ink", "Ink", "#0F0F12"), color("paper", "Paper", "#F7F5EB"), range("blend", "Blend", 0, 1, 1)]),
    ],
    passes: single(`
// 8×8 fill patterns from light to dark (bit set = ink).
float fillPattern(vec2 p, int band) {
  vec2 q = mod(p, 8.0);
  float x = q.x; float y = q.y;
  if (band <= 0) return 0.0;
  if (band == 1) return float(mod(x, 4.0) == 0.0 && mod(y, 4.0) == 0.0);
  if (band == 2) return float(mod(x, 4.0) == 0.0 && mod(y, 2.0) == 0.0) + float(mod(x + 2.0, 4.0) == 0.0 && mod(y + 1.0, 4.0) == 0.0) * 0.0;
  if (band == 3) return float(mod(x + y, 4.0) == 0.0);
  if (band == 4) return float(mod(x, 2.0) == 0.0 && mod(y, 2.0) == 0.0);
  if (band == 5) return float(mod(x + y, 2.0) == 0.0);
  if (band == 6) return 1.0 - float(mod(x, 2.0) == 0.0 && mod(y, 2.0) == 0.0);
  if (band == 7) return 1.0 - float(mod(x + y, 4.0) == 0.0);
  if (band == 8) return 1.0 - float(mod(x, 4.0) == 0.0 && mod(y, 4.0) == 0.0);
  return 1.0;
}
void main() {
  float ps = uRes.x / u_width;
  vec2 cell = floor(vUv * uRes / ps);
  vec2 cuv = (cell + 0.5) * ps / uRes;
  vec2 tx = vec2(ps) / uRes;
  float l = luma(texture(uTex0, cuv).rgb);
  if (u_smooth > 0.5) l = mix(l, luma(blur13(uTex0, cuv, tx * u_smooth * 0.6).rgb), 0.6);
  float b = luma(blur13(uTex0, cuv, tx * u_radius).rgb);
  l += (l - b) * u_sharpen * 1.5;
  l += (hash12(cell + seedOffset()) - 0.5) * u_grain * 0.5;
  float v = sat((l - u_threshold) * u_contrast + 0.5);
  int f = int(u_fill + 0.5);
  float ink;
  if (f == 0) ink = fillPattern(cell, int(floor((1.0 - v) * 9.99)));
  else if (f == 1) ink = step(v, bayer8(cell));
  else ink = step(v, 0.5);
  int e = int(u_edges + 0.5);
  if (e > 0) {
    vec3 s = sobel(uTex0, cuv, tx * u_edgeWidth);
    float edge = step(u_edgeThreshold, s.x);
    ink = e == 1 ? max(ink, edge) : edge;
  }
  vec3 col = mix(u_paper, u_ink, ink);
  fragColor = vec4(mix(texture(uTex0, vUv).rgb, col, u_blend), 1.0);
}`),
  },

  /* ── ASCII ───────────────────────────────────────────────────────── */
  {
    id: "ascii",
    name: "ASCII",
    category: "Retro",
    description: "Real glyphs from a monospace font, chosen by brightness (and edge direction), in mono, original or overlay colour.",
    keywords: "text art characters terminal typography glyphs",
    preview: "nature:3",
    params: [
      select("charSet", "Character set", [...CHARSETS.map((c) => c.name), "Custom"]),
      text("custom", "Custom glyphs", "ARMGDN//", { maxLength: 64 }),
      hero("density", "Density", 14, 140, 60, 1),
      hero("contrast", "Contrast", 0, 3, 1),
      range("aspect", "Tile aspect", 0.55, 1.5, 0.6),
      range("cutDarks", "Cut darks", 0, 0.5, 0.02),
      range("cutLights", "Cut lights", 0, 0.5, 0),
      toggle("invert", "Invert"),
      ...group("Colour", [
        select("colorMode", "Glyph colour", ["Character colour", "Original", "Original, boosted"]),
        color("fg", "Character colour", "#FFFFFF"),
        color("bg", "Background colour", "#000000"),
        toggle("overlay", "Overlay on image"),
      ]),
      ...group("Edges", [toggle("edges", "Edge glyphs"), range("edgeThreshold", "Edge threshold", 0.05, 1, 0.35)]),
    ],
    aux: (v) => [glyphAtlas(asciiRamp(v) + EDGE_GLYPHS)],
    passes: single(`
uniform float uRampLen;
void main() {
  float cw = uRes.x / u_density;
  vec2 csz = vec2(cw, cw / u_aspect);
  vec2 cell = floor(vUv * uRes / csz);
  vec2 local = fract(vUv * uRes / csz);
  vec2 cuv = (cell + 0.5) * csz / uRes;
  vec2 o = csz / uRes * 0.25;
  vec3 c = (texture(uTex0, cuv).rgb * 2.0 + texture(uTex0, cuv + o).rgb + texture(uTex0, cuv - o).rgb + texture(uTex0, cuv + vec2(o.x, -o.y)).rgb + texture(uTex0, cuv + vec2(-o.x, o.y)).rgb) / 6.0;
  float l = sat((luma(c) - 0.5) * u_contrast + 0.5);
  if (u_invert > 0.5) l = 1.0 - l;
  float n = uRampLen;
  float total = n + 4.0;
  float blank = step(l, u_cutDarks) + step(1.0 - u_cutLights, l) * step(0.001, u_cutLights);
  float idx = floor(l * (n - 1.0) + 0.5);
  if (u_edges > 0.5) {
    vec3 s = sobel(uTex0, cuv, csz / uRes * 0.5);
    if (s.x > u_edgeThreshold) {
      float a = mod(atan(s.z, s.y) + PI, PI);
      float k = floor(mod(a / PI * 4.0 + 0.5, 4.0));
      idx = n + (k == 0.0 ? 2.0 : k == 1.0 ? 1.0 : k == 2.0 ? 0.0 : 3.0);
      blank = 0.0;
    }
  }
  vec2 auv = vec2((idx + 0.2 + local.x * 0.6) / total, local.y);
  float glyph = texture(uAux0, auv).r * (1.0 - min(blank, 1.0));
  int m = int(u_colorMode + 0.5);
  vec3 fg = m == 0 ? u_fg : m == 1 ? c : sat(c * 1.4 + 0.08);
  vec3 bg = u_overlay > 0.5 ? texture(uTex0, vUv).rgb : u_bg;
  fragColor = vec4(mix(bg, fg, glyph), 1.0);
}`, { uniforms: (v) => ({ uRampLen: Array.from(asciiRamp(v)).length }) }),
  },

  /* ── Dither ──────────────────────────────────────────────────────── */
  {
    id: "dither",
    name: "Dither",
    category: "Retro",
    description: "Ordered, clustered, noise and line dithers into a palette, with perceptual colour matching and chunky pixel steps.",
    keywords: "bayer ordered 1-bit noise palette pixel retro",
    preview: "nature:7",
    params: [
      select("pattern", "Pattern", ["Bayer 2×2", "Bayer 4×4", "Bayer 8×8", "Bayer 16×16", "Clustered 4×4", "Clustered 8×8", "Blue noise", "White noise", "Interleaved gradient", "Horizontal lines", "Vertical lines", "Diagonal lines", "Crosshatch", "Halftone dots", "Diamonds", "Checks", "Bricks", "Waves", "Spiral", "Scales", "Weave", "Ripple", "Stipple"], 2),
      select("palette", "Palette", PALETTE_NAMES, 0),
      hero("colors", "Colour count", 2, 18, 4, 1),
      hero("strength", "Dither strength", 0, 2, 1),
      hero("pixel", "Pixel step", 1, 8, 2, 1),
      select("distance", "Colour matching", ["RGB", "Perceptual", "Luma"], 1),
      range("gamma", "Gamma", 0.5, 5, 1.2, 0.1),
      range("contrast", "Contrast", 0.3, 3, 1.1),
    ],
    aux: (v) => [paletteTex(paletteSubset(PALETTES[Number(v.palette) | 0]?.colors ?? PALETTES[0].colors, Number(v.colors) || 4))],
    passes: single(`
float clustered(vec2 c, float n) { vec2 f = fract(c / n) - 0.5; return sat(length(f) * 1.41); }
float thresholdAt(vec2 c, int p) {
  if (p == 0) return bayer2(c);
  if (p == 1) return bayer4(c);
  if (p == 2) return bayer8(c);
  if (p == 3) return bayer16(c);
  if (p == 4) return clustered(c, 4.0);
  if (p == 5) return clustered(c, 8.0);
  if (p == 6) return fract(ign(c + seedOffset()) + bayer2(c) * 0.25);
  if (p == 7) return hash12(c + seedOffset() * 3.0);
  if (p == 8) return ign(c);
  if (p == 9) return fract(c.y / 4.0 + 0.125);
  if (p == 10) return fract(c.x / 4.0 + 0.125);
  if (p == 11) return fract((c.x + c.y) / 6.0);
  if (p == 12) return min(fract((c.x + c.y) / 6.0), fract((c.x - c.y) / 6.0)) * 2.0;
  if (p == 13) { vec2 f = fract(rot(0.785) * c / 6.0) - 0.5; return sat(length(f) * 1.41); }
  if (p == 14) { vec2 f = abs(fract(c / 6.0) - 0.5); return sat((f.x + f.y)); }
  if (p == 15) return mod(floor(c.x / 2.0) + floor(c.y / 2.0), 2.0) * 0.5 + bayer2(c) * 0.5;
  if (p == 16) { vec2 b = c; b.x += mod(floor(c.y / 4.0), 2.0) * 4.0; vec2 f = fract(b / vec2(8.0, 4.0)); return sat(max(abs(f.x - 0.5), abs(f.y - 0.5)) * 2.0); }
  if (p == 17) return fract(c.y / 6.0 + sin(c.x * 0.35) * 0.25);
  if (p == 18) { vec2 q = c - uRes * 0.5; return fract(length(q) / 6.0 + atan(q.y, q.x) / TAU); }
  if (p == 19) { vec2 f = vec2(fract(c.x / 8.0), fract(c.y / 4.0 + mod(floor(c.x / 8.0), 2.0) * 0.5)); return sat(length((f - vec2(0.5, 0.0)) * vec2(1.0, 2.0)) * 0.9); }
  if (p == 20) return mod(floor(c.x / 3.0) + floor(c.y / 3.0), 2.0) > 0.5 ? fract(c.x / 3.0) : fract(c.y / 3.0);
  if (p == 21) return fract(length(c) / 5.0);
  return step(0.5, hash12(floor(c / 2.0) + seedOffset())) * 0.5 + hash12(c) * 0.5;
}
void main() {
  float ps = max(1.0, u_pixel * refScale());
  vec2 cell = floor(vUv * uRes / ps);
  vec3 c = texture(uTex0, (cell + 0.5) * ps / uRes).rgb;
  c = pow(sat((c - 0.5) * u_contrast + 0.5), vec3(u_gamma));
  float np = uAuxRes0.x;
  float t = (thresholdAt(cell, int(u_pattern + 0.5)) - 0.5) * u_strength / max(np - 1.0, 1.0);
  int dm = int(u_distance + 0.5);
  vec3 target = sat(c + t);
  vec3 tl = rgb2oklab(target);
  float tluma = luma(target);
  float best = 1e9; vec3 o = vec3(0.0);
  for (int i = 0; i < 18; i++) {
    if (float(i) >= np) break;
    vec3 pc = texture(uAux0, vec2((float(i) + 0.5) / np, 0.5)).rgb;
    float d;
    if (dm == 0) { vec3 e = pc - target; d = dot(e, e); }
    else if (dm == 1) { vec3 e = rgb2oklab(pc) - tl; d = dot(e, e); }
    else { d = abs(luma(pc) - tluma); }
    if (d < best) { best = d; o = pc; }
  }
  fragColor = vec4(o, 1.0);
}`),
  },

  /* ── Smaller retro machines ──────────────────────────────────────── */
  {
    id: "pocket-cam",
    name: "Pocket camera",
    category: "Retro",
    description: "Handheld console camera: 128 px sensor, edge enhancement and four shades of green.",
    keywords: "handheld 4 shades green lcd camera 1998 gameboy",
    preview: "portraits:12",
    params: [
      hero("width", "Sensor width", 64, 320, 128, 1),
      hero("edge", "Edge enhance", 0, 2, 0.8),
      range("contrast", "Contrast", 0.5, 2.5, 1.3),
      range("brightness", "Brightness", -0.3, 0.3, 0.02),
      select("palette", "Palette", ["Pea soup", "Pocket grey", "Phosphor red", "Analog paper"]),
      range("grid", "Pixel grid", 0, 1, 0.25),
    ],
    aux: (v) => [paletteTex([PALETTES[1].colors, ["#1B1B1B", "#5A5A5A", "#A8A8A8", "#E8E8E8"], PALETTES[2].colors, PALETTES[3].colors][Number(v.palette) | 0])],
    passes: single(`
void main() {
  float ps = uRes.x / u_width;
  vec2 cell = floor(vUv * uRes / ps);
  vec2 uv = (cell + 0.5) * ps / uRes;
  vec2 tx = vec2(ps) / uRes;
  vec3 c = texture(uTex0, uv).rgb;
  vec3 n = (texture(uTex0, uv + vec2(tx.x, 0.0)).rgb + texture(uTex0, uv - vec2(tx.x, 0.0)).rgb + texture(uTex0, uv + vec2(0.0, tx.y)).rgb + texture(uTex0, uv - vec2(0.0, tx.y)).rgb) * 0.25;
  float l = luma(c) + (luma(c) - luma(n)) * u_edge;
  l = sat((l - 0.5) * u_contrast + 0.5 + u_brightness);
  float q = floor(sat(l + (bayer4(cell) - 0.5) * 0.25) * 3.999);
  vec3 col = texture(uAux0, vec2((q + 0.5) / 4.0, 0.5)).rgb;
  vec2 f = fract(vUv * uRes / ps);
  col *= 1.0 - u_grid * 0.35 * (step(0.88, f.x) + step(0.88, f.y));
  fragColor = vec4(col, 1.0);
}`),
  },
  {
    id: "lcd-phone",
    name: "Brick phone LCD",
    category: "Retro",
    description: "84-pixel monochrome phone display with backlight glow, visible pixel grid and ghosting.",
    keywords: "mobile phone lcd monochrome 2000 green backlight nokia",
    preview: "portraits:20",
    params: [
      hero("width", "Pixels across", 48, 200, 84, 1),
      hero("threshold", "Threshold", 0, 1, 0.5),
      select("method", "Method", ["Dither", "Threshold"]),
      color("backlight", "Backlight", "#C7F0D8"),
      color("pixelColor", "Pixel", "#43523D"),
      range("ghost", "Ghosting", 0, 1, 0.3),
      range("gap", "Pixel gap", 0, 0.4, 0.12),
    ],
    passes: single(`
void main() {
  float ps = uRes.x / u_width;
  vec2 cell = floor(vUv * uRes / ps);
  vec3 c = texture(uTex0, (cell + 0.5) * ps / uRes).rgb;
  float l = luma(c);
  float on = u_method < 0.5 ? step(bayer4(cell) * 0.9 + 0.05, 1.0 - l + (0.5 - u_threshold)) : step(u_threshold, 1.0 - l);
  vec2 f = fract(vUv * uRes / ps);
  float pix = smoothstep(u_gap * 0.5, u_gap * 0.5 + 0.05, f.x) * smoothstep(u_gap * 0.5, u_gap * 0.5 + 0.05, f.y);
  vec3 bl = u_backlight * (0.92 + 0.08 * (1.0 - length(vUv - 0.5)));
  vec3 col = mix(bl, u_pixelColor, on * pix);
  col = mix(col, u_pixelColor, u_ghost * 0.25 * (1.0 - on) * step(0.5, 1.0 - l) * pix);
  col += (hash12(cell) - 0.5) * 0.02;
  fragColor = vec4(col, 1.0);
}`),
  },
  {
    id: "console-32",
    name: "PS1",
    category: "Retro",
    description: "Late-90s polygon console output: 240-line framebuffer, 15-bit colour with the console's 4×4 dither and texture wobble.",
    keywords: "psx playstation low poly 15 bit dither jitter 32-bit",
    preview: "editorial:6",
    params: [
      hero("height", "Vertical lines", 120, 480, 240, 1),
      hero("wobble", "Affine wobble", 0, 1, 0.4),
      range("depth", "Colour depth (bits)", 3, 8, 5, 1),
      range("dither", "Dither", 0, 1, 0.8),
      range("blur", "Video blur", 0, 1, 0.35),
    ],
    passes: single(`
void main() {
  float ps = uRes.y / u_height;
  vec2 cell = floor(vUv * uRes / ps);
  vec2 block = floor(cell / 16.0);
  vec2 jit = (hash22(block + uSeed) - 0.5) * u_wobble * 1.6;
  vec2 uv = (cell + 0.5 + jit) * ps / uRes;
  vec3 c = mix(texture(uTex0, uv).rgb, blur13(uTex0, uv, vec2(ps * 1.5) / uRes).rgb, u_blur * 0.6);
  float levels = exp2(u_depth) - 1.0;
  c += (bayer4(cell) - 0.5) * u_dither / levels;
  c = floor(sat(c) * levels + 0.5) / levels;
  fragColor = vec4(c, 1.0);
}`),
  },
  {
    id: "matrix-rain",
    name: "Code rain",
    category: "Retro",
    description: "Falling glyph columns, bright at the head, whose brightness follows the image.",
    keywords: "digital rain glyphs falling code terminal",
    preview: "portraits:15",
    animated: true,
    params: [
      hero("cell", "Glyph size", 6, 40, 14, 0.5, { unit: "px" }),
      hero("speed", "Speed", 0, 3, 1),
      range("density", "Density", 0, 1, 0.65),
      range("image", "Image influence", 0, 1, 0.8),
      color("tint", "Colour", "#4CFF7A"),
      range("trail", "Trail length", 2, 40, 14, 1),
    ],
    aux: () => [glyphAtlas("0123456789ABCDEF:.=*+<>#")],
    passes: single(`
void main() {
  float h = u_cell * refScale();
  vec2 csz = vec2(h * 0.62, h);
  vec2 cell = floor(vUv * uRes / csz);
  vec2 local = fract(vUv * uRes / csz);
  float rows = uRes.y / csz.y;
  float colSeed = hash11(cell.x * 1.37 + uSeed);
  float speed = (0.4 + colSeed) * u_speed * 8.0;
  float head = mod(uTime * speed + colSeed * 97.0, rows + u_trail * 2.0);
  float rowFromTop = rows - cell.y;
  float d = head - rowFromTop;
  float trail = d >= 0.0 && d < u_trail ? 1.0 - d / u_trail : 0.0;
  trail *= step(1.0 - u_density, hash11(cell.x * 7.1 + floor((uTime * speed + colSeed * 97.0) / (rows + u_trail * 2.0))));
  vec3 src = texture(uTex0, (cell + 0.5) * csz / uRes).rgb;
  float l = mix(1.0, luma(src) * 1.4, u_image);
  float gi = floor(hash12(cell + floor(uTime * 6.0 * (0.3 + colSeed))) * 23.99);
  float glyph = texture(uAux0, vec2((gi + 0.2 + local.x * 0.6) / 24.0, local.y)).r;
  vec3 col = u_tint * glyph * trail * l;
  col += vec3(0.85, 1.0, 0.9) * glyph * step(d, 0.99) * step(0.0, d) * l;
  col += u_tint * glyph * luma(src) * 0.35 * u_image;
  col += u_tint * luma(src) * 0.06 * u_image;
  fragColor = vec4(sat(col), 1.0);
}`),
  },
];
