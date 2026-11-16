/**
 * The decisions: what in a watched page counts as moving on its own. Pure,
 * so every rule is tested on recorded samples rather than on a browser.
 */
import { coversViewport, describeTiles } from "./tiles.mjs";

/** A layout shift below this score is rounding, not a shift anyone sees. */
export const SHIFT_THRESHOLD = 0.0001;
/** How many moved boxes are listed by name before the rest are counted. */
const BOXES_LISTED = 6;

/**
 * @typedef {object} Sample   what `sample()` returned at one moment
 * @property {{ node: string, x: number, y: number }[]} scrolled
 * @property {string} active
 * @property {Record<string, number[]>} boxes
 * @property {Record<string, number>} counts
 * @property {number[][]} excused
 * @property {string[]} finite
 * @property {boolean} error
 *
 * @typedef {object} Watch
 * @property {Sample[]} samples        in order; the first is taken once the story has rendered
 * @property {{ shifts: { time: number, value: number, sources: { node: string, from: object, to: object }[] }[],
 *              focus: { time: number, node: string }[] }} recorded   from navigation on
 * @property {number} start            `performance.now()` when the watch began
 * @property {number[][][]} tileDiffs  changed tiles between consecutive screenshots (empty when not compared)
 * @property {{ width: number, height: number }} viewport
 * @property {boolean} hasPlay         the story has a play function in this build
 * @property {string[]} pageErrors
 * @property {string | null} looping   the reason the story loops on purpose, or null
 * @property {{ tile: number, allowPlays: boolean }} options
 */

/**
 * @param {Watch} watch
 * @returns {{ findings: string[], notes: string[] }}
 */
export function judge({ samples, recorded, start, tileDiffs, viewport, hasPlay, pageErrors, looping, options }) {
  const findings = [];
  const notes = [];
  const [first] = samples;
  if (!first) return { findings: ["no sample was taken"], notes };

  if (first.error) findings.push("the story threw (Storybook's error display is up)");
  if (hasPlay && !options.allowPlays)
    findings.push("the story has a play in this build: Storybook runs it on every open");

  // Scroll: nothing scrolls on its own, and nothing is scrolled at load.
  const scrollKey = (s) => JSON.stringify(s.scrolled);
  if (samples.some((s) => scrollKey(s) !== scrollKey(first)))
    findings.push(`scroll changed: ${samples.map(scrollKey).join(" → ")}`);
  else if (first.scrolled.length > 0) findings.push(`scrolled at load: ${scrollKey(first)}`);

  // Focus: nothing holds it at load, nothing takes it while watched.
  if (first.active !== "body" && first.active !== "html") findings.push(`focus on load: ${first.active}`);
  if (samples.some((s) => s.active !== first.active))
    findings.push(`focus moved: ${samples.map((s) => s.active).join(" → ")}`);
  // Focus taken and let go before the first look never painted; focus that
  // lands while the page is watched did.
  for (const event of recorded.focus.filter((focus) => focus.time >= start)) {
    if (!findings.some((finding) => finding.includes(event.node)))
      findings.push(`focus landed at ${Math.round(event.time - start)} ms: ${event.node}`);
  }

  if (looping) {
    notes.push(`pixels, boxes and layout shifts not compared: ${looping}`);
  } else {
    // Layout shifts, any time since navigation: a font swap during first paint counts.
    for (const shift of recorded.shifts) {
      if (shift.value < SHIFT_THRESHOLD) continue;
      const sources = shift.sources
        .map((source) => `${source.node} ${JSON.stringify(source.from)}→${JSON.stringify(source.to)}`)
        .join("; ");
      findings.push(
        `layout shift ${shift.value.toFixed(4)} at ${Math.round(shift.time - start)} ms${sources ? `: ${sources}` : ""}`,
      );
    }

    // Boxes, and how many of each there are.
    for (let i = 1; i < samples.length; i++) {
      const before = samples[i - 1];
      const after = samples[i];
      for (const name of new Set([...Object.keys(before.counts), ...Object.keys(after.counts)])) {
        const from = before.counts[name] ?? 0;
        const to = after.counts[name] ?? 0;
        if (from !== to) findings.push(`[${name}] count ${from} → ${to}`);
      }
      const moved = Object.keys(after.boxes).filter((key) =>
        before.boxes[key]?.some((value, at) => value !== after.boxes[key][at]),
      );
      for (const key of moved.slice(0, BOXES_LISTED))
        findings.push(`[${key}] moved ${JSON.stringify(before.boxes[key])} → ${JSON.stringify(after.boxes[key])}`);
      if (moved.length > BOXES_LISTED) findings.push(`…and ${moved.length - BOXES_LISTED} more boxes`);
    }

    // Finite animations still running after the first look: an entrance replaying, a slow transition.
    for (const animation of new Set(samples.slice(1).flatMap((s) => s.finite)))
      findings.push(`animation running after load: ${animation}`);

    // Pixels.
    if (coversViewport(samples.flatMap((s) => s.excused), viewport))
      notes.push("pixels masked: an excused zone covers the viewport");
    tileDiffs.forEach((tiles, i) => {
      if (tiles.length > 0) findings.push(`pixels changed (shot ${i}→${i + 1}): ${describeTiles(tiles, options.tile)}`);
    });
  }

  for (const error of pageErrors) findings.push(`page error: ${error}`);
  return { findings, notes };
}

/** Every zone excused from the pixels across the samples: masks and loops, wherever they were. */
export function excusedZones(samples) {
  return samples.flatMap((s) => s.excused);
}
