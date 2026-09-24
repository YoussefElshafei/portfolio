"use client";

import { useEffect, useState } from "react";
import {
  THRESHOLD,
  WINDOW,
  createSignalStream,
  type Sample,
} from "@/lib/signal";

/**
 * First-visit intro: a tiny TradeWatch preview — DESIGN_BRIEF.md §2.7.
 *
 * A sparkline builds point by point in exactly the Live Signal widget's
 * visual language (same strokes, band, flag dot, pulse and ANOMALY tag), the
 * detector flags a spike, and on that flag the chart swells and fades away
 * to reveal the site. It is meant to be recognised later, as a callback, when
 * the visitor reaches the real widget on the TradeWatch entry.
 *
 * Honest by construction: the points come from the same synthetic stream and
 * the same rolling z-score detector the widget uses (lib/signal.ts), not a
 * scripted animation. The seed was chosen by searching for one where the
 * detector's FIRST flag lands on tick 19, so the intro is short; the flag
 * itself is the detector's own call (z ≈ 6.8).
 *
 * When it plays is decided before React runs, by the inline script in the
 * root layout (INTRO_SCRIPT below): only on the first page view of a browser
 * session, never under prefers-reduced-motion, never without JavaScript, and
 * never when arriving at a deep link (#section). The script sets
 * html[data-intro="play"], and CSS alone shows the overlay, so the content
 * underneath is never flashed before the overlay can cover it.
 *
 * Skippable at any point by click, key, touch or scroll.
 */

const SEED = 182;
/** Ticks shown. The detector's first flag on this seed is tick 19. */
const TICKS = 20;
const TICK_MS = 110;
const START_DELAY_MS = 300;
const HOLD_AFTER_FLAG_MS = 1000;
const LEAVE_MS = 700;
const SKIP_LEAVE_MS = 250;

/** The whole run, computed once. The warm-up is hidden history the rolling
 *  statistics need; only the ticks after it are drawn. */
const SERIES: readonly Sample[] = (() => {
  const stream = createSignalStream(SEED, WINDOW);
  return Array.from({ length: TICKS }, () => stream.next());
})();

const W = 480;
const H = 120;
const PRICE_BASE = 100;

/** One fixed vertical domain for the whole run, so nothing rescales as it
 *  builds. Covers the series and its band. */
const [LO, HI] = (() => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of SERIES) {
    lo = Math.min(lo, p.value, p.mean - THRESHOLD * p.std);
    hi = Math.max(hi, p.value, p.mean + THRESHOLD * p.std);
  }
  // Generous headroom: the flagged spike is the point of the whole thing,
  // and it lands at the extreme of the range by definition.
  const pad = (hi - lo) * 0.15;
  return [lo - pad, hi + pad];
})();

const x = (i: number) => (i / (TICKS - 1)) * W;
const y = (v: number) => H - ((v - LO) / (HI - LO)) * H;

const path = (pts: readonly Sample[], f: (p: Sample) => number) =>
  pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(f(p)).toFixed(1)}`,
    )
    .join(" ");

/** Runs in <head> before first paint. Kept tiny and dependency-free. */
export const INTRO_SCRIPT = `try{var d=document.documentElement;if(!location.hash&&!sessionStorage.getItem("intro-seen")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.setAttribute("data-intro","play")}sessionStorage.setItem("intro-seen","1")}catch(e){}`;

export function Intro() {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "play") return;

    /*
      Progress is derived from elapsed time, not from a chain of timeouts.
      Browsers clamp timers in background or unfocused tabs (to about once a
      second), and a chain of twenty 110ms timeouts would then stretch a
      four-second intro to twenty. Here a slow tick just catches up: the
      point count and the exit are computed from how long it has actually
      been, so the intro can never overstay.
    */
    const start = performance.now();
    const END_MS = START_DELAY_MS + TICKS * TICK_MS + HOLD_AFTER_FLAG_MS;
    let shown = 0;
    let leaving = false;
    let finish: ReturnType<typeof setTimeout> | undefined;

    const leave = (ms: number) => {
      if (leaving) return;
      leaving = true;
      clearInterval(tick);
      root.style.setProperty("--intro-leave", `${ms}ms`);
      // Leaving releases the scroll lock at once (see globals.css); only the
      // fade itself still needs the attribute, so a late cleanup timer can
      // never hold the page hostage.
      root.setAttribute("data-intro", "leaving");
      finish = setTimeout(() => {
        root.removeAttribute("data-intro");
        root.style.removeProperty("--intro-leave");
        setDone(true);
      }, ms);
    };

    const tick = setInterval(() => {
      const elapsed = performance.now() - start;
      const next = Math.max(
        0,
        Math.min(TICKS, Math.floor((elapsed - START_DELAY_MS) / TICK_MS) + 1),
      );
      if (next !== shown) {
        shown = next;
        setCount(next);
      }
      if (elapsed >= END_MS) leave(LEAVE_MS);
    }, 40);

    // Nobody is watching a hidden tab. If the page starts hidden, or is
    // hidden part-way through, go straight to the site instead of playing
    // (or finishing) an intro no one sees.
    const onVisibility = () => {
      if (document.hidden) leave(0);
    };
    if (document.hidden) leave(0);
    document.addEventListener("visibilitychange", onVisibility);

    const skip = () => leave(SKIP_LEAVE_MS);
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", skip, opts);
    window.addEventListener("keydown", skip, opts);
    window.addEventListener("wheel", skip, opts);
    window.addEventListener("touchstart", skip, opts);

    return () => {
      clearInterval(tick);
      clearTimeout(finish);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, []);

  if (done) return null;

  const pts = SERIES.slice(0, count);
  const latest = pts[pts.length - 1];
  const flagIndex = pts.findIndex((p) => p.anomaly);
  const flag = flagIndex >= 0 ? pts[flagIndex] : null;

  const band =
    pts.length > 1
      ? path(pts, (p) => p.mean + THRESHOLD * p.std) +
        " " +
        [...pts]
          .map((p, i) => ({ p, i }))
          .reverse()
          .map(
            ({ p, i }) =>
              `L ${x(i).toFixed(1)} ${y(p.mean - THRESHOLD * p.std).toFixed(1)}`,
          )
          .join(" ") +
        " Z"
      : "";

  return (
    // Decorative preview of content that exists in full further down the
    // page, so it is hidden from assistive tech; the page is readable under it.
    <div aria-hidden="true" className="intro">
      <div className="intro-chart w-[min(32rem,calc(100vw-2.5rem))]">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <span className="text-micro font-medium text-silk-dim">
            TradeWatch · live demo
          </span>
          <span className="font-mono text-micro text-silk-faint">
            |z| &gt; {THRESHOLD}
          </span>
        </div>

        <div className="mb-2 flex items-baseline gap-3">
          <span className="rounded-trace border border-hairline px-1.5 py-0.5 font-mono text-micro text-silk-dim">
            TW-SIM
          </span>
          <span className="font-mono text-h3 text-silk tabular-nums">
            {latest ? (PRICE_BASE + latest.value).toFixed(2) : " "}
          </span>
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-32 w-full overflow-visible"
            focusable="false"
          >
            {band && <path d={band} fill="var(--silk)" fillOpacity={0.05} />}
            {pts.length > 1 && (
              <>
                <path
                  d={path(pts, (p) => p.mean)}
                  fill="none"
                  stroke="var(--edge)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={path(pts, (p) => p.value)}
                  fill="none"
                  stroke="var(--silk-dim)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            {flag && (
              <>
                <circle
                  className="signal-pulse"
                  cx={x(flagIndex)}
                  cy={y(flag.value)}
                  r={3}
                  fill="none"
                  stroke="var(--copper)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={x(flagIndex)}
                  cy={y(flag.value)}
                  r={2.5}
                  fill="var(--copper)"
                />
              </>
            )}
            {latest && !flag && (
              <circle
                cx={x(pts.length - 1)}
                cy={y(latest.value)}
                r={2}
                fill="var(--silk)"
              />
            )}
          </svg>
          {flag && (
            <span
              className="pointer-events-none absolute rounded-trace border border-copper bg-substrate px-1 font-mono text-micro leading-4 text-copper"
              style={{
                left: `${(x(flagIndex) / W) * 100}%`,
                top: `${(y(flag.value) / H) * 100}%`,
                transform: `translate(calc(-100% - 6px), ${
                  flag.z > 0 ? "4px" : "calc(-100% - 4px)"
                })`,
              }}
            >
              ANOMALY
            </span>
          )}
        </div>

        <p className="mt-3 min-h-[1.5em] text-micro text-silk-dim">
          {flag ? (
            <>
              Unusual move:{" "}
              <span className="font-mono text-copper">
                {Math.abs(flag.z).toFixed(1)}σ
              </span>{" "}
              {flag.z > 0 ? "above" : "below"} its rolling average
            </>
          ) : (
            "Watching a synthetic price for unusual moves"
          )}
        </p>
      </div>

      <p className="absolute bottom-6 text-micro text-silk-faint">
        Click or press any key to skip
      </p>
    </div>
  );
}
