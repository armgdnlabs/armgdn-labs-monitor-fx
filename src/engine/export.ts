import { zipSync } from "fflate";
import { Renderer, type SourceTransform } from "./Renderer";
import { type AspectId, type ExportSizeId, type Layer, type LayerGroup, type MediaSource, cropFor, toRenderLayers } from "../state/editor";
import { baseName, loadMediaFile } from "../lib/media";
import { waitForAuxImages } from "../lib/textures";

const SIZE_TARGETS: Record<ExportSizeId, number> = { source: 0, "1080": 1920, "4k": 3840, "8k": 7680, "16k": 15360 };

export interface ExportPlan {
  width: number;
  height: number;
  /** True when the request was reduced to the GPU's texture limit. */
  limitedByGpu: boolean;
}

export function planExportSize(cropW: number, cropH: number, size: ExportSizeId, gpuMax: number): ExportPlan {
  const long = Math.max(cropW, cropH);
  let target = SIZE_TARGETS[size] || long;
  const limitedByGpu = target > gpuMax;
  if (limitedByGpu) target = gpuMax;
  const s = target / long;
  return { width: Math.max(1, Math.round(cropW * s)), height: Math.max(1, Math.round(cropH * s)), limitedByGpu };
}

function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Encoding failed (image too large for this browser?)"))), type, quality));
}

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;
const EXT = { png: "png", jpeg: "jpg", webp: "webp" } as const;

interface StillOptions {
  media: MediaSource;
  layers: Layer[];
  /** Preset groups (hidden groups are skipped) and loop length for modulators. */
  groups?: LayerGroup[];
  loop?: number;
  aspect: AspectId;
  transform?: SourceTransform;
  time: number;
  format: "png" | "jpeg" | "webp";
  quality: number;
  size: ExportSizeId;
}

/** Feedback effects (trails, datamosh) need history; warm them up with a few frames first. */
const WARMUP_FRAMES = 24;

export async function exportStill(o: StillOptions): Promise<{ blob: Blob; filename: string; plan: ExportPlan }> {
  await waitForAuxImages();
  const renderer = new Renderer(document.createElement("canvas"));
  try {
    const { crop, width, height } = cropFor(o.media, o.aspect);
    const plan = planExportSize(width, height, o.size, renderer.maxSize);
    renderer.setSource(o.media.element, o.media.width, o.media.height);
    const layers = toRenderLayers(o.layers, o.time, o.groups, o.loop);
    const needsWarmup = layers.some((l) => l.effect.passes.some((p) => p.feedback));
    const frames = needsWarmup ? WARMUP_FRAMES : 1;
    for (let i = frames - 1; i >= 0; i--) {
      const t = Math.max(0, o.time - i / 30);
      renderer.render(i === 0 ? layers : toRenderLayers(o.layers, t, o.groups, o.loop), { width: plan.width, height: plan.height, crop, time: t, transform: o.transform });
    }
    const out = document.createElement("canvas");
    out.width = plan.width;
    out.height = plan.height;
    const ctx = out.getContext("2d")!;
    if (o.format !== "png") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, out.width, out.height); }
    ctx.drawImage(renderer.canvas as HTMLCanvasElement, 0, 0);
    const blob = await canvasToBlob(out, MIME[o.format], o.quality);
    return { blob, filename: `${baseName(o.media.name)}-monitor.${EXT[o.format]}`, plan };
  } finally {
    renderer.dispose();
  }
}

export function pickVideoMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    { mime: "video/mp4;codecs=avc1.640028", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

interface VideoOptions {
  media: MediaSource;
  layers: Layer[];
  /** Preset groups (hidden groups are skipped) and loop length for modulators. */
  groups?: LayerGroup[];
  loop?: number;
  aspect: AspectId;
  transform?: SourceTransform;
  seconds: number;
  size: ExportSizeId;
  fps?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Real-time capture of the effect stack via MediaRecorder (MP4 where supported, else WebM). */
export async function exportVideo(o: VideoOptions): Promise<{ blob: Blob; filename: string; plan: ExportPlan }> {
  const format = pickVideoMime();
  if (!format) throw new Error("Video recording isn't supported in this browser.");
  await waitForAuxImages();
  const fps = o.fps ?? 30;
  const renderer = new Renderer(document.createElement("canvas"));
  let video: HTMLVideoElement | null = null;
  try {
    const { crop, width, height } = cropFor(o.media, o.aspect);
    const plan = planExportSize(width, height, o.size, Math.min(renderer.maxSize, 3840));
    // Encoders need even dimensions.
    plan.width -= plan.width % 2;
    plan.height -= plan.height % 2;
    const out = document.createElement("canvas");
    out.width = plan.width;
    out.height = plan.height;
    const ctx = out.getContext("2d")!;

    if (o.media.kind === "video") {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.src = o.media.url;
      await new Promise<void>((res, rej) => { video!.onloadeddata = () => res(); video!.onerror = () => rej(new Error("Could not reopen the video.")); });
      video.currentTime = 0;
      renderer.setSource(video, o.media.width, o.media.height);
    } else {
      renderer.setSource(o.media.element, o.media.width, o.media.height);
    }

    const stream = out.captureStream(fps);
    const bitrate = Math.min(40_000_000, Math.round(plan.width * plan.height * fps * 0.15));
    const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: bitrate });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>((res) => { recorder.onstop = () => res(); });

    const drawFrame = (t: number) => {
      if (video) renderer.setSource(video, o.media.width, o.media.height);
      renderer.render(toRenderLayers(o.layers, t, o.groups, o.loop), { width: plan.width, height: plan.height, crop, time: t, transform: o.transform });
      ctx.drawImage(renderer.canvas as HTMLCanvasElement, 0, 0);
    };

    drawFrame(0);
    recorder.start(250);
    if (video) await video.play();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = video ? video.currentTime : (performance.now() - start) / 1000;
        const done = t >= o.seconds || (video?.ended ?? false) || o.signal?.aborted;
        if (done) { resolve(); return; }
        drawFrame(t);
        o.onProgress?.(Math.min(1, t / o.seconds));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    video?.pause();
    recorder.stop();
    await stopped;
    if (o.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    o.onProgress?.(1);
    return { blob: new Blob(chunks, { type: format.mime.split(";")[0] }), filename: `${baseName(o.media.name)}-monitor.${format.ext}`, plan };
  } finally {
    if (video) { video.removeAttribute("src"); video.load(); }
    renderer.dispose();
  }
}

/** Apply one stack to many images and bundle the results into a ZIP. */
export async function exportBatch(
  files: File[],
  layers: Layer[],
  opts: { format: "png" | "jpeg" | "webp"; quality: number; onProgress?: (done: number, total: number) => void },
): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    const media = await loadMediaFile(files[i]);
    try {
      if (media.kind !== "image") continue;
      const { blob, filename } = await exportStill({ media, layers, aspect: "original", time: 0, format: opts.format, quality: opts.quality, size: "source" });
      let name = filename;
      for (let n = 2; used.has(name); n++) name = filename.replace(/(\.\w+)$/, `-${n}$1`);
      used.add(name);
      entries[name] = new Uint8Array(await blob.arrayBuffer());
    } finally {
      URL.revokeObjectURL(media.url);
    }
    opts.onProgress?.(i + 1, files.length);
  }
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped], { type: "application/zip" });
}
