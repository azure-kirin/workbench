import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analysePlays, applyCuts, stripPlays } from "../src/strip";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

/** Every play member left in the code, cut or not (what a second pass would still find). */
const playsLeft = (code: string, file: string) => {
  const { cuts, uncut } = analysePlays(code, file);
  return cuts.length + uncut.length;
};

describe("CSF 3 story objects", () => {
  const file = "csf3.stories.tsx";
  const source = fixture(file);
  const { code, cuts, uncut } = stripPlays(source, file);

  it("cuts the meta's play and every story's", () => {
    // meta, Paused, Playing, Method, base ("play" as a string key), Spread
    expect(cuts).toHaveLength(6);
    expect(uncut).toEqual([]);
    expect(playsLeft(code, file)).toBe(0);
    expect(code).not.toContain("MARKER_ARROW");
    expect(code).not.toContain("MARKER_METHOD");
    expect(code).not.toContain("play: pressPlay");
    expect(code).not.toContain('"play": async');
  });

  it("keeps every line where it was", () => {
    const before = source.split("\n");
    const after = code.split("\n");
    expect(after).toHaveLength(before.length);
    const at = (lines: string[], text: string) => lines.findIndex((line) => line.includes(text));
    for (const text of ["export const Playing", "name: \"Method play\"", "export const NoPlay"]) {
      expect(at(after, text)).toBe(at(before, text));
    }
  });

  it("leaves a play that is data, a helper's method and the rest of each story", () => {
    expect(code).toContain("play: false, onPlay");
    expect(code).toContain("play: true");
    expect(code).toContain("play(video: HTMLVideoElement)");
    expect(code).toContain("controls.play(video)");
    expect(code).toContain('play: () => "parameter, not a play"');
    expect(code).toContain("render: (args) =>");
    expect(code).toContain("...base");
    // The shared function stays declared; with no reference left a bundler drops it.
    expect(code).toContain("const pressPlay");
  });
});

describe("CSF factories", () => {
  const file = "factories.stories.tsx";
  const { code, cuts, uncut } = stripPlays(fixture(file), file);

  it("cuts plays from meta(), story() and extend()", () => {
    expect(cuts).toHaveLength(3);
    expect(uncut).toEqual([]);
    for (const marker of ["MARKER_META", "MARKER_STORY", "MARKER_EXTEND"]) {
      expect(code).not.toContain(marker);
    }
  });

  it("leaves .test() alone: it is a test entry of its own, not a play on the story", () => {
    expect(code).toContain('Primary.test("saves on click"');
    expect(code).toContain("meta.story(() => <Button");
  });
});

describe("plays it cannot cut", () => {
  const file = "uncut.stories.tsx";
  const { cuts, uncut } = stripPlays(fixture(file), file);

  it("reports each with its line and what the code looks like there", () => {
    expect(cuts).toEqual([]);
    expect(uncut.map(({ line, reason }) => [line, reason])).toEqual([
      [9, "a play assigned after the story (Assigned.play = …)"],
      [12, "an object passed to a call that makes a story (a factory or a wrapper)"],
      [18, "an object shaped like a story that is not a top-level story or meta"],
    ]);
  });

  it("does not report a play inside args, or a helper object's play", () => {
    const source = [
      "const media = { play() { return 1; } };",
      "export const A = { args: { play: () => {} }, render: () => media.play() };",
      "export const B = { render: () => { const c = { play: () => video.play() }; return c; } };",
    ].join("\n");
    expect(analysePlays(source, "x.stories.ts").uncut).toEqual([]);
  });
});

describe("parsing", () => {
  it("reads a .ts story file as TypeScript, without JSX", () => {
    const file = "generic.stories.ts";
    const { code, cuts } = stripPlays(fixture(file), file);
    expect(cuts).toHaveLength(1);
    expect(code).not.toContain("MARKER_TS_PLAY");
    expect(code).toContain("<string>identity");
  });

  it("throws on a file it cannot parse, instead of passing its plays through", () => {
    expect(() => stripPlays("export const A = { play: async () => {", "a.stories.ts")).toThrow();
  });

  it("removes a trailing comma with the play, and keeps a last member's object valid", () => {
    const source = "export const A = { play: f, name: 'a' };\nexport const B = { name: 'b', play: f };";
    const { code } = stripPlays(source, "a.stories.ts");
    expect(code).toBe("export const A = {  name: 'a' };\nexport const B = { name: 'b',  };");
    expect(() => analysePlays(code, "a.stories.ts")).not.toThrow();
  });

  it("applies cuts given in any order", () => {
    const source = "export const A = { play: f, x: 1, play2: 2 };";
    const { cuts } = analysePlays(source, "a.stories.ts");
    expect(applyCuts(source, [...cuts].reverse())).toBe(applyCuts(source, cuts));
  });
});
