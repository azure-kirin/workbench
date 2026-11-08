/**
 * A Vite plugin for Storybook: outside a Vitest run, every `play` is cut from
 * the story files before anything compiles them, so the interactive
 * Storybook, a static build and anything published from it never run a play
 * when a person opens a story. Vitest (`@storybook/addon-vitest`) runs in mode
 * `"test"` and keeps them.
 */
import MagicString from "magic-string";
import type { ConfigEnv, Plugin } from "vite";
import { analysePlays, type UncutPlay } from "./strip.js";

export { analysePlays, applyCuts, stripPlays } from "./strip.js";
export type { Analysis, Cut, StripResult, UncutPlay } from "./strip.js";

export interface TestOnlyPlaysOptions {
  /**
   * Which modules are story files. Default: `*.stories.{js,jsx,ts,tsx,mjs,mts,cjs,cts}`.
   * The query string (`?v=…`) is removed before the test.
   */
  include?: RegExp | ((file: string) => boolean);
  /**
   * When plays stay in. Default: `({ mode }) => mode === "test"`, which is
   * how Vitest — and so `@storybook/addon-vitest` — starts Vite.
   */
  keepPlays?: (env: ConfigEnv) => boolean;
  /**
   * What to do with a play the transform found but could not cut (`A.play =
   * …`, a story built by a factory). Default `"error"`: the build stops and
   * names the line, because the alternative is a play that runs on every
   * open while the config says it does not.
   */
  onUncut?: "error" | "warn" | "ignore";
}

const DEFAULT_INCLUDE = /\.stories\.[cm]?[jt]sx?$/;

export function formatUncut(file: string, uncut: readonly UncutPlay[]): string {
  const lines = uncut.map(({ line, column, reason }) => `  ${file}:${line}:${column} — ${reason}`);
  return [
    `test-only-plays: ${uncut.length === 1 ? "a play" : `${uncut.length} plays`} it cannot cut:`,
    ...lines,
    "Write the play on the exported story object itself (`export const A = { play }`), or set `onUncut`.",
  ].join("\n");
}

export function testOnlyPlays(options: TestOnlyPlaysOptions = {}): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE;
  const isStoryFile = typeof include === "function" ? include : (file: string) => include.test(file);
  const keepPlays = options.keepPlays ?? (({ mode }: ConfigEnv) => mode === "test");
  const onUncut = options.onUncut ?? "error";

  return {
    name: "test-only-plays",
    // Before the framework's own transforms (Storybook's CSF plugin, React,
    // TypeScript), so the source it reads is the one the author wrote.
    enforce: "pre",
    apply: (_config, env) => !keepPlays(env),
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (file.includes("/node_modules/") || !isStoryFile(file)) return null;
      // Cheap exit: a file that never says "play" has none.
      if (!code.includes("play")) return null;

      const { cuts, uncut } = analysePlays(code, file);
      if (uncut.length > 0 && onUncut !== "ignore") {
        const message = formatUncut(file, uncut);
        if (onUncut === "error") this.error(message);
        else this.warn(message);
      }
      if (cuts.length === 0) return null;

      const output = new MagicString(code);
      for (const { start, end } of cuts) {
        // Keep the cut's line breaks, so the lines after it keep their numbers.
        const breaks = code.slice(start, end).replace(/[^\n]/g, "");
        if (breaks) output.overwrite(start, end, breaks);
        else output.remove(start, end);
      }
      return {
        code: output.toString(),
        map: output.generateMap({ hires: true, source: file, includeContent: true }),
      };
    },
  };
}

export default testOnlyPlays;
