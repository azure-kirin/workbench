/**
 * Prints the contrast table for the three sets and the trio harmony numbers;
 * exits non-zero if a required check fails ("Extras" is informational).
 *
 *   node --experimental-strip-types sandbox/palette-lab/check.ts [--verbose]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkSet, GROUPS, readDeclarations, summarise } from "./contrast.ts";
import { trioHarmony } from "./harmony.ts";
import { SETS } from "./sets.ts";

const css = readFileSync(resolve(import.meta.dirname, "../../src/globals.css"), "utf8");
const declared = readDeclarations(css);
const verbose = process.argv.includes("--verbose");

const pad = (s: string, n: number) => s.padEnd(n);
const header = ["Set", ...GROUPS.map((g) => `${g.title} (≥${g.min})`)];
const widths = [8, ...GROUPS.map((g) => Math.max(g.title.length + 7, 12))];
console.log(header.map((h, i) => pad(h, widths[i] as number)).join(" │ "));
console.log(widths.map((w) => "─".repeat(w)).join("─┼─"));

let failed = false;
for (const set of SETS) {
  const checks = checkSet(set, declared);
  const cells = summarise(checks).map(({ group, worst, pass }) => {
    if (!pass && group !== "extra") failed = true;
    return `${pass ? "✓" : "✗"} ${worst.ratio.toFixed(2)}`;
  });
  console.log(
    [set.name, ...cells].map((c, i) => pad(c, widths[i] as number)).join(" │ "),
  );
  if (verbose)
    for (const c of checks)
      if (c.ratio < c.min || process.argv.includes("--all"))
        console.log(
          `    ${c.ratio < c.min ? "✗" : " "} ${c.ratio.toFixed(2)}  ${c.label}`,
        );
}

console.log("\nTrio harmony");
for (const set of SETS) {
  const h = trioHarmony(set);
  console.log(
    `  ${pad(set.name, 8)} span ${h.span}° · worst mid-mix keeps ${h.worstRetention}% chroma · ${h.pairs.map((p) => `${p.label} ${p.retention}%`).join(", ")}`,
  );
}
process.exit(failed ? 1 : 0);
