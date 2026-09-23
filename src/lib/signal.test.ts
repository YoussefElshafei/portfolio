import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  THRESHOLD,
  WINDOW,
  classify,
  createRng,
  createSignalStream,
  primedSeries,
  rollingStats,
  zScore,
} from "./signal.ts";

/**
 * Run with `npm test`.
 *
 * These cover the parts of the Live Signal widget that would be invisible if
 * they were wrong: statistics that are subtly biased still produce a chart
 * that looks fine.
 */

describe("rollingStats", () => {
  it("matches a hand-checked dataset", () => {
    // mean 5, sample variance 32/7, sd 2.138089...
    const { mean, std } = rollingStats([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.equal(mean, 5);
    assert.ok(Math.abs(std - Math.sqrt(32 / 7)) < 1e-12);
  });

  it("uses the sample (n-1) denominator, not the population one", () => {
    const { std } = rollingStats([1, 3]);
    // sample sd of [1,3] is sqrt(2) ≈ 1.4142; the population sd would be 1.
    assert.ok(Math.abs(std - Math.SQRT2) < 1e-12);
  });

  it("reports zero spread for a constant window", () => {
    assert.equal(rollingStats([7, 7, 7, 7]).std, 0);
  });

  it("degrades safely on empty and single-element windows", () => {
    assert.ok(Number.isNaN(rollingStats([]).mean));
    assert.deepEqual(rollingStats([4]), { mean: 4, std: 0 });
  });
});

describe("zScore", () => {
  it("counts standard deviations from the mean", () => {
    assert.equal(zScore(12, { mean: 10, std: 2 }), 1);
    assert.equal(zScore(6, { mean: 10, std: 2 }), -2);
  });

  it("returns 0 rather than Infinity when the baseline is flat", () => {
    // Without this guard every point after a flat window flags forever.
    assert.equal(zScore(99, { mean: 7, std: 0 }), 0);
    assert.equal(zScore(99, { mean: 7, std: Number.NaN }), 0);
  });
});

describe("classify", () => {
  const flat = Array.from({ length: WINDOW }, (_, i) => (i % 2 ? 1 : -1));

  it("excludes the point under test from its own baseline", () => {
    // The whole reason for judging a point against its past: included in its
    // own window, a large outlier drags the mean toward itself and inflates
    // the standard deviation, shrinking its own score.
    const { std } = rollingStats(flat);
    const spike = 4 * std;

    const excluded = classify(flat, spike, 0).z;
    const included = zScore(spike, rollingStats([...flat, spike]));

    assert.ok(Math.abs(excluded - 4) < 1e-9, `expected ~4, got ${excluded}`);
    assert.ok(
      Math.abs(included) < Math.abs(excluded),
      "a self-included baseline must understate the outlier",
    );
  });

  it("does not flag before the window has warmed up", () => {
    const short = [0, 0, 0];
    const sample = classify(short, 1000, 0);
    assert.equal(sample.anomaly, false);
  });

  it("flags only beyond the threshold", () => {
    const { std } = rollingStats(flat);
    assert.equal(classify(flat, 2.0 * std, 0).anomaly, false);
    assert.equal(classify(flat, (THRESHOLD + 0.5) * std, 0).anomaly, true);
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
