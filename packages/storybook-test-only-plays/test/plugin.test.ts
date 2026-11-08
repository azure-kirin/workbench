import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it, vi } from "vitest";
// The built package, as a consumer gets it (`npm test` builds first).
import testOnlyPlays, { formatUncut } from "../dist/index.js";

const fixtures = join(import.meta.dirname, "fixtures");
const fixture = (name: string) => readFileSync(join(fixtures, name), "utf8");

type Transform = (code: string, id: string) => { code: string; map: unknown } | null;
function transformOf(plugin = testOnlyPlays()) {
  const context = { error: vi.fn((message: string) => { throw new Error(message); }), warn: vi.fn() };
  const transform = (code: string, id: string) =>
    (plugin.transform as unknown as Transform).call(context, code, id);
  return { transform, context };
}

describe("when the plugin applies", () => {
  const apply = testOnlyPlays().apply as (config: object, env: object) => boolean;

  it("stays out of Vitest, which starts Vite in mode 'test'", () => {
    expect(apply({}, { mode: "test", command: "serve" })).toBe(false);
  });

  it("applies to `storybook dev` and `storybook build`", () => {
    expect(apply({}, { mode: "development", command: "serve" })).toBe(true);
    expect(apply({}, { mode: "production", command: "build" })).toBe(true);
  });

  it("takes its own rule for keeping plays", () => {
    const custom = testOnlyPlays({ keepPlays: ({ mode }) => mode === "chromatic" }).apply as typeof apply;
    expect(custom({}, { mode: "chromatic", command: "build" })).toBe(false);
    expect(custom({}, { mode: "test", command: "serve" })).toBe(true);
  });
});

describe("transform", () => {
  it("cuts plays from story files, with a source map", () => {
    const { transform } = transformOf();
    const result = transform(fixture("csf3.stories.tsx"), "/src/csf3.stories.tsx?v=1");
    expect(result?.code).not.toContain("MARKER_ARROW");
    expect(result?.map).toMatchObject({ sources: ["/src/csf3.stories.tsx"] });
  });

  it("leaves other modules, and story files under node_modules, untouched", () => {
    const { transform } = transformOf();
    const code = "export const A = { play: async () => {} };";
    expect(transform(code, "/src/button.tsx")).toBeNull();
    expect(transform(code, "/node_modules/lib/a.stories.js")).toBeNull();
    expect(transform("export const A = {};", "/src/a.stories.ts")).toBeNull();
  });

  it("stops the build on a play it cannot cut, naming the line", () => {
    const { transform } = transformOf();
    expect(() => transform(fixture("uncut.stories.tsx"), "/src/uncut.stories.tsx")).toThrow(
      /uncut\.stories\.tsx:9:1 — a play assigned after the story/,
    );
  });

  it("warns instead when asked, and still cuts what it can", () => {
    const { transform, context } = transformOf(testOnlyPlays({ onUncut: "warn" }));
    const source = "export const A = { play: f };\nA.play = g;";
    const result = transform(source, "/src/a.stories.ts");
    expect(context.warn).toHaveBeenCalledOnce();
    expect(result?.code).toBe("export const A = {  };\nA.play = g;");
  });

  it("takes its own story-file test", () => {
    const { transform } = transformOf(testOnlyPlays({ include: (file) => file.endsWith(".story.ts") }));
    expect(transform("export const A = { play: f };", "/src/a.story.ts")?.code).toBe(
      "export const A = {  };",
    );
    expect(transform("export const A = { play: f };", "/src/a.stories.ts")).toBeNull();
  });

  it("formats what it could not cut, one line each", () => {
    expect(formatUncut("a.stories.ts", [{ line: 2, column: 1, reason: "why" }])).toContain(
      "  a.stories.ts:2:1 — why",
    );
  });
});

describe("through a real Vite build", () => {
  async function bundle(mode: string): Promise<string> {
    const output = (await build({
      configFile: false,
      root: fixtures,
      logLevel: "silent",
      mode,
      plugins: [testOnlyPlays()],
      build: {
        write: false,
        minify: false,
        lib: { entry: join(fixtures, "csf3.stories.tsx"), formats: ["es"], fileName: "out" },
        rollupOptions: { external: (id) => !id.startsWith(".") && !id.startsWith("/") || id.includes("player") },
      },
    })) as Rollup.RollupOutput[] | Rollup.RollupOutput;
    const [first] = Array.isArray(output) ? output : [output];
    return first!.output.map((chunk) => ("code" in chunk ? chunk.code : "")).join("\n");
  }

  it("ships no play in a production build", async () => {
    const code = await bundle("production");
    expect(code).not.toContain("MARKER_ARROW");
    expect(code).not.toContain("MARKER_PRESS_PLAY");
    expect(code).toContain("clip.mp4");
  });

  it("keeps every play in mode 'test'", async () => {
    const code = await bundle("test");
    expect(code).toContain("MARKER_ARROW");
    expect(code).toContain("MARKER_PRESS_PLAY");
  });
});
