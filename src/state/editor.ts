import { create } from "zustand";
import { getEffect } from "../effects/registry";
import type { PresetSnapshot } from "../effects/presets";
import { defaultValues, effectAnimates, type ParamValue, type ParamValues } from "../effects/types";
import { type Easing, type KeyframeTracks, type Modulator, type Modulators, applyModulators, resolveValues, upsertKeyframe } from "../lib/keyframes";
import { NEUTRAL_PRE, type MaskValues, type PreValues, type RenderLayer, type SourceTransform } from "../engine/Renderer";
import { uid } from "../lib/id";

export interface Layer {
  uid: string;
  effectId: string;
  name: string;
  enabled: boolean;
  values: ParamValues;
  opacity: number;
  blend: number;
  seed: number;
  pre: PreValues | null;
  mask: MaskValues | null;
  keyframes: KeyframeTracks;
  /** LFO-style animation per param (see lib/keyframes). */
  mods: Modulators;
  /** Group id when the layer came in with a preset. */
  group?: string;
}

/** A preset applied to the stack: its layers stay together and toggle, collapse and delete as one. */
export interface LayerGroup {
  id: string;
  name: string;
  enabled: boolean;
  collapsed: boolean;
}

interface Stack {
  layers: Layer[];
  groups: LayerGroup[];
}

export interface PhotoCredit {
  name: string;
  username: string;
  /** Photo key in data/photos.ts, when the source came from the curated set. */
  key?: string;
}

export interface MediaSource {
  kind: "image" | "video";
  element: HTMLImageElement | HTMLVideoElement;
  name: string;
  width: number;
  height: number;
  url: string;
  /** Seconds; 0 for still images. */
  duration: number;
  credit?: PhotoCredit;
}

export const ASPECTS = [
  { id: "original", label: "Original", ratio: 0 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "2:3", label: "2:3", ratio: 2 / 3 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "21:9", label: "21:9", ratio: 21 / 9 },
] as const;
export type AspectId = (typeof ASPECTS)[number]["id"];

export type ExportFormat = "png" | "jpeg" | "webp" | "video";
export const EXPORT_SIZES = [
  { id: "source", label: "Source" },
  { id: "1080", label: "1080" },
  { id: "4k", label: "4K" },
  { id: "8k", label: "8K" },
  { id: "16k", label: "16K" },
] as const;
export type ExportSizeId = (typeof EXPORT_SIZES)[number]["id"];

export const NEUTRAL_MASK: MaskValues = [0, 1, 0.1, 0, 0];
const HISTORY_LIMIT = 150;

export const DEFAULT_TRANSFORM: SourceTransform = { x: 0, y: 0, scale: 1, rotate: 0, flip: false };

interface EditorState {
  media: MediaSource | null;
  layers: Layer[]; // bottom -> top (render order)
  groups: LayerGroup[];
  selectedUid: string | null;
  aspect: AspectId;
  transform: SourceTransform;
  compare: boolean;
  time: number;
  playing: boolean;
  duration: number;
  timelineOpen: boolean;
  exportFormat: ExportFormat;
  exportQuality: number;
  exportSize: ExportSizeId;
  past: Stack[];
  future: Stack[];

  setMedia: (m: MediaSource) => void;
  addLayer: (effectId: string, values?: ParamValues) => void;
  removeLayer: (uid: string) => void;
  duplicateLayer: (uid: string) => void;
  moveLayer: (uid: string, toIndex: number) => void;
  renameLayer: (uid: string, name: string) => void;
  toggleLayer: (uid: string) => void;
  soloLayer: (uid: string) => void;
  select: (uid: string | null) => void;
  setParam: (uid: string, key: string, value: ParamValue) => void;
  setLayerProps: (uid: string, props: Partial<Pick<Layer, "opacity" | "blend" | "seed" | "pre" | "mask">>) => void;
  resetLayer: (uid: string) => void;
  randomizeLayer: (uid: string) => void;
  toggleKeyframeTrack: (uid: string, key: string) => void;
  removeKeyframe: (uid: string, key: string, t: number) => void;
  moveKeyframe: (uid: string, key: string, from: number, to: number) => void;
  setKeyframeEase: (uid: string, key: string, t: number, e: Easing) => void;
  setModulator: (uid: string, key: string, mod: Modulator | null) => void;
  toggleGroup: (id: string) => void;
  collapseGroup: (id: string) => void;
  removeGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  ungroup: (id: string) => void;
  clearLayers: () => void;
  /** "group" adds the snapshot on top as one collapsible group (how presets apply). */
  applySnapshot: (snap: PresetSnapshot, mode?: "replace" | "append" | "group", name?: string) => void;
  snapshot: () => PresetSnapshot;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  set: (patch: Partial<Pick<EditorState,
    "aspect" | "transform" | "compare" | "time" | "playing" | "duration" | "timelineOpen" | "exportFormat" | "exportQuality" | "exportSize">>) => void;
}

const newSeed = () => Math.round(Math.random() * 1000) / 10;

function makeLayer(effectId: string, values?: ParamValues): Layer | null {
  const effect = getEffect(effectId);
  if (!effect) return null;
  return {
    uid: uid(),
    effectId: effect.id,
    name: effect.name,
    enabled: true,
    values: { ...defaultValues(effect), ...(values ?? {}) },
    opacity: 1,
    blend: 0,
    seed: newSeed(),
    pre: null,
    mask: null,
    keyframes: {},
    mods: {},
  };
}

const asPre = (v: unknown): PreValues | null => (Array.isArray(v) && v.length === 9 && v.every((n) => typeof n === "number") ? (v as PreValues) : null);
const asMask = (v: unknown): MaskValues | null => (Array.isArray(v) && v.length === 5 && v.every((n) => typeof n === "number") ? (v as MaskValues) : null);

export const useEditor = create<EditorState>((set, get) => {
  /** Apply a layers mutation and record the previous stack for undo. Empty groups are dropped. */
  const commit = (fn: (layers: Layer[]) => Layer[], extra: Partial<EditorState> = {}) => {
    const { layers, groups, past } = get();
    const next = fn(layers);
    const used = new Set(next.map((l) => l.group).filter(Boolean));
    const nextGroups = (extra.groups ?? groups).filter((g) => used.has(g.id));
    set({ ...extra, layers: next, groups: nextGroups, past: [...past, { layers, groups }].slice(-HISTORY_LIMIT), future: [] });
  };
  const mapLayer = (uid: string, fn: (l: Layer) => Layer) => (layers: Layer[]) => layers.map((l) => (l.uid === uid ? fn(l) : l));
  const mapGroup = (id: string, fn: (g: LayerGroup) => LayerGroup) => get().groups.map((g) => (g.id === id ? fn(g) : g));

  return {
    media: null,
    layers: [],
    groups: [],
    selectedUid: null,
    aspect: "original",
    transform: DEFAULT_TRANSFORM,
    compare: false,
    time: 0,
    playing: false,
    duration: 5,
    timelineOpen: false,
    exportFormat: "png",
    exportQuality: 0.92,
    exportSize: "source",
    past: [],
    future: [],

    setMedia: (m) => {
      const prev = get().media;
      if (prev && prev.url !== m.url && prev.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      set({
        media: m,
        time: 0,
        playing: m.kind === "video",
        duration: m.kind === "video" ? m.duration : get().duration,
        exportFormat: m.kind === "video" ? "video" : get().exportFormat === "video" ? "png" : get().exportFormat,
      });
    },

    // Effects always land on top of the stack, outside any preset group.
    addLayer: (effectId, values) => {
      const layer = makeLayer(effectId, values);
      if (!layer) return;
      const extra = getEffect(layer.effectId)?.onParam?.("", layer.values, get().media?.element);
      if (extra) layer.values = { ...layer.values, ...extra };
      commit((ls) => [...ls, layer], { selectedUid: layer.uid });
    },

    removeLayer: (id) => {
      const { layers, selectedUid } = get();
      const idx = layers.findIndex((l) => l.uid === id);
      const rest = layers.filter((l) => l.uid !== id);
      const nextSel = selectedUid === id ? rest[Math.min(idx, rest.length - 1)]?.uid ?? null : selectedUid;
      commit(() => rest, { selectedUid: nextSel });
    },

    duplicateLayer: (id) => {
      const { layers } = get();
      const idx = layers.findIndex((l) => l.uid === id);
      if (idx < 0) return;
      const src = layers[idx];
      const copy: Layer = { ...structuredClone(src), uid: uid(), name: `${src.name} copy` };
      commit((ls) => [...ls.slice(0, idx + 1), copy, ...ls.slice(idx + 1)], { selectedUid: copy.uid });
    },

    moveLayer: (id, toIndex) =>
      commit((ls) => {
        const from = ls.findIndex((l) => l.uid === id);
        if (from < 0) return ls;
        const next = ls.slice();
        const [item] = next.splice(from, 1);
        const at = Math.max(0, Math.min(next.length, toIndex));
        // Dropped among a group's layers → joins that group; elsewhere → leaves it.
        const below = next[at - 1];
        const above = next[at];
        const group = below?.group && below.group === above?.group ? below.group : item.group && (below?.group === item.group || above?.group === item.group) ? item.group : undefined;
        next.splice(at, 0, { ...item, group });
        return next;
      }),

    renameLayer: (id, name) => commit(mapLayer(id, (l) => ({ ...l, name: name.trim() || l.name }))),
    toggleLayer: (id) => commit(mapLayer(id, (l) => ({ ...l, enabled: !l.enabled }))),
    soloLayer: (id) => {
      const { layers } = get();
      const soloed = layers.every((l) => (l.uid === id ? l.enabled : !l.enabled));
      commit((ls) => ls.map((l) => ({ ...l, enabled: soloed ? true : l.uid === id })));
    },
    select: (id) => set({ selectedUid: id }),

    // Slider drags call checkpoint() once on pointer-down, so this does not push history.
    // With a keyframe track on the param, edits write a keyframe at the playhead (this is how
    // dragging an on-canvas point while playing records motion).
    setParam: (id, key, value) => {
      const { time } = get();
      set({
        layers: get().layers.map((l) => {
          if (l.uid !== id) return l;
          const track = l.keyframes[key];
          if (track && track.length) return { ...l, keyframes: { ...l.keyframes, [key]: upsertKeyframe(track, time, value) } };
          const values = { ...l.values, [key]: value };
          const extra = getEffect(l.effectId)?.onParam?.(key, values, get().media?.element);
          return { ...l, values: extra ? { ...values, ...extra } : values };
        }),
        future: [],
      });
    },

    setLayerProps: (id, props) => set({ layers: get().layers.map((l) => (l.uid === id ? { ...l, ...props } : l)), future: [] }),

    resetLayer: (id) =>
      commit(mapLayer(id, (l) => {
        const effect = getEffect(l.effectId);
        return effect ? { ...l, values: defaultValues(effect), keyframes: {}, mods: {}, opacity: 1, blend: 0, pre: null, mask: null } : l;
      })),

    randomizeLayer: (id) =>
      commit(mapLayer(id, (l) => {
        const effect = getEffect(l.effectId);
        if (!effect) return l;
        const values: ParamValues = { ...l.values };
        for (const p of effect.params) {
          if (p.type === "range") {
            // Bias toward the default so results stay usable.
            const r = (Math.random() + Math.random()) / 2;
            const v = p.default + (r - 0.5) * (p.max - p.min) * 0.8;
            values[p.key] = Math.round(Math.max(p.min, Math.min(p.max, v)) / p.step) * p.step;
          } else if (p.type === "select") values[p.key] = Math.floor(Math.random() * p.options.length);
          else if (p.type === "color") values[p.key] = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
        }
        return { ...l, values, seed: newSeed() };
      })),

    toggleKeyframeTrack: (id, key) => {
      const { time } = get();
      commit(mapLayer(id, (l) => {
        const track = l.keyframes[key];
        if (track && track.length) {
          const current = resolveValues(l.values, l.keyframes, time)[key];
          const { [key]: _drop, ...rest } = l.keyframes;
          return { ...l, values: { ...l.values, [key]: current }, keyframes: rest };
        }
        return { ...l, keyframes: { ...l.keyframes, [key]: [{ t: time, v: l.values[key] }] } };
      }), { timelineOpen: true });
    },

    removeKeyframe: (id, key, t) =>
      commit(mapLayer(id, (l) => {
        const track = (l.keyframes[key] ?? []).filter((k) => Math.abs(k.t - t) > 1e-4);
        const keyframes = { ...l.keyframes };
        if (track.length) keyframes[key] = track;
        else delete keyframes[key];
        return { ...l, keyframes };
      })),

    moveKeyframe: (id, key, from, to) =>
      set({
        layers: get().layers.map((l) => {
          if (l.uid !== id || !l.keyframes[key]) return l;
          const track = l.keyframes[key].map((k) => (Math.abs(k.t - from) < 1e-4 ? { ...k, t: to } : k)).sort((a, b) => a.t - b.t);
          return { ...l, keyframes: { ...l.keyframes, [key]: track } };
        }),
      }),

    setKeyframeEase: (id, key, t, e) =>
      commit(mapLayer(id, (l) => (l.keyframes[key]
        ? { ...l, keyframes: { ...l.keyframes, [key]: l.keyframes[key].map((k) => (Math.abs(k.t - t) < 1e-4 ? { ...k, e } : k)) } }
        : l))),

    setModulator: (id, key, mod) =>
      commit(mapLayer(id, (l) => {
        const mods = { ...l.mods };
        if (mod) mods[key] = mod;
        else delete mods[key];
        return { ...l, mods };
      }), mod ? { playing: true } : {}),

    toggleGroup: (id) => commit((ls) => ls, { groups: mapGroup(id, (g) => ({ ...g, enabled: !g.enabled })) }),
    collapseGroup: (id) => set({ groups: mapGroup(id, (g) => ({ ...g, collapsed: !g.collapsed })) }),
    renameGroup: (id, name) => commit((ls) => ls, { groups: mapGroup(id, (g) => ({ ...g, name: name.trim() || g.name })) }),
    removeGroup: (id) => {
      const { selectedUid, layers } = get();
      const sel = layers.find((l) => l.uid === selectedUid);
      commit((ls) => ls.filter((l) => l.group !== id), sel?.group === id ? { selectedUid: null } : {});
    },
    ungroup: (id) => commit((ls) => ls.map((l) => (l.group === id ? { ...l, group: undefined } : l))),

    clearLayers: () => commit(() => [], { selectedUid: null, groups: [] }),

    applySnapshot: (snap, mode = "replace", name) => {
      const groupId = mode === "group" ? uid() : undefined;
      const incoming = snap.graph
        .map((g) => {
          const l = makeLayer(g.id, g.values);
          if (!l) return null;
          return {
            ...l,
            enabled: g.isOn ?? true,
            name: g.name ?? l.name,
            opacity: g.opacity ?? 1,
            blend: g.blend ?? 0,
            seed: g.seed ?? l.seed,
            pre: asPre(g.pre),
            mask: asMask(g.mask),
            keyframes: g.keyframes ?? {},
            mods: (g.mods as Modulators) ?? {},
            group: groupId ?? (mode === "replace" ? g.group : undefined),
          } satisfies Layer;
        })
        .filter((l): l is NonNullable<typeof l> => !!l);
      if (!incoming.length) return;
      if (groupId) {
        const group: LayerGroup = { id: groupId, name: name ?? "Preset", enabled: true, collapsed: true };
        commit((ls) => [...ls, ...incoming], { groups: [...get().groups, group], selectedUid: incoming[incoming.length - 1].uid });
        return;
      }
      const layers = mode === "append" ? [...get().layers, ...incoming] : incoming;
      const groups = mode === "replace" ? (snap.groups ?? []).map((g) => ({ ...g })) : get().groups;
      commit(() => layers, { groups, selectedUid: layers[layers.length - 1]?.uid ?? null });
    },

    snapshot: () => ({
      version: 1,
      graph: get().layers.map((l) => ({
        id: l.effectId,
        isOn: l.enabled,
        name: l.name,
        values: l.values,
        opacity: l.opacity,
        blend: l.blend,
        seed: l.seed,
        ...(l.pre ? { pre: [...l.pre] } : {}),
        ...(l.mask ? { mask: [...l.mask] } : {}),
        ...(Object.keys(l.keyframes).length ? { keyframes: l.keyframes } : {}),
        ...(Object.keys(l.mods).length ? { mods: l.mods } : {}),
        ...(l.group ? { group: l.group } : {}),
      })),
      ...(get().groups.length ? { groups: get().groups } : {}),
    }),

    checkpoint: () => {
      const { layers, groups, past } = get();
      if (past[past.length - 1]?.layers === layers) return;
      set({ past: [...past, { layers, groups }].slice(-HISTORY_LIMIT), future: [] });
    },

    undo: () => {
      const { past, layers, groups, future } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({ ...prev, past: past.slice(0, -1), future: [{ layers, groups }, ...future] });
    },

    redo: () => {
      const { past, layers, groups, future } = get();
      if (!future.length) return;
      set({ ...future[0], past: [...past, { layers, groups }], future: future.slice(1) });
    },

    set: (patch) => set(patch),
  };
});

/**
 * Layers ready for the renderer at time t (disabled/unknown layers and hidden groups skipped).
 * `loop` is the animation length, so modulators complete whole cycles and exports loop cleanly.
 */
export function toRenderLayers(layers: Layer[], t: number, groups: LayerGroup[] = [], loop = 5): RenderLayer[] {
  const out: RenderLayer[] = [];
  const off = new Set(groups.filter((g) => !g.enabled).map((g) => g.id));
  for (const l of layers) {
    if (!l.enabled || (l.group && off.has(l.group))) continue;
    const effect = getEffect(l.effectId);
    if (!effect) continue;
    out.push({
      id: l.uid,
      effect,
      values: applyModulators(effect, resolveValues(l.values, l.keyframes, t), l.mods ?? {}, t, loop),
      opacity: l.opacity,
      blend: l.blend,
      seed: l.seed,
      pre: l.pre,
      mask: l.mask,
    });
  }
  return out;
}

/** Keyframes or modulators: values change over the timeline. */
export function layerHasMotion(l: Layer): boolean {
  return Object.keys(l.keyframes).length > 0 || Object.keys(l.mods ?? {}).length > 0;
}

export function stackIsAnimated(layers: Layer[]): boolean {
  return layers.some((l) => {
    if (!l.enabled) return false;
    const e = getEffect(l.effectId);
    return !!e && (effectAnimates(e, l.values) || layerHasMotion(l));
  });
}

export function stackHasKeyframes(layers: Layer[]): boolean {
  return layers.some(layerHasMotion);
}

export const neutralPre = (): PreValues => [...NEUTRAL_PRE] as PreValues;

/** Crop rectangle (GL texture space, y up) for an aspect ratio, centered. */
export function cropFor(media: { width: number; height: number }, aspect: AspectId): { crop: [number, number, number, number]; width: number; height: number } {
  const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? 0;
  const srcRatio = media.width / media.height;
  if (!ratio || Math.abs(ratio - srcRatio) < 1e-3) return { crop: [0, 0, 1, 1], width: media.width, height: media.height };
  if (ratio > srcRatio) {
    const h = srcRatio / ratio;
    return { crop: [0, (1 - h) / 2, 1, (1 + h) / 2], width: media.width, height: Math.round(media.height * h) };
  }
  const w = ratio / srcRatio;
  return { crop: [(1 - w) / 2, 0, (1 + w) / 2, 1], width: Math.round(media.width * w), height: media.height };
}
