import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { judge } from "../lib/judge.mjs";

const still = (overrides = {}) => ({
  scrolled: [],
  active: "body",
  boxes: { "main#0": [0, 0, 800, 400], "button#0": [16, 300, 80, 40] },
  counts: { main: 1, button: 1 },
  excused: [],
  finite: [],
  error: false,
  ...overrides,
});
const watch = (overrides = {}) => ({
  samples: [still(), still(), still()],
  recorded: { shifts: [], focus: [] },
  start: 1000,
  tileDiffs: [[], []],
  viewport: { width: 800, height: 600 },
  hasPlay: false,
  pageErrors: [],
  looping: null,
  options: { tile: 16, allowPlays: false },
  ...overrides,
});

describe("judge", () => {
  it("finds nothing on a page that held still", () => {
    assert.deepEqual(judge(watch()), { findings: [], notes: [] });
  });

  it("fails a play left in the build, unless plays are allowed", () => {
    assert.match(judge(watch({ hasPlay: true })).findings[0], /has a play in this build/);
    assert.deepEqual(judge(watch({ hasPlay: true, options: { tile: 16, allowPlays: true } })).findings, []);
  });

  it("fails a page scrolled at load, and one that scrolls while watched", () => {
    const scrolled = [{ node: "window", x: 0, y: 420 }];
    assert.match(
      judge(watch({ samples: [still({ scrolled }), still({ scrolled }), still({ scrolled })] })).findings[0],
      /^scrolled at load/,
    );
    assert.match(
      judge(watch({ samples: [still(), still({ scrolled }), still({ scrolled })] })).findings[0],
      /^scroll changed: \[\] → /,
    );
  });

  it("fails focus held at load, focus that moves, and focus that lands while watched", () => {
    const held = judge(watch({ samples: [still({ active: 'input "Search"' }), still({ active: 'input "Search"' })] }));
    assert.deepEqual(held.findings, ['focus on load: input "Search"']);

    const moved = judge(watch({ samples: [still(), still({ active: 'button "Save"' })] }));
    assert.deepEqual(moved.findings, ['focus moved: body → button "Save"']);
  });

  it("names a focus that landed and was let go while watched, once", () => {
    const recorded = {
      shifts: [],
      focus: [
        { time: 400, node: 'li "First option"' }, // before the watch: never painted
        { time: 1500, node: 'li "Second option"' },
        { time: 1600, node: 'li "Second option"' },
      ],
    };
    assert.deepEqual(judge(watch({ recorded })).findings, ['focus landed at 500 ms: li "Second option"']);
  });

  it("fails layout shifts since navigation, with their sources, and ignores ones too small to see", () => {
    const recorded = {
      focus: [],
      shifts: [
        { time: 200, value: 0.00005, sources: [] },
        {
          time: 300,
          value: 0.0321,
          sources: [{ node: "p", from: { x: 0, y: 40, w: 300, h: 24 }, to: { x: 0, y: 64, w: 300, h: 24 } }],
        },
      ],
    };
    const { findings } = judge(watch({ recorded }));
    assert.equal(findings.length, 1);
    assert.match(findings[0], /^layout shift 0\.0321 at -700 ms: p \{"x":0,"y":40/);
  });

  it("fails a box that moved and an element that appeared", () => {
    const pushed = still({ boxes: { "main#0": [0, 0, 800, 440], "button#0": [16, 340, 80, 40] } });
    const toast = still({ counts: { main: 1, button: 1, "div[role=status]": 1 } });
    const { findings } = judge(watch({ samples: [still(), pushed, pushed] }));
    assert.deepEqual(findings, ["[main#0] moved [0,0,800,400] → [0,0,800,440]", "[button#0] moved [16,300,80,40] → [16,340,80,40]"]);
    assert.deepEqual(judge(watch({ samples: [still(), toast] })).findings, ["[div[role=status]] count 0 → 1"]);
  });

  it("lists six moved boxes by name and counts the rest", () => {
    const boxes = (dy) => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`p#${i}`, [0, i * 24 + dy, 300, 24]]));
    const { findings } = judge(watch({ samples: [still({ boxes: boxes(0) }), still({ boxes: boxes(24) })] }));
    assert.equal(findings.length, 7);
    assert.equal(findings[6], "…and 3 more boxes");
  });

  it("fails a finite animation still running after the first look, but not one that ended before it", () => {
    const entrance = 'div "Title" rise';
    assert.deepEqual(judge(watch({ samples: [still({ finite: [entrance] }), still()] })).findings, []);
    assert.deepEqual(judge(watch({ samples: [still(), still({ finite: [entrance] }), still({ finite: [entrance] })] })).findings, [
      `animation running after load: ${entrance}`,
    ]);
  });

  it("reports changed pixels per pair of screenshots", () => {
    const { findings } = judge(watch({ tileDiffs: [[], [[2, 3], [3, 3]]] }));
    assert.deepEqual(findings, ["pixels changed (shot 1→2): 2 tiles in x 32–64, y 48–64"]);
  });

  it("notes a mask that covers the whole viewport, since nothing is left to compare", () => {
    const covered = still({ excused: [[0, 0, 800, 600]] });
    assert.deepEqual(judge(watch({ samples: [covered, covered] })).notes, ["pixels masked: an excused zone covers the viewport"]);
  });

  it("compares a looping story for scroll and focus only, and says why", () => {
    const moving = still({ boxes: { "main#0": [0, 0, 800, 999] } });
    const result = judge(
      watch({
        looping: "its demos loop on purpose",
        samples: [still(), moving],
        recorded: { shifts: [{ time: 1200, value: 0.2, sources: [] }], focus: [] },
        tileDiffs: [],
      }),
    );
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.notes, ["pixels, boxes and layout shifts not compared: its demos loop on purpose"]);
    const scrolls = judge(watch({ looping: "loops", samples: [still(), still({ scrolled: [{ node: "window", x: 0, y: 1 }] })] }));
    assert.match(scrolls.findings[0], /^scroll changed/);
  });

  it("passes on the story's own errors", () => {
    const { findings } = judge(watch({ samples: [still({ error: true }), still({ error: true })], pageErrors: ["boom"] }));
    assert.deepEqual(findings, ["the story threw (Storybook's error display is up)", "page error: boom"]);
  });
});
