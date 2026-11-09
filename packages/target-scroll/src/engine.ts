/**
 * The motion layer: everything between "we know the y coordinate" and "the
 * page is there".
 *
 * Two things shape it:
 *
 * 1. `html { scroll-behavior: smooth }` applies to every programmatic scroll
 *    that does not say otherwise, so a loop of plain per-frame scrolls would
 *    start a browser-side smooth scroll on every frame and trail behind
 *    itself. Every scroll here asks for `behavior: "instant"`. (The README's
 *    note on `overflow-x: clip` says why that is no longer listed here.)
 *
 * 2. `requestAnimationFrame` does not necessarily tick. It is suspended in
 *    embedded webviews (in-app browsers), under battery-saver modes, and in
 *    background tabs. A hand-rolled animation that assumes rAF will run has
 *    a failure mode where the click simply does nothing — see the watchdog.
 *
 * The scroll is animated by hand, and every frame is a plain instant
 * scroll. What the module owns beyond that is the cancellation contract:
 * exactly one animation may be in flight, and the user's own scroll always
 * ends it.
 */

/** Options that describe how the page travels, not where it is going. */
export interface MotionOptions {
  /**
   * Milliseconds, or a function of the absolute distance in px.
   * Default {@link distanceDuration} — a fixed base plus a distance term,
   * capped, so a short hop is not sluggish and a page-length jump is not
   * a journey. `0` means jump instantly.
   */
  duration?: number | ((distance: number) => number);
  /**
   * Progress curve, `(t: 0..1) => 0..1`. Default {@link easeOutQuart}:
   * scrolling is a movement the reader is following with their eyes, so it
   * should leave fast and arrive slowly. Anything with overshoot (a spring,
   * a back-ease) makes the destination appear to move, which is the one
   * thing a scroll must not do.
   */
  easing?: (t: number) => number;
  /**
   * Milliseconds to wait for the first animation frame before giving up and
   * jumping. Default 120. `0` disables the watchdog. See {@link animateScrollTo}.
   */
  watchdog?: number;
  /**
   * Whether a wheel, touch or scroll-key event from the user cancels the
   * animation. Default `true`, and there is rarely a reason to change it —
   * an animation that fights the user is worse than no animation.
   */
  cancelOnUserInput?: boolean;
}

/** The default curve: leaves fast, arrives slowly, never overshoots. */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * The default duration: 320ms plus 0.06ms per pixel, capped at 640ms.
 *
 * A fixed duration is wrong at both ends of the range — it makes a 200px hop
 * feel slow and a 12000px jump feel like a flight. Scaling by distance and
 * capping keeps the whole range inside the window where the movement still
 * reads as "the page moved" rather than "something is loading".
 */
export function distanceDuration(distance: number): number {
  return Math.min(640, 320 + Math.abs(distance) * 0.06);
}

/** True when the visitor has asked for less motion, and safe where matchMedia does not exist. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * One instant scroll of the window.
 *
 * `behavior: "instant"` is not decoration. If the consuming page sets
 * `html { scroll-behavior: smooth }` — which is common, and which people add
 * precisely to improve anchor links — then a bare `window.scrollTo(x, y)`
 * starts the browser's OWN smooth animation. Every frame of this animation
 * would spawn a competing one, and the result is a page that crawls toward
 * the target and arrives late or not at all. Asking for `instant` opts out
 * of the CSS property for this call.
 */
function scrollWindowTo(y: number): void {
  try {
    window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  } catch {
    /* `behavior: "instant"` is a dictionary enum: a browser that predates it
       (Safari < 15.4) throws rather than ignoring it. The two-argument form
       still works there — it just cannot opt out of `scroll-behavior`. */
    window.scrollTo(window.scrollX, y);
  }
}

/** Keys that scroll. A user pressing one of these has overtaken the animation. */
const SCROLL_KEYS = [
  " ",
  "Spacebar",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
];

/** Typing in a field is not a scroll intent, even when the key is an arrow. */
function isTextEntry(node: EventTarget | null): boolean {
  const el = node as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.hasAttribute?.("contenteditable") === true
  );
}

type Run = { cancel: () => void };

/**
 * The animation in flight, if any.
 *
 * Module scope rather than per-scroller, because the thing being animated is
 * module scope too: there is one window, and two animations moving it at once
 * would produce a fight nobody wins. Starting a scroll always ends the
 * previous one.
 */
let active: Run | null = null;

/** Ends any animation in flight. The page stays wherever it got to. */
export function cancelScroll(): void {
  active?.cancel();
}

/**
 * Scrolls the window to `targetY`, animated.
 *
 * Returns `true` if anything moved — `false` means the page was already
 * within a pixel of the target, which is not a failure and is why callers
 * that also update the URL or move focus should not key that work off this
 * return value.
 *
 * Three behaviours here are the reason this file exists rather than a call
 * to `window.scrollTo({ behavior: "smooth" })`:
 *
 * **Reduced motion jumps.** `prefers-reduced-motion: reduce` is answered by
 * arriving instantly, not by animating faster. A shortened animation is
 * still an animation.
 *
 * **The user wins.** A wheel, a touch, or a scroll key cancels immediately.
 * The animation is a convenience; the user's hand on the wheel is an
 * instruction.
 *
 * **The watchdog.** If the first frame has not run within `watchdog` ms, the
 * animation is abandoned and the page jumps to the target. rAF is suspended
 * in embedded webviews and under energy-saver modes, and there is no way to
 * ask in advance whether it will tick. Without this, the failure mode is not
 * "the scroll is not animated" — it is "the click did nothing", on exactly
 * the platforms hardest to reproduce. In a healthy browser the first frame
 * lands in ~16ms and the watchdog never fires.
 */
export function animateScrollTo(
  targetY: number,
  options: MotionOptions = {},
): boolean {
  cancelScroll();

  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 1) return false;

  if (prefersReducedMotion()) {
    scrollWindowTo(targetY);
    return true;
  }

  const duration =
    typeof options.duration === "function"
      ? options.duration(Math.abs(distance))
      : typeof options.duration === "number"
        ? options.duration
        : distanceDuration(distance);

  if (!(duration > 0)) {
    scrollWindowTo(targetY);
    return true;
  }

  const ease = options.easing ?? easeOutQuart;
  const watchdogMs = options.watchdog ?? 120;
  const listen = options.cancelOnUserInput !== false;

  const startedAt = now();
  let frame = 0;
  let firstFrameRan = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const onUserScroll = () => cancel();
  const onKeyDown = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.indexOf(event.key) !== -1 && !isTextEntry(event.target)) {
      cancel();
    }
  };

  function stop(): void {
    if (watchdog !== undefined) clearTimeout(watchdog);
    if (listen) {
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchstart", onUserScroll);
      window.removeEventListener("keydown", onKeyDown);
    }
    if (active === run) active = null;
  }

  function cancel(): void {
    cancelAnimationFrame(frame);
    stop();
  }

  const run: Run = { cancel };
  active = run;

  if (listen) {
    /* Explicitly removed in stop() rather than declared `{ once: true }`.
       A once-listener that never fires is a listener that stays attached
       until the reader's next wheel event, and they accumulate one per
       activation. */
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchstart", onUserScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
  }

  const step = (frameTime: number) => {
    firstFrameRan = true;
    /* Clamped at both ends. The rAF timestamp is the time the frame STARTED,
       which can precede the `performance.now()` taken a moment ago when this
       was called from inside another frame callback — an unclamped `t` then
       goes negative and the first frame scrolls the page the wrong way. */
    const t = Math.min(1, Math.max(0, (frameTime - startedAt) / duration));
    scrollWindowTo(startY + distance * ease(t));
    if (t < 1) {
      frame = requestAnimationFrame(step);
    } else {
      stop();
    }
  };

  frame = requestAnimationFrame(step);

  if (watchdogMs > 0) {
    watchdog = setTimeout(() => {
      if (firstFrameRan) return;
      /* cancel() first: it detaches the input listeners and clears this
         timer's own bookkeeping before the jump. */
      cancel();
      scrollWindowTo(targetY);
    }, watchdogMs);
  }

  return true;
}

/**
 * The rAF clock. `performance.now()` shares an origin with the timestamp rAF
 * passes its callback; `Date.now()` does not, which is why the fallback is
 * only for environments without `performance` at all (and why `t` is clamped
 * in `step`).
 */
function now(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}
