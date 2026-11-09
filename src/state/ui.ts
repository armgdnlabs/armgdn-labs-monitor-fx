import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../lib/storage";

export type Modal =
  | { type: "profile" }
  | { type: "savePreset" }
  | { type: "batch" }
  | { type: "shortcuts" }
  | { type: "about" }
  | { type: "sourceUrl" }
  | { type: "export" };

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

interface UIState {
  modal: Modal | null;
  toasts: Toast[];
  /** Full-screen library browser (the expanded presets/effects grid). */
  browserOpen: boolean;
  open: (m: Modal) => void;
  close: () => void;
  setBrowser: (open: boolean) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useUI = create<UIState>((set, get) => ({
  modal: null,
  toasts: [],
  browserOpen: false,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
  setBrowser: (browserOpen) => set({ browserOpen }),
  toast: (message, tone = "info") => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, message, tone }].slice(-4) });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export type Theme = "dark" | "light";
export type LibraryTab = "presets" | "effects" | "mine" | "favorites";

interface PrefsState {
  theme: Theme;
  libraryWidth: number;
  libraryCollapsed: boolean;
  layersHeight: number;
  libraryTab: LibraryTab;
  /** Tag filter per library tab ("all" or a category / preset section id). */
  libraryFilter: Record<string, string>;
  previewQuality: number;
  set: (patch: Partial<Omit<PrefsState, "set">>) => void;
}

/** Per-viewer UI preferences (theme, panel sizes). */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: "dark",
      libraryWidth: 340,
      libraryCollapsed: false,
      layersHeight: 240,
      libraryTab: "presets",
      libraryFilter: {},
      previewQuality: 1,
      set: (patch) => set(patch),
    }),
    { name: "monitor.prefs", version: 2, migrate: (s) => ({ ...(s as object), libraryFilter: {}, libraryWidth: Math.max(340, (s as PrefsState).libraryWidth ?? 340) }) as PrefsState, storage: createJSONStorage(() => safeStorage) },
  ),
);
