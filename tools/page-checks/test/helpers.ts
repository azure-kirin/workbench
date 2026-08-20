import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Vitest runs with the package root as cwd; import.meta.url is not a file URL here. */
export function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "test/fixtures", name), "utf8");
}
