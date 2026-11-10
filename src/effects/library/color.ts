import { gradientLut, paletteTex } from "../../lib/textures";
import { color, gradient, group, hero, range, select, single, toggle, type EffectDef } from "../types";

/** Palettes shared by Palette map and the retro/dither effects. */
export const PALETTES: { name: string; colors: string[] }[] = [
  { name: "1-bit bone", colors: ["#0A0A0A", "#F7F2EC"] },
  { name: "Pocket LCD", colors: ["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"] },
  { name: "Phosphor red", colors: ["#0A0A0A", "#5C1612", "#B5241B", "#FF3B2F"] },
  { name: "Analog paper", colors: ["#1E1B17", "#5E574C", "#9C9385", "#E9E1D3"] },
  { name: "CGA 1", colors: ["#000000", "#55FFFF", "#FF55FF", "#FFFFFF"] },
  { name: "CGA 2", colors: ["#000000", "#55FF55", "#FF5555", "#FFFF55"] },
  { name: "8-bit micro", colors: ["#000000", "#FFFFFF", "#20C020", "#C020C0", "#2070F0", "#F07020"] },
  { name: "Fantasy 16", colors: ["#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8", "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA"] },
  { name: "Riso duo", colors: ["#F2EDE4", "#FF48B0", "#0078BF", "#1A1A1A"] },
  { name: "Vaporwave", colors: ["#1A0B2E", "#7A1FA2", "#FF71CE", "#01CDFE", "#05FFA1", "#FFFB96"] },
  { name: "Sepia 4", colors: ["#2B1D14", "#6B4F36", "#B39472", "#F0E2C8"] },
  { name: "Thermal", colors: ["#05001A", "#3A0CA3", "#B5179E", "#F72585", "#FF9E00", "#FFF3B0"] },
  { name: "Brick phone", colors: ["#43523D", "#C7F0D8"] },
  { name: "Grey 8", colors: ["#000000", "#242424", "#494949", "#6D6D6D", "#929292", "#B6B6B6", "#DBDBDB", "#FFFFFF"] },
  { name: "Home micro 16", colors: ["#000000", "#FFFFFF", "#880000", "#AAFFEE", "#CC44CC", "#00CC55", "#0000AA", "#EEEE77", "#DD8855", "#664400", "#FF7777", "#333333", "#777777", "#AAFF66", "#0088FF", "#BBBBBB"] },
  { name: "Teletext", colors: ["#000000", "#FF0000", "#00FF00", "#FFFF00", "#0000FF", "#FF00FF", "#00FFFF", "#FFFFFF"] },
  { name: "Cyanotype", colors: ["#0B1E4A", "#1F4E8C", "#5B8FC7", "#BFD6EA", "#F2EFE6"] },
  { name: "Mint print", colors: ["#123D33", "#2E7A66", "#A0D5C2", "#F2F5EE"] },
  { name: "Hot pink", colors: ["#16001E", "#7A0B5E", "#D016C0", "#FF7AD9", "#FFE3F6"] },
  { name: "Ocean blue", colors: ["#03111F", "#0B3A66", "#29A1FF", "#B8E4FF", "#F4FBFF"] },
  { name: "Faded copy", colors: ["#1F4D4A", "#3E8A7E", "#C9D46B", "#F3F0D8"] },
];
/** Ten thermal palettes, one LUT row each (order matches the Thermal "Gradient type" list), measured as brightness → colour. */
const THERMAL_RAMPS = [
  "#020127@0.031,#050246@0.094,#0D016F@0.156,#310178@0.219,#5B017B@0.281,#8B016E@0.344,#B40247@0.406,#E1041C@0.469,#F81D07@0.531,#FA4D08@0.594,#FB7E08@0.656,#FCAC07@0.719,#FDD80A@0.781,#FDF926@0.844,#FEFD73@0.906,#FDFEBB@0.969",
  "#1B0101@0.031,#320202@0.094,#530102@0.156,#710101@0.219,#8F0101@0.281,#B00101@0.344,#CC0201@0.406,#EB0302@0.469,#FA1304@0.531,#FB3205@0.594,#FC5205@0.656,#FD7008@0.719,#FD8F25@0.781,#FDB063@0.844,#FDCF9E@0.906,#FDE9D1@0.969",
  "#FA2802@0.031,#F54D06@0.094,#F78006@0.156,#F9AE06@0.219,#FBDA05@0.281,#DEFA05@0.344,#91FB07@0.406,#36FA08@0.469,#09FA37@0.531,#09F993@0.594,#0AEDE6@0.656,#09A4F3@0.719,#064BF1@0.781,#100AE3@0.844,#3804C3@0.906,#5D02A1@0.969",
  "#011392@0.031,#0225A1@0.094,#023FB9@0.156,#0156D1@0.219,#026DE9@0.281,#0186F3@0.344,#029BDF@0.406,#02B4C9@0.469,#04CDB2@0.531,#05E39B@0.594,#0DF784@0.656,#2FFD6C@0.719,#5AFD57@0.781,#8AFD3F@0.844,#B6FE2A@0.906,#DCFE14@0.969",
  "#280102@0.031,#490202@0.094,#7B0202@0.156,#A90201@0.219,#D50301@0.281,#F71202@0.344,#F93A03@0.406,#FB6B05@0.469,#FC9C06@0.531,#FDCA08@0.594,#FEF410@0.656,#FEFD31@0.719,#FEFD5C@0.781,#FEFD8A@0.844,#FEFEB6@0.906,#FDFEDC@0.969",
  "#100115@0.031,#1F0125@0.094,#32013F@0.156,#450155@0.219,#5D015F@0.281,#7D015B@0.344,#9A0255@0.406,#B9034E@0.469,#D01343@0.531,#DD3232@0.594,#EB5220@0.656,#F77010@0.719,#FC8F17@0.781,#FDB035@0.844,#FDCF53@0.906,#FDE869@0.969",
  "#3C0B5C@0.031,#351562@0.094,#2C216E@0.156,#242E78@0.219,#1D3D7D@0.281,#15507E@0.344,#0E617E@0.406,#07747E@0.469,#0E8579@0.531,#20926D@0.594,#339F61@0.656,#45AB54@0.719,#61B846@0.781,#87C634@0.844,#ABD223@0.906,#C9DD10@0.969",
  "#010D01@0.031,#021902@0.094,#022A01@0.156,#013C01@0.219,#015201@0.281,#026A01@0.344,#057F05@0.406,#139812@0.469,#24B123@0.531,#37C734@0.594,#53DA44@0.656,#71EA54@0.719,#8FF966@0.781,#B0FE85@0.844,#CFFEA9@0.906,#E8FEC8@0.969",
  "#4A024C@0.031,#830685@0.094,#B60DC7@0.156,#5F09B3@0.219,#172FA8@0.281,#0FA3C3@0.344,#0EB29F@0.406,#0C7A46@0.469,#336F11@0.531,#95AA15@0.594,#CDB416@0.656,#A3500F@0.719,#93160F@0.781,#BD2D2C@0.844,#DF6868@0.906,#EEAFAE@0.969",
  "#0C0C0C@0.031,#171717@0.094,#282828@0.156,#383838@0.219,#474747@0.281,#585858@0.344,#676767@0.406,#777777@0.469,#888888@0.531,#989898@0.594,#A8A8A8@0.656,#B8B8B8@0.719,#C7C7C7@0.781,#D8D8D8@0.844,#E7E7E7@0.906,#F4F4F4@0.969",
];
export const PALETTE_NAMES = PALETTES.map((p) => p.name);

export const color_: EffectDef[] = [
  {
    id: "gradient-map",
    name: "Gradient map",
    category: "Color",
    description: "Maps luminance onto a gradient.",
    keywords: "gradient map colorize false color",
    params: [
      gradient("ramp", "Gradient map", "#FF0000@0,#00FF00@0.5,#0000FF@1"),
      hero("shift", "Gradient shift", -1, 1, 0),
      hero("repeat", "Gradient repeat", 1, 8, 1, 1),
    ],
    aux: (v) => [gradientLut(String(v.ramp))],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = luma(c.rgb) * u_repeat + u_shift;
  // Repeats mirror so bands meet without hard seams.
  l = u_repeat > 1.0 ? 1.0 - abs(1.0 - mod(l, 2.0)) : sat(l);
  fragColor = vec4(lut1(uAux0, l, 0.0, 1.0), c.a);
}`),
  },
  {
    id: "duotone",
    name: "Duotone",
    category: "Color",
    description: "Two-colour mapping with a gamma per channel.",
    keywords: "two color tone print",
    params: [
      color("start", "Start color", "#E63217"),
      color("end", "End color", "#F4B642"),
      ...group("Gamma", [range("rG", "Red gamma", 0.3, 3, 1), range("gG", "Green gamma", 0.3, 3, 1), range("bG", "Blue gamma", 0.3, 3, 1)]),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = luma(c.rgb);
  vec3 t = pow(vec3(l), vec3(u_rG, u_gG, u_bG));
  fragColor = vec4(mix(u_start, u_end, t), c.a);
}`),
  },
  {
    id: "tritone",
    name: "Tritone",
    category: "Color",
    description: "Shadows, midtones and highlights each mapped to their own ink.",
    keywords: "three tone",
    preview: "fashion:0",
    params: [color("dark", "Shadows", "#0A0A0A"), color("mid", "Midtones", "#D3202A"), color("light", "Highlights", "#F7F2EC"), hero("midpoint", "Midpoint", 0.2, 0.8, 0.5), hero("contrast", "Contrast", 0.2, 3, 1.2)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = sat((luma(c.rgb) - 0.5) * u_contrast + 0.5);
  vec3 o = l < u_midpoint ? mix(u_dark, u_mid, smoothstep(0.0, u_midpoint, l)) : mix(u_mid, u_light, smoothstep(u_midpoint, 1.0, l));
  fragColor = vec4(o, c.a);
}`),
  },
  {
    id: "monochrome",
    name: "Monochrome",
    category: "Color",
    description: "Black and white from a weighted channel mix, optionally tinted.",
    keywords: "black white grayscale channel mixer",
    params: [
      hero("rW", "Red weight", -1, 2, 0.683, 0.001),
      hero("gW", "Green weight", -1, 2, 1.155, 0.001),
      hero("bW", "Blue weight", -1, 2, 0.199, 0.001),
      toggle("normalize", "Normalize weights", 1),
      color("tint", "Tint color", "#FFFFFF"),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 w = vec3(u_rW, u_gW, u_bW);
  if (u_normalize > 0.5) w /= max(abs(w.r + w.g + w.b), 1e-3);
  // Negative mixes give a negative image; its magnitude keeps it visible instead of clipping to black.
  float l = abs(dot(c.rgb, w));
  fragColor = vec4(sat(vec3(l) * u_tint), c.a);
}`),
  },
  {
    id: "thermal",
    name: "Thermal",
    category: "Color",
    description: "Heat-camera false colour with tone controls and edge glow.",
    keywords: "heat infrared ironbow flir",
    params: [
      toggle("invert", "Invert", 1),
      ...group("Tones", [range("shadows", "Shadows", -0.5, 0.5, -0.5), range("midtones", "Midtones", -0.5, 0.5, -0.22), range("highlights", "Highlights", -0.5, 0.5, -0.05)]),
      select("type", "Gradient type", ["Plasma", "Iron", "Rainbow", "Arctic", "Hot", "Magma", "Viridis", "Night vision", "Banded", "White hot"], 3),
      hero("shift", "Gradient shift", 0, 1, 0),
      hero("repeat", "Gradient repeat", 0.1, 10, 0.7, 0.1),
      toggle("edges", "Show edges", 1),
      range("edgeRange", "Edge range", 0.15, 2, 0.5),
    ],
    aux: () => [gradientLut(...THERMAL_RAMPS)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = luma(blur13(uTex0, vUv, refPx(2.0)).rgb);
  if (u_invert > 0.5) l = 1.0 - l;
  // Three-band tone shaping before the palette.
  l += u_shadows * (1.0 - smoothstep(0.0, 0.5, l)) * 0.6 + u_midtones * (1.0 - abs(l - 0.5) * 2.0) * 0.6 + u_highlights * smoothstep(0.5, 1.0, l) * 0.6;
  float x = sat(l) * u_repeat + u_shift;
  x = u_repeat > 1.0 ? 1.0 - abs(1.0 - mod(x, 2.0)) : fract(min(x, 0.9999));
  vec3 o = lut1(uAux0, x, u_type, 10.0);
  if (u_edges > 0.5) {
    float e = sobel(uTex0, vUv, refPx(u_edgeRange * 2.0)).x;
    o += smoothstep(0.1, 0.6, e) * 0.5;
  }
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "threshold",
    name: "Threshold",
    category: "Color",
    description: "Hard black and white, with edge mode, offset copies and outlines.",
    keywords: "black white 1-bit cut",
    params: [
      hero("threshold", "Threshold", 0, 255, 128, 1),
      toggle("edgeMode", "Edge mode"),
      ...group("Offset", [range("offset", "Offset amount", 0, 10, 0, 1), range("distance", "Distance", 1, 50, 1, 1)]),
      ...group("Outline", [range("outline", "Outline", 0, 10, 0, 1), range("outlineStrength", "Outline strength", 0, 1, 1), select("outlineType", "Outline type", ["Inner", "Outer", "Both"])]),
      ...group("Blend", [range("blendStrength", "Blend strength", 0, 1, 1), select("blendMode", "Blend mode", ["Normal", "Multiply", "Screen", "Overlay", "Soft light", "Darken", "Lighten"], 5), color("color", "Color", "#000000")]),
    ],
    passes: single(`
float bw(vec2 uv) {
  float l = luma(texture(uTex0, uv).rgb);
  if (u_edgeMode > 0.5) l = 1.0 - sat(sobel(uTex0, uv, refPx(1.0 + u_distance * 0.2)).x * 2.0);
  return step(u_threshold / 255.0, l);
}
void main() {
  vec4 c = texture(uTex0, vUv);
  float b = bw(vUv);
  // Offset: extra copies stepped diagonally, combined as ink (darkest wins).
  for (int i = 1; i <= 10; i++) { if (float(i) > u_offset) break; b = min(b, bw(vUv - refPx(u_distance * float(i)))); }
  if (u_outline > 0.5) {
    float r = u_outline;
    float mn = 1.0; float mx = 0.0;
    for (int k = 0; k < 8; k++) { float a = float(k) * TAU / 8.0; float s = bw(vUv + vec2(cos(a), sin(a)) * refPx(r)); mn = min(mn, s); mx = max(mx, s); }
    int t = int(u_outlineType + 0.5);
    float edge = t == 0 ? b * (1.0 - mn) : t == 1 ? (1.0 - b) * mx : step(0.5, mx - mn);
    if (edge > 0.5) b = mix(b, 0.0, u_outlineStrength);
  }
  vec3 ink = u_color;
  vec3 paper = vec3(1.0);
  vec3 t = mix(ink, paper, b);
  int m = int(u_blendMode + 0.5);
  vec3 o = m == 1 ? c.rgb * t : m == 2 ? blendScreen(c.rgb, t) : m == 3 ? blendOverlay(c.rgb, t) : m == 4 ? blendSoftLight(c.rgb, t) : m == 5 ? min(c.rgb, t) : m == 6 ? max(c.rgb, t) : t;
  fragColor = vec4(mix(c.rgb, o, u_blendStrength), c.a);
}`),
  },
  {
    id: "posterize",
    name: "Posterize",
    category: "Color",
    description: "Reduce to a few tonal bands per channel, in RGB or perceptual lightness.",
    keywords: "bands levels quantize",
    preview: "palms:0",
    params: [hero("levels", "Levels", 2, 16, 5, 1), select("mode", "Mode", ["RGB", "Lightness only", "Hue bands"]), range("smooth", "Smoothing", 0, 1, 0.1), range("dither", "Dither", 0, 1, 0)],
    passes: single(`
vec3 q(vec3 x, float n, float s) { vec3 f = x * (n - 1.0); vec3 b = floor(f); vec3 t = fract(f); t = smoothstep(0.5 - s * 0.5, 0.5 + s * 0.5, t); return (b + t) / (n - 1.0); }
void main() {
  vec4 c = texture(uTex0, vUv);
  float d = (bayer8(vUv * uRes) - 0.5) * u_dither / u_levels;
  int m = int(u_mode + 0.5);
  vec3 o;
  if (m == 0) o = q(c.rgb + d, u_levels, u_smooth);
  else if (m == 1) { vec3 lab = rgb2oklab(c.rgb); lab.x = q(vec3(lab.x + d), u_levels, u_smooth).x; o = oklab2rgb(lab); }
  else { vec3 h = rgb2hsv(c.rgb); h.x = q(vec3(h.x + d), u_levels + 1.0, u_smooth).x; h.z = q(vec3(h.z), 4.0, u_smooth).x; o = hsv2rgb(h); }
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "solarize",
    name: "Solarize",
    category: "Color",
    description: "Sabattier effect: tones above the threshold are inverted, with a darkroom edge line.",
    keywords: "invert sabattier darkroom",
    preview: "fire:2",
    params: [hero("threshold", "Threshold", 0, 1, 0.55), hero("strength", "Strength", 0, 1, 1), range("edge", "Mackie line", 0, 1, 0.3), toggle("mono", "Monochrome")],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 x = u_mono > 0.5 ? vec3(luma(c.rgb)) : c.rgb;
  vec3 s = mix(x, 1.0 - x, smoothstep(u_threshold - 0.04, u_threshold + 0.04, x));
  float e = sobel(uTex0, vUv, 1.5 / uTexRes0).x;
  vec3 o = mix(x, s, u_strength) - e * u_edge;
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "color-pop",
    name: "Color pop",
    category: "Color",
    description: "Keeps one hue in colour and turns the rest black and white.",
    keywords: "selective color isolate hue",
    preview: "lips:0",
    params: [hero("hue", "Hue", 0, 360, 355, 1, { unit: "°" }), hero("width", "Range", 5, 120, 30, 1, { unit: "°" }), range("softness", "Softness", 0, 1, 0.4), range("boost", "Boost", 0, 1, 0.3)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec3 h = rgb2hsv(c.rgb);
  float d = abs(fract(h.x - u_hue / 360.0 + 0.5) - 0.5) * 360.0;
  float k = 1.0 - smoothstep(u_width * 0.5 * (1.0 - u_softness), u_width * 0.5 + 1.0, d);
  k *= smoothstep(0.08, 0.25, h.y);
  vec3 col = saturation(c.rgb, 1.0 + u_boost);
  fragColor = vec4(mix(vec3(luma(c.rgb)), col, k), c.a);
}`),
  },
  {
    id: "palette-map",
    name: "Palette map",
    category: "Color",
    description: "Snap every pixel to the nearest colour of a fixed palette (perceptual distance).",
    keywords: "palette quantize retro limited colors",
    preview: "car:0",
    params: [
      select("palette", "Palette", PALETTE_NAMES, 7),
      hero("dither", "Dither", 0, 1, 0.5),
      select("pattern", "Pattern", ["Bayer 4", "Bayer 8", "Noise"], 1),
      range("pixel", "Pixel size", 1, 16, 1, 1, { unit: "px" }),
    ],
    aux: (v) => [paletteTex(PALETTES[Number(v.palette) | 0]?.colors ?? PALETTES[0].colors)],
    passes: single(`
void main() {
  float ps = max(1.0, u_pixel * refScale());
  vec2 cell = floor(vUv * uRes / ps);
  vec2 uv = (cell + 0.5) * ps / uRes;
  vec3 c = texture(uTex0, uv).rgb;
  int p = int(u_pattern + 0.5);
  float t = p == 0 ? bayer4(cell) : p == 1 ? bayer8(cell) : ign(cell + seedOffset());
  c += (t - 0.5) * u_dither * 0.35;
  vec3 lab = rgb2oklab(sat(c));
  float n = uAuxRes0.x;
  float best = 1e9;
  vec3 pick = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (float(i) >= n) break;
    vec3 pc = texture(uAux0, vec2((float(i) + 0.5) / n, 0.5)).rgb;
    vec3 d = rgb2oklab(pc) - lab;
    float dist = dot(d, d * vec3(1.0, 0.8, 0.8));
    if (dist < best) { best = dist; pick = pc; }
  }
  fragColor = vec4(pick, 1.0);
}`),
  },
];
