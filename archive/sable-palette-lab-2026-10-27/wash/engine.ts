/**
 * One WebGL context for every Fluid wash on the page.
 *
 * Browsers cap live WebGL contexts (~16 in Chromium), and a page of stages
 * would hit it. So the engine owns a single hidden GL canvas: each frame it
 * renders every visible instance into the corner of that canvas at reduced
 * resolution and copies the result onto the instance's own 2D canvas, which
 * CSS stretches to fill the stage (the field is soft — upscaling is free).
 *
 * One shared requestAnimationFrame loop, capped at 30 fps (the drift is 20–40 s
 * per cycle; 60 fps would buy nothing). It runs only while some instance is
 * visible, animating and the tab is shown; reduced motion renders one frame.
 * The GL context is released when the last instance unmounts.
 */
import { type Glow, polyline, type Stroke } from "./compositions.ts";
import { FRAGMENT, MAX_SEGMENTS, VERTEX } from "./shader.ts";

/** Device-pixel ratio cap, then the fraction of that we actually render. */
export const DPR_CAP = 1.5;
export const RENDER_SCALE = 0.5;
const FRAME_MS = 1000 / 30;

export interface FluidParams {
  /** uSegA / uSegB / uSegC × MAX_SEGMENTS (see shader.ts). */
  segA: Float32Array;
  segB: Float32Array;
  segC: Float32Array;
  count: number;
  colours: [number, number, number][];
  /** Domain-warp strength, board / 1000. */
  warp: number;
  gain: number;
  seed: [number, number];
  timeOffset: number;
}

export interface FluidInstance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  params: FluidParams;
  visible: boolean;
  animate: boolean;
  dirty: boolean;
  time: number;
  width: number;
  height: number;
  onLost: () => void;
  /** Frame-cost samples, ms (for the lab's perf readout). */
  stats?: number[];
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;

class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly gl: GL;
  readonly version: 1 | 2;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  readonly instances = new Set<FluidInstance>();
  private raf = 0;
  private last = 0;
  private lost = false;

  constructor(canvas: HTMLCanvasElement, gl: GL, version: 1 | 2) {
    this.canvas = canvas;
    this.gl = gl;
    this.version = version;
    const program = gl.createProgram();
    const buffer = gl.createBuffer();
    if (!program || !buffer) throw new Error("wash: GL resources unavailable");
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("wash: createShader failed");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(`wash: ${gl.getShaderInfoLog(shader)}`);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(`wash: ${gl.getProgramInfoLog(program)}`);
    this.program = program;
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL call, not a React hook
    gl.useProgram(program);
    for (const name of [
      "uRes",
      "uTime",
      "uSegA",
      "uSegB",
      "uSegC",
      "uCount",
      "uCol0",
      "uCol1",
      "uCol2",
      "uWarp",
      "uGain",
      "uSeed",
    ])
      this.uniforms[name] = gl.getUniformLocation(program, name);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      if (this.lost) return; // our own dispose
      this.lost = true;
      cancelAnimationFrame(this.raf);
      document.removeEventListener("visibilitychange", this.wake);
      // A lost context sends every instance to the Shaped renderer for good.
      unavailable = true;
      if (engine === this) engine = null;
      for (const instance of this.instances) instance.onLost();
    });
    document.addEventListener("visibilitychange", this.wake);
  }

  add(instance: FluidInstance) {
    this.instances.add(instance);
    this.wake();
  }

  remove(instance: FluidInstance) {
    this.instances.delete(instance);
    if (this.instances.size === 0) dispose();
  }

  /** Schedule a frame if anything needs one. */
  readonly wake = () => {
    if (this.raf || this.lost || document.hidden) return;
    for (const i of this.instances)
      if (i.visible && (i.animate || i.dirty)) {
        this.raf = requestAnimationFrame(this.frame);
        return;
      }
  };

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (this.lost || document.hidden) return;
    const elapsed = now - this.last;
    const tick = elapsed >= FRAME_MS - 2;
    const dt = this.last ? Math.min(elapsed, 100) / 1000 : 0;
    if (tick) this.last = now;
    let again = false;
    for (const instance of this.instances) {
      if (!instance.visible) continue;
      if (instance.animate) {
        again = true;
        if (!tick) continue;
        instance.time += dt;
      } else if (!instance.dirty) continue;
      this.draw(instance);
    }
    if (again) this.raf = requestAnimationFrame(this.frame);
  };

  draw(instance: FluidInstance) {
    const { gl, uniforms: u, canvas } = this;
    const { width: w, height: h, params } = instance;
    if (w < 1 || h < 1) return;
    const start = performance.now();
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.max(canvas.width, w);
      canvas.height = Math.max(canvas.height, h);
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.uRes ?? null, w, h);
    gl.uniform1f(u.uTime ?? null, instance.time + params.timeOffset);
    gl.uniform4fv(u.uSegA ?? null, params.segA);
    gl.uniform4fv(u.uSegB ?? null, params.segB);
    gl.uniform4fv(u.uSegC ?? null, params.segC);
    gl.uniform1i(u.uCount ?? null, params.count);
    gl.uniform3fv(u.uCol0 ?? null, params.colours[0] ?? [0, 0, 0]);
    gl.uniform3fv(u.uCol1 ?? null, params.colours[1] ?? [0, 0, 0]);
    gl.uniform3fv(u.uCol2 ?? null, params.colours[2] ?? [0, 0, 0]);
    gl.uniform1f(u.uWarp ?? null, params.warp);
    gl.uniform1f(u.uGain ?? null, params.gain);
    gl.uniform2fv(u.uSeed ?? null, params.seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // GL's origin is bottom-left: our w×h sits at the bottom of the canvas image.
    // Lab probe: with __washFinish set, wait for the GPU so `stats` is GPU time.
    if ((globalThis as { __washFinish?: boolean }).__washFinish) gl.finish();
    instance.ctx.clearRect(0, 0, w, h);
    instance.ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
    instance.dirty = false;
    if (instance.stats) {
      instance.stats.push(performance.now() - start);
      if (instance.stats.length > 600) instance.stats.shift();
    }
  }

  destroy() {
    this.lost = true; // our own loseContext() below must not trip the fallback
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.wake);
    const { gl } = this;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.buffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

let engine: Engine | null = null;
let unavailable = false;

/** The shared engine, created on first use; null when WebGL is unavailable. */
export function getEngine(): Engine | null {
  if (engine) return engine;
  if (unavailable || typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const options: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    };
    const gl2 = canvas.getContext("webgl2", options);
    const gl = gl2 ?? canvas.getContext("webgl", options);
    if (!gl) throw new Error("wash: no WebGL");
    engine = new Engine(canvas, gl, gl2 ? 2 : 1);
    return engine;
  } catch (error) {
    console.warn(error);
    unavailable = true;
    return null;
  }
}

function dispose() {
  engine?.destroy();
  engine = null;
}

/**
 * Flatten strokes into the segment uniforms (board units → board / 1000).
 * Each stroke's last segment carries slot + 10, telling the shader to
 * composite it; every segment repeats its stroke's drift.
 */
export function packStrokes(
  strokes: Stroke[],
  glow: (stroke: Stroke) => Glow,
  drift: number,
  speedFor: (index: number) => number,
): Pick<FluidParams, "segA" | "segB" | "segC" | "count"> {
  const segA = new Float32Array(MAX_SEGMENTS * 4);
  const segB = new Float32Array(MAX_SEGMENTS * 4);
  const segC = new Float32Array(MAX_SEGMENTS * 4);
  let n = 0;
  strokes.forEach((stroke, index) => {
    const line = polyline(stroke.pts);
    const { core, sigma, opacity } = glow(stroke);
    for (let i = 0; i < line.length - 1 && n < MAX_SEGMENTS; i++, n++) {
      const [x1, y1] = line[i] as [number, number];
      const [x2, y2] = line[i + 1] as [number, number];
      const last = i === line.length - 2 || n === MAX_SEGMENTS - 1;
      segA.set([x1 / 1000, y1 / 1000, x2 / 1000, y2 / 1000], n * 4);
      segB.set(
        [stroke.slot + (last ? 10 : 0), core / 2000, sigma / 1000, opacity],
        n * 4,
      );
      segC.set([drift / 1000, speedFor(index), index * 2.399, 0], n * 4);
    }
  });
  return { segA, segB, segC, count: n };
}
