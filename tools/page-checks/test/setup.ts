/*
 * jsdom has no canvas, and its "not implemented" notice is written straight to
 * stderr rather than thrown, so a try/catch in the probe cannot quiet it.
 * Returning null is what a real browser with canvas disabled would do, and the
 * probe's fallback path — leave the colour string as the browser wrote it — is
 * exactly what these tests want to exercise.
 */
HTMLCanvasElement.prototype.getContext = (() => null) as never;
