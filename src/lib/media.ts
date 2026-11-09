import type { MediaSource } from "../state/editor";
import { photoUrl, type Photo } from "../data/photos";

const MAX_SOURCE_SIDE = 8192;

export const ACCEPTED_MEDIA = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,video/mp4,video/webm,video/quicktime";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Remote images must be CORS-clean or WebGL refuses to read them.
    if (!url.startsWith("blob:") && !url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load this image (it may block cross-site use)."));
    img.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("This video format isn't supported by your browser."));
    v.src = url;
    v.load();
  });
}

/** Downscale images beyond the GPU-safe limit so texture upload never fails. */
async function fitImage(img: HTMLImageElement, url: string): Promise<{ img: HTMLImageElement; url: string }> {
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= MAX_SOURCE_SIDE) return { img, url };
  const s = MAX_SOURCE_SIDE / long;
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/png"));
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  const nextUrl = URL.createObjectURL(blob);
  return { img: await loadImage(nextUrl), url: nextUrl };
}

export async function loadMediaFile(file: File): Promise<MediaSource> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const v = await loadVideo(url);
      return { kind: "video", element: v, name: file.name, width: v.videoWidth, height: v.videoHeight, url, duration: v.duration || 0 };
    }
    const fitted = await fitImage(await loadImage(url), url);
    const img = fitted.img;
    return { kind: "image", element: img, name: file.name, width: img.naturalWidth, height: img.naturalHeight, url: fitted.url, duration: 0 };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Image or video from a URL (must allow cross-origin use). */
export async function loadMediaUrl(url: string): Promise<MediaSource> {
  const name = decodeURIComponent(url.split("?")[0].split("/").pop() || "remote") || "remote";
  if (/\.(mp4|webm|mov)$/i.test(url.split("?")[0])) {
    const v = await loadVideo(url);
    return { kind: "video", element: v, name, width: v.videoWidth, height: v.videoHeight, url, duration: v.duration || 0 };
  }
  const fitted = await fitImage(await loadImage(url), url);
  return { kind: "image", element: fitted.img, name, width: fitted.img.naturalWidth, height: fitted.img.naturalHeight, url: fitted.url, duration: 0 };
}

/** A curated Unsplash photo, with its credit attached. */
export async function loadPhoto(photo: Photo, width = 2400): Promise<MediaSource> {
  const img = await loadImage(photoUrl(photo, width));
  return {
    kind: "image",
    element: img,
    name: `${photo.tag}-${photo.username}.jpg`,
    width: img.naturalWidth,
    height: img.naturalHeight,
    url: img.src,
    duration: 0,
    credit: { name: photo.name, username: photo.username, key: photo.key },
  };
}

/** Offline fallback: a procedural test card, so the editor still works without network. */
export async function createTestCard(): Promise<MediaSource> {
  const W = 1600;
  const H = 2000;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0A0A0A");
  sky.addColorStop(0.55, "#4A4845");
  sky.addColorStop(1, "#EDE7DF");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const bars = ["#F7F2EC", "#BDB9B2", "#D3202A", "#9BBC0F", "#4F7FD8", "#FF3B2F", "#85827D"];
  bars.forEach((col, i) => { g.fillStyle = col; g.fillRect((W / bars.length) * i, H * 0.7, W / bars.length, H * 0.12); });
  g.strokeStyle = "#F7F2EC";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(W / 2, H * 0.36, 320, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#F7F2EC";
  g.textAlign = "center";
  g.font = "400 160px Tinos, serif";
  g.fillText("M O N I T O R", W / 2, H * 0.4);
  g.font = "500 44px 'JetBrains Mono', monospace";
  g.fillText("> MONITOR READY_", W / 2, H * 0.9);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("test card failed"))), "image/png"));
  const url = URL.createObjectURL(blob);
  const img = await loadImage(url);
  return { kind: "image", element: img, name: "test-card.png", width: W, height: H, url, duration: 0 };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "export";
}
