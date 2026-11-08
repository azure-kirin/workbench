import { beforeEach, describe, expect, it } from "vitest";
import { analyseSamples } from "../src/contrast.js";
import { probeLinkGraph, probeTextSamples } from "../src/probes.js";
import { fixture } from "./helpers.js";

/**
 * These run in jsdom, which computes inline styles but does no layout — so
 * every element reports a zero-sized box and the probe's "is this big enough
 * to read" filter would throw everything away. Give it a box.
 */
function withLayout(): void {
  Element.prototype.getBoundingClientRect = function () {
    return { width: 200, height: 20, top: 0, left: 0, right: 200, bottom: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
}

function load(name: string): void {
  document.documentElement.innerHTML = fixture(name)
    .replace(/[\s\S]*<html[^>]*>/, "")
    .replace(/<\/html>[\s\S]*/, "");
  const body = fixture(name).match(/<body([^>]*)>/);
  if (body?.[1].includes("style"))
    document.body.setAttribute(
      "style",
      body[1].match(/style="([^"]*)"/)?.[1] ?? "",
    );
}

describe("probeLinkGraph", () => {
  beforeEach(() => load("links.html"));

  it("reports every href exactly as authored", () => {
    expect(probeLinkGraph().hrefs).toContain("#install");
    expect(probeLinkGraph().hrefs).toContain("mailto:someone@example.com");
    expect(probeLinkGraph().hrefs).toHaveLength(8);
  });

  it("collects fragment targets from ids and from the older <a name>", () => {
    const ids = probeLinkGraph().ids;
    expect(ids).toContain("install");
    expect(ids).toContain("legacy-anchor");
  });
});

describe("probeTextSamples", () => {
  beforeEach(() => {
    withLayout();
    load("contrast.html");
  });

  it("walks out to the first opaque background rather than assuming one", () => {
    const samples = probeTextSamples();
    const onCard = samples.find((s) => s.text.startsWith("The same grey again"));
    expect(onCard?.backgrounds).toEqual(["rgb(238, 238, 238)"]);
    const onBody = samples.find((s) => s.text.startsWith("Grey on white"));
    expect(onBody?.backgrounds).toEqual(["rgb(255, 255, 255)"]);
  });

  it("marks text over an image rather than measuring the colour under it", () => {
    const onPhoto = probeTextSamples().find((s) => s.text.startsWith("On an image"));
    expect(onPhoto?.paintedBackdrop).toBe(true);
  });

  it("leaves SVG text alone, since fill paints it and color says nothing", () => {
    const inSvg = probeTextSamples().find((s) => s.text.startsWith("SVG text"));
    expect(inSvg).toBeUndefined();
  });

  it("feeds the analysis end to end, and the fixture's faults come back out", () => {
    const result = analyseSamples(
      probeTextSamples().map((s) => ({ ...s, route: "/" })),
    );
    const backgrounds = result.failures.map((f) => f.background).sort();
    // #777777 fails on white and on the light card; it passes at 28px, and the
    // run over an image is not judged at all.
    expect(backgrounds).toEqual(["#eeeeee", "#ffffff"]);
    expect(result.undetermined).toBe(1);
  });
});

describe("the probes are self-contained", () => {
  /*
   * Playwright ships these to the page as source text. A binding the bundler
   * hoists out of the body survives every unit test and throws in the browser,
   * so this asserts on the built artifact, not on the source.
   */
  it("compiles and runs with nothing but page globals in scope", async () => {
    /* Through a variable, so the type checker does not need dist/ to exist —
       `npm run typecheck` runs before any build. */
    const entry = "../dist/index.js";
    const built = (await import(/* @vite-ignore */ entry)) as typeof import("../src/index.js");
    for (const name of [
      "probeScrollableOverflow",
      "probeScrollThrough",
      "probeLinkGraph",
      "probeTextSamples",
    ] as const) {
      const source = (built[name] as () => unknown).toString();
      expect(source, `${name} carries a bundler helper`).not.toMatch(/\b__\w+\(/);
      expect(() => new Function(`return (${source})`)()).not.toThrow();
    }
  });

  it("still works after the round trip through source text", () => {
    load("links.html");
    const rebuilt = new Function(`return (${probeLinkGraph.toString()})`)() as
      typeof probeLinkGraph;
    expect(rebuilt().ids).toContain("install");
  });
});
