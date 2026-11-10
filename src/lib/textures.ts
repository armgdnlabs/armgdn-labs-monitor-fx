import type { AuxSpec } from "../effects/types";
import { hexToRgb } from "./color";
import { onSurfaceLoad, waitForSurfaces } from "./surfaces";

/* ── Curves ──────────────────────────────────────────────────────────────── */

export type CurvePoint = [number, number];

export function parseCurve(s: string): CurvePoint[] {
  const pts = String(s)
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number) as CurvePoint)
    .filter((p) => p.length === 2 && p.every(Number.isFinite))
    .map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as CurvePoint)
    .sort((a, b) => a[0] - b[0]);
  return pts.length >= 2 ? pts : [[0, 0], [1, 1]];
}

export const formatCurve = (pts: CurvePoint[]) => pts.map(([x, y]) => `${+x.toFixed(4)},${+y.toFixed(4)}`).join(" ");

/** Monotone cubic (Fritsch–Carlson) interpolation through the points, sampled at x. */
export function evalCurve(pts: CurvePoint[], x: number): number {
  const n = pts.length;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[n - 1][0]) return pts[n - 1][1];
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-9) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let i = 0;
  while (i < n - 2 && x > pts[i + 1][0]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const v = (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1];
  return Math.min(1, Math.max(0, v));
}

/** One 256-wide LUT row per curve; each value written to R,G,B. */
export function curvesLut(curves: string[]): AuxSpec {
  return {
    key: `curves:${curves.join("|")}`,
    build: () => {
      const rows = curves.length;
      const data = new Uint8Array(256 * rows * 4);
      curves.forEach((c, row) => {
        const pts = parseCurve(c);
        for (let i = 0; i < 256; i++) {
          const v = Math.round(evalCurve(pts, i / 255) * 255);
          const o = (row * 256 + i) * 4;
          data[o] = data[o + 1] = data[o + 2] = v;
          data[o + 3] = 255;
        }
      });
      // Uploaded with FLIP_Y, so data row 0 (the first curve) lands at the top, where lut1() reads row 0.
      return { width: 256, height: rows, data };
    },
  };
}

/* ── Gradients ───────────────────────────────────────────────────────────── */

export type GradientStop = { color: string; pos: number };

export function parseGradient(s: string): GradientStop[] {
  const stops = String(s)
    .split(",")
    .map((t) => {
      const [color, pos] = t.trim().split("@");
      return { color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000", pos: Math.min(1, Math.max(0, Number(pos) || 0)) };
    })
    .sort((a, b) => a.pos - b.pos);
  return stops.length >= 2 ? stops : [{ color: "#000000", pos: 0 }, { color: "#ffffff", pos: 1 }];
}

export const formatGradient = (stops: GradientStop[]) => stops.map((s) => `${s.color}@${+s.pos.toFixed(3)}`).join(",");

export function sampleGradient(stops: GradientStop[], x: number): [number, number, number] {
  if (x <= stops[0].pos) return hexToRgb(stops[0].color);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (x <= b.pos) {
      const t = (x - a.pos) / Math.max(1e-6, b.pos - a.pos);
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return hexToRgb(stops[stops.length - 1].color);
}

export function gradientLut(...gradients: string[]): AuxSpec {
  return {
    key: `grad:${gradients.join("|")}`,
    build: () => {
      const rows = gradients.length;
      const data = new Uint8Array(256 * rows * 4);
      gradients.forEach((g, row) => {
        const stops = parseGradient(g);
        for (let i = 0; i < 256; i++) {
          const c = sampleGradient(stops, i / 255);
          const o = (row * 256 + i) * 4;
          data[o] = Math.round(c[0] * 255);
          data[o + 1] = Math.round(c[1] * 255);
          data[o + 2] = Math.round(c[2] * 255);
          data[o + 3] = 255;
        }
      });
      return { width: 256, height: rows, data };
    },
  };
}

/** Palette strip: N colours, 1 px each, nearest-sampled. */
export function paletteTex(colors: string[]): AuxSpec {
  return {
    key: `pal:${colors.join(",")}`,
    filter: "nearest",
    build: () => {
      const data = new Uint8Array(colors.length * 4);
      colors.forEach((c, i) => {
        const [r, g, b] = hexToRgb(c);
        data.set([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255], i * 4);
      });
      return { width: colors.length, height: 1, data };
    },
  };
}

/* ── Glyph atlas (ASCII and friends) ─────────────────────────────────────── */

const FONT_STACK = `"JetBrains Mono", "VT323", ui-monospace, monospace`;

/**
 * Glyphs laid out left→right in the given order, one square cell each, white on black.
 * The shader picks a glyph by index, so pass charsets ordered from sparse to dense.
 */
export function glyphAtlas(chars: string, font = FONT_STACK, weight = 500): AuxSpec {
  const glyphs = Array.from(chars || " ");
  return {
    key: `glyphs:${weight}:${font}:${fontsStatus()}:${glyphs.join("")}`,
    build: () => {
      const cell = 48;
      const c = document.createElement("canvas");
      c.width = cell * glyphs.length;
      c.height = cell;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${weight} ${cell * 0.86}px ${font}`;
      glyphs.forEach((g, i) => ctx.fillText(g, i * cell + cell / 2, cell / 2 + cell * 0.04));
      return c;
    },
  };
}

/** Orders glyphs by measured ink coverage so any custom charset maps light→dark correctly. */
export function sortByDensity(chars: string): string {
  const glyphs = Array.from(new Set(Array.from(chars)));
  if (typeof document === "undefined" || glyphs.length < 2) return glyphs.join("");
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.font = `500 20px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const score = (g: string) => {
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillText(g, 12, 12);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return s;
  };
  return glyphs.map((g) => [g, score(g)] as const).sort((a, b) => a[1] - b[1]).map((g) => g[0]).join("");
}

/* ── Text texture ────────────────────────────────────────────────────────── */

const fontsStatus = () => (typeof document !== "undefined" && document.fonts ? document.fonts.status : "");

export const TEXT_FONTS = [
  { label: "Instrument Serif", css: `"Instrument Serif", serif` },
  { label: "Tinos", css: `"Tinos", serif` },
  { label: "JetBrains Mono", css: `"JetBrains Mono", monospace` },
  { label: "Silkscreen", css: `"Silkscreen", monospace` },
  { label: "VT323", css: `"VT323", monospace` },
  { label: "Unifraktur", css: `"UnifrakturMaguntia", serif` },
  { label: "Doto", css: `"Doto", monospace` },
];

export function textTexture(textValue: string, fontIndex: number, weight: number, tracking: number, align: number, lineHeight = 1.08, italic = false): AuxSpec {
  const font = TEXT_FONTS[Math.max(0, Math.min(TEXT_FONTS.length - 1, Math.round(fontIndex)))];
  return {
    // Font status is part of the key so the texture is rebuilt once web fonts finish loading.
    key: `text:${font.label}:${weight}:${tracking}:${align}:${lineHeight}:${italic}:${fontsStatus()}:${textValue}`,
    build: () => {
      const lines = String(textValue || " ").split("\n");
      const size = 160;
      const lineH = size * lineHeight;
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      const fontStr = `${italic ? "italic " : ""}${Math.round(weight)} ${size}px ${font.css}`;
      ctx.font = fontStr;
      const spacing = tracking * size;
      const measure = (l: string) => ctx.measureText(l).width + Math.max(0, Array.from(l).length - 1) * spacing;
      const w = Math.min(8192, Math.ceil(Math.max(...lines.map(measure), 1) + size * 0.4));
      const h = Math.ceil(lines.length * lineH + size * 0.3);
      c.width = w;
      c.height = h;
      ctx.font = fontStr;
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`; } catch { /* older browsers */ }
      lines.forEach((l, i) => {
        const lw = measure(l);
        const x = align === 0 ? size * 0.2 : align === 2 ? w - lw - size * 0.2 : (w - lw) / 2;
        ctx.fillText(l, x, size * 0.15 + lineH * (i + 0.5));
      });
      return c;
    },
  };
}

/* ── External images (layer mix, displacement maps) ──────────────────────── */

const images = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();
export const onAuxImageLoad = (fn: () => void) => {
  listeners.add(fn);
  const off = onSurfaceLoad(fn);
  return () => { listeners.delete(fn); off(); };
};

export function imageTexture(url: string): AuxSpec {
  let img = images.get(url);
  if (!img && url) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => listeners.forEach((l) => l());
    img.src = url;
    images.set(url, img);
  }
  const ready = !!img && img.complete && img.naturalWidth > 0;
  return {
    key: `img:${ready ? "1" : "0"}:${url}`,
    wrap: "repeat",
    build: () => (ready ? img! : { width: 1, height: 1, data: new Uint8Array([128, 128, 128, 255]) }),
  };
}

/** Wait for the images an aux spec list depends on (used before exporting). */
export async function waitForAuxImages(): Promise<void> {
  await Promise.all([...images.values()].map((i) => (i.complete ? null : i.decode().catch(() => null))));
  await waitForSurfaces();
}
