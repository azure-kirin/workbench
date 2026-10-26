#!/usr/bin/env node
/**
 * Layout-stability audit — catches UI jitter in numbers.
 *
 * For a page (or Storybook story) it measures the bounding boxes of named
 * "anchors" (chrome that must not move), performs interactive actions, and
 * re-measures after each action AND after restoring the initial state. Any
 * anchor that moved/resized when it was expected to stay put is reported
 * with its per-axis delta in px. Optional "frame checks" assert baseline
 * geometry (e.g. a status bar flush with a device frame).
 *
 * The audit registry is the project's: a module that default-exports
 *   { audits: { <name>: Audit }, frameChecks?: FrameCheck[] }
 *
 *   Audit = {
 *     url?: string,            // absolute, or relative to --base-url
 *     story?: string,          // Storybook story id → <base-url>/iframe.html?id=…
 *     viewport?: { width, height },
 *     timeout?: number,        // ms per locator action, default 8000
 *     anchors: { <name>: <Playwright locator string> },   // first match wins
 *     actions: [{ name, perform(page), restore(page), mayChange?: [], mayHide?: [] }],
 *     frameChecks?: FrameCheck[] | "ios"   // override the registry default
 *   }
 *   FrameCheck = { name, measure(boxes, ctx) → number|null, ok(value) → bool, describe(value) → string }
 *
 * Usage (the target server must be running):
 *   layout-stability                          # all audits in ./layout-audits.mjs
 *   layout-stability chats-requests           # one audit
 *   layout-stability --config path/to/audits.mjs --base-url http://localhost:6008
 *
 * Exit 1 when any violation is found — wire into CI.
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Playwright is a peer: resolve it from the project being audited (cwd), so the
// tool runs from any checkout without carrying its own copy; fall back to the
// tool's own resolution for the linked/installed case.
const { chromium } = await (async () => {
  const req = createRequire(pathToFileURL(resolve(process.cwd(), "package.json")).href);
  let mod;
  try { mod = await import(pathToFileURL(req.resolve("playwright")).href); }
  catch { mod = await import("playwright"); }
  // playwright is CommonJS: under a file-URL import its exports sit on `default`.
  return mod.chromium ? mod : mod.default;
})();

const TOLERANCE = 0.5; // px — sub-pixel rendering noise is not jitter
const fmt = (n) => (Math.round(n * 10) / 10).toString();

// ─── Built-in frame-check preset: iOS device frame ─────────────────────
// Needs anchors: frame, background, statusBar, topBar. `ctx.frameBorderTop`
// excludes the bezel border — flow content correctly starts inside it.
export const PRESETS = {
  ios: [
    {
      name: "background artwork reaches frame top",
      measure: (b, ctx) => (b.background && b.frame ? b.background.y - (b.frame.y + ctx.frameBorderTop) : null),
      ok: (gap) => gap <= TOLERANCE,
      describe: (gap) => `artwork starts ${fmt(gap)}px below the frame top`,
    },
    {
      name: "status bar flush with frame top",
      measure: (b, ctx) => (b.statusBar && b.frame ? b.statusBar.y - (b.frame.y + ctx.frameBorderTop) : null),
      ok: (gap) => Math.abs(gap) <= TOLERANCE,
      describe: (gap) => `status bar sits ${fmt(gap)}px from the frame top`,
    },
    {
      name: "top bar flush with status bar",
      measure: (b) => (b.topBar && b.statusBar ? b.topBar.y - (b.statusBar.y + b.statusBar.height) : null),
      ok: (gap) => Math.abs(gap) <= TOLERANCE,
      describe: (gap) => `gap of ${fmt(gap)}px between status bar and top bar`,
    },
  ],
};

// ─── Engine ────────────────────────────────────────────────────────────

async function measureAnchors(page, anchors) {
  const boxes = {};
  for (const [name, selector] of Object.entries(anchors)) {
    const locator = page.locator(selector).first();
    boxes[name] = (await locator.count()) ? await locator.boundingBox() : null;
  }
  return boxes;
}

function diffBoxes(name, base, current) {
  if (!(base || current)) return null;
  if (base && !current) return { name, hidden: true };
  if (!base && current) return { name, appeared: true };
  const delta = { x: current.x - base.x, y: current.y - base.y, w: current.width - base.width, h: current.height - base.height };
  const moved = Object.values(delta).some((v) => Math.abs(v) > TOLERANCE);
  return moved ? { name, delta } : null;
}

function reportDiffs(diffs, { mayChange = [], mayHide = [] }, phase) {
  const violations = [];
  for (const diff of diffs.filter(Boolean)) {
    if (diff.hidden && mayHide.includes(diff.name)) continue;
    if (diff.delta && mayChange.includes(diff.name)) continue;
    violations.push(diff);
    let detail = `Δx ${fmt(diff.delta?.x ?? 0)}  Δy ${fmt(diff.delta?.y ?? 0)}  Δw ${fmt(diff.delta?.w ?? 0)}  Δh ${fmt(diff.delta?.h ?? 0)}`;
    if (diff.hidden) detail = "left the DOM";
    else if (diff.appeared) detail = "appeared";
    console.log(`    ✗ ${phase} — ${diff.name}: ${detail}`);
  }
  return violations;
}

function resolveUrl(audit, baseUrl) {
  if (audit.story) return `${baseUrl}/iframe.html?id=${audit.story}&viewMode=story`;
  if (!audit.url) throw new Error("audit needs `url` or `story`");
  return /^https?:/.test(audit.url) ? audit.url : `${baseUrl}${audit.url.startsWith("/") ? "" : "/"}${audit.url}`;
}

function resolveFrameChecks(audit, registry) {
  const fc = audit.frameChecks ?? registry.frameChecks ?? [];
  return typeof fc === "string" ? PRESETS[fc] ?? [] : fc;
}

export async function runAudit(name, audit, baseUrl, registry = {}) {
  const url = resolveUrl(audit, baseUrl);
  console.log(`\n━━ ${name} (${url})`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: audit.viewport ?? { width: 480, height: 950 } });
  page.setDefaultTimeout(audit.timeout ?? 8000);
  await page.goto(url, { waitUntil: "networkidle" });
  // Kill transitions/animations: we measure settled layout per state, not animation frames.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  await page.waitForTimeout(400);

  let failures = 0;
  const baseline = await measureAnchors(page, audit.anchors);
  const ctx = {
    frameBorderTop: baseline.frame
      ? await page.locator(audit.anchors.frame).first().evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopWidth))
      : 0,
  };
  for (const [anchorName, box] of Object.entries(baseline)) {
    if (!box) console.log(`    ⚠ anchor "${anchorName}" not found at baseline`);
  }

  const frameChecks = resolveFrameChecks(audit, registry);
  if (frameChecks.length) {
    console.log("  frame integrity:");
    for (const check of frameChecks) {
      const value = check.measure(baseline, ctx);
      if (value === null) { console.log(`    ⚠ ${check.name}: anchors missing, skipped`); continue; }
      if (check.ok(value)) console.log(`    ✓ ${check.name}`);
      else { console.log(`    ✗ ${check.name}: ${check.describe(value)}`); failures += 1; }
    }
  }

  for (const action of audit.actions) {
    console.log(`  action: ${action.name}`);
    await action.perform(page);
    await page.waitForTimeout(250);
    const during = await measureAnchors(page, audit.anchors);
    const duringViolations = reportDiffs(
      Object.keys(audit.anchors).map((a) => diffBoxes(a, baseline[a], during[a])), action, "during");

    await action.restore(page);
    await page.waitForTimeout(250);
    const after = await measureAnchors(page, audit.anchors);
    // After restore NOTHING is exempt — the screen must return exactly to baseline, or state has leaked.
    const afterViolations = reportDiffs(
      Object.keys(audit.anchors).map((a) => diffBoxes(a, baseline[a], after[a])), {}, "after restore");

    failures += duringViolations.length + afterViolations.length;
    if (!duringViolations.length && !afterViolations.length) console.log("    ✓ stable");
  }

  await browser.close();
  return failures;
}

// ─── CLI ───────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
  const configPath = resolve(opt("--config", "layout-audits.mjs"));
  const baseUrl = opt("--base-url", "http://localhost:6006").replace(/\/$/, "");
  const names = args.filter((a, i) => !a.startsWith("--") && !["--config", "--base-url"].includes(args[i - 1]));

  const registry = (await import(pathToFileURL(configPath).href)).default;
  const audits = registry.audits ?? registry;
  const selected = names.length ? names : Object.keys(audits);

  let total = 0;
  for (const auditName of selected) {
    const audit = audits[auditName];
    if (!audit) { console.error(`Unknown audit "${auditName}". Known: ${Object.keys(audits).join(", ")}`); process.exit(2); }
    try {
      total += await runAudit(auditName, audit, baseUrl, registry);
    } catch (err) {
      // One broken audit (stale selector, story renamed, action timed out) must not
      // hide the results of the others — count it as a failure and move on.
      console.log(`    ✗ audit aborted — ${err.message.split("\n")[0]}`);
      total += 1;
    }
  }
  console.log(`\n${total === 0 ? "✓ no layout-stability violations" : `✗ ${total} violation(s)`}`);
  process.exit(total === 0 ? 0 : 1);
}
