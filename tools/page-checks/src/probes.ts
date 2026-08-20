import type { TextSample } from "./contrast.js";

/*
 * Everything in this file runs inside the page, not in Node.
 *
 * Playwright serialises these with Function.prototype.toString(), so each one
 * has to be self-contained: no imports, no shared helpers, no references to
 * anything in module scope. Duplication between them is the price and is
 * deliberate. See the note in tsup.config.ts, and test/probes.test.ts, which
 * fails if a binding ever leaks out of one of these bodies.
 */

/**
 * Horizontal scroll the reader can actually perform.
 *
 * `scrollWidth - clientWidth` is the obvious measurement and it is wrong on
 * any page using `overflow-x: clip`, which reports overflowing content that
 * cannot be scrolled to — the whole reason to use `clip` instead of `hidden`.
 * That produced a standing false positive on every page of the site this came
 * from. Asking the document to scroll and reading back how far it went is the
 * only measurement that matches what a reader can do.
 */
export function probeScrollableOverflow(): number {
  var before = window.scrollY;
  window.scrollTo(1e6, before);
  var reached = Math.round(window.scrollX);
  window.scrollTo(0, before);
  return Math.abs(reached);
}

/** Walks the page top to bottom, so lazy and on-scroll content exists before anything is measured. */
export async function probeScrollThrough(): Promise<void> {
  var height = document.body ? document.body.scrollHeight : 0;
  for (var y = 0; y < height; y += 800) {
    window.scrollTo(0, y);
    await new Promise(function (resolve) {
      setTimeout(resolve, 40);
    });
  }
  window.scrollTo(0, 0);
}

/** Every `<a href>` on the page, and every id that exists to be linked to. */
export function probeLinkGraph(): { hrefs: string[]; ids: string[] } {
  var hrefs: string[] = [];
  var anchors = document.querySelectorAll("a[href]");
  for (var i = 0; i < anchors.length; i++) {
    var value = anchors[i].getAttribute("href");
    if (value !== null) hrefs.push(value);
  }
  var ids: string[] = [];
  var withId = document.querySelectorAll("[id]");
  for (var j = 0; j < withId.length; j++) {
    var id = withId[j].getAttribute("id");
    if (id) ids.push(id);
  }
  // `<a name>` is still a valid fragment target.
  var named = document.querySelectorAll("a[name]");
  for (var k = 0; k < named.length; k++) {
    var name = named[k].getAttribute("name");
    if (name) ids.push(name);
  }
  return { hrefs: hrefs, ids: ids };
}

/**
 * One entry per element that paints its own text, with the background stack
 * behind it. The arithmetic happens in Node — this only reports what the
 * browser computed.
 */
export function probeTextSamples(): TextSample[] {
  var out: TextSample[] = [];
  if (!document.body) return out;
  var elements = document.body.querySelectorAll("*");

  /*
   * Every colour is normalised to `rgba(r, g, b, a)` here, by painting it and
   * reading the pixel back. getComputedStyle returns whatever colour space the
   * author wrote — `oklch()` is now the default output of at least one popular
   * framework — and a parser in Node would have to implement those conversions
   * to be right. The browser already has them.
   */
  var canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  var ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  } catch (e) {
    ctx = null;
  }
  var cache: Record<string, string> = {};
  var toRgba = function (value: string): string {
    if (!value) return value;
    if (cache[value]) return cache[value];
    var result = value;
    if (ctx) {
      try {
        // An unparseable value leaves fillStyle untouched, so a sentinel is
        // the only way to tell "rejected" from "really is that colour".
        ctx.fillStyle = "#010203";
        ctx.fillStyle = value;
        if (ctx.fillStyle !== "#010203") {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillRect(0, 0, 1, 1);
          var d = ctx.getImageData(0, 0, 1, 1).data;
          result = "rgba(" + d[0] + ", " + d[1] + ", " + d[2] + ", " + d[3] / 255 + ")";
        }
      } catch (e) {
        result = value;
      }
    }
    cache[value] = result;
    return result;
  };

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i] as HTMLElement;
    var tag = element.tagName.toUpperCase();
    if (
      tag === "SCRIPT" ||
      tag === "STYLE" ||
      tag === "NOSCRIPT" ||
      tag === "TEMPLATE" ||
      tag === "SVG"
    )
      continue;
    if (element.getAttribute("aria-hidden") === "true") continue;

    var text = "";
    for (var c = 0; c < element.childNodes.length; c++) {
      var child = element.childNodes[c];
      if (child.nodeType === 3) text += child.nodeValue;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    var own = getComputedStyle(element);
    if (own.visibility === "hidden" || own.display === "none") continue;
    // Gradient-clipped text is painted by a background, not by `color`;
    // there is no foreground colour to measure.
    var fill = (own as any).webkitTextFillColor;
    if (fill) {
      var filled = toRgba(fill);
      if (filled.indexOf("rgba(") === 0 && parseFloat(filled.split(",")[3]) === 0)
        continue;
    }

    var box = element.getBoundingClientRect();
    // Smaller than this is a visually-hidden helper, not readable text.
    if (box.width < 2 || box.height < 2) continue;

    var backgrounds: string[] = [];
    var painted = false;
    var hidden = false;
    var node: HTMLElement | null = element;
    while (node) {
      var style = node === element ? own : getComputedStyle(node);
      if (parseFloat(style.opacity) === 0) {
        hidden = true;
        break;
      }
      var isRoot = node.tagName === "HTML" || node.tagName === "BODY";
      // A texture or wash on the root is the page's own canvas; an image on an
      // inner element is content the text may be sitting on top of, and no
      // static reading of the DOM can say what colour that is.
      if (!isRoot && style.backgroundImage && style.backgroundImage !== "none")
        painted = true;
      var colour = toRgba(style.backgroundColor);
      var alpha = colour.indexOf("rgba(") === 0 ? parseFloat(colour.split(",")[3]) : 1;
      if (colour && colour !== "transparent" && alpha > 0) {
        backgrounds.push(colour);
        if (!(alpha < 1)) break;
      }
      node = node.parentElement;
    }
    if (hidden) continue;

    if (!node) {
      // The stack reached the top without an opaque colour. The browser then
      // paints its own canvas, which is white unless the page opted into a
      // dark scheme — in which case the real colour is the browser's and
      // unknowable from here.
      var scheme = getComputedStyle(document.documentElement).colorScheme || "";
      if (scheme.indexOf("dark") === -1) backgrounds.push("#ffffff");
    }

    var name = element.tagName.toLowerCase();
    if (element.id) name += "#" + element.id;
    else if (element.classList.length)
      name += "." + Array.prototype.slice.call(element.classList, 0, 2).join(".");

    out.push({
      color: toRgba(own.color),
      backgrounds: backgrounds,
      paintedBackdrop: painted,
      fontSizePx: parseFloat(own.fontSize),
      fontWeight: parseInt(own.fontWeight, 10) || 400,
      selector: name.slice(0, 80),
      text: text.slice(0, 60),
    });
  }

  return out;
}
