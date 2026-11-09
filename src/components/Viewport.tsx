import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Renderer } from "../engine/Renderer";
import { getEffect } from "../effects/registry";
import { cropFor, stackIsAnimated, toRenderLayers, useEditor } from "../state/editor";
import { usePrefs, useUI } from "../state/ui";
import { useView } from "../state/view";
import { sourceFromFile } from "../lib/source";
import { onAuxImageLoad } from "../lib/textures";
import { Symbol } from "../brand/Marks";
import { ArtboardBar } from "./Toolbar";

const PREVIEW_MAX = 2560;
const MARGIN = 28;
/** Room kept free under the artboard for the floating bar. */
const BAR_SPACE = 52;

export function Viewport() {
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const dirty = useRef(true);
  const renderView = useRef<{ crop: [number, number, number, number]; w: number; h: number } | null>(null);
  const spaceDown = useRef(false);
  const [glError, setGlError] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const [dragOver, setDragOver] = useState(false);
  const [panning, setPanning] = useState(false);
  const media = useEditor((s) => s.media);
  const aspect = useEditor((s) => s.aspect);
  const view = useView();
  const quality = usePrefs((s) => s.previewQuality);

  // ── Renderer lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const r = new Renderer(canvasRef.current!);
      r.onShaderError = (e) => useUI.getState().toast(`> SHADER ERROR — "${getEffect(e.effectId)?.name ?? e.effectId}" can't compile on this GPU; skipped`, "error");
      rendererRef.current = r;
      const dbg = r.gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = dbg ? String(r.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "WebGL2";
      useView.getState().set({ gpu: gpu.replace(/ANGLE \(|\)|Direct3D11|vs_5_0 ps_5_0|,\s*D3D11/g, "").split(",").slice(0, 2).join(" ").trim() });
      dirty.current = true;
    } catch (e) {
      setGlError((e as Error).message);
    }
    return () => { rendererRef.current?.dispose(false); rendererRef.current = null; };
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current!;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (!media) return;
    if (r) { r.setSource(media.element, media.width, media.height); r.trimPool(); r.resetFeedback(); }
    dirty.current = true;
    if (media.kind === "video") {
      const v = media.element as HTMLVideoElement;
      v.currentTime = 0;
      v.play().catch(() => useEditor.getState().set({ playing: false }));
      return () => v.pause();
    }
  }, [media]);

  useEffect(() => onAuxImageLoad(() => { dirty.current = true; }), []);
  useEffect(() => usePrefs.subscribe(() => { dirty.current = true; }), []);

  // ── Sizes ─────────────────────────────────────────────────────────────
  const crop = media ? cropFor(media, aspect) : null;
  let scale = 1;
  if (crop) {
    const fitScale = Math.max(0.02, Math.min((box.w - MARGIN * 2) / crop.width, (box.h - MARGIN * 2 - BAR_SPACE) / crop.height));
    scale = view.fit ? fitScale : view.zoom;
    const dpr = window.devicePixelRatio || 1;
    const long = Math.max(crop.width, crop.height);
    const rs = Math.min(1, Math.max(scale * dpr * quality, 480 / long), (PREVIEW_MAX * quality) / long);
    renderView.current = { crop: crop.crop, w: Math.round(crop.width * rs), h: Math.round(crop.height * rs) };
  }
  const cssW = crop ? crop.width * scale : 0;
  const cssH = crop ? crop.height * scale : 0;
  useEffect(() => { if (view.fit && crop) useView.getState().set({ zoom: scale }); }, [view.fit, scale, crop?.width]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { dirty.current = true; }, [cssW, cssH, aspect, quality]);

  // ── Render loop: redraw on change, continuously while anything moves ──
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastVideoTime = -1;
    let frames = 0;
    let fpsT = performance.now();
    const clockStart = performance.now();
    const unsub = useEditor.subscribe(() => { dirty.current = true; });
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const r = rendererRef.current;
      const rv = renderView.current;
      const st = useEditor.getState();
      const m = st.media;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (now - fpsT > 500) { useView.getState().set({ fps: Math.round((frames * 1000) / (now - fpsT)) }); frames = 0; fpsT = now; }
      if (!r || !m || !rv || !r.hasSource) return;
      if (r.isLost) { setGlError("The GPU context was lost. Reload the page to continue."); return; }

      let t = st.time;
      if (m.kind === "video") {
        const v = m.element as HTMLVideoElement;
        if (st.playing && v.paused) v.play().catch(() => {});
        if (!st.playing && !v.paused) v.pause();
        if (v.currentTime !== lastVideoTime) {
          lastVideoTime = v.currentTime;
          r.setSource(v, m.width, m.height);
          t = v.currentTime;
          useEditor.setState({ time: t });
          dirty.current = true;
        }
      } else if (st.playing) {
        t = (st.time + dt) % Math.max(st.duration, 0.1);
        useEditor.setState({ time: t });
      }

      const live = stackIsAnimated(st.layers);
      if (!dirty.current && !live) return;
      dirty.current = false;
      const fxTime = st.timelineOpen || m.kind === "video" ? t : (now - clockStart) / 1000;
      const t0 = performance.now();
      r.render(toRenderLayers(st.layers, t, st.groups, st.duration), { width: rv.w, height: rv.h, crop: rv.crop, time: fxTime, bypass: st.compare, transform: st.transform });
      frames++;
      const v = useView.getState();
      const ms = performance.now() - t0;
      if (Math.abs(v.renderMs - ms) > 0.5 || v.workW !== rv.w) v.set({ renderMs: ms, workW: rv.w, workH: rv.h });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); unsub(); };
  }, []);

  // ── Artboard navigation: wheel, pinch, keyboard-free pan ─────────────
  useEffect(() => {
    const stage = stageRef.current!;
    const anchorOf = (e: { clientX: number; clientY: number }) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 + BAR_SPACE / 2 };
    };
    const onWheel = (e: WheelEvent) => {
      // Never let the page scroll or zoom from the artboard.
      e.preventDefault();
      const v = useView.getState();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels send ~100.
        const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        v.zoomBy(Math.exp(-d * (Math.abs(d) < 50 ? 0.01 : 0.0025)), anchorOf(e));
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        v.set({ fit: false, panX: v.panX - dx, panY: v.panY - dy });
      }
    };
    // Safari pinch gestures.
    let gScale = 1;
    const gStart = (e: Event) => { e.preventDefault(); gScale = 1; };
    const gChange = (e: Event) => {
      e.preventDefault();
      const s = (e as unknown as { scale: number }).scale;
      useView.getState().zoomBy(s / gScale, anchorOf(e as unknown as MouseEvent));
      gScale = s;
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("gesturestart", gStart);
    stage.addEventListener("gesturechange", gChange);
    // Outside the artboard, Ctrl+wheel must still never zoom the whole page.
    const block = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    window.addEventListener("wheel", block, { passive: false });
    const kd = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target as HTMLElement).matches("input,textarea,select")) spaceDown.current = true; };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") spaceDown.current = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("gesturestart", gStart);
      stage.removeEventListener("gesturechange", gChange);
      window.removeEventListener("wheel", block);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  const onStagePointerDown = (e: React.PointerEvent) => {
    const panGesture = e.button === 1 || (e.button === 0 && (spaceDown.current || e.altKey || e.target === e.currentTarget));
    if (!panGesture) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const { panX, panY } = useView.getState();
    setPanning(true);
    const move = (ev: PointerEvent) => useView.getState().set({ fit: false, panX: panX + ev.clientX - startX, panY: panY + ev.clientY - startY });
    const up = () => { setPanning(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Drop & paste ──────────────────────────────────────────────────────
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => /^(image|video)\//.test(f.type));
      if (file) { e.preventDefault(); void sourceFromFile(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const pixelated = scale * (window.devicePixelRatio || 1) > 2.2;

  return (
    <div
      ref={stageRef}
      className={`relative h-full w-full min-h-0 overflow-hidden checker select-none ${panning ? "cursor-grabbing" : spaceDown.current ? "cursor-grab" : ""}`}
      onPointerDown={onStagePointerDown}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && /^(image|video)\//.test(f.type)) void sourceFromFile(f);
        else useUI.getState().toast("> DROP AN IMAGE OR VIDEO FILE", "error");
      }}
    >
      {/* One canvas for the renderer's whole life; hidden until media arrives. */}
      {(
        <div
          ref={boardRef}
          data-artboard
          className={`absolute ticks ${media ? "" : "hidden"}`}
          style={{ width: cssW, height: cssH, left: `calc(50% - ${cssW / 2}px + ${view.fit ? 0 : view.panX}px)`, top: `calc(50% - ${cssH / 2 + BAR_SPACE / 2}px + ${view.fit ? 0 : view.panY}px)` }}
        >
          <canvas ref={canvasRef} className="block w-full h-full" style={{ imageRendering: pixelated ? "pixelated" : "auto" }} />
          <span className="tick tl" /><span className="tick tr" /><span className="tick bl" /><span className="tick br" />
          <Handles />
        </div>
      )}

      {!media && !glError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 grain-surface" style={{ color: "var(--scr-ink)" }}>
          <Symbol className="h-16" />
          <p className="text-[12px] caps">Drop media or press <span className="kbd">O</span></p>
          <p className="font-serif text-[13px] tracking-[0.4em] uppercase opacity-70">The Chaos to Create</p>
        </div>
      )}
      {glError && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="panel p-5 max-w-sm" style={{ background: "rgb(var(--bg))" }}>
            <p className="ph slash px-0 text-signal">Rendering unavailable</p>
            <p className="text-[12px] text-fg-2">{glError} MONITOR needs WebGL 2 (Safari 15+, Chrome, Edge, Firefox, Arc).</p>
          </div>
        </div>
      )}
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 border border-dashed border-fg flex items-center justify-center bg-void/40">
          <span className="caps text-bone">&gt; DROP TO LOAD MEDIA</span>
        </div>
      )}
      {media && <ArtboardBar />}
    </div>
  );
}

/** Draggable on-canvas points for the selected layer (focus, centre, text position…). */
function Handles() {
  const layer = useEditor((s) => s.layers.find((l) => l.uid === s.selectedUid));
  const setParam = useEditor((s) => s.setParam);
  const checkpoint = useEditor((s) => s.checkpoint);
  const effect = layer ? getEffect(layer.effectId) : undefined;
  if (!layer || !effect?.handles || !layer.enabled) return null;
  return (
    <>
      {effect.handles.map((h) => {
        const x = Number(layer.values[h.x] ?? 0.5);
        const y = Number(layer.values[h.y] ?? 0.5);
        const onDown = (e: React.PointerEvent) => {
          e.stopPropagation();
          e.preventDefault();
          checkpoint();
          const board = (e.currentTarget as HTMLElement).parentElement!;
          const move = (ev: PointerEvent) => {
            const r = board.getBoundingClientRect();
            setParam(layer.uid, h.x, Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)));
            setParam(layer.uid, h.y, Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / r.height)));
          };
          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };
        return (
          <div
            key={h.x}
            onPointerDown={onDown}
            title={`${h.label ?? "Point"} — drag`}
            className="absolute w-5 h-5 -ml-2.5 -mt-2.5 cursor-move flex items-center justify-center"
            style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
          >
            <span className="absolute inset-0 border border-bone mix-blend-difference" />
            <span className="w-1 h-1 bg-signal" />
            <span className="absolute left-6 top-0 text-[9px] caps whitespace-nowrap text-bone mix-blend-difference">{h.label}</span>
          </div>
        );
      })}
    </>
  );
}
