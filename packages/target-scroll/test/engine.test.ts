import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  animateScrollTo,
  cancelScroll,
  distanceDuration,
} from "../src/index.js";
import {
  controlClock,
  controlRaf,
  controlScroll,
  resetDocument,
  setReducedMotion,
  setViewportHeight,
  type RafHarness,
  type ScrollHarness,
} from "./helpers.js";

/**
 * The clock starts at 1000 so that a frame timestamp BELOW the start time is
 * expressible — see the last test in this file.
 */
const T0 = 1000;

let raf: RafHarness;
let scroll: ScrollHarness;
let clock: { set(time: number): void };
const cleanups: Array<() => void> = [];

beforeEach(() => {
  resetDocument();
  setViewportHeight(800);
  raf = controlRaf();
  scroll = controlScroll();
  clock = controlClock(T0);
  /* Only the timer functions. Faking the performance clock too would fight
     the explicit one above, and the watchdog is the only thing here that
     cares about wall time. */
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cancelScroll();
  vi.useRealTimers();
  while (cleanups.length) cleanups.pop()?.();
  raf.restore();
  scroll.restore();
  resetDocument();
});

describe("a requestAnimationFrame that never ticks", () => {
  it("lands the reader on the target anyway, after the watchdog", () => {
    animateScrollTo(3000);

    /* An embedded webview, or a machine in battery-saver mode: the frame is
       queued and the platform simply never runs it. Without a watchdog the
       click is not "unanimated" — it is dead. */
    expect(raf.pending()).toBe(1);
    expect(scroll.calls).toHaveLength(0);

    vi.advanceTimersByTime(120);

    expect(scroll.y()).toBe(3000);
    /* Exactly one scroll, straight to the target: this was a jump, not an
       animation that happened to finish. */
    expect(scroll.calls).toEqual([{ top: 3000, behavior: "instant" }]);
  });

  it("does not fire once the first frame has run", () => {
    animateScrollTo(3000);
    raf.flush(T0);
    const framesBefore = scroll.calls.length;

    vi.advanceTimersByTime(500);

    expect(scroll.calls).toHaveLength(framesBefore);
    expect(scroll.y()).not.toBe(3000);
  });

  it("does not teleport a reader who has already taken over", () => {
    /* The order that produced the original bug: the reader flicks the wheel
       before the first frame runs, so the animation is cancelled with
       `started` still false — and 120ms later the watchdog, which nothing
       had cleared, threw them at the target regardless. */
    animateScrollTo(3000);
    window.dispatchEvent(new Event("wheel"));

    vi.advanceTimersByTime(500);

    expect(scroll.y()).toBe(0);
    expect(scroll.calls).toHaveLength(0);
  });

  it("can be turned off", () => {
    animateScrollTo(3000, { watchdog: 0 });
    vi.advanceTimersByTime(1000);
    expect(scroll.calls).toHaveLength(0);
  });
});

describe("the reader's own scrolling", () => {
  const midFlight = () => {
    animateScrollTo(4000);
    raf.flush(T0);
    raf.flush(T0 + 100);
    expect(scroll.y()).toBeGreaterThan(0);
    expect(scroll.y()).toBeLessThan(4000);
    return scroll.calls.length;
  };

  it("cancels an animation in flight on wheel", () => {
    const frames = midFlight();
    const stoppedAt = scroll.y();

    window.dispatchEvent(new Event("wheel"));
    raf.flush(T0 + 200);
    vi.advanceTimersByTime(1000);

    expect(scroll.calls).toHaveLength(frames);
    expect(scroll.y()).toBe(stoppedAt);
  });

  it("cancels on touchstart", () => {
    const frames = midFlight();
    window.dispatchEvent(new Event("touchstart"));
    raf.flush(T0 + 200);
    expect(scroll.calls).toHaveLength(frames);
  });

  it("cancels on a scrolling key", () => {
    const frames = midFlight();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    raf.flush(T0 + 200);
    expect(scroll.calls).toHaveLength(frames);
  });

  it("ignores a key that does not scroll", () => {
    const frames = midFlight();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    raf.flush(T0 + 200);
    expect(scroll.calls.length).toBeGreaterThan(frames);
  });

  it("ignores an arrow key pressed inside a text field", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const frames = midFlight();

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    raf.flush(T0 + 200);

    expect(scroll.calls.length).toBeGreaterThan(frames);
  });

  it("leaves no listeners behind when the animation finishes", () => {
    /* `{ once: true }` would look tidier and would be wrong: a once-listener
       that never fires stays attached, and they accumulate one per click. */
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");

    animateScrollTo(1000);
    raf.flush(T0);
    raf.flush(T0 + 10_000); // past the end: the animation completes

    const types = (spy: typeof added) =>
      spy.mock.calls.map(([type]) => type).sort();
    expect(types(added)).toEqual(["keydown", "touchstart", "wheel"]);
    expect(types(removed)).toEqual(["keydown", "touchstart", "wheel"]);
  });
});

describe("reduced motion", () => {
  it("arrives instantly instead of animating faster", () => {
    cleanups.push(setReducedMotion(true));

    expect(animateScrollTo(3000)).toBe(true);

    expect(scroll.calls).toEqual([{ top: 3000, behavior: "instant" }]);
    expect(raf.pending()).toBe(0);
  });

  it("animates when the preference is not set", () => {
    cleanups.push(setReducedMotion(false));
    animateScrollTo(3000);
    expect(raf.pending()).toBe(1);
  });

  it("survives an environment with no matchMedia at all", () => {
    const original = window.matchMedia;
    // @ts-expect-error — deleting a DOM API is the case being tested
    delete window.matchMedia;
    cleanups.push(() => {
      window.matchMedia = original;
    });

    expect(() => animateScrollTo(3000)).not.toThrow();
    expect(raf.pending()).toBe(1);
  });
});

describe("duration", () => {
  it("scales with distance, and is capped", () => {
    expect(distanceDuration(0)).toBe(320);
    expect(distanceDuration(1000)).toBe(380);
    expect(distanceDuration(4000)).toBe(560);
    expect(distanceDuration(100_000)).toBe(640);
    expect(distanceDuration(-1000)).toBe(380);
  });

  it("means a far target is still travelling when a near one has arrived", () => {
    animateScrollTo(500); // 320 + 30 = 350ms
    raf.flush(T0);
    raf.flush(T0 + 350);
    expect(scroll.y()).toBe(500);
    expect(raf.pending()).toBe(0);

    scroll.setY(0);
    animateScrollTo(8000); // capped at 640ms
    raf.flush(T0);
    raf.flush(T0 + 350);
    expect(scroll.y()).toBeLessThan(8000);
    expect(raf.pending()).toBe(1);
  });

  it("accepts a fixed duration and a function of distance", () => {
    animateScrollTo(1000, { duration: 200 });
    raf.flush(T0);
    raf.flush(T0 + 200);
    expect(scroll.y()).toBe(1000);

    scroll.setY(0);
    const seen: number[] = [];
    animateScrollTo(900, {
      duration: (distance) => {
        seen.push(distance);
        return 100;
      },
    });
    raf.flush(T0);
    raf.flush(T0 + 100);
    expect(seen).toEqual([900]);
    expect(scroll.y()).toBe(900);
  });

  it("jumps when the duration is zero", () => {
    animateScrollTo(1000, { duration: 0 });
    expect(scroll.calls).toEqual([{ top: 1000, behavior: "instant" }]);
    expect(raf.pending()).toBe(0);
  });
});

describe("every step opts out of CSS scroll-behavior", () => {
  it("asks for an instant scroll on every frame", () => {
    /* `html { scroll-behavior: smooth }` is a line pages add to improve
       anchor links. Without `behavior: "instant"` it turns each of these
       frames into its own competing smooth animation. */
    animateScrollTo(2000);
    raf.flush(T0);
    raf.flush(T0 + 200);
    raf.flush(T0 + 700);

    expect(scroll.calls.length).toBeGreaterThan(2);
    for (const call of scroll.calls) expect(call.behavior).toBe("instant");
  });
});

describe("a browser without behavior: \"instant\"", () => {
  it("falls back to the two-argument form instead of throwing", () => {
    /* `behavior` is a dictionary enum: a browser that predates the "instant"
       value (Safari < 15.4) throws a TypeError rather than ignoring it, and
       the whole scroll would be lost to it. */
    const positions: number[] = [];
    window.scrollTo = ((first: unknown, second?: number) => {
      if (typeof first === "object") throw new TypeError("instant is not a valid enum value");
      positions.push(second ?? 0);
    }) as typeof window.scrollTo;

    animateScrollTo(1000, { duration: 0 });

    expect(positions).toEqual([1000]);
  });
});

describe("the animation in flight", () => {
  it("is replaced, not raced, when a second one starts", () => {
    animateScrollTo(4000);
    raf.flush(T0);
    animateScrollTo(1000);
    expect(raf.pending()).toBe(1);

    raf.flush(T0);
    raf.flush(T0 + 5000);
    expect(scroll.y()).toBe(1000);
  });

  it("stops on cancelScroll()", () => {
    animateScrollTo(4000);
    raf.flush(T0);
    const stoppedAt = scroll.y();

    cancelScroll();
    raf.flush(T0 + 500);

    expect(scroll.y()).toBe(stoppedAt);
    expect(raf.pending()).toBe(0);
  });

  it("does nothing when the page is already there", () => {
    scroll.setY(1000);
    expect(animateScrollTo(1000)).toBe(false);
    expect(scroll.calls).toHaveLength(0);
  });
});

describe("a frame timestamp earlier than the start time", () => {
  it("does not scroll backwards", () => {
    /* rAF is handed the time the FRAME began, which can precede the
       performance.now() taken when the animation was set up — when this is
       called from inside another frame callback, for instance. An unclamped
       progress value goes negative and the first frame moves the page the
       wrong way. */
    animateScrollTo(2000);
    clock.set(T0);
    raf.flush(T0 - 8);

    expect(scroll.y()).toBe(0);
    expect(scroll.calls[0]).toEqual({ top: 0, behavior: "instant" });
  });
});
