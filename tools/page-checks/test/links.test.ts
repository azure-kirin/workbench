import { describe, expect, it } from "vitest";
import { classifyHref, findLinkProblems, type LinkRef } from "../src/links.js";

const ORIGIN = "https://site.test";

describe("classifyHref", () => {
  it("resolves a fragment against the page it was found on", () => {
    expect(classifyHref("#install", "/guide", ORIGIN)).toEqual({
      kind: "internal",
      raw: "#install",
      path: "/guide",
      hash: "install",
    });
  });

  it("resolves a relative link against the page it was found on", () => {
    expect(classifyHref("options", "/guide/", ORIGIN)).toMatchObject({
      kind: "internal",
      path: "/guide/options",
    });
    expect(classifyHref("../index", "/guide/deep/", ORIGIN)).toMatchObject({
      path: "/guide/index",
    });
  });

  it("splits a cross-page fragment into both halves", () => {
    expect(classifyHref("/guide#options", "/", ORIGIN)).toMatchObject({
      path: "/guide",
      hash: "options",
    });
  });

  it("keeps the query, which can change what the page renders", () => {
    expect(classifyHref("/search?q=tokens", "/", ORIGIN)).toMatchObject({
      path: "/search?q=tokens",
    });
  });

  it("decodes a percent-encoded fragment", () => {
    expect(classifyHref("#a%20b", "/", ORIGIN)).toMatchObject({ hash: "a b" });
  });

  it("treats another origin as someone else's problem", () => {
    expect(classifyHref("https://elsewhere.test/x", "/", ORIGIN).kind).toBe("external");
    expect(classifyHref("//elsewhere.test/x", "/", ORIGIN).kind).toBe("external");
    expect(classifyHref(`${ORIGIN}/x`, "/", ORIGIN).kind).toBe("internal");
  });

  it("ignores hrefs that do not navigate to a document", () => {
    for (const href of [
      "mailto:hello@example.com",
      "tel:+10000",
      "javascript:void 0",
      "data:text/plain,x",
      "",
      null,
    ])
      expect(classifyHref(href, "/", ORIGIN).kind).toBe("ignored");
  });

  it("ignores the two fragments the browser defines itself", () => {
    expect(classifyHref("#", "/", ORIGIN).kind).toBe("ignored");
    expect(classifyHref("#top", "/", ORIGIN).kind).toBe("ignored");
  });
});

const ref = (over: Partial<LinkRef> = {}): LinkRef => ({
  from: "/",
  raw: "/guide",
  path: "/guide",
  hash: null,
  ...over,
});

describe("findLinkProblems", () => {
  it("catches a dangling anchor", () => {
    const problems = findLinkProblems(
      [ref({ raw: "#missing", path: "/", hash: "missing" })],
      new Map([["/", { status: 200, ids: ["install", "usage"] }]]),
    );
    expect(problems.findings).toHaveLength(1);
    expect(problems.findings[0].where).toBe("/#missing");
  });

  it("accepts an anchor that exists", () => {
    const problems = findLinkProblems(
      [ref({ raw: "#usage", path: "/", hash: "usage" })],
      new Map([["/", { status: 200, ids: ["install", "usage"] }]]),
    );
    expect(problems.findings).toEqual([]);
  });

  it("catches an anchor into another page, which is the one nobody notices", () => {
    const problems = findLinkProblems(
      [ref({ raw: "/guide#options", path: "/guide", hash: "options" })],
      new Map([["/guide", { status: 200, ids: ["install"] }]]),
    );
    expect(problems.findings[0].where).toBe("/guide#options");
    expect(problems.findings[0].detail?.[0]).toContain("linked from /");
  });

  it("catches a page link that does not resolve", () => {
    const problems = findLinkProblems(
      [ref({ path: "/gone" })],
      new Map([["/gone", { status: 404 }]]),
    );
    expect(problems.findings[0].message).toBe("HTTP 404");
  });

  it("reports one finding per broken target, listing where it is linked from", () => {
    const problems = findLinkProblems(
      [
        ref({ from: "/", path: "/gone" }),
        ref({ from: "/guide", path: "/gone" }),
        ref({ from: "/about", path: "/gone" }),
      ],
      new Map([["/gone", { status: 500 }]]),
    );
    expect(problems.findings).toHaveLength(1);
    expect(problems.findings[0].count).toBe(3);
    expect(problems.findings[0].detail?.[0]).toContain("/about");
  });

  it("says so rather than guessing when the target page was never rendered", () => {
    const problems = findLinkProblems(
      [ref({ path: "/guide", hash: "options" })],
      new Map([["/guide", { status: 200 }]]),
    );
    expect(problems.findings).toEqual([]);
    expect(problems.unverifiedAnchors).toBe(1);
  });

  it("skips targets nobody looked up", () => {
    expect(findLinkProblems([ref()], new Map()).findings).toEqual([]);
  });
});
