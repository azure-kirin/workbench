import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { formatReport } from "../src/report.js";
import { filterConsole, type Report } from "../src/run.js";

const ESC = "\u001b";

const report = (over: Partial<Report> = {}): Report => ({
  ok: false,
  findings: [],
  notes: [],
  pagesRendered: 3,
  baseUrl: "https://site.test",
  ...over,
});

describe("resolveConfig", () => {
  it("crawls when no routes were named, and does not when they were", () => {
    expect(resolveConfig({ baseUrl: "https://site.test" }).crawl).toBe(true);
    expect(resolveConfig({ baseUrl: "https://site.test", routes: ["/"] }).crawl).toBe(
      false,
    );
  });

  it("keeps an explicit crawl setting either way", () => {
    expect(
      resolveConfig({ baseUrl: "https://site.test", routes: ["/"], crawl: true }).crawl,
    ).toBe(true);
  });

  it("normalises the base URL and the routes", () => {
    const config = resolveConfig({ baseUrl: "https://site.test/", routes: ["guide"] });
    expect(config.baseUrl).toBe("https://site.test");
    expect(config.routes).toEqual(["/guide"]);
  });

  it("turns checks off one at a time, leaving the rest on", () => {
    const config = resolveConfig({
      baseUrl: "https://site.test",
      checks: { glue: false },
    });
    expect(config.checks.glue).toBe(false);
    expect(config.checks.contrast).toBe(true);
  });

  it("refuses to run without somewhere to run against", () => {
    expect(() => resolveConfig({ baseUrl: "" })).toThrow(/baseUrl/);
  });
});

describe("filterConsole", () => {
  it("drops errors matching a substring or a pattern", () => {
    const errors = ["analytics.js 404", "TypeError: x is not a function"];
    expect(filterConsole(errors, ["analytics.js"])).toHaveLength(1);
    expect(filterConsole(errors, [/^TypeError/])).toEqual(["analytics.js 404"]);
    expect(filterConsole(errors)).toHaveLength(2);
  });
});

describe("formatReport", () => {
  it("says so plainly when nothing is wrong", () => {
    const text = formatReport(
      report({ ok: true, notes: [{ check: "glue", message: "3 documents scanned" }] }),
      false,
    );
    expect(text).toContain("all checks pass");
    expect(text).toContain("3 documents scanned");
  });

  it("counts occurrences separately from distinct findings", () => {
    const text = formatReport(
      report({
        findings: [
          {
            check: "contrast",
            where: "#777777 on #ffffff",
            message: "4.48:1, needs 4.5:1",
            count: 12,
          },
        ],
      }),
      false,
    );
    expect(text).toContain("1 colour pair below the threshold, on 12 text runs");
    expect(text).toContain("×12");
  });

  it("does not add up pages across distinct console errors", () => {
    const error = (message: string) => ({ check: "console" as const, where: "/", message, count: 1 });
    expect(formatReport(report({ findings: [error("a")] }), false)).toContain(
      "1 distinct console error on 1 page",
    );
    const two = formatReport(report({ findings: [error("a"), error("b")] }), false);
    expect(two).toContain("2 distinct console errors\n");
  });

  it("keeps the note visible even when the check failed", () => {
    const text = formatReport(
      report({
        findings: [{ check: "contrast", where: "a on b", message: "2:1, needs 4.5:1" }],
        notes: [{ check: "contrast", message: "40 runs, 9 skipped" }],
      }),
      false,
    );
    expect(text).toContain("40 runs, 9 skipped");
  });

  it("emits no escape codes when colour is off", () => {
    const text = formatReport(
      report({ findings: [{ check: "glue", where: "/:1", message: "no space" }] }),
      false,
    );
    expect(text).not.toContain(ESC);
    expect(formatReport(report({ ok: true }), true)).toContain(ESC);
  });
});
