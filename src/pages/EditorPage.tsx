import { useEffect, useRef, useState } from "react";
import { LibraryBrowser, LibraryPanel } from "../components/LibraryPanel";
import { LayersPanel } from "../components/LayersPanel";
import { Inspector } from "../components/Inspector";
import { Viewport } from "../components/Viewport";
import { Transport } from "../components/Timeline";
import { useEditor } from "../state/editor";
import { usePrefs, useUI } from "../state/ui";
import { getEffect } from "../effects/registry";
import { presetById } from "../effects/presets";
import { decodeShare } from "../services/api";
import { initialParams } from "../hooks/useHashRoute";
import { useShortcuts } from "../hooks/useShortcuts";
import { bootSource } from "../lib/source";

type MobileTab = "library" | "layers" | "params";

/** Vertical/horizontal drag handle that reports pixel deltas. */
function Splitter({ dir, onStart, onDrag, onDouble }: { dir: "x" | "y"; onStart: () => void; onDrag: (delta: number) => void; onDouble?: () => void }) {
  return (
    <div
      role="separator"
      aria-orientation={dir === "x" ? "vertical" : "horizontal"}
      className={`shrink-0 relative z-10 group ${dir === "x" ? "w-1 -mx-0.5 cursor-col-resize" : "h-1 -my-0.5 cursor-row-resize"}`}
      onDoubleClick={onDouble}
      onPointerDown={(e) => {
        e.preventDefault();
        onStart();
        const start = dir === "x" ? e.clientX : e.clientY;
        let raf = 0;
        const move = (ev: PointerEvent) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => onDrag((dir === "x" ? ev.clientX : ev.clientY) - start)); };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; };
        document.body.style.cursor = dir === "x" ? "col-resize" : "row-resize";
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      <div className={`absolute bg-fg opacity-0 group-hover:opacity-60 ${dir === "x" ? "inset-y-0 left-1/2 w-px" : "inset-x-0 top-1/2 h-px"}`} />
    </div>
  );
}

export function EditorPage() {
  const [tab, setTab] = useState<MobileTab>("library");
  const prefs = usePrefs();
  const booted = useRef(false);
  const startW = useRef(prefs.libraryWidth);
  const startH = useRef(prefs.layersHeight);
  useShortcuts();

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const ed = useEditor.getState();
    const params = initialParams();
    if (!ed.media) void bootSource(params.get("photo"));
    const share = params.get("p");
    const effect = params.get("effect");
    const preset = params.get("preset");
    if (share) {
      const snap = decodeShare(share);
      if (snap) { ed.applySnapshot(snap); useUI.getState().toast("> LOADED SHARED STACK"); }
      else useUI.getState().toast("> THAT SHARE LINK IS INVALID", "error");
    } else if (preset && presetById.get(preset)) {
      const pr = presetById.get(preset)!;
      ed.applySnapshot(pr.snapshot, "group", pr.name);
    } else if (effect && getEffect(effect)) {
      ed.addLayer(effect);
    }
    // Links are one-shot: once applied, clear them so a reload starts clean (no layers).
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const isMobile = useIsMobile();
  const show = (t: MobileTab) => (tab === t ? "flex" : "hidden");
  const libW = Math.min(640, Math.max(260, prefs.libraryWidth));

  return (
    <>
      {/* Desktop: library+layers column | canvas | params */}
      {!isMobile && <main className="flex flex-1 min-h-0">
        <aside className="flex flex-col min-h-0 border-r border-line shrink-0" style={{ width: libW }}>
          <div className="flex flex-col min-h-0" style={prefs.libraryCollapsed ? { flex: 1 } : { height: Math.min(Math.max(prefs.layersHeight, 120), 600) }}>
            <LayersPanel />
          </div>
          {!prefs.libraryCollapsed && (
            <Splitter
              dir="y"
              onStart={() => { startH.current = usePrefs.getState().layersHeight; }}
              onDrag={(d) => prefs.set({ layersHeight: Math.max(120, Math.min(600, startH.current + d)) })}
            />
          )}
          <div className={`flex flex-col min-h-0 border-t border-line ${prefs.libraryCollapsed ? "" : "flex-1"}`}>
            <LibraryPanel />
          </div>
        </aside>
        <Splitter
          dir="x"
          onDouble={() => prefs.set({ libraryWidth: 340 })}
          onStart={() => { startW.current = usePrefs.getState().libraryWidth; }}
          onDrag={(d) => prefs.set({ libraryWidth: Math.max(260, Math.min(640, startW.current + d)) })}
        />
        <section className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0"><Viewport /></div>
          <Transport />
        </section>
        <aside className="w-[300px] xl:w-[320px] shrink-0 border-l border-line flex flex-col min-h-0"><Inspector /></aside>
      </main>}

      {/* Phone / small tablet: canvas on top, tabbed panels below (view & export first). */}
      {isMobile && <main className="flex-1 min-h-0 flex flex-col">
        <section className="h-[50vh] shrink-0 flex flex-col">
          <div className="flex-1 min-h-0"><Viewport /></div>
        </section>
        <nav className="grid grid-cols-3 hair-b hair-t shrink-0">
          {(["library", "layers", "params"] as const).map((t) => (
            <button key={t} className={`tab h-9 ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div className={`${show("library")} flex-col flex-1 min-h-0`}><LibraryPanel /></div>
        <div className={`${show("layers")} flex-col flex-1 min-h-0`}><LayersPanel /></div>
        <div className={`${show("params")} flex-col flex-1 min-h-0`}><Inspector /></div>
      </main>}
      <LibraryBrowser />
    </>
  );
}

/** Only one layout (and so one WebGL context) is mounted at a time. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return isMobile;
}
