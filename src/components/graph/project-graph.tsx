"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import {
  EDGES,
  GRAPH_VIEWBOX,
  NEIGHBOURS,
  NODE_BY_ID,
  NODES,
  TAGS,
} from "@/data/graph";

const NODE_R = 5;

/**
 * Project graph — DESIGN_BRIEF.md §2.2
 *
 * Nodes are projects, edges connect projects that share part of their stack.
 * Coordinates come precomputed from src/data/graph.ts: no physics, no layout
 * pass, no per-load jitter.
 *
 * The SVG is an enhancement layered over a real list. The list is visible, not
 * hidden, and its buttons drive exactly the same highlight the pointer does, so
 * a keyboard user gets the diagram's information rather than a consolation
 * prize. That matters because a graph is the one thing on the page whose whole
 * value is relational.
 */
export function ProjectGraph() {
  const [cursorNode, setCursorNode] = useState<string | null>(null);
  const [cursorTag, setCursorTag] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const neighbours = cursorNode ? NEIGHBOURS.get(cursorNode) : undefined;

  // Tag filter dims non-matching nodes (§2.2).
  const dimmed = useMemo(() => {
    if (!cursorTag) return null;
    return new Set(
      NODES.filter((n) => !n.tags.includes(cursorTag)).map((n) => n.id),
    );
  }, [cursorTag]);

  const isDim = (id: string) => dimmed?.has(id) ?? false;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      {/*
        Below md the diagram is REPLACED by the list beside it, not scaled
        down (DESIGN_BRIEF.md §2.2). A 720-unit graph squeezed into a 375px
        phone is illegible, and an illegible diagram is decoration.
      */}
      <div className="hidden min-w-0 flex-1 md:block">
        <svg
          viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`}
          className="w-full border border-hairline"
          role="img"
          aria-label="Diagram of how the modules in this repository relate. The same information is in the list beside it."
        >
          {EDGES.map((edge, i) => {
            const a = NODE_BY_ID.get(edge.from);
            const b = NODE_BY_ID.get(edge.to);
            if (!a || !b) return null;

            const touched = cursorNode === edge.from || cursorNode === edge.to;
            const tagMatch = cursorTag ? edge.via === cursorTag : false;
            const faded =
              (dimmed && !tagMatch) || (cursorNode !== null && !touched);

            const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <motion.path
                  d={d}
                  stroke={
                    touched || tagMatch ? "var(--copper)" : "var(--hairline)"
                  }
                  strokeWidth={1}
                  fill="none"
                  style={{ opacity: faded ? 0.35 : 1 }}
                  // Draw-in on first view only, never on scroll re-entry (§2.4).
                  initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: 0.4,
                          delay: i * 0.02,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                />
                {/* packet, hover only (§2.3) */}
                <path
                  className="packet"
                  data-packet={touched ? "on" : "off"}
                  d={d}
                  pathLength={100}
                  stroke="var(--copper)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            );
          })}

          {NODES.map((node) => {
            const isCursor = node.id === cursorNode;
            const isNeighbour = neighbours?.has(node.id) ?? false;
            const lit = isCursor || isNeighbour;
            const faded = isDim(node.id) || (cursorNode !== null && !lit);

            return (
              <g
                key={node.id}
                style={{ opacity: faded ? 0.3 : 1 }}
                onMouseEnter={() => setCursorNode(node.id)}
                onMouseLeave={() => setCursorNode(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_R}
                  fill={lit ? "var(--copper)" : "var(--substrate)"}
                  stroke={lit ? "var(--copper)" : "var(--edge)"}
                  strokeWidth={1}
                />
                {/* module and project names are identifiers, not prose (§2.6) */}
                <text
                  x={node.x + 11}
                  y={node.y + 3.5}
                  fontFamily="var(--font-mono)"
                  fontSize={11}
                  fill={lit ? "var(--copper)" : "var(--silk-faint)"}
                >
                  {node.label}
                </text>
                {/* pointer hit area */}
                <circle cx={node.x} cy={node.y} r={16} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="lg:w-56 lg:shrink-0">
        <h3 className="mb-3 text-micro font-medium text-silk-dim">
          Shared layer
        </h3>
        <ul className="mb-8 flex flex-wrap gap-2 lg:flex-col lg:items-start">
          {TAGS.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onMouseEnter={() => setCursorTag(tag)}
                onMouseLeave={() => setCursorTag(null)}
                onFocus={() => setCursorTag(tag)}
                onBlur={() => setCursorTag(null)}
                aria-pressed={cursorTag === tag}
                className={`cursor-pointer rounded-trace border border-hairline px-2 py-1 font-mono text-micro ${
                  cursorTag === tag
                    ? "border-copper text-copper"
                    : "text-silk-faint hover:text-silk"
                }`}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mb-3 text-micro font-medium text-silk-dim">Nodes</h3>
        <ul className="flex flex-col gap-3 md:gap-1">
          {NODES.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onMouseEnter={() => setCursorNode(node.id)}
                onMouseLeave={() => setCursorNode(null)}
                onFocus={() => setCursorNode(node.id)}
                onBlur={() => setCursorNode(null)}
                className={`w-full cursor-pointer rounded-trace text-left font-mono text-micro ${
                  cursorNode === node.id
                    ? "text-copper"
                    : "text-silk-faint hover:text-silk"
                }`}
              >
                {node.label}
                {/*
                  Visible below md, where this list stands in for the diagram,
                  and screen-reader-only above md where the diagram carries it.
                  Either way the relationships are available without a pointer.
                */}
                <span className="block text-silk-faint md:sr-only">
                  {`connects to ${[...(NEIGHBOURS.get(node.id) ?? [])].join(", ") || "nothing"}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
