import { describe, expect, it } from "vitest";
import {
  analyseSamples,
  composite,
  contrastRatio,
  flattenBackground,
  parseColor,
  requiredRatio,
  type TextSample,
} from "../src/contrast.js";

const sample = (over: Partial<TextSample> = {}): TextSample & { route: string } => ({
  color: "#777777",
  backgrounds: ["#ffffff"],
  paintedBackdrop: false,
  fontSizePx: 16,
  fontWeight: 400,
  selector: "p",
  text: "text",
  route: "/",
  ...over,
});

describe("parseColor", () => {
  it("reads the forms a browser and a stylesheet can produce", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#00ff0080")).toEqual({ r: 0, g: 255, b: 0, a: 128 / 255 });
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor("rgb(1 2 3 / 50%)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor("transparent")?.a).toBe(0);
  });

  it("returns null rather than guessing", () => {
    expect(parseColor("rebeccapurple")).toBeNull();
    expect(parseColor("oklch(0.7 0.1 200)")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("agrees with the two values everyone knows", () => {
    expect(contrastRatio(parseColor("#000")!, parseColor("#fff")!)).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor("#fff")!, parseColor("#fff")!)).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = parseColor("#123456")!;
    const b = parseColor("#abcdef")!;
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("puts the canonical AA boundary where the guideline puts it", () => {
    // #767676 on white is the standard 4.5:1 example; one step lighter fails.
    expect(contrastRatio(parseColor("#767676")!, parseColor("#fff")!)).toBeGreaterThan(4.5);
    expect(contrastRatio(parseColor("#777777")!, parseColor("#fff")!)).toBeLessThan(4.5);
  });
});

describe("requiredRatio", () => {
  it("follows the large-text rule", () => {
    expect(requiredRatio(16, 400)).toBe(4.5);
    expect(requiredRatio(24, 400)).toBe(3);
    expect(requiredRatio(19, 700)).toBe(3);
    expect(requiredRatio(19, 400)).toBe(4.5);
    expect(requiredRatio(16, 400, "AAA")).toBe(7);
    expect(requiredRatio(24, 400, "AAA")).toBe(4.5);
  });
});

describe("flattenBackground", () => {
  it("composites a translucent tint onto the opaque surface below it", () => {
    const flat = flattenBackground(["rgba(255, 255, 255, 0.5)", "#000000"])!;
    expect(Math.round(flat.r)).toBe(128);
    expect(flat.a).toBe(1);
  });

  it("composites a whole stack, innermost first", () => {
    const flat = flattenBackground([
      "rgba(255, 0, 0, 0.5)",
      "rgba(0, 255, 0, 0.5)",
      "#000000",
    ])!;
    expect(Math.round(flat.r)).toBe(128);
    expect(Math.round(flat.g)).toBe(64);
  });

  it("ignores fully transparent layers", () => {
    expect(flattenBackground(["rgba(0, 0, 0, 0)", "#ffffff"])).toEqual(
      composite(parseColor("#ffffff")!, parseColor("#ffffff")!),
    );
  });

  it("gives up rather than assuming a colour it cannot see", () => {
    expect(flattenBackground([])).toBeNull();
    expect(flattenBackground(["rgba(0, 0, 0, 0.5)"])).toBeNull();
  });
});

describe("analyseSamples", () => {
  it("reports a known-failing pair as failing", () => {
    const result = analyseSamples([sample()]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].ratio).toBeCloseTo(4.48, 2);
    expect(result.failures[0].required).toBe(4.5);
  });

  it("passes the same colour once the text is large", () => {
    expect(analyseSamples([sample({ fontSizePx: 28 })]).failures).toEqual([]);
  });

  it("catches the failure the token contract cannot: the same role dimmed", () => {
    // A role that passes at full strength and is then used at 70% opacity.
    const solid = sample({ color: "rgb(125, 136, 172)", backgrounds: ["#080a15"] });
    const dimmed = sample({ color: "rgba(125, 136, 172, 0.7)", backgrounds: ["#080a15"] });
    expect(analyseSamples([solid]).failures).toEqual([]);
    expect(analyseSamples([dimmed]).failures).toHaveLength(1);
  });

  it("catches the failure that started this: passes on one surface, fails on another", () => {
    // A muted role picked against the page background, then reused inside a
    // card. Same colour, two surfaces, and only one of them was ever checked.
    const onCanvas = sample({ color: "#7882a0", backgrounds: ["#080a15"] });
    const onCard = sample({ color: "#7882a0", backgrounds: ["#161b2e"] });
    const result = analyseSamples([onCanvas, onCard]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].background).toBe("#161b2e");
    expect(result.failures[0].ratio).toBeCloseTo(4.47, 2);
  });

  it("reports one finding per colour pair, not one per element", () => {
    const result = analyseSamples([sample(), sample(), sample({ selector: "span" })]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].count).toBe(3);
    expect(result.failures[0].example.selector).toBe("p");
  });

  it("counts, rather than judges, text whose backdrop it cannot determine", () => {
    const onImage = sample({ paintedBackdrop: true });
    const noBase = sample({ backgrounds: [] });
    const result = analyseSamples([onImage, noBase]);
    expect(result.failures).toEqual([]);
    expect(result.undetermined).toBe(2);
    expect(result.examined).toBe(0);
  });

  it("sorts the worst pair first", () => {
    const result = analyseSamples([
      sample({ color: "#767676", backgrounds: ["#eeeeee"] }),
      sample({ color: "#cccccc", backgrounds: ["#ffffff"] }),
    ]);
    expect(result.failures[0].foreground).toBe("#cccccc");
  });
});
