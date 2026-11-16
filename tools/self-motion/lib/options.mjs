/**
 * Options: the command line, an optional config module, and the defaults,
 * merged in that order of precedence. Pure apart from `loadConfig`.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_CONFIG_FILE = "self-motion.config.mjs";

/**
 * Without a name attribute, the boxes watched are the story's own root and
 * the two levels under it, whatever the story mounted straight into <body>
 * (a portal, a toast region), and the landmarks and media anywhere on the page.
 */
export const DEFAULT_BOXES =
  "#storybook-root, #storybook-root > *, #storybook-root > * > *, " +
  "body > :not(script, style, link, template, noscript), " +
  "header, nav, main, aside, footer, dialog, img, video, iframe, " +
  '[role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], ' +
  '[role="region"], [role="dialog"], [role="alertdialog"], [role="status"], [role="alert"], [role="log"]';

export const DEFAULTS = {
  baseUrl: "http://localhost:6006",
  viewports: {
    desktop: { width: 1280, height: 900 },
    phone: { width: 390, height: 844 },
  },
  /** Which of `viewports` to run; null = all of them. */
  only: null,
  /** How long the page is watched, ms. */
  watch: 3000,
  /** Screenshots taken across the watch (the first at its start, the last at its end). */
  shots: 3,
  /** Tile size for the pixel comparison, px. */
  tile: 16,
  /** A colour channel difference at or below this is noise. */
  pixelTolerance: 8,
  /** Box changes below this are rounding, px. */
  boxTolerance: 0.5,
  /** Stories watched at once. */
  concurrency: 4,
  /** How long a story may take to finish rendering, ms. */
  renderTimeout: 30_000,
  /** Index tags: a story is watched when it has every `include` tag and no `exclude` tag. */
  tags: { include: ["dev"], exclude: [] },
  /** Story ids (or globs) never opened. */
  exclude: [],
  /** Story ids (or globs) that loop on purpose → why. Scroll and focus are still checked. */
  looping: {},
  /** Selectors for designed motion that is not a CSS animation: masked from boxes and pixels. */
  mask: [],
  /** The boxes watched, and the attribute that names them (null: tag, id and role). */
  boxes: { selector: DEFAULT_BOXES, name: null },
  /** A play left in the build is a finding unless this is true. */
  allowPlays: false,
  /** A fresh browser context per story: an empty cache, so every story loads its fonts and images afresh. */
  cold: false,
  /** Write the report as JSON here. */
  json: null,
  /** Serve this built Storybook instead of using `baseUrl`. */
  static: null,
  /** Story ids (or globs) to watch; empty = every story the index lists. */
  stories: [],
};

const VALUE_FLAGS = new Set([
  "--config",
  "--base-url",
  "--static",
  "--viewport",
  "--json",
  "--concurrency",
  "--watch",
  "--mask",
  "--loop",
  "--exclude",
  "--boxes",
  "--box-name",
]);
const BOOLEAN_FLAGS = new Set(["--allow-plays", "--cold", "--help"]);

/** The command line, as given: flags it knows, positionals as story ids. Throws on anything else. */
export function parseArgs(argv) {
  const parsed = { mask: [], loop: [], exclude: [], stories: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      parsed.stories.push(arg);
      continue;
    }
    const [flag, inline] = arg.split(/=(.*)/s, 2);
    if (BOOLEAN_FLAGS.has(flag)) {
      parsed[camel(flag)] = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) throw new Error(`unknown option ${flag}`);
    const value = inline ?? argv[++i];
    if (value === undefined || (inline === undefined && value.startsWith("--")))
      throw new Error(`${flag} needs a value`);
    if (flag === "--mask") parsed.mask.push(value);
    else if (flag === "--loop") parsed.loop.push(value);
    else if (flag === "--exclude") parsed.exclude.push(value);
    else parsed[camel(flag)] = value;
  }
  return parsed;
}

const camel = (flag) => flag.slice(2).replace(/-(.)/g, (_, c) => c.toUpperCase());

/** `1024x768` → a viewport; anything else → null. */
export function parseSize(text) {
  const match = /^(\d+)\s*[x×]\s*(\d+)$/.exec(text.trim());
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/**
 * The viewports to run: names from `viewports`, `both`/`all` for every one,
 * or a size (`1024x768`), comma-separated.
 */
export function selectViewports(spec, viewports) {
  if (!spec || spec === "both" || spec === "all") return Object.entries(viewports);
  return spec
    .split(",")
    .filter(Boolean)
    .map((part) => {
      if (viewports[part]) return [part, viewports[part]];
      const size = parseSize(part);
      if (size) return [`${size.width}x${size.height}`, size];
      throw new Error(`unknown viewport "${part}" (${[...Object.keys(viewports), "all", "<w>x<h>"].join(", ")})`);
    });
}

/** A story id pattern: exact, or with `*` matching any run of characters. */
export function matcher(patterns) {
  const tests = patterns.map((pattern) => {
    if (!pattern.includes("*")) return (id) => id === pattern;
    const source = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    const regex = new RegExp(`^${source}$`);
    return (id) => regex.test(id);
  });
  return (id) => tests.some((test) => test(id));
}

/** The reason a story loops on purpose, or null. `looping` maps ids or globs to reasons. */
export function loopingReason(id, looping) {
  for (const [pattern, reason] of Object.entries(looping)) if (matcher([pattern])(id)) return reason;
  return null;
}

/**
 * The stories to watch, from a Storybook `index.json` (v4 or v5: `entries`).
 * Docs entries are never watched; neither are `.test()` children, which are
 * tests a person opens on purpose.
 */
export function selectStories(index, { tags, exclude, stories }) {
  const entries = index?.entries;
  if (!entries || typeof entries !== "object") throw new Error("not a Storybook index (no `entries`)");
  const excluded = matcher(exclude);
  const wanted = stories.length > 0 ? matcher(stories) : () => true;
  return Object.values(entries)
    .filter((entry) => entry.type === "story" && entry.subtype !== "test")
    .filter((entry) => {
      // Storybook before 8 has no tags in the index: every story counts.
      if (!Array.isArray(entry.tags)) return true;
      return tags.include.every((tag) => entry.tags.includes(tag)) && !tags.exclude.some((tag) => entry.tags.includes(tag));
    })
    .map((entry) => entry.id)
    .filter((id) => !excluded(id) && wanted(id));
}

/** Imports the config module: the one named, or `self-motion.config.mjs` in `cwd` if there is one. */
export async function loadConfig(path, cwd = process.cwd()) {
  const file = resolve(cwd, path ?? DEFAULT_CONFIG_FILE);
  if (!existsSync(file)) {
    if (path) throw new Error(`config not found: ${file}`);
    return { config: {}, file: null };
  }
  const module = await import(pathToFileURL(file).href);
  return { config: module.default ?? {}, file };
}

/** Defaults ← config ← command line. */
export function resolveOptions(config, args) {
  const options = {
    ...DEFAULTS,
    ...config,
    viewports: config.viewports ?? DEFAULTS.viewports,
    tags: { ...DEFAULTS.tags, ...config.tags },
    boxes: { ...DEFAULTS.boxes, ...config.boxes },
    looping: { ...config.looping },
    mask: [...(config.mask ?? [])],
    exclude: [...(config.exclude ?? [])],
    stories: [...(config.stories ?? [])],
  };
  if (args.baseUrl) options.baseUrl = args.baseUrl;
  if (args.static) options.static = args.static;
  if (args.viewport) options.only = args.viewport;
  if (args.json) options.json = args.json;
  if (args.concurrency) options.concurrency = positive("--concurrency", args.concurrency);
  if (args.watch) options.watch = positive("--watch", args.watch);
  if (args.boxes) options.boxes = { ...options.boxes, selector: args.boxes };
  if (args.boxName) options.boxes = { ...options.boxes, name: args.boxName };
  if (args.allowPlays) options.allowPlays = true;
  if (args.cold) options.cold = true;
  options.mask.push(...args.mask);
  options.exclude.push(...args.exclude);
  for (const id of args.loop) options.looping[id] ??= "named with --loop";
  if (args.stories.length > 0) options.stories = args.stories;
  options.baseUrl = options.baseUrl.replace(/\/$/, "");
  if (options.shots < 2) throw new Error("shots must be at least 2: one screenshot compares with nothing");
  return options;
}

function positive(flag, value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${flag} must be a positive number`);
  return number;
}
