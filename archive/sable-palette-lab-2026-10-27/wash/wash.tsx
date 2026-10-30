/**
 * Wash — the palette lab's prototype of the next Ambient Wash. One API, two
 * renderers:
 *
 *   shaped  blurred SVG shapes; static; works everywhere
 *   fluid   a WebGL field that drifts slowly; falls back to `shaped` when
 *           WebGL is missing or lost, and holds one still frame under
 *           prefers-reduced-motion
 *
 * Decorative only: aria-hidden, never hit-tested, out of flow. Put it as the
 * first child of a `relative isolate` region.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../src/utils.ts";
import {
  type BackdropReading,
  type BackdropSetting,
  PROFILES,
  useBackdrop,
} from "./backdrop.ts";
import {
  DEFAULT_VARIANT,
  INTENSITY_SCALE,
  type WashBlend,
  type WashIntensity,
  type WashVariant,
} from "./compositions.ts";
import { FluidWash } from "./fluid.tsx";
import { ShapedWash } from "./shaped.tsx";

export type WashRenderer = "shaped" | "fluid";

export interface WashProps {
  /** The set's three aura colours, slot 1 → 3: any CSS colour (hex, oklch(), var()). */
  trio: readonly [string, string, string];
  variant?: WashVariant;
  intensity?: WashIntensity;
  /** Fluid only: drift. Off, or reduced motion, renders one still frame. */
  motion?: boolean;
  /** Shifts the composition deterministically; odd seeds mirror it. */
  seed?: number;
  renderer?: WashRenderer;
  /**
   * What is behind the wash. Each backdrop has its own profile — spine peaks
   * per slot and a blend (backdrop.ts); intensity multiplies on top. `auto`
   * measures `backdropImage` once it loads (fallback `medium`). Default `auto`.
   */
  backdrop?: BackdropSetting;
  /** The photo under the wash, for `auto`. */
  backdropImage?: string;
  /** That photo's opacity over the (black) stage, for `auto`. */
  backdropOpacity?: number;
  /** Overrides the profile's blend (lab only). */
  blend?: WashBlend;
  /** Reports the resolved backdrop (for a readout). */
  onBackdrop?: (reading: BackdropReading) => void;
  className?: string;
}

export function Wash({
  trio,
  variant = DEFAULT_VARIANT,
  intensity = "bold",
  motion = true,
  seed = 0,
  renderer = "fluid",
  backdrop: setting = "auto",
  backdropImage,
  backdropOpacity = 1,
  blend: blendOverride,
  onBackdrop,
  className,
}: WashProps) {
  const [failed, setFailed] = useState(false);
  const reading = useBackdrop(setting, backdropImage, backdropOpacity);
  const profile = PROFILES[reading.backdrop];
  const k = INTENSITY_SCALE[intensity];
  const peaks = profile.peaks.map((p) => p * k) as [number, number, number];
  const blend = blendOverride ?? profile.blend;
  const report = useRef(onBackdrop);
  report.current = onBackdrop;
  const { backdrop, luma, source } = reading;
  useEffect(() => {
    report.current?.({ backdrop, luma, source });
  }, [backdrop, luma, source]);
  const active: WashRenderer = renderer === "fluid" && !failed ? "fluid" : "shaped";
  return (
    <div
      aria-hidden="true"
      data-slot="wash"
      data-renderer={active}
      data-requested={renderer}
      data-variant={variant}
      data-intensity={intensity}
      data-blend={blend}
      data-backdrop={reading.backdrop}
      data-backdrop-source={reading.source}
      className={cn(
        // No stacking context here (no contain / z-index / opacity): the
        // renderer's mix-blend-mode must reach the photo underneath.
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className,
      )}
    >
      {active === "fluid" ? (
        <FluidWash
          trio={trio}
          variant={variant}
          seed={seed}
          peaks={peaks}
          motion={motion}
          blend={blend}
          onFail={() => setFailed(true)}
        />
      ) : (
        <ShapedWash
          trio={trio}
          variant={variant}
          seed={seed}
          peaks={peaks}
          blend={blend}
        />
      )}
    </div>
  );
}
