/**
 * The Fluid renderer: a 2D canvas the shared engine paints into. Owns the
 * per-instance plumbing — size, visibility, reduced motion, colour parsing —
 * and calls `onFail` when WebGL is missing or lost, so Wash can fall back.
 */
import { useEffect, useRef } from "react";
import {
  COMPOSITIONS,
  glowOf,
  strokesFor,
  type WashBlend,
  type WashVariant,
} from "./compositions.ts";
import {
  DPR_CAP,
  type FluidInstance,
  type FluidParams,
  getEngine,
  packStrokes,
  RENDER_SCALE,
} from "./engine.ts";

export interface FluidWashProps {
  trio: readonly [string, string, string];
  variant: WashVariant;
  seed: number;
  /** Resolved spine peaks per slot (backdrop profile × intensity). */
  peaks: readonly [number, number, number];
  motion: boolean;
  /** CSS blend of the canvas over the photo; the canvas is premultiplied glow. */
  blend: WashBlend;
  onFail: () => void;
}

/** Full drift cycles between 20 and 40 s. */
const PERIODS = [24, 31, 38, 22, 35, 27, 40, 29, 33, 21, 36, 26];

/** Any CSS colour (hex, oklch(), var()) → sRGB 0–1, resolved against `el`. */
function resolveColour(el: HTMLElement, css: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const ctx = document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  });
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function buildParams(
  el: HTMLElement,
  { trio, variant, seed, peaks }: Omit<FluidWashProps, "motion" | "onFail" | "blend">,
): FluidParams {
  const { fluid } = COMPOSITIONS[variant];
  const packed = packStrokes(
    strokesFor(variant, seed),
    (stroke) => glowOf(stroke, peaks),
    fluid.drift,
    (i) => (2 * Math.PI) / (PERIODS[i] ?? 30),
  );
  return {
    ...packed,
    colours: trio.map((c) => resolveColour(el, c)),
    warp: fluid.warp / 1000,
    gain: 1, // peaks are already in the stroke opacities
    seed: [seed * 3.17, seed * 1.93],
    timeOffset: seed * 11,
  };
}

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export function FluidWash({
  trio,
  variant,
  seed,
  peaks,
  motion,
  blend,
  onFail,
}: FluidWashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<FluidInstance | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const [c1, c2, c3] = trio;
  const [p1, p2, p3] = peaks;

  // Mount: register with the engine, observe size and visibility. Params are
  // synced by the effects below, so this runs once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = getEngine();
    const ctx = canvas?.getContext("2d");
    if (!canvas || !engine || !ctx) {
      failRef.current();
      return;
    }
    const instance: FluidInstance = {
      canvas,
      ctx,
      params: buildParams(canvas, { trio, variant, seed, peaks }),
      visible: false,
      animate: false,
      dirty: true,
      time: 0,
      width: 0,
      height: 0,
      onLost: () => failRef.current(),
      stats: [],
    };
    // Exposed for the lab's perf probe.
    (canvas as HTMLCanvasElement & { __wash?: FluidInstance }).__wash = instance;
    instanceRef.current = instance;

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, DPR_CAP) * RENDER_SCALE;
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (w === instance.width && h === instance.height) return;
      canvas.width = instance.width = w;
      canvas.height = instance.height = h;
      instance.dirty = true;
      engine.wake();
    };
    const sizes = new ResizeObserver(resize);
    sizes.observe(canvas);
    const sight = new IntersectionObserver(
      ([entry]) => {
        instance.visible = entry?.isIntersecting ?? false;
        engine.wake();
      },
      { rootMargin: "100px" },
    );
    sight.observe(canvas);
    resize();
    engine.add(instance);
    return () => {
      sizes.disconnect();
      sight.disconnect();
      instanceRef.current = null;
      engine.remove(instance);
    };
  }, []);

  // Props → params.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.params = buildParams(instance.canvas, {
      trio: [c1, c2, c3],
      variant,
      seed,
      peaks: [p1, p2, p3],
    });
    instance.dirty = true;
    getEngine()?.wake();
  }, [c1, c2, c3, variant, seed, p1, p2, p3]);

  // Motion: on unless switched off or the reader prefers reduced motion.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      instance.animate = motion && !reducedMotion();
      instance.dirty = true;
      getEngine()?.wake();
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [motion]);

  return (
    <canvas
      ref={canvasRef}
      data-slot="wash-fluid"
      className="absolute inset-0 size-full"
      style={{ mixBlendMode: blend }}
    />
  );
}
