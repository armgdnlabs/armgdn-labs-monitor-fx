import { EFFECTS } from "../effects/registry";
import { defaultValues } from "../effects/types";
import { Renderer } from "./Renderer";

export interface DiagnosticsReport {
  renderer: string;
  maxTextureSize: number;
  effects: number;
  failures: { id: string; error: string }[];
}

/**
 * Compiles and renders every effect once on a scratch context. Run
 * `monitorDiagnostics()` in the browser console to check GPU compatibility.
 */
export function runDiagnostics(): DiagnosticsReport {
  const canvas = document.createElement("canvas");
  const r = new Renderer(canvas);
  const failures: DiagnosticsReport["failures"] = [];
  try {
    const src = document.createElement("canvas");
    src.width = 64;
    src.height = 64;
    const g = src.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, "#202060");
    grad.addColorStop(1, "#ffb060");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    r.setSource(src, 64, 64);
    for (const effect of EFFECTS) {
      const err = r.validate(effect);
      if (err) { failures.push({ id: effect.id, error: err }); continue; }
      r.render([{ id: effect.id, effect, values: defaultValues(effect), opacity: 1, blend: 0, seed: 1 }], { width: 64, height: 64, crop: [0, 0, 1, 1], time: 0.5 });
      const glErr = r.gl.getError();
      if (glErr !== r.gl.NO_ERROR) failures.push({ id: effect.id, error: `GL error 0x${glErr.toString(16)}` });
    }
    const dbg = r.gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: dbg ? String(r.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown",
      maxTextureSize: r.maxSize,
      effects: EFFECTS.length,
      failures,
    };
  } finally {
    r.dispose();
  }
}

declare global {
  interface Window {
    monitorDiagnostics?: () => DiagnosticsReport;
  }
}
window.monitorDiagnostics = runDiagnostics;
