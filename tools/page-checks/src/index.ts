export { runChecks, filterConsole, type Report } from "./run.js";
export { formatReport } from "./report.js";
export {
  resolveConfig,
  CHECK_NAMES,
  type Config,
  type ResolvedConfig,
  type CheckName,
  type Finding,
  type GlueOptions,
  type ContrastOptions,
  type ConsoleOptions,
  type LinkOptions,
} from "./config.js";
export { findGluedBoundaries, type GlueHit } from "./glue.js";
export {
  analyseSamples,
  contrastRatio,
  relativeLuminance,
  requiredRatio,
  composite,
  flattenBackground,
  parseColor,
  formatColor,
  type Rgba,
  type TextSample,
  type ContrastFinding,
  type ContrastResult,
} from "./contrast.js";
export {
  classifyHref,
  findLinkProblems,
  type Classified,
  type LinkRef,
  type KnownPage,
  type LinkReport,
} from "./links.js";
export {
  probeLinkGraph,
  probeScrollThrough,
  probeScrollableOverflow,
  probeTextSamples,
} from "./probes.js";
