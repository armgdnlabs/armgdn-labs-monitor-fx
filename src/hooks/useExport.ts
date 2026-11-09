import { useCallback, useRef, useState } from "react";
import { create } from "zustand";
import { exportStill, exportVideo, pickVideoMime } from "../engine/export";
import { stackIsAnimated, useEditor } from "../state/editor";
import { useUI } from "../state/ui";
import { downloadBlob } from "../lib/media";
import { trackEvent } from "../services/api";

export interface ExportProgress {
  label: string;
  fraction: number;
}

/** Shared so the app bar, status bar and export dialog all see the same job. */
export const useExportJob = create<{ progress: ExportProgress | null; set: (p: ExportProgress | null) => void }>((set) => ({
  progress: null,
  set: (progress) => set({ progress }),
}));

const mb = (b: Blob) => `${(b.size / 1048576).toFixed(1)}MB`;

export function useExport() {
  const progress = useExportJob((s) => s.progress);
  const abort = useRef<AbortController | null>(null);
  const [, setTick] = useState(0);

  const run = useCallback(async () => {
    const ed = useEditor.getState();
    const ui = useUI.getState();
    const setProgress = useExportJob.getState().set;
    if (!ed.media || useExportJob.getState().progress) return;
    try {
      if (ed.exportFormat === "video") {
        if (!pickVideoMime()) { ui.toast("> THIS BROWSER CAN'T RECORD VIDEO — try Chrome, Edge, Firefox or Safari 14.1+", "error"); return; }
        const fromStill = ed.media.kind === "image";
        const seconds = fromStill ? ed.duration : ed.media.duration;
        if (fromStill && !stackIsAnimated(ed.layers)) ui.toast("> NOTHING MOVES YET — add an animated effect or keyframes");
        abort.current = new AbortController();
        setTick((n) => n + 1);
        setProgress({ label: "REC", fraction: 0 });
        const wasPlaying = ed.playing;
        ed.set({ playing: false });
        const res = await exportVideo({
          media: ed.media, layers: ed.layers, aspect: ed.aspect, transform: ed.transform, seconds, size: ed.exportSize,
          groups: ed.groups, loop: ed.duration,
          signal: abort.current.signal,
          onProgress: (fraction) => setProgress({ label: "REC", fraction }),
        });
        downloadBlob(res.blob, res.filename);
        ed.set({ playing: wasPlaying });
        ui.toast(`> EXPORT COMPLETE — ${res.filename} (${mb(res.blob)})`, "success");
        trackEvent("export_video", { seconds, w: res.plan.width, h: res.plan.height });
      } else {
        setProgress({ label: "RENDER", fraction: 0.5 });
        const res = await exportStill({
          media: ed.media, layers: ed.layers, aspect: ed.aspect, transform: ed.transform, time: ed.time, format: ed.exportFormat,
          quality: ed.exportQuality, size: ed.exportSize, groups: ed.groups, loop: ed.duration,
        });
        downloadBlob(res.blob, res.filename);
        const tail = res.plan.limitedByGpu ? " — capped at your GPU's max texture size" : "";
        ui.toast(`> EXPORT COMPLETE — ${res.filename} ${res.plan.width}×${res.plan.height} (${mb(res.blob)})${tail}`, "success");
        trackEvent("export_image", { w: res.plan.width, h: res.plan.height, format: ed.exportFormat });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") ui.toast(`> EXPORT FAILED — ${(e as Error).message}`, "error");
      else ui.toast("> EXPORT CANCELLED");
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }, []);

  const cancel = useCallback(() => abort.current?.abort(), []);
  return { run, cancel, progress };
}
