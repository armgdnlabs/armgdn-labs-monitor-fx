import { create } from "zustand";

/** Artboard view (pan/zoom is view-only and never affects exports) plus live render stats. */
interface ViewState {
  fit: boolean;
  zoom: number;
  panX: number;
  panY: number;
  fps: number;
  renderMs: number;
  workW: number;
  workH: number;
  gpu: string;
  rendering: boolean;
  set: (patch: Partial<Omit<ViewState, "set" | "zoomBy" | "reset">>) => void;
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void;
  reset: () => void;
}

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 32;

export const useView = create<ViewState>((set, get) => ({
  fit: true,
  zoom: 1,
  panX: 0,
  panY: 0,
  fps: 0,
  renderMs: 0,
  workW: 0,
  workH: 0,
  gpu: "",
  rendering: false,
  set: (patch) => set(patch),
  /** Zoom around an anchor point given relative to the viewport centre (px). */
  zoomBy: (factor, anchor = { x: 0, y: 0 }) => {
    const { zoom, panX, panY } = get();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
    const k = next / zoom;
    set({ zoom: next, fit: false, panX: anchor.x - (anchor.x - panX) * k, panY: anchor.y - (anchor.y - panY) * k });
  },
  reset: () => set({ fit: true, panX: 0, panY: 0 }),
}));

