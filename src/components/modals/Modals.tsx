import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import { TermProgress } from "../ui/Slider";
import { Symbol, Wordmark } from "../../brand/Marks";
import { usePrefs, useUI } from "../../state/ui";
import { useAccount } from "../../state/account";
import { useLibrary } from "../../state/library";
import { ASPECTS, EXPORT_SIZES, cropFor, stackIsAnimated, useEditor, type ExportFormat } from "../../state/editor";
import { useExport } from "../../hooks/useExport";
import { SHORTCUTS } from "../../hooks/useShortcuts";
import { exportBatch, pickVideoMime } from "../../engine/export";
import { downloadBlob } from "../../lib/media";
import { sourceFromUrl } from "../../lib/source";
import { NEWSLETTER_URL, REPO_URL, shareUrl, subscribeNewsletter } from "../../services/api";
import { LIBRARY } from "../../effects/registry";
import { BUILTIN_PRESETS } from "../../effects/presets";
import { UNSPLASH_URL } from "../../data/photos";

export function ModalHost() {
  const modal = useUI((s) => s.modal);
  const close = useUI((s) => s.close);
  if (!modal) return null;
  switch (modal.type) {
    case "profile": return <ProfileModal onClose={close} />;
    case "savePreset": return <SavePresetModal onClose={close} />;
    case "batch": return <BatchModal onClose={close} />;
    case "shortcuts": return <ShortcutsModal onClose={close} />;
    case "about": return <AboutModal onClose={close} />;
    case "sourceUrl": return <SourceUrlModal onClose={close} />;
    case "export": return <ExportModal onClose={close} />;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="caps text-[10px] text-fg-2">{label}</span>{children}</label>;
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex border border-line">
      {options.map((o) => (
        <button key={String(o.v)} disabled={o.disabled} className={`flex-1 h-7 text-[10px] caps disabled:opacity-30 ${value === o.v ? "bg-fg text-bg" : "text-fg-2 hover:text-fg"}`} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ── Export ──────────────────────────────────────────────────────────── */

function ExportModal({ onClose }: { onClose: () => void }) {
  const ed = useEditor();
  const { run, cancel, progress } = useExport();
  const media = ed.media;
  const crop = media ? cropFor(media, ed.aspect) : null;
  const canVideo = !!pickVideoMime();
  const targets: Record<string, number> = { source: 0, "1080": 1920, "4k": 3840, "8k": 7680, "16k": 15360 };
  const long = crop ? Math.max(crop.width, crop.height) : 0;
  const t = targets[ed.exportSize] || long;
  const outW = crop ? Math.round((crop.width * t) / long) : 0;
  const outH = crop ? Math.round((crop.height * t) / long) : 0;
  const isVideo = ed.exportFormat === "video";
  return (
    <Modal title="Export" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="Format">
          <Seg<ExportFormat> value={ed.exportFormat} onChange={(v) => ed.set({ exportFormat: v })} options={[
            { v: "png", label: "PNG" }, { v: "jpeg", label: "JPEG" }, { v: "webp", label: "WEBP" }, { v: "video", label: "Video", disabled: !canVideo },
          ]} />
        </Field>
        <Field label="Size (long edge)">
          <Seg value={ed.exportSize} onChange={(v) => ed.set({ exportSize: v })} options={EXPORT_SIZES.map((s) => ({ v: s.id, label: s.label, disabled: isVideo && (s.id === "8k" || s.id === "16k") }))} />
        </Field>
        <Field label="Crop">
          <select className="field h-7 caps text-[11px]" style={{ background: "rgb(var(--bg))" }} value={ed.aspect} onChange={(e) => ed.set({ aspect: e.target.value as typeof ed.aspect })}>
            {ASPECTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </Field>
        {(ed.exportFormat === "jpeg" || ed.exportFormat === "webp") && (
          <Field label={`Quality ${Math.round(ed.exportQuality * 100)}`}>
            <input type="range" min={0.5} max={1} step={0.01} value={ed.exportQuality} onChange={(e) => ed.set({ exportQuality: Number(e.target.value) })} className="accent-current" />
          </Field>
        )}
        {isVideo && media?.kind === "image" && (
          <Field label="Duration (seconds)">
            <input type="number" className="field" min={1} max={600} value={ed.duration} onChange={(e) => ed.set({ duration: Math.max(1, Math.min(600, Number(e.target.value) || 5)) })} />
            {!stackIsAnimated(ed.layers) && <span className="text-[10px] text-fg-muted">&gt; Nothing in the stack moves yet. Add an animated effect or keyframes.</span>}
          </Field>
        )}
        <div className="panel px-2 py-1.5 text-[11px] flex items-center justify-between" style={{ background: "var(--scr-bg)", color: "var(--scr-ink)" }}>
          <span className="font-screen text-[16px]">OUT {outW}×{outH}</span>
          <span className="font-screen text-[16px]">{isVideo ? "REALTIME · NO AUDIO" : ed.exportFormat.toUpperCase()}</span>
        </div>
        {progress ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[11px]"><TermProgress fraction={progress.fraction} /></span>
            {isVideo && <button className="btn-signal h-7" onClick={cancel}>Stop</button>}
          </div>
        ) : (
          <button className="btn-primary h-9" disabled={!media} onClick={() => void run()}><Icon name="download" />Export {isVideo ? "video" : "image"}</button>
        )}
        <p className="text-[10px] text-fg-muted">&gt; Free, no watermark, full resolution — limited only by your GPU.</p>
      </div>
    </Modal>
  );
}

/* ── Source URL ──────────────────────────────────────────────────────── */

function SourceUrlModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!/^https?:\/\//i.test(url.trim())) return;
    setBusy(true);
    const ok = await sourceFromUrl(url);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal title="Open from URL" onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Image or video URL">
          <input autoFocus className="field" placeholder="https://images.unsplash.com/photo-…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <p className="text-[10px] text-fg-muted">&gt; The host must allow cross-origin use (Unsplash, imgur, GitHub raw and most CDNs do). Otherwise download the file and drop it in.</p>
        <button className="btn-primary h-8" disabled={busy || !/^https?:\/\//i.test(url.trim())}>{busy ? "LOADING…" : "Load"}</button>
      </form>
    </Modal>
  );
}

/* ── Save preset ─────────────────────────────────────────────────────── */

function SavePresetModal({ onClose }: { onClose: () => void }) {
  const snapshot = useEditor((s) => s.snapshot);
  const layers = useEditor((s) => s.layers);
  const save = useLibrary((s) => s.savePreset);
  const [name, setName] = useState(layers.map((l) => l.name).slice(-2).join(" + ") || "Untitled");
  const submit = () => {
    // Cover = a small capture of the current artboard.
    let cover: string | undefined;
    const c = document.querySelector<HTMLCanvasElement>("[data-artboard] canvas");
    if (c && c.width) {
      const t = document.createElement("canvas");
      t.width = 240;
      t.height = 300;
      const g = t.getContext("2d")!;
      const s = Math.max(240 / c.width, 300 / c.height);
      g.drawImage(c, (240 - c.width * s) / 2, (300 - c.height * s) / 2, c.width * s, c.height * s);
      try { cover = t.toDataURL("image/jpeg", 0.8); } catch { /* tainted */ }
    }
    save(name.trim() || "Untitled", snapshot(), cover);
    useUI.getState().toast(`> PRESET SAVED — ${name.toUpperCase()}`, "success");
    usePrefs.getState().set({ libraryTab: "mine", libraryCollapsed: false });
    onClose();
  };
  return (
    <Modal title="Save preset" onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Name"><input autoFocus className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <p className="text-[10px] text-fg-muted">&gt; {layers.length} layer{layers.length === 1 ? "" : "s"}. Saved in this browser under MY PRESETS; export JSON there to back up or share.</p>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={async () => { await navigator.clipboard.writeText(shareUrl(snapshot())).catch(() => {}); useUI.getState().toast("> SHARE LINK COPIED", "success"); }}><Icon name="link" />Copy link</button>
          <button className="btn-primary flex-1"><Icon name="floppy" />Save</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Batch ───────────────────────────────────────────────────────────── */

function BatchModal({ onClose }: { onClose: () => void }) {
  const layers = useEditor((s) => s.layers);
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("jpeg");
  const [done, setDone] = useState<number | null>(null);
  const run = async () => {
    setDone(0);
    try {
      const zip = await exportBatch(files, layers, { format, quality: 0.92, onProgress: (d) => setDone(d) });
      downloadBlob(zip, "monitor-batch.zip");
      useUI.getState().toast(`> BATCH COMPLETE — ${files.length} files`, "success");
      onClose();
    } catch (e) {
      useUI.getState().toast(`> BATCH FAILED — ${(e as Error).message}`, "error");
      setDone(null);
    }
  };
  return (
    <Modal title="Batch export" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-fg-2">Apply the current {layers.length}-layer stack to many images at full resolution and download a ZIP.</p>
        <label className="btn h-16 border-dashed cursor-pointer">
          <Icon name="folder" />{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose images"}
          <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
        </label>
        <Seg value={format} onChange={setFormat} options={[{ v: "png", label: "PNG" }, { v: "jpeg", label: "JPEG" }, { v: "webp", label: "WEBP" }]} />
        {done !== null ? <span className="text-[11px]"><TermProgress fraction={done / Math.max(files.length, 1)} /> {done}/{files.length}</span> : (
          <button className="btn-primary h-8" disabled={!files.length || !layers.length} onClick={() => void run()}>Run batch</button>
        )}
      </div>
    </Modal>
  );
}

/* ── Profile (optional) ──────────────────────────────────────────────── */

function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, signIn, signOut, update } = useAccount();
  const presets = useLibrary((s) => s.presets.length);
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [newsletter, setNewsletter] = useState(profile?.newsletter ?? true);
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const p = { name: name.trim(), email: email.trim(), newsletter };
    if (profile) update(p); else signIn(p);
    if (newsletter && !profile?.newsletter) {
      try {
        const r = await subscribeNewsletter(p.name, p.email);
        useUI.getState().toast(r === "sent" ? "> SUBSCRIBED — release notes incoming" : "> PROFILE SAVED LOCALLY", "success");
      } catch (e) {
        useUI.getState().toast(`> SIGNUP FAILED — ${(e as Error).message}`, "error");
      }
    } else useUI.getState().toast("> PROFILE SAVED", "success");
    setBusy(false);
    onClose();
  };
  return (
    <Modal title="Profile" onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p className="text-[11px] text-fg-2 leading-relaxed">
          Optional. MONITOR is free and every feature works without an account. A profile names your saved presets
          {NEWSLETTER_URL ? " and can put you on the ARMGDN // LABS release-notes list." : "."} Everything else stays in this browser.
        </p>
        <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label="Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => setNewsletter(!newsletter)}>
          <span className={`w-3 h-3 border ${newsletter ? "bg-fg border-fg" : "border-line"}`} />
          <span className="caps text-[10px] text-fg-2">Send me release notes (rare, unsubscribe any time)</span>
        </button>
        <div className="flex gap-2">
          {profile && <button type="button" className="btn-signal" onClick={() => { signOut(); onClose(); }}>Sign out</button>}
          <button className="btn-primary flex-1" disabled={!valid || busy}>{profile ? "Update" : "Save profile"}</button>
        </div>
        {profile && <p className="text-[10px] text-fg-muted">&gt; {profile.name} · {presets} saved preset{presets === 1 ? "" : "s"} · since {profile.joinedAt.slice(0, 10)}</p>}
      </form>
    </Modal>
  );
}

/* ── Shortcuts / About ───────────────────────────────────────────────── */

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Shortcuts" onClose={onClose}>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px]">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="contents"><span className="kbd whitespace-nowrap">{k}</span><span className="text-fg-2 caps">{d}</span></div>
        ))}
      </div>
    </Modal>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About" onClose={onClose} width="max-w-lg">
      <div className="flex flex-col items-center text-center gap-3 py-3 grain-surface">
        <Symbol className="h-14" />
        <p className="font-serif text-[26px] tracking-[0.42em] pl-[0.42em]">MONITOR</p>
        <Wordmark className="h-3 opacity-80" />
        <p className="text-[10px] caps text-fg-muted tracking-[0.2em]">FX by ARMGDN // LABS</p>
        <p className="font-serif italic text-fg-2">The Chaos to Create.</p>
      </div>
      <div className="flex flex-col gap-2 text-[11px] text-fg-2 leading-relaxed hair-t pt-3">
        <p>An open-source FX engine for images and video: load media, stack {LIBRARY.length} GPU effects as layers, start from {BUILTIN_PRESETS.length} presets, export at full resolution. Free, no watermark, no locked features.</p>
        <p>Everything runs on your GPU in the browser via WebGL 2. Your media never leaves your machine.</p>
        <p>Sample photography from <a className="underline" href={UNSPLASH_URL} target="_blank" rel="noreferrer">Unsplash</a>, credited on every use.</p>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <img src="./brand/human-made.png" alt="Human made — not generated" className="w-20 h-20 pixelated" />
        <div className="flex flex-col gap-2 flex-1">
          <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer"><Icon name="github" />Source on GitHub</a>
          <span className="text-[10px] text-fg-muted caps">MIT licence · v2.0</span>
        </div>
      </div>
    </Modal>
  );
}

/* ── Toasts ──────────────────────────────────────────────────────────── */

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[120] flex flex-col gap-1 items-center pointer-events-none w-[min(92vw,640px)]" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-full text-left px-3 py-1.5 text-[11px] border ${t.tone === "error" ? "border-signal text-signal" : "border-line text-fg"}`}
          style={{ background: "rgb(var(--bg))" }}
        >
          <span className="truncate block">{t.message.startsWith(">") ? t.message : `> ${t.message}`}</span>
        </button>
      ))}
    </div>
  );
}
