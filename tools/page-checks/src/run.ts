import type { BrowserContext, ConsoleMessage } from "playwright";
import {
  resolveConfig,
  type CheckName,
  type Config,
  type Finding,
} from "./config.js";
import { findGluedBoundaries } from "./glue.js";
import { analyseSamples, type TextSample } from "./contrast.js";
import {
  classifyHref,
  findLinkProblems,
  type KnownPage,
  type LinkRef,
} from "./links.js";
import {
  probeLinkGraph,
  probeScrollThrough,
  probeScrollableOverflow,
  probeTextSamples,
} from "./probes.js";

export interface Report {
  ok: boolean;
  findings: Finding[];
  /** One reassuring line per check that passed, in the same order as the checks. */
  notes: { check: CheckName; message: string }[];
  pagesRendered: number;
  baseUrl: string;
}

const NON_DOCUMENT = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|zip|txt|xml|json|css|js|mp4|webm|woff2?)$/i;

export async function runChecks(config: Config): Promise<Report> {
  const resolved = resolveConfig(config);
  const { chromium } = await importPlaywright();

  const findings: Finding[] = [];
  const notes: Report["notes"] = [];
  const viewports = [...resolved.viewports].sort((a, b) => a - b);
  const primary = viewports[viewports.length - 1];

  const browser = await chromium.launch();
  const contexts = new Map<number, BrowserContext>();
  for (const width of viewports)
    contexts.set(width, await browser.newContext({ viewport: { width, height: 900 } }));

  const pages = new Map<string, KnownPage>();
  const samples: (TextSample & { route: string })[] = [];
  const linkRefs: LinkRef[] = [];
  const documents: { route: string; html: string }[] = [];
  const externals = new Set<string>();
  const consoleGroups = new Map<string, Set<string>>();

  const queue = [...resolved.routes];
  const queued = new Set(queue);
  let rendered = 0;

  try {
    while (queue.length && rendered < resolved.maxPages) {
      const route = queue.shift()!;
      rendered++;
      const state: KnownPage = { status: null };
      pages.set(route, state);

      for (const width of viewports) {
        const context = contexts.get(width)!;
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        page.on("console", (m: ConsoleMessage) => {
          if (m.type() !== "error") return;
          // "Failed to load resource: 404" without the URL is unactionable,
          // and the URL is only ever on the location, never in the text.
          const at = m.location()?.url;
          consoleErrors.push(at ? `${m.text()} — ${at}` : m.text());
        });
        page.on("pageerror", (e: Error) => consoleErrors.push(`pageerror: ${e.message}`));

        try {
          const response = await page.goto(resolved.baseUrl + route, {
            waitUntil: "load",
            timeout: 45_000,
          });
          const status = response ? response.status() : 0;
          if (width === primary) {
            state.status = status;
            if (resolved.checks.glue && response) {
              try {
                documents.push({ route, html: await response.text() });
              } catch {
                /* a redirected or streamed response has no readable body */
              }
            }
          }
          if (status !== 200) {
            if (width === primary && resolved.routes.includes(route))
              findings.push({
                check: "links",
                where: route,
                message: `HTTP `,
              });
            await page.close();
            continue;
          }

          await page.waitForTimeout(resolved.settleMs);
          await page.evaluate(probeScrollThrough);

          if (resolved.checks.overflow) {
            const overflow = await page.evaluate(probeScrollableOverflow);
            // One pixel is a rounding artefact on fractional viewport widths.
            if (overflow > 1)
              findings.push({
                check: "overflow",
                where: `${route} @${width}`,
                message: `${overflow}px of horizontal scroll`,
              });
          }

          if (width === primary) {
            if (resolved.checks.links || resolved.crawl) {
              const graph = await page.evaluate(probeLinkGraph);
              state.ids = graph.ids;
              for (const href of graph.hrefs) {
                const link = classifyHref(href, route, resolved.baseUrl);
                if (link.kind === "external") externals.add(link.raw);
                if (link.kind !== "internal") continue;
                linkRefs.push({ from: route, raw: link.raw, path: link.path, hash: link.hash });
                if (
                  resolved.crawl &&
                  !queued.has(link.path) &&
                  !NON_DOCUMENT.test(link.path)
                ) {
                  queued.add(link.path);
                  queue.push(link.path);
                }
              }
            }
            if (resolved.checks.contrast) {
              for (const sample of await page.evaluate(probeTextSamples))
                samples.push({ ...sample, route });
            }
          }

          if (resolved.checks.console) {
            for (const error of filterConsole(consoleErrors, resolved.console.ignore))
              recordConsole(consoleGroups, error.slice(0, 300), route);
          }
        } catch (error) {
          recordConsole(
            consoleGroups,
            `page could not be loaded — ${(error as Error).message.split("\n")[0]}`,
            `${route} @${width}`,
          );
        } finally {
          await page.close().catch(() => {});
        }
      }
    }

    if (resolved.checks.links) {
      await resolveLinkTargets({
        refs: linkRefs,
        pages,
        context: contexts.get(primary)!,
        baseUrl: resolved.baseUrl,
        budget: Math.max(0, resolved.maxPages - rendered),
        settleMs: resolved.settleMs,
      });
      const report = findLinkProblems(linkRefs, pages);
      findings.push(...report.findings);
      if (resolved.links.followExternal)
        findings.push(...(await checkExternal(externals)));
      notes.push({
        check: "links",
        message:
          `${report.checked} internal links followed` +
          (report.unverifiedAnchors
            ? `, ${report.unverifiedAnchors} anchors into unrendered pages not verified`
            : ""),
      });
    }
  } finally {
    for (const context of contexts.values()) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (resolved.checks.glue) {
    let glued = 0;
    for (const document of documents) {
      for (const hit of findGluedBoundaries(document.html, resolved.glue)) {
        glued++;
        findings.push({
          check: "glue",
          where: `${document.route}:${hit.line}`,
          message: `no space at \`${hit.text}\``,
          detail: [hit.context],
        });
      }
    }
    notes.push({
      check: "glue",
      message: `${documents.length} documents scanned`,
    });
  }

  if (resolved.checks.contrast) {
    const result = analyseSamples(samples, resolved.contrast);
    for (const failure of result.failures)
      findings.push({
        check: "contrast",
        where: `${failure.foreground} on ${failure.background}`,
        message: `${failure.ratio.toFixed(2)}:1, needs ${failure.required}:1`,
        count: failure.count,
        detail: [
          `e.g. ${failure.example.selector} on ${failure.example.route} — "${failure.example.text}"`,
        ],
      });
    notes.push({
      check: "contrast",
      message:
        `${result.examined} text runs, ${result.pairsChecked} distinct colour pairs` +
        (result.undetermined
          ? `, ${result.undetermined} text runs skipped (backdrop not determinable)`
          : ""),
    });
  }

  if (resolved.checks.overflow && !findings.some((f) => f.check === "overflow"))
    notes.push({
      check: "overflow",
      message: `no horizontal scroll at ${viewports.join(" / ")}px`,
    });
  if (resolved.checks.console) {
    for (const [message, routes] of consoleGroups)
      findings.push({
        check: "console",
        where: [...routes][0],
        message,
        count: routes.size,
        detail:
          routes.size > 1
            ? [`also on ${[...routes].slice(1, 4).join(", ")}${routes.size > 4 ? ` (+${routes.size - 4} more)` : ""}`]
            : undefined,
      });
    if (!consoleGroups.size)
      notes.push({ check: "console", message: `no errors on ${rendered} pages` });
  }

  return {
    ok: findings.length === 0,
    findings,
    notes,
    pagesRendered: rendered,
    baseUrl: resolved.baseUrl,
  };
}

async function resolveLinkTargets(input: {
  refs: LinkRef[];
  pages: Map<string, KnownPage>;
  context: BrowserContext;
  baseUrl: string;
  budget: number;
  settleMs: number;
}): Promise<void> {
  const { refs, pages, context, baseUrl } = input;
  let budget = input.budget;
  const wanted = new Map<string, boolean>(); // path -> needs rendering (has an anchor)
  for (const ref of refs) {
    if (pages.has(ref.path)) continue;
    wanted.set(ref.path, (wanted.get(ref.path) ?? false) || ref.hash !== null);
  }

  for (const [path, needsIds] of wanted) {
    // An anchor can only be checked against a page that was actually built,
    // so a fragment target is worth spending a render on.
    if (needsIds && budget > 0 && !NON_DOCUMENT.test(path)) {
      budget--;
      const page = await context.newPage();
      try {
        const response = await page.goto(baseUrl + path, {
          waitUntil: "load",
          timeout: 45_000,
        });
        await page.waitForTimeout(input.settleMs);
        await page.evaluate(probeScrollThrough);
        const graph = await page.evaluate(probeLinkGraph);
        pages.set(path, { status: response ? response.status() : 0, ids: graph.ids });
      } catch {
        pages.set(path, { status: 0 });
      } finally {
        await page.close().catch(() => {});
      }
      continue;
    }
    try {
      const response = await fetch(baseUrl + path, { redirect: "follow" });
      pages.set(path, { status: response.status });
    } catch {
      pages.set(path, { status: 0 });
    }
  }
}

async function checkExternal(urls: Set<string>): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.status >= 400)
        findings.push({ check: "links", where: url, message: `HTTP ${response.status}` });
    } catch (error) {
      findings.push({
        check: "links",
        where: url,
        message: `request failed — ${(error as Error).message}`,
      });
    }
  }
  return findings;
}

function recordConsole(
  groups: Map<string, Set<string>>,
  message: string,
  route: string,
): void {
  const routes = groups.get(message) ?? new Set<string>();
  routes.add(route);
  groups.set(message, routes);
}

export function filterConsole(
  errors: string[],
  ignore: (string | RegExp)[] = [],
): string[] {
  return errors.filter(
    (error) =>
      !ignore.some((pattern) =>
        typeof pattern === "string" ? error.includes(pattern) : pattern.test(error),
      ),
  );
}

async function importPlaywright(): Promise<{ chromium: typeof import("playwright").chromium }> {
  try {
    return (await import("playwright")) as unknown as {
      chromium: typeof import("playwright").chromium;
    };
  } catch {
    throw new Error(
      "page-checks needs playwright. Install it alongside this package:\n" +
        "  npm install --save-dev playwright && npx playwright install chromium",
    );
  }
}
