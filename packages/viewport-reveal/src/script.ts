import { revealEngine, type RevealEngineOptions } from "./engine.js";

/**
 * The engine, as a string you can put inside a `<script>` tag.
 *
 * This is the primary delivery mode, and it is a string rather than a
 * module URL for one reason: the class that gates the hidden state has to
 * be on `<html>` before the first `[data-reveal]` element paints. A
 * `<script src>` — even one without `defer` — is a network round trip; a
 * `type="module"` script is deferred by definition. Either would let the
 * page paint its content, then hide it, then animate it back: a flash, on
 * every load, for every reader.
 *
 * An inline classic script placed at the top of `<body>` is the only
 * mechanism the platform offers that is guaranteed to run at that point, so
 * that is what this returns.
 *
 * The source is produced by stringifying `revealEngine` rather than by
 * keeping a second hand-minified copy, so there is exactly one
 * implementation to read, review, and test.
 */
export function revealScriptSource(options: RevealEngineOptions = {}): string {
  return `(${revealEngine.toString()})(${JSON.stringify(options)});`;
}
