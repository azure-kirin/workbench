/**
 * viewport-reveal — framework-agnostic entry.
 *
 * Nothing here imports React. The React wrapper lives at
 * `viewport-reveal/react` and is optional; everything the engine does is
 * driven by two attributes and one gate class, so any templating system
 * that can emit HTML can use it.
 */

export { type RevealEngineOptions } from "./engine.js";
export { revealEngine as initReveal } from "./engine.js";
export { revealScriptSource } from "./script.js";

/**
 * The names the engine and `styles.css` agree on.
 *
 * They are constants, not options: the shipped stylesheet keys on these
 * literals, so making them configurable would only let a consumer break the
 * pairing. They are exported so that consumers writing their own CSS — or
 * asserting on rendered markup in their own tests — reference the contract
 * instead of retyping it.
 */

/** Set on `<html>` by the engine. Every hidden state in `styles.css` is gated behind it. */
export const REVEAL_ROOT_CLASS = "vr-js";

/** Marks an element that should reveal when it reaches the fold line. */
export const REVEAL_ATTR = "data-reveal";

/** Marks an element that should play its entrance on insertion (no viewport involved). */
export const REVEAL_MOUNT_ATTR = "data-reveal-mount";

/** Added by the engine when an element has crossed the fold line. */
export const REVEALED_CLASS = "vr-revealed";

/** Custom property the per-element delay is written to. */
export const REVEAL_DELAY_PROPERTY = "--vr-delay";

/**
 * Builds a delay expressed in steps of `--vr-stagger` instead of in
 * milliseconds:
 *
 * ```tsx
 * <Reveal delay={stagger(0)}>…</Reveal>
 * <Reveal delay={stagger(1)}>…</Reveal>
 * <Reveal delay={stagger(2)}>…</Reveal>
 * ```
 *
 * Milliseconds are the default because they are obvious. This exists for
 * the case where they are not enough: a cascade whose whole rhythm should
 * be re-tunable from one place. Override `--vr-stagger` on `:root` (or on
 * any subtree, to give one section its own beat) and every stepped delay
 * moves with it.
 */
export function stagger(step: number): string {
  return `calc(${step} * var(--vr-stagger, 60ms))`;
}
