import { type ReactNode, useEffect, useRef, useState } from "react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const snap = (v: number, step: number, min: number) => +(Math.round((v - min) / step) * step + min).toFixed(6);

export function formatValue(v: number, step: number, unit?: string) {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return `${v.toFixed(decimals)}${unit ?? ""}`;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  def?: number;
  unit?: string;
  onChange: (v: number) => void;
  onStart?: () => void;
  extra?: ReactNode;
}

/**
 * Thin track with a square thumb; the value is always shown.
 * Drag, wheel and arrow keys all work; Shift gives fine control; double-click resets.
 */
export function Slider({ label, value, min, max, step, def, unit, onChange, onStart, extra }: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const t = (clamp(value, min, max) - min) / (max - min || 1);

  const fromPointer = (clientX: number, fine: boolean, startX: number, startV: number) => {
    const r = track.current!.getBoundingClientRect();
    const dx = clientX - startX;
    const scale = fine ? 0.1 : 1;
    return clamp(snap(startV + (dx / r.width) * (max - min) * scale, step, min), min, max);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onStart?.();
    const r = track.current!.getBoundingClientRect();
    // Clicking the track jumps there; then drag is relative.
    let base = clamp(snap(min + ((e.clientX - r.left) / r.width) * (max - min), step, min), min, max);
    if (Math.abs(e.clientX - (r.left + t * r.width)) < 8) base = value;
    else onChange(base);
    const startX = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onChange(fromPointer(ev.clientX, ev.shiftKey, startX, base));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudge = (dir: number, fine: boolean) => {
    onStart?.();
    const s = fine ? step : Math.max(step, (max - min) / 100);
    onChange(clamp(snap(value + dir * s, step, min), min, max));
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as HTMLElement).closest("[data-slider]")) return;
      e.preventDefault();
      nudge(e.deltaY < 0 || e.deltaX > 0 ? 1 : -1, e.shiftKey);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const commitDraft = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) { onStart?.(); onChange(clamp(snap(n, step, min), min, max)); }
    setEditing(false);
  };

  return (
    <div className="group select-none" data-slider>
      <div className="flex items-center gap-2 h-5">
        <span className="caps text-[10px] text-fg-2 truncate flex-1" onDoubleClick={() => def !== undefined && (onStart?.(), onChange(def))} title="Double-click to reset">{label}</span>
        {extra}
        {editing ? (
          <input
            autoFocus
            className="w-16 h-5 bg-transparent border border-fg text-right text-[11px] px-1 outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === "Enter") commitDraft(); if (e.key === "Escape") setEditing(false); }}
          />
        ) : (
          <button className="text-[11px] text-fg tabular-nums hover:underline" onClick={() => { setDraft(String(value)); setEditing(true); }}>
            {formatValue(value, step, unit)}
          </button>
        )}
      </div>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="relative h-4 cursor-ew-resize touch-none"
        onPointerDown={onPointerDown}
        onDoubleClick={() => def !== undefined && (onStart?.(), onChange(def))}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); nudge(1, e.shiftKey); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); nudge(-1, e.shiftKey); }
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-px bg-line" />
        {min < 0 && max > 0 && <div className="absolute top-1/2 -translate-y-1/2 w-px h-2 bg-fg-muted" style={{ left: `${(-min / (max - min)) * 100}%` }} />}
        <div className="absolute top-1/2 h-px bg-fg" style={{ left: min < 0 && max > 0 ? `${Math.min(t, -min / (max - min)) * 100}%` : 0, width: `${Math.abs(t - (min < 0 && max > 0 ? -min / (max - min) : 0)) * 100}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-fg group-hover:w-2.5 group-hover:h-2.5" style={{ left: `${t * 100}%` }} />
      </div>
    </div>
  );
}

/** Rotary knob for the 2–3 hero params of an effect (DESIGN.md, UI kit 16:57). */
export function Knob({ label, value, min, max, step, def, unit, onChange, onStart }: SliderProps) {
  const t = (clamp(value, min, max) - min) / (max - min || 1);
  const a = -135 + t * 270;
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    onStart?.();
    const startY = e.clientY;
    const startV = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dy = startY - ev.clientY;
      const k = ev.shiftKey ? 0.1 : 1;
      onChange(clamp(snap(startV + (dy / 160) * (max - min) * k, step, min), min, max));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="flex flex-col items-center gap-1 select-none min-w-0" data-slider>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        className="relative w-11 h-11 cursor-ns-resize touch-none"
        onPointerDown={onPointerDown}
        onDoubleClick={() => def !== undefined && (onStart?.(), onChange(def))}
        onWheel={(e) => { onStart?.(); onChange(clamp(snap(value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? step : Math.max(step, (max - min) / 100)), step, min), min, max)); }}
        onKeyDown={(e) => {
          const s = e.shiftKey ? step : Math.max(step, (max - min) / 100);
          if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onStart?.(); onChange(clamp(snap(value + s, step, min), min, max)); }
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onStart?.(); onChange(clamp(snap(value - s, step, min), min, max)); }
        }}
      >
        <svg viewBox="0 0 44 44" className="w-full h-full">
          <circle cx="22" cy="22" r="17" fill="none" stroke="rgb(var(--border))" strokeWidth="1" />
          <path d={arc(22, 22, 20, -135, a)} fill="none" stroke="rgb(var(--fg))" strokeWidth="1.5" />
          <line x1="22" y1="22" x2={22 + 13 * Math.sin((a * Math.PI) / 180)} y2={22 - 13 * Math.cos((a * Math.PI) / 180)} stroke="rgb(var(--signal))" strokeWidth="2" />
        </svg>
      </div>
      <span className="text-[11px] tabular-nums">{formatValue(value, step, unit)}</span>
      <span className="caps text-[9px] text-fg-muted truncate max-w-full">{label}</span>
    </div>
  );
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Terminal progress bar: [████░░░░] 52% */
export function TermProgress({ fraction, width = 16 }: { fraction: number; width?: number }) {
  const n = Math.round(clamp(fraction, 0, 1) * width);
  return <span className="tabular-nums">[{"█".repeat(n)}{"░".repeat(width - n)}] {Math.round(fraction * 100)}%</span>;
}
