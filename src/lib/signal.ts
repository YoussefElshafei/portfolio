/**
 * Synthetic signal generation and rolling anomaly detection.
 *
 * This is the logic behind the Live Signal widget on the TradeWatch entry. It
 * is a simplified implementation of TradeWatch's baseline detector: each
 * move is scored by a robust z-score (median and median absolute deviation)
 * over a rolling window of recent moves, and flagged above 3.5.
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
 *     sees only the series, computes rolling statistics, and flags on a robust z-score.
 *     It will miss shocks that land inside normal variance and will flag
 *     ordinary moves that happen to be unusually large. That is the
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
 * Robust rolling statistics
 * ------------------------------------------------------------------ */

/**
 * The constant that makes a median absolute deviation comparable to a
 * standard deviation under a normal distribution, 1 / Φ⁻¹(3/4). TradeWatch
 * uses the same value (`_MAD_SCALE` in its baseline detector).
 */
export const MAD_SCALE = 1.4826;

export function median(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type RobustStats = {
  median: number;
  /** MAD × MAD_SCALE: a spread in the same units as a standard deviation. */
  sigma: number;
};

/**
 * Median and scaled median absolute deviation of a window.
 *
 * Why not mean and standard deviation: both are pulled by the very outliers
 * the detector is looking for. One large move inflates the "normal" range
 * enough to hide the next one. The median and the MAD barely notice a single
 * extreme value, which is the reason TradeWatch's baseline uses them
 * (ADR-0008 in that repository). It is also why the point under test can sit
 * inside its own window, as it does in TradeWatch, without hiding itself.
 */
export function robustStats(window: readonly number[]): RobustStats {
  const m = median(window);
  if (Number.isNaN(m)) return { median: Number.NaN, sigma: Number.NaN };
  const mad = median(window.map((v) => Math.abs(v - m)));
  return { median: m, sigma: mad * MAD_SCALE };
}

/**
 * How many robust standard deviations `value` sits from the median. Signed,
 * so the widget can say "above" or "below".
 *
 * Returns 0 when the window has no spread at all. TradeWatch declines to
 * score in that case; reporting 0 here keeps a degenerate window from
 * flagging every later point.
 */
export function robustZ(value: number, { median: m, sigma }: RobustStats) {
  if (!Number.isFinite(sigma) || sigma < 1e-9) return 0;
  return (value - m) / sigma;
}

/* ------------------------------------------------------------------ *
 * The detector
 * ------------------------------------------------------------------ */

/** TradeWatch's defaults: TW_ANOMALY_WINDOW_BARS and the baseline threshold. */
export const WINDOW = 60;
export const THRESHOLD = 3.5;
/** Points kept on screen. */
export const VIEW = 72;

export type Sample = {
  /** Monotonic tick index since the series began. */
  t: number;
  value: number;
  /** Where the detector expected this point: the previous value plus the
   *  median move of the window. */
  expected: number;
  /** Robust spread of a move, in price units. */
  sigma: number;
  /** Robust z-score of this point's move. */
  z: number;
  anomaly: boolean;
};

/**
 * Scores the move into `value`, the way TradeWatch's baseline scores a bar's
 * return: against the median and MAD of the last `windowSize` moves,
 * including this one.
 *
 * One feature instead of TradeWatch's several (return, volatility, volume and
 * trade count), and per tick instead of per closed one-minute bar. The rule
 * is the same one.
 */
export function classify(
  history: readonly number[],
  value: number,
  t: number,
  windowSize: number = WINDOW,
  threshold: number = THRESHOLD,
): Sample {
  const prev = history.length ? history[history.length - 1] : value;
  const moves: number[] = [];
  for (let i = 1; i < history.length; i++)
    moves.push(history[i] - history[i - 1]);
  const move = value - prev;
  const window = [...moves, move].slice(-windowSize);
  const stats = robustStats(window);
  const z = robustZ(move, stats);

  return {
    t,
    value,
    expected: prev + stats.median,
    sigma: stats.sigma,
    z,
    // Nothing is flagged until a full window of moves exists, rather than
    // being judged against two or three of them.
    anomaly: window.length >= windowSize && Math.abs(z) > threshold,
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
  /** Produces the next sample and records it in the stream's own history.
   *  `shock` adds an extra move of that many σ, for the demo's buttons. */
  next: (shock?: number) => Sample;
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

  const advance = (shock = 0): Sample => {
    level += THETA * (MU - level) + SIGMA * gaussian(rng) + shock * SIGMA;

    if (rng() < SHOCK_PROB) {
      const magnitude = SHOCK_MIN + rng() * (SHOCK_MAX - SHOCK_MIN);
      level += (rng() < 0.5 ? -1 : 1) * magnitude * SIGMA;
    }

    const sample = classify(history, level, t++);
    history.push(level);
    // WINDOW moves need WINDOW + 1 levels; keep a little slack.
    if (history.length > WINDOW + 2) history.shift();
    return sample;
  };

  for (let i = 0; i < warmup; i++) advance();

  return { next: (shock?: number) => advance(shock) };
}

/**
 * The series as it stands when the widget first paints.
 *
 * Computed at module scope so the server render and the client hydration use
 * the identical array — deterministic input, deterministic output, no
 * hydration mismatch and no flash of an empty chart. The widget's own stream
 * is then fast-forwarded past this prefix so ticking continues seamlessly.
 */
export const PRIMED_TICKS = WINDOW + 1 + VIEW;

export function primedSeries(seed: number): Sample[] {
  const stream = createSignalStream(seed);
  const out: Sample[] = [];
  for (let i = 0; i < PRIMED_TICKS; i++) out.push(stream.next());
  return out.slice(-VIEW);
}
