/**
 * The reveal engine.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS FUNCTION MUST STAY SELF-CONTAINED.
 * ─────────────────────────────────────────────────────────────────────────
 * `revealScriptSource()` ships this function by calling `.toString()` on it
 * and wrapping the result in an IIFE, so the exact text below is what runs
 * inline in the document — before any bundle, before hydration, before the
 * first `[data-reveal]` element paints. That only works while the body
 * references nothing outside its own scope: no imports, no module-level
 * constants, no shared helpers, no class-name variables. Every literal is
 * written out in place, including the class and attribute names it shares
 * with `styles.css`.
 *
 * The rule is enforced by tests: `test/script.test.ts` evaluates the
 * generated string in a bare `new Function(...)` scope, which throws on any
 * identifier the bundler hoisted out, and asserts the string still contains
 * the literal names the stylesheet keys on.
 */

/** Options that change engine *behaviour* only — never the names `styles.css` keys on. */
export interface RevealEngineOptions {
  /**
   * Distance in px above the bottom viewport edge where the fold line sits.
   * An element reveals as soon as its top crosses that line, so a small
   * positive value means "reveal just before it is fully on screen".
   * Default 24.
   */
  offset?: number;
}

/**
 * Starts the engine against the current document and returns a teardown.
 *
 * Everything about the design below exists because of a failure the obvious
 * implementation has:
 *
 * 1. NOTHING IS HIDDEN IN THE MARKUP. The stylesheet applies the hidden
 *    state only under `html.vr-js`, and this function is what adds that
 *    class. So the animation is something JavaScript opts *into*. A crawler,
 *    an offline reader-mode pass, a JS-off visitor, or a page whose
 *    hydration has stalled sees finished, visible content — not an empty
 *    page waiting on a framework that may never arrive.
 *
 * 2. IT DOES NOT WAIT FOR HYDRATION. This is plain DOM code running from the
 *    first painted frame, not a framework effect. On a heavy page hydration
 *    is seconds, and during those seconds a hooks-based implementation shows
 *    an empty hero.
 *
 * 3. IT SWEEPS, IT DOES NOT OBSERVE. An IntersectionObserver *samples*: a
 *    fast flick can carry an element from below the fold to above the top of
 *    the viewport between two samples, and the element is then stranded at
 *    opacity 0 forever. A sweep asks a different question — "is your top
 *    above the fold line" — which an element that has already scrolled past
 *    answers yes. Nothing can be skipped. The pending set only ever shrinks,
 *    so the cost of the sweep trends to zero as the reader scrolls.
 *
 * 4. IT DOES NOT TRUST requestAnimationFrame. rAF is frozen while a tab is
 *    hidden, so a page that loads — or restores its scroll position — in a
 *    background tab can queue a sweep that never runs, and the reader
 *    switches back to a blank page. `visibilitychange` and `pageshow` sweep
 *    DIRECTLY, with no rAF in the path.
 */
export function revealEngine(options?: RevealEngineOptions): () => void {
  var root = document.documentElement;
  var noop = function () {};
  try {
    /* Reduced motion is answered by declining to hide anything at all — the
       gate class is never added, so the hidden state never applies and there
       is NO animation, rather than a fast one. */
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return noop;
    }

    var offset =
      options && typeof options.offset === "number" ? options.offset : 24;

    root.classList.add("vr-js");

    var pending: Element[] = [];
    var ticking = false;
    var started = false;
    var observer: MutationObserver | null = null;

    var sweep = function () {
      ticking = false;
      var line = (window.innerHeight || 0) - offset;
      var next: Element[] = [];
      for (var i = 0; i < pending.length; i++) {
        var el = pending[i];
        if (!el.isConnected || el.classList.contains("vr-revealed")) continue;
        if (el.getBoundingClientRect().top < line) {
          el.classList.add("vr-revealed");
        } else {
          next.push(el);
        }
      }
      pending = next;
    };

    var tick = function () {
      if (!ticking && pending.length) {
        ticking = true;
        requestAnimationFrame(sweep);
      }
    };

    var onVisible = function () {
      if (!document.hidden) sweep();
    };

    var collect = function (node: Node) {
      if (node.nodeType !== 1) return;
      var el = node as Element;
      if (
        el.hasAttribute("data-reveal") &&
        !el.classList.contains("vr-revealed")
      ) {
        pending.push(el);
      }
      var inner = el.querySelectorAll
        ? el.querySelectorAll("[data-reveal]:not(.vr-revealed)")
        : [];
      for (var i = 0; i < inner.length; i++) pending.push(inner[i]);
    };

    var start = function () {
      /* start() is wired to four triggers on purpose — see below — so it has
         to be idempotent. */
      if (started) return;
      started = true;
      pending = Array.prototype.slice.call(
        document.querySelectorAll("[data-reveal]"),
      );
      sweep();
      window.addEventListener("scroll", tick, { passive: true });
      window.addEventListener("resize", tick);
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("pageshow", sweep);

      /* Late arrivals — a client-rendered branch, a client-side route
         transition, a lazily mounted section — are picked up here, which is
         what lets the component wrapper stay markup-only with no JS of its
         own. */
      if (window.MutationObserver) {
        observer = new MutationObserver(function (records) {
          var grew = false;
          for (var i = 0; i < records.length; i++) {
            var added = records[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
              collect(added[j]);
              grew = true;
            }
          }
          if (grew) tick();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    /* Four triggers, because each one alone has a hole: DOMContentLoaded can
       have fired already, `load` waits on images, and both can be missed
       entirely when the document is restored from bfcache — so a timeout
       backstops the lot. start() is idempotent, so redundancy is free. */
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
    window.addEventListener("load", start);
    var backstop = setTimeout(start, 2000);

    return function destroy() {
      clearTimeout(backstop);
      document.removeEventListener("DOMContentLoaded", start);
      window.removeEventListener("load", start);
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", sweep);
      if (observer) observer.disconnect();
      pending = [];
      root.classList.remove("vr-js");
    };
  } catch (e) {
    /* If anything above threw, the page must not be left with a gate class
       that hides content nothing will ever un-hide. */
    root.classList.remove("vr-js");
    return noop;
  }
}
