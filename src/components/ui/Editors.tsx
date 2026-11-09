import { useRef, useState } from "react";
import { evalCurve, formatCurve, formatGradient, parseCurve, parseGradient, sampleGradient, type CurvePoint } from "../../lib/textures";
import { rgbToHex } from "../../lib/color";
import { Icon } from "./Icon";

/**
 * Tone curve editor. Click to add a point, drag to move, double-click (or drag off the
 * side) to remove. Endpoints stay pinned to x = 0 and x = 1.
 */
export function CurveEditor({ value, tint = "#F7F2EC", onChange, onStart }: { value: string; tint?: string; onChange: (v: string) => void; onStart: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const pts = parseCurve(value);
  const S = 160;
  const toLocal = (e: { clientX: number; clientY: number }): CurvePoint => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))];
  };
  const path = Array.from({ length: 65 }, (_, i) => {
    const x = i / 64;
    return `${i ? "L" : "M"}${x * S} ${(1 - evalCurve(pts, x)) * S}`;
  }).join("");

  const drag = (index: number, startPts: CurvePoint[]) => {
    const move = (ev: PointerEvent) => {
      const [x, y] = toLocal(ev);
      const next = startPts.map((p) => [...p] as CurvePoint);
      const isEnd = index === 0 || index === next.length - 1;
      const lo = index > 0 ? next[index - 1][0] + 0.01 : 0;
      const hi = index < next.length - 1 ? next[index + 1][0] - 0.01 : 1;
      next[index] = [isEnd ? next[index][0] : Math.min(hi, Math.max(lo, x)), y];
      const r = svg.current!.getBoundingClientRect();
      const off = !isEnd && (ev.clientY < r.top - 24 || ev.clientY > r.bottom + 24);
      onChange(formatCurve(off ? next.filter((_, i) => i !== index) : next));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${S} ${S}`}
      className="w-full aspect-square border border-line touch-none cursor-crosshair"
      style={{ background: "rgb(var(--bg))" }}
      onPointerDown={(e) => {
        if ((e.target as Element).tagName === "rect" && (e.target as Element).getAttribute("data-pt")) return;
        onStart();
        const p = toLocal(e);
        const next = [...pts, p].sort((a, b) => a[0] - b[0]);
        onChange(formatCurve(next));
        drag(next.indexOf(p), next);
      }}
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <g key={g} stroke="rgb(var(--border))" strokeWidth="0.5">
          <line x1={g * S} y1={0} x2={g * S} y2={S} />
          <line x1={0} y1={g * S} x2={S} y2={g * S} />
        </g>
      ))}
      <line x1={0} y1={S} x2={S} y2={0} stroke="rgb(var(--border))" strokeDasharray="2 3" strokeWidth="0.5" />
      <path d={path} fill="none" stroke={tint} strokeWidth="1.5" />
      {pts.map(([x, y], i) => (
        <rect
          key={i}
          data-pt="1"
          x={x * S - 3.5}
          y={(1 - y) * S - 3.5}
          width={7}
          height={7}
          fill="rgb(var(--bg))"
          stroke={tint}
          className="cursor-move"
          onPointerDown={(e) => { e.stopPropagation(); onStart(); drag(i, pts); }}
          onDoubleClick={() => { if (i > 0 && i < pts.length - 1) { onStart(); onChange(formatCurve(pts.filter((_, j) => j !== i))); } }}
        />
      ))}
    </svg>
  );
}

/** Multi-stop gradient: click the bar to add a stop, drag to move, pick a colour, × to remove. */
export function GradientEditor({ value, onChange, onStart }: { value: string; onChange: (v: string) => void; onStart: () => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const stops = parseGradient(value);
  const [sel, setSel] = useState(0);
  const cur = stops[Math.min(sel, stops.length - 1)];
  const css = `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.pos * 100}%`).join(", ")})`;
  const posOf = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const update = (i: number, patch: Partial<{ color: string; pos: number }>) => {
    const next = stops.map((s, j) => (j === i ? { ...s, ...patch } : s));
    const moved = next[i];
    const sorted = [...next].sort((a, b) => a.pos - b.pos);
    setSel(sorted.indexOf(moved));
    onChange(formatGradient(sorted));
  };
  return (
    <div className="flex flex-col gap-2">
      <div
        ref={bar}
        className="relative h-6 border border-line cursor-copy"
        style={{ background: css }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          onStart();
          const pos = posOf(e.clientX);
          const [r, g, b] = sampleGradient(stops, pos);
          const next = [...stops, { color: rgbToHex(r, g, b), pos }].sort((a, b2) => a.pos - b2.pos);
          setSel(next.findIndex((s) => s.pos === pos));
          onChange(formatGradient(next));
        }}
      >
        {stops.map((s, i) => (
          <div
            key={i}
            className={`absolute top-full -translate-x-1/2 w-3 h-3 border cursor-ew-resize ${i === sel ? "border-signal" : "border-fg"}`}
            style={{ left: `${s.pos * 100}%`, background: s.color, marginTop: 2 }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStart();
              setSel(i);
              const move = (ev: PointerEvent) => update(i, { pos: posOf(ev.clientX) });
              const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input type="color" value={cur.color} className="w-8 h-6 bg-transparent border border-line p-0" onPointerDown={onStart} onChange={(e) => update(sel, { color: e.target.value })} />
        <input className="field h-6 w-20 uppercase" value={cur.color} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && (onStart(), update(sel, { color: e.target.value }))} />
        <span className="text-[10px] text-fg-muted tabular-nums">@{Math.round(cur.pos * 100)}%</span>
        <button className="icon-btn w-6 h-6 ml-auto" title="Reverse" onClick={() => { onStart(); onChange(formatGradient(stops.map((s) => ({ ...s, pos: 1 - s.pos })).sort((a, b) => a.pos - b.pos))); }}><Icon name="loop" /></button>
        <button className="icon-btn w-6 h-6" title="Remove stop" disabled={stops.length <= 2} onClick={() => { onStart(); onChange(formatGradient(stops.filter((_, j) => j !== sel))); setSel(0); }}><Icon name="close" /></button>
      </div>
    </div>
  );
}
