/**
 * TradeWatch's Kafka topology, small enough to run in a browser.
 *
 * The shape is the real one, read from the repository's worker modules:
 *
 *   provider → trades topic → persist (Postgres), aggregator, broadcaster
 *   aggregator seals 1-minute bars → bars topic → paper trading, anomaly detector
 *   anomaly detector → anomalies topic → alert dispatcher
 *
 * Every consumer is its own group with its own offset (ADR-0001), so stopping
 * one leaves the others untouched and a restarted one resumes from where it
 * committed. That independence is what the demo lets you poke at.
 *
 * Simplified on purpose: one symbol, no fills topic traffic (no strategy is
 * deployed here), and a bar counts as unusual when it holds a spike trade,
 * where the real detector scores each bar against its recent history.
 */

export type Topic = "trades" | "bars" | "anomalies";
export type Group =
  | "persist"
  | "aggregator"
  | "broadcaster"
  | "paper"
  | "detector"
  | "dispatcher";

export const GROUPS: readonly Group[] = [
  "persist",
  "aggregator",
  "broadcaster",
  "paper",
  "detector",
  "dispatcher",
];

/** Which topic each consumer group reads. */
export const SUBSCRIBES: Record<Group, Topic> = {
  persist: "trades",
  aggregator: "trades",
  broadcaster: "trades",
  paper: "bars",
  detector: "bars",
  dispatcher: "anomalies",
};

/** Group names as the repository spells them (ARCHITECTURE.md §7.4). */
export const GROUP_ID: Record<Group, string> = {
  persist: "processor-persist",
  aggregator: "bar-aggregator",
  broadcaster: "broadcaster",
  paper: "paper-trading",
  detector: "anomaly-detector",
  dispatcher: "alert-dispatcher",
};

export type Sim = {
  /** Each topic is an append-only log; `true` marks an unusual message. */
  log: Record<Topic, boolean[]>;
  /** Committed offset per group: how many messages it has processed. */
  offsets: Record<Group, number>;
  running: Record<Group, boolean>;
  /** The 1-minute bar the aggregator is currently filling. */
  bar: { trades: number; unusual: boolean };
};

const each = <T>(v: T) =>
  Object.fromEntries(GROUPS.map((g) => [g, v])) as Record<Group, T>;

export const initialSim = (): Sim => ({
  log: { trades: [], bars: [], anomalies: [] },
  offsets: each(0),
  running: each(true),
  bar: { trades: 0, unusual: false },
});

export const lag = (s: Sim, g: Group) =>
  s.log[SUBSCRIBES[g]].length - s.offsets[g];

/** The provider publishes one trade. */
export function produce(s: Sim, unusual = false): Sim {
  return { ...s, log: { ...s.log, trades: [...s.log.trades, unusual] } };
}

const publish = (s: Sim, t: Topic, unusual: boolean): Sim => ({
  ...s,
  log: { ...s.log, [t]: [...s.log[t], unusual] },
});

/**
 * Group `g` processes its next message, if it is running and behind.
 * Returns the new state and the topic it published to, if any.
 */
export function consume(s: Sim, g: Group): [Sim, Topic | null] {
  if (!s.running[g] || lag(s, g) <= 0) return [s, null];
  const msg = s.log[SUBSCRIBES[g]][s.offsets[g]];
  let next: Sim = { ...s, offsets: { ...s.offsets, [g]: s.offsets[g] + 1 } };
  let out: Topic | null = null;
  if (g === "aggregator")
    next = {
      ...next,
      bar: { trades: next.bar.trades + 1, unusual: next.bar.unusual || msg },
    };
  if (g === "detector" && msg) {
    next = publish(next, "anomalies", true);
    out = "anomalies";
  }
  return [next, out];
}

/**
 * The minute ends: the aggregator seals its bar and publishes it. Only a
 * running aggregator can, and only a bar with trades in it is published.
 */
export function closeMinute(s: Sim): [Sim, Topic | null] {
  if (!s.running.aggregator || s.bar.trades === 0) return [s, null];
  return [
    {
      ...publish(s, "bars", s.bar.unusual),
      bar: { trades: 0, unusual: false },
    },
    "bars",
  ];
}

export function setRunning(s: Sim, g: Group, on: boolean): Sim {
  return { ...s, running: { ...s.running, [g]: on } };
}
