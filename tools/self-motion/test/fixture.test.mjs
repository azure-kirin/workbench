/**
 * The whole tool against a small static stand-in for a Storybook build
 * (test/fixture/storybook-static): one scenario per failure it exists to
 * catch, and the cases it must let through. Needs Chromium for the installed
 * Playwright; skipped, with the reason, when it cannot launch.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const cli = join(here, "..", "self-motion.mjs");
const fixture = join(here, "fixture", "storybook-static");

const unavailable = await (async () => {
  try {
    const { chromium } = (await import("playwright")).default;
    const browser = await chromium.launch();
    await browser.close();
    return false;
  } catch (error) {
    return `Chromium unavailable (${error.message.split("\n")[0]}); run \`npx playwright install chromium\``;
  }
})();

function run(args, cwd) {
  return new Promise((done) => {
    execFile(process.execPath, [cli, "--static", fixture, "--viewport", "640x480", "--watch", "1000", ...args], { cwd }, (error, stdout, stderr) =>
      done({ code: error?.code ?? 0, stdout, stderr }),
    );
  });
}

describe("against a static Storybook", { skip: unavailable }, () => {
  const dir = mkdtempSync(join(tmpdir(), "self-motion-fixture-"));
  const json = join(dir, "report.json");
  let result;
  let byId;

  before(async () => {
    // The config comes from the project's directory, as it would in use.
    writeFileSync(join(dir, "self-motion.config.mjs"), 'export default { mask: [".backdrop"] };\n');
    result = await run(["--json", json], dir);
    const [{ results }] = Object.values(JSON.parse(readFileSync(json, "utf8")));
    byId = Object.fromEntries(results.map((entry) => [entry.id, entry]));
  });

  it("exits 1 because stories moved, and prints them", () => {
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stdout, /✗ fixture--scrolls/);
  });

  it("opens stories only: no docs entry, no story without the `dev` tag", () => {
    assert.deepEqual(Object.keys(byId).sort(), [
      "fixture--drift",
      "fixture--entrance",
      "fixture--late-content",
      "fixture--late-focus",
      "fixture--play",
      "fixture--scrolls",
      "fixture--spinner",
      "fixture--still",
      "fixture--toast",
    ]);
  });

  it("lets through a still page, an infinite spinner, and designed motion the config masks", () => {
    assert.deepEqual(byId["fixture--still"].findings, []);
    assert.deepEqual(byId["fixture--spinner"].findings, []);
    assert.deepEqual(byId["fixture--drift"].findings, []);
  });

  it("names each kind of self-motion", () => {
    const has = (id, pattern) =>
      assert.ok(byId[id].findings.some((finding) => pattern.test(finding)), `${id}: ${JSON.stringify(byId[id].findings)}`);
    has("fixture--scrolls", /^scroll changed/);
    has("fixture--late-focus", /^focus (moved|landed)/);
    has("fixture--late-content", /^layout shift/);
    has("fixture--late-content", /moved \[/);
    has("fixture--late-content", /^pixels changed/);
    has("fixture--toast", /^\[div\[role=status\]\] count 0 → 1/);
    has("fixture--entrance", /^animation running after load/);
    has("fixture--play", /has a play in this build/);
  });

  it("checks a looping story for scroll and focus only, and says why", async () => {
    const loop = await run(["--loop", "fixture--drift", "fixture--drift"], tmpdir());
    assert.equal(loop.code, 0, loop.stdout);
    assert.match(loop.stdout, /fixture--drift: pixels, boxes and layout shifts not compared: named with --loop/);
  });

  it("catches the same drift when nothing masks it", async () => {
    const bare = await run(["fixture--drift"], tmpdir());
    assert.equal(bare.code, 1);
    assert.match(bare.stdout, /pixels changed/);
  });

  it("exits 2 when the ids match no story", async () => {
    const none = await run(["nothing--here"], tmpdir());
    assert.equal(none.code, 2);
    assert.match(none.stderr, /no stories to watch/);
  });
});
