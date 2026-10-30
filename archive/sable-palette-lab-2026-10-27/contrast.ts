/**
 * The Palette Lab contrast checker. It runs the SAME promises Sable's own
 * tests keep for the production palette, against each of the three sets:
 *
 *   - text tokens AA on the depth ladder, primary actions, status colours;
 *   - text on materials over a white page — the model in
 *     `src/components/items/material/material-contrast.test.ts`;
 *   - text on Ambient Wash at every tone × intensity × anchor — the model in
 *     `src/components/items/ambient-wash/ambient-wash.test.tsx`, through the
 *     same fall-off and sampler (aura-geometry.ts mirrors `worstContrast` for
 *     any blob layout, so the trio layout is held to the production rule);
 *   - the identity set: near-black initials on the solid disc, and the disc on surface.
 *
 * The semantic layer is read from globals.css (its text is passed in, so the
 * node script and the Storybook page share this module), then the palette's
 * primitives and semantic re-points are laid over it.
 */
import {
  contrastRatio,
  type Rgb,
} from "../../src/components/items/ambient-wash/wash-geometry.ts";
import { LAYOUT_NAMES, LAYOUTS, worstContrastIn } from "./aura-geometry.ts";
import { hexToRgb, mixOklab, mixSrgb, oklchToRgb } from "./color.ts";
import { type PaletteSet, WASH_FROM_AURA } from "./sets.ts";

/** Every `--token: value;` on the first `:root {` block, whitespace collapsed. */
export function readDeclarations(css: string): Map<string, string> {
  const start = css.indexOf(":root {");
  const block = css.slice(start, css.indexOf("\n}", start));
  return new Map(
    [...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [
      m[1] as string,
      (m[2] as string)
        .replace(/\s+/g, " ")
        .replace(/\( /g, "(")
        .replace(/ \)/g, ")")
        .trim(),
    ]),
  );
}

interface Paint {
  rgb: Rgb;
  alpha: number;
}

/**
 * Resolve tokens for one set: globals.css, with the wash's accent slots
 * re-aimed at the set's aura trio, over the set's primitives.
 */
export function makeResolver(palette: PaletteSet, declared: Map<string, string>) {
  const semantic = new Map(declared);
  for (const [name, value] of Object.entries(WASH_FROM_AURA)) semantic.set(name, value);

  function value(name: string): string {
    const v = semantic.get(name);
    if (v === undefined) throw new Error(`${name} is not declared`);
    return v;
  }

  function paint(name: string): Paint {
    if (name === "--scrim-70")
      return { rgb: oklchToRgb(palette.scrim.colour), alpha: palette.scrim.alpha };
    const primitive = palette.primitives[name];
    if (primitive) return { rgb: oklchToRgb(primitive), alpha: 1 };
    return parse(value(name), name);
  }

  function parse(v: string, name: string): Paint {
    const alias = v.match(/^var\((--[\w-]+)\)$/)?.[1];
    if (alias) return paint(alias);
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) {
      const alpha = v.length === 9 ? Number.parseInt(v.slice(7), 16) / 255 : 1;
      return { rgb: hexToRgb(v), alpha };
    }
    const mix = v.match(
      /^color-mix\(in (oklab|srgb), var\((--[\w-]+)\) ([\d.]+)%, (transparent|var\((--[\w-]+)\))\)$/,
    );
    if (mix) {
      const [, space, a, pct, , b] = mix;
      const top = paint(a as string);
      const p = Number(pct) / 100;
      if (!b) return { rgb: top.rgb, alpha: top.alpha * p };
      const bottom = paint(b);
      const blend = space === "oklab" ? mixOklab : mixSrgb;
      return { rgb: blend(top.rgb, bottom.rgb, p), alpha: 1 };
    }
    throw new Error(`${name}: cannot resolve "${v}"`);
  }

  const rgb = (name: string) => paint(name).rgb;
  const number = (name: string) => {
    const n = Number.parseFloat(value(name));
    if (!Number.isFinite(n)) throw new Error(`${name} is not a number`);
    return n;
  };
  return { paint, rgb, number, value };
}

export type Resolver = ReturnType<typeof makeResolver>;

// ─── The material model (mirrors material-contrast.test.ts) ────────────────

const WHITE: Rgb = [255, 255, 255];
const over = (top: Rgb, bottom: Rgb, alpha: number): Rgb =>
  top.map((t, i) => t * alpha + (bottom[i] as number) * (1 - alpha)) as Rgb;
const overlay = (top: Rgb, bottom: Rgb, alpha: number): Rgb =>
  bottom.map((b, i) => {
    const t = top[i] as number;
    const blended = b < 128 ? (2 * b * t) / 255 : 255 - (2 * (255 - b) * (255 - t)) / 255;
    return blended * alpha + b * (1 - alpha);
  }) as Rgb;

const MATERIALS = [
  { name: "glass", fill: "--glass-fill", dims: true, promises: ["--text-primary"] },
  {
    name: "glass + tint",
    fill: "--glass-fill",
    dims: true,
    tint: true,
    promises: ["--text-primary"],
  },
  {
    name: "glass thick",
    fill: "--glass-fill-thick",
    dims: true,
    promises: ["--text-primary", "--text-secondary"],
  },
  {
    name: "translucent",
    fill: "--translucent-fill",
    dims: false,
    promises: ["--text-primary", "--text-secondary", "--text-muted"],
  },
] as const;

function worstMaterialBackground(r: Resolver, material: (typeof MATERIALS)[number]): Rgb {
  const brightness = material.dims ? r.number("--glass-brightness") : 1;
  const { rgb: colour, alpha } = r.paint(material.fill);
  let result = over(colour, WHITE.map((c) => c * brightness) as Rgb, alpha);
  if ("tint" in material && material.tint) {
    result = over(r.rgb("--glass-tint"), result, r.number("--glass-tint-strength") / 100);
  }
  if (material.dims) result = overlay(WHITE, result, r.number("--glass-grain-opacity"));
  return result;
}

// ─── The wash model (mirrors ambient-wash.test.tsx) ────────────────────────

export const WASH_TONES = ["accent", "neutral"] as const;
export const WASH_INTENSITIES = ["subtle", "medium", "vivid"] as const;
const WASH_PROMISE: Record<(typeof WASH_INTENSITIES)[number], string[]> = {
  subtle: ["--text-primary", "--text-secondary", "--text-muted"],
  medium: ["--text-primary", "--text-secondary"],
  vivid: ["--text-primary"],
};

// ─── The checks ────────────────────────────────────────────────────────────

export interface Check {
  group: Group;
  label: string;
  ratio: number;
  min: number;
}

export const GROUPS = [
  {
    id: "text",
    title: "Text AA",
    detail: "primary/secondary/muted on background, surface, raised",
    min: 4.5,
  },
  {
    id: "accent",
    title: "Accent UI",
    detail: "--primary on background and surface",
    min: 3,
  },
  {
    id: "on-primary",
    title: "On primary",
    detail: "--primary-foreground on --primary",
    min: 4.5,
  },
  {
    id: "status",
    title: "Status",
    detail: "success/warning/danger/info on surface",
    min: 3,
  },
  {
    id: "glass",
    title: "Glass",
    detail: "material-contrast model, white page",
    min: 4.5,
  },
  {
    id: "wash",
    title: "Wash",
    detail:
      "ambient-wash model over --background, the trio in the slots: tone × intensity × layout",
    min: 4.5,
  },
  {
    id: "identity",
    title: "Identity",
    detail:
      "--hue-n-text on --hue-n (AA, small text) and --hue-n vs --surface (3:1, non-text)",
    min: 3,
  },
  {
    id: "extra",
    title: "Extras",
    detail: "ring, accent-foreground, solid badge labels (informational)",
    min: 3,
  },
] as const;
export type Group = (typeof GROUPS)[number]["id"];

export function checkSet(palette: PaletteSet, declared: Map<string, string>): Check[] {
  const r = makeResolver(palette, declared);
  const checks: Check[] = [];
  const add = (group: Group, label: string, a: Rgb, b: Rgb, min: number) =>
    checks.push({ group, label, ratio: contrastRatio(a, b), min });

  for (const text of ["--text-primary", "--text-secondary", "--text-muted"])
    for (const bg of ["--background", "--surface", "--surface-raised"])
      add("text", `${text} on ${bg}`, r.rgb(text), r.rgb(bg), 4.5);

  add(
    "accent",
    "--primary on --background",
    r.rgb("--primary"),
    r.rgb("--background"),
    3,
  );
  add("accent", "--primary on --surface", r.rgb("--primary"), r.rgb("--surface"), 3);
  add(
    "on-primary",
    "--primary-foreground on --primary",
    r.rgb("--primary-foreground"),
    r.rgb("--primary"),
    4.5,
  );
  for (const status of ["--success", "--warning", "--danger", "--info"])
    add("status", `${status} on --surface`, r.rgb(status), r.rgb("--surface"), 3);

  for (const material of MATERIALS) {
    const bg = worstMaterialBackground(r, material);
    for (const text of material.promises)
      add("glass", `${text} on ${material.name}`, r.rgb(text), bg, 4.5);
  }

  const background = r.rgb("--background");
  for (const tone of WASH_TONES)
    for (const intensity of WASH_INTENSITIES) {
      const hues = [1, 2, 3].map((n) => r.rgb(`--wash-${tone}-${n}`)) as [Rgb, Rgb, Rgb];
      const strength = Number.parseFloat(r.value(`--wash-strength-${intensity}`)) / 100;
      for (const text of WASH_PROMISE[intensity]) {
        const ratio = Math.min(
          ...LAYOUT_NAMES.map((layout) =>
            worstContrastIn({
              blobs: LAYOUTS[layout],
              hues,
              strength,
              background,
              text: r.rgb(text),
            }),
          ),
        );
        checks.push({
          group: "wash",
          label: `${text} on ${tone} · ${intensity}`,
          ratio,
          min: 4.5,
        });
      }
    }

  for (const hue of palette.identity) {
    add(
      "identity",
      `${hue.text} on ${hue.solid} (${hue.name})`,
      r.rgb(hue.text),
      r.rgb(hue.solid),
      4.5,
    );
    add(
      "identity",
      `${hue.solid} vs --surface (${hue.name})`,
      r.rgb(hue.solid),
      r.rgb("--surface"),
      3,
    );
  }

  add("extra", "--ring on --background", r.rgb("--ring"), r.rgb("--background"), 3);
  add(
    "extra",
    "--accent-foreground on --accent",
    r.rgb("--accent-foreground"),
    r.rgb("--accent"),
    4.5,
  );
  for (const status of ["--success", "--warning", "--danger", "--info"])
    add(
      "extra",
      `solid badge: --background on ${status}`,
      r.rgb("--background"),
      r.rgb(status),
      4.5,
    );

  return checks;
}

export interface GroupSummary {
  group: Group;
  worst: Check;
  pass: boolean;
}

export function summarise(checks: Check[]): GroupSummary[] {
  return GROUPS.map(({ id }) => {
    const mine = checks.filter((c) => c.group === id);
    const worst = mine.reduce((a, b) => (b.ratio / b.min < a.ratio / a.min ? b : a));
    return { group: id, worst, pass: mine.every((c) => c.ratio >= c.min) };
  });
}
