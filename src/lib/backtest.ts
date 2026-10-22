/**
 * A TypeScript port of the smallest end-to-end path through TradeWatch's
 * Backtest Runner, for the in-page strategy demo.
 *
 * Ported from the TradeWatch repository, kept to the same shape so the two
 * can be compared line for line:
 *
 *  - `smaUpdate`      ← application/strategy/indicators.py `SmaState.update`
 *  - `smaCrossover`   ← application/strategy/types/sma_crossover.py `evaluate`
 *  - `runBacktest`    ← application/backtest/engine.py `run_backtest`, one
 *                       symbol, `FillModel.NEXT_BAR_OPEN`
 *  - fills and sizing ← application/execution (2 bps slippage against the
 *                       trader, zero commission: the repo's defaults)
 *  - metrics          ← application/backtest/metrics.py
 *
 * What is simplified: floats instead of Decimal (fine for a chart, not for a
 * ledger), one symbol instead of a basket, and only one of the two strategy
 * types. Everything else, including the rule that a signal fills at the
 * *next* bar's open, matches the original.
 *
 * Pure and deterministic, so it is unit-tested under `node --test`.
 */

export type Bar = { t: number; open: number; close: number };

/* ------------------------------------------------------------------ *
 * Synthetic prices
 * ------------------------------------------------------------------ */

/** mulberry32: a tiny seeded PRNG, so the server and the browser agree. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal from two uniforms (Box–Muller). */
function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Daily-ish bars with slowly changing drift, so the series has trends for a
 * crossover to catch and chop for it to get caught in. The open gaps a
 * little from the previous close, which is why next-bar-open fills differ
 * from the close the signal was computed on.
 */
export function syntheticBars(seed: number, n = 240): Bar[] {
  const rand = rng(seed);
  const bars: Bar[] = [];
  let close = 100;
  let drift = 0;
  for (let t = 0; t < n; t++) {
    // The drift itself wanders and slowly decays toward zero: regimes.
    drift = drift * 0.97 + gauss(rand) * 0.0009;
    const open = close * (1 + gauss(rand) * 0.002);
    close = open * (1 + drift + gauss(rand) * 0.012);
    bars.push({ t, open, close });
  }
  return bars;
}

/* ------------------------------------------------------------------ *
 * Indicator and strategy
 * ------------------------------------------------------------------ */

export type SmaState = { period: number; values: readonly number[] };

/** Incremental SMA: returns the new state and the average, or null while
 *  the window is still filling. Same contract as `SmaState.update`. */
export function smaUpdate(
  state: SmaState,
  value: number,
): [SmaState, number | null] {
  const values = [...state.values, value].slice(-state.period);
  const next = { period: state.period, values };
  const current =
    values.length === state.period
      ? values.reduce((s, v) => s + v, 0) / state.period
      : null;
  return [next, current];
}

export type Direction = "LONG" | "FLAT";
export type Signal = { direction: Direction; t: number; reason: string };

export type CrossoverParams = { fast: number; slow: number };
export type CrossoverState = {
  fast: SmaState;
  slow: SmaState;
  position: Direction;
};

/** The parameter bounds from `SmaCrossoverParams`, including its validator. */
export const FAST_RANGE = [2, 200] as const;
export const SLOW_RANGE = [2, 400] as const;

export function validateParams(p: CrossoverParams): string | null {
  if (p.fast >= p.slow)
    return `fast_period (${p.fast}) must be less than slow_period (${p.slow})`;
  return null;
}

export function initialState(p: CrossoverParams): CrossoverState {
  return {
    fast: { period: p.fast, values: [] },
    slow: { period: p.slow, values: [] },
    position: "FLAT",
  };
}

/** Long when the fast SMA crosses above the slow one, flat when it crosses
 *  back. A signal fires on the crossing only, not on every bar above it. */
export function smaCrossover(
  state: CrossoverState,
  bar: Bar,
): [CrossoverState, Signal[]] {
  const [fastState, fast] = smaUpdate(state.fast, bar.close);
  const [slowState, slow] = smaUpdate(state.slow, bar.close);
  const signals: Signal[] = [];
  let position = state.position;
  if (fast !== null && slow !== null) {
    if (fast > slow && position !== "LONG") {
      position = "LONG";
      signals.push({
        direction: "LONG",
        t: bar.t,
        reason: "fast SMA crossed above slow SMA",
      });
    } else if (fast <= slow && position === "LONG") {
      position = "FLAT";
      signals.push({
        direction: "FLAT",
        t: bar.t,
        reason: "fast SMA crossed below slow SMA",
      });
    }
  }
  return [{ fast: fastState, slow: slowState, position }, signals];
}

/* ------------------------------------------------------------------ *
 * Backtest
 * ------------------------------------------------------------------ */

/** `exec_slippage_bps` default. Always against the trader. */
export const SLIPPAGE_BPS = 2;

export type Trade = {
  entryT: number;
  entryPrice: number;
  exitT: number | null;
  exitPrice: number | null;
  /** Null while the trade is still open at the end of the run: it is not
   *  force-closed, because that would report a P&L for an exit that never
   *  happened. */
  returnPct: number | null;
};

export type Metrics = {
  totalReturnPct: number;
  buyHoldPct: number;
  maxDrawdownPct: number;
  winRatePct: number | null;
  tradeCount: number;
  exposurePct: number;
};

export type BacktestResult = {
  equity: number[];
  fast: (number | null)[];
  slow: (number | null)[];
  trades: Trade[];
  metrics: Metrics;
};

/** Worst peak-to-trough decline, as a negative percentage (or 0). */
export function maxDrawdownPct(curve: readonly number[]) {
  let peak = curve[0] ?? 0;
  let worst = 0;
  for (const v of curve) {
    peak = Math.max(peak, v);
    if (peak > 0) worst = Math.min(worst, ((v - peak) / peak) * 100);
  }
  return worst;
}

export function runBacktest(
  bars: readonly Bar[],
  params: CrossoverParams,
  initialCash = 10_000,
): BacktestResult {
  const slip = SLIPPAGE_BPS / 10_000;
  let state = initialState(params);
  let cash = initialCash;
  let qty = 0;
  let pending: Signal | null = null;
  let open: { t: number; price: number } | null = null;
  const trades: Trade[] = [];
  const equity: number[] = [];
  const fastLine: (number | null)[] = [];
  const slowLine: (number | null)[] = [];
  let barsInMarket = 0;

  for (const bar of bars) {
    // A signal from the previous bar fills at this bar's open: nobody can
    // trade on a close before the bar has closed.
    if (pending) {
      if (pending.direction === "LONG" && qty === 0) {
        const price = bar.open * (1 + slip);
        qty = cash / price;
        cash = 0;
        open = { t: bar.t, price };
      } else if (pending.direction === "FLAT" && qty > 0 && open) {
        const price = bar.open * (1 - slip);
        cash = qty * price;
        qty = 0;
        trades.push({
          entryT: open.t,
          entryPrice: open.price,
          exitT: bar.t,
          exitPrice: price,
          returnPct: (price / open.price - 1) * 100,
        });
        open = null;
      }
      pending = null;
    }

    const [next, signals] = smaCrossover(state, bar);
    state = next;
    // The SMA values for drawing, read back from the state just computed.
    fastLine.push(
      next.fast.values.length === params.fast
        ? next.fast.values.reduce((s, v) => s + v, 0) / params.fast
        : null,
    );
    slowLine.push(
      next.slow.values.length === params.slow
        ? next.slow.values.reduce((s, v) => s + v, 0) / params.slow
        : null,
    );
    if (signals.length) pending = signals[0];

    if (qty > 0) barsInMarket++;
    equity.push(cash + qty * bar.close);
  }

  if (open)
    trades.push({
      entryT: open.t,
      entryPrice: open.price,
      exitT: null,
      exitPrice: null,
      returnPct: null,
    });

  const closed = trades.filter((t) => t.returnPct !== null);
  const last = equity[equity.length - 1] ?? initialCash;
  const first = bars[0];
  const final = bars[bars.length - 1];
  return {
    equity,
    fast: fastLine,
    slow: slowLine,
    trades,
    metrics: {
      totalReturnPct: (last / initialCash - 1) * 100,
      buyHoldPct:
        first && final
          ? (final.close / (first.open * (1 + slip)) - 1) * 100
          : 0,
      maxDrawdownPct: maxDrawdownPct(equity),
      winRatePct: closed.length
        ? (closed.filter((t) => (t.returnPct ?? 0) > 0).length /
            closed.length) *
          100
        : null,
      tradeCount: trades.length,
      exposurePct: bars.length ? (barsInMarket / bars.length) * 100 : 0,
    },
  };
}
