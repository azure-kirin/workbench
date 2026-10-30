/**
 * Palette Lab, round 3 — three sets: Warm, Cool, Neutral. The source of truth;
 * `generate.ts` writes `sets.css` (hex in comments) and `sets.json`.
 *
 * A set is one family:
 *   --ink-*      greys of the set's temperature (50 → 950, plus 850)
 *   --copper-*   the button accent ramp — built on one aura colour, so the
 *                button belongs to the trio (the name is historical)
 *   --moss-* / --ochre-* / --brick-* / --slate-*
 *                success / warning / danger / info — meaning only
 *   --aura-1…3   the trio the wash paints with: analogous, one direction
 *                round the wheel, light and clean
 *   --hue-<n>, --hue-<n>-text   identity: a solid pastel disc (avatars,
 *                illustration) and the near-black initials on it
 */
import { fitGamut as clampToGamut, type Oklch } from "./color.ts";

function fitColour(colour: Oklch): Oklch {
  const { l, c, h } = clampToGamut(colour);
  return {
    l: Math.round(l * 1000) / 1000,
    c: Math.floor(c * 1000) / 1000,
    h: Math.round((((h % 360) + 360) % 360) * 10) / 10,
  };
}

export type SetId = "warm" | "cool" | "neutral";

export const NEUTRAL_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950,
] as const;
export const ACCENT_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const STATUS_STEPS = [300, 400, 500, 600, 700, 800] as const;
export const STATUSES = ["success", "warning", "danger", "info"] as const;
export type Status = (typeof STATUSES)[number];

export const FAMILY: Record<"neutral" | "accent" | Status, string> = {
  neutral: "ink",
  accent: "copper",
  success: "moss",
  warning: "ochre",
  danger: "brick",
  info: "slate",
};

type Steps<T extends readonly number[]> = Partial<Record<T[number], number>>;

export interface AuraSpec extends Oklch {
  name: string;
  /** A mandated swatch this colour is drawn from, if any. */
  anchor?: { hex: string; note: string };
}

interface SetSpec {
  id: SetId;
  name: string;
  /** The one honest sentence. */
  idea: string;
  trioName: string;
  /** Slots 1 / 2 / 3 — slot 1 is the largest, strongest blob. */
  aura: [AuraSpec, AuraSpec, AuraSpec];
  /** Which aura slot the button is built on, and its ramp's lightness tweaks. */
  accent: { name: string; slot: 1 | 2 | 3; l?: Steps<typeof ACCENT_STEPS> };
  neutral: { name: string; hue: number; chroma: number };
  status: Record<Status, { hue: number; chroma: number }>;
  identity: { name: string; hue: number; chroma: number; l?: number }[];
}

// ─── Ladders (as in round 2, which passed AA) ──────────────────────────────

const NEUTRAL_L: Record<(typeof NEUTRAL_STEPS)[number], number> = {
  50: 0.965,
  100: 0.925,
  200: 0.865,
  300: 0.79,
  400: 0.705,
  500: 0.56,
  600: 0.465,
  700: 0.37,
  800: 0.29,
  850: 0.255,
  900: 0.222,
  950: 0.182,
};
const NEUTRAL_C: Record<(typeof NEUTRAL_STEPS)[number], number> = {
  50: 0.3,
  100: 0.4,
  200: 0.5,
  300: 0.65,
  400: 0.8,
  500: 0.95,
  600: 1,
  700: 1,
  800: 1,
  850: 1,
  900: 0.95,
  950: 0.9,
};
const ACCENT_L: Record<(typeof ACCENT_STEPS)[number], number> = {
  50: 0.97,
  100: 0.93,
  200: 0.885,
  300: 0.845,
  400: 0.8,
  500: 0.7,
  600: 0.6,
  700: 0.49,
  800: 0.38,
  900: 0.28,
};
const ACCENT_C: Record<(typeof ACCENT_STEPS)[number], number> = {
  50: 0.18,
  100: 0.35,
  200: 0.6,
  300: 0.85,
  400: 1,
  500: 1,
  600: 0.95,
  700: 0.82,
  800: 0.6,
  900: 0.45,
};
const STATUS_L: Record<(typeof STATUS_STEPS)[number], number> = {
  300: 0.84,
  400: 0.76,
  500: 0.665,
  600: 0.575,
  700: 0.48,
  800: 0.375,
};
const STATUS_C: Record<(typeof STATUS_STEPS)[number], number> = {
  300: 0.75,
  400: 1,
  500: 1,
  600: 0.95,
  700: 0.8,
  800: 0.6,
};
/**
 * Identity: an opaque pastel disc with the set's darkest neutral on it.
 * Lightness 0.82 (yellows may go lighter via the spec's `l`) keeps near-black
 * initials far above AA; chroma × 1.15 of the spec keeps the discs clearly
 * coloured rather than grey.
 */
const IDENTITY = { l: 0.82, c: 1.15 };
/** An identity hue must stay this far (degrees) from the set's danger hue. */
export const IDENTITY_DANGER_GAP = 20;

// ─── The three sets ────────────────────────────────────────────────────────

export const SPECS: SetSpec[] = [
  {
    id: "warm",
    name: "Warm",
    idea: "Late sun through a window: apricot and peach glow, with Mariia's butter yellow at the bright heart of it.",
    trioName: "Butter · Apricot · Peach",
    aura: [
      { name: "Apricot", l: 0.8, c: 0.14, h: 62 },
      { name: "Peach", l: 0.75, c: 0.14, h: 32 },
      {
        name: "Butter",
        l: 0.885,
        c: 0.13,
        h: 88,
        anchor: {
          hex: "#EDDA9C",
          note: "Mariia's swatch, oklch(0.889 0.082 93). Same lightness, hue 5° warmer, chroma 0.13: at 35% over black or grey cloud the swatch value turns khaki; this stays golden butter. It sits in the centre blob, where it overlaps apricot — on an edge blob any butter dims to olive.",
        },
      },
    ],
    accent: { name: "Apricot", slot: 1 },
    neutral: { name: "Warm greys", hue: 60, chroma: 0.012 },
    status: {
      success: { hue: 155, chroma: 0.1 },
      warning: { hue: 85, chroma: 0.12 },
      danger: { hue: 22, chroma: 0.15 },
      info: { hue: 240, chroma: 0.08 },
    },
    identity: [
      { name: "Butter", hue: 92, chroma: 0.1, l: 0.87 },
      { name: "Apricot", hue: 66, chroma: 0.1 },
      { name: "Peach", hue: 44, chroma: 0.1 },
      { name: "Rose", hue: 352, chroma: 0.09 },
      { name: "Sage", hue: 140, chroma: 0.08 },
      { name: "Dusk", hue: 250, chroma: 0.08 },
    ],
  },
  {
    id: "cool",
    name: "Cool",
    idea: "Blue hour: periwinkle sky, lavender at its edge, cornflower where it deepens.",
    trioName: "Lavender · Periwinkle · Cornflower",
    aura: [
      { name: "Periwinkle", l: 0.71, c: 0.14, h: 283 },
      {
        name: "Lavender",
        l: 0.76,
        c: 0.09,
        h: 310,
        anchor: {
          hex: "#B7A7C8",
          note: "Pantone Lavender Oil, oklch(0.753 0.05 307). Same lightness, hue 3° pinker, chroma 0.09: at the swatch chroma (0.05) the blob reads plain grey over the photos.",
        },
      },
      { name: "Cornflower", l: 0.74, c: 0.12, h: 254 },
    ],
    accent: { name: "Periwinkle", slot: 1, l: { 400: 0.74 } },
    neutral: { name: "Cool greys", hue: 268, chroma: 0.014 },
    status: {
      success: { hue: 160, chroma: 0.1 },
      warning: { hue: 80, chroma: 0.12 },
      danger: { hue: 18, chroma: 0.15 },
      info: { hue: 235, chroma: 0.09 },
    },
    identity: [
      { name: "Lavender", hue: 307, chroma: 0.09 },
      { name: "Periwinkle", hue: 283, chroma: 0.1 },
      { name: "Cornflower", hue: 256, chroma: 0.1 },
      { name: "Mist", hue: 215, chroma: 0.08 },
      { name: "Orchid", hue: 335, chroma: 0.09 },
      { name: "Sand", hue: 75, chroma: 0.08, l: 0.85 },
    ],
  },
  {
    id: "neutral",
    name: "Neutral",
    idea: "Sea glass on grey stone: seafoam, aqua and sky, with greys that carry no temperature at all.",
    trioName: "Seafoam · Aqua · Sky",
    aura: [
      { name: "Aqua", l: 0.79, c: 0.12, h: 200 },
      { name: "Sky", l: 0.76, c: 0.12, h: 232 },
      { name: "Seafoam", l: 0.82, c: 0.11, h: 170 },
    ],
    accent: { name: "Aqua", slot: 1 },
    neutral: { name: "True greys", hue: 0, chroma: 0 },
    status: {
      success: { hue: 150, chroma: 0.11 },
      warning: { hue: 75, chroma: 0.13 },
      danger: { hue: 25, chroma: 0.15 },
      info: { hue: 250, chroma: 0.09 },
    },
    identity: [
      { name: "Seafoam", hue: 172, chroma: 0.09 },
      { name: "Aqua", hue: 200, chroma: 0.09 },
      { name: "Sky", hue: 228, chroma: 0.09 },
      { name: "Slate violet", hue: 280, chroma: 0.08 },
      { name: "Clay", hue: 52, chroma: 0.08 },
      { name: "Moss", hue: 130, chroma: 0.08 },
    ],
  },
];

// ─── Built sets ────────────────────────────────────────────────────────────

export interface AuraColour {
  slot: 1 | 2 | 3;
  name: string;
  token: string;
  colour: Oklch;
  anchor?: AuraSpec["anchor"];
}

export interface IdentityHue {
  name: string;
  n: number;
  /** `--hue-n`: the opaque disc. */
  solid: string;
  /** `--hue-n-text`: the initials — the set's darkest neutral. */
  text: string;
}

export interface PaletteSet {
  id: SetId;
  name: string;
  idea: string;
  trioName: string;
  accentName: string;
  accentSlot: 1 | 2 | 3;
  neutralName: string;
  primitives: Record<string, Oklch>;
  ramps: Record<"neutral" | "accent" | Status, { token: string; step: number }[]>;
  aura: AuraColour[];
  identity: IdentityHue[];
  scrim: { colour: Oklch; alpha: number };
}

/** Smallest arc (degrees) on the hue wheel that holds every hue. */
export function hueSpan(hues: number[]): number {
  const sorted = [...hues].sort((a, b) => a - b);
  let widestGap = 0;
  sorted.forEach((h, i) => {
    const next =
      i === sorted.length - 1 ? (sorted[0] as number) + 360 : (sorted[i + 1] as number);
    widestGap = Math.max(widestGap, next - h);
  });
  return Math.round((360 - widestGap) * 10) / 10;
}

export function buildSet(spec: SetSpec): PaletteSet {
  const primitives: Record<string, Oklch> = {};
  const ramps = {} as PaletteSet["ramps"];

  ramps.neutral = NEUTRAL_STEPS.map((step) => {
    const token = `--ink-${step}`;
    primitives[token] = fitColour({
      l: NEUTRAL_L[step],
      c: spec.neutral.chroma * NEUTRAL_C[step],
      h: spec.neutral.hue,
    });
    return { token, step };
  });

  const base = spec.aura[spec.accent.slot - 1] as AuraSpec;
  ramps.accent = ACCENT_STEPS.map((step) => {
    const token = `--copper-${step}`;
    primitives[token] = fitColour({
      l: spec.accent.l?.[step] ?? ACCENT_L[step],
      c: base.c * ACCENT_C[step],
      h: base.h,
    });
    return { token, step };
  });

  for (const status of STATUSES) {
    const { hue, chroma } = spec.status[status];
    ramps[status] = STATUS_STEPS.map((step) => {
      const token = `--${FAMILY[status]}-${step}`;
      primitives[token] = fitColour({
        l: STATUS_L[step],
        c: chroma * STATUS_C[step],
        h: hue,
      });
      return { token, step };
    });
  }

  const aura = spec.aura.map(({ name, anchor, ...colour }, index) => {
    const slot = (index + 1) as 1 | 2 | 3;
    const token = `--aura-${slot}`;
    primitives[token] = fitColour(colour);
    return { slot, name, token, colour: primitives[token] as Oklch, anchor };
  });

  const identity = spec.identity.map(({ name, hue, chroma, l }, index) => {
    const n = index + 1;
    const gap = Math.abs(((hue - spec.status.danger.hue + 540) % 360) - 180);
    if (gap < IDENTITY_DANGER_GAP)
      throw new Error(`${spec.id}: identity ${name} is ${gap}° from danger`);
    primitives[`--hue-${n}`] = fitColour({
      l: l ?? IDENTITY.l,
      c: chroma * IDENTITY.c,
      h: hue,
    });
    primitives[`--hue-${n}-text`] = primitives["--ink-950"] as Oklch;
    return { name, n, solid: `--hue-${n}`, text: `--hue-${n}-text` };
  });

  return {
    id: spec.id,
    name: spec.name,
    idea: spec.idea,
    trioName: spec.trioName,
    accentName: spec.accent.name,
    accentSlot: spec.accent.slot,
    neutralName: spec.neutral.name,
    primitives,
    ramps,
    aura,
    identity,
    scrim: { colour: primitives["--ink-950"] as Oklch, alpha: 0.7 },
  };
}

/** The Ambient Wash's accent slots read the set's trio (sandbox-only override). */
export const WASH_FROM_AURA: Record<string, string> = Object.fromEntries(
  [1, 2, 3].map((n) => [`--wash-accent-${n}`, `var(--aura-${n})`]),
);

export const SETS: PaletteSet[] = SPECS.map(buildSet);
