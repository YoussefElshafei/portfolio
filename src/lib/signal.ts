/**
 * Synthetic signal generation and rolling anomaly detection.
 *
 * This is the logic behind the Live Signal widget on the TradeWatch entry. It
 * is a genuine, simplified implementation of the same statistical check
 * TradeWatch runs against real market data: a rolling mean and standard
 * deviation over a moving window, with points flagged by z-score.
 *
 * Deliberately pure and free of React so it can be read, reasoned about and
 * tested on its own. Nothing here calls `Math.random()`.
 *
 * Two honesty notes, because they matter for reading the output correctly:
 *
 *  1. The *data* is synthetic. It is a mean-reverting random walk with
 *     occasional volatility shocks, which is what makes the demo interesting
 *     within a few seconds rather than a few minutes. Real price series have
 *     fat tails, so the shocks are a fair approximation rather than a cheat.
 *
 *  2. The *detector* is real and knows nothing about where the shocks are. It
 *     sees only the series, computes rolling statistics, and flags on z-score.
 *     It will miss shocks that land inside normal variance and will flag
 *     ordinary points that happen to sit far from the local mean. That is the
 *     honest behaviour of this class of detector, and it is not corrected for.
 */

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random source
 * ------------------------------------------------------------------ */

/**
 * mulberry32. A small, fast, well-distributed 32-bit PRNG.
 *
 * Seeded, so the series is identical on every visit and identical between the
 * server render and the client hydration — the same reason the project graph's
 * coordinates are committed rather than simulated (DESIGN_BRIEF.md §2.2).
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal sample via the Box–Muller transform.
 *
 * `u` is resampled while it is exactly 0 because log(0) is -Infinity.
 */
export function gaussian(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------------ *
 * Rolling statistics
 * ------------------------------------------------------------------ */

export type Stats = { mean: number; std: number };

/**
 * Mean and *sample* standard deviation (n-1 denominator) of a window.
 *
 * Recomputed across the whole window each tick rather than maintained
 * incrementally. At a window of 30 that is thirty additions, which is nothing,
 * and it avoids the classic failure of subtract-as-you-go running variance:
 * repeatedly adding and removing terms accumulates floating-point error and
 * can drift to a small negative variance, at which point the square root is
 * NaN and every downstream z-score is silently broken. Correctness first at
 * this size.
 */
export function rollingStats(window: readonly number[]): Stats {
  const n = window.length;
  if (n === 0) return { mean: Number.NaN, std: Number.NaN };
  if (n === 1) return { mean: window[0], std: 0 };

  let sum = 0;
  for (const v of window) sum += v;
  const mean = sum / n;

  let sumSq = 0;
  for (const v of window) {
    const d = v - mean;
    sumSq += d * d;
  }
  return { mean, std: Math.sqrt(sumSq / (n - 1)) };
}

/**
 * How many standard deviations `value` sits from `mean`.
 *
 * Returns 0 when the baseline has effectively no spread. A flat window makes
 * the z-score undefined rather than infinite, and reporting 0 keeps a
 * degenerate baseline from flagging every subsequent point.
 */
export function zScore(value: number, { mean, std }: Stats): number {
  if (!Number.isFinite(std) || std < 1e-9) return 0;
  return (value - mean) / std;
}

/* ------------------------------------------------------------------ *
 * The detector
 * ------------------------------------------------------------------ */

export const WINDOW = 30;
export const THRESHOLD = 2.5;
/** Points kept on screen. Must exceed WINDOW so a full baseline always exists. */
export const VIEW = 72;

export type Sample = {
  /** Monotonic tick index since the series began. */
  t: number;
  value: number;
  /** Rolling mean of the WINDOW points *before* this one. */
  mean: number;
  std: number;
  z: number;
  anomaly: boolean;
};

/**
 * Judges `value` against the window of points that came *before* it.
 *
 * The exclusion is the important part. If the point under test is included in
 * its own baseline it drags the mean toward itself and inflates the standard
 * deviation, which shrinks its own z-score — the larger the outlier, the more
 * it hides itself. With a window of 30 a true 4-sigma spike scores about 3.4
 * if it is allowed into its own baseline. Judge each point against its past.
 */
export function classify(
  history: readonly number[],
  value: number,
  t: number,
  windowSize: number = WINDOW,
  threshold: number = THRESHOLD,
): Sample {
  const baseline = history.slice(-windowSize);
  const stats = rollingStats(baseline);
  const z = zScore(value, stats);

  return {
    t,
    value,
    mean: stats.mean,
    std: stats.std,
    z,
    // A baseline shorter than the window has not warmed up, so nothing is
    // flagged yet rather than being flagged against two or three points.
    anomaly: baseline.length >= windowSize && Math.abs(z) > threshold,
  };
}

/* ------------------------------------------------------------------ *
 * The synthetic series
 * ------------------------------------------------------------------ */

const MU = 0; // long-run level
const THETA = 0.08; // pull back toward MU per tick
const SIGMA = 1; // ordinary step size
const SHOCK_PROB = 0.022; // chance of a volatility shock on a given tick
const SHOCK_MIN = 3.2; // shock magnitude, in units of SIGMA
const SHOCK_MAX = 5.5;

export type SignalStream = {
  /** Produces the next sample and records it in the stream's own history. */
  next: () => Sample;
};

/**
 * A mean-reverting (Ornstein–Uhlenbeck) random walk with occasional shocks.
 *
 * Mean reversion keeps the series inside a fixed vertical range, so the chart
 * needs no rescaling axis and does not visibly jitter as it ticks.
 */
export function createSignalStream(seed: number, warmup = 0): SignalStream {
  const rng = createRng(seed);
  const history: number[] = [];
  let level = MU;
  let t = 0;

  const advance = (): Sample => {
    level += THETA * (MU - level) + SIGMA * gaussian(rng);

    if (rng() < SHOCK_PROB) {
      const magnitude = SHOCK_MIN + rng() * (SHOCK_MAX - SHOCK_MIN);
      level += (rng() < 0.5 ? -1 : 1) * magnitude * SIGMA;
    }

    const sample = classify(history, level, t++);
    history.push(level);
    if (history.length > WINDOW * 2) history.shift();
    return sample;
  };

  for (let i = 0; i < warmup; i++) advance();

  return { next: advance };
}

/**
 * The series as it stands when the widget first paints.
 *
 * Computed at module scope so the server render and the client hydration use
 * the identical array — deterministic input, deterministic output, no
 * hydration mismatch and no flash of an empty chart. The widget's own stream
 * is then fast-forwarded past this prefix so ticking continues seamlessly.
 */
export const PRIMED_TICKS = WINDOW + VIEW;

export function primedSeries(seed: number): Sample[] {
  const stream = createSignalStream(seed);
  const out: Sample[] = [];
  for (let i = 0; i < PRIMED_TICKS; i++) out.push(stream.next());
  return out.slice(-VIEW);
}
