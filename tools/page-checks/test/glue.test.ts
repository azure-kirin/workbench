import { describe, expect, it } from "vitest";
import { findGluedBoundaries } from "../src/glue.js";
import { fixture } from "./helpers.js";

const document = fixture("glued.html");

const texts = (html: string, options = {}) =>
  findGluedBoundaries(html, options).map((h) => h.text);

describe("findGluedBoundaries", () => {
  it("catches a letter immediately after a closing inline tag", () => {
    expect(texts("<p>is <strong>immutable</strong>once written</p>")).toEqual([
      "</strong>o",
    ]);
  });

  it("catches a dash that lost its space", () => {
    expect(texts("<p>use <code>--strict</code>—it is stricter</p>")).toEqual([
      "</code>—",
    ]);
  });

  it("catches the same bug mirrored, before an opening tag", () => {
    expect(texts("<p>the queue drains<strong>before</strong> it closes</p>")).toEqual([
      "s<strong>",
    ]);
    expect(texts("<p>the queue drains<strong>before</strong> it closes</p>", {
      sides: "close",
    })).toEqual([]);
  });

  it("leaves punctuation that is never preceded by a space alone", () => {
    for (const html of [
      "<p>both <em>values</em>, and their order</p>",
      "<p>that is <em>hers</em>’s call</p>",
      "<p>and <em>his</em>: nobody else’s</p>",
      "<p>a <em>daemon</em>-like process</p>",
      "<p>see <em>above</em>.</p>",
    ])
      expect(texts(html)).toEqual([]);
  });

  it("does not flag scripts that write markup into the document", () => {
    const html = `<script>window.d = "<em>ignored</em>text";</script>`;
    expect(texts(html)).toEqual([]);
  });

  it("does not flag scripts that do not separate words with spaces", () => {
    expect(texts("<p>これは<em>強調</em>です</p>")).toEqual([]);
    expect(texts("<p>이것은<em>강조</em>입니다</p>")).toEqual([]);
  });

  it("suppresses a literal the author says is intentional", () => {
    const html = "<p>The lexer is <em>re</em>entrant by design.</p>";
    expect(texts(html)).toEqual(["</em>e"]);
    expect(texts(html, { allow: ["<em>re</em>entrant"] })).toEqual([]);
  });

  it("reports a line number and enough context to find the sentence", () => {
    const hits = findGluedBoundaries(document);
    const hit = hits.find((h) => h.text === "</strong>o");
    expect(hit).toBeDefined();
    expect(hit!.line).toBe(6);
    expect(hit!.context).toContain("immutable</strong>once");
  });

  it("finds every seeded fault in the fixture and nothing else", () => {
    expect(texts(document).sort()).toEqual(
      ["</code>—", "</em>e", "</strong>o", "s<strong>"].sort(),
    );
  });

  it("can be pointed at other tags", () => {
    expect(texts("<p>a <b>bold</b>word</p>")).toEqual([]);
    expect(texts("<p>a <b>bold</b>word</p>", { tags: ["b"] })).toEqual(["</b>w"]);
  });
});
