# DESIGN.md — ARMGDN // LABS · FX tool

> Drop this file in the repo root and reference it from `CLAUDE.md`:
> `Read DESIGN.md before touching any UI. Pull assets from the Figma file it links.`

## 1. The product in one line
An open-source, browser-based FX engine for images and video (effect.app-class): **load media → stack effects as layers → tweak → export.** Built by ARMGDN // LABS. It should feel like **lab equipment, not a SaaS dashboard.**

## 2. The feel
**A brutalist monochrome shell with a CRT/terminal soul.**
- **The shell** (chrome, panels, nav) is quiet: near-black, bone-white type, hairline borders, square corners and lots of air. It is wide-tracked serif for identity and monospace for everything functional.
- **The instrument** (the canvas and the FX) is where the chaos lives: pixel, dither, scanline, bloom, glitch. The UI frames the chaos and never competes with it.
- **Red is a signal, not a colour.** Use it only for live, recording, armed, active or destructive states, and for at most one thing on screen at a time.
- **Motto, used sparingly:** *The Chaos to Create.*

Reference points: a Game Boy boot screen, a rack-mounted synth, a 2001 file manager, an underground record label's catalogue sheet.

## 3. Figma source of truth
File: **ARMGDN — Brand System** · `https://www.figma.com/design/hB1ezCMW5DEn7Fryf1E1E9`
Use the Figma MCP (`get_design_context`, `get_variable_defs`, `get_screenshot`) on these nodes. In URLs, swap `:` for `-`, e.g. `?node-id=16-5`.

| What | Node | Use in the app |
|---|---|---|
| Foundations page (colour, type, spacing) | `1:2` | Tokens below |
| Symbol (A + circle) | `2:8`, clean `2:14` | App icon, loader, empty states |
| Wordmark | `2:25` | Top-left of the app bar |
| Lock-ups (Labs/Header) | `15:150` | Splash, About, export watermark |
| Tags `// LABS` set | `15:89` (Slash, Chip, Solid, Terminal, Pixel) | Layer types, badges, effect categories |
| UI kit section | `16:4` | Terminal Window `16:5`, Progress `16:20`, Status Bar `16:40`, Button `16:56`, Knob `16:57`, Meter `16:63` |
| Icons, 30 pixel icons | `10:56`–`10:143` | Toolbar and transport (play, pause, loop, record, folder, download, eye, lock, restart, terminal…) |
| Pixel kit and patterns | `10:4` (Scanlines `10:144`, Dither `10:148`, Halftone `10:156`, Grid `10:158`) | Panel textures and default FX presets |
| FX previews | `18:8` (CRT, LCD, Phosphor, Dither Halo, Glitch Cut) | Built-in preset thumbnails and the look of the canvas |
| Badges | `16:80` Human Made, `16:104` Restart Sticker | About and export screens |
| Applications page | `9:45` | Mockups for tone, not for literal layouts |

Export icons and marks as SVG. Don't redraw them, and don't swap in Lucide or Heroicons.

## 4. Tokens (mirror the Figma variables exactly)
```css
:root {                       /* Dark is the default theme */
  --void:#0A0A0A; --ink:#1E1E1E; --ash-900:#262523; --ash-700:#4A4845;
  --ash-500:#85827D; --ash-300:#BDB9B2; --bone-200:#EDE7DF; --bone:#F7F2EC;
  --signal:#D3202A;

  --bg:var(--void); --bg-raised:var(--ash-900); --fg:var(--bone);
  --fg-2:var(--ash-300); --fg-muted:var(--ash-500); --border:var(--ash-700);

  --s1:4px; --s2:8px; --s3:16px; --s4:24px; --s5:32px; --s6:48px; --s7:64px; --s8:96px; --s9:128px;
  --radius:0;  --hair:1px solid var(--border);
}
[data-theme="light"] { --bg:var(--bone); --bg-raised:var(--bone-200); --fg:var(--void);
  --fg-2:var(--ash-700); --border:var(--ash-300); }

/* "Screen" modes apply to the canvas frame, scopes and meters only, never the shell */
[data-screen="mono"]     { --scr-bg:#0A0A0A; --scr-ink:#F7F2EC; --scr-mid:#85827D; --scr-dim:#4A4845; }
[data-screen="lcd"]      { --scr-bg:#0F380F; --scr-ink:#9BBC0F; --scr-mid:#8BAC0F; --scr-dim:#306230; }
[data-screen="phosphor"] { --scr-bg:#0A0A0A; --scr-ink:#FF3B2F; --scr-mid:#B5241B; --scr-dim:#5C1612; }
[data-screen="analog"]   { --scr-bg:#E9E1D3; --scr-ink:#1E1B17; --scr-mid:#5E574C; --scr-dim:#9C9385; }
```

## 5. Type
| Role | Font | Spec |
|---|---|---|
| Identity / headings | **Tinos** (wide-tracked Roman serif) | UPPERCASE, tracking 0.12–0.5em, used rarely: splash, panel titles, empty states |
| UI, labels, values, everything functional | **JetBrains Mono** | 11–14px. Labels UPPERCASE at +4–8% tracking. Numbers tabular |
| Tags / badges | **Silkscreen** or Mono Medium | 12px UPPERCASE, `// LABS` style |
| Screen readouts (timecode, FPS, status) | **VT323** | Inside the canvas frame or status bar only |
| Easter eggs only | Doto, Sixtyfour, UnifrakturMaguntia | Never in core UI |

All are on Google Fonts. The `//` prefix is a typographic device: `// LAYERS`, `// EXPORT`, `// FX.DITHER`. Always use mono with a space after it, and set the slashes in `--fg-muted`.

## 6. Layout (desktop first; mobile is view and export only)
```
┌────────────────────────────────────────────────────────────────────┐
│ [A◯] ARMGDN // LABS  FX        file  edit  view     ● REC   [EXPORT]│  app bar 40px, hairline bottom
├──────────┬──────────────────────────────────────────┬──────────────┤
│ // LAYERS│                                          │ // PARAMS    │
│ ▣ SOURCE │            CANVAS (screen frame)          │ DITHER  ▸    │
│ ▣ DITHER │   checkerboard → media, scanline overlay │ size  ▮▮▮▯ 4 │
│ ▣ BLOOM  │   corner ticks, no rounded card          │ mix   ▮▮▯▯ 50│
│ + ADD FX │                                          │ [knob][knob] │
│ // PRESETS                                          │ // BLEND     │
├──────────┴──────────────────────────────────────────┴──────────────┤
│ ▶ ❚❚ ⟲  00:00:04:12 ─────────●──────────── 00:00:10:00   24FPS 2160²│  transport / timeline, VT323 readout
└────────────────────────────────────────────────────────────────────┘
```
- Panels are 1px hairline boxes on `--bg`, not cards: no shadows, no rounding, no blur glass.
- Panel headers are `// NAME` in mono caption, with an optional right-aligned count or status.
- The canvas is the only thing allowed to glow. Wrap it in a "screen" frame with corner registration ticks and an optional scanline overlay toggle.
- The status bar (`16:40`) shows resolution, fps, GPU, render time and a blinking `_` cursor when idle.

## 7. Components and behaviour
- **Buttons:** rectangle, mono UPPERCASE. Primary is bone fill with void text. Secondary is a hairline outline. Danger and record use a `--signal` outline. Hover inverts. Press nudges 1px, with no transitions longer than 80ms.
- **Sliders:** stepped block meters (`▮▮▮▯`) or a thin track with a square thumb. Show the value always, in mono. Drag, scroll and arrow keys all work, and Shift gives fine control.
- **Knobs** (`16:57`) are for the 2–3 hero params per effect only.
- **Layer rows:** eye icon, a `// TAG` chip for the effect type, name, and a drag handle `⋮⋮`. The selected row inverts (bone bg, void text).
- **Loading:** use the symbol loops (L2 spinner, L3 buffer trail) from `_motion-v1/loops`, or a terminal progress bar `[████░░░░] 52%`. No generic spinners.
- **Empty state:** the symbol, `DROP MEDIA OR PRESS O`, and *The Chaos to Create.* in Tinos tracked.
- **Toasts** read like terminal lines: `> EXPORT COMPLETE — youndr_fx_0042.mp4 (12.4MB)`.
- **Motion:** steps and snaps over eases. Use `steps()` for blinking or ticking, and 60–120ms linear for the rest. Respect `prefers-reduced-motion`.
- **Texture:** apply a subtle grain or scanline only on large empty surfaces (splash, empty canvas) at ≤4% opacity. Never put it behind text you need to read.

## 8. Do / Don't
**Do:** use hairlines, a strict 4/8 grid, monospace numbers, keyboard shortcuts shown inline (`[D] DUPLICATE`), honest technical readouts, and pixel icons at integer scales (1×, 2×, 3×) with `image-rendering: pixelated`.

**Don't:** use rounded corners, gradients in the shell, drop shadows, emoji, purple or blue SaaS accents, red as decoration, Inter or system-ui, generic icon sets, or "friendly" illustration. Never distort, recolour or animate the A independently of the circle (the A and circle are locked).

## 9. Prompt to give Claude
> Build the UI for an open-source browser FX tool (images + video, layer-based effects, export) following `DESIGN.md` exactly. Use the Figma MCP on file `hB1ezCMW5DEn7Fryf1E1E9`: pull variables from Foundations `1:2`, components from the UI kit `16:4`, icons `10:56`–`10:143`, tags `15:89`, and the wordmark `2:25`, and use the FX previews `18:8` as the visual target for the canvas and presets. Export assets as SVG; don't redraw them. Dark theme first. Start with the app shell (app bar, layers panel, canvas screen frame, params panel, transport and status bar), then screenshot it and compare against the Figma Applications page `9:45` before adding features.
