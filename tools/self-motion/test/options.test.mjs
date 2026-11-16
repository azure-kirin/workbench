import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULTS,
  loadConfig,
  loopingReason,
  matcher,
  parseArgs,
  resolveOptions,
  selectStories,
  selectViewports,
} from "../lib/options.mjs";

describe("parseArgs", () => {
  it("reads flags, repeated flags, `--flag=value` and positional story ids", () => {
    const args = parseArgs(["button--*", "--mask", ".backdrop", "--mask=.video", "--loop", "motion--demo", "--watch=500", "--allow-plays", "card--gallery"]);
    assert.deepEqual(args.stories, ["button--*", "card--gallery"]);
    assert.deepEqual(args.mask, [".backdrop", ".video"]);
    assert.deepEqual(args.loop, ["motion--demo"]);
    assert.equal(args.watch, "500");
    assert.equal(args.allowPlays, true);
  });

  it("refuses an unknown flag and a flag without its value", () => {
    assert.throws(() => parseArgs(["--viewports", "phone"]), /unknown option --viewports/);
    assert.throws(() => parseArgs(["--static"]), /--static needs a value/);
    assert.throws(() => parseArgs(["--static", "--json", "x"]), /--static needs a value/);
  });
});

describe("resolveOptions", () => {
  it("lets the command line win over the config, and the config over the defaults", () => {
    const config = { baseUrl: "http://127.0.0.1:6007/", watch: 2000, mask: [".backdrop"], looping: { "a--b": "loops" } };
    const options = resolveOptions(config, parseArgs(["--watch", "800", "--mask", ".video", "--loop", "c--*"]));
    assert.equal(options.baseUrl, "http://127.0.0.1:6007");
    assert.equal(options.watch, 800);
    assert.deepEqual(options.mask, [".backdrop", ".video"]);
    assert.deepEqual(options.looping, { "a--b": "loops", "c--*": "named with --loop" });
    assert.equal(options.tile, DEFAULTS.tile);
    assert.deepEqual(options.tags, DEFAULTS.tags);
  });

  it("opts into named boxes only when asked", () => {
    assert.equal(resolveOptions({}, parseArgs([])).boxes.name, null);
    const named = resolveOptions({ boxes: { selector: "[data-part]", name: "data-part" } }, parseArgs([]));
    assert.deepEqual(named.boxes, { selector: "[data-part]", name: "data-part" });
    assert.equal(resolveOptions({}, parseArgs(["--box-name", "data-testid"])).boxes.selector, DEFAULTS.boxes.selector);
  });

  it("refuses settings that cannot work", () => {
    assert.throws(() => resolveOptions({ shots: 1 }, parseArgs([])), /at least 2/);
    assert.throws(() => resolveOptions({}, parseArgs(["--watch", "soon"])), /positive number/);
  });
});

describe("selectViewports", () => {
  const viewports = DEFAULTS.viewports;
  it("takes names, all, and sizes", () => {
    assert.deepEqual(selectViewports(null, viewports).map(([name]) => name), ["desktop", "phone"]);
    assert.deepEqual(selectViewports("both", viewports).map(([name]) => name), ["desktop", "phone"]);
    assert.deepEqual(selectViewports("phone,1024x768", viewports), [
      ["phone", { width: 390, height: 844 }],
      ["1024x768", { width: 1024, height: 768 }],
    ]);
  });
  it("names the choices when it does not know one", () => {
    assert.throws(() => selectViewports("tablet", viewports), /unknown viewport "tablet" \(desktop, phone, all, <w>x<h>\)/);
  });
});

describe("story ids", () => {
  it("match exactly, or by `*`", () => {
    const match = matcher(["button--*", "card--gallery"]);
    assert.equal(match("button--primary"), true);
    assert.equal(match("card--gallery"), true);
    assert.equal(match("card--gallery-dark"), false);
    assert.equal(match("icon-button--primary"), false);
  });

  it("give the reason a story loops, from the first pattern it matches", () => {
    assert.equal(loopingReason("motion--spring", { "motion--*": "demos loop" }), "demos loop");
    assert.equal(loopingReason("button--primary", { "motion--*": "demos loop" }), null);
  });
});

describe("selectStories", () => {
  const index = {
    v: 5,
    entries: {
      "a--docs": { type: "docs", id: "a--docs", tags: ["dev"] },
      "a--one": { type: "story", id: "a--one", tags: ["dev"] },
      "a--rig": { type: "story", id: "a--rig", tags: ["test"] },
      "a--slow": { type: "story", id: "a--slow", tags: ["dev", "slow"] },
      "a--one:saves": { type: "story", subtype: "test", id: "a--one:saves", tags: ["dev"] },
      "b--old": { type: "story", id: "b--old" },
    },
  };
  const base = { tags: DEFAULTS.tags, exclude: [], stories: [] };

  it("takes stories in the sidebar: no docs, no hidden rigs, no test children", () => {
    assert.deepEqual(selectStories(index, base), ["a--one", "a--slow", "b--old"]);
  });

  it("filters by tags, exclusions and the ids asked for", () => {
    assert.deepEqual(selectStories(index, { ...base, tags: { include: ["dev"], exclude: ["slow"] } }), ["a--one", "b--old"]);
    assert.deepEqual(selectStories(index, { ...base, exclude: ["b--*"] }), ["a--one", "a--slow"]);
    assert.deepEqual(selectStories(index, { ...base, stories: ["a--*"] }), ["a--one", "a--slow"]);
  });

  it("refuses something that is not a story index", () => {
    assert.throws(() => selectStories({ stories: {} }, base), /not a Storybook index/);
  });
});

describe("loadConfig", () => {
  it("reads self-motion.config.mjs when there is one, and is empty when there is not", async () => {
    const dir = mkdtempSync(join(tmpdir(), "self-motion-"));
    assert.deepEqual(await loadConfig(undefined, dir), { config: {}, file: null });
    writeFileSync(join(dir, "self-motion.config.mjs"), "export default { mask: ['.backdrop'] };\n");
    const { config, file } = await loadConfig(undefined, dir);
    assert.deepEqual(config, { mask: [".backdrop"] });
    assert.equal(file, join(dir, "self-motion.config.mjs"));
  });

  it("fails when a named config is missing", async () => {
    await assert.rejects(loadConfig("nope.mjs", tmpdir()), /config not found/);
  });
});
