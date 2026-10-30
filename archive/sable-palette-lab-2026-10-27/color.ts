/**
 * OKLCH ⇄ sRGB, the bit of colour math the Palette Lab needs that Sable does
 * not already have. Contrast itself is NOT re-implemented: it comes from
 * `wash-geometry.ts`, the same function the production contrast tests use.
 */
import type { Rgb } from "../../src/components/items/ambient-wash/wash-geometry.ts";

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const encode = (x: number) =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055;

const decode = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

export function inGamut(colour: Oklch): boolean {
  return toLinearRgb(colour).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** Lower chroma (hue and lightness held) until the colour fits sRGB. */
export function fitGamut(colour: Oklch): Oklch {
  if (inGamut(colour)) return colour;
  let lo = 0;
  let hi = colour.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ ...colour, c: mid })) lo = mid;
    else hi = mid;
  }
  return { ...colour, c: lo };
}

/** 8-bit sRGB, the way a browser paints an in-gamut oklch(). */
export function oklchToRgb(colour: Oklch): Rgb {
  return toLinearRgb(colour).map((v) =>
    Math.round(Math.min(1, Math.max(0, encode(v))) * 255),
  ) as Rgb;
}

export function rgbToOklch([r, g, b]: Rgb): Oklch {
  const [lr, lg, lb] = [r, g, b].map((v) => decode(v / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const round = (n: number, digits: number) => Number(n.toFixed(digits));

/** `oklch(0.712 0.118 52.4)` — three decimals for L and C, one for the hue. */
export function formatOklch({ l, c, h }: Oklch, alpha?: number): string {
  const body = `${round(l, 3)} ${round(c, 3)} ${round(c < 0.0005 ? 0 : h, 1)}`;
  return alpha === undefined ? `oklch(${body})` : `oklch(${body} / ${alpha})`;
}

/** Mix two opaque colours in OKLab (CSS `color-mix(in oklab, a p%, b)`). */
export function mixOklab(a: Rgb, b: Rgb, p: number): Rgb {
  const toLab = (rgb: Rgb) => {
    const { l, c, h } = rgbToOklch(rgb);
    return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
  };
  const [la, aa, ba] = toLab(a) as [number, number, number];
  const [lb, ab, bb] = toLab(b) as [number, number, number];
  const L = la * p + lb * (1 - p);
  const A = aa * p + ab * (1 - p);
  const B = ba * p + bb * (1 - p);
  return oklchToRgb({
    l: L,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  });
}

/** Mix two opaque colours in sRGB (CSS `color-mix(in srgb, a p%, b)`). */
export function mixSrgb(a: Rgb, b: Rgb, p: number): Rgb {
  return a.map((v, i) => v * p + (b[i] as number) * (1 - p)) as Rgb;
}
