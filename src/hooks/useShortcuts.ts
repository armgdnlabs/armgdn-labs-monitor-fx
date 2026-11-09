import { useEffect } from "react";
import { useEditor } from "../state/editor";
import { usePrefs, useUI } from "../state/ui";
import { useView } from "../state/view";
import { openFilePicker, shuffleSource } from "../lib/source";

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

export const SHORTCUTS: [string, string][] = [
  ["O", "Open media"],
  ["S", "Shuffle source photo"],
  ["E", "Export"],
  ["⌘/Ctrl Z", "Undo"],
  ["⇧ ⌘/Ctrl Z", "Redo"],
  ["D", "Duplicate layer"],
  ["Del / ⌫", "Remove layer"],
  ["H", "Hide / show layer"],
  ["R", "Randomise layer"],
  ["\\ (hold)", "Compare with original"],
  ["Space", "Play / pause"],
  ["F", "Fit artboard"],
  ["1", "Zoom 100%"],
  ["+ / −", "Zoom in / out"],
  ["Wheel", "Pan artboard"],
  ["Ctrl/⌘/Alt + wheel, pinch", "Zoom artboard at cursor"],
  ["Space/middle drag", "Pan artboard"],
  ["L", "Toggle library"],
  ["B", "Open library browser"],
  ["T", "Toggle light / dark"],
  ["?", "Shortcuts"],
];

export function useShortcuts() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const ui = useUI.getState();
      if (ui.modal) return;
      const ed = useEditor.getState();
      const view = useView.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      // Keep browser page-zoom shortcuts on the artboard instead.
      if (mod && (k === "=" || k === "+")) { e.preventDefault(); view.zoomBy(1.25); return; }
      if (mod && (k === "-" || k === "_")) { e.preventDefault(); view.zoomBy(0.8); return; }
      if (mod && k === "0") { e.preventDefault(); view.reset(); return; }
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) ed.redo(); else ed.undo(); return; }
      if (mod && k === "y") { e.preventDefault(); ed.redo(); return; }
      if (mod && k === "o") { e.preventDefault(); openFilePicker(); return; }
      if (mod && k === "d" && ed.selectedUid) { e.preventDefault(); ed.duplicateLayer(ed.selectedUid); return; }
      if (mod || e.altKey) return;
      if (e.key === "Escape" && ui.browserOpen) { ui.setBrowser(false); return; }
      if ((k === "delete" || k === "backspace") && ed.selectedUid) { e.preventDefault(); ed.removeLayer(ed.selectedUid); return; }
      if (k === "h" && ed.selectedUid) { ed.toggleLayer(ed.selectedUid); return; }
      if (k === "d" && ed.selectedUid) { ed.duplicateLayer(ed.selectedUid); return; }
      if (k === "r" && ed.selectedUid) { ed.randomizeLayer(ed.selectedUid); return; }
      if (k === "o") { openFilePicker(); return; }
      if (k === "s") { void shuffleSource(); return; }
      if (k === "e") { ui.open({ type: "export" }); return; }
      if (k === "f") { view.reset(); return; }
      if (k === "1") { view.set({ fit: false, zoom: 1, panX: 0, panY: 0 }); return; }
      if (k === "=" || k === "+") { view.zoomBy(1.25); return; }
      if (k === "-") { view.zoomBy(0.8); return; }
      if (k === "l") { const p = usePrefs.getState(); p.set({ libraryCollapsed: !p.libraryCollapsed }); return; }
      if (k === "b") { ui.setBrowser(!ui.browserOpen); return; }
      if (k === "t") { const p = usePrefs.getState(); p.set({ theme: p.theme === "dark" ? "light" : "dark" }); return; }
      if (k === "\\") { ed.set({ compare: true }); return; }
      if (k === " ") { e.preventDefault(); ed.set({ playing: !ed.playing }); return; }
      if (e.key === "?") ui.open({ type: "shortcuts" });
    };
    const up = (e: KeyboardEvent) => { if (e.key === "\\") useEditor.getState().set({ compare: false }); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
}
