import type { ContrastOptions } from "./config.js";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * One run of text as the page actually rendered it. Produced by the DOM probe,
 * consumed by `analyseSamples` — the split is what makes the arithmetic
 * testable without a browser.
 */
export interface TextSample {
  /** Computed `color`, in whatever form getComputedStyle returned. */
  color: string;
  /**
   * Background colours from the element outwards, innermost first, stopping at
   * the first fully opaque one. Composited in that order.
   */
  backgrounds: string[];
  /** True when something in the ancestor chain paints an image or gradient. */
  paintedBackdrop: boolean;
  fontSizePx: number;
  fontWeight: number;
  /** A short, human-recognisable path to the element. */
  selector: string;
  /** First few words, so a finding can be found on the page. */
  text: string;
}

export interface ContrastFinding {
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  /** How many text runs on the site share this exact pair and threshold. */
  count: number;
  /** One of them, for going and looking. */
  example: { selector: string; text: string; route: string };
}

export interface ContrastResult {
  failures: ContrastFinding[];
  /** Text runs that could be judged. */
  examined: number;
  /** Distinct (foreground, background, threshold) triples examined. */
  pairsChecked: number;
  /** Runs whose backdrop could not be determined, so were not judged. */
  undetermined: number;
}

const NAMED: Record<string, string> = {
  transparent: "rgba(0,0,0,0)",
  black: "#000000",
  white: "#ffffff",
};

/** Parses the colour forms `getComputedStyle` can return, plus hex. */
export function parseColor(input: string | null | undefined): Rgba | null {
  if (!input) return null;
  const value = NAMED[input.trim().toLowerCase()] ?? input.trim();

  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let d = hex[1];
    if (d.length === 3 || d.length === 4) d = [...d].map((c) => c + c).join("");
    if (d.length !== 6 && d.length !== 8) return null;
    return {
      r: parseInt(d.slice(0, 2), 16),
      g: parseInt(d.slice(2, 4), 16),
      b: parseInt(d.slice(4, 6), 16),
      a: d.length === 8 ? parseInt(d.slice(6, 8), 16) / 255 : 1,
    };
  }

  // rgb(0 0 0 / 50%), rgba(0, 0, 0, 0.5), rgb(0,0,0)
  const fn = value.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const num = (p: string, scale: number) =>
      p.endsWith("%") ? (parseFloat(p) / 100) * scale : parseFloat(p);
    const [r, g, b] = parts.slice(0, 3).map((p) => num(p, 255));
    const a = parts[3] === undefined ? 1 : num(parts[3], 1);
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }

  return null;
}

export function formatColor(c: Rgba): string {
  const hex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  const base = `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
  return c.a >= 1 ? base : `${base} @ ${Math.round(c.a * 100)}%`;
}

/** Source-over composite of a translucent colour onto an opaque one. */
export function composite(over: Rgba, under: Rgba): Rgba {
  const a = over.a;
  return {
    r: over.r * a + under.r * (1 - a),
    g: over.g * a + under.g * (1 - a),
    b: over.b * a + under.b * (1 - a),
    a: 1,
  };
}

export function relativeLuminance(c: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
  );
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG 1.4.3 / 1.4.6. Large text is ≥24px, or ≥18.66px at weight 700+.
 * Everything else is body text.
 */
export function requiredRatio(
  fontSizePx: number,
  fontWeight: number,
  level: "AA" | "AAA" = "AA",
): number {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  if (level === "AAA") return large ? 4.5 : 7;
  return large ? 3 : 4.5;
}

/**
 * Flattens a background stack — innermost first — onto an assumed opaque base.
 * Returns null when the stack never reaches an opaque colour, which means the
 * real backdrop is something this cannot see.
 */
export function flattenBackground(stack: string[]): Rgba | null {
  const layers: Rgba[] = [];
  for (const raw of stack) {
    const c = parseColor(raw);
    if (!c || c.a === 0) continue;
    layers.push(c);
    if (c.a >= 1) break;
  }
  const base = layers[layers.length - 1];
  if (!base || base.a < 1) return null;
  let out = base;
  for (let i = layers.length - 2; i >= 0; i--) out = composite(layers[i], out);
  return out;
}

export function analyseSamples(
  samples: (TextSample & { route: string })[],
  options: ContrastOptions = {},
): ContrastResult {
  const level = options.level ?? "AA";
  const minOccurrences = options.minOccurrences ?? 1;
  const seen = new Map<string, ContrastFinding>();
  const allPairs = new Set<string>();
  let undetermined = 0;
  let examined = 0;

  for (const sample of samples) {
    const fg = parseColor(sample.color);
    const bg = sample.paintedBackdrop ? null : flattenBackground(sample.backgrounds);
    if (!fg || fg.a === 0 || !bg) {
      undetermined++;
      continue;
    }
    examined++;
    const flat = fg.a < 1 ? composite(fg, bg) : fg;
    const required = requiredRatio(sample.fontSizePx, sample.fontWeight, level);
    const key = `${formatColor(flat)}|${formatColor(bg)}|${required}`;
    allPairs.add(key);

    const ratio = contrastRatio(flat, bg);
    if (ratio >= required) continue;

    const existing = seen.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    seen.set(key, {
      foreground: formatColor(flat),
      background: formatColor(bg),
      ratio,
      required,
      count: 1,
      example: {
        selector: sample.selector,
        text: sample.text,
        route: sample.route,
      },
    });
  }

  return {
    failures: [...seen.values()]
      .filter((f) => f.count >= minOccurrences)
      .sort((a, b) => a.ratio - b.ratio),
    examined,
    pairsChecked: allPairs.size,
    undetermined,
  };
}
