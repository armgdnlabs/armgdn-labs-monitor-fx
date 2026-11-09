import type { ReactNode } from "react";
import { ASPECTS, EXPORT_SIZES, type ExportFormat, useEditor } from "../state/editor";
import { useUI } from "../state/ui";
import { useView } from "../state/view";
import { useExport } from "../hooks/useExport";
import { pickVideoMime } from "../engine/export";
import { Popover } from "./ui/Popover";
import { TermProgress } from "./ui/Slider";
import { Icon } from "./ui/Icon";

const ZOOMS = [0.25, 0.5, 1, 2, 4];
const FORMATS: { v: ExportFormat; label: string }[] = [
  { v: "png", label: "PNG" },
  { v: "jpeg", label: "JPEG" },
  { v: "webp", label: "WEBP" },
  { v: "video", label: "VIDEO" },
];

/** Dropdown trigger + menu in the artboard bar. */
function Drop({ label, title, children, width = "min-w-[150px]" }: { label: ReactNode; title: string; children: (close: () => void) => ReactNode; width?: string }) {
  return (
    <Popover side="top" align="center" className={width} trigger={({ open, toggle }) => (
      <button className={`h-8 px-2.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] hover:bg-fg hover:text-bg ${open ? "bg-fg text-bg" : ""}`} title={title} onClick={toggle}>
        {label}<Icon name="chevronDown" />
      </button>
    )}>
      {children}
    </Popover>
  );
}

const Opt = ({ on, onClick, children, k }: { on?: boolean; onClick: () => void; children: ReactNode; k?: string }) => (
  <button className={`menu-item ${on ? "text-fg" : ""}`} onClick={onClick}>
    <span className="w-3">{on ? "●" : ""}</span><span className="flex-1">{children}</span>{k && <span className="kbd">{k}</span>}
  </button>
);

/**
 * Floating bar under the artboard: zoom, crop, compare, export format and EXPORT.
 * Everything that changes what leaves the app lives here, next to the image.
 */
export function ArtboardBar() {
  const aspect = useEditor((s) => s.aspect);
  const compare = useEditor((s) => s.compare);
  const format = useEditor((s) => s.exportFormat);
  const size = useEditor((s) => s.exportSize);
  const media = useEditor((s) => s.media);
  const ed = useEditor.getState();
  const zoom = useView((s) => s.zoom);
  const fit = useView((s) => s.fit);
  const view = useView.getState();
  const { run, cancel, progress } = useExport();
  const canVideo = !!pickVideoMime();

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-20 flex items-center panel h-10 px-1 gap-0.5 shadow-none max-w-[calc(100%-16px)] overflow-visible" style={{ background: "rgb(var(--bg))" }}>
      <Drop label={<span className="tabular-nums w-10 text-left">{fit ? "FIT" : `${Math.round(zoom * 100)}%`}</span>} title="Zoom — ctrl/alt + wheel or pinch on the artboard">
        {(close) => (
          <div onClick={close}>
            <Opt on={fit} onClick={() => view.reset()} k="F">Fit</Opt>
            {ZOOMS.map((z) => <Opt key={z} on={!fit && Math.abs(zoom - z) < 1e-3} onClick={() => view.set({ fit: false, zoom: z, panX: 0, panY: 0 })} k={z === 1 ? "1" : undefined}>{z * 100}%</Opt>)}
            <div className="hair-t my-1" />
            <Opt onClick={() => view.zoomBy(1.25)} k="+">Zoom in</Opt>
            <Opt onClick={() => view.zoomBy(0.8)} k="-">Zoom out</Opt>
          </div>
        )}
      </Drop>
      <span className="w-px h-5 bg-line" />
      <Drop label={<><Icon name="crop" /><span>{aspect === "original" ? "Orig" : aspect}</span></>} title="Crop" width="min-w-[120px]">
        {(close) => <div onClick={close}>{ASPECTS.map((a) => <Opt key={a.id} on={aspect === a.id} onClick={() => ed.set({ aspect: a.id })}>{a.label}</Opt>)}</div>}
      </Drop>
      <button
        className={`icon-btn ${compare ? "on" : ""}`}
        title="Hold to compare with the original [\]"
        onPointerDown={() => ed.set({ compare: true })}
        onPointerUp={() => ed.set({ compare: false })}
        onPointerLeave={() => compare && ed.set({ compare: false })}
      ><Icon name="compare" /></button>
      <span className="w-px h-5 bg-line" />
      <Drop label={<span>{FORMATS.find((f) => f.v === format)?.label}{format !== "video" && size !== "source" ? ` · ${EXPORT_SIZES.find((s) => s.id === size)?.label}` : ""}</span>} title="Export format and size" width="min-w-[180px]">
        {(close) => (
          <div>
            <div onClick={close}>
              {FORMATS.map((f) => <Opt key={f.v} on={format === f.v} onClick={() => (f.v !== "video" || canVideo) && ed.set({ exportFormat: f.v })}>{f.label}{f.v === "video" && !canVideo ? " (unsupported)" : ""}</Opt>)}
            </div>
            <div className="hair-t my-1" />
            <p className="px-3 pt-1 text-[10px] caps text-fg-muted">Size · long edge</p>
            <div onClick={close}>
              {EXPORT_SIZES.map((s) => <Opt key={s.id} on={size === s.id} onClick={() => ed.set({ exportSize: s.id })}>{s.label}</Opt>)}
            </div>
            <div className="hair-t my-1" />
            <button className="menu-item" onClick={() => { close(); useUI.getState().open({ type: "export" }); }}>More options…</button>
          </div>
        )}
      </Drop>
      {progress ? (
        <div className="flex items-center gap-2 pl-2 pr-1 min-w-[180px]">
          <span className="flex-1 text-[11px]"><TermProgress fraction={progress.fraction} /></span>
          <button className="btn-signal h-8" onClick={cancel}>Stop</button>
        </div>
      ) : (
        <button className="btn-primary h-8 ml-0.5" disabled={!media} onClick={() => void run()} title="Export [E]">
          <Icon name="download" />Export
        </button>
      )}
    </div>
  );
}
