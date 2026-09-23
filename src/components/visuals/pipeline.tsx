/**
 * TradeWatch ingestion pipeline.
 *
 * An abstract visual built from the project's own architecture rather than a
 * stock image or an invented sparkline: every box and every arrow here is
 * something the project description states. Drawn in the site's existing trace
 * language — hairline routing, 90° elbows, copper for the active path — so it
 * does not introduce a second visual style (DESIGN_BRIEF.md §2).
 *
 * Box labels are component names, so they are set in mono (§2.6).
 * Static by design: a diagram, not an animation.
 */

const BOX_H = 26;
const Y_MID = 67;
const Y_TOP = 20;
const Y_BOT = 114;

type Box = { x: number; y: number; w: number; label: string };

const BOXES: readonly Box[] = [
  { x: 6, y: Y_MID, w: 76, label: "provider" },
  { x: 112, y: Y_MID, w: 62, label: "kafka" },
  { x: 204, y: Y_TOP, w: 92, label: "raw trades" },
  { x: 326, y: Y_TOP, w: 82, label: "postgres" },
  { x: 204, y: Y_BOT, w: 92, label: "aggregator" },
  { x: 326, y: Y_BOT, w: 110, label: "1m + rollups" },
];

/** 90° elbows only, in the idiom of PCB routing. */
const TRACES: readonly { d: string; lit?: boolean }[] = [
  { d: "M 82 80 H 112" },
  { d: "M 174 80 H 188 V 33 H 204", lit: true },
  { d: "M 174 80 H 188 V 127 H 204", lit: true },
  { d: "M 296 33 H 326" },
  { d: "M 296 127 H 326" },
];

export function PipelineDiagram() {
  return (
    <figure className="my-8">
      <svg
        viewBox="0 0 450 160"
        className="w-full max-w-[28rem] border border-hairline"
        role="img"
        aria-label="Ingestion pipeline: a market data provider feeds Kafka, which fans out to two independent consumer groups. One stores raw trades in Postgres; the other aggregates into one-minute bars with rollups."
      >
        {TRACES.map((t) => (
          <path
            key={t.d}
            d={t.d}
            fill="none"
            strokeWidth={1}
            stroke={t.lit ? "var(--copper)" : "var(--edge)"}
          />
        ))}

        {BOXES.map((b) => (
          <g key={b.label}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={BOX_H}
              rx={2}
              fill="var(--surface)"
              stroke="var(--edge)"
              strokeWidth={1}
            />
            <text
              x={b.x + b.w / 2}
              y={b.y + BOX_H / 2 + 3.5}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--silk-dim)"
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 text-micro text-silk-faint">
        Two independent consumer groups read the same trade topic.
      </figcaption>
    </figure>
  );
}
