import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PresetSnapshot } from "../effects/presets";
import { uid } from "../lib/id";

export interface SavedPreset {
  id: string;
  name: string;
  createdAt: string;
  snapshot: PresetSnapshot;
  /** Small JPEG data URL. */
  cover?: string;
}

interface LibraryState {
  favorites: string[];
  presets: SavedPreset[];
  toggleFavorite: (effectId: string) => void;
  savePreset: (name: string, snapshot: PresetSnapshot, cover?: string) => SavedPreset;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  importPresets: (list: SavedPreset[]) => number;
}

const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* quota or private mode */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
}));

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: [],
      presets: [],
      toggleFavorite: (id) => {
        const favs = get().favorites;
        set({ favorites: favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id] });
      },
      savePreset: (name, snapshot, cover) => {
        const preset: SavedPreset = { id: uid(), name, createdAt: new Date().toISOString(), snapshot, cover };
        set({ presets: [preset, ...get().presets] });
        return preset;
      },
      renamePreset: (id, name) => set({ presets: get().presets.map((p) => (p.id === id ? { ...p, name } : p)) }),
      deletePreset: (id) => set({ presets: get().presets.filter((p) => p.id !== id) }),
      importPresets: (list) => {
        const valid = list.filter((p) => p && typeof p.name === "string" && p.snapshot && Array.isArray(p.snapshot.graph));
        set({ presets: [...valid.map((p) => ({ ...p, id: uid() })), ...get().presets] });
        return valid.length;
      },
    }),
    { name: "monitor.library", storage: safeStorage },
  ),
);
