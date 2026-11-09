import { gradientLut, paletteTex } from "../../lib/textures";
import { color, gradient, hero, range, select, single, toggle, type EffectDef } from "../types";

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
export const PALETTE_NAMES = PALETTES.map((p) => p.name);

export const color_: EffectDef[] = [
  {
    id: "gradient-map",
    name: "Gradient map",
    category: "Color",
    description: "Maps luminance onto an editable multi-stop gradient.",
    keywords: "gradient map colorize false color",
    preview: "face:1",
    params: [
      gradient("ramp", "Gradient", "#0A0A0A@0,#3A0CA3@0.3,#D3202A@0.62,#FFD166@0.85,#F7F2EC@1"),
      hero("contrast", "Contrast", 0.2, 3, 1.1),
      hero("offset", "Offset", -0.5, 0.5, 0),
      range("mix", "Mix", 0, 1, 1),
      toggle("reverse", "Reverse"),
    ],
    aux: (v) => [gradientLut(String(v.ramp))],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = sat((luma(c.rgb) - 0.5) * u_contrast + 0.5 + u_offset);
  if (u_reverse > 0.5) l = 1.0 - l;
  fragColor = vec4(mix(c.rgb, lut1(uAux0, l, 0.0, 1.0), u_mix), c.a);
}`),
  },
  {
    id: "duotone",
    name: "Duotone",
    category: "Color",
    description: "Two-ink print look: shadows and highlights colours with a tone curve.",
    keywords: "two tone spot color",
    preview: "room:1",
    params: [color("dark", "Shadows", "#1E1B4B"), color("light", "Highlights", "#FF8A3D"), hero("contrast", "Contrast", 0.2, 3, 1.25), hero("balance", "Balance", -0.5, 0.5, 0), range("mix", "Mix", 0, 1, 1)],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  float l = sat((luma(c.rgb) - 0.5) * u_contrast + 0.5 + u_balance);
  l = l * l * (3.0 - 2.0 * l);
  fragColor = vec4(mix(c.rgb, mix(u_dark, u_light, l), u_mix), c.a);
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
    description: "Black and white with a channel filter (like a coloured lens filter), contrast and tint.",
    keywords: "black white grayscale greyscale filter",
    preview: "hands:0",
    params: [
      select("filter", "Lens filter", ["Neutral", "Red", "Orange", "Yellow", "Green", "Blue"]),
      hero("contrast", "Contrast", 0.5, 2.5, 1.2),
      hero("brightness", "Brightness", -0.3, 0.3, 0),
      color("tint", "Tint", "#F2E8DA"),
      range("tintAmount", "Tint amount", 0, 1, 0.35),
    ],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  int f = int(u_filter + 0.5);
  vec3 w = vec3(0.2126, 0.7152, 0.0722);
  if (f == 1) w = vec3(0.8, 0.2, 0.0);
  if (f == 2) w = vec3(0.6, 0.35, 0.05);
  if (f == 3) w = vec3(0.45, 0.5, 0.05);
  if (f == 4) w = vec3(0.15, 0.75, 0.1);
  if (f == 5) w = vec3(0.1, 0.25, 0.65);
  float l = dot(c.rgb, w) + u_brightness;
  l = sat((l - 0.5) * u_contrast + 0.5);
  vec3 o = mix(vec3(l), vec3(l) * u_tint * 1.08, u_tintAmount);
  fragColor = vec4(sat(o), c.a);
}`),
  },
  {
    id: "thermal",
    name: "Thermal",
    category: "Color",
    description: "Heat-camera false colour with a softened, blooming sensor.",
    keywords: "heat infrared flir false color",
    preview: "dancer:0",
    params: [
      select("palette", "Palette", ["Ironbow", "Rainbow", "White hot", "Arctic", "Lava"]),
      hero("contrast", "Contrast", 0.5, 3, 1.4),
      hero("offset", "Offset", -0.5, 0.5, 0.05),
      range("blur", "Sensor blur", 0, 12, 3, 0.1),
      range("noise", "Sensor noise", 0, 0.2, 0.04),
    ],
    animated: true,
    aux: () => [gradientLut(
      "#000010@0,#2A0A6B@0.2,#9C1E8C@0.4,#E8452C@0.62,#FFB000@0.82,#FFFDE0@1",
      "#000080@0,#0050FF@0.2,#00E0C0@0.4,#40FF20@0.55,#FFE000@0.72,#FF3000@0.88,#FFFFFF@1",
      "#000000@0,#FFFFFF@1",
      "#04060F@0,#0E2D5C@0.3,#1F8FBF@0.6,#C8F3FF@0.85,#FFFFFF@1",
      "#000000@0,#3B0000@0.25,#B01200@0.5,#FF7A00@0.75,#FFF7A0@1",
    )],
    passes: single(`
void main() {
  vec4 c = blur13(uTex0, vUv, refPx(u_blur));
  float l = luma(c.rgb) + snoise(refCoord(vUv) * 0.6 + uTime * 20.0) * u_noise;
  l = sat((l - 0.5) * u_contrast + 0.5 + u_offset);
  fragColor = vec4(lut1(uAux0, l, u_palette, 5.0), c.a);
}`),
  },
  {
    id: "threshold",
    name: "Threshold",
    category: "Color",
    description: "Hard two-colour cut with optional noise for a photocopied edge.",
    keywords: "black white binary stencil",
    preview: "bw:0",
    params: [hero("level", "Level", 0, 1, 0.5), hero("softness", "Softness", 0, 0.3, 0.02), range("noise", "Grit", 0, 0.5, 0.08), color("ink", "Ink", "#0A0A0A"), color("paper", "Paper", "#F7F2EC")],
    passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  vec2 px = refCoord(vUv);
  float n = (snoise(px * 0.35 + seedOffset()) * 0.6 + (hash12(floor(px * 1.5)) - 0.5) * 0.8) * u_noise;
  float l = luma(c.rgb) + n;
  float t = smoothstep(u_level - u_softness - 0.001, u_level + u_softness + 0.001, l);
  fragColor = vec4(mix(u_ink, u_paper, t), c.a);
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
