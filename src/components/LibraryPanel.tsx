import { type ReactNode, useEffect, useRef, useState } from "react";
import { EFFECTS, getEffect, searchEffects } from "../effects/registry";
import { BUILTIN_PRESETS, PRESET_SECTIONS, type BuiltinPreset, type PresetSnapshot } from "../effects/presets";
import { CATEGORIES, defaultValues, type EffectDef } from "../effects/types";
import { originalUrl, useThumbStrip, useThumbnail } from "../engine/thumbnails";
import type { RenderLayer } from "../engine/Renderer";
import { useEditor } from "../state/editor";
import { useLibrary, type SavedPreset } from "../state/library";
import { usePrefs, useUI, type LibraryTab } from "../state/ui";
import { applyModulators } from "../lib/keyframes";
import { effectPreview, moodPhoto } from "../data/moods";
import { SHUFFLE_POOL } from "../data/photos";
import { shareUrl } from "../services/api";
import { downloadBlob } from "../lib/media";
import { Icon } from "./ui/Icon";

/* ── helpers ─────────────────────────────────────────────────────────── */

const effectLayers = (e: EffectDef) => (): RenderLayer[] => [{ id: `thumb-${e.id}`, effect: e, values: defaultValues(e), opacity: 1, blend: 0, seed: 3 }];

/** Snapshot → render layers; with `t`, modulators are applied (used by scrub strips). */
const snapshotLayers = (snap: PresetSnapshot, key: string) => (): RenderLayer[] =>
  snap.graph.flatMap((g, i) => {
    const e = getEffect(g.id);
    if (!e || g.isOn === false) return [];
    const values = { ...defaultValues(e), ...(g.values ?? {}) };
    return [{
      id: `thumb-${key}-${i}`, effect: e,
      values: g.mods ? applyModulators(e, values, g.mods, 1.25, 5) : values,
      opacity: g.opacity ?? 1, blend: g.blend ?? 0, seed: g.seed ?? 3,
      pre: (g.pre as RenderLayer["pre"]) ?? null, mask: (g.mask as RenderLayer["mask"]) ?? null,
    }];
  });

const effectMoves = (e: EffectDef | undefined) => !!e && (!!e.animated || e.passes.some((p) => p.feedback));
const snapshotMoves = (s: PresetSnapshot) => s.graph.some((g) => effectMoves(getEffect(g.id)) || !!g.mods || !!g.keyframes);

function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible] as const;
}

const copy = async (text: string, what: string) => {
  try { await navigator.clipboard.writeText(text); useUI.getState().toast(`> ${what} COPIED TO CLIPBOARD`, "success"); }
  catch { useUI.getState().toast("> CLIPBOARD BLOCKED", "error"); }
};

const effectPreset = (e: EffectDef): PresetSnapshot => ({ version: 1, graph: [{ id: e.id, values: defaultValues(e) }] });

/* ── cards ───────────────────────────────────────────────────────────── */

interface CardProps {
  thumbKey: string;
  photo: string;
  layers: () => RenderLayer[];
  name: string;
  sub?: string;
  /** Animated items scrub through their loop on hover; still ones show the untouched photo. */
  moves?: boolean;
  favorite?: boolean;
  onFavorite?: () => void;
  onShare?: () => void;
  onClick: (e: React.MouseEvent) => void;
  cover?: string;
  extra?: ReactNode;
  title?: string;
}

function Card({ thumbKey, photo, layers, name, sub, moves, favorite, onFavorite, onShare, onClick, cover, extra, title }: CardProps) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [hover, setHover] = useState(false);
  const [scrub, setScrub] = useState(0);
  const rendered = useThumbnail(thumbKey, photo, layers, visible && !cover);
  const strip = useThumbStrip(thumbKey, photo, layers, hover && !!moves && !cover);
  const still = cover ?? rendered;
  const frame = hover && moves && strip?.length ? strip[Math.min(strip.length - 1, Math.floor(scrub * strip.length))] : undefined;
  const showOriginal = hover && !moves && !cover;
  return (
    <div ref={ref} className="group min-w-0" title={title}>
      <div
        className="relative w-full aspect-[4/5] overflow-hidden border border-line group-hover:border-fg cursor-pointer"
        style={{ background: "rgb(var(--bg-raised))" }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => { setHover(false); setScrub(0); }}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setScrub(Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width))); }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onClick(e as unknown as React.MouseEvent); }}
      >
        {still ? <img src={frame ?? still} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} /> : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] caps text-fg-muted">
            {still === "" ? "NO SIGNAL" : <span className="blink">_</span>}
          </div>
        )}
        {showOriginal && still && (
          <>
            <img src={originalUrl(photo)} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            <span className="absolute left-1.5 bottom-1.5 tag-solid">Original</span>
          </>
        )}
        {hover && moves && (
          <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-void/40">
            <div className="h-full bg-signal" style={{ width: `${scrub * 100}%` }} />
          </div>
        )}
        {onShare && (
          <button className="card-btn left-1 top-1" title="Copy share link" onClick={(e) => { e.stopPropagation(); onShare(); }}><Icon name="link" /></button>
        )}
        {onFavorite && (
          <button className={`card-btn right-1 top-1 ${favorite ? "on" : ""}`} title={favorite ? "Remove from favourites" : "Add to favourites"} onClick={(e) => { e.stopPropagation(); onFavorite(); }}>
            <Icon name="heart" />
          </button>
        )}
        {extra}
      </div>
      <div className="pt-1.5 min-h-[30px]">
        <p className="truncate text-[11px] caps text-fg-2 group-hover:text-fg leading-tight">{name}</p>
        {sub && <p className="truncate text-[10px] text-fg-muted leading-tight mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EffectCard({ e }: { e: EffectDef }) {
  const favs = useLibrary((s) => s.favorites);
  const toggle = useLibrary((s) => s.toggleFavorite);
  return (
    <Card
      thumbKey={`fx:${e.id}`}
      photo={effectPreview(e)}
      layers={effectLayers(e)}
      name={e.name}
      moves={effectMoves(e)}
      title={e.description}
      favorite={favs.includes(e.id)}
      onFavorite={() => toggle(e.id)}
      onShare={() => copy(shareUrl(effectPreset(e)), "LINK")}
      onClick={() => { useEditor.getState().addLayer(e.id); useUI.getState().toast(`> FX.${e.id.toUpperCase()} ADDED`); }}
    />
  );
}

function PresetCard({ p }: { p: BuiltinPreset }) {
  const favs = useLibrary((s) => s.favorites);
  const toggle = useLibrary((s) => s.toggleFavorite);
  const key = `preset:${p.id}`;
  return (
    <Card
      thumbKey={key}
      photo={moodPhoto(p.moods, p.id)}
      layers={snapshotLayers(p.snapshot, p.id)}
      name={p.name}
      sub={`${p.snapshot.graph.length} layer${p.snapshot.graph.length === 1 ? "" : "s"}`}
      moves={snapshotMoves(p.snapshot)}
      title={p.snapshot.graph.map((g) => getEffect(g.id)?.name ?? g.id).join(" → ")}
      favorite={favs.includes(key)}
      onFavorite={() => toggle(key)}
      onShare={() => copy(shareUrl(p.snapshot), "LINK")}
      onClick={() => { useEditor.getState().applySnapshot(p.snapshot, "group", p.name); useUI.getState().toast(`> PRESET // ${p.name.toUpperCase()} ADDED`); }}
    />
  );
}

function MyPresetCard({ p }: { p: SavedPreset }) {
  const rename = useLibrary((s) => s.renamePreset);
  const remove = useLibrary((s) => s.deletePreset);
  return (
    <Card
      thumbKey={`mine:${p.id}`}
      photo={SHUFFLE_POOL[0]?.key ?? "film:0"}
      layers={snapshotLayers(p.snapshot, p.id)}
      cover={p.cover}
      name={p.name}
      sub={`${p.snapshot.graph.length} layers`}
      onShare={() => copy(shareUrl(p.snapshot), "LINK")}
      onClick={() => useEditor.getState().applySnapshot(p.snapshot, "group", p.name)}
      extra={
        <div className="absolute right-1 bottom-1 flex gap-0.5">
          <button className="card-btn !static" title="Rename" onClick={(e) => { e.stopPropagation(); const n = prompt("Rename preset", p.name); if (n?.trim()) rename(p.id, n.trim()); }}><Icon name="terminal" /></button>
          <button className="card-btn !static hover:!bg-signal hover:!text-bone" title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${p.name}"?`)) remove(p.id); }}><Icon name="trash" /></button>
        </div>
      }
    />
  );
}

/* ── grids ───────────────────────────────────────────────────────────── */

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="slash text-[11px] caps text-fg mb-2 flex items-center gap-2">{title}{count !== undefined && <span className="text-fg-muted">{count}</span>}</h3>
      {children}
    </section>
  );
}

function Grid({ children, cols }: { children: ReactNode; cols: string }) {
  return <div className={`grid gap-x-2 gap-y-3 ${cols}`}>{children}</div>;
}

const ALL = "all";
/** Tag filters per tab: effect categories, preset sections. */
export function filtersFor(tab: LibraryTab): string[] {
  if (tab === "effects") return [ALL, ...CATEGORIES];
  if (tab === "presets") return [ALL, ...PRESET_SECTIONS];
  return [];
}

export function LibraryContent({ tab, query, filter, cols }: { tab: LibraryTab; query: string; filter: string; cols: string }) {
  const favs = useLibrary((s) => s.favorites);
  const mine = useLibrary((s) => s.presets);
  const q = query.trim().toLowerCase();

  if (tab === "effects") {
    if (q) {
      const list = searchEffects(q);
      return list.length ? <Section title="Results" count={list.length}><Grid cols={cols}>{list.map((e) => <EffectCard key={e.id} e={e} />)}</Grid></Section> : <Empty line="NO MATCH" hint="Try a mood, a decade or a medium: tape, ink, 90s, glass." />;
    }
    const cats = filter === ALL ? CATEGORIES : CATEGORIES.filter((c) => c === filter);
    return (
      <>
        {cats.map((c) => {
          const list = EFFECTS.filter((e) => e.category === c);
          return <Section key={c} title={c} count={list.length}><Grid cols={cols}>{list.map((e) => <EffectCard key={e.id} e={e} />)}</Grid></Section>;
        })}
      </>
    );
  }

  if (tab === "presets") {
    const match = (p: BuiltinPreset) => !q || `${p.name} ${p.section} ${p.snapshot.graph.map((g) => `${g.id} ${getEffect(g.id)?.name ?? ""}`).join(" ")}`.toLowerCase().includes(q);
    const sections = filter === ALL || q ? PRESET_SECTIONS : PRESET_SECTIONS.filter((s) => s === filter);
    const any = BUILTIN_PRESETS.some(match);
    if (!any) return <Empty line="NO MATCH" hint="Search by name or by an effect inside the preset." />;
    return (
      <>
        {sections.map((s) => {
          const list = BUILTIN_PRESETS.filter((p) => p.section === s && match(p));
          if (!list.length) return null;
          return <Section key={s} title={s} count={list.length}><Grid cols={cols}>{list.map((p) => <PresetCard key={p.id} p={p} />)}</Grid></Section>;
        })}
      </>
    );
  }

  if (tab === "favorites") {
    const fx = EFFECTS.filter((e) => favs.includes(e.id) && (!q || e.name.toLowerCase().includes(q)));
    const pr = BUILTIN_PRESETS.filter((p) => favs.includes(`preset:${p.id}`) && (!q || p.name.toLowerCase().includes(q)));
    if (!fx.length && !pr.length) return <Empty line="NO FAVOURITES YET" hint="Hover any card and press the heart in its corner." />;
    return (
      <>
        {pr.length > 0 && <Section title="Presets" count={pr.length}><Grid cols={cols}>{pr.map((p) => <PresetCard key={p.id} p={p} />)}</Grid></Section>}
        {fx.length > 0 && <Section title="Effects" count={fx.length}><Grid cols={cols}>{fx.map((e) => <EffectCard key={e.id} e={e} />)}</Grid></Section>}
      </>
    );
  }

  const list = mine.filter((p) => !q || p.name.toLowerCase().includes(q));
  return (
    <>
      <MyPresetTools />
      {list.length ? (
        <Grid cols={cols}>{list.map((p) => <MyPresetCard key={p.id} p={p} />)}</Grid>
      ) : (
        <Empty line="NO SAVED PRESETS" hint="Build a stack, then save it from // LAYERS." />
      )}
    </>
  );
}

function MyPresetTools() {
  const presets = useLibrary((s) => s.presets);
  const importPresets = useLibrary((s) => s.importPresets);
  const hasLayers = useEditor((s) => s.layers.length > 0);
  return (
    <div className="flex gap-1 mb-3">
      <button className="btn flex-1" disabled={!hasLayers} onClick={() => useUI.getState().open({ type: "savePreset" })}><Icon name="floppy" />Save current</button>
      <button className="btn px-2" title="Export all as JSON" disabled={!presets.length} onClick={() => downloadBlob(new Blob([JSON.stringify(presets, null, 2)], { type: "application/json" }), "monitor-presets.json")}><Icon name="download" /></button>
      <button className="btn px-2" title="Import JSON" onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return;
          try { const n = importPresets(JSON.parse(await f.text())); useUI.getState().toast(`> IMPORTED ${n} PRESET${n === 1 ? "" : "S"}`, "success"); }
          catch { useUI.getState().toast("> NOT A MONITOR PRESET FILE", "error"); }
        };
        input.click();
      }}><Icon name="upload" /></button>
    </div>
  );
}

function Empty({ line, hint }: { line: string; hint: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[11px] caps">&gt; {line}<span className="blink">_</span></p>
      <p className="text-[11px] text-fg-muted mt-1">{hint}</p>
    </div>
  );
}

export const TABS: { id: LibraryTab; label: string }[] = [
  { id: "presets", label: "Presets" },
  { id: "effects", label: "Effects" },
  { id: "mine", label: "My presets" },
];

/**
 * Tabs with a search icon on the right. Pressing it swaps the tabs for a search field in the
 * same row; Escape or × brings the tabs back.
 */
export function LibraryHeader({ tab, onTab, query, onQuery, trailing }: { tab: LibraryTab; onTab: (t: LibraryTab) => void; query: string; onQuery: (q: string) => void; trailing?: ReactNode }) {
  const [searching, setSearching] = useState(false);
  const favs = useLibrary((s) => s.favorites.length);
  const close = () => { setSearching(false); onQuery(""); };
  return (
    <div className="flex items-center h-10 gap-0.5">
      {searching ? (
        <label className="flex-1 flex items-center gap-2 h-8 px-2 border border-fg">
          <Icon name="search" className="text-fg-muted" />
          <input
            autoFocus
            className="flex-1 min-w-0 bg-transparent outline-none text-[12px] placeholder:text-fg-muted"
            placeholder="Search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") close(); }}
          />
          <button className="icon-btn w-6 h-6" title="Close search" onClick={close}><Icon name="close" /></button>
        </label>
      ) : (
        <>
          <div className="flex items-center flex-1 min-w-0 overflow-x-auto no-scrollbar">
            {TABS.map((t) => <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => onTab(t.id)}>{t.label}</button>)}
          </div>
          <button className={`icon-btn ${tab === "favorites" ? "on" : ""}`} title={`Favourites (${favs})`} onClick={() => onTab(tab === "favorites" ? "presets" : "favorites")}><Icon name="heart" /></button>
          <button className="icon-btn" title="Search" onClick={() => setSearching(true)}><Icon name="search" /></button>
        </>
      )}
      {trailing}
    </div>
  );
}

export function TagFilters({ tab, value, onChange }: { tab: LibraryTab; value: string; onChange: (v: string) => void }) {
  const tags = filtersFor(tab);
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 pb-2">
      {tags.map((t) => <button key={t} className={`chip ${value === t ? "on" : ""}`} onClick={() => onChange(t)}>{t === ALL ? "All" : t}</button>)}
    </div>
  );
}

function useLibraryNav() {
  const tab = usePrefs((s) => s.libraryTab);
  const filters = usePrefs((s) => s.libraryFilter) ?? {};
  const setPrefs = usePrefs((s) => s.set);
  const filter = filters[tab] ?? ALL;
  return {
    tab,
    filter: filtersFor(tab).includes(filter) ? filter : ALL,
    setTab: (t: LibraryTab) => setPrefs({ libraryTab: t }),
    setFilter: (f: string) => setPrefs({ libraryFilter: { ...usePrefs.getState().libraryFilter, [tab]: f } }),
  };
}

/* ── side panel ──────────────────────────────────────────────────────── */

export function LibraryPanel() {
  const { tab, filter, setTab, setFilter } = useLibraryNav();
  const collapsed = usePrefs((s) => s.libraryCollapsed);
  const width = usePrefs((s) => s.libraryWidth);
  const setPrefs = usePrefs((s) => s.set);
  const [query, setQuery] = useState("");
  const cols = width > 460 ? "grid-cols-3" : width > 200 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="ph hair-b">
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setPrefs({ libraryCollapsed: !collapsed })} title="Collapse / expand [L]">
          <Icon name={collapsed ? "chevronRight" : "chevronDown"} />
          <span className="slash truncate">Library</span>
        </button>
        <button className="icon-btn" title="Open the full library [B]" onClick={() => useUI.getState().setBrowser(true)}><Icon name="fit" /></button>
      </div>
      {!collapsed && (
        <>
          <div className="px-2 shrink-0">
            <LibraryHeader tab={tab} onTab={setTab} query={query} onQuery={setQuery} />
            {!query && <TagFilters tab={tab} value={filter} onChange={setFilter} />}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-1">
            <LibraryContent tab={tab} query={query} filter={filter} cols={cols} />
          </div>
        </>
      )}
    </div>
  );
}

/* ── full-screen browser (the expanded grid) ─────────────────────────── */

export function LibraryBrowser() {
  const open = useUI((s) => s.browserOpen);
  const setOpen = useUI((s) => s.setBrowser);
  const { tab, filter, setTab, setFilter } = useLibraryNav();
  const [query, setQuery] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: "rgb(var(--bg))" }}>
      <div className="flex items-center gap-3 px-4 hair-b shrink-0">
        <span className="slash text-[11px] caps shrink-0">Library</span>
        <div className="flex-1 max-w-xl"><LibraryHeader tab={tab} onTab={setTab} query={query} onQuery={setQuery} /></div>
        <button className="btn ml-auto" onClick={() => setOpen(false)}><Icon name="close" />Close <span className="kbd">ESC</span></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        <div className="max-w-[1500px] mx-auto">
          {!query && <TagFilters tab={tab} value={filter} onChange={setFilter} />}
          <div className="pt-2">
            <LibraryContent tab={tab} query={query} filter={filter} cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7" />
          </div>
        </div>
      </div>
    </div>
  );
}
