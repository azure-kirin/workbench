/**
 * The Shaped renderer: each stroke as a glow — a core band 0.6 of its width,
 * Gaussian-blurred by 0.2 × its width, so alpha peaks on the spine and falls
 * off continuously (no plateau) — painted in order. Static, no script after render, works everywhere — and the fallback
 * whenever the Fluid renderer cannot get WebGL.
 */
import { useId } from "react";
import {
  BOARD,
  glowOf,
  strokePath,
  strokesFor,
  type WashBlend,
  type WashVariant,
} from "./compositions.ts";

export interface ShapedWashProps {
  trio: readonly [string, string, string];
  variant: WashVariant;
  seed: number;
  /** Resolved spine peaks per slot (backdrop profile × intensity). */
  peaks: readonly [number, number, number];
  blend: WashBlend;
}

export function ShapedWash({ trio, variant, seed, peaks, blend }: ShapedWashProps) {
  const id = useId().replace(/:/g, "");
  const strokes = strokesFor(variant, seed).map((stroke) => ({
    stroke,
    glow: glowOf(stroke, peaks),
  }));
  return (
    <svg
      data-slot="wash-shaped"
      viewBox={`0 0 ${BOARD.w} ${BOARD.h}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      style={{ mixBlendMode: blend }}
      role="presentation"
    >
      <defs>
        {strokes.map(({ glow }, index) => (
          <filter
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed composition order
            key={index}
            id={`${id}-${index}`}
            filterUnits="userSpaceOnUse"
            x={-BOARD.w}
            y={-BOARD.h}
            width={BOARD.w * 3}
            height={BOARD.h * 3}
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={glow.sigma} />
          </filter>
        ))}
      </defs>
      {strokes.map(({ stroke, glow }, index) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed composition order
          key={index}
          d={strokePath(stroke.pts)}
          fill="none"
          stroke={trio[stroke.slot]}
          strokeWidth={glow.core}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={+glow.opacity.toFixed(3)}
          filter={`url(#${id}-${index})`}
        />
      ))}
    </svg>
  );
}
