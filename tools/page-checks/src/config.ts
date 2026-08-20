/** A single thing that is wrong. Every check produces these and nothing else. */
export interface Finding {
  /** Which check produced it. */
  check: CheckName;
  /** Where it is, in whatever terms that check thinks in. */
  where: string;
  /** One line, already readable. */
  message: string;
  /** How many times the same thing occurs; 1 unless the check deduplicates. */
  count?: number;
  /** Extra lines printed indented under the message. */
  detail?: string[];
}

export type CheckName = "glue" | "contrast" | "overflow" | "console" | "links";

export const CHECK_NAMES: CheckName[] = [
  "glue",
  "contrast",
  "overflow",
  "console",
  "links",
];

export interface GlueOptions {
  /**
   * Inline elements whose boundaries are checked. The default set is the
   * prose-emphasis tags — the ones that appear mid-sentence, where a
   * swallowed space is a typo rather than a layout decision.
   */
  tags?: string[];
  /**
   * `"both"` also flags a letter immediately *before* an opening tag, which
   * is the same bug mirrored. `"close"` checks only after the closing tag.
   */
  sides?: "both" | "close";
  /**
   * Literal two-or-more character sequences that are intentional and must not
   * be reported — `"</em>-"` for a hyphenated compound, `"al<em>go</em>"` for
   * intra-word emphasis. Matched against the reported text, not a regex.
   */
  allow?: string[];
}

export interface ContrastOptions {
  /** `"AA"` (default) is 4.5:1, or 3:1 for large text. `"AAA"` is 7:1 / 4.5:1. */
  level?: "AA" | "AAA";
  /** Report pairs that occur at least this many times. Default 1. */
  minOccurrences?: number;
}

export interface ConsoleOptions {
  /**
   * Substrings or regular expressions. A console error matching any of them is
   * ignored — for third-party scripts whose noise you do not control.
   */
  ignore?: (string | RegExp)[];
}

export interface LinkOptions {
  /** Also request off-site links. Off by default: slow, flaky, not your bug. */
  followExternal?: boolean;
}

export interface Config {
  /** Origin of the running site, e.g. `http://localhost:3000`. */
  baseUrl: string;
  /**
   * Paths to check. Defaults to `["/"]`, which with `crawl` on (the default
   * when no routes are given) is enough for a site whose pages link to each
   * other.
   */
  routes?: string[];
  /** Follow internal links out of the given routes. */
  crawl?: boolean;
  /** Hard ceiling on pages visited when crawling. Default 50. */
  maxPages?: number;
  /**
   * Widths, in px, that every page is loaded at. The widest is the one the
   * contrast check runs at. Default `[390, 768, 1440]`.
   */
  viewports?: number[];
  /** Turn individual checks off. All on by default. */
  checks?: Partial<Record<CheckName, boolean>>;
  glue?: GlueOptions;
  contrast?: ContrastOptions;
  console?: ConsoleOptions;
  links?: LinkOptions;
  /** Milliseconds to settle after load before measuring. Default 400. */
  settleMs?: number;
}

export interface ResolvedConfig extends Required<Omit<Config, "checks">> {
  checks: Record<CheckName, boolean>;
}

export function resolveConfig(config: Config): ResolvedConfig {
  if (!config.baseUrl) throw new Error("page-checks: baseUrl is required");
  const routes = config.routes?.length ? config.routes : ["/"];
  const checks = Object.fromEntries(
    CHECK_NAMES.map((n) => [n, config.checks?.[n] !== false]),
  ) as Record<CheckName, boolean>;
  return {
    baseUrl: config.baseUrl.replace(/\/+$/, ""),
    routes: routes.map((r) => (r.startsWith("/") ? r : `/${r}`)),
    crawl: config.crawl ?? !config.routes?.length,
    maxPages: config.maxPages ?? 50,
    viewports: config.viewports?.length ? [...config.viewports] : [390, 768, 1440],
    checks,
    glue: config.glue ?? {},
    contrast: config.contrast ?? {},
    console: config.console ?? {},
    links: config.links ?? {},
    settleMs: config.settleMs ?? 400,
  };
}
