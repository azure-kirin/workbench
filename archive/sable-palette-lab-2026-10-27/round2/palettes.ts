/**
 * Six candidate palettes for Sable — round 2. The source of truth for the
 * Palette Lab: each palette is written as intent (a visual source, hues,
 * chroma, lightness ladders) and built here into concrete, sRGB-safe OKLCH.
 * `generate.ts` writes `palettes.css` (hex in comments) and `palettes.json`.
 *
 * A palette has two layers that never mix:
 *
 *   MEANING — what production Semantic tokens already read:
 *     --ink-*      neutral ramp (50 → 950, plus 850)
 *     --copper-*   the BUTTON accent ramp (50 → 900; the name is historical)
 *     --moss-* / --ochre-* / --brick-* / --slate-*
 *                  success / warning / danger / info (300 → 800)
 *     --scrim-70
 *
 *   DECORATION — new, sandbox-only for now; never success/danger:
 *     --aura-<trio>-<n>-<300|500|700>   three aura trios (main, alt-a, alt-b)
 *     --aura-<trio>-<n>-warm / -cool    each colour turned warmer / cooler in
 *                                       hue (lightness and chroma kept)
 *     --hue-<n>-fill / -text, --hue-<n> the identity set: avatar fallbacks,
 *                                       illustration fills, chart series
 *
 * The aura slots (`--aura-1…3`, plus `-warm` / `-cool`) point at a trio, and
 * the Ambient Wash tones read the slots — see `decorationSemantic()`.
 */
import { fitGamut as clampToGamut, type Oklch } from "../color.ts";

/** Gamut-fit, then round to what the CSS will say (chroma rounded down, so it stays in gamut). */
function fitGamut(colour: Oklch): Oklch {
  const { l, c, h } = clampToGamut(colour);
  return {
    l: Math.round(l * 1000) / 1000,
    c: Math.floor(c * 1000) / 1000,
    h: Math.round((((h % 360) + 360) % 360) * 10) / 10,
  };
}

export type Temperature = "warm" | "cool" | "neutral";

export const NEUTRAL_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950,
] as const;
export const ACCENT_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const STATUS_STEPS = [300, 400, 500, 600, 700, 800] as const;
export const AURA_STEPS = [300, 500, 700] as const;
export const STATUSES = ["success", "warning", "danger", "info"] as const;
export type Status = (typeof STATUSES)[number];
export const TRIOS = ["main", "alt-a", "alt-b"] as const;
export type TrioId = (typeof TRIOS)[number];

/** Which existing primitive family each meaning role fills. */
export const FAMILY: Record<"neutral" | "accent" | Status, string> = {
  neutral: "ink",
  accent: "copper",
  success: "moss",
  warning: "ochre",
  danger: "brick",
  info: "slate",
};

type Steps<T extends readonly number[]> = Partial<Record<T[number], number>>;

interface HueSpec {
  name: string;
  hue: number;
  chroma: number;
}

interface TrioSpec {
  name: string;
  colours: [HueSpec, HueSpec, HueSpec];
}

interface PaletteSpec {
  id: string;
  name: string;
  temperature: Temperature;
  /** The concrete visual source the palette is drawn from. */
  source: string;
  /** One line: the point of view. */
  rationale: string;
  /** How it squares with the 2026–27 research (sanity check, not the brief). */
  trend: string;
  neutral: { hue: number; chroma: number; l?: Steps<typeof NEUTRAL_STEPS> };
  accent: {
    name: string;
    hue: number;
    chroma: number;
    hueShift?: number;
    l?: Steps<typeof ACCENT_STEPS>;
  };
  status: Record<Status, { hue: number; chroma: number }>;
  aura: Record<TrioId, TrioSpec>;
  identity: HueSpec[];
  semantic?: Record<string, string>;
}

// ─── Ladders ───────────────────────────────────────────────────────────────

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
/** Greys go cleaner as they lighten: text stays white, surfaces carry the temperature. */
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
  200: 0.87,
  300: 0.81,
  400: 0.745,
  500: 0.655,
  600: 0.565,
  700: 0.47,
  800: 0.37,
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
/** Aura: a light, a mid (what the wash paints with) and a deep step. */
const AURA_L: Record<(typeof AURA_STEPS)[number], number> = {
  300: 0.84,
  500: 0.7,
  700: 0.5,
};
const AURA_C: Record<(typeof AURA_STEPS)[number], number> = {
  300: 0.6,
  500: 1,
  700: 0.8,
};
/** Identity pairs: a soft fill with a readable foreground, plus a mid solid for charts. */
const IDENTITY = {
  fill: { l: 0.335, c: 0.45 },
  text: { l: 0.865, c: 0.75 },
  solid: { l: 0.72, c: 1 },
};
/** Warm and cool aura variants turn the hue toward these poles, at most TURN degrees. */
const WARM_POLE = 55;
const COOL_POLE = 235;
const TURN = 40;

// ─── The six ───────────────────────────────────────────────────────────────

export const SPECS: PaletteSpec[] = [
  // ── Warm ──────────────────────────────────────────────────────────────
  {
    id: "safelight",
    name: "Safelight",
    temperature: "warm",
    source:
      "A darkroom at work — the amber safelight, sepia and selenium toner, the fixer tray",
    rationale:
      "Everything lit by one amber lamp; prints toning from sepia to selenium plum. Warmth from light, not from cream and terracotta.",
    trend: "The warm darks of 2026 (Silhouette, Mocha Mousse) — as light, not paint",
    neutral: {
      hue: 45,
      chroma: 0.014,
      l: { 950: 0.17, 900: 0.21, 850: 0.245, 800: 0.28 },
    },
    accent: { name: "Safelight amber", hue: 70, chroma: 0.15, hueShift: 8 },
    status: {
      success: { hue: 160, chroma: 0.08 },
      warning: { hue: 90, chroma: 0.12 },
      danger: { hue: 24, chroma: 0.14 },
      info: { hue: 240, chroma: 0.07 },
    },
    aura: {
      main: {
        name: "Safelight",
        colours: [
          { name: "Safelight red", hue: 27, chroma: 0.16 },
          { name: "Amber", hue: 70, chroma: 0.15 },
          { name: "Selenium plum", hue: 330, chroma: 0.12 },
        ],
      },
      "alt-a": {
        name: "Sepia toner",
        colours: [
          { name: "Sepia", hue: 55, chroma: 0.08 },
          { name: "Toned rose", hue: 12, chroma: 0.09 },
          { name: "Olive shadow", hue: 110, chroma: 0.07 },
        ],
      },
      "alt-b": {
        name: "Cyanotype proof",
        colours: [
          { name: "Prussian blue", hue: 255, chroma: 0.13 },
          { name: "Tea tone", hue: 50, chroma: 0.09 },
          { name: "Bleach yellow", hue: 95, chroma: 0.1 },
        ],
      },
    },
    identity: [
      { name: "Toned rose", hue: 355, chroma: 0.1 },
      { name: "Sepia", hue: 58, chroma: 0.09 },
      { name: "Olive", hue: 108, chroma: 0.09 },
      { name: "Fixer teal", hue: 182, chroma: 0.08 },
      { name: "Steel", hue: 245, chroma: 0.08 },
      { name: "Selenium", hue: 312, chroma: 0.09 },
    ],
  },
  {
    id: "mood",
    name: "Mood for Love",
    temperature: "warm",
    source:
      "Wong Kar-wai & Christopher Doyle — In the Mood for Love, 2046, Chungking Express",
    rationale:
      "Tobacco-and-rouge shadows, a cheongsam crimson, lamp gold — and the button is jade, the colour of the corridor's tiles.",
    trend: "Divine Damson's deep reds and Hidden Gem's jade, given a film's light",
    neutral: { hue: 22, chroma: 0.016 },
    accent: { name: "Jade", hue: 163, chroma: 0.12, hueShift: -6 },
    status: {
      success: { hue: 135, chroma: 0.1 },
      warning: { hue: 82, chroma: 0.12 },
      danger: { hue: 18, chroma: 0.15 },
      info: { hue: 232, chroma: 0.08 },
    },
    aura: {
      main: {
        name: "Cheongsam",
        colours: [
          { name: "Cheongsam crimson", hue: 12, chroma: 0.16 },
          { name: "Lamp gold", hue: 82, chroma: 0.13 },
          { name: "Jade", hue: 163, chroma: 0.12 },
        ],
      },
      "alt-a": {
        name: "Chungking Express",
        colours: [
          { name: "Neon magenta", hue: 345, chroma: 0.2 },
          { name: "Sodium yellow", hue: 95, chroma: 0.16 },
          { name: "Fluorescent green", hue: 145, chroma: 0.17 },
        ],
      },
      "alt-b": {
        name: "2046",
        colours: [
          { name: "Oxblood", hue: 15, chroma: 0.12 },
          { name: "Petrol", hue: 220, chroma: 0.1 },
          { name: "Brass", hue: 78, chroma: 0.11 },
        ],
      },
    },
    identity: [
      { name: "Lamp gold", hue: 82, chroma: 0.1 },
      { name: "Tea", hue: 50, chroma: 0.09 },
      { name: "Jade", hue: 163, chroma: 0.1 },
      { name: "Petrol", hue: 220, chroma: 0.09 },
      { name: "Smoke violet", hue: 300, chroma: 0.08 },
      { name: "Rouge", hue: 350, chroma: 0.1 },
    ],
  },
  // ── Cool ──────────────────────────────────────────────────────────────
  {
    id: "aquarium",
    name: "Aquarium",
    temperature: "cool",
    source:
      "A public aquarium after closing — tank light through dark water, coral, anemones",
    rationale:
      "Deep blue-green dark lit from inside by one cyan tank, with coral and anemone violet drifting through it.",
    trend: "Transformative Teal (CotY 2026) as light in water rather than a swatch",
    neutral: {
      hue: 222,
      chroma: 0.02,
      l: { 950: 0.165, 900: 0.205, 850: 0.24, 800: 0.275 },
    },
    accent: {
      name: "Tank cyan",
      hue: 205,
      chroma: 0.11,
      hueShift: -6,
      l: { 300: 0.85, 400: 0.79, 500: 0.7, 600: 0.61 },
    },
    status: {
      success: { hue: 158, chroma: 0.1 },
      warning: { hue: 80, chroma: 0.11 },
      danger: { hue: 15, chroma: 0.14 },
      info: { hue: 255, chroma: 0.09 },
    },
    aura: {
      main: {
        name: "Night tank",
        colours: [
          { name: "Bioluminescent cyan", hue: 200, chroma: 0.13 },
          { name: "Coral", hue: 35, chroma: 0.15 },
          { name: "Anemone violet", hue: 305, chroma: 0.13 },
        ],
      },
      "alt-a": {
        name: "Kelp forest",
        colours: [
          { name: "Kelp", hue: 120, chroma: 0.11 },
          { name: "Sea glass", hue: 180, chroma: 0.09 },
          { name: "Sunbeam", hue: 75, chroma: 0.13 },
        ],
      },
      "alt-b": {
        name: "Reef",
        colours: [
          { name: "Clownfish", hue: 55, chroma: 0.17 },
          { name: "Reef blue", hue: 245, chroma: 0.13 },
          { name: "Sea slug", hue: 115, chroma: 0.15 },
        ],
      },
    },
    identity: [
      { name: "Coral", hue: 42, chroma: 0.1 },
      { name: "Sand", hue: 82, chroma: 0.09 },
      { name: "Kelp", hue: 125, chroma: 0.09 },
      { name: "Sea glass", hue: 178, chroma: 0.08 },
      { name: "Reef blue", hue: 245, chroma: 0.09 },
      { name: "Anemone", hue: 305, chroma: 0.1 },
    ],
  },
  {
    id: "basalt",
    name: "Basalt",
    temperature: "cool",
    source:
      "Volcanic basalt with a sulphur crust and hot-spring minerals — Iceland, Danakil",
    rationale:
      "Blue-black stone; the button is the sulphur crystal, and magma and a hot-spring teal glow from the cracks.",
    trend: "Luminous Blue's cool depth (CotY 2027) as stone, Energy Orange as heat",
    neutral: { hue: 258, chroma: 0.012 },
    accent: {
      name: "Sulphur",
      hue: 103,
      chroma: 0.17,
      hueShift: -6,
      l: { 200: 0.94, 300: 0.91, 400: 0.875, 500: 0.8, 600: 0.7, 700: 0.58, 800: 0.44 },
    },
    status: {
      success: { hue: 145, chroma: 0.1 },
      warning: { hue: 62, chroma: 0.14 },
      danger: { hue: 26, chroma: 0.15 },
      info: { hue: 225, chroma: 0.09 },
    },
    aura: {
      main: {
        name: "Fumarole",
        colours: [
          { name: "Magma", hue: 38, chroma: 0.17 },
          { name: "Sulphur", hue: 103, chroma: 0.17 },
          { name: "Hot-spring teal", hue: 188, chroma: 0.12 },
        ],
      },
      "alt-a": {
        name: "Lava field",
        colours: [
          { name: "Lava", hue: 28, chroma: 0.17 },
          { name: "Ember", hue: 60, chroma: 0.16 },
          { name: "Ash violet", hue: 300, chroma: 0.08 },
        ],
      },
      "alt-b": {
        name: "Glacier",
        colours: [
          { name: "Glacier blue", hue: 228, chroma: 0.11 },
          { name: "Lichen", hue: 135, chroma: 0.1 },
          { name: "Obsidian plum", hue: 320, chroma: 0.09 },
        ],
      },
    },
    identity: [
      { name: "Ember", hue: 62, chroma: 0.1 },
      { name: "Sulphur", hue: 103, chroma: 0.1 },
      { name: "Lichen", hue: 140, chroma: 0.09 },
      { name: "Mineral teal", hue: 188, chroma: 0.08 },
      { name: "Glacier", hue: 230, chroma: 0.09 },
      { name: "Ash violet", hue: 300, chroma: 0.08 },
    ],
  },
  // ── Neutral ───────────────────────────────────────────────────────────
  {
    id: "riso",
    name: "Risograph",
    temperature: "neutral",
    source:
      "Risograph duotones — fluorescent pink, teal and yellow soy inks, slightly off-register",
    rationale:
      "Clean grey stock and three printer's inks that overprint; the button is the fluorescent pink everyone remembers from a zine.",
    trend: "SS27's 'loud and quiet together' (Rosy Future, Waterfall, Anise) as ink",
    neutral: { hue: 0, chroma: 0 },
    accent: { name: "Fluorescent pink", hue: 356, chroma: 0.2, hueShift: 6 },
    status: {
      success: { hue: 155, chroma: 0.13 },
      warning: { hue: 62, chroma: 0.15 },
      danger: { hue: 25, chroma: 0.16 },
      info: { hue: 255, chroma: 0.11 },
    },
    aura: {
      main: {
        name: "Pink · Teal · Yellow",
        colours: [
          { name: "Fluorescent pink", hue: 356, chroma: 0.2 },
          { name: "Riso teal", hue: 205, chroma: 0.12 },
          { name: "Riso yellow", hue: 95, chroma: 0.17 },
        ],
      },
      "alt-a": {
        name: "Federal & Orange",
        colours: [
          { name: "Federal blue", hue: 265, chroma: 0.15 },
          { name: "Riso orange", hue: 55, chroma: 0.17 },
          { name: "Mint", hue: 170, chroma: 0.11 },
        ],
      },
      "alt-b": {
        name: "Sunflower & Purple",
        colours: [
          { name: "Sunflower", hue: 88, chroma: 0.16 },
          { name: "Purple", hue: 305, chroma: 0.15 },
          { name: "Kelly green", hue: 150, chroma: 0.15 },
        ],
      },
    },
    identity: [
      { name: "Pink", hue: 356, chroma: 0.11 },
      { name: "Orange", hue: 58, chroma: 0.1 },
      { name: "Yellow", hue: 95, chroma: 0.1 },
      { name: "Mint", hue: 172, chroma: 0.09 },
      { name: "Teal", hue: 212, chroma: 0.09 },
      { name: "Purple", hue: 300, chroma: 0.1 },
    ],
  },
  {
    id: "urushi",
    name: "Urushi",
    temperature: "neutral",
    source:
      "Japanese lacquerware — sumi ink, cinnabar, gold leaf and raden (abalone inlay)",
    rationale:
      "Ink-black and lacquer; the button is aogai, the blue-violet flash of abalone shell, set against cinnabar and gold.",
    trend: "Cloud Dancer's quiet (Pantone 2026) as ink; Lavender Oil grown into abalone",
    neutral: { hue: 70, chroma: 0.0025 },
    accent: { name: "Aogai", hue: 282, chroma: 0.12, hueShift: 8 },
    status: {
      success: { hue: 160, chroma: 0.09 },
      warning: { hue: 85, chroma: 0.11 },
      danger: { hue: 28, chroma: 0.15 },
      info: { hue: 245, chroma: 0.08 },
    },
    aura: {
      main: {
        name: "Urushi",
        colours: [
          { name: "Cinnabar", hue: 32, chroma: 0.16 },
          { name: "Gold leaf", hue: 85, chroma: 0.12 },
          { name: "Aogai", hue: 282, chroma: 0.12 },
        ],
      },
      "alt-a": {
        name: "Kintsugi",
        colours: [
          { name: "Gold seam", hue: 85, chroma: 0.12 },
          { name: "Celadon", hue: 165, chroma: 0.07 },
          { name: "Clay", hue: 48, chroma: 0.07 },
        ],
      },
      "alt-b": {
        name: "Raden",
        colours: [
          { name: "Abalone pink", hue: 350, chroma: 0.1 },
          { name: "Abalone green", hue: 170, chroma: 0.1 },
          { name: "Abalone blue", hue: 240, chroma: 0.11 },
        ],
      },
    },
    identity: [
      { name: "Gold", hue: 85, chroma: 0.1 },
      { name: "Persimmon", hue: 58, chroma: 0.1 },
      { name: "Celadon", hue: 160, chroma: 0.08 },
      { name: "Indigo", hue: 250, chroma: 0.09 },
      { name: "Aogai", hue: 285, chroma: 0.1 },
      { name: "Plum", hue: 335, chroma: 0.09 },
    ],
  },
];

// ─── Built palettes ────────────────────────────────────────────────────────

export interface AuraColour {
  name: string;
  slot: 1 | 2 | 3;
  /** Primitive tokens: steps 300/500/700, then the warm and cool turns of 500. */
  tokens: { step: number | "warm" | "cool"; token: string }[];
}

export interface Trio {
  id: TrioId;
  name: string;
  colours: AuraColour[];
}

export interface IdentityHue {
  name: string;
  n: number;
  fill: string;
  text: string;
  solid: string;
}

export interface Palette {
  id: string;
  name: string;
  temperature: Temperature;
  source: string;
  rationale: string;
  trend: string;
  accentName: string;
  /** Every primitive this palette sets, by CSS custom property name. */
  primitives: Record<string, Oklch>;
  ramps: Record<"neutral" | "accent" | Status, { token: string; step: number }[]>;
  aura: Record<TrioId, Trio>;
  identity: IdentityHue[];
  scrim: { colour: Oklch; alpha: number };
  semantic: Record<string, string>;
}

/** Turn a hue toward a pole by at most TURN degrees, along the short way round. */
function turnToward(hue: number, pole: number): number {
  const delta = ((pole - hue + 540) % 360) - 180;
  return hue + Math.sign(delta) * Math.min(Math.abs(delta), TURN);
}

export function buildPalette(spec: PaletteSpec): Palette {
  const primitives: Record<string, Oklch> = {};
  const ramps = {} as Palette["ramps"];

  ramps.neutral = NEUTRAL_STEPS.map((step) => {
    const token = `--ink-${step}`;
    primitives[token] = fitGamut({
      l: spec.neutral.l?.[step] ?? NEUTRAL_L[step],
      c: spec.neutral.chroma * NEUTRAL_C[step],
      h: spec.neutral.hue,
    });
    return { token, step };
  });

  const shift = spec.accent.hueShift ?? 0;
  ramps.accent = ACCENT_STEPS.map((step, index) => {
    const token = `--copper-${step}`;
    const t = index / (ACCENT_STEPS.length - 1) - 0.5;
    primitives[token] = fitGamut({
      l: spec.accent.l?.[step] ?? ACCENT_L[step],
      c: spec.accent.chroma * ACCENT_C[step],
      h: spec.accent.hue + shift * t,
    });
    return { token, step };
  });

  for (const status of STATUSES) {
    const { hue, chroma } = spec.status[status];
    ramps[status] = STATUS_STEPS.map((step) => {
      const token = `--${FAMILY[status]}-${step}`;
      primitives[token] = fitGamut({
        l: STATUS_L[step],
        c: chroma * STATUS_C[step],
        h: hue,
      });
      return { token, step };
    });
  }

  const aura = {} as Palette["aura"];
  for (const trio of TRIOS) {
    const trioSpec = spec.aura[trio];
    aura[trio] = {
      id: trio,
      name: trioSpec.name,
      colours: trioSpec.colours.map(({ name, hue, chroma }, index) => {
        const slot = (index + 1) as 1 | 2 | 3;
        const base = `--aura-${trio}-${slot}`;
        const tokens: AuraColour["tokens"] = [];
        for (const step of AURA_STEPS) {
          primitives[`${base}-${step}`] = fitGamut({
            l: AURA_L[step],
            c: chroma * AURA_C[step],
            h: hue,
          });
          tokens.push({ step, token: `${base}-${step}` });
        }
        for (const [step, pole] of [
          ["warm", WARM_POLE],
          ["cool", COOL_POLE],
        ] as const) {
          primitives[`${base}-${step}`] = fitGamut({
            l: AURA_L[500],
            c: chroma,
            h: turnToward(hue, pole),
          });
          tokens.push({ step, token: `${base}-${step}` });
        }
        return { name, slot, tokens };
      }),
    };
  }

  const identity = spec.identity.map(({ name, hue, chroma }, index) => {
    const n = index + 1;
    const make = (suffix: string, { l, c }: { l: number; c: number }) => {
      const token = suffix ? `--hue-${n}-${suffix}` : `--hue-${n}`;
      primitives[token] = fitGamut({ l, c: chroma * c, h: hue });
      return token;
    };
    return {
      name,
      n,
      fill: make("fill", IDENTITY.fill),
      text: make("text", IDENTITY.text),
      solid: make("", IDENTITY.solid),
    };
  });

  return {
    id: spec.id,
    name: spec.name,
    temperature: spec.temperature,
    source: spec.source,
    rationale: spec.rationale,
    trend: spec.trend,
    accentName: spec.accent.name,
    primitives,
    ramps,
    aura,
    identity,
    scrim: { colour: primitives["--ink-950"] as Oklch, alpha: 0.7 },
    semantic: spec.semantic ?? {},
  };
}

/**
 * The decoration slots for one trio: `--aura-1…3` (+ `-warm` / `-cool`).
 * Shared by the generated CSS and the contrast checker, so they cannot drift.
 */
export function decorationSemantic(trio: TrioId): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of [1, 2, 3]) {
    out[`--aura-${n}`] = `var(--aura-${trio}-${n}-500)`;
    out[`--aura-${n}-warm`] = `var(--aura-${trio}-${n}-warm)`;
    out[`--aura-${n}-cool`] = `var(--aura-${trio}-${n}-cool)`;
  }
  return out;
}

/**
 * The Ambient Wash tones re-aimed at the aura slots: `accent` is the trio,
 * `warm` / `cool` the trio turned in hue. `neutral` keeps globals.css's greys.
 */
export const WASH_FROM_AURA: Record<string, string> = Object.fromEntries(
  [1, 2, 3].flatMap((n) => [
    [`--wash-accent-${n}`, `var(--aura-${n})`],
    [`--wash-warm-${n}`, `var(--aura-${n}-warm)`],
    [`--wash-cool-${n}`, `var(--aura-${n}-cool)`],
  ]),
);

export const PALETTES: Palette[] = SPECS.map(buildPalette);

export const TEMPERATURES: Temperature[] = ["warm", "cool", "neutral"];
