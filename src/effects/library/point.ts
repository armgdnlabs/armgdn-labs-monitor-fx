import { color, hero, range, select, single, toggle, type EffectDef } from "../types";

/** Distance from the point in aspect-corrected units (1 = canvas height). */
const CURSOR = `
vec2 toCursor(vec2 uv) { return (uv - vec2(u_px, u_py)) * vec2(aspect(), 1.0); }
`;

/**
 * Point effects: each has an on-canvas point (drag it, or keyframe it to animate the
 * motion so it exports exactly as seen).
 */
export const pointFx: EffectDef[] = [
  {
    id: "cursor-lens",
    name: "Lens",
    category: "Distort",
    description: "A magnifying glass that follows the cursor, with chromatic fringing at its rim.",
    keywords: "mouse magnifier loupe zoom hover reactive",
    preview: "hands:3",
    handles: [{ x: "px", y: "py", label: "Point" }],
    params: [range("px", "Point X", 0, 1, 0.5), range("py", "Point Y", 0, 1, 0.5), hero("radius", "Radius", 0.03, 0.6, 0.18), hero("zoom", "Magnify", 1, 6, 2.2, 0.05), range("aberration", "Fringe", 0, 1, 0.5), range("ring", "Rim", 0, 1, 0.6), color("rimColor", "Rim colour", "#F7F2EC")],
    passes: single(CURSOR + `
void main() {
  vec2 d = toCursor(vUv);
  float r = length(d) / u_radius;
  if (r > 1.0) { fragColor = texture(uTex0, vUv); float rim = smoothstep(1.03, 1.0, r) * u_ring; fragColor.rgb = mix(fragColor.rgb, u_rimColor, rim); return; }
  float k = mix(1.0 / u_zoom, 1.0, pow(r, 3.0));
  vec2 q = d * k / vec2(aspect(), 1.0);
  vec2 ca = q * u_aberration * 0.06 * r;
  vec3 c = vec3(texture(uTex0, vec2(u_px, u_py) + q + ca).r, texture(uTex0, vec2(u_px, u_py) + q).g, texture(uTex0, vec2(u_px, u_py) + q - ca).b);
  c += smoothstep(0.85, 1.0, r) * 0.08;
  fragColor = vec4(c, 1.0);
}`),
  },
  {
    id: "cursor-reveal",
    name: "Reveal",
    category: "Overlay",
    description: "Shows the untouched source through a soft window around the cursor (or hides it).",
    keywords: "mouse before after reveal mask flashlight",
    preview: "fire:3",
    handles: [{ x: "px", y: "py", label: "Point" }],
    params: [range("px", "Point X", 0, 1, 0.5), range("py", "Point Y", 0, 1, 0.5), hero("radius", "Radius", 0.02, 0.8, 0.22), hero("softness", "Softness", 0, 1, 0.3), select("shape", "Shape", ["Circle", "Square", "Vertical slit", "Horizontal slit"]), toggle("invert", "Invert"), range("noise", "Ragged edge", 0, 1, 0.2)],
    passes: [{
      id: "main",
      inputs: ["input", "original"],
      frag: CURSOR + `
void main() {
  vec2 d = toCursor(vUv);
  int s = int(u_shape + 0.5);
  float r = s == 1 ? max(abs(d.x), abs(d.y)) : s == 2 ? abs(d.x) : s == 3 ? abs(d.y) : length(d);
  r += sfbm(refCoord(vUv) * 0.01 + uSeed) * u_noise * 0.08;
  float m = 1.0 - smoothstep(u_radius * (1.0 - u_softness), u_radius, r);
  if (u_invert > 0.5) m = 1.0 - m;
  fragColor = mix(texture(uTex0, vUv), texture(uTex1, vUv), m);
}`,
    }],
  },
  {
    id: "magnet",
    name: "Magnet",
    category: "Distort",
    description: "The image is pulled into (or pushed away from) the cursor like a gravity well.",
    keywords: "mouse attract repel gravity warp",
    preview: "sky:3",
    handles: [{ x: "px", y: "py", label: "Point" }],
    params: [range("px", "Point X", 0, 1, 0.5), range("py", "Point Y", 0, 1, 0.5), hero("strength", "Strength", -1, 1, 0.5), hero("radius", "Radius", 0.05, 1, 0.35), range("twist", "Twist", -1, 1, 0.2)],
    passes: single(CURSOR + `
void main() {
  vec2 d = toCursor(vUv);
  float r = length(d) / u_radius;
  float k = exp(-r * r * 2.0);
  vec2 q = d * (1.0 + u_strength * k * 0.9);
  q = rot(u_twist * k * 2.0) * q;
  fragColor = texture(uTex0, vec2(u_px, u_py) + q / vec2(aspect(), 1.0));
}`),
  },
  {
    id: "spotlight",
    name: "Spotlight",
    category: "Overlay",
    description: "A warm pool of light follows the cursor; the rest of the frame falls into shadow.",
    keywords: "mouse flashlight torch light dark",
    preview: "room:3",
    handles: [{ x: "px", y: "py", label: "Point" }],
    params: [range("px", "Point X", 0, 1, 0.5), range("py", "Point Y", 0, 1, 0.5), hero("radius", "Radius", 0.05, 1, 0.3), hero("darkness", "Darkness", 0, 1, 0.85), range("softness", "Softness", 0.05, 1, 0.6), color("light", "Light colour", "#FFE7C2"), range("intensity", "Intensity", 0, 2, 1.2)],
    passes: single(CURSOR + `
void main() {
  vec4 c = texture(uTex0, vUv);
  float r = length(toCursor(vUv));
  float l = 1.0 - smoothstep(u_radius * (1.0 - u_softness), u_radius * (1.0 + u_softness), r);
  vec3 lit = c.rgb * mix(vec3(1.0), u_light * u_intensity, l);
  fragColor = vec4(sat(mix(lit * (1.0 - u_darkness), lit, l)), c.a);
}`),
  },
  {
    id: "pixel-brush",
    name: "Pixel zone",
    category: "Distort",
    description: "Pixels grow toward the cursor — a censor block or a resolution falloff you steer.",
    keywords: "mouse pixelate censor resolution",
    preview: "lips:2",
    handles: [{ x: "px", y: "py", label: "Point" }],
    params: [range("px", "Point X", 0, 1, 0.5), range("py", "Point Y", 0, 1, 0.5), hero("size", "Max pixel", 2, 120, 40, 1, { unit: "px" }), hero("radius", "Radius", 0.05, 1, 0.3), toggle("invert", "Sharp under cursor")],
    passes: single(CURSOR + `
void main() {
  float r = length(toCursor(vUv)) / u_radius;
  float k = u_invert > 0.5 ? smoothstep(0.3, 1.0, r) : 1.0 - smoothstep(0.3, 1.0, r);
  float ps = max(1.0, floor(mix(1.0, u_size, k)) * refScale());
  vec2 uv = (floor(vUv * uRes / ps) + 0.5) * ps / uRes;
  fragColor = texture(uTex0, uv);
}`),
  },
  {
    id: "ring-field",
    name: "Ring field",
    category: "Distort",
    description: "A grid of thin rings whose crescents all turn to face the cursor, sized by the image.",
    keywords: "mouse rings crescents grid generative follow",
    preview: "concert:1",
    handles: [{ x: "px", y: "py", label: "Point" }],
    params: [range("px", "Point X", 0, 1, 0.5), range("py", "Point Y", 0, 1, 0.5), hero("cell", "Cell size", 8, 100, 28, 0.5, { unit: "px" }), hero("crescent", "Crescent", 0, 1, 0.6), range("ring", "Ring weight", 0.5, 4, 1.2, 0.05, { unit: "px" }), select("colorMode", "Colour", ["Amber", "Source", "Bone"]), color("bg", "Background", "#0A0A0A")],
    passes: single(`
void main() {
  float cs = u_cell * refScale();
  vec2 cell = floor(vUv * uRes / cs);
  vec2 f = (fract(vUv * uRes / cs) - 0.5) * cs;
  vec2 cuv = (cell + 0.5) * cs / uRes;
  vec3 s = texture(uTex0, cuv).rgb;
  float l = luma(s);
  float R = cs * 0.42 * (0.5 + l * 0.5);
  float d = length(f);
  float ring = 1.0 - smoothstep(u_ring * refScale() * 0.5, u_ring * refScale() * 0.5 + 1.0, abs(d - R));
  vec2 toM = (vec2(u_px, u_py) - cuv) * uRes;
  vec2 dir = toM / max(length(toM), 1e-3);
  float cres = (1.0 - smoothstep(R - 1.0, R, d)) * smoothstep(R * (1.0 - u_crescent * 0.9), R * (1.0 - u_crescent * 0.9) + 1.0, length(f - dir * R * u_crescent * 0.6));
  int m = int(u_colorMode + 0.5);
  vec3 ink = m == 0 ? vec3(1.0, 0.62, 0.15) : m == 1 ? sat(s * 1.3) : vec3(0.97, 0.95, 0.92);
  fragColor = vec4(mix(u_bg, ink, max(ring * (0.35 + l * 0.65), cres * (0.25 + l))), 1.0);
}`),
  },
];
