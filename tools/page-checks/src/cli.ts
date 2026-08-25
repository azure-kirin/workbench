#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { CHECK_NAMES, type CheckName, type Config } from "./config.js";
import { formatReport } from "./report.js";
import { runChecks } from "./run.js";

const USAGE = `
page-checks <base-url> [options]

  <base-url>              origin of a running build, e.g. http://localhost:3000

  --routes <a,b,c>        paths to check (default "/", plus everything it links to)
  --no-crawl              do not follow internal links out of the given routes
  --max-pages <n>         ceiling on pages rendered (default 50)
  --viewports <w,w,w>     widths in px (default 390,768,1440); the widest is the
                          one contrast and links are collected at
  --only <checks>         run only these: ${CHECK_NAMES.join(", ")}
  --skip <checks>         run everything except these
  --level AA|AAA          contrast threshold (default AA)
  --follow-external       also request off-site links
  --config <file>         a .js/.mjs module default-exporting a Config
  --json                  machine-readable findings on stdout
  --no-colour             plain output

Exits 1 if anything is found.
`;

const BOOLEAN = new Set([
  "no-crawl",
  "json",
  "no-colour",
  "no-color",
  "follow-external",
  "help",
]);

function parse(argv: string[]): { config: Config; json: boolean; colour: boolean; configFile?: string } {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (!BOOLEAN.has(name) && next && !next.startsWith("--")) {
      flags.set(name, next);
      i++;
    } else flags.set(name, true);
  }

  const list = (name: string): string[] | undefined => {
    const value = flags.get(name);
    return typeof value === "string"
      ? value.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
  };

  const checks: Partial<Record<CheckName, boolean>> = {};
  const only = list("only");
  const skip = list("skip");
  if (only) for (const name of CHECK_NAMES) checks[name] = only.includes(name);
  if (skip) for (const name of skip as CheckName[]) checks[name] = false;

  const config: Config = {
    baseUrl: positional[0] ?? "",
    routes: list("routes"),
    crawl: flags.has("no-crawl") ? false : undefined,
    maxPages: typeof flags.get("max-pages") === "string" ? Number(flags.get("max-pages")) : undefined,
    viewports: list("viewports")?.map(Number),
    checks: Object.keys(checks).length ? checks : undefined,
    contrast: flags.get("level") === "AAA" ? { level: "AAA" } : undefined,
    links: flags.has("follow-external") ? { followExternal: true } : undefined,
  };

  return {
    config,
    json: flags.has("json"),
    colour: !flags.has("no-colour") && !flags.has("no-color") && process.stdout.isTTY === true,
    configFile: typeof flags.get("config") === "string" ? (flags.get("config") as string) : undefined,
  };
}

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE.trim());
  process.exit(argv.length ? 0 : 1);
}

const { config, json, colour, configFile } = parse(argv);

let merged: Config = config;
if (configFile) {
  const module = await import(pathToFileURL(resolve(configFile)).href);
  const fromFile = (module.default ?? module) as Config;
  merged = { ...fromFile, ...pruneUndefined(config) };
}
if (!merged.baseUrl) {
  console.error("page-checks: a base URL is required. See --help.");
  process.exit(1);
}

const report = await runChecks(merged);
if (json) console.log(JSON.stringify(report, null, 2));
else process.stdout.write(formatReport(report, colour));
process.exit(report.ok ? 0 : 1);

function pruneUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
