/**
 * Pixel comparison. `changedTiles` is self-contained on purpose: the runner
 * ships its source into a blank Chromium page, where the screenshots are
 * decoded on a canvas, so the code that runs there is the code tested here.
 * It must not reference anything outside its own body.
 */

/**
 * The tiles in which two images differ, outside `masks`.
 *
 * @param {{ data: ArrayLike<number>, width: number, height: number }} a  RGBA, row-major
 * @param {{ data: ArrayLike<number>, width: number, height: number }} b
 * @param {{ tile: number, tolerance: number, masks: number[][] }} options
 *   `tolerance`: a channel difference at or below it is noise (dithering,
 *   subpixel antialiasing). `masks`: `[left, top, right, bottom]` in px,
 *   excused with one pixel of margin. Alpha is ignored: a screenshot is opaque.
 * @returns {number[][]} `[column, row]` of each changed tile, in scan order
 */
export function changedTiles(a, b, { tile, tolerance, masks }) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`images differ in size: ${a.width}×${a.height} and ${b.width}×${b.height}`);
  }
  const tiles = new Map();
  const width = a.width;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) <= tolerance &&
      Math.abs(a.data[i + 1] - b.data[i + 1]) <= tolerance &&
      Math.abs(a.data[i + 2] - b.data[i + 2]) <= tolerance
    )
      continue;
    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    let masked = false;
    for (const [left, top, right, bottom] of masks) {
      if (x >= left - 1 && x <= right + 1 && y >= top - 1 && y <= bottom + 1) {
        masked = true;
        break;
      }
    }
    if (masked) continue;
    const column = Math.floor(x / tile);
    const row = Math.floor(y / tile);
    const key = `${column},${row}`;
    if (!tiles.has(key)) tiles.set(key, [column, row]);
  }
  return [...tiles.values()];
}

/** One line for a set of changed tiles: how many, and the box around them in px. */
export function describeTiles(tiles, tile) {
  const xs = tiles.map(([column]) => column * tile);
  const ys = tiles.map(([, row]) => row * tile);
  return `${tiles.length} tiles in x ${Math.min(...xs)}–${Math.max(...xs) + tile}, y ${Math.min(...ys)}–${Math.max(...ys) + tile}`;
}

/** Whether one of `rects` covers the whole viewport (nothing left to compare). */
export function coversViewport(rects, { width, height }) {
  return rects.some(([left, top, right, bottom]) => left <= 0 && top <= 0 && right >= width && bottom >= height);
}
