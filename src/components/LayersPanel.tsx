import { useRef, useState } from "react";
import { getEffect } from "../effects/registry";
import { layerHasMotion, useEditor, type Layer, type LayerGroup } from "../state/editor";
import { usePrefs, useUI } from "../state/ui";
import { openFilePicker, shuffleSource } from "../lib/source";
import { profileUrl, UNSPLASH_URL, getPhoto } from "../data/photos";
import { Icon } from "./ui/Icon";

const TAGS: Record<string, string> = {
  Adjust: "ADJ", Color: "COL", Film: "FILM", Retro: "RTR", Glitch: "GLT", Print: "PRNT", Blur: "BLUR", Distort: "DIST", Overlay: "OVR",
};

export function LayersPanel() {
  const layers = useEditor((s) => s.layers);
  const groups = useEditor((s) => s.groups);
  const selected = useEditor((s) => s.selectedUid);
  const ed = useEditor.getState();
  const [drag, setDrag] = useState<{ uid: string; over: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shown = [...layers].reverse(); // top of stack first

  const startDrag = (e: React.PointerEvent, l: Layer) => {
    e.preventDefault();
    const rows = [...(listRef.current?.querySelectorAll("[data-row]") ?? [])] as HTMLElement[];
    const rects = rows.map((r) => r.getBoundingClientRect());
    // Rows inside collapsed groups are not rendered, so map visible rows back to stack positions.
    const at = rows.map((r) => Number(r.dataset.idx));
    const pick = (y: number) => { const k = rects.findIndex((r) => y < r.top + r.height / 2); return at[k < 0 ? at.length - 1 : k]; };
    const from = shown.findIndex((x) => x.uid === l.uid);
    setDrag({ uid: l.uid, over: from });
    const move = (ev: PointerEvent) => {
      setDrag({ uid: l.uid, over: pick(ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const idx = pick(ev.clientY);
      setDrag(null);
      if (idx !== from) useEditor.getState().moveLayer(l.uid, layers.length - 1 - idx);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="ph hair-b">
        <span className="slash flex-1">Layers</span>
        <span className="text-fg-muted">{layers.length}</span>
        <button className="icon-btn" title="Save stack as preset" disabled={!layers.length} onClick={() => useUI.getState().open({ type: "savePreset" })}><Icon name="floppy" /></button>
        <button className="icon-btn" title="Clear all layers" disabled={!layers.length} onClick={() => ed.clearLayers()}><Icon name="trash" /></button>
      </div>
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
        {shown.map((l, i) => {
          const g = l.group ? groups.find((x) => x.id === l.group) : undefined;
          const header = g && shown[i - 1]?.group !== g.id ? <GroupRow key={`g-${g.id}-${i}`} group={g} count={layers.filter((x) => x.group === g.id).length} /> : null;
          if (g?.collapsed) return header;
          const effect = getEffect(l.effectId);
          const sel = l.uid === selected;
          const dropLine = drag && drag.uid !== l.uid && drag.over === i;
          return [header, (
            <div
              key={l.uid}
              data-row
              data-idx={i}
              onClick={() => ed.select(l.uid)}
              className={`group relative flex items-center gap-1.5 h-9 ${g ? "pl-5" : "pl-1"} pr-1 hair-b cursor-default ${sel ? "bg-fg text-bg" : "hover:bg-raised"} ${drag?.uid === l.uid ? "opacity-50" : ""} ${g && !g.enabled ? "opacity-50" : ""}`}
            >
              {dropLine && <div className="absolute left-0 right-0 top-0 h-0.5 bg-signal" />}
              <button className={`w-7 h-7 flex items-center justify-center ${l.enabled ? "" : "opacity-40"}`} title="Show / hide [H] · Alt-click to solo" onClick={(e) => { e.stopPropagation(); if (e.altKey) ed.soloLayer(l.uid); else ed.toggleLayer(l.uid); }}>
                <Icon name="eye" />
              </button>
              <span className={`tag h-4 border ${sel ? "border-bg" : "border-line text-fg-2"}`}>{TAGS[effect?.category ?? ""] ?? "FX"}</span>
              <LayerName layer={l} />
              {l.opacity < 1 && <span className="text-[10px] opacity-70">{Math.round(l.opacity * 100)}%</span>}
              {layerHasMotion(l) && <Icon name="diamond" className="text-signal" />}
              <button className="w-7 h-7 hidden group-hover:flex items-center justify-center" title="Duplicate [D]" onClick={(e) => { e.stopPropagation(); ed.duplicateLayer(l.uid); }}><Icon name="copy" /></button>
              <button className="w-7 h-7 hidden group-hover:flex items-center justify-center hover:text-signal" title="Delete [Del]" onClick={(e) => { e.stopPropagation(); ed.removeLayer(l.uid); }}><Icon name="close" /></button>
              <span className="w-6 h-7 flex items-center justify-center cursor-grab opacity-60 touch-none" title="Drag to reorder" onPointerDown={(e) => startDrag(e, l)}><Icon name="grip" /></span>
            </div>
          )];
        })}
        <button className="w-full flex items-center gap-2 h-9 px-2 hair-b text-[11px] caps text-fg-2 hover:bg-fg hover:text-bg" onClick={() => { usePrefs.getState().set({ libraryTab: "effects", libraryCollapsed: false }); useUI.getState().setBrowser(true); }}>
          <Icon name="plus" /> Add FX <span className="ml-auto kbd">B</span>
        </button>
        {!layers.length && <p className="px-2 py-3 text-[11px] text-fg-muted">&gt; STACK EMPTY — pick a preset or an effect from the library.</p>}
      </div>
      <SourceRow />
    </div>
  );
}

function LayerName({ layer }: { layer: Layer }) {
  const [editing, setEditing] = useState(false);
  const rename = useEditor((s) => s.renameLayer);
  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={layer.name}
        className="flex-1 min-w-0 h-6 bg-bg text-fg border border-fg px-1 text-[11px] caps outline-none"
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => { rename(layer.uid, e.target.value); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }
  return <span className="flex-1 min-w-0 truncate text-[11px] caps" onDoubleClick={() => setEditing(true)} title="Double-click to rename">{layer.name}</span>;
}

/** A preset group: collapse, show/hide, rename, ungroup or delete its layers together. */
function GroupRow({ group, count }: { group: LayerGroup; count: number }) {
  const ed = useEditor.getState();
  const [editing, setEditing] = useState(false);
  return (
    <div className="group flex items-center gap-1 h-9 pl-1 pr-1 hair-b" style={{ background: "rgb(var(--bg-raised) / 0.5)" }}>
      <button className="w-7 h-7 flex items-center justify-center" title={group.collapsed ? "Expand group" : "Collapse group"} onClick={() => ed.collapseGroup(group.id)}>
        <Icon name={group.collapsed ? "chevronRight" : "chevronDown"} />
      </button>
      <button className={`w-7 h-7 flex items-center justify-center ${group.enabled ? "" : "opacity-40"}`} title="Show / hide group" onClick={() => ed.toggleGroup(group.id)}><Icon name="eye" /></button>
      <span className="tag-solid">SET</span>
      {editing ? (
        <input
          autoFocus
          defaultValue={group.name}
          className="flex-1 min-w-0 h-7 bg-bg text-fg border border-fg px-1 text-[11px] caps outline-none"
          onBlur={(e) => { ed.renameGroup(group.id, e.target.value); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-[11px] caps" onDoubleClick={() => setEditing(true)} title="Double-click to rename">{group.name}</span>
      )}
      <span className="text-[10px] text-fg-muted">{count}</span>
      <button className="w-7 h-7 hidden group-hover:flex items-center justify-center" title="Ungroup (keep layers)" onClick={() => ed.ungroup(group.id)}><Icon name="layers" /></button>
      <button className="w-7 h-7 hidden group-hover:flex items-center justify-center hover:text-signal" title="Delete group" onClick={() => ed.removeGroup(group.id)}><Icon name="close" /></button>
    </div>
  );
}

/** The bottom "SOURCE" row: what's being processed, its credit, and ways to replace it. */
function SourceRow() {
  const media = useEditor((s) => s.media);
  const credit = media?.credit;
  const photo = credit?.key ? getPhoto(credit.key) : undefined;
  return (
    <div className="group relative hair-t shrink-0">
      <div className="flex items-center gap-2 p-1.5">
        <div className="relative w-10 h-10 shrink-0 border border-line overflow-hidden" style={{ background: "rgb(var(--bg-raised))" }}>
          {media?.kind === "image" && <img src={media.url} alt="" className="w-full h-full object-cover" />}
          {media?.kind === "video" && <Icon name="film" size={16} className="m-auto mt-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1"><span className="tag-solid">SRC</span><span className="text-[11px] caps truncate">{media ? media.name : "NO SIGNAL"}</span></div>
          {credit ? (
            <p className="text-[10px] text-fg-muted truncate">
              Photo by <a className="underline hover:text-fg" href={photo ? profileUrl(photo) : UNSPLASH_URL} target="_blank" rel="noreferrer">{credit.name}</a> on <a className="underline hover:text-fg" href={UNSPLASH_URL} target="_blank" rel="noreferrer">Unsplash</a>
            </p>
          ) : (
            <p className="text-[10px] text-fg-muted truncate">{media ? `${media.width}×${media.height}${media.kind === "video" ? ` · ${media.duration.toFixed(1)}s` : ""}` : "Drop, paste or open media"}</p>
          )}
        </div>
      </div>
      {/* Hover actions: shuffle from Unsplash, add from URL, upload. */}
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-100 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100" style={{ background: "rgb(var(--panel))" }}>
        <button className="icon-btn" title="Shuffle — random Unsplash photo [S]" onClick={() => void shuffleSource()}><Icon name="shuffle" /></button>
        <button className="icon-btn" title="Add from URL" onClick={() => useUI.getState().open({ type: "sourceUrl" })}><Icon name="link" /></button>
        <button className="icon-btn" title="Open file [O]" onClick={openFilePicker}><Icon name="folder" /></button>
      </div>
    </div>
  );
}
