/**
 * target-scroll — framework-agnostic entry.
 *
 * Nothing here imports React. The optional React entry lives at
 * `target-scroll/react` and is a thin wrapper: everything this library does
 * is plain DOM work against `window`, and any framework — or none — can call
 * it from a click handler.
 */

export {
  animateScrollTo,
  cancelScroll,
  distanceDuration,
  easeOutQuart,
  prefersReducedMotion,
  type MotionOptions,
} from "./engine.js";

export {
  createScroller,
  resolveTarget,
  scrollToTarget,
  scrollToTop,
  type FocusTarget,
  type Scroller,
  type ScrollOptions,
  type ScrollTarget,
} from "./scroller.js";
