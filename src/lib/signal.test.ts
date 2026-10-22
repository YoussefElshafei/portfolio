import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAD_SCALE,
  THRESHOLD,
  WINDOW,
  classify,
  createRng,
  createSignalStream,
  median,
  primedSeries,
  robustStats,
  robustZ,
} from "./signal.ts";

/**
 * Run with `npm test`.
 *
 * These cover the parts of the Live Signal widget that would be invisible if
 * they were wrong: statistics that are subtly biased still produce a chart
 * that looks fine.
 */

describe("median", () => {
  it("takes the middle value, or the mean of the two middle values", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
  });

  it("does not reorder its input", () => {
    const input = [3, 1, 2];
    median(input);
    assert.deepEqual(input, [3, 1, 2]);
  });
});

describe("robustStats", () => {
  it("matches a hand-checked dataset", () => {
    // median 3; absolute deviations 2,1,0,1,97 have median 1. The 100
    // moves neither number, which is the point of the method.
    const { median: m, sigma } = robustStats([1, 2, 3, 4, 100]);
    assert.equal(m, 3);
    assert.ok(Math.abs(sigma - MAD_SCALE) < 1e-12);
  });

  it("uses TradeWatch's scale constant", () => {
    assert.equal(MAD_SCALE, 1.4826);
  });

  it("barely moves when one extreme value joins the window", () => {
    // The reason for median/MAD: a mean and standard deviation would be
    // dragged by the outlier they are meant to detect.
    const calm = [-1, 1, -1, 1, -1, 1, -1, 1, 0];
    const before = robustStats(calm);
    const after = robustStats([...calm.slice(1), 50]);
    assert.ok(Math.abs(after.median - before.median) <= 1);
    assert.ok(after.sigma <= before.sigma * 1.01);
  });

  it("reports zero spread for a constant window", () => {
    assert.equal(robustStats([7, 7, 7, 7]).sigma, 0);
  });

  it("degrades safely on an empty window", () => {
    assert.ok(Number.isNaN(robustStats([]).median));
  });
});

describe("robustZ", () => {
  it("counts robust standard deviations from the median, with sign", () => {
    assert.equal(robustZ(12, { median: 10, sigma: 2 }), 1);
    assert.equal(robustZ(6, { median: 10, sigma: 2 }), -2);
  });

  it("returns 0 rather than Infinity when the window is flat", () => {
    assert.equal(robustZ(99, { median: 7, sigma: 0 }), 0);
    assert.equal(robustZ(99, { median: 7, sigma: Number.NaN }), 0);
  });
});

describe("classify", () => {
  // A level series whose moves alternate -1, +1: median move 0, MAD 1.
  const levels = Array.from({ length: WINDOW + 1 }, (_, i) => (i % 2 ? 1 : 0));
  const last = levels[levels.length - 1];
  const sigma = MAD_SCALE;

  it("scores the move, not the level", () => {
    const s = classify(levels, last + 2 * sigma, 0);
    assert.ok(Math.abs(s.z - 2) < 0.05, `expected about 2, got ${s.z}`);
    assert.ok(Math.abs(s.expected - last) < 1e-9);
  });

  it("does not flag before a full window of moves exists", () => {
    assert.equal(classify([0, 1, 0], 1000, 0).anomaly, false);
  });

  it("flags only beyond the threshold", () => {
    assert.equal(classify(levels, last + 2 * sigma, 0).anomaly, false);
    assert.equal(
      classify(levels, last + (THRESHOLD + 0.5) * sigma, 0).anomaly,
      true,
    );
  });

  it("reports z consistent with its own expected value and spread", () => {
    const s = classify(levels, last - 6, 0);
    const recomputed = (s.value - s.expected) / s.sigma;
    assert.ok(Math.abs(recomputed - s.z) < 1e-9);
    assert.ok(s.z < 0);
  });
});

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = Array.from({ length: 8 }, createRng(42));
    const b = Array.from({ length: 8 }, createRng(42));
    assert.deepEqual(a, b);
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    }
  });
});

describe("the stream", () => {
  it("produces the same series for the same seed", () => {
    const a = primedSeries(20260922).map((s) => s.value);
    const b = primedSeries(20260922).map((s) => s.value);
    assert.deepEqual(a, b);
  });

  it("flags an injected spike", () => {
    for (const seed of [1, 2, 3, 20260922]) {
      const stream = createSignalStream(seed, 200);
      assert.ok(stream.next(8).anomaly, `seed ${seed}`);
    }
  });

  it("differs between seeds", () => {
    assert.notDeepEqual(
      primedSeries(1).map((s) => s.value),
      primedSeries(2).map((s) => s.value),
    );
  });

  it("never emits a non-finite value or score", () => {
    const stream = createSignalStream(20260922);
    for (let i = 0; i < 5_000; i++) {
      const s = stream.next();
      assert.ok(Number.isFinite(s.value), `value ${s.value} at tick ${i}`);
      assert.ok(Number.isFinite(s.z), `z ${s.z} at tick ${i}`);
    }
  });

  it("flags often enough to demonstrate, rarely enough to mean something", () => {
    const stream = createSignalStream(20260922);
    let flags = 0;
    const ticks = 20_000;
    for (let i = 0; i < ticks; i++) if (stream.next().anomaly) flags++;
    const rate = flags / ticks;
    // A widget nobody sees fire is pointless; one that fires constantly is
    // not a detector. Anywhere in this band reads as a real threshold.
    assert.ok(rate > 0.01 && rate < 0.08, `flag rate was ${rate}`);
  });

  it("mean-reverts instead of drifting off the chart", () => {
    const stream = createSignalStream(20260922);
    let sum = 0;
    const ticks = 20_000;
    for (let i = 0; i < ticks; i++) sum += stream.next().value;
    // Long-run mean should sit near the process level of 0.
    assert.ok(Math.abs(sum / ticks) < 0.5, `mean drifted to ${sum / ticks}`);
  });
});
