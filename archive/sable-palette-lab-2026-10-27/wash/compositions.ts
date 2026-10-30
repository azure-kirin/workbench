/**
 * The Wash compositions, as data — one source for both renderers.
 *
 * A composition is a short list of strokes on a 1600 × 1000 board (16:10, the
 * stage's shape; other shapes crop it like `object-fit: cover`). A stroke is
 * a smooth curve through a few points with a glow width — a
 * fat stroke off a corner is a field, a long one is a band. Strokes run off
 * the board, so colour enters from the edges, and they are painted in order,
 * so a later one wraps over an earlier one.
 *
 *   Shaped  draws each stroke as an SVG path, Gaussian-blurred into a glow.
 *   Fluid   evaluates the same curves as distance fields in a shader, over a
 *           slowly domain-warped space, so the boundaries flow.
 *
 * `calm` is the open space the composition leaves; the stage puts its card
 * there.
 */

export type WashVariant = "sweep" | "fold" | "tide" | "corner";
export type WashIntensity = "bold" | "medium" | "subtle";

export const BOARD = { w: 1600, h: 1000 } as const;

export type Pt = [x: number, y: number];

export interface Stroke {
  /** Trio slot 0 / 1 / 2. */
  slot: 0 | 1 | 2;
  /** Curve points, board units (a single point is a round field). */
  pts: Pt[];
  /**
   * Glow width, board units. The colour is light, not paint: it peaks only on
   * the stroke's spine and falls off continuously across this width (≈ 66% of
   * peak at a quarter-width out, ≈ 18% at the edge, ≈ 1% at 1.5× the edge) —
   * there is no plateau.
   */
  width: number;
  /** Multiplier on the slot's peak (wisps and tails < 1). Defaults to 1. */
  weight?: number;
}

export interface Calm {
  x: "left" | "center" | "right";
  y: "top" | "center" | "bottom";
}

export interface Composition {
  label: string;
  summary: string;
  strokes: Stroke[];
  calm: Calm;
  /** Fluid: domain-warp strength (board units) and drift radius of each stroke. */
  fluid: { warp: number; drift: number };
}

export const COMPOSITIONS: Record<WashVariant, Composition> = {
  sweep: {
    label: "Sweep",
    summary:
      "Slot 1 sweeps out of the lower-left corner toward the top; slot 2 arcs across it; slot 3 pools in the top-right corner. Calm: bottom right.",
    strokes: [
      {
        slot: 0,
        pts: [
          [-200, 1180],
          [260, 700],
          [640, 330],
          [960, -180],
        ],
        width: 430,
      },
      {
        slot: 2,
        pts: [
          [1560, -60],
          [1760, 180],
        ],
        width: 680,
      },
      {
        slot: 1,
        pts: [
          [120, -200],
          [400, 290],
          [860, 480],
          [1780, 380],
        ],
        width: 260,
      },
    ],
    calm: { x: "right", y: "bottom" },
    fluid: { warp: 150, drift: 45 },
  },

  fold: {
    label: "Fold",
    summary:
      "Mariia's reference: slot 2 runs down the left edge; slot 3 enters at the top, folds back on itself mid-board (a soft chevron) and tapers out at the bottom, touching the field; slot 1 pools top right. Calm: bottom right.",
    strokes: [
      {
        slot: 1,
        pts: [
          [-160, -150],
          [60, 420],
          [-100, 1150],
        ],
        width: 550,
      },
      {
        slot: 0,
        pts: [
          [1520, -100],
          [1760, 230],
        ],
        width: 620,
      },
      // The fold: one long curve in from the top, bending back on itself
      // mid-board and leaving at the bottom — drawn in two strokes so it
      // tapers, broad where it enters, narrower as it leaves.
      {
        slot: 2,
        pts: [
          [1000, -240],
          [760, 180],
          [600, 500],
        ],
        width: 310,
        // The hero band: lifted to slot 2's peak so the fold reads.
        weight: 1.3,
      },
      {
        slot: 2,
        pts: [
          [600, 500],
          [560, 800],
          [700, 1220],
        ],
        width: 230,
        weight: 1.2,
      },
    ],
    calm: { x: "right", y: "bottom" },
    fluid: { warp: 120, drift: 40 },
  },

  tide: {
    label: "Tide",
    summary:
      "Three wave bands rise from the bottom edge, back to front slot 1 → 2 → 3, cresting higher on the right; a wisp of slot 2 enters top right. Calm: top left.",
    strokes: [
      {
        slot: 0,
        pts: [
          [-200, 760],
          [260, 640],
          [720, 780],
          [1200, 520],
          [1800, 470],
        ],
        width: 290,
      },
      {
        slot: 1,
        pts: [
          [-200, 960],
          [380, 820],
          [900, 940],
          [1380, 720],
          [1800, 720],
        ],
        width: 240,
      },
      {
        slot: 2,
        pts: [
          [-200, 1130],
          [480, 1010],
          [1060, 1110],
          [1800, 940],
        ],
        width: 240,
      },
      {
        slot: 1,
        pts: [
          [1240, -140],
          [1480, 110],
          [1800, 150],
        ],
        width: 250,
        weight: 0.75,
      },
    ],
    calm: { x: "left", y: "top" },
    fluid: { warp: 120, drift: 35 },
  },

  corner: {
    label: "Corner",
    summary:
      "Slot 1 lights the top-left corner with slot 2 wrapped round it as a crescent; slot 3 pools bottom right with a tail of slot 1 curling round it. Calm: the other diagonal — bottom left (the card) and top right.",
    strokes: [
      {
        slot: 0,
        pts: [
          [-120, -120],
          [220, 120],
        ],
        width: 770,
      },
      {
        slot: 1,
        pts: [
          [-160, 560],
          [240, 470],
          [520, 220],
          [700, -160],
        ],
        width: 220,
      },
      {
        slot: 2,
        pts: [
          [1720, 1120],
          [1380, 900],
        ],
        width: 740,
      },
      {
        slot: 0,
        pts: [
          [1780, 480],
          [1520, 720],
          [1360, 1160],
        ],
        width: 220,
        weight: 0.75,
      },
    ],
    calm: { x: "left", y: "bottom" },
    fluid: { warp: 140, drift: 40 },
  },
};

export const VARIANTS = Object.keys(COMPOSITIONS) as WashVariant[];
export const DEFAULT_VARIANT: WashVariant = "fold";

/** Intensity is a multiplier on the backdrop profile's peaks (see backdrop.ts). */
export const INTENSITY_SCALE: Record<WashIntensity, number> = {
  bold: 1,
  medium: 0.67,
  subtle: 0.42,
};

/** How colour meets the photo. `screen` / `plus-lighter` add light; `soft-light` / `overlay` tint. */
export type WashBlend =
  | "normal"
  | "screen"
  | "plus-lighter"
  | "soft-light"
  | "overlay"
  | "color"
  | "multiply";
export const BLENDS: WashBlend[] = [
  "screen",
  "plus-lighter",
  "color",
  "soft-light",
  "overlay",
  "multiply",
  "normal",
];

// ─── Glow ──────────────────────────────────────────────────────────────────

/** erf, Abramowitz–Stegun 7.1.26 (|error| < 1.5e-7). */
export function erf(x: number): number {
  const sign = Math.sign(x);
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

/** The glow's construction: a core band 0.6 of the width, blurred by σ = 0.2·width. */
const CORE = 0.6;
const SIGMA = 0.2;
/** Peak of a unit-opacity blurred core: ½·2·erf((core/2)/(σ√2)). */
const CORE_PEAK = erf(CORE / 2 / (SIGMA * Math.SQRT2));

export interface Glow {
  /** Core band width and blur σ, board units. */
  core: number;
  sigma: number;
  /** Opacity to paint the core with so the spine lands exactly on `peak`. */
  opacity: number;
  peak: number;
}

/** The highest spine alpha a glow can reach (core painted at opacity 1). */
export const MAX_PEAK = CORE_PEAK;

/** Turn a stroke into its glow, given the resolved per-slot peaks. */
export function glowOf(stroke: Stroke, peaks: readonly [number, number, number]): Glow {
  const peak = Math.min(CORE_PEAK, peaks[stroke.slot] * (stroke.weight ?? 1));
  return {
    core: stroke.width * CORE,
    sigma: stroke.width * SIGMA,
    opacity: peak / CORE_PEAK,
    peak,
  };
}

// ─── Seed ──────────────────────────────────────────────────────────────────

/** mulberry32: a tiny deterministic PRNG. */
export function rng(seed: number) {
  let a = (seed * 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How far a seed may push a stroke (board units), and turn / scale the board. */
const SEED_REACH: Pt = [80, 60];
const SEED_TURN = 8;
const SEED_SCALE = 0.08;

/**
 * The composition's strokes after the seed's deterministic shift: odd seeds
 * mirror left ↔ right; every non-zero seed turns and scales the board a
 * little about its centre and nudges each stroke. Seed 0 is the drawing.
 */
export function strokesFor(variant: WashVariant, seed = 0): Stroke[] {
  const { strokes } = COMPOSITIONS[variant];
  if (seed === 0) return strokes;
  const r = rng(seed);
  const mirror = seed % 2 === 1;
  const turn = (((r() - 0.5) * SEED_TURN) / 180) * Math.PI;
  const scale = 1 + (r() - 0.5) * SEED_SCALE;
  const [cx, cy] = [BOARD.w / 2, BOARD.h / 2];
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  return strokes.map((stroke) => {
    const dx = (r() - 0.5) * 2 * SEED_REACH[0];
    const dy = (r() - 0.5) * 2 * SEED_REACH[1];
    const pts = stroke.pts.map(([x0, y0]): Pt => {
      const x = (mirror ? BOARD.w - x0 : x0) - cx;
      const y = y0 - cy;
      return [
        cx + (x * cos - y * sin) * scale + dx,
        cy + (x * sin + y * cos) * scale + dy,
      ];
    });
    return { ...stroke, pts };
  });
}

/** Where the calm space ends up for this variant and seed. */
export function calmFor(variant: WashVariant, seed = 0): Calm {
  const calm = COMPOSITIONS[variant].calm;
  if (seed % 2 === 0 || calm.x === "center") return calm;
  return { ...calm, x: calm.x === "left" ? "right" : "left" };
}

// ─── Curves ────────────────────────────────────────────────────────────────

/** Catmull-Rom through the points, as cubic Bézier spans [p0, c1, c2, p1]. */
export function bezierSpans(pts: Pt[]): [Pt, Pt, Pt, Pt][] {
  const spans: [Pt, Pt, Pt, Pt][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? (pts[i] as Pt);
    const p1 = pts[i] as Pt;
    const p2 = pts[i + 1] as Pt;
    const p3 = pts[i + 2] ?? p2;
    spans.push([
      p1,
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2,
    ]);
  }
  return spans;
}

/** SVG path data for a stroke's centre line. */
export function strokePath(pts: Pt[]): string {
  const f = (n: number) => +n.toFixed(1);
  const [first] = pts;
  if (!first) return "";
  if (pts.length === 1) return `M ${f(first[0])} ${f(first[1])} l 0.01 0`;
  return [
    `M ${f(first[0])} ${f(first[1])}`,
    ...bezierSpans(pts).map(
      ([, c1, c2, p]) =>
        `C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p[0])} ${f(p[1])}`,
    ),
  ].join(" ");
}

/** The same curve as a polyline (for the shader), `steps` segments per span. */
export function polyline(pts: Pt[], steps = 3): Pt[] {
  if (pts.length === 1) return [pts[0] as Pt, pts[0] as Pt];
  const out: Pt[] = [pts[0] as Pt];
  for (const [a, b, c, d] of bezierSpans(pts)) {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
      out.push([
        k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0],
        k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1],
      ]);
    }
  }
  return out;
}
