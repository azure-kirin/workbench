import { CHECK_NAMES, type CheckName, type Finding } from "./config.js";
import type { Report } from "./run.js";

const LABEL: Record<CheckName, string> = {
  glue: "glue    ",
  contrast: "contrast",
  overflow: "overflow",
  console: "console ",
  links: "links   ",
};

const ESC = "\u001b[";

/** One block per check, failures first. Written to be read in a CI log. */
export function formatReport(report: Report, colour: boolean): string {
  const lines: string[] = [];
  const paint = (code: string) => (s: string) =>
    colour ? `${ESC}${code}m${s}${ESC}0m` : s;
  const dim = paint("2");
  const red = paint("31");
  const green = paint("32");

  lines.push("");
  lines.push(
    `page-checks · ${report.baseUrl} · ${report.pagesRendered} page${
      report.pagesRendered === 1 ? "" : "s"
    }`,
  );
  lines.push("");

  for (const check of CHECK_NAMES) {
    const failures = report.findings.filter((f) => f.check === check);
    const note = report.notes.find((n) => n.check === check);
    if (!failures.length && !note) continue;
    if (failures.length) {
      lines.push(`${LABEL[check]} ${red("✗")} ${summarise(check, failures)}`);
      for (const finding of failures) lines.push(...formatFinding(finding, dim));
      if (note) lines.push(dim(`           (${note.message})`));
    } else if (note) {
      lines.push(`${LABEL[check]} ${green("✓")} ${dim(note.message)}`);
    }
  }

  lines.push("");
  lines.push(
    report.ok
      ? green("all checks pass")
      : red(
          `${report.findings.length} finding${
            report.findings.length === 1 ? "" : "s"
          }`,
        ),
  );
  lines.push("");
  return lines.join("\n");
}

function summarise(check: CheckName, failures: Finding[]): string {
  const occurrences = failures.reduce((n, f) => n + (f.count ?? 1), 0);
  switch (check) {
    case "glue":
      return `${failures.length} glued boundar${failures.length === 1 ? "y" : "ies"}`;
    case "contrast":
      return `${failures.length} colour pair${
        failures.length === 1 ? "" : "s"
      } below the threshold, on ${occurrences} text run${
        occurrences === 1 ? "" : "s"
      }`;
    case "overflow":
      return `${failures.length} page/width combination${
        failures.length === 1 ? " scrolls" : "s scroll"
      } sideways`;
    case "console":
      // A count is the pages one error was seen on. Summed over several
      // errors it would count a page once per error, so it is only given
      // for one.
      return failures.length === 1
        ? `1 distinct console error on ${occurrences} page${occurrences === 1 ? "" : "s"}`
        : `${failures.length} distinct console errors`;
    default:
      return `${failures.length} broken link${failures.length === 1 ? "" : "s"}`;
  }
}

function formatFinding(finding: Finding, dim: (s: string) => string): string[] {
  const times = finding.count && finding.count > 1 ? dim(` ×${finding.count}`) : "";
  const lines = [`           ${finding.where} — ${finding.message}${times}`];
  for (const detail of finding.detail ?? [])
    lines.push(dim(`             ${truncate(detail, 140)}`));
  return lines;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
