# MONITOR — by ARMGDN // LABS

> *The Chaos to Create.*

An open-source, browser-based FX engine for images and video. **Load media → stack effects as layers → tweak → export.** Everything runs on your GPU (WebGL 2) in the browser: no uploads, no account, no watermark, no locked features.

- **125 effects** in 10 categories: Adjust, Color, Film, Retro, Glitch, Print, Draw, Blur, Distort and Overlay.
- **87 presets** in five sections (Print & paper, Drawing & painting, Film & TV, Retro & digital, Looks). A preset lands on the stack as one **group** you can collapse, hide, rename, ungroup or delete, and presets **compound**: each one adds on top. Previews are rendered live on a photo picked to suit the look.
- **Signal-level retro.** VHS band-limits luma and chroma separately, delays chroma, adds peaking, tape geometry, dropouts and static (never scrolling) grain. NTSC encodes each line onto a colour subcarrier and decodes it with FIR filters. Apple II quantises to a 1-bit 560-dot line and decodes it like a monitor, so artifact colour appears by itself. CRT renders phosphor triads in linear light.
- **Real implementations elsewhere too:** GPU pixel sorting, glyph-atlas ASCII, CMYK halftone at screen angles, risograph separation, Kuwahara oil paint, XDoG pencil, film stocks with per-stock grain, procedural paper surfaces (crumpled, folded, tracing, towel, cracks, glass).
- **Animation.** Any numeric param can be keyframed (drag keys on the timeline, right-click for easing) or **modulated** with a looping wave (sine, triangle, saw, square, random, drift) that completes whole cycles per loop, so video exports loop cleanly. On-canvas points (lens, spotlight, reveal…) are params too: keyframe them and drag while playing to record motion.
- **Per-layer controls.** Hero knobs, curve and gradient editors, pre-processing, 15 blend modes, a luma mask and a seed.
- **Sources.** Starts on a random editorial photo from Unsplash’s curated topics (film, fashion, street, nature, architecture, night…) with no effect applied. Shuffle draws without repeats; add from URL, drop, paste or open a file or video.
- **Export.** PNG, JPEG or WebP stills up to 16K (limited only by your GPU), MP4/WebM video, and batch export to ZIP.
- **Light and dark.** One toggle; the canvas frame follows it (mono in dark, analog in light).

## Open it

**https://armgdnlabs.github.io/armgdn-labs-monitor-fx/** runs in any WebGL 2 browser. Nothing to install. Every push to `main` redeploys it.

## Run it locally (only for development)

Requirements: Node.js 18+ and a WebGL 2 browser (Safari 15+, Chrome, Edge, Firefox, Arc).

```bash
npm install
npm run dev          # http://localhost:5173 with hot reload
```

Production build:

```bash
npm run build        # type-checks, then writes the static site to dist/
npm start            # serves dist/ at http://localhost:4173 (PORT=8080 npm start to change)
```

### Hosting

`dist/` is a fully static site with hash routing, so it works on any host, at the domain root or under a sub-path. The repo includes `.github/workflows/pages.yml`: push to `main` and GitHub Pages deploys it (enable it under **Settings → Pages → Source: GitHub Actions**).

Optional: set `VITE_NEWSLETTER_URL` (see `.env.example`, or as a repo variable for the Pages build). People who create a profile and opt in are then POSTed `{ name, email }` to your list endpoint. Without it, profiles stay local.

## Using it

| Do | How |
|---|---|
| Pan the artboard | Mouse wheel / trackpad scroll; Space-drag, middle-drag or Alt-drag |
| Zoom the artboard | Ctrl/⌘/Alt + wheel or pinch; it zooms at the cursor and never the page. `F` fits, `1` shows 100% |
| Change the source | Hover the **SRC** row in // LAYERS: shuffle (Unsplash), URL, file. Or press `S` or `O`, or drop/paste |
| Add effects | Click any effect card, or press `B` for the full library browser |
| Apply a preset | Click: adds it on top as a group. Presets compound |
| Library panel | Collapse with `L` or the header; drag its edge to resize; drag the split to resize layers |
| Animate | Hover a slider: ◆ keyframes at the playhead, ~ loops it with a wave. Timeline lanes: drag keys, right-click easing, alt-click delete |
| Export | The bar under the artboard: zoom, crop, compare, format and size, EXPORT |
| Like / share | Corner buttons on every card |

Deep links: `#/?effect=pixel-sort`, `#/?preset=riso-print`, `#/?photo=fire:2`. Press `?` for all shortcuts.

## Project layout

```
src/brand/           ARMGDN marks + pixel icons (exported from the brand Figma)
src/data/            Unsplash photos (subject set + editorial feed) and preview moods
src/effects/         effect model, registry, presets, GLSL library by category
src/engine/          WebGL2 renderer (multi-pass, feedback, iterated passes, aux textures), export, thumbnails
src/state/           zustand stores: editor, view, ui/prefs, library, account
src/components/      app bar, library, layers, inspector, viewport, transport, modals
DESIGN.md            the design system: read it before changing UI
```

### Adding an effect

```ts
// src/effects/library/<category>.ts
{
  id: "my-effect", name: "My effect", category: "Color", description: "…", preview: "fire:0",
  params: [hero("amount", "Amount", 0, 1, 0.5), color("tint", "Tint", "#D3202A")],
  passes: single(`
void main() {
  vec4 c = texture(uTex0, vUv);
  fragColor = vec4(mix(c.rgb, c.rgb * u_tint, u_amount), c.a);
}`),
}
```

Params become `u_<key>` uniforms. Use `refPx()` / `refScale()` for sizes so previews match exports. For a draggable point, add two 0..1 params and list them in `handles`. `feedback: true` passes receive last frame as `"prev"`. `repeat` iterates a pass, and `aux` binds LUTs, glyph atlases, text or images. Run `monitorDiagnostics()` in the console to compile-test every effect.

## Credits

Built by ARMGDN LABS. Sample photography from [Unsplash](https://unsplash.com), credited in-app on every use. Code: MIT. The ARMGDN marks are not covered by the code licence.
