import { useEffect, useState } from "react";
import { Renderer, type RenderLayer } from "./Renderer";
import { getPhoto, PHOTOS, photoUrl } from "../data/photos";

export const THUMB_W = 240;
export const THUMB_H = 300;

interface Job {
  key: string;
  photo: string;
  layers: () => RenderLayer[];
  /** Render a strip of frames across the loop (hover scrubbing) instead of one still. */
  frames?: number;
}

/** Loop length used for scrub strips, matching the editor's default animation length. */
const STRIP_SECONDS = 5;

export const originalUrl = (photo: string) => photoUrl(getPhoto(photo) ?? PHOTOS[0], THUMB_W * 2, THUMB_H * 2);

/**
 * Renders library previews: every effect and preset has its own Unsplash photo,
 * rendered through the effect at thumbnail size. Work is spread over animation
 * frames (≈10 ms per frame) so scrolling the library never stalls the editor.
 */
class ThumbnailService {
  private renderer: Renderer | null = null;
  private cache = new Map<string, string>();
  private strips = new Map<string, string[]>();
  private photos = new Map<string, HTMLImageElement | "error">();
  private loading = new Set<string>();
  private queue: Job[] = [];
  private listeners = new Set<() => void>();
  private scheduled = false;

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  request(key: string, photo: string, layers: () => RenderLayer[]) {
    if (this.cache.has(key) || this.queue.some((q) => q.key === key)) return;
    this.queue.push({ key, photo, layers });
    this.ensurePhoto(photo);
    this.schedule();
  }

  getStrip(key: string): string[] | undefined {
    return this.strips.get(key);
  }

  requestStrip(key: string, photo: string, layers: () => RenderLayer[], frames = 16) {
    const k = `strip:${key}`;
    if (this.strips.has(key) || this.queue.some((q) => q.key === k)) return;
    this.queue.unshift({ key: k, photo, layers, frames });
    this.ensurePhoto(photo);
    this.schedule();
  }

  /** Drop pending jobs that scrolled out of view. */
  cancel(key: string) {
    this.queue = this.queue.filter((q) => q.key !== key);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private ensurePhoto(key: string) {
    if (this.photos.has(key) || this.loading.has(key)) return;
    const p = getPhoto(key) ?? PHOTOS[0];
    this.loading.add(key);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => { this.loading.delete(key); this.photos.set(key, img); this.schedule(); };
    img.onerror = () => { this.loading.delete(key); this.photos.set(key, "error"); this.schedule(); };
    img.src = photoUrl(p, THUMB_W * 2, THUMB_H * 2);
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => this.process());
  }

  private process() {
    this.scheduled = false;
    if (!this.renderer || this.renderer.isLost) {
      try { this.renderer = new Renderer(document.createElement("canvas")); } catch { return; }
    }
    const r = this.renderer;
    const started = performance.now();
    let rendered = false;
    for (let i = 0; i < this.queue.length && performance.now() - started < 10;) {
      const job = this.queue[i];
      const photo = this.photos.get(job.photo);
      if (!photo) { i++; continue; } // still loading
      this.queue.splice(i, 1);
      if (photo === "error") { this.cache.set(job.key, ""); rendered = true; continue; }
      try {
        r.setSource(photo, photo.naturalWidth, photo.naturalHeight);
        r.resetFeedback();
        const layers = job.layers();
        if (job.frames) {
          // Scrub strip: render through the loop, keeping every few frames so feedback
          // effects (trails, datamosh) build up the way they do in the editor.
          const out: string[] = [];
          const sub = 3;
          for (let f = 0; f < job.frames * sub; f++) {
            const t = (f / (job.frames * sub)) * STRIP_SECONDS;
            r.render(layers, { width: THUMB_W, height: THUMB_H, crop: [0, 0, 1, 1], time: t, refHeight: 640 });
            if (f % sub === sub - 1) out.push((r.canvas as HTMLCanvasElement).toDataURL("image/jpeg", 0.8));
          }
          this.strips.set(job.key.slice(6), out);
          rendered = true;
          continue;
        }
        const frames = layers.some((l) => l.effect.passes.some((p) => p.feedback)) ? 8 : 1;
        for (let f = 0; f < frames; f++) {
          r.render(layers, { width: THUMB_W, height: THUMB_H, crop: [0, 0, 1, 1], time: 0.6 + f / 30, refHeight: 640 });
        }
        this.cache.set(job.key, (r.canvas as HTMLCanvasElement).toDataURL("image/jpeg", 0.84));
      } catch {
        this.cache.set(job.key, "");
      }
      rendered = true;
    }
    if (rendered) this.emit();
    if (this.queue.length) this.schedule();
  }
}

export const thumbnails = new ThumbnailService();

/** Frames across the animation loop for hover scrubbing; rendered on first hover. */
export function useThumbStrip(key: string, photo: string, layers: () => RenderLayer[], active: boolean): string[] | undefined {
  const [, force] = useState(0);
  useEffect(() => thumbnails.subscribe(() => force((n) => n + 1)), []);
  const strip = thumbnails.getStrip(key);
  useEffect(() => {
    if (strip || !active) return;
    thumbnails.requestStrip(key, photo, layers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, strip, photo]);
  return strip;
}

/** Preview data URL for a library item; renders lazily once `visible` is true. */
export function useThumbnail(key: string, photo: string, layers: () => RenderLayer[], visible = true): string | undefined {
  const [, force] = useState(0);
  useEffect(() => thumbnails.subscribe(() => force((n) => n + 1)), []);
  const url = thumbnails.get(key);
  useEffect(() => {
    if (url !== undefined || !visible) return;
    thumbnails.request(key, photo, layers);
    return () => thumbnails.cancel(key);
    // layers is a factory; key identifies its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url, visible, photo]);
  return url;
}
