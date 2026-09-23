"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  PRIMED_TICKS,
  THRESHOLD,
  VIEW,
  WINDOW,
  createSignalStream,
  primedSeries,
  type Sample,
  type SignalStream,
} from "@/lib/signal";

const SEED = 20260922;

/** Computed once at module load. Deterministic, so the server and the client
 *  produce the identical array and there is nothing to mismatch on hydration. */
const INITIAL: readonly Sample[] = primedSeries(SEED);

/** The most recent flag already present in the primed prefix, so the caption
 *  agrees with the markers visible on the chart from the very first paint. */
const INITIAL_FLAG: Sample | null =
  [...INITIAL].reverse().find((s) => s.anomaly) ?? null;

const W = 480;
const H = 96;
const TICK_MS = 1000;
/** Reduced motion slows the stream rather than stopping it: the numbers are
 *  the content here, not decoration, so freezing them would remove the point. */
const TICK_MS_REDUCED = 4000;

/** Symmetric, quantised vertical domain.
 *
 *  A domain recomputed exactly to the visible min/max shimmers on every tick as
 *  points enter and leave. Rounding to whole units with a floor of 8 means the
 *  axis holds still through ordinary movement and only steps outward when a
 *  genuine spike arrives. */
function halfDomain(points: readonly Sample[]): number {
  let max = 0;
  for (const p of points) max = Math.max(max, Math.abs(p.value));
  return Math.max(8, Math.ceil(max) + 1);
}

const fmt = (n: number, dp = 2) => (Number.isFinite(n) ? n.toFixed(dp) : "—");

/** The series' own clock. A wall-clock time would imply this synthetic stream
 *  is tied to real market hours, and it cannot be server-rendered without a
 *  hydration mismatch. The tick index is deterministic and honest. */
const tickLabel = (t: number) => `t+${String(t).padStart(4, "0")}`;

export function LiveSignal() {
  const [points, setPoints] = useState<readonly Sample[]>(INITIAL);
  const [flag, setFlag] = useState<Sample | null>(INITIAL_FLAG);
  const streamRef = useRef<SignalStream | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    // Fast-forward a fresh stream past the primed prefix so ticking continues
    // exactly where the server-rendered chart left off.
    streamRef.current ??= createSignalStream(SEED, PRIMED_TICKS);

    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      const next = streamRef.current?.next();
      if (!next) return;
      setPoints((prev) => [...prev.slice(-(VIEW - 1)), next]);
      if (next.anomaly) setFlag(next);
    };

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(tick, reduced ? TICK_MS_REDUCED : TICK_MS);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    // A backgrounded tab should not be burning a timer, recomputing statistics
    // and queueing React renders nobody will see.
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  const latest = points[points.length - 1];
  const half = halfDomain(points);

  const x = (i: number) => (i / (VIEW - 1)) * W;
  const y = (v: number) =>
    H / 2 - (Math.max(-half, Math.min(half, v)) / half) * (H / 2 - 4);

  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`,
    )
    .join(" ");
  const meanLine = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.mean).toFixed(1)}`,
    )
    .join(" ");

  const flagged = points.map((p, i) => ({ p, i })).filter(({ p }) => p.anomaly);
  const newestFlagIndex = flagged.length ? flagged[flagged.length - 1].i : -1;

  return (
    <figure className="mt-8 w-full max-w-figure">
      <div className="overflow-hidden rounded-trace border border-hairline bg-surface">
        <div className="flex items-baseline justify-between border-b border-hairline px-4 py-2.5">
          <span className="text-micro font-medium text-silk-dim">
            Live signal
          </span>
          <span className="font-mono text-micro text-silk-faint">
            window {WINDOW} · |z| &gt; {THRESHOLD}
          </span>
        </div>

        <div className="px-4 pt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="none"
          >
            {/* rolling mean: the baseline each point is judged against */}
            <path
              d={meanLine}
              fill="none"
              stroke="var(--edge)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {/* the series */}
            <path
              d={line}
              fill="none"
              stroke="var(--silk-dim)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {/* flagged points, in the accent already defined for the system */}
            {flagged.map(({ p, i }) => (
              <g key={p.t}>
                {i === newestFlagIndex && !reduced && (
                  <circle
                    className="signal-pulse"
                    cx={x(i)}
                    cy={y(p.value)}
                    r={3}
                    fill="none"
                    stroke="var(--copper)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={2.5}
                  fill="var(--copper)"
                />
              </g>
            ))}
            {latest && (
              <circle
                cx={x(points.length - 1)}
                cy={y(latest.value)}
                r={2}
                fill="var(--silk)"
              />
            )}
          </svg>
        </div>

        {/* Every readout here is a measurement, so the whole row is mono (§2.6). */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-4 font-mono text-micro sm:grid-cols-4">
          {(
            [
              ["value", fmt(latest?.value ?? Number.NaN)],
              ["mean", fmt(latest?.mean ?? Number.NaN)],
              ["σ", fmt(latest?.std ?? Number.NaN)],
              ["z", fmt(latest?.z ?? Number.NaN)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-silk-faint">{label}</dt>
              <dd
                className={
                  label === "z" && latest?.anomaly ? "text-copper" : "text-silk"
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {/*
          Announced politely rather than continuously: the numbers above change
          every second and a live region on them would make the page unusable
          with a screen reader. A flag is the event worth interrupting for.
        */}
        <p
          aria-live="polite"
          className="min-h-[2.75rem] border-t border-hairline px-4 py-3 text-micro text-silk-dim"
        >
          {flag ? (
            <>
              <span className="font-mono text-copper">{tickLabel(flag.t)}</span>{" "}
              Flagged:{" "}
              <span className="font-mono">{fmt(Math.abs(flag.z), 1)}</span>{" "}
              standard deviations {flag.z > 0 ? "above" : "below"} the rolling
              mean.
            </>
          ) : (
            <>Watching. Nothing outside {THRESHOLD}σ of the rolling mean yet.</>
          )}
        </p>
      </div>

      <figcaption className="mt-3 text-micro text-silk-faint">
        A synthetic series generated in the browser from a fixed seed, checked
        against a rolling mean and standard deviation over the last {WINDOW}{" "}
        points. The same class of statistical check{" "}
        <a
          href="#work-tradewatch"
          className="text-silk-dim underline decoration-hairline underline-offset-2 hover:text-copper hover:decoration-copper"
        >
          TradeWatch
        </a>{" "}
        runs against real market data — not fraud or manipulation detection,
        just &ldquo;unusual relative to its own recent history&rdquo;. The
        detector has no knowledge of where the shocks are.
      </figcaption>
    </figure>
  );
}
