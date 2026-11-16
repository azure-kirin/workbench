import type { Finding } from "./config.js";

export interface LinkRef {
  /** Route the link was found on. */
  from: string;
  /** The href exactly as authored. */
  raw: string;
  /** Path of the target, without the fragment. */
  path: string;
  /** Fragment without the `#`, or null. */
  hash: string | null;
}

export type Classified =
  | ({ kind: "internal" } & Omit<LinkRef, "from">)
  | { kind: "external"; raw: string }
  | { kind: "ignored"; raw: string };

const NON_NAVIGATING = /^(mailto|tel|sms|javascript|data|blob|about):/i;

/**
 * Sorts one href into "we are responsible for this", "someone else's server"
 * and "not a document link at all".
 *
 * `#` and `#top` are excluded on purpose: both are defined by the browser as
 * the top of the document and neither needs a matching element.
 */
export function classifyHref(
  href: string | null,
  fromPath: string,
  origin: string,
): Classified {
  const raw = (href ?? "").trim();
  if (!raw || raw === "#" || raw.toLowerCase() === "#top")
    return { kind: "ignored", raw };
  if (NON_NAVIGATING.test(raw)) return { kind: "ignored", raw };

  let url: URL;
  try {
    url = new URL(raw, origin + fromPath);
  } catch {
    return { kind: "ignored", raw };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { kind: "ignored", raw };
  if (url.origin !== new URL(origin).origin) return { kind: "external", raw };

  return {
    kind: "internal",
    raw,
    path: url.pathname + url.search,
    hash: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
  };
}

export interface KnownPage {
  /** null when the page was never requested. */
  status: number | null;
  /** Present only for pages that were rendered, not merely fetched. */
  ids?: string[];
}

export interface LinkReport {
  findings: Finding[];
  /** Anchors pointing into a page nobody rendered, so nobody could check. */
  unverifiedAnchors: number;
  checked: number;
}

/**
 * Turns a set of collected links plus what is known about each target into
 * findings. Pure: the fetching happened elsewhere.
 */
export function findLinkProblems(
  refs: LinkRef[],
  pages: Map<string, KnownPage>,
): LinkReport {
  const badTarget = new Map<string, { status: number | null; from: Set<string> }>();
  const deadAnchor = new Map<string, { from: Set<string> }>();
  let unverifiedAnchors = 0;

  for (const ref of refs) {
    const page = pages.get(ref.path);
    if (!page || page.status === null) continue;

    if (page.status !== 200) {
      const entry = badTarget.get(ref.path) ?? {
        status: page.status,
        from: new Set<string>(),
      };
      entry.from.add(ref.from);
      badTarget.set(ref.path, entry);
      continue;
    }

    if (!ref.hash) continue;
    if (!page.ids) {
      unverifiedAnchors++;
      continue;
    }
    if (page.ids.includes(ref.hash)) continue;
    const key = `${ref.path}#${ref.hash}`;
    const entry = deadAnchor.get(key) ?? { from: new Set<string>() };
    entry.from.add(ref.from);
    deadAnchor.set(key, entry);
  }

  const findings: Finding[] = [];
  for (const [path, entry] of badTarget) {
    findings.push({
      check: "links",
      where: path,
      message: `HTTP ${entry.status}`,
      count: entry.from.size,
      detail: [`linked from ${listSources(entry.from)}`],
    });
  }
  for (const [key, entry] of deadAnchor) {
    findings.push({
      check: "links",
      where: key,
      message: "no element with that id on the target page",
      count: entry.from.size,
      detail: [`linked from ${listSources(entry.from)}`],
    });
  }

  return { findings, unverifiedAnchors, checked: refs.length };
}

function listSources(from: Set<string>): string {
  const all = [...from];
  const shown = all.slice(0, 3).join(", ");
  return all.length > 3 ? `${shown} (+${all.length - 3} more)` : shown;
}
