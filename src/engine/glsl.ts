import { isUniformParam, type ParamDef } from "../effects/types";

export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/**
 * Shared prelude for every fragment pass.
 * Conventions: uTex0..3 are pass inputs, uAux0..3 auxiliary textures (LUTs, glyphs, text),
 * uRes is this pass's output size in pixels, uTexRes0..3 input sizes.
 * "Reference pixels" are pixels at 1080p, so effects look the same in the preview and a 4K export.
 * uMouse is the cursor in output uv (y up); it persists after the cursor leaves so exports keep it.
 */
export const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform sampler2D uAux0;
uniform sampler2D uAux1;
uniform sampler2D uAux2;
uniform sampler2D uAux3;
uniform vec2 uTexRes0;
uniform vec2 uTexRes1;
uniform vec2 uTexRes2;
uniform vec2 uTexRes3;
uniform vec2 uAuxRes0;
uniform vec2 uAuxRes1;
uniform vec2 uRes;
uniform float uTime;
uniform float uSeed;
uniform float uFrame;
uniform float uIter;
uniform float uIterCount;
/** 1 when a feedback pass has last frame's output in "prev"; 0 on its first frame. */
uniform float uHasPrev;
uniform vec2 uMouse;
uniform vec2 uMouseVel;
uniform float uMouseDown;
/** Height (px) that counts as 1080p for reference-pixel sizes; thumbnails lower it so details stay legible. */
uniform float uRefH;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat(vec3 x) { return clamp(x, 0.0, 1.0); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float refScale() { return uRes.y / uRefH; }
vec2 refPx(float p) { return vec2(p * refScale()) / uRes; }
float aspect() { return uRes.x / uRes.y; }
/** Pixel coordinate at 1080p reference scale, so cell sizes survive export. */
vec2 refCoord(vec2 uv) { return uv * uRes / refScale(); }
vec2 seedOffset() { return vec2(uSeed * 17.31, uSeed * 9.73); }

vec3 srgb2lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 lin2srgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

// OKLab (Björn Ottosson, public domain) for perceptual colour work.
vec3 rgb2oklab(vec3 c) {
  c = srgb2lin(c);
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619,
                  0.5363325363, 0.6806995451, 0.2817188376,
                  0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371,
              0.7936177850, -2.4285922050, 0.7827717662,
              -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}
vec3 oklab2rgb(vec3 c) {
  vec3 lms = mat3(1.0, 1.0, 1.0,
                  0.3963377774, -0.1055613458, -0.0894841775,
                  0.2158037573, -0.0638541728, -1.2914855480) * c;
  lms = lms * lms * lms;
  vec3 rgb = mat3(4.0767416621, -1.2684380046, -0.0041960863,
                  -3.3077115913, 2.6097574011, -0.7034186147,
                  0.2309699292, -0.3413193965, 1.7076147010) * lms;
  return lin2srgb(rgb);
}

// Hash functions: "Hash without Sine" by Dave Hoskins (MIT).
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
/** Interleaved gradient noise (Jimenez): cheap, blue-ish dither noise. */
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT). Range about -1..1.
vec3 _perm(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = _perm(_perm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
float sfbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * snoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 11.3; a *= 0.5; }
  return v;
}
/** Worley / cellular noise: x = distance to nearest point, y = id hash. */
vec2 worley(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  float id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; id = hash12(n + g + 3.7); }
  }
  return vec2(sqrt(md), id);
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 saturation(vec3 c, float s) { return mix(vec3(luma(c)), c, s); }
vec3 rgb2yiq(vec3 c) { return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c; }
vec3 yiq2rgb(vec3 c) { return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * c; }
mat2 rot(float a) { float s = sin(a); float c = cos(a); return mat2(c, -s, s, c); }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float bayer16(vec2 a) { return bayer8(0.5 * a) * 0.25 + bayer2(a); }
vec3 blendScreen(vec3 b, vec3 s) { return 1.0 - (1.0 - b) * (1.0 - s); }
vec3 blendOverlay(vec3 b, vec3 s) { return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
vec3 blendSoftLight(vec3 b, vec3 s) {
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (sqrt(b) - b), step(0.5, s));
}
/** Anti-aliased step: 1 inside (d < 0), width in the same units as d. */
float aastep(float edge, float x) { float w = max(fwidth(x), 1e-5) * 0.7; return smoothstep(edge - w, edge + w, x); }
/** Luminance-dependent film grain, roughly 0-mean. */
float grainAt(vec2 px, float size, float t) {
  vec2 p = px / max(size, 0.5);
  float g = snoise(p + t * 37.0) * 0.6 + snoise(p * 2.1 - t * 19.0) * 0.4;
  return g;
}
/** Paper fibre texture, 0..1 around 0.5. */
float paperTex(vec2 px) {
  float f = fbm(px * 0.008) * 0.5 + fbm(px * vec2(0.09, 0.02)) * 0.3 + hash12(floor(px)) * 0.2;
  return f;
}
vec3 sobel(sampler2D t, vec2 uv, vec2 texel) {
  float tl = luma(texture(t, uv + texel * vec2(-1, 1)).rgb);
  float l = luma(texture(t, uv + texel * vec2(-1, 0)).rgb);
  float bl = luma(texture(t, uv + texel * vec2(-1, -1)).rgb);
  float tp = luma(texture(t, uv + texel * vec2(0, 1)).rgb);
  float bt = luma(texture(t, uv + texel * vec2(0, -1)).rgb);
  float tr = luma(texture(t, uv + texel * vec2(1, 1)).rgb);
  float r = luma(texture(t, uv + texel * vec2(1, 0)).rgb);
  float br = luma(texture(t, uv + texel * vec2(1, -1)).rgb);
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -bl - 2.0 * bt - br + tl + 2.0 * tp + tr;
  return vec3(length(vec2(gx, gy)), gx, gy);
}
/** 13-tap blur around uv with radius in uv units (cheap, single pass). */
vec4 blur13(sampler2D t, vec2 uv, vec2 r) {
  vec4 acc = texture(t, uv) * 0.2;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996;
    float d = sqrt((float(i) + 0.5) / 12.0);
    acc += texture(t, uv + vec2(cos(a), sin(a)) * d * r) * (0.8 / 12.0);
  }
  return acc;
}
vec2 mirrorUv(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }
/** Sample a 256×N LUT row (row 0 = top). */
vec3 lut1(sampler2D lut, float x, float row, float rows) {
  return texture(lut, vec2(clamp(x, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 1.0 - (row + 0.5) / rows)).rgb;
}
`;

/** Separable gaussian blur pass. uDir = (1,0) or (0,1); uRadius is a fraction of input height. */
export const BLUR_FRAG = `
uniform vec2 uDir;
uniform float uRadius;
void main() {
  float rpx = max(uRadius * uTexRes0.y * (1080.0 / uRefH), 0.0001);
  vec2 texel = uDir / uTexRes0;
  float sigma = rpx / 2.5;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -16; i <= 16; i++) {
    float x = float(i) / 16.0 * rpx;
    float w = exp(-0.5 * x * x / (sigma * sigma));
    acc += texture(uTex0, vUv + texel * x) * w;
    wsum += w;
  }
  fragColor = acc / wsum;
}`;

export function paramDeclarations(params: ParamDef[]): string {
  return params
    .filter(isUniformParam)
    .map((p) => (p.type === "color" ? `uniform vec3 u_${p.key};` : `uniform float u_${p.key};`))
    .join("\n");
}

export const SOURCE_FRAG = `
uniform vec4 uCrop;
uniform vec4 uXform; // offset.xy, scale, rotation (radians)
uniform float uFlip;
void main() {
  vec2 p = vUv - 0.5;
  p.x *= uRes.x / uRes.y;
  p = rot(-uXform.w) * p / uXform.z - uXform.xy;
  p.x /= uRes.x / uRes.y;
  p += 0.5;
  if (uFlip > 0.5) p.x = 1.0 - p.x;
  vec2 uv = mix(uCrop.xy, uCrop.zw, p);
  vec4 c = texture(uTex0, uv);
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) c = vec4(0.0, 0.0, 0.0, 1.0);
  fragColor = c;
}`;

export const BLIT_FRAG = `
void main() { fragColor = vec4(texture(uTex0, vUv).rgb, 1.0); }`;

/** Per-layer pre-processing (levels, tone, saturation, blur, invert, posterize). */
export const PRE_FRAG = `
uniform vec4 uPreA; // brightness, contrast, saturation, gamma
uniform vec4 uPreB; // black point, white point, blur (ref px), invert
uniform float uPrePost;
void main() {
  vec4 c = uPreB.z > 0.01 ? blur13(uTex0, vUv, refPx(uPreB.z)) : texture(uTex0, vUv);
  vec3 col = c.rgb;
  col = sat((col - uPreB.x) / max(uPreB.y - uPreB.x, 1e-3));
  col = pow(col, vec3(1.0 / max(uPreA.w, 0.01)));
  col = col + uPreA.x;
  col = (col - 0.5) * (1.0 + uPreA.y) + 0.5;
  col = saturation(sat(col), 1.0 + uPreA.z);
  if (uPreB.w > 0.5) col = 1.0 - col;
  if (uPrePost > 1.5) col = floor(col * (uPrePost - 1.0) + 0.5) / (uPrePost - 1.0);
  fragColor = vec4(sat(col), c.a);
}`;

/** Layer composite: uTex0 = what was below, uTex1 = this layer's result, uTex2 = mask source. */
export const COMPOSITE_FRAG = `
uniform float uOpacity;
uniform float uBlend;
uniform vec4 uMask; // lo, hi, softness, mode (0 off, 1 on, 2 inverted)
vec3 setLum(vec3 c, float l) { return c + (l - luma(c)); }
vec3 blendMode(vec3 b, vec3 s, int m) {
  if (m == 1) return b * s;
  if (m == 2) return blendScreen(b, s);
  if (m == 3) return blendOverlay(b, s);
  if (m == 4) return blendSoftLight(b, s);
  if (m == 5) return min(b + s, 1.0);
  if (m == 6) return abs(b - s);
  if (m == 7) return min(b, s);
  if (m == 8) return max(b, s);
  if (m == 9) return clamp(setLum(s, luma(b)), 0.0, 1.0);
  if (m == 10) return clamp(setLum(b, luma(s)), 0.0, 1.0);
  if (m == 11) return b / max(1.0 - s, 1e-3);
  if (m == 12) return 1.0 - (1.0 - b) / max(s, 1e-3);
  if (m == 13) return b + s - 2.0 * b * s;
  if (m == 14) { vec3 hb = rgb2hsv(b); vec3 hs = rgb2hsv(s); return hsv2rgb(vec3(hs.x, hb.y, hb.z)); }
  return s;
}
void main() {
  vec4 b = texture(uTex0, vUv);
  vec4 s = texture(uTex1, vUv);
  vec3 r = clamp(blendMode(b.rgb, s.rgb, int(uBlend + 0.5)), 0.0, 1.0);
  float m = 1.0;
  if (uMask.w > 0.5) {
    float l = luma(texture(uTex2, vUv).rgb);
    float k = max(uMask.z, 1e-3);
    m = smoothstep(uMask.x - k, uMask.x + k, l) * (1.0 - smoothstep(uMask.y - k, uMask.y + k, l));
    if (uMask.w > 1.5) m = 1.0 - m;
  }
  float o = uOpacity * m;
  fragColor = vec4(mix(b.rgb, r, o), mix(b.a, s.a, o));
}`;

export const BLEND_MODES = [
  "Normal", "Multiply", "Screen", "Overlay", "Soft light", "Add", "Difference", "Darken", "Lighten",
  "Color", "Luminosity", "Color dodge", "Color burn", "Exclusion", "Hue",
] as const;
