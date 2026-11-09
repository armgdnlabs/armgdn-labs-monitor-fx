import { useRef } from "react";
import { getEffect } from "../effects/registry";
import { layerHasMotion, stackIsAnimated, useEditor } from "../state/editor";
import { EASINGS, wave } from "../lib/keyframes";
import { useView } from "../state/view";
import { useExportJob } from "../hooks/useExport";
import { Icon } from "./ui/Icon";

const FPS = 24;
const timecode = (t: number) => {
  const f = Math.floor((t % 1) * FPS);
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return [h, m, s, f].map((n) => String(n).padStart(2, "0")).join(":");
};

/** Transport (▶ ❚❚ ⟲, VT323 timecode, scrubber) with keyframe lanes when the timeline is open. */
export function Transport() {
  const time = useEditor((s) => s.time);
  const playing = useEditor((s) => s.playing);
  const duration = useEditor((s) => s.duration);
  const media = useEditor((s) => s.media);
  const open = useEditor((s) => s.timelineOpen);
  const layers = useEditor((s) => s.layers);
  const ed = useEditor.getState();
  const track = useRef<HTMLDivElement>(null);
  const total = media?.kind === "video" ? media.duration : duration;

  const seek = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * total;
    if (media?.kind === "video") (media.element as HTMLVideoElement).currentTime = t;
    ed.set({ time: t });
  };
  const animated = layers.filter(layerHasMotion);

  return (
    <div className="hair-t shrink-0" data-screen-scope>
      <div className="flex items-center gap-2 h-9 px-2">
        <button className="icon-btn" title="Play / pause [Space]" onClick={() => ed.set({ playing: !playing })}><Icon name={playing ? "pause" : "play"} /></button>
        <button className="icon-btn" title="Restart" onClick={() => { ed.set({ time: 0 }); if (media?.kind === "video") (media.element as HTMLVideoElement).currentTime = 0; }}><Icon name="restart" /></button>
        <span className="screen-readout px-1.5 py-0.5 tabular-nums" style={{ background: "var(--scr-bg)" }}>{timecode(time)}</span>
        <div
          ref={track}
          className="relative flex-1 h-6 cursor-pointer touch-none"
          onPointerDown={(e) => {
            seek(e.clientX);
            const move = (ev: PointerEvent) => seek(ev.clientX);
            const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <div className="absolute left-0 right-0 top-1/2 h-px bg-line" />
          {Array.from({ length: 11 }, (_, i) => <div key={i} className="absolute top-1/2 w-px h-1.5 bg-line" style={{ left: `${i * 10}%` }} />)}
          <div className="absolute top-1/2 h-px bg-fg" style={{ width: `${(time / Math.max(total, 0.01)) * 100}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-signal" style={{ left: `${(time / Math.max(total, 0.01)) * 100}%` }} />
        </div>
        <span className="screen-readout px-1.5 py-0.5 hidden sm:inline" style={{ background: "var(--scr-bg)" }}>{timecode(total)}</span>
        {media?.kind !== "video" && (
          <label className="flex items-center gap-1 text-[10px] caps text-fg-muted" title="Loop length for animation and video export">
            LEN
            <input type="number" min={1} max={600} step={0.5} className="field h-6 w-14 text-[11px]" value={duration} onChange={(e) => ed.set({ duration: Math.max(0.5, Math.min(600, Number(e.target.value) || 5)) })} />s
          </label>
        )}
        <button className={`icon-btn ${open ? "on" : ""}`} title="Animation lanes" onClick={() => ed.set({ timelineOpen: !open })}><Icon name="diamond" /></button>
      </div>
      {open && (
        <div className="max-h-40 overflow-y-auto hair-t">
          {!animated.length && <p className="px-3 py-2 text-[10px] caps text-fg-muted">&gt; Nothing animated yet. Hover a slider: ◆ adds keyframes at the playhead, ~ loops it with a wave.</p>}
          {animated.flatMap((l) => Object.entries(l.keyframes).map(([k, kfs]) => {
            const p = getEffect(l.effectId)?.params.find((x) => x.key === k);
            return (
              <div key={`${l.uid}-${k}`} className="flex items-center h-6 hair-b">
                <span className="w-40 shrink-0 px-2 text-[10px] caps truncate text-fg-2">{l.name} · {p?.label ?? k}</span>
                <div className="relative flex-1 h-full">
                  {kfs.map((kf) => (
                    <button
                      key={kf.t}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-signal hover:text-fg touch-none"
                      style={{ left: `${(kf.t / Math.max(total, 0.01)) * 100}%` }}
                      title={`t=${kf.t.toFixed(2)}s · ease: ${kf.e ?? "smooth"}
click: jump · drag: move · right-click: change easing · alt-click: delete`}
                      onPointerDown={(e) => {
                        if (e.button !== 0 || e.altKey) return;
                        const lane = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                        let cur = kf.t;
                        let moved = false;
                        ed.checkpoint();
                        const move = (ev: PointerEvent) => {
                          const t = Math.min(1, Math.max(0, (ev.clientX - lane.left) / lane.width)) * total;
                          if (Math.abs(ev.clientX - e.clientX) > 3) moved = true;
                          if (moved) { ed.moveKeyframe(l.uid, k, cur, t); cur = t; }
                        };
                        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (!moved) ed.set({ time: kf.t }); };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }}
                      onClick={(e) => { if (e.altKey) ed.removeKeyframe(l.uid, k, kf.t); }}
                      onContextMenu={(e) => { e.preventDefault(); ed.setKeyframeEase(l.uid, k, kf.t, EASINGS[(EASINGS.indexOf(kf.e ?? "smooth") + 1) % EASINGS.length]); }}
                    ><Icon name="diamond" /></button>
                  ))}
                </div>
              </div>
            );
          }))}
          {animated.flatMap((l) => Object.entries(l.mods ?? {}).map(([k, m]) => {
            const p = getEffect(l.effectId)?.params.find((x) => x.key === k);
            const pts = Array.from({ length: 121 }, (_, i) => `${i / 1.2},${10 - wave(m.shape, (i / 120) * m.cycles + m.phase, m.cycles) * 8 * Math.max(m.depth * 2, 0.15)}`).join(" ");
            return (
              <div key={`${l.uid}-mod-${k}`} className="flex items-center h-6 hair-b">
                <span className="w-40 shrink-0 px-2 text-[10px] caps truncate text-fg-2">{l.name} · {p?.label ?? k} <span className="text-signal">~{m.shape}</span></span>
                <svg className="flex-1 h-full text-signal" viewBox="0 0 100 20" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /></svg>
              </div>
            );
          }))}
        </div>
      )}
    </div>
  );
}

/** Status bar (UI kit 16:40): resolution, fps, GPU, render time and an idle cursor. */
export function StatusBar() {
  const media = useEditor((s) => s.media);
  const layers = useEditor((s) => s.layers);
  const v = useView();
  const job = useExportJob((s) => s.progress);
  const live = stackIsAnimated(layers);
  return (
    <footer className="flex items-center gap-4 h-6 px-3 hair-t shrink-0 text-[10px] caps text-fg-muted overflow-hidden whitespace-nowrap">
      <span className="flex items-center gap-1.5 text-fg">
        <span className={`w-1.5 h-1.5 ${job ? "bg-signal blink" : live ? "bg-signal" : "bg-fg"}`} />
        {job ? `${job.label}` : media ? "MONITOR READY" : "NO SIGNAL"}
        {!job && <span className="blink">_</span>}
      </span>
      {media && <span>SRC {media.width}×{media.height}</span>}
      {v.workW > 0 && <span className="hidden sm:inline">VIEW {v.workW}×{v.workH}</span>}
      <span>{live ? `${v.fps} FPS` : "IDLE"}</span>
      <span className="hidden sm:inline">{v.renderMs.toFixed(1)} MS</span>
      <span>{layers.filter((l) => l.enabled).length} FX</span>
      <span className="hidden md:inline truncate">GPU {v.gpu || "—"}</span>
      <span className="ml-auto hidden lg:inline font-serif normal-case tracking-[0.3em] text-fg-2">THE CHAOS TO CREATE</span>
    </footer>
  );
}
