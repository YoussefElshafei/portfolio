import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SLIPPAGE_BPS,
  initialState,
  maxDrawdownPct,
  runBacktest,
  smaCrossover,
  smaUpdate,
  syntheticBars,
  validateParams,
  type Bar,
  type SmaState,
} from "./backtest.ts";

/**
 * Run with `npm test`.
 *
 * The cases mirror the TradeWatch repository's own tests for the code this
 * is ported from: hand-checkable SMA values, a crossing that fires once, no
 * lookahead, and fills at the next bar's open.
 */

const bars = (closes: number[]): Bar[] =>
  closes.map((close, t) => ({ t, open: close, close }));

describe("smaUpdate", () => {
  it("returns null until the window fills, then the trailing mean", () => {
    let s: SmaState = { period: 3, values: [] };
    const out: (number | null)[] = [];
    for (const v of [1, 2, 3, 4, 5]) {
      let cur: number | null;
      [s, cur] = smaUpdate(s, v);
      out.push(cur);
    }
    assert.deepEqual(out, [null, null, 2, 3, 4]);
    assert.deepEqual(s.values, [3, 4, 5]);
  });
});

describe("validateParams", () => {
  it("rejects a fast period that is not faster, like SmaCrossoverParams", () => {
    assert.match(validateParams({ fast: 10, slow: 10 }) ?? "", /must be less/);
    assert.equal(validateParams({ fast: 5, slow: 20 }), null);
  });
});

describe("smaCrossover", () => {
  it("fires once on the crossing, not on every bar above it", () => {
    let state = initialState({ fast: 2, slow: 3 });
    const fired: string[] = [];
    for (const bar of bars([10, 10, 10, 12, 14, 16, 18, 10, 6])) {
      let sig;
      [state, sig] = smaCrossover(state, bar);
      for (const s of sig) fired.push(`${s.t}:${s.direction}`);
    }
    assert.deepEqual(fired, ["3:LONG", "7:FLAT"]);
  });

  it("does not depend on bars it has not seen yet (no lookahead)", () => {
    const series = syntheticBars(7, 120);
    const full = runBacktest(series, { fast: 5, slow: 20 });
    const half = runBacktest(series.slice(0, 60), { fast: 5, slow: 20 });
    assert.deepEqual(full.equity.slice(0, 60), half.equity);
  });
});

describe("runBacktest", () => {
  it("fills at the next bar's open with slippage against the trader", () => {
    const series: Bar[] = [
      { t: 0, open: 10, close: 10 },
      { t: 1, open: 10, close: 10 },
      { t: 2, open: 10, close: 12 }, // fast 11 > slow 10.67: LONG signal
      { t: 3, open: 13, close: 13 }, // fills here, at 13 plus slippage
      { t: 4, open: 13, close: 6 }, // fast 9.5 < slow 10.33: FLAT signal
      { t: 5, open: 5, close: 5 }, // fills here, at 5 minus slippage
    ];
    const { trades } = runBacktest(series, { fast: 2, slow: 3 });
    const slip = SLIPPAGE_BPS / 10_000;
    assert.equal(trades.length, 1);
    assert.equal(trades[0].entryT, 3);
    assert.equal(trades[0].entryPrice, 13 * (1 + slip));
    assert.equal(trades[0].exitT, 5);
    assert.equal(trades[0].exitPrice, 5 * (1 - slip));
  });

  it("leaves a trade open at the end rather than inventing an exit", () => {
    const { trades, metrics } = runBacktest(bars([1, 1, 1, 2, 3, 4]), {
      fast: 2,
      slow: 3,
    });
    assert.equal(trades.length, 1);
    assert.equal(trades[0].exitT, null);
    assert.equal(trades[0].returnPct, null);
    assert.equal(metrics.winRatePct, null);
    assert.equal(metrics.tradeCount, 1);
  });

  it("is deterministic for a seed", () => {
    const a = runBacktest(syntheticBars(42), { fast: 10, slow: 40 });
    const b = runBacktest(syntheticBars(42), { fast: 10, slow: 40 });
    assert.deepEqual(a, b);
  });
});

describe("maxDrawdownPct", () => {
  it("is the worst fall from a running peak", () => {
    assert.equal(maxDrawdownPct([100, 120, 90, 130, 117]), -25);
    assert.equal(maxDrawdownPct([1, 2, 3]), 0);
  });
});
