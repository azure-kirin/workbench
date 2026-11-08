// @vitest-environment node
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runChecks, type Report } from "../src/index.js";

/**
 * The runner end to end, against a two-page site served from
 * test/fixtures/site — never a live one. Each page carries seeded faults, and
 * the run is asserted to find exactly those. Needs Chromium; skipped, with
 * the reason, when Playwright cannot launch it.
 */

const PAGES: Record<string, string> = {
  "/": "index.html",
  "/guide": "guide.html",
  "/smooth": "smooth.html",
};

let server: Server;
let baseUrl = "";
let launchError: string | null = null;

beforeAll(async () => {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    await browser.close();
  } catch (error) {
    launchError = (error as Error).message.split("\n")[0];
    return;
  }
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://x").pathname;
    const file = PAGES[path];
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    response
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(readFileSync(resolve(process.cwd(), "test/fixtures/site", file)));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  await new Promise((done) => (server ? server.close(done) : done(undefined)));
});

const where = (report: Report, check: string) =>
  report.findings.filter((f) => f.check === check).map((f) => `${f.where} — ${f.message}`);

describe("runChecks against a built site", () => {
  it("finds every seeded fault, and nothing else", async (context) => {
    if (launchError) {
      console.warn(`skipped: Chromium did not launch (${launchError})`);
      context.skip();
    }
    const report = await runChecks({
      baseUrl,
      viewports: [390, 1440],
      settleMs: 50,
    });

    // `/`, `/guide`, and `/gone`, which is crawled and answers 404.
    expect(report.pagesRendered).toBe(3);
    expect(report.ok).toBe(false);

    // The served HTML, not the rendered page.
    expect(where(report, "glue")).toEqual(["/:5 — no space at `</strong>o`"]);

    // One pair, judged at the widest viewport only.
    expect(where(report, "contrast")).toEqual(["#777777 on #ffffff — 4.48:1, needs 4.5:1"]);

    // The 600px row scrolls at 390 and fits at 1440; the guide's 3000px layer
    // is clipped, so there is nothing to scroll to.
    expect(where(report, "overflow")).toEqual(["/ @390 — 210px of horizontal scroll"]);

    // Grouped across widths, and the failed request carries its URL.
    const errors = report.findings.filter((f) => f.check === "console");
    expect(errors.map((f) => f.message).sort()).toEqual([
      `Failed to load resource: the server responded with a status of 404 (Not Found) — ${baseUrl}/missing.png`,
      expect.stringMatching(/^boom — /),
    ].sort());
    expect(errors.every((f) => f.where === "/" && f.count === 1)).toBe(true);

    // A page link that 404s, and a fragment the target page does not have.
    // `#`, mailto: and the off-site link are not followed.
    expect(where(report, "links").sort()).toEqual([
      "/gone — HTTP 404",
      "/guide#install — no element with that id on the target page",
    ]);
  }, 60_000);

  it("measures overflow under scroll-behavior: smooth", async (context) => {
    if (launchError) context.skip();
    const report = await runChecks({
      baseUrl,
      routes: ["/smooth"],
      viewports: [390, 1440],
      settleMs: 0,
      checks: { glue: false, contrast: false, console: false, links: false },
    });
    expect(where(report, "overflow")).toEqual([
      "/smooth @390 — 1210px of horizontal scroll",
      "/smooth @1440 — 160px of horizontal scroll",
    ]);
  }, 60_000);

  it("reports a named route that does not load, with its status", async (context) => {
    if (launchError) context.skip();
    const report = await runChecks({
      baseUrl,
      routes: ["/nowhere"],
      viewports: [390],
      settleMs: 0,
      checks: { glue: false },
    });
    expect(where(report, "links")).toEqual(["/nowhere — HTTP 404"]);
  }, 60_000);
});
