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
  // The band too, not just the line: the band is the point of the chart, so
  // it should not be clipped at the edges.
  for (const p of points) {
    const reach = Number.isFinite(p.sigma) ? THRESHOLD * p.sigma : 0;
    max = Math.max(max, Math.abs(p.value), Math.abs(p.expected) + reach);
  }
  return Math.max(8, Math.ceil(max) + 1);
}

const fmt = (n: number, dp = 2) => (Number.isFinite(n) ? n.toFixed(dp) : "—");

/**
 * Presentation only. The series is a mean-reverting walk around zero, which
 * reads as abstract; offset by a notional 100 it reads as a price. Nothing
 * statistical changes: σ and z are identical under a constant shift, so the
 * detector and its tests are untouched.
 */
const PRICE_BASE = 100;
const price = (v: number) => fmt(PRICE_BASE + v);

/**
 * A made-up symbol, formatted so it cannot be mistaken for a real listing:
 * real tickers do not carry a "-SIM" suffix.
 */
const TICKER = "TW-SIM";

/** The series' own clock. A wall-clock time would imply this synthetic stream
 *  is tied to real market hours, and it cannot be server-rendered without a
 *  hydration mismatch. The tick index is deterministic and honest. */
const tickLabel = (t: number) => `t+${String(t).padStart(4, "0")}`;

export function LiveSignal() {
  const [points, setPoints] = useState<readonly Sample[]>(INITIAL);
  const [flag, setFlag] = useState<Sample | null>(INITIAL_FLAG);
  const streamRef = useRef<SignalStream | null>(null);
  const figureRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const reduced = useReducedMotion();

  /*
   * The widget sits well below the fold. Without this it would start ticking
   * the moment the page hydrates and keep running while the visitor is still
   * reading the hero — computing statistics and re-rendering for a chart
   * nobody has scrolled to. The stream only runs while it is actually on
   * screen, which together with the visibilitychange pause means it costs
   * nothing until it is being looked at.
   */
  useEffect(() => {
    const el = figureRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
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
  }, [reduced, inView]);

  /** Pushes one extra tick with a move of `shock` σ added, so a visitor can
   *  test the threshold instead of waiting for the series to do it. */
  const inject = (shock: number) => {
    streamRef.current ??= createSignalStream(SEED, PRIMED_TICKS);
    const next = streamRef.current.next(shock);
    setPoints((prev) => [...prev.slice(-(VIEW - 1)), next]);
    if (next.anomaly) setFlag(next);
  };

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
  const expectedLine = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.expected).toFixed(1)}`,
    )
    .join(" ");

  const flagged = points.map((p, i) => ({ p, i })).filter(({ p }) => p.anomaly);
  const newestFlagIndex = flagged.length ? flagged[flagged.length - 1].i : -1;
  const newestFlag = newestFlagIndex >= 0 ? points[newestFlagIndex] : null;

  /*
   * The band is expected ± THRESHOLD·σ: exactly the region the detector treats as
   * normal. A point is flagged precisely when the line leaves the band, so the
   * whole idea of the check is visible without reading a word.
   */
  const band =
    points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.expected + THRESHOLD * p.sigma).toFixed(1)}`,
      )
      .join(" ") +
    " " +
    [...points]
      .map((p, i) => ({ p, i }))
      .reverse()
      .map(
        ({ p, i }) =>
          `L ${x(i).toFixed(1)} ${y(p.expected - THRESHOLD * p.sigma).toFixed(1)}`,
      )
      .join(" ") +
    " Z";

  return (
    <figure ref={figureRef} className="mt-8 w-full">
      <div
        data-glow
        className="glow overflow-hidden rounded-trace border border-hairline bg-surface"
      >
        {/* Header, styled as a small trading monitor: what this is, then
            the instrument and its last price. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-4 py-2.5">
          <span className="text-micro font-medium text-silk-dim">
            TradeWatch · live demo
          </span>
          <span className="font-mono text-micro text-silk-faint">
            window {WINDOW} · |z| &gt; {THRESHOLD}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-4">
          {/* Symbol and price are machine facts, so mono (§2.6). */}
          <span
            className="rounded-trace border border-hairline px-1.5 py-0.5 font-mono text-micro text-silk-dim"
            title="Synthetic symbol, not a real listing"
          >
            {TICKER}
          </span>
          <span className="font-mono text-h3 text-silk tabular-nums">
            {price(latest?.value ?? Number.NaN)}
          </span>
          <span className="ml-auto flex gap-2">
            {(
              [
                [2, "Nudge +2σ"],
                [8, "Inject a spike +8σ"],
              ] as const
            ).map(([shock, label]) => (
              <button
                key={shock}
                type="button"
                onClick={() => inject(shock)}
                className="inline-flex min-h-8 cursor-pointer items-center rounded-trace border border-hairline px-2.5 font-mono text-micro text-silk-dim transition-colors hover:border-copper hover:text-copper active:translate-y-px pointer-coarse:min-h-11"
              >
                {label}
              </button>
            ))}
          </span>
        </div>

        <div className="relative mx-4 mt-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="none"
          >
            {/* Normal range: expected ± threshold·σ. Leaving it is what gets a
                point flagged. */}
            <path d={band} fill="var(--silk)" fillOpacity={0.05} />
            {/* expected: previous price plus the median move of the window */}
            <path
              d={expectedLine}
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
                {i === newestFlagIndex && (
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

          {/*
            The "something unusual just happened" moment, visible at a glance
            rather than only in the caption line below. HTML rather than SVG
            text because the chart is stretched non-uniformly
            (preserveAspectRatio="none"), which would distort glyphs. It is
            positioned in percentages of the same coordinate system, so it
            tracks its point at any width. Only the newest flag gets a tag;
            one per spike would clutter the chart during a volatile stretch.
            aria-hidden: the polite live region below already announces it.
          */}
          {newestFlag && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-trace border border-copper bg-surface px-1 font-mono text-micro leading-4 text-copper"
              style={{
                left: `${(x(newestFlagIndex) / W) * 100}%`,
                top: `${(y(newestFlag.value) / H) * 100}%`,
                // Sit above a low point, below a high one, and flip left near
                // the right edge so the tag never leaves the chart.
                transform: `translate(${
                  newestFlagIndex > VIEW * 0.8 ? "calc(-100% - 6px)" : "6px"
                }, ${newestFlag.value < 0 ? "calc(-100% - 4px)" : "4px"})`,
              }}
            >
              ANOMALY
            </span>
          )}
        </div>

        {/* Every readout here is a measurement, so the whole row is mono (§2.6). */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-4 font-mono text-micro sm:grid-cols-4">
          {(
            [
              ["price", price(latest?.value ?? Number.NaN)],
              ["expected", price(latest?.expected ?? Number.NaN)],
              ["σ", fmt(latest?.sigma ?? Number.NaN)],
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
              robust standard deviations {flag.z > 0 ? "above" : "below"} the
              expected move.
            </>
          ) : (
            <>Watching. No move beyond {THRESHOLD}σ yet.</>
          )}
        </p>
      </div>

      <figcaption className="mt-3 text-micro text-silk-faint">
        A simplified version of the baseline check{" "}
        <a
          href="#work-tradewatch"
          className="text-silk-dim underline decoration-hairline underline-offset-2 hover:text-copper hover:decoration-copper"
        >
          TradeWatch
        </a>{" "}
        runs on every one-minute bar. The prices are synthetic, generated in
        your browser from a fixed seed. Each move is compared with the last{" "}
        {WINDOW} moves using the median and median absolute deviation, which a
        single spike cannot drag around the way it drags an average. The shaded
        band is the normal range; a move more than {THRESHOLD} robust standard
        deviations out is flagged as unusual for this series, which is not the
        same as fraud or manipulation. TradeWatch scores several features this
        way (return, volatility, volume, trade count); this demo scores one. The
        buttons push one extra move through the check: a 2σ nudge usually stays
        inside the band, an 8σ spike leaves it.
      </figcaption>
    </figure>
  );
}
