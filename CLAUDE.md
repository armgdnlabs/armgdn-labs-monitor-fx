# MONITOR FX — agent notes

Read DESIGN.md before touching any UI. Brand assets come from the Figma file it links (marks in src/brand/Marks.tsx, pixel icons in src/brand/icons.ts are exported verbatim — don't redraw them).

- Effects live in `src/effects/library/<category>.ts`; presets in `src/effects/presets.ts`.
- Run `monitorDiagnostics()` in the browser console after shader changes: every effect must compile (failures must be 0).
- `npm run build` must stay at zero TypeScript errors.
