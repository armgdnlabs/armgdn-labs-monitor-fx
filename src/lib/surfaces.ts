import type { AuxSpec } from "../effects/types";

/**
 * Surface textures for Layer mix, Displacement, Texture blur and Paper scan.
 * Photographs (Unsplash, hot-linked and credited in the README) are converted to grey and
 * levelled once on load so they read like flatbed scans; the rest are drawn here, tileable.
 */
interface Photo { unsplash: string; by: string }
interface Gen { gen: GenKind }
type GenKind = "grain" | "mottle" | "grunge" | "scratches" | "scanbed" | "lines" | "cells" | "scribble" | "instant" | "clouds" | "border";
export interface Surface {
  name: string;
  src: Photo | Gen;
  /** Convert to grey, then map [lo, hi] to [0, 1] (and optionally invert). */
  gray?: boolean;
  lo?: number;
  hi?: number;
  invert?: boolean;
}

const ph = (unsplash: string, by: string): Photo => ({ unsplash, by });

/** Append-only: presets store indices into this list. */
export const SURFACES: Surface[] = [
  { name: "Crumpled paper", src: ph("1776278515793-c4d7fbf04369", "sigmund"), gray: true, lo: 0.42, hi: 1 },
  { name: "Crumpled grey", src: ph("1603484477859-abe6a73f9366", "sjobjio"), gray: true, lo: 0.25, hi: 0.85 },
  { name: "Folded paper", src: ph("1691415780572-de7c176a3b18", "bartco86"), gray: true, lo: 0.55, hi: 0.97 },
  { name: "Smooth paper", src: ph("1737276746515-19ea864a6b80", "sanches812"), gray: true, lo: 0.55, hi: 1 },
  { name: "Tracing paper", src: ph("1707134657472-51902d2854a4", "heathergreengreen"), gray: true, lo: 0.5, hi: 1 },
  { name: "Paper towel", src: ph("1771231591303-8e0daa821513", "msaimakin"), gray: true, lo: 0.3, hi: 0.95 },
  { name: "Broken glass", src: ph("1767044202331-c3a0a7cbdf43", "leftfield_corn"), gray: true, lo: 0.05, hi: 0.8 },
  { name: "Broken glass, light", src: ph("1767044202331-c3a0a7cbdf43", "leftfield_corn"), gray: true, lo: 0.05, hi: 0.8, invert: true },
  { name: "Cracked paint", src: ph("1475965894430-b05c9d13568a", "creativejunkie"), gray: true, lo: 0.35, hi: 0.92 },
  { name: "Speckle", src: ph("1768956463493-a8118a41b629", "linusbelanger"), gray: true, lo: 0.35, hi: 0.95 },
  { name: "Dark dust", src: ph("1768956463493-a8118a41b629", "linusbelanger"), gray: true, lo: 0.35, hi: 0.98, invert: true },
  { name: "Stained wall", src: ph("1717851425482-bdb309381a84", "mikehindle"), gray: true, lo: 0.2, hi: 0.95 },
  { name: "Streaked concrete", src: ph("1624261770442-8f167de68f25", "anniespratt"), gray: true, lo: 0.15, hi: 0.8 },
  { name: "Sun on water", src: ph("1759771350309-2724bca07d73", "wings017") },
  { name: "Lined paper", src: ph("1783700697126-8055c3c15baa", "umuthasanoglu") },
  { name: "Kraft paper", src: ph("1603484477859-abe6a73f9366", "sjobjio") },
  { name: "Cardboard", src: ph("1776278515671-fe179ba9cfd3", "sigmund") },
  { name: "Linen", src: ph("1764437835706-ba9d63250bd2", "loganvoss") },
  { name: "Tracing paper, colour", src: ph("1707134657472-51902d2854a4", "heathergreengreen") },
  { name: "Fine grain", src: { gen: "grain" } },
  { name: "Mottle", src: { gen: "mottle" } },
  { name: "Rough grunge", src: { gen: "grunge" } },
  { name: "Scratches", src: { gen: "scratches" } },
  { name: "Scanner bed", src: { gen: "scanbed" } },
  { name: "Scanlines", src: { gen: "lines" } },
  { name: "Cells", src: { gen: "cells" } },
  { name: "Scribbles", src: { gen: "scribble" } },
  { name: "Instant frame", src: { gen: "instant" } },
  { name: "Clouds", src: { gen: "clouds" } },
  { name: "Print border", src: { gen: "border" } },
];
export const SURFACE_NAMES = SURFACES.map((s) => s.name);
export const SURFACE_CREDITS = [...new Map(SURFACES.flatMap((s) => ("unsplash" in s.src ? [[s.src.by, s.src.unsplash] as const] : []))).entries()];

const photoUrl = (id: string) => `https://images.unsplash.com/photo-${id}?w=2048&q=82&auto=format`;

/* ── Tileable noise ──────────────────────────────────────────────────────── */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Value noise on a periodic lattice of `p` cells, so it tiles. */
function lattice(p: number, seed: number) {
  const r = rng(seed);
  const g = new Float32Array(p * p).map(() => r());
  const at = (x: number, y: number) => g[(((y % p) + p) % p) * p + (((x % p) + p) % p)];
  return (u: number, v: number) => {
    const x = u * p, y = v * p;
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
function fbm(base: number, octaves: number, seed: number, gain = 0.5) {
  const layers = Array.from({ length: octaves }, (_, i) => lattice(base << i, seed + i * 101));
  return (u: number, v: number) => {
    let s = 0, a = 1, n = 0;
    for (const l of layers) { s += l(u, v) * a; n += a; a *= gain; }
    return s / n;
  };
}

function field(size: number, f: (u: number, v: number, x: number, y: number) => number): ImageData {
  const img = new ImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = Math.max(0, Math.min(255, f(x / size, y / size, x, y) * 255));
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  return img;
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

function generate(kind: GenKind): HTMLCanvasElement {
  const N = 1024;
  const [c, ctx] = canvas(N);
  const r = rng(7);
  if (kind === "grain") {
    const n = fbm(256, 2, 3, 0.6);
    ctx.putImageData(field(N, (u, v) => 0.5 + (r() - 0.5) * 0.55 + (n(u, v) - 0.5) * 0.35), 0, 0);
  } else if (kind === "mottle") {
    const n = fbm(6, 6, 11, 0.55), m = fbm(64, 3, 5);
    ctx.putImageData(field(N, (u, v) => 0.5 + (n(u, v) - 0.5) * 1.6 + (m(u, v) - 0.5) * 0.4 + (r() - 0.5) * 0.25), 0, 0);
  } else if (kind === "grunge") {
    const n = fbm(8, 7, 21, 0.6);
    ctx.putImageData(field(N, (u, v) => { const t = n(u, v); return Math.max(0, Math.min(1, (t - 0.47) * 9 + 0.5)) * (0.85 + r() * 0.15); }), 0, 0);
  } else if (kind === "scratches" || kind === "scanbed") {
    const n = fbm(4, 5, 31);
    ctx.putImageData(field(N, (u, v) => 0.05 + (n(u, v) - 0.5) * 0.12 + r() * 0.04), 0, 0);
    ctx.globalCompositeOperation = "lighter";
    const count = kind === "scratches" ? 260 : 90;
    for (let i = 0; i < count; i++) {
      const x = r() * N, y = r() * N, len = 20 + r() ** 3 * (kind === "scratches" ? 700 : 120);
      const a = kind === "scratches" ? (r() < 0.6 ? (r() - 0.5) * 0.25 : r() * Math.PI) : r() * Math.PI;
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`;
      ctx.lineWidth = 0.4 + r() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 30, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 30, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    for (let i = 0; i < (kind === "scratches" ? 900 : 2200); i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
      const s = r() ** 4 * 5 + 0.6;
      ctx.beginPath(); ctx.ellipse(r() * N, r() * N, s, s * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    if (kind === "scanbed") {
      const g = ctx.createLinearGradient(0, 0, 0, 40);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, N - 40, N, 40);
      ctx.save(); ctx.translate(0, N); ctx.scale(1, -1); ctx.fillRect(0, N - 40, N, 40); ctx.restore();
    }
  } else if (kind === "lines") {
    ctx.putImageData(field(N, (_u, _v, _x, y) => (y % 8 < 4 ? 0.82 : 0.18) + (r() - 0.5) * 0.08), 0, 0);
  } else if (kind === "cells") {
    const P = 18, pts: [number, number, number][] = [];
    for (let i = 0; i < P * P; i++) pts.push([((i % P) + r()) / P, (Math.floor(i / P) + r()) / P, 0.25 + r() * 0.6]);
    ctx.putImageData(field(N, (u, v) => {
      let best = 9, tone = 0;
      const cx = Math.floor(u * P), cy = Math.floor(v * P);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j;
        const p = pts[(((gy % P) + P) % P) * P + (((gx % P) + P) % P)];
        const dx = p[0] + Math.floor(gx / P) - u, dy = p[1] + Math.floor(gy / P) - v;
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; tone = p[2]; }
      }
      return tone + (r() - 0.5) * 0.06;
    }), 0, 0);
  } else if (kind === "scribble") {
    ctx.fillStyle = "#c8c8c8"; ctx.fillRect(0, 0, N, N);
    ctx.lineCap = "round";
    for (let i = 0; i < 1400; i++) {
      let x = r() * N, y = r() * N, a = r() * Math.PI * 2;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? "20,20,20" : "250,250,250"},${0.25 + r() * 0.45})`;
      ctx.lineWidth = 0.6 + r() * 1.6;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 14; k++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * 9; y += Math.sin(a) * 9; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else if (kind === "instant") {
    const n = fbm(64, 3, 41);
    ctx.putImageData(field(N, (u, v) => 0.93 + (n(u, v) - 0.5) * 0.06), 0, 0);
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(N * 0.06, N * 0.06, N * 0.88, N * 0.76);
  } else if (kind === "clouds") {
    const n = fbm(3, 6, 51, 0.55);
    ctx.putImageData(field(N, (u, v) => 0.5 + (n(u, v) - 0.5) * 2.2), 0, 0);
  } else if (kind === "border") {
    const n = fbm(32, 4, 61);
    ctx.putImageData(field(N, (u, v) => 0.22 + (n(u, v) - 0.5) * 0.3 + (r() - 0.5) * 0.12), 0, 0);
    ctx.strokeStyle = "#f2f2f0"; ctx.lineWidth = N * 0.07; ctx.strokeRect(0, 0, N, N);
  }
  return c;
}

/* ── Loading and caching ─────────────────────────────────────────────────── */

const ready = new Map<number, TexImageSource>();
const pending = new Set<number>();
const listeners = new Set<() => void>();
export const onSurfaceLoad = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function process(img: HTMLImageElement, s: Surface): HTMLCanvasElement {
  const w = Math.min(2048, img.naturalWidth), h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  if (!s.gray && s.lo == null && !s.invert) return c;
  const d = ctx.getImageData(0, 0, w, h);
  const lo = s.lo ?? 0, hi = s.hi ?? 1;
  for (let i = 0; i < d.data.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      let v = s.gray ? (d.data[i] * 0.2126 + d.data[i + 1] * 0.7152 + d.data[i + 2] * 0.0722) / 255 : d.data[i + k] / 255;
      v = Math.max(0, Math.min(1, (v - lo) / Math.max(hi - lo, 1e-3)));
      if (s.invert) v = 1 - v;
      d.data[i + k] = v * 255;
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

function load(i: number) {
  const s = SURFACES[i];
  if (!s || pending.has(i) || ready.has(i)) return;
  pending.add(i);
  const done = (src: TexImageSource) => { ready.set(i, src); pending.delete(i); listeners.forEach((l) => l()); };
  if ("gen" in s.src) { const kind = s.src.gen; setTimeout(() => done(generate(kind)), 0); return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => done(process(img, s));
  img.onerror = () => pending.delete(i);
  img.src = photoUrl(s.src.unsplash);
}

/** Aux texture for a surface index (mid-grey placeholder until it has loaded). */
export function surfaceTexture(index: number): AuxSpec {
  const i = Math.max(0, Math.min(SURFACES.length - 1, Math.round(index) || 0));
  load(i);
  const src = ready.get(i);
  return {
    key: `surface:${i}:${src ? 1 : 0}`,
    wrap: "repeat",
    build: () => src ?? { width: 1, height: 1, data: new Uint8Array([128, 128, 128, 255]) },
  };
}

export async function waitForSurfaces(): Promise<void> {
  for (let n = 0; n < 100 && pending.size; n++) await new Promise((r) => setTimeout(r, 50));
}
