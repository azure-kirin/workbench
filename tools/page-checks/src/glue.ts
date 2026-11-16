import type { GlueOptions } from "./config.js";

/**
 * Whitespace swallowed at an inline-element boundary.
 *
 * A template that wraps a line between a word and an inline tag can lose the
 * space between them. In JSX this is the rule rather than an accident: a
 * newline plus indentation next to a tag is not significant whitespace, so
 * a formatter reflowing one long line silently glues two words together.
 * The same thing happens in any template language with a formatter — the
 * check reads the built HTML, so it does not care which one produced it.
 */
export interface GlueHit {
  /** The matched boundary, e.g. `</em>t` — six characters, no more. */
  text: string;
  /** Byte offset into the HTML that was scanned. */
  index: number;
  /** 1-based line number. */
  line: number;
  /** Whitespace-collapsed surroundings, for reading the sentence back. */
  context: string;
}

const DEFAULT_TAGS = ["em", "strong", "code"];

/**
 * Scripts write escaped markup into the document (serialised framework
 * payloads, JSON-LD, inline data) and none of it is prose. Blank it out but
 * keep the length, so every reported offset still points at the right place
 * in the caller's string.
 */
function blankNonProse(html: string): string {
  return html.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (m) => " ".repeat(m.length),
  );
}

/**
 * Scripts that do not separate words with spaces glue legitimately, so a
 * letter in one of them is never evidence of a missing space.
 */
const NO_SPACE_SCRIPTS =
  "\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}\\p{sc=Hangul}\\p{sc=Thai}\\p{sc=Lao}\\p{sc=Khmer}";

/**
 * Letters, and the punctuation that is always preceded by a space in prose.
 * Deliberately excludes `'` and `’` (possessives), `.,;:!?)` (never spaced)
 * and `…` (occasionally legitimate after emphasis).
 */
const BOUNDARY_CHAR = `[\\p{L}“”"—–]`;

export function findGluedBoundaries(
  html: string,
  options: GlueOptions = {},
): GlueHit[] {
  const tags = (options.tags ?? DEFAULT_TAGS).map((t) => t.toLowerCase());
  if (tags.length === 0) return [];
  const sides = options.sides ?? "both";
  const allow = options.allow ?? [];
  const alt = tags.join("|");
  const source = blankNonProse(html);

  const patterns = [
    new RegExp(
      `</(?:${alt})>(?![${NO_SPACE_SCRIPTS}])${BOUNDARY_CHAR}`,
      "gu",
    ),
  ];
  if (sides === "both") {
    patterns.push(
      new RegExp(
        `(?<![${NO_SPACE_SCRIPTS}])${BOUNDARY_CHAR}<(?:${alt})(?:\\s[^>]*)?>`,
        "gu",
      ),
    );
  }

  const allowSpans = allow.flatMap((literal) => spansOf(source, literal));
  const hits: GlueHit[] = [];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (allowSpans.some(([from, to]) => index >= from && index < to)) continue;
      hits.push({
        text: match[0],
        index,
        line: countLines(source, index),
        context: contextAround(html, index, match[0].length),
      });
    }
  }

  return hits.sort((a, b) => a.index - b.index);
}

function spansOf(haystack: string, needle: string): [number, number][] {
  if (!needle) return [];
  const out: [number, number][] = [];
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    out.push([from, from + needle.length]);
    from = haystack.indexOf(needle, from + 1);
  }
  return out;
}

function countLines(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function contextAround(html: string, index: number, length: number): string {
  const before = html.slice(Math.max(0, index - 40), index);
  const after = html.slice(index, index + length + 40);
  return `${before}${after}`.replace(/\s+/g, " ").trim();
}
