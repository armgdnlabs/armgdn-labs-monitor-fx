import { type ReactNode, useState } from "react";
import { getEffect } from "../effects/registry";
import type { ParamDef, ParamValue } from "../effects/types";
import { BLEND_MODES } from "../engine/glsl";
import { NEUTRAL_PRE, type PreValues } from "../engine/Renderer";
import { NEUTRAL_MASK, useEditor, type Layer } from "../state/editor";
import { WAVES, applyModulators, resolveValues, type Modulator } from "../lib/keyframes";
import { photoUrl, randomPhoto } from "../data/photos";
import { Icon } from "./ui/Icon";
import { Knob, Slider } from "./ui/Slider";
import { CurveEditor, GradientEditor } from "./ui/Editors";

export function Inspector() {
  const layer = useEditor((s) => s.layers.find((l) => l.uid === s.selectedUid));
  if (!layer) {
    return (
      <div className="flex flex-col h-full">
        <div className="ph hair-b"><span className="slash">Params</span></div>
        <div className="p-3 text-[11px] text-fg-muted leading-relaxed">
          <p className="text-fg caps">&gt; NO LAYER SELECTED<span className="blink">_</span></p>
          <p className="mt-2">Pick a layer in // LAYERS, or add an effect from the library. Every effect has its own parameters plus shared pre-processing, blend and mask controls.</p>
        </div>
      </div>
    );
  }
  return <LayerInspector key={layer.uid} layer={layer} />;
}

function LayerInspector({ layer }: { layer: Layer }) {
  const effect = getEffect(layer.effectId)!;
  const ed = useEditor.getState();
  const time = useEditor((s) => s.time);
  const loop = useEditor((s) => s.duration);
  const values = applyModulators(effect, resolveValues(layer.values, layer.keyframes, time), layer.mods ?? {}, time, loop);
  const set = (k: string, v: ParamValue) => ed.setParam(layer.uid, k, v);
  const start = () => ed.checkpoint();
  const heroes = effect.params.filter((p) => p.type === "range" && p.hero).slice(0, 3);
  const groups: [string, ParamDef[]][] = [];
  for (const p of effect.params) {
    if (heroes.includes(p)) continue;
    const g = p.group ?? "";
    const entry = groups.find((x) => x[0] === g);
    if (entry) entry[1].push(p);
    else groups.push([g, [p]]);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="ph hair-b">
        <span className="slash truncate flex-1">FX.{effect.id.toUpperCase()}</span>
        <button className="icon-btn" title="Randomise [R]" onClick={() => ed.randomizeLayer(layer.uid)}><Icon name="dice" /></button>
        <button className="icon-btn" title="Reset layer" onClick={() => ed.resetLayer(layer.uid)}><Icon name="restart" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 pt-2 pb-1">
          <p className="text-[12px] caps">{effect.name}{effect.handles && <span className="tag-chip ml-2">DRAG POINT ON CANVAS</span>}</p>
        </div>
        {heroes.length > 0 && (
          <div className={`grid gap-2 px-3 py-3 hair-b ${heroes.length === 3 ? "grid-cols-3" : heroes.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {heroes.map((p) => p.type === "range" && (
              <div key={p.key} className="group flex flex-col items-center">
                <Knob label={p.label} value={Number(values[p.key] ?? p.default)} min={p.min} max={p.max} step={p.step} def={p.default} unit={p.unit} onStart={start} onChange={(v) => set(p.key, v)} />
                <div className="flex gap-0.5 mt-0.5"><AnimateButtons layer={layer} k={p.key} /></div>
              </div>
            ))}
          </div>
        )}
        {heroes.some((p) => layer.mods?.[p.key]) && (
          <div className="px-3 py-2 hair-b flex flex-col gap-2">
            {heroes.filter((p) => layer.mods?.[p.key]).map((p) => <ModEditor key={p.key} layer={layer} k={p.key} label={p.label} />)}
          </div>
        )}
        {groups.map(([g, params]) => (
          <Group key={g || "main"} title={g || undefined}>
            {params.map((p) => <ParamControl key={p.key} p={p} layer={layer} value={values[p.key] ?? p.default} set={set} start={start} />)}
          </Group>
        ))}
        <BlendSection layer={layer} />
        <PreSection layer={layer} />
        <MaskSection layer={layer} />
        <Group title="Seed" collapsible defaultOpen={false}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums flex-1">{layer.seed.toFixed(1)}</span>
            <button className="btn h-6" onClick={() => { start(); ed.setLayerProps(layer.uid, { seed: Math.round(Math.random() * 1000) / 10 }); }}><Icon name="dice" />Reroll</button>
          </div>
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children, collapsible = false, defaultOpen = true, right }: { title?: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="hair-b">
      {title && (
        <div className="flex items-center h-7 px-3">
          <button className="flex items-center gap-1.5 flex-1 text-[10px] caps text-fg-2 hover:text-fg text-left" onClick={() => collapsible && setOpen(!open)}>
            {collapsible && <Icon name={open ? "chevronDown" : "chevronRight"} />}
            <span className="slash">{title}</span>
          </button>
          {right}
        </div>
      )}
      {open && <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

function KeyframeToggle({ layer, k }: { layer: Layer; k: string }) {
  const on = !!layer.keyframes[k]?.length;
  return (
    <button
      className={`w-6 h-6 flex items-center justify-center ${on ? "text-signal" : "text-fg-muted opacity-0 group-hover:opacity-100 hover:text-fg"}`}
      title={on ? "Remove keyframes" : "Keyframe: adds a key at the playhead; later edits at other times add more"}
      onClick={() => useEditor.getState().toggleKeyframeTrack(layer.uid, k)}
    >
      <Icon name="diamond" />
    </button>
  );
}

const DEFAULT_MOD: Modulator = { shape: "sine", cycles: 1, depth: 0.3, phase: 0 };

/** Keyframe + modulate buttons for a numeric param. */
function AnimateButtons({ layer, k }: { layer: Layer; k: string }) {
  const mod = layer.mods?.[k];
  return (
    <>
      <KeyframeToggle layer={layer} k={k} />
      <button
        className={`w-6 h-6 flex items-center justify-center ${mod ? "text-signal" : "text-fg-muted opacity-0 group-hover:opacity-100 hover:text-fg"}`}
        title={mod ? "Remove modulation" : "Modulate: loop this value with a wave (sine, saw, random…)"}
        onClick={() => useEditor.getState().setModulator(layer.uid, k, mod ? null : DEFAULT_MOD)}
      >
        <Icon name="wave" />
      </button>
    </>
  );
}

/** Wave shape, cycles per loop, depth and phase for one modulated param. */
function ModEditor({ layer, k, label }: { layer: Layer; k: string; label?: string }) {
  const mod = layer.mods?.[k];
  if (!mod) return null;
  const ed = useEditor.getState();
  const upd = (patch: Partial<Modulator>) => ed.setModulator(layer.uid, k, { ...mod, ...patch });
  return (
    <div className="flex flex-col gap-1.5 pl-2 border-l border-signal">
      {label && <span className="text-[10px] caps text-signal">~ {label}</span>}
      <div className="flex flex-wrap gap-1">
        {WAVES.map((w) => <button key={w} className={`chip ${mod.shape === w ? "on" : ""}`} onClick={() => upd({ shape: w })}>{w}</button>)}
      </div>
      <Slider label="Cycles per loop" value={mod.cycles} min={1} max={16} step={1} def={1} onStart={() => ed.checkpoint()} onChange={(v) => upd({ cycles: v })} />
      <Slider label="Depth" value={mod.depth} min={0} max={1} step={0.01} def={0.3} onStart={() => ed.checkpoint()} onChange={(v) => upd({ depth: v })} />
      <Slider label="Phase" value={mod.phase} min={0} max={1} step={0.01} def={0} onStart={() => ed.checkpoint()} onChange={(v) => upd({ phase: v })} />
    </div>
  );
}

function ParamControl({ p, layer, value, set, start }: { p: ParamDef; layer: Layer; value: ParamValue; set: (k: string, v: ParamValue) => void; start: () => void }) {
  switch (p.type) {
    case "range":
      return (
        <div className="flex flex-col gap-1.5">
          <Slider label={p.label} value={Number(value)} min={p.min} max={p.max} step={p.step} def={p.default} unit={p.unit} onStart={start} onChange={(v) => set(p.key, v)} extra={<AnimateButtons layer={layer} k={p.key} />} />
          <ModEditor layer={layer} k={p.key} />
        </div>
      );
    case "select":
      return (
        <label className="flex flex-col gap-1">
          <span className="caps text-[10px] text-fg-2">{p.label}</span>
          {p.options.length <= 4 && p.options.every((o) => o.length <= 10) ? (
            <div className="flex border border-line">
              {p.options.map((o, i) => (
                <button key={o} className={`flex-1 h-6 text-[10px] caps truncate px-1 ${Number(value) === i ? "bg-fg text-bg" : "text-fg-2 hover:text-fg"}`} onClick={() => { start(); set(p.key, i); }}>{o}</button>
              ))}
            </div>
          ) : (
            <select className="field h-7 caps text-[11px] cursor-pointer" style={{ background: "rgb(var(--bg))" }} value={Number(value)} onChange={(e) => { start(); set(p.key, Number(e.target.value)); }}>
              {p.options.map((o, i) => <option key={o} value={i}>{o}</option>)}
            </select>
          )}
        </label>
      );
    case "toggle":
      return (
        <button className="flex items-center gap-2 text-left" onClick={() => { start(); set(p.key, Number(value) ? 0 : 1); }}>
          <span className={`w-3 h-3 border ${Number(value) ? "bg-fg border-fg" : "border-line"}`} />
          <span className="caps text-[10px] text-fg-2">{p.label}</span>
        </button>
      );
    case "color":
      return (
        <label className="group flex items-center gap-2">
          <span className="caps text-[10px] text-fg-2 flex-1">{p.label}</span>
          <KeyframeToggle layer={layer} k={p.key} />
          <input className="field h-6 w-20 uppercase text-[11px]" value={String(value)} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && (start(), set(p.key, e.target.value))} />
          <input type="color" value={String(value)} className="w-7 h-6 p-0 border border-line bg-transparent cursor-pointer" onPointerDown={start} onChange={(e) => set(p.key, e.target.value)} />
        </label>
      );
    case "text":
      return (
        <label className="flex flex-col gap-1">
          <span className="caps text-[10px] text-fg-2">{p.label}</span>
          {p.multiline ? (
            <textarea className="field h-16 py-1 resize-y" maxLength={p.maxLength} value={String(value)} onFocus={start} onChange={(e) => set(p.key, e.target.value)} />
          ) : (
            <input className="field h-7" maxLength={p.maxLength} value={String(value)} onFocus={start} onChange={(e) => set(p.key, e.target.value)} />
          )}
        </label>
      );
    case "curve":
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center"><span className="caps text-[10px] text-fg-2 flex-1">{p.label}</span>
            <button className="text-[10px] caps text-fg-muted hover:text-fg" onClick={() => { start(); set(p.key, p.default); }}>Reset</button></div>
          <CurveEditor value={String(value)} tint={p.tint} onStart={start} onChange={(v) => set(p.key, v)} />
        </div>
      );
    case "gradient":
      return (
        <div className="flex flex-col gap-1">
          <span className="caps text-[10px] text-fg-2">{p.label}</span>
          <GradientEditor value={String(value)} onStart={start} onChange={(v) => set(p.key, v)} />
        </div>
      );
    case "image":
      return <ImageControl label={p.label} value={String(value)} onChange={(v) => { start(); set(p.key, v); }} />;
    case "palette": {
      const cols = String(value || "").split(/\s+/).filter(Boolean);
      return (
        <div className="flex flex-col gap-1">
          <span className="caps text-[10px] text-fg-2">{p.label}</span>
          <div className="grid grid-cols-9 gap-[2px]">
            {Array.from({ length: 18 }, (_, i) => (
              <input
                key={i}
                type="color"
                title={`Colour ${i + 1}`}
                className="w-full h-5 p-0 border border-line cursor-pointer bg-transparent"
                value={cols[i] ?? "#000000"}
                onChange={(e) => { const next = Array.from({ length: 18 }, (_, k) => cols[k] ?? "#000000"); next[i] = e.target.value.toUpperCase(); start(); set(p.key, next.join(" ")); }}
              />
            ))}
          </div>
        </div>
      );
    }
  }
}

function ImageControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="caps text-[10px] text-fg-2">{label}</span>
      <div className="flex gap-2 items-stretch">
        <div className="w-14 h-14 border border-line shrink-0 overflow-hidden" style={{ background: "rgb(var(--bg-raised))" }}>
          {value && <img src={value} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />}
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <button className="btn h-6" onClick={() => onChange(photoUrl(randomPhoto(), 1600))}><Icon name="shuffle" />Unsplash</button>
          <div className="flex gap-1">
            <button className="btn h-6 flex-1" onClick={() => { const u = prompt("Image URL (must allow cross-origin use)", value); if (u?.trim()) onChange(u.trim()); }}><Icon name="link" />URL</button>
            <button className="btn h-6 flex-1" onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = () => { const f = input.files?.[0]; if (f) onChange(URL.createObjectURL(f)); };
              input.click();
            }}><Icon name="folder" />File</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlendSection({ layer }: { layer: Layer }) {
  const ed = useEditor.getState();
  return (
    <Group title="Blend">
      <Slider label="Opacity" value={layer.opacity} min={0} max={1} step={0.01} def={1} onStart={() => ed.checkpoint()} onChange={(v) => ed.setLayerProps(layer.uid, { opacity: v })} />
      <label className="flex items-center gap-2">
        <span className="caps text-[10px] text-fg-2 flex-1">Mode</span>
        <select className="field h-7 w-36 caps text-[11px] cursor-pointer" style={{ background: "rgb(var(--bg))" }} value={layer.blend} onChange={(e) => { ed.checkpoint(); ed.setLayerProps(layer.uid, { blend: Number(e.target.value) }); }}>
          {BLEND_MODES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </label>
    </Group>
  );
}

const PRE_FIELDS: { i: number; label: string; min: number; max: number; step: number }[] = [
  { i: 0, label: "Brightness", min: -0.5, max: 0.5, step: 0.01 },
  { i: 1, label: "Contrast", min: -1, max: 2, step: 0.01 },
  { i: 2, label: "Saturation", min: -1, max: 1, step: 0.01 },
  { i: 3, label: "Gamma", min: 0.2, max: 3, step: 0.01 },
  { i: 4, label: "Black point", min: 0, max: 0.5, step: 0.005 },
  { i: 5, label: "White point", min: 0.5, max: 1, step: 0.005 },
  { i: 6, label: "Blur", min: 0, max: 20, step: 0.1 },
  { i: 8, label: "Posterize (0 = off)", min: 0, max: 16, step: 1 },
];

/** Shared image pre-processing applied to this layer's input (like tooooools' preprocessing). */
function PreSection({ layer }: { layer: Layer }) {
  const ed = useEditor.getState();
  const pre = layer.pre ?? ([...NEUTRAL_PRE] as PreValues);
  const setAt = (i: number, v: number) => { const next = [...pre] as PreValues; next[i] = v; ed.setLayerProps(layer.uid, { pre: next }); };
  const active = !!layer.pre && layer.pre.some((v, i) => Math.abs(v - NEUTRAL_PRE[i]) > 1e-4);
  return (
    <Group title="Pre-process" collapsible defaultOpen={active} right={active ? <button className="text-[10px] caps text-fg-muted hover:text-fg" onClick={() => { ed.checkpoint(); ed.setLayerProps(layer.uid, { pre: null }); }}>Reset</button> : undefined}>
      {PRE_FIELDS.map((f) => (
        <Slider key={f.i} label={f.label} value={pre[f.i]} min={f.min} max={f.max} step={f.step} def={NEUTRAL_PRE[f.i]} unit={f.i === 6 ? "px" : undefined} onStart={() => ed.checkpoint()} onChange={(v) => setAt(f.i, v)} />
      ))}
      <button className="flex items-center gap-2" onClick={() => { ed.checkpoint(); setAt(7, pre[7] > 0.5 ? 0 : 1); }}>
        <span className={`w-3 h-3 border ${pre[7] > 0.5 ? "bg-fg border-fg" : "border-line"}`} /><span className="caps text-[10px] text-fg-2">Invert</span>
      </button>
    </Group>
  );
}

/** Apply this layer only to a brightness range of the image below (or the original). */
function MaskSection({ layer }: { layer: Layer }) {
  const ed = useEditor.getState();
  const m = layer.mask ?? NEUTRAL_MASK;
  const setAt = (i: number, v: number) => { const next = [...m] as typeof m; next[i] = v; ed.setLayerProps(layer.uid, { mask: next }); };
  const on = m[3] > 0.5;
  return (
    <Group title="Luma mask" collapsible defaultOpen={on}>
      <div className="flex border border-line">
        {["Off", "On", "Inverted"].map((o, i) => (
          <button key={o} className={`flex-1 h-6 text-[10px] caps ${Math.round(m[3]) === i ? "bg-fg text-bg" : "text-fg-2 hover:text-fg"}`} onClick={() => { ed.checkpoint(); setAt(3, i); }}>{o}</button>
        ))}
      </div>
      {on && (
        <>
          <Slider label="Low" value={m[0]} min={0} max={1} step={0.01} def={0} onStart={() => ed.checkpoint()} onChange={(v) => setAt(0, v)} />
          <Slider label="High" value={m[1]} min={0} max={1} step={0.01} def={1} onStart={() => ed.checkpoint()} onChange={(v) => setAt(1, v)} />
          <Slider label="Softness" value={m[2]} min={0} max={0.5} step={0.01} def={0.1} onStart={() => ed.checkpoint()} onChange={(v) => setAt(2, v)} />
          <div className="flex border border-line">
            {["Layer below", "Original"].map((o, i) => (
              <button key={o} className={`flex-1 h-6 text-[10px] caps ${Math.round(m[4]) === i ? "bg-fg text-bg" : "text-fg-2 hover:text-fg"}`} onClick={() => { ed.checkpoint(); setAt(4, i); }}>{o}</button>
            ))}
          </div>
          <p className="text-[10px] text-fg-muted">&gt; Effect shows where brightness is between LOW and HIGH.</p>
        </>
      )}
    </Group>
  );
}

