import { isUniformParam, type AuxSpec, type EffectDef, type ParamDef, type ParamValues, type PassDef, type UniformValue } from "../effects/types";
import { BLIT_FRAG, COMPOSITE_FRAG, PRELUDE, PRE_FRAG, SOURCE_FRAG, VERTEX_SHADER, paramDeclarations } from "./glsl";
import { hexToRgb } from "../lib/color";

/** brightness, contrast, saturation, gamma, black, white, blur, invert, posterize */
export type PreValues = [number, number, number, number, number, number, number, number, number];
/** lo, hi, softness, mode (0 off, 1 on, 2 inverted), source (0 below, 1 original) */
export type MaskValues = [number, number, number, number, number];

export interface RenderLayer {
  id: string;
  effect: EffectDef;
  values: ParamValues;
  opacity: number;
  blend: number;
  seed: number;
  pre?: PreValues | null;
  mask?: MaskValues | null;
}

export interface MouseState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  down: boolean;
}

export interface SourceTransform {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  flip: boolean;
}

export interface RenderOptions {
  width: number;
  height: number;
  /** Source rectangle in GL texture space (x0, y0, x1, y1), y up. */
  crop: [number, number, number, number];
  time: number;
  /** Render only the cropped source (before/after compare). */
  bypass?: boolean;
  mouse?: MouseState;
  transform?: SourceTransform;
  /** Pixel height treated as 1080p for reference-pixel sizes (default 1080). */
  refHeight?: number;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

interface Program {
  prog: WebGLProgram;
  locs: Map<string, WebGLUniformLocation | null>;
}

interface AuxTex {
  tex: WebGLTexture;
  w: number;
  h: number;
  used: number;
}

const MAX_INPUTS = 4;
const MAX_AUX = 4;
const AUX_CACHE = 48;
export const NEUTRAL_PRE: PreValues = [0, 0, 0, 1, 0, 1, 0, 0, 0];

export function preIsNeutral(p: PreValues | null | undefined): boolean {
  return !p || p.every((v, i) => Math.abs(v - NEUTRAL_PRE[i]) < 1e-4);
}

export class ShaderError extends Error {
  constructor(public effectId: string, public passId: string, public log: string) {
    super(`Shader "${effectId}/${passId}" failed: ${log}`);
  }
}

/**
 * Multi-pass WebGL2 renderer. Each layer optionally pre-processes its input, runs its
 * effect's pass graph into pooled render targets (with feedback and iterated passes),
 * then composites onto the running result with opacity, blend mode and a luma mask.
 */
export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly maxSize: number;
  private vao: WebGLVertexArrayObject;
  private programs = new Map<string, Program>();
  private failed = new Map<string, string>();
  private pool = new Map<string, Target[]>();
  private feedback = new Map<string, { t: Target; frame: number }>();
  private aux = new Map<string, AuxTex>();
  private dummy: WebGLTexture;
  private srcTex: WebGLTexture | null = null;
  private srcSize: [number, number] = [1, 1];
  private internalFormat: number;
  private texType: number;
  private lost = false;
  private frame = 0;
  private mouse: MouseState = { x: 0.5, y: 0.5, vx: 0, vy: 0, down: false };
  private refH = 1080;
  onShaderError?: (err: ShaderError) => void;

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    if ("addEventListener" in canvas) {
      canvas.addEventListener("webglcontextlost", () => { this.lost = true; }, false);
    }

    // Prefer half-float targets so multi-pass chains don't band; fall back to 8-bit.
    const floatOk = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
    this.internalFormat = floatOk ? gl.RGBA16F : gl.RGBA8;
    this.texType = floatOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, dims[0], dims[1]);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    this.dummy = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  get isLost() {
    return this.lost || this.gl.isContextLost();
  }

  /** Upload (or re-upload, for video frames) the source media. */
  setSource(source: TexImageSource, width: number, height: number) {
    const gl = this.gl;
    if (!this.srcTex) this.srcTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.setSampling(gl.LINEAR, gl.CLAMP_TO_EDGE);
    this.srcSize = [width, height];
  }

  get hasSource() {
    return !!this.srcTex;
  }

  /** Drop all feedback buffers (e.g. when the source changes). */
  resetFeedback() {
    for (const { t } of this.feedback.values()) this.release(t);
    this.feedback.clear();
  }

  render(layers: RenderLayer[], opts: RenderOptions) {
    if (!this.srcTex || this.isLost) return;
    const gl = this.gl;
    const W = Math.max(1, Math.min(this.maxSize, Math.round(opts.width)));
    const H = Math.max(1, Math.min(this.maxSize, Math.round(opts.height)));
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    this.frame++;
    if (opts.mouse) this.mouse = opts.mouse;
    this.refH = opts.refHeight ?? 1080;

    const xf = opts.transform ?? { x: 0, y: 0, scale: 1, rotate: 0, flip: false };
    const original = this.acquire(W, H);
    this.draw(this.builtin("__source", SOURCE_FRAG), original, [this.srcTex], [this.srcSize], {
      uCrop: opts.crop,
      uXform: [xf.x, xf.y, xf.scale, (xf.rotate * Math.PI) / 180],
      uFlip: xf.flip ? 1 : 0,
    }, opts.time);

    let current = original;
    if (!opts.bypass) {
      for (const layer of layers) {
        let input = current;
        let preTarget: Target | null = null;
        if (!preIsNeutral(layer.pre)) {
          const p = layer.pre!;
          preTarget = this.acquire(W, H);
          this.draw(this.builtin("__pre", PRE_FRAG), preTarget, [current.tex], [[W, H]], {
            uPreA: [p[0], p[1], p[2], p[3]], uPreB: [p[4], p[5], p[6], p[7]], uPrePost: p[8],
          }, opts.time);
          input = preTarget;
        }
        const out = this.runEffect(layer, input, original, W, H, opts.time);
        if (preTarget && preTarget !== out) this.release(preTarget);
        if (!out) continue;
        const mask = layer.mask;
        const masked = !!mask && mask[3] > 0.5;
        if (layer.opacity >= 0.999 && layer.blend === 0 && !masked) {
          if (current !== original) this.release(current);
          current = out;
        } else {
          const comp = this.acquire(W, H);
          const maskSrc = masked && mask![4] > 0.5 ? original : current;
          this.draw(this.builtin("__composite", COMPOSITE_FRAG), comp, [current.tex, out.tex, maskSrc.tex], [[W, H], [W, H], [W, H]],
            { uOpacity: layer.opacity, uBlend: layer.blend, uMask: masked ? [mask![0], mask![1], mask![2], mask![3]] : [0, 1, 0, 0] }, opts.time);
          this.release(out);
          if (current !== original) this.release(current);
          current = comp;
        }
      }
    }

    this.draw(this.builtin("__blit", BLIT_FRAG), null, [current.tex], [[W, H]], {}, opts.time);
    if (current !== original) this.release(current);
    this.release(original);
    this.pruneFeedback();
  }

  private runEffect(layer: RenderLayer, input: Target, original: Target, W: number, H: number, time: number): Target | null {
    const { effect, values } = layer;
    const outputs = new Map<string, Target>();
    const ctx = { width: W, height: H, time };
    const auxTex = this.bindAux(effect, values);
    let last: Target | null = null;
    const base: Record<string, UniformValue> = { ...this.paramUniforms(effect.params, values), uSeed: layer.seed, ...auxTex.uniforms };

    for (const pass of effect.passes) {
      const prog = this.effectProgram(effect, pass);
      if (!prog) {
        for (const t of outputs.values()) this.release(t);
        return null;
      }
      const scaleRaw = typeof pass.scale === "function" ? pass.scale(values) : pass.scale ?? 1;
      const scale = Math.max(0.01, Math.min(1, scaleRaw));
      const w = Math.max(1, Math.round(W * scale));
      const h = Math.max(1, Math.round(H * scale));
      const fbKey = `${layer.id}/${pass.id}`;
      let prev: Target | null = null;
      if (pass.feedback) {
        const fb = this.feedback.get(fbKey);
        if (fb && fb.t.w === w && fb.t.h === h) prev = fb.t;
        else if (fb) { this.release(fb.t); this.feedback.delete(fbKey); }
      }
      const resolve = (name: string): Target =>
        name === "input" ? input : name === "original" ? original : name === "prev" ? prev ?? input : outputs.get(name) ?? input;
      const inputs = (pass.inputs ?? ["input"]).map(resolve);
      const uniforms: Record<string, UniformValue> = { ...base, uHasPrev: prev ? 1 : 0, ...(pass.uniforms?.(values, ctx) ?? {}) };
      const iterations = Math.max(1, Math.min(2048, Math.round(pass.repeat?.(values, ctx) ?? 1)));

      let target = this.acquire(w, h);
      this.draw(prog, target, inputs.map((t) => t.tex), inputs.map((t) => [t.w, t.h] as [number, number]),
        { ...uniforms, uIter: 0, uIterCount: iterations }, time, auxTex.textures);
      for (let i = 1; i < iterations; i++) {
        const next = this.acquire(w, h);
        const ins = [target, ...inputs.slice(1)];
        this.draw(prog, next, ins.map((t) => t.tex), ins.map((t) => [t.w, t.h] as [number, number]),
          { ...uniforms, uIter: i, uIterCount: iterations }, time, auxTex.textures);
        this.release(target);
        target = next;
      }

      if (pass.feedback) {
        // Keep a copy of this frame's output for the next frame.
        if (prev) this.release(prev);
        const keep = this.acquire(w, h);
        this.draw(this.builtin("__blitraw", `void main() { fragColor = texture(uTex0, vUv); }`), keep, [target.tex], [[w, h]], {}, time);
        this.feedback.set(fbKey, { t: keep, frame: this.frame });
      }
      outputs.set(pass.id, target);
      last = target;
    }
    for (const [, t] of outputs) if (t !== last) this.release(t);
    // Layers always hand on a full-resolution image, even if the last pass ran scaled down.
    if (last && (last.w !== W || last.h !== H)) {
      const full = this.acquire(W, H);
      this.draw(this.builtin("__blitraw", `void main() { fragColor = texture(uTex0, vUv); }`), full, [last.tex], [[last.w, last.h]], {}, time);
      this.release(last);
      last = full;
    }
    return last;
  }

  private pruneFeedback() {
    for (const [k, v] of this.feedback) {
      if (this.frame - v.frame > 2) { this.release(v.t); this.feedback.delete(k); }
    }
  }

  private bindAux(effect: EffectDef, values: ParamValues) {
    const textures: WebGLTexture[] = [];
    const uniforms: Record<string, UniformValue> = {};
    if (!effect.aux) return { textures, uniforms };
    const specs = effect.aux(values).slice(0, MAX_AUX);
    specs.forEach((spec, i) => {
      const t = this.auxTexture(spec);
      textures[i] = t.tex;
      uniforms[`uAuxRes${i}`] = [t.w, t.h];
    });
    return { textures, uniforms };
  }

  private auxTexture(spec: AuxSpec): AuxTex {
    const hit = this.aux.get(spec.key);
    if (hit) { hit.used = this.frame; return hit; }
    const gl = this.gl;
    const src = spec.build();
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    let w: number;
    let h: number;
    if ("data" in src && src.data instanceof Uint8Array) {
      w = src.width; h = src.height;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
    } else {
      const s = src as TexImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number };
      w = s.naturalWidth || s.width; h = s.naturalHeight || s.height;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const filter = spec.filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    this.setSampling(filter, spec.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    const entry = { tex, w: Math.max(1, w), h: Math.max(1, h), used: this.frame };
    this.aux.set(spec.key, entry);
    if (this.aux.size > AUX_CACHE) {
      const oldest = [...this.aux.entries()].sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest && oldest[0] !== spec.key) { gl.deleteTexture(oldest[1].tex); this.aux.delete(oldest[0]); }
    }
    return entry;
  }

  private paramUniforms(params: ParamDef[], values: ParamValues): Record<string, UniformValue> {
    const u: Record<string, UniformValue> = {};
    for (const p of params) {
      if (!isUniformParam(p)) continue;
      const v = values[p.key] ?? p.default;
      u[`u_${p.key}`] = p.type === "color" ? hexToRgb(String(v)) : Number(v);
    }
    return u;
  }

  private draw(
    program: Program,
    target: Target | null,
    textures: WebGLTexture[],
    sizes: [number, number][],
    uniforms: Record<string, UniformValue>,
    time: number,
    aux: WebGLTexture[] = [],
  ) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    const w = target ? target.w : this.canvas.width;
    const h = target ? target.h : this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(program.prog);
    for (let i = 0; i < MAX_INPUTS; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, textures[i] ?? this.dummy);
      this.setUniform(program, `uTex${i}`, i, true);
      const s = sizes[i] ?? sizes[0] ?? [w, h];
      this.setUniform(program, `uTexRes${i}`, s);
    }
    for (let i = 0; i < MAX_AUX; i++) {
      gl.activeTexture(gl.TEXTURE0 + MAX_INPUTS + i);
      gl.bindTexture(gl.TEXTURE_2D, aux[i] ?? this.dummy);
      this.setUniform(program, `uAux${i}`, MAX_INPUTS + i, true);
    }
    const m = this.mouse;
    this.setUniform(program, "uRes", [w, h]);
    this.setUniform(program, "uTime", time);
    this.setUniform(program, "uFrame", this.frame);
    this.setUniform(program, "uMouse", [m.x, m.y]);
    this.setUniform(program, "uMouseVel", [m.vx, m.vy]);
    this.setUniform(program, "uMouseDown", m.down ? 1 : 0);
    this.setUniform(program, "uRefH", this.refH);
    for (const [name, value] of Object.entries(uniforms)) this.setUniform(program, name, value);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private setUniform(program: Program, name: string, value: UniformValue, isSampler = false) {
    const gl = this.gl;
    let loc = program.locs.get(name);
    if (loc === undefined) {
      loc = gl.getUniformLocation(program.prog, name);
      program.locs.set(name, loc);
    }
    if (loc === null) return;
    if (isSampler) { gl.uniform1i(loc, value as number); return; }
    if (typeof value === "number") { gl.uniform1f(loc, value); return; }
    switch (value.length) {
      case 2: gl.uniform2f(loc, value[0], value[1]); break;
      case 3: gl.uniform3f(loc, value[0], value[1], value[2]); break;
      case 4: gl.uniform4f(loc, value[0], value[1], value[2], value[3]); break;
      default: gl.uniform1fv(loc, value as number[]);
    }
  }

  private builtin(key: string, frag: string): Program {
    const existing = this.programs.get(key);
    if (existing) return existing;
    const prog = this.compile(PRELUDE + frag);
    if (typeof prog === "string") throw new Error(`Built-in shader ${key} failed: ${prog}`);
    const p = { prog, locs: new Map() };
    this.programs.set(key, p);
    return p;
  }

  private effectProgram(effect: EffectDef, pass: PassDef): Program | null {
    const key = `${effect.id}/${pass.id}`;
    const existing = this.programs.get(key);
    if (existing) return existing;
    if (this.failed.has(key)) return null;
    const prog = this.compile(`${PRELUDE}\n${paramDeclarations(effect.params)}\n${pass.frag}`);
    if (typeof prog === "string") {
      this.failed.set(key, prog);
      const err = new ShaderError(effect.id, pass.id, prog);
      console.error(err.message);
      this.onShaderError?.(err);
      return null;
    }
    const p = { prog, locs: new Map() };
    this.programs.set(key, p);
    return p;
  }

  /** Compile + link; returns the program or the error log. */
  private compile(fragSrc: string): WebGLProgram | string {
    const gl = this.gl;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s) || "unknown compile error";
        gl.deleteShader(s);
        return log;
      }
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = shader(gl.FRAGMENT_SHADER, fragSrc);
    if (typeof vs === "string") return vs;
    if (typeof fs === "string") return fs;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return gl.getProgramInfoLog(prog) || "unknown link error";
    return prog;
  }

  /** Compile every pass of an effect up front; returns the error log, if any. */
  validate(effect: EffectDef): string | null {
    for (const pass of effect.passes) {
      if (!this.effectProgram(effect, pass)) return this.failed.get(`${effect.id}/${pass.id}`) ?? "failed";
    }
    return null;
  }

  private acquire(w: number, h: number): Target {
    const key = `${w}x${h}`;
    const free = this.pool.get(key);
    if (free && free.length) return free.pop()!;
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, w, h, 0, gl.RGBA, this.texType, null);
    this.setSampling(gl.LINEAR, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h };
  }

  private release(t: Target) {
    const key = `${t.w}x${t.h}`;
    const list = this.pool.get(key) ?? [];
    list.push(t);
    this.pool.set(key, list);
  }

  /** Drop pooled targets (e.g. after the working size changes). */
  trimPool() {
    const gl = this.gl;
    for (const list of this.pool.values()) for (const t of list) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    this.pool.clear();
  }

  private setSampling(filter: number, wrap: number) {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  }

  /** Free GPU resources. Pass loseContext=false when the canvas will be reused (e.g. React remounts). */
  dispose(loseContext = true) {
    this.resetFeedback();
    this.trimPool();
    const gl = this.gl;
    for (const p of this.programs.values()) gl.deleteProgram(p.prog);
    this.programs.clear();
    for (const a of this.aux.values()) gl.deleteTexture(a.tex);
    this.aux.clear();
    if (this.srcTex) gl.deleteTexture(this.srcTex);
    this.srcTex = null;
    gl.deleteTexture(this.dummy);
    if (loseContext) gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
