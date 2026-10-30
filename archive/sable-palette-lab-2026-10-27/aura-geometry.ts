/**
 * Wash layouts for the aura. The production compositions (`top`, `center`,
 * `bottom` from wash-geometry.ts) let three blobs pile into one another — fine
 * for one hue, but a three-colour aura then reads as a single muddy tone. The
 * `trio` layout gives each colour its own pool with only soft overlaps, so all
 * three read on a photo. Same fall-off curve, same CSS recipe, same contrast
 * sampler as production — only the blob list differs.
 */
import {
  contrastRatio,
  FALLOFF,
  falloffAt,
  type Rgb,
  WASH_BLOBS,
  type WashBlob,
} from "../../src/components/items/ambient-wash/wash-geometry.ts";

export const LAYOUTS = {
  ...WASH_BLOBS,
  trio: [
    { x: 6, y: 18, rx: 52, ry: 70, weight: 1 },
    { x: 94, y: 26, rx: 50, ry: 66, weight: 1 },
    { x: 48, y: 104, rx: 62, ry: 58, weight: 1 },
  ],
} satisfies Record<string, WashBlob[]>;

export type Layout = keyof typeof LAYOUTS;
export const LAYOUT_NAMES = Object.keys(LAYOUTS) as Layout[];

/** washBackground() for any layout: hue n reads `--wash-n`, strength `--wash-strength`. */
export function auraBackground(layout: Layout): string {
  return LAYOUTS[layout]
    .map(({ x, y, rx, ry, weight }, index) => {
      const stops = FALLOFF.map(
        ({ at, alpha }) =>
          `color-mix(in srgb, var(--wash-${index + 1}) calc(var(--wash-strength) * ${+(weight * alpha).toFixed(4)}), transparent) ${at * 100}%`,
      ).join(", ");
      return `radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, ${stops})`;
    })
    .join(", ");
}

/** worstContrast() for any layout — the production sampler, blob list as input. */
export function worstContrastIn({
  blobs,
  hues,
  strength,
  background,
  text,
  step = 2,
}: {
  blobs: WashBlob[];
  hues: [Rgb, Rgb, Rgb];
  strength: number;
  background: Rgb;
  text: Rgb;
  step?: number;
}): number {
  let worst = Number.POSITIVE_INFINITY;
  for (let px = 0; px <= 100; px += step) {
    for (let py = 0; py <= 100; py += step) {
      let colour: Rgb = [...background];
      blobs.forEach((blob, index) => {
        const distance = Math.hypot((px - blob.x) / blob.rx, (py - blob.y) / blob.ry);
        const alpha = strength * blob.weight * falloffAt(distance);
        const hue = hues[index] as Rgb;
        colour = colour.map(
          (c, i) => (hue[i] as number) * alpha + c * (1 - alpha),
        ) as Rgb;
      });
      worst = Math.min(worst, contrastRatio(text, colour));
    }
  }
  return worst;
}
