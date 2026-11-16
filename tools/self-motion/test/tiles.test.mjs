import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changedTiles, coversViewport, describeTiles } from "../lib/tiles.mjs";

/** A solid RGBA image. */
const image = (width, height, [r, g, b] = [255, 255, 255]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i);
  return { data, width, height };
};
const paint = (img, x, y, [r, g, b]) => img.data.set([r, g, b, 255], (y * img.width + x) * 4);
const options = { tile: 16, tolerance: 8, masks: [] };

describe("changedTiles", () => {
  it("finds nothing between identical images", () => {
    assert.deepEqual(changedTiles(image(64, 32), image(64, 32), options), []);
  });

  it("names the tile a changed pixel falls in", () => {
    const b = image(64, 32);
    paint(b, 40, 20, [0, 0, 0]);
    assert.deepEqual(changedTiles(image(64, 32), b, options), [[2, 1]]);
  });

  it("counts a tile once, however many of its pixels changed", () => {
    const b = image(64, 32);
    for (let x = 0; x < 16; x++) paint(b, x, 3, [0, 0, 0]);
    assert.deepEqual(changedTiles(image(64, 32), b, options), [[0, 0]]);
  });

  it("treats a channel difference at the tolerance as noise, and one above it as change", () => {
    const at = image(16, 16);
    paint(at, 5, 5, [247, 255, 255]);
    assert.deepEqual(changedTiles(image(16, 16), at, options), []);
    const above = image(16, 16);
    paint(above, 5, 5, [246, 255, 255]);
    assert.deepEqual(changedTiles(image(16, 16), above, options), [[0, 0]]);
  });

  it("ignores alpha: a screenshot is opaque", () => {
    const b = image(16, 16);
    b.data[3] = 0;
    assert.deepEqual(changedTiles(image(16, 16), b, options), []);
  });

  it("excuses a masked zone, with one pixel of margin, and nothing beyond it", () => {
    const b = image(64, 32);
    paint(b, 11, 10, [0, 0, 0]); // one pixel right of the mask's edge: inside the margin
    paint(b, 40, 10, [0, 0, 0]); // outside
    const masks = [[0, 0, 10, 31]];
    assert.deepEqual(changedTiles(image(64, 32), b, { ...options, masks }), [[2, 0]]);
  });

  it("refuses images of different sizes rather than comparing them wrongly", () => {
    assert.throws(() => changedTiles(image(16, 16), image(32, 16), options), /differ in size/);
  });

  it("runs from its own source text, as the runner ships it into the browser", () => {
    const shipped = new Function(`return (${changedTiles.toString()})`)();
    const b = image(32, 32);
    paint(b, 20, 20, [0, 0, 0]);
    assert.deepEqual(shipped(image(32, 32), b, options), [[1, 1]]);
  });
});

describe("describeTiles", () => {
  it("gives the count and the box around them in px", () => {
    assert.equal(describeTiles([[1, 2], [3, 2]], 16), "2 tiles in x 16–64, y 32–48");
  });
});

describe("coversViewport", () => {
  it("is true only for a zone that covers every edge", () => {
    const viewport = { width: 390, height: 844 };
    assert.equal(coversViewport([[-10, -10, 400, 900]], viewport), true);
    assert.equal(coversViewport([[0, 0, 390, 843]], viewport), false);
    assert.equal(coversViewport([], viewport), false);
  });
});
