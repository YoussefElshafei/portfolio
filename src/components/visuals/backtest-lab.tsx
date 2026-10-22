"use client";

import { useId, useMemo, useState } from "react";
import {
  SLIPPAGE_BPS,
  runBacktest,
  syntheticBars,
  validateParams,
  type BacktestResult,
} from "@/lib/backtest";

/**
 * A strategy backtest you can steer: TradeWatch's `sma_crossover` strategy
 * and its backtest engine, ported to TypeScript (lib/backtest.ts) and run in
 * the browser on synthetic prices every time a slider moves.
 *
 * Nothing animates and nothing ticks. The result is recomputed from scratch
 * on input, the way the real Backtest Runner recomputes a run from its
 * parameters, so there is no motion to reduce.
 */

/** Seeds picked to show different outcomes, including ones where the
 *  strategy loses to simply holding. Cycled by "New prices". */
const SEEDS = [4, 19, 15, 23, 8, 26] as const;

/** Inside the bounds `SmaCrossoverParams` allows (fast 2–200, slow 2–400),
 *  narrowed to what fits a 240-bar chart. */
const FAST = { min: 2, max: 60 };
const SLOW = { min: 5, max: 120 };

const W = 480;
const H = 120;
const EQ_H = 44;

const pct = (n: number | null) =>
  n === null || !Number.isFinite(n)
    ? "—"
    : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

function path(
  values: readonly (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number,
) {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });
  return d;
}

function scale(values: readonly number[], h: number, pad = 4) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
}

export function BacktestLab() {
  const id = useId();
  const [fast, setFast] = useState(10);
  const [slow, setSlow] = useState(30);
  const [seedIndex, setSeedIndex] = useState(0);

  const bars = useMemo(() => syntheticBars(SEEDS[seedIndex]), [seedIndex]);
  const error = validateParams({ fast, slow });
  const result: BacktestResult | null = useMemo(
    () => (error ? null : runBacktest(bars, { fast, slow })),
    [bars, fast, slow, error],
  );

  const n = bars.length;
  const x = (i: number) => (i / (n - 1)) * W;
  // Opens too: the fill marks sit on the open, which can gap past every close.
  const y = scale(
    bars.flatMap((b) => [b.open, b.close]),
    H,
  );
  const holdCurve = bars.map((b) => (10_000 * b.close) / bars[0].open);
  const yEq = scale([...(result?.equity ?? []), ...holdCurve], EQ_H, 3);

  const m = result?.metrics;
  const readouts = [
    ["strategy", pct(m?.totalReturnPct ?? null)],
    ["buy & hold", pct(m?.buyHoldPct ?? null)],
    ["max drawdown", pct(m?.maxDrawdownPct ?? null)],
    ["trades", m ? String(m.tradeCount) : "—"],
    ["win rate", m?.winRatePct == null ? "—" : `${m.winRatePct.toFixed(0)}%`],
    ["in market", m ? `${m.exposurePct.toFixed(0)}%` : "—"],
  ] as const;

  const slider = (
    name: string,
    value: number,
    set: (v: number) => void,
    range: { min: number; max: number },
  ) => (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`${id}-${name}`}
        className="flex items-baseline justify-between font-mono text-micro"
      >
        <span className="text-silk-faint">{name}</span>
        <span className="text-silk tabular-nums">{value}</span>
      </label>
      <input
        id={`${id}-${name}`}
        type="range"
        min={range.min}
        max={range.max}
        step={1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-11 w-full cursor-pointer accent-copper"
      />
    </div>
  );

  return (
    <figure className="mt-8 w-full">
      <div
        data-glow
        className="glow overflow-hidden rounded-trace border border-hairline bg-surface"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-4 py-2.5">
          <span className="text-micro font-medium text-silk-dim">
            TradeWatch · backtest demo
          </span>
          <span className="font-mono text-micro text-silk-faint">
            sma_crossover · next-bar open · {SLIPPAGE_BPS} bps
          </span>
        </div>

        <div className="grid gap-x-6 gap-y-2 px-4 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {slider("fast_period", fast, setFast, FAST)}
          {slider("slow_period", slow, setSlow, SLOW)}
          <button
            type="button"
            onClick={() => setSeedIndex((i) => (i + 1) % SEEDS.length)}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-trace border border-edge px-3 text-micro text-silk-dim hover:border-copper hover:text-copper"
          >
            New prices
          </button>
        </div>

        <div className="relative mx-4 mt-3">
          {/* The chart is described by the readouts and the trade summary
              below, which carry the same information as text. */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="none"
          >
            <path
              d={path(
                bars.map((b) => b.close),
                x,
                y,
              )}
              fill="none"
              stroke="var(--silk-faint)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {result && (
              <>
                <path
                  d={path(result.slow, x, y)}
                  fill="none"
                  stroke="var(--edge)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={path(result.fast, x, y)}
                  fill="none"
                  stroke="var(--silk)"
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Held periods, as a copper rule along the bottom. */}
                {result.trades.map((t) => (
                  <line
                    key={t.entryT}
                    x1={x(t.entryT)}
                    x2={x(t.exitT ?? n - 1)}
                    y1={H - 1}
                    y2={H - 1}
                    stroke="var(--copper)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </>
            )}
          </svg>
          {/* Entry and exit marks as HTML, since the stretched SVG would
              squash circles into ovals. Placed at the fill: the next bar's
              open, not the close that produced the signal. */}
          {result?.trades
            .flatMap((t) => [
              { key: `e${t.entryT}`, i: t.entryT, kind: "entry" as const },
              ...(t.exitT !== null
                ? [{ key: `x${t.exitT}`, i: t.exitT, kind: "exit" as const }]
                : []),
            ])
            .map(({ key, i, kind }) => (
              <span
                key={key}
                className={`pointer-events-none absolute size-2 -translate-1/2 rounded-full border border-copper ${
                  kind === "entry" ? "bg-copper" : "bg-surface"
                }`}
                aria-hidden="true"
                style={{
                  left: `${(x(i) / W) * 100}%`,
                  top: `${(y(bars[i].open) / H) * 100}%`,
                }}
              />
            ))}
        </div>

        <div className="px-4">
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-micro text-silk-faint">
            <span>
              <span className="text-silk">―</span> fast SMA
            </span>
            <span>
              <span className="text-silk-faint">‐ ‐</span> slow SMA
            </span>
            <span>
              <span className="text-copper">●</span> buy{" "}
              <span className="text-copper">○</span> sell
            </span>
          </div>
        </div>

        <div className="px-4 pt-3">
          <p className="mb-1 font-mono text-micro text-silk-faint">
            equity: strategy vs <span className="text-silk-dim">‐ ‐</span> buy &
            hold
          </p>
          <svg
            viewBox={`0 0 ${W} ${EQ_H}`}
            className="block w-full"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="none"
          >
            <path
              d={path(holdCurve, x, yEq)}
              fill="none"
              stroke="var(--silk-faint)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {result && (
              <path
                d={path(result.equity, x, yEq)}
                fill="none"
                stroke="var(--copper)"
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-4 font-mono text-micro sm:grid-cols-3 sm:gap-x-6">
          {readouts.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline gap-2 whitespace-nowrap"
            >
              <dt className="text-silk-faint">{label}</dt>
              <dd className="text-silk tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <p
          id={`${id}-error`}
          aria-live="polite"
          className="min-h-[2.75rem] border-t border-hairline px-4 py-3 text-micro text-silk-dim"
        >
          {error ? (
            <span className="font-mono text-copper">
              ValidationError: {error}
            </span>
          ) : m ? (
            <>
              {m.tradeCount} {m.tradeCount === 1 ? "trade" : "trades"},{" "}
              {pct(m.totalReturnPct)} against {pct(m.buyHoldPct)} for buying and
              holding.
            </>
          ) : null}
        </p>
      </div>

      <figcaption className="mt-3 text-micro text-silk-faint">
        TradeWatch&apos;s SMA crossover strategy and backtest engine, ported to
        TypeScript and run in your browser. It buys when the fast moving average
        crosses above the slow one and sells when it crosses back. Each signal
        fills at the next bar&apos;s open with {SLIPPAGE_BPS} basis points of
        slippage against the trade, as in the real engine, because nobody can
        trade on a price before the bar that produced it has closed. The prices
        are synthetic and generated from a fixed seed. Some seeds make the
        strategy look clever and some make it lose to doing nothing, which is
        the honest point of a backtest.
      </figcaption>
    </figure>
  );
}
