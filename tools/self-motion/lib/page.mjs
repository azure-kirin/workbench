/**
 * The two functions that run inside the story's page. Playwright serialises
 * them, so each must be self-contained: no imports, no outer variables.
 */

/**
 * An init script: runs before any page script, and records layout shifts and
 * focus from navigation on, so a font swap during first paint still counts.
 *
 * @param {{ nameAttribute: string | null }} options
 */
export function recorder({ nameAttribute }) {
  /** A short, readable name for a node: its tag, its name or the named box it sits in, its label. */
  const describe = (node) => {
    if (!node) return "null";
    if (node.nodeType !== 1) return node.nodeName;
    if (node === document.body || node === document.documentElement) return node.tagName.toLowerCase();
    const tag = node.tagName.toLowerCase();
    let where = "";
    if (nameAttribute) {
      const own = node.getAttribute(nameAttribute);
      const inside = node.closest(`[${nameAttribute}]`)?.getAttribute(nameAttribute);
      where = own ? `[${own}]` : inside ? ` in [${inside}]` : "";
    } else {
      const id = node.id ? `#${node.id}` : "";
      const role = node.getAttribute("role");
      where = `${id}${role ? `[role=${role}]` : ""}`;
    }
    const label = (node.getAttribute("aria-label") ?? node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `${tag}${where}${label ? ` "${label}"` : ""}`;
  };
  window.__selfMotion = { shifts: [], focus: [], describe };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const rect = (r) => r && { x: r.x, y: r.y, w: r.width, h: r.height };
        window.__selfMotion.shifts.push({
          time: entry.startTime,
          value: entry.value,
          sources: (entry.sources ?? []).map((source) => ({
            node: describe(source.node),
            from: rect(source.previousRect),
            to: rect(source.currentRect),
          })),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // Not Chromium: no layout-shift entries. The boxes and pixels still run.
  }
  document.addEventListener(
    "focusin",
    (event) => window.__selfMotion.focus.push({ time: performance.now(), node: describe(event.target) }),
    true,
  );
}

/**
 * One look at the page: scroll positions, the focused element, the watched
 * boxes and how many there are, the zones excused from comparison, and the
 * finite animations still running.
 *
 * @param {{ boxSelector: string, nameAttribute: string | null, masks: string[], tolerance: number }} options
 */
export function sample({ boxSelector, nameAttribute, masks, tolerance }) {
  const { describe } = window.__selfMotion;

  const scrolled = [];
  if (window.scrollX || window.scrollY) scrolled.push({ node: "window", x: window.scrollX, y: window.scrollY });
  for (const element of document.querySelectorAll("body *")) {
    if (element.scrollTop || element.scrollLeft)
      scrolled.push({ node: describe(element), x: element.scrollLeft, y: element.scrollTop });
  }

  const masked = [];
  for (const selector of masks) for (const element of document.querySelectorAll(selector)) masked.push(element);

  const loops = [];
  const finite = [];
  for (const animation of document.getAnimations()) {
    const target = animation.effect?.target;
    if (!target || animation.playState !== "running") continue;
    if (animation.effect.getComputedTiming().iterations === Number.POSITIVE_INFINITY) loops.push(target);
    else finite.push(`${describe(target)} ${animation.animationName ?? animation.transitionProperty ?? "animation"}`);
  }
  const excused = (element) =>
    loops.some((target) => target.contains(element)) || masked.some((zone) => zone.contains(element));

  const nameOf = (element) => {
    const own = nameAttribute && element.getAttribute(nameAttribute);
    if (own) return own;
    const role = element.getAttribute("role");
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${role ? `[role=${role}]` : ""}`;
  };
  const boxes = {};
  const counts = {};
  for (const element of document.querySelectorAll(boxSelector)) {
    const name = nameOf(element);
    const n = counts[name] ?? 0;
    counts[name] = n + 1;
    if (excused(element)) continue;
    const rect = element.getBoundingClientRect();
    boxes[`${name}#${n}`] = [rect.x, rect.y, rect.width, rect.height].map(
      (value) => Math.round(value / tolerance) * tolerance,
    );
  }

  // A loop may scale or turn its target (a ping doubles, a spinner turns), so
  // its zone is its box grown by half its size on every side; a mask is its box.
  const zone = (element, grow) => {
    const box = element.getBoundingClientRect();
    const dx = (box.width / 2) * grow;
    const dy = (box.height / 2) * grow;
    return [box.left - dx, box.top - dy, box.right + dx, box.bottom + dy];
  };

  return {
    scrolled,
    active: describe(document.activeElement),
    boxes,
    counts,
    excused: [...masked.map((element) => zone(element, 0)), ...loops.map((element) => zone(element, 1))],
    finite,
    error: document.body.classList.contains("sb-show-errordisplay"),
  };
}
