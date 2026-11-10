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

/** The ARMGDN site this app lives under (relative, so it works on any host). */
export const SITE_URL = "/";

function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  return (
    <Popover trigger={({ open, toggle }) => <button className={`tab ${open ? "on" : ""}`} onClick={toggle}>{label}</button>}>
      {(close) => <div onClick={close}>{children(close)}</div>}
    </Popover>
  );
}

const Item = ({ onClick, children, k, disabled }: { onClick: () => void; children: ReactNode; k?: string; disabled?: boolean }) => (
  <button className="menu-item disabled:opacity-40" disabled={disabled} onClick={onClick}>
    <span className="flex-1">{children}</span>{k && <span className="kbd">{k}</span>}
  </button>
);

/** App bar: ARMGDN mark (home) + menus, the Monitor wordmark (about), utilities. */
export function TopBar() {
  const ui = useUI.getState();
  const prefs = usePrefs();
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const hasLayers = useEditor((s) => s.layers.length > 0);
  const job = useExportJob((s) => s.progress);
  const profile = useAccount((s) => s.profile);
  const ed = useEditor.getState();
  const dark = prefs.theme === "dark";

  return (
    <header className="relative grid grid-cols-[1fr_auto_1fr] items-center h-14 shrink-0 px-3 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <a className="icon-btn w-10 h-10 shrink-0" href={SITE_URL} title="ARMGDN home">
          <Symbol className="h-6" />
        </a>
        <nav className="seg hidden md:inline-flex">
          <Menu label="File">{() => (
            <>
              <Item onClick={openFilePicker} k="O">Open media…</Item>
              <Item onClick={() => void shuffleSource()} k="S">Shuffle photo</Item>
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
              <Item onClick={() => prefs.set({ theme: dark ? "light" : "dark" })} k="T">{dark ? "Light" : "Dark"} mode</Item>
              <Item onClick={() => prefs.set({ previewQuality: prefs.previewQuality === 1 ? 0.5 : 1 })}>Preview: {prefs.previewQuality === 1 ? "full" : "draft"} quality</Item>
              <Item onClick={() => ui.open({ type: "shortcuts" })} k="?">Keyboard shortcuts</Item>
            </>
          )}</Menu>
        </nav>
      </div>

      <button className="select-none px-2" onClick={() => ui.open({ type: "about" })} title="About Monitor">
        <span className="wordmark text-[26px] leading-none">Monitor.<sup>(fx)</sup></span>
      </button>

      <div className="flex items-center justify-end gap-2 min-w-0">
        {job && (
          <span className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full bg-signal text-bone text-[12px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-bone blink" />{job.label} <span className="tabular-nums">{Math.round(job.fraction * 100)}%</span>
          </span>
        )}
        <div className="seg hidden sm:inline-flex">
          <button className="icon-btn w-7 h-7" title="Undo [⌘Z]" disabled={!past} onClick={ed.undo}><Icon name="undo" /></button>
          <button className="icon-btn w-7 h-7" title="Redo [⇧⌘Z]" disabled={!future} onClick={ed.redo}><Icon name="redo" /></button>
        </div>
        <button className="theme-toggle" title={`${dark ? "Light" : "Dark"} mode [T]`} aria-label="Switch light or dark" onClick={() => prefs.set({ theme: dark ? "light" : "dark" })}>
          <span className="theme-toggle__knob" />
        </button>
        <a className="icon-btn hidden sm:inline-flex" href={REPO_URL} target="_blank" rel="noreferrer" title="Source on GitHub"><Icon name="github" /></a>
        <button className={`icon-btn ${profile ? "on" : ""}`} title={profile ? `Signed in as ${profile.name}` : "Profile (optional)"} onClick={() => ui.open({ type: "profile" })}><Icon name="user" /></button>
      </div>
    </header>
  );
}
