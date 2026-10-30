/**
 * Backdrop profiles — how strong the wash is, and how it meets the photo,
 * depending on what is behind it. One set of alphas cannot serve a near-black
 * photo and a bright sky at once: added light that glows on the dark one
 * vanishes on the light one, and enough alpha to show on the light one turns
 * to paint on the dark one. So each backdrop gets its own profile, and
 * intensity (bold / medium / subtle) multiplies on top.
 *
 * Tokens-in-waiting: --wash-peak-<backdrop>-<slot>, --wash-blend-<backdrop>.
 */
import { useEffect, useState } from "react";
import type { WashBlend } from "./compositions.ts";

export type Backdrop = "dark" | "medium" | "light";
export type BackdropSetting = Backdrop | "auto";
export const BACKDROPS: Backdrop[] = ["dark", "medium", "light"];

export interface BackdropProfile {
  /** Spine peak alpha for slots 1 / 2 / 3 at bold. */
  peaks: [number, number, number];
  blend: WashBlend;
}

export const PROFILES: Record<Backdrop, BackdropProfile> = {
  dark: { peaks: [0.58, 0.44, 0.36], blend: "screen" },
  medium: { peaks: [0.7, 0.54, 0.44], blend: "screen" },
  light: { peaks: [0.8, 0.66, 0.56], blend: "screen" },
};

/**
 * Auto thresholds on the backdrop's mean luma (sRGB, 0–1, as composited —
 * i.e. after the photo's own opacity over the stage's black).
 */
export const AUTO_THRESHOLDS = { darkBelow: 0.095, lightAbove: 0.25 } as const;

export function pickBackdrop(luma: number): Backdrop {
  if (luma < AUTO_THRESHOLDS.darkBelow) return "dark";
  if (luma > AUTO_THRESHOLDS.lightAbove) return "light";
  return "medium";
}

/** Mean luma of an image, downsampled to 32 × 20 and scaled by its opacity over black. */
async function measure(src: string, opacity: number): Promise<number> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 20;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d");
  // Cover-fit, like the stage's object-cover photo at 16:10.
  const scale = Math.max(32 / img.naturalWidth, 20 / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (32 - w) / 2, (20 - h) / 2, w, h);
  const data = ctx.getImageData(0, 0, 32, 20).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4)
    sum +=
      0.2126 * (data[i] as number) +
      0.7152 * (data[i + 1] as number) +
      0.0722 * (data[i + 2] as number);
  return (sum / (data.length / 4) / 255) * opacity;
}

export interface BackdropReading {
  /** The profile in use. */
  backdrop: Backdrop;
  /** Measured mean luma, or null when forced or unreadable. */
  luma: number | null;
  source: "forced" | "auto" | "fallback";
}

/** Resolve a backdrop setting; `auto` measures `image` once it loads (fallback: medium). */
export function useBackdrop(
  setting: BackdropSetting,
  image?: string,
  opacity = 1,
): BackdropReading {
  const [luma, setLuma] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (setting !== "auto" || !image) return;
    let live = true;
    setFailed(false);
    measure(image, opacity).then(
      (value) => live && setLuma(value),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [setting, image, opacity]);
  if (setting !== "auto") return { backdrop: setting, luma: null, source: "forced" };
  if (failed || !image || luma === null)
    return { backdrop: "medium", luma: null, source: "fallback" };
  return { backdrop: pickBackdrop(luma), luma, source: "auto" };
}
