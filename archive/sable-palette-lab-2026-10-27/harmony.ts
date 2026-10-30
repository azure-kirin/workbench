/**
 * The harmony rule for an aura trio: all three hues inside one arc, and the
 * OKLab midpoint of any two keeps its chroma (no grey or olive where blobs
 * overlap). Shared by check.ts and the stories.
 */
import type { Oklch } from "./color.ts";
import { hueSpan, type PaletteSet } from "./sets.ts";

const toLab = ({ l, c, h }: Oklch) => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];

export function midMix(a: Oklch, b: Oklch): Oklch {
  const [la, aa, ba] = toLab(a) as [number, number, number];
  const [lb, ab, bb] = toLab(b) as [number, number, number];
  const A = (aa + ab) / 2;
  const B = (ba + bb) / 2;
  return {
    l: (la + lb) / 2,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  };
}

export function trioHarmony(set: PaletteSet) {
  const pairs: { label: string; retention: number; mix: Oklch }[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      const a = set.aura[i] as PaletteSet["aura"][number];
      const b = set.aura[j] as PaletteSet["aura"][number];
      const mix = midMix(a.colour, b.colour);
      pairs.push({
        label: `${a.name}+${b.name}`,
        retention: Math.round((mix.c / ((a.colour.c + b.colour.c) / 2)) * 100),
        mix,
      });
    }
  return {
    span: hueSpan(set.aura.map((a) => a.colour.h)),
    pairs,
    worstRetention: Math.min(...pairs.map((p) => p.retention)),
  };
}
