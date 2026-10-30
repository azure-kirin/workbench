/**
 * The stage — Mariia's reference recipe, rebuilt: a black frame with a faint
 * hairline, a monochrome photo as a full-bleed background at reduced opacity,
 * and three large blurred radial blobs near the top edge painted with the
 * set's aura trio (normal blending). Real Sable components sit on top.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../src/utils.ts";
import mediumUrl from "./wallpapers/wall-01.jpg?url";
import darkUrl from "./wallpapers/wall-05.jpg?url";
import lightUrl from "./wallpapers/wall-08.jpg?url";

export const PHOTOS = {
  dark: { label: "Treadmill", url: darkUrl },
  medium: { label: "Forest road", url: mediumUrl },
  light: { label: "Lone tree", url: lightUrl },
} as const;
export type PhotoId = keyof typeof PHOTOS;
export const PHOTO_IDS = Object.keys(PHOTOS) as PhotoId[];

/** Blob opacities for slots 1 / 2 / 3. */
export const STRENGTHS = {
  bold: [0.6, 0.45, 0.35],
  medium: [0.4, 0.3, 0.25],
  subtle: [0.25, 0.15, 0.1],
} as const;
export type Strength = keyof typeof STRENGTHS;

/** Desktop geometry of the three blobs, as in the reference. */
const BLOBS: CSSProperties[] = [
  { top: "-10rem", left: "30%", height: "26.25rem", width: "55%", translate: "-50% 0" },
  { top: "-8rem", right: "6%", height: "24rem", width: "45%" },
  { top: "-6rem", left: "42%", height: "20rem", width: "32%" },
];

export function StageWash({ strength }: { strength: Strength }) {
  return (
    <div
      aria-hidden="true"
      data-slot="stage-wash"
      className="pointer-events-none absolute inset-x-0 top-0 h-[28.75rem] overflow-hidden"
    >
      {BLOBS.map((geometry, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: three fixed slots
          key={index}
          className="absolute rounded-full blur-3xl"
          style={{
            ...geometry,
            opacity: STRENGTHS[strength][index],
            backgroundImage: `radial-gradient(ellipse at center, var(--aura-${index + 1}), transparent 65%)`,
          }}
        />
      ))}
    </div>
  );
}

export interface StageProps {
  photo: PhotoId;
  /** Photo opacity, 0–1. The reference default is 0.55; its labs used 1. */
  photoOpacity: number;
  strength: Strength;
  /** A wash to paint instead of the round-3 blobs. */
  wash?: ReactNode;
  children?: ReactNode;
  className?: string;
  "data-stage"?: string;
}

export function Stage({
  photo,
  photoOpacity,
  strength,
  wash,
  children,
  className,
  ...rest
}: StageProps) {
  return (
    <div
      data-slot="stage"
      data-photo={photo}
      {...rest}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl text-text-primary",
        className,
      )}
      style={{ background: "#000", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <img
        src={PHOTOS[photo].url}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full select-none object-cover"
        style={{ opacity: photoOpacity }}
      />
      {wash ?? <StageWash strength={strength} />}
      <div className="relative h-full">{children}</div>
    </div>
  );
}
