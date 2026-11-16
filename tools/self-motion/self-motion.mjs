#!/usr/bin/env node
/**
 * Self-motion watch — a page a person opens never moves on its own.
 *
 * Opens every story a Storybook lists (its index.json; a dev server or a
 * static build) in headless Chromium at each viewport, waits for the story to
 * finish rendering and for its fonts, then watches it without touching it:
 *
 *   - the scroll position of the page and of every scrolled element;
 *   - document.activeElement, and every focus that lands while watched;
 *   - layout-shift entries, from navigation on;
 *   - the boxes of the watched elements, and how many there are;
 *   - finite animations still running after load;
 *   - screenshots across the watch, compared in tiles.
 *
 * Infinite animations are masked from boxes and pixels; so is anything the
 * config names in `mask`. Stories in `looping` are checked for scroll and
 * focus only. See README.md for the config and the flags.
 *
 *   self-motion                                   # every story, against localhost:6006
 *   self-motion --static storybook-static         # serve a build and watch it
 *   self-motion --viewport phone 'button--*'      # some stories, one viewport
 *
 * Exit 0 when nothing moved, 1 when a story moved, 2 on a usage error.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { judge } from "./lib/judge.mjs";
import { loadConfig, loopingReason, parseArgs, resolveOptions, selectStories, selectViewports } from "./lib/options.mjs";
import { recorder, sample } from "./lib/page.mjs";
import { serve } from "./lib/serve-static.mjs";
import { changedTiles } from "./lib/tiles.mjs";

const HELP = `self-motion [story-id|glob ...] [options]

  --base-url <url>      Storybook to watch (default http://localhost:6006)
  --static <dir>        serve a built Storybook from <dir> instead
  --config <file>       config module (default ./self-motion.config.mjs, if present)
  --viewport <spec>     names from the config, all, or <w>x<h>; comma-separated
  --watch <ms>          how long each story is watched (default 3000)
  --mask <selector>     designed motion to mask from boxes and pixels (repeatable)
  --loop <id|glob>      a story that loops on purpose: scroll and focus only (repeatable)
  --exclude <id|glob>   a story not to open (repeatable)
  --boxes <selector>    the elements whose boxes are watched
  --box-name <attr>     the attribute that names them (e.g. data-testid)
  --allow-plays         a play left in the build is not a finding
  --cold                a fresh browser context (empty cache) for every story
  --concurrency <n>     stories watched at once (default 4)
  --json <file>         write the report as JSON`;

// Playwright is a peer: resolve it from the project being watched (cwd), so the
// tool runs from any checkout without carrying its own copy; fall back to the
// tool's own resolution for the linked/installed case.
async function loadChromium() {
  const req = createRequire(pathToFileURL(resolve(process.cwd(), "package.json")).href);
  let mod;
  try {
    mod = await import(pathToFileURL(req.resolve("playwright")).href);
  } catch {
    mod = await import("playwright");
  }
  // playwright is CommonJS: under a file-URL import its exports sit on `default`.
  return (mod.chromium ? mod : mod.default).chromium;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Decodes two PNG screenshots on a canvas and compares them with `changedTiles`, in the comparer page. */
async function compareShots(comparer, a, b, { tile, tolerance, masks }) {
  return comparer.evaluate(
    async ({ a, b, tile, tolerance, masks, source }) => {
      const decode = async (base64) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const changedTiles = new Function(`return (${source})`)();
      const [x, y] = await Promise.all([decode(a), decode(b)]);
      return changedTiles(x, y, { tile, tolerance, masks });
    },
    { a, b, tile, tolerance, masks, source: changedTiles.toString() },
  );
}

async function watchStory(context, comparer, id, viewport, options) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message.split("\n")[0]));
  try {
    await page.goto(`${options.baseUrl}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`, {
      waitUntil: "load",
    });
    // Rendered, its play (if any) finished, its afterEach run — or failed.
    await page.waitForFunction(
      () =>
        ["finished", "errored", "aborted"].includes(window.__STORYBOOK_PREVIEW__?.currentRender?.phase) ||
        document.body.classList.contains("sb-show-errordisplay") ||
        document.body.classList.contains("sb-show-nopreview"),
      undefined,
      { timeout: options.renderTimeout },
    );
    if (await page.evaluate(() => document.body.classList.contains("sb-show-nopreview")))
      return { id, findings: ["Storybook shows no preview for this id"], notes: [] };
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const hasPlay = await page.evaluate(() => !!window.__STORYBOOK_PREVIEW__?.currentRender?.story?.playFunction);
    const start = await page.evaluate(() => performance.now());
    const looping = loopingReason(id, options.looping);

    const args = {
      boxSelector: options.boxes.selector,
      nameAttribute: options.boxes.name,
      masks: options.mask,
      tolerance: options.boxTolerance,
    };
    const samples = [];
    const shots = [];
    for (let shot = 0; shot < options.shots; shot++) {
      if (shot > 0) await sleep(options.watch / (options.shots - 1));
      samples.push(await page.evaluate(sample, args));
      if (!looping) shots.push((await page.screenshot({ caret: "hide" })).toString("base64"));
    }
    const recorded = await page.evaluate(() => ({
      shifts: window.__selfMotion.shifts,
      focus: window.__selfMotion.focus,
    }));

    const masks = samples.flatMap((s) => s.excused);
    const tileDiffs = [];
    for (let i = 1; i < shots.length; i++) {
      tileDiffs.push(
        await compareShots(comparer, shots[i - 1], shots[i], {
          tile: options.tile,
          tolerance: options.pixelTolerance,
          masks,
        }),
      );
    }
    const { findings, notes } = judge({
      samples,
      recorded,
      start,
      tileDiffs,
      viewport,
      hasPlay,
      pageErrors,
      looping,
      options,
    });
    return { id, findings, notes };
  } catch (error) {
    return { id, findings: [`could not watch: ${error.message.split("\n")[0]}`], notes: [] };
  } finally {
    await page.close();
  }
}

async function main() {
  let options;
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(HELP);
      return 0;
    }
    const { config } = await loadConfig(args.config);
    options = resolveOptions(config, args);
  } catch (error) {
    console.error(`self-motion: ${error.message}\n\n${HELP}`);
    return 2;
  }
  const viewports = (() => {
    try {
      return selectViewports(options.only, options.viewports);
    } catch (error) {
      console.error(`self-motion: ${error.message}`);
      return null;
    }
  })();
  if (!viewports) return 2;

  let server;
  if (options.static) {
    server = await serve(options.static);
    options.baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  const started = Date.now();
  let chromium;
  let browser;
  try {
    let stories;
    try {
      const response = await fetch(`${options.baseUrl}/index.json`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      stories = selectStories(await response.json(), options);
    } catch (error) {
      console.error(`self-motion: cannot read ${options.baseUrl}/index.json — ${error.message}`);
      return 2;
    }
    if (stories.length === 0) {
      console.error(
        `self-motion: no stories to watch at ${options.baseUrl}${options.stories.length ? ` matching ${options.stories.join(", ")}` : ""}`,
      );
      return 2;
    }

    chromium = await loadChromium();
    browser = await chromium.launch();
    const report = {};
    let moved = 0;
    for (const [name, viewport] of viewports) {
      const viewportStarted = Date.now();
      const openContext = async () => {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        await context.addInitScript(recorder, { nameAttribute: options.boxes.name });
        return context;
      };
      // Warm: one context, so the HTTP cache fills on the first stories. Cold:
      // a context per story, so every story loads its fonts and images afresh.
      const shared = options.cold ? null : await openContext();
      const comparer = await (await browser.newContext()).newPage();
      const queue = [...stories];
      const results = [];
      await Promise.all(
        Array.from({ length: Math.min(options.concurrency, queue.length) }, async () => {
          while (queue.length > 0) {
            const id = queue.shift();
            const context = shared ?? (await openContext());
            results.push(await watchStory(context, comparer, id, viewport, options));
            if (!shared) await context.close();
          }
        }),
      );
      results.sort((a, b) => stories.indexOf(a.id) - stories.indexOf(b.id));
      report[name] = { viewport, results };
      console.log(
        `\n${name} ${viewport.width} × ${viewport.height}: ${results.length} stories in ${Math.round((Date.now() - viewportStarted) / 1000)}s`,
      );
      for (const { id, findings, notes } of results) {
        for (const note of notes) console.log(`  · ${id}: ${note}`);
        if (findings.length === 0) continue;
        moved++;
        console.log(`  ✗ ${id}`);
        for (const finding of findings) console.log(`      ${finding}`);
      }
      await shared?.close();
      await comparer.context().close();
    }
    if (options.json) writeFileSync(options.json, `${JSON.stringify(report, null, 2)}\n`);
    console.log(moved === 0 ? "\n✓ nothing moved on its own" : `\n✗ ${moved} story run(s) moved on their own`);
    console.log(
      `self-motion: ${Math.round((Date.now() - started) / 1000)}s, ${stories.length} stories × ${viewports.length} viewport(s) against ${options.static ?? options.baseUrl}`,
    );
    return moved === 0 ? 0 : 1;
  } finally {
    await browser?.close();
    server?.close();
  }
}

process.exitCode = await main();
