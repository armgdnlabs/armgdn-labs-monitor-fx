import type { ReactNode } from "react";
import { Symbol } from "../brand/Marks";
import { useEditor } from "../state/editor";
import { usePrefs, useUI } from "../state/ui";
import { useView } from "../state/view";
import { useAccount } from "../state/account";
import { useExportJob } from "../hooks/useExport";
import { openFilePicker, shuffleSource } from "../lib/source";
import { REPO_URL } from "../services/api";
import { Popover } from "./ui/Popover";
import { Icon } from "./ui/Icon";

function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  return (
    <Popover trigger={({ open, toggle }) => <button className={`tab h-11 px-2.5 ${open ? "on" : ""}`} onClick={toggle}>{label}</button>}>
      {(close) => <div onClick={close}>{children(close)}</div>}
    </Popover>
  );
}

const Item = ({ onClick, children, k, disabled }: { onClick: () => void; children: ReactNode; k?: string; disabled?: boolean }) => (
  <button className="menu-item disabled:opacity-40" disabled={disabled} onClick={onClick}>
    <span className="flex-1">{children}</span>{k && <span className="kbd">{k}</span>}
  </button>
);

/** App bar: brand mark + menus (left), MONITOR wordmark (centre), utilities (right). */
export function TopBar() {
  const ui = useUI.getState();
  const prefs = usePrefs();
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const hasLayers = useEditor((s) => s.layers.length > 0);
  const job = useExportJob((s) => s.progress);
  const profile = useAccount((s) => s.profile);
  const ed = useEditor.getState();

  return (
    <header className="relative grid grid-cols-[1fr_auto_1fr] items-center h-11 hair-b shrink-0 px-2">
      <div className="flex items-center min-w-0">
        <button className="icon-btn w-9 h-9 mr-1" onClick={() => ui.open({ type: "about" })} title="About MONITOR — ARMGDN LABS">
          <Symbol className="h-6" />
        </button>
        <span className="hidden lg:inline text-fg-muted mr-1">//</span>
        <nav className="hidden md:flex items-center">
          <Menu label="File">{() => (
            <>
              <Item onClick={openFilePicker} k="O">Open media…</Item>
              <Item onClick={() => void shuffleSource()} k="S">Shuffle Unsplash photo</Item>
              <Item onClick={() => ui.open({ type: "sourceUrl" })}>Open from URL…</Item>
              <Item onClick={() => ui.open({ type: "savePreset" })} disabled={!hasLayers}>Save as preset…</Item>
              <Item onClick={() => ui.open({ type: "batch" })}>Batch export…</Item>
              <Item onClick={() => ui.open({ type: "export" })} k="E">Export…</Item>
            </>
          )}</Menu>
          <Menu label="Edit">{() => (
            <>
              <Item onClick={ed.undo} k="⌘Z" disabled={!past}>Undo</Item>
              <Item onClick={ed.redo} k="⇧⌘Z" disabled={!future}>Redo</Item>
              <Item onClick={ed.clearLayers} disabled={!hasLayers}>Clear all layers</Item>
            </>
          )}</Menu>
          <Menu label="View">{() => (
            <>
              <Item onClick={() => useView.getState().reset()} k="F">Fit artboard</Item>
              <Item onClick={() => useView.getState().set({ fit: false, zoom: 1, panX: 0, panY: 0 })} k="1">Actual pixels</Item>
              <Item onClick={() => prefs.set({ libraryCollapsed: !prefs.libraryCollapsed })} k="L">{prefs.libraryCollapsed ? "Expand" : "Collapse"} library</Item>
              <Item onClick={() => ui.setBrowser(true)} k="B">Library browser</Item>
              <Item onClick={() => ed.set({ timelineOpen: !useEditor.getState().timelineOpen })}>Toggle timeline</Item>
              <Item onClick={() => prefs.set({ theme: prefs.theme === "dark" ? "light" : "dark" })} k="T">{prefs.theme === "dark" ? "Light" : "Dark"} mode</Item>
              <Item onClick={() => prefs.set({ previewQuality: prefs.previewQuality === 1 ? 0.5 : 1 })}>Preview: {prefs.previewQuality === 1 ? "full" : "draft"} quality</Item>
              <Item onClick={() => ui.open({ type: "shortcuts" })} k="?">Keyboard shortcuts</Item>
            </>
          )}</Menu>
        </nav>
      </div>

      <button className="flex items-baseline gap-3 px-2 select-none" onClick={() => ui.open({ type: "about" })} title="MONITOR by ARMGDN // LABS">
        <span className="wordmark text-[17px] sm:text-[19px] leading-none">MONITOR</span>
        <span className="hidden sm:inline font-serif text-[11px] uppercase tracking-[0.28em] text-fg-2 leading-none">
          <i className="normal-case tracking-normal text-fg-muted mr-1.5">by</i>ARMGDN <span className="text-fg-muted">//</span> LABS
        </span>
      </button>

      <div className="flex items-center justify-end gap-0.5 min-w-0">
        {job && (
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] caps text-signal mr-2">
            <span className="w-2 h-2 bg-signal blink" />{job.label} {Math.round(job.fraction * 100)}%
          </span>
        )}
        <button className="icon-btn hidden sm:inline-flex" title="Undo [⌘Z]" disabled={!past} onClick={ed.undo}><Icon name="undo" /></button>
        <button className="icon-btn hidden sm:inline-flex" title="Redo [⇧⌘Z]" disabled={!future} onClick={ed.redo}><Icon name="redo" /></button>
        <span className="w-px h-5 bg-line mx-1 hidden sm:block" />
        <button className="icon-btn" title={`${prefs.theme === "dark" ? "Light" : "Dark"} mode [T]`} onClick={() => prefs.set({ theme: prefs.theme === "dark" ? "light" : "dark" })}><Icon name="contrast" /></button>
        <a className="icon-btn hidden sm:inline-flex" href={REPO_URL} target="_blank" rel="noreferrer" title="Source on GitHub"><Icon name="github" /></a>
        <button className={`icon-btn ${profile ? "on" : ""}`} title={profile ? `Signed in as ${profile.name}` : "Profile (optional)"} onClick={() => ui.open({ type: "profile" })}><Icon name="user" /></button>
      </div>
    </header>
  );
}
