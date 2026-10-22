"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  GROUPS,
  GROUP_ID,
  SUBSCRIBES,
  closeMinute,
  consume,
  initialSim,
  lag,
  produce,
  setRunning,
  type Group,
  type Sim,
  type Topic,
} from "@/lib/pipeline";
import { NO_RESTORE } from "@/lib/no-restore";

/**
 * TradeWatch's pipeline, running. Send trades, seal a minute, stop and
 * restart consumers, and watch each consumer group keep its own place in the
 * log. lib/pipeline.ts holds the rules; this file only animates them.
 *
 * Drawn in the site's trace language: hairline routing, 90° elbows, copper
 * for what is moving. Box labels are component names, so they are mono.
 */

const BOX_H = 26;
type Pt = readonly [number, number];
type Box = {
  x: number;
  y: number;
  w: number;
  label: string;
  kind: "topic" | "worker" | "sink";
};

const B = {
  provider: { x: 8, y: 112, w: 82, label: "provider", kind: "worker" },
  trades: { x: 118, y: 112, w: 104, label: "trades topic", kind: "topic" },
  persist: { x: 250, y: 21, w: 110, label: "persist", kind: "worker" },
  aggregator: { x: 250, y: 112, w: 110, label: "aggregator", kind: "worker" },
  broadcaster: { x: 250, y: 203, w: 110, label: "broadcaster", kind: "worker" },
  postgres: { x: 388, y: 21, w: 96, label: "postgres", kind: "sink" },
  bars: { x: 388, y: 112, w: 96, label: "bars.1m topic", kind: "topic" },
  ws: { x: 388, y: 203, w: 96, label: "redis → ws", kind: "sink" },
  paper: { x: 512, y: 67, w: 116, label: "paper trading", kind: "worker" },
  detector: {
    x: 512,
    y: 157,
    w: 116,
    label: "anomaly detector",
    kind: "worker",
  },
  anomalies: {
    x: 656,
    y: 157,
    w: 104,
    label: "anomalies topic",
    kind: "topic",
  },
  dispatcher: {
    x: 788,
    y: 157,
    w: 104,
    label: "alert dispatcher",
    kind: "worker",
  },
} satisfies Record<string, Box>;

const cy = (b: Box) => b.y + BOX_H / 2;
const right = (b: Box): Pt => [b.x + b.w, cy(b)];
const left = (b: Box): Pt => [b.x, cy(b)];

/** An elbow from one box's right edge to another's left edge. */
const elbow = (from: Box, to: Box): Pt[] => {
  const [x1, y1] = right(from);
  const [x2, y2] = left(to);
  const mx = x1 + (x2 - x1) / 2;
  return y1 === y2
    ? [
        [x1, y1],
        [x2, y2],
      ]
    : [
        [x1, y1],
        [mx, y1],
        [mx, y2],
        [x2, y2],
      ];
};

const TOPIC_BOX: Record<Topic, Box> = {
  trades: B.trades,
  bars: B.bars,
  anomalies: B.anomalies,
};

/** The route a message takes from its topic to each consumer. */
const IN: Record<Group, Pt[]> = Object.fromEntries(
  GROUPS.map((g) => [g, elbow(TOPIC_BOX[SUBSCRIBES[g]], B[g])]),
) as Record<Group, Pt[]>;

const PRODUCE = elbow(B.provider, B.trades);
/** Where a worker's output goes after it handles a message. */
const OUT: Partial<Record<Group, Pt[]>> = {
  persist: elbow(B.persist, B.postgres),
  broadcaster: elbow(B.broadcaster, B.ws),
  detector: elbow(B.detector, B.anomalies),
};
const SEAL = elbow(B.aggregator, B.bars);

const TRACES = [PRODUCE, ...Object.values(IN), ...Object.values(OUT), SEAL].map(
  (pts) => "M " + pts.map((p) => p.join(" ")).join(" L "),
);

const TRAVEL_MS = 520;
type Dot = { id: number; pts: Pt[]; hot: boolean };

/** Per-segment keyframe times so a dot moves at constant speed. */
function times(pts: Pt[]) {
  const seg = pts
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return [0, ...seg.map((d) => (acc += d) / total)];
}

const LABEL: Record<Group, string> = {
  persist: "persist",
  aggregator: "aggregator",
  broadcaster: "broadcaster",
  paper: "paper trading",
  detector: "anomaly detector",
  dispatcher: "alert dispatcher",
};

export function PipelineDiagram() {
  const reduced = useReducedMotion();
  const sim = useRef<Sim>(initialSim());
  const [view, setView] = useState<Sim>(initialSim);
  const [dots, setDots] = useState<Dot[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const inflight = useRef<Record<Group, number>>(
    Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>,
  );
  const busy = useRef<Partial<Record<Group, boolean>>>({});
  const nextDot = useRef(0);

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);

  const travel = reduced ? 0 : TRAVEL_MS;

  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };

  const commit = (s: Sim) => {
    sim.current = s;
    setView(s);
  };

  const fly = (pts: Pt[], hot = false) => {
    if (reduced) return;
    const id = nextDot.current++;
    setDots((d) => [...d.slice(-60), { id, pts, hot }]);
  };

  const deliver = (t: Topic) => {
    for (const g of GROUPS) if (SUBSCRIBES[g] === t) drain(g);
  };

  /** Hand group `g` everything it is behind on, one message per dot. */
  function drain(g: Group) {
    const s = sim.current;
    if (busy.current[g] || !s.running[g]) return;
    const pending = lag(s, g) - inflight.current[g];
    if (pending <= 0) return;
    busy.current[g] = true;
    inflight.current[g]++;
    const hot = s.log[SUBSCRIBES[g]][s.offsets[g] + inflight.current[g] - 1];
    fly(IN[g], hot);
    later(travel, () => {
      inflight.current[g]--;
      const [next, out] = consume(sim.current, g);
      if (next === sim.current) return;
      commit(next);
      const route = OUT[g];
      if (route) fly(route, out === "anomalies");
      if (out) later(travel, () => deliver(out));
    });
    // A backlog drains quicker than single messages arrive.
    later(pending > 3 ? travel / 4 : travel / 2, () => {
      busy.current[g] = false;
      drain(g);
    });
  }

  const send = (n: number, unusual = false) => {
    for (let i = 0; i < n; i++)
      later((i * travel) / 3, () => {
        fly(PRODUCE, unusual);
        later(travel, () => {
          commit(produce(sim.current, unusual));
          deliver("trades");
        });
      });
  };

  const seal = () => {
    const [next, out] = closeMinute(sim.current);
    if (!out) return;
    commit(next);
    fly(SEAL, next.log.bars[next.log.bars.length - 1]);
    later(travel, () => deliver(out));
  };

  const toggle = (g: Group) => {
    const on = !sim.current.running[g];
    commit(setRunning(sim.current, g, on));
    if (on) drain(g);
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    for (const g of GROUPS) inflight.current[g] = 0;
    busy.current = {};
    setDots([]);
    commit(initialSim());
  };

  const v = view;
  const canSeal = v.running.aggregator && v.bar.trades > 0;
  const stat = (b: Box, text: string, hot = false) => (
    <text
      x={b.x + b.w / 2}
      y={b.y + BOX_H + 12}
      textAnchor="middle"
      fontFamily="var(--font-mono)"
      fontSize={9}
      fill={hot ? "var(--copper)" : "var(--silk-faint)"}
    >
      {text}
    </text>
  );
  const groupStat = (g: Group) => {
    const l = lag(v, g);
    return v.running[g]
      ? `offset ${v.offsets[g]}${l ? ` · lag ${l}` : ""}`
      : `stopped · lag ${l}`;
  };

  return (
    <div>
      <p className="px-4 pt-3 text-micro text-silk-faint sm:hidden">
        The diagram scrolls sideways.
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label="Pipeline diagram (scrolls sideways)"
        className="overflow-x-auto border-b border-hairline px-4 py-4"
      >
        <svg
          viewBox="0 0 900 250"
          className="block w-full min-w-[42rem]"
          role="img"
          aria-label={`Pipeline: a provider publishes trades to a Kafka topic read by three independent consumer groups (persist to Postgres, the bar aggregator, and the broadcaster to WebSockets). The aggregator publishes one-minute bars to a second topic read by paper trading and the anomaly detector, which publishes flags to an anomalies topic read by the alert dispatcher. Now: ${v.log.trades.length} trades, ${v.log.bars.length} bars, ${v.log.anomalies.length} flagged.`}
        >
          {TRACES.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth={1}
              stroke="var(--edge)"
            />
          ))}

          {Object.entries(B).map(([key, b]) => {
            const g = key as Group;
            const stopped = g in v.running && !v.running[g];
            return (
              <g key={key} opacity={stopped ? 0.45 : 1}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={BOX_H}
                  rx={2}
                  fill={
                    b.kind === "topic" ? "var(--copper-wash)" : "var(--surface)"
                  }
                  stroke={
                    b.kind === "topic" ? "var(--copper-spent)" : "var(--edge)"
                  }
                  strokeDasharray={stopped ? "3 3" : undefined}
                  strokeWidth={1}
                />
                <text
                  x={b.x + b.w / 2}
                  y={cy(b) + 3.5}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={10}
                  fill="var(--silk-dim)"
                >
                  {b.label}
                </text>
              </g>
            );
          })}

          {stat(B.trades, `${v.log.trades.length} messages`)}
          {stat(B.bars, `${v.log.bars.length} bars`)}
          {stat(
            B.anomalies,
            `${v.log.anomalies.length} flagged`,
            v.log.anomalies.length > 0,
          )}
          {stat(B.postgres, `${v.offsets.persist} rows`)}
          {stat(B.ws, `${v.offsets.broadcaster} pushes`)}
          {GROUPS.map((g) => (
            <g key={g}>
              {stat(B[g], groupStat(g), !v.running[g] || lag(v, g) > 3)}
            </g>
          ))}
          {stat(
            { ...B.aggregator, y: B.aggregator.y + 11 },
            `bar: ${v.bar.trades} trade${v.bar.trades === 1 ? "" : "s"}`,
          )}
          <text
            x={B.dispatcher.x + B.dispatcher.w / 2}
            y={B.dispatcher.y + BOX_H + 23}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={9}
            fill={v.offsets.dispatcher ? "var(--copper)" : "var(--silk-faint)"}
          >
            {v.offsets.dispatcher} alert{v.offsets.dispatcher === 1 ? "" : "s"}
          </text>

          {dots.map((d) => (
            <motion.circle
              key={d.id}
              r={d.hot ? 4 : 3}
              fill={d.hot ? "var(--copper)" : "var(--signal)"}
              initial={{ cx: d.pts[0][0], cy: d.pts[0][1] }}
              animate={{
                cx: d.pts.map((p) => p[0]),
                cy: d.pts.map((p) => p[1]),
              }}
              transition={{
                duration: TRAVEL_MS / 1000,
                ease: "linear",
                times: times(d.pts),
              }}
              onAnimationComplete={() =>
                setDots((all) => all.filter((x) => x.id !== d.id))
              }
            />
          ))}
        </svg>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-micro text-silk-faint">Provider</p>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => send(1)} primary>
              Send a trade
            </Btn>
            <Btn onClick={() => send(10)}>Send 10</Btn>
            <Btn onClick={() => send(1, true)}>Send a price spike</Btn>
            <Btn onClick={seal} disabled={!canSeal}>
              End the minute (seal bar)
            </Btn>
            <Btn onClick={reset}>Reset</Btn>
          </div>
        </div>
        <div>
          <p className="mb-2 text-micro text-silk-faint">
            Consumer groups: stop one, keep sending, then restart it
          </p>
          <ul className="flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <li key={g}>
                <button
                  type="button"
                  aria-pressed={!v.running[g]}
                  onClick={() => toggle(g)}
                  title={`group: ${GROUP_ID[g]}`}
                  className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-trace border px-2.5 font-mono text-micro pointer-coarse:min-h-11 ${
                    v.running[g]
                      ? "border-hairline text-silk-dim hover:border-copper hover:text-copper"
                      : "border-dashed border-copper text-copper"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${v.running[g] ? "bg-signal" : "bg-copper"}`}
                  />
                  {v.running[g] ? "stop" : "start"} {LABEL[g]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {`${v.log.trades.length} trades, ${v.offsets.persist} stored, ${v.log.bars.length} bars, ${v.log.anomalies.length} flagged, ${v.offsets.dispatcher} alerts.`}
      </p>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...NO_RESTORE}
      disabled={disabled}
      className={`inline-flex min-h-9 cursor-pointer items-center rounded-trace border px-3 text-micro disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11 ${
        primary
          ? "border-copper bg-copper font-medium text-substrate hover:bg-copper/90"
          : "border-hairline text-silk-dim hover:border-copper hover:text-copper"
      }`}
    >
      {children}
    </button>
  );
}
