"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import {
  EDGES,
  GRAPH_VIEWBOX,
  NEIGHBOURS,
  NODE_BY_ID,
  NODES,
  SHARED_TAGS,
  projectsWithTag,
} from "@/data/graph";

const NODE_R = 5;

/**
 * Project graph — DESIGN_BRIEF.md §2.2
 *
 * Nodes are projects, edges join projects that share part of a stack.
 * Coordinates are precomputed and committed: no physics, no per-load jitter.
 *
 * Accessibility follows the same rule as the trace bus. The SVG is decorative
 * and `aria-hidden`; the list beside it holds the real links, the real tab
 * stops and the same highlighting behaviour. Exposing both would give a
 * keyboard user six duplicate links for no benefit.
 *
 * Below `md` the diagram is replaced by that list rather than scaled down. An
 * 820-unit schematic squeezed into 375px is illegible, and an illegible diagram
 * is decoration.
 */
export function ProjectGraph() {
  const [cursorNode, setCursorNode] = useState<string | null>(null);
  const [cursorTag, setCursorTag] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const neighbours = cursorNode ? NEIGHBOURS.get(cursorNode) : undefined;

  const taggedIds = useMemo(
    () => (cursorTag ? new Set(projectsWithTag(cursorTag)) : null),
    [cursorTag],
  );

  const nodeState = (id: string) => {
    if (taggedIds) return taggedIds.has(id) ? "lit" : "dim";
    if (!cursorNode) return "rest";
    if (id === cursorNode) return "lit";
    return neighbours?.has(id) ? "lit" : "dim";
  };

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
      <div className="hidden min-w-0 flex-1 md:block">
        <svg
          viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`}
          className="w-full border border-hairline"
          aria-hidden="true"
          focusable="false"
        >
          {EDGES.map((edge, i) => {
            const a = NODE_BY_ID.get(edge.from);
            const b = NODE_BY_ID.get(edge.to);
            if (!a || !b) return null;

            const touched = cursorNode === edge.from || cursorNode === edge.to;
            const tagMatch = cursorTag ? edge.via.includes(cursorTag) : false;
            const lit = touched || tagMatch;
            const faded = (cursorNode !== null || cursorTag !== null) && !lit;
            const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <motion.path
                  d={d}
                  stroke={lit ? "var(--copper)" : "var(--hairline)"}
                  strokeWidth={1}
                  fill="none"
                  style={{ opacity: faded ? 0.3 : 1 }}
                  // Draws in on first view only, never on scroll re-entry (§2.4).
                  initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: 0.4,
                          delay: i * 0.03,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                />
                {/* Packet: hover only, once, never ambient (§2.3). */}
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
            const state = nodeState(node.id);
            const lit = state === "lit";

            return (
              <g
                key={node.id}
                style={{ opacity: state === "dim" ? 0.28 : 1 }}
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
                {/* A project name is a name, not a machine fact, so it is
                    set in the sans face (§2.6). */}
                <text
                  x={node.x + 12}
                  y={node.y + 4}
                  fontFamily="var(--font-sans)"
                  fontSize={12.5}
                  fill={lit ? "var(--copper)" : "var(--silk-dim)"}
                >
                  {node.label}
                </text>
                <a href={`#work-${node.id}`} tabIndex={-1}>
                  <circle cx={node.x} cy={node.y} r={18} fill="transparent" />
                </a>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="lg:w-60 lg:shrink-0">
        <h3 className="mb-3 text-micro font-medium text-silk-dim">
          Shared stack
        </h3>
        <ul className="mb-8 flex flex-wrap gap-2">
          {SHARED_TAGS.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onMouseEnter={() => setCursorTag(tag)}
                onMouseLeave={() => setCursorTag(null)}
                onFocus={() => setCursorTag(tag)}
                onBlur={() => setCursorTag(null)}
                aria-pressed={cursorTag === tag}
                className={`cursor-pointer rounded-trace border px-2 py-1 font-mono text-micro ${
                  cursorTag === tag
                    ? "border-copper text-copper"
                    : "border-hairline text-silk-faint hover:text-silk"
                }`}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mb-3 text-micro font-medium text-silk-dim">Projects</h3>
        <ul className="flex flex-col gap-3 md:gap-1.5">
          {NODES.map((node) => {
            const links = [...(NEIGHBOURS.get(node.id) ?? [])].map(
              (id) => NODE_BY_ID.get(id)?.label ?? id,
            );
            return (
              <li key={node.id}>
                <a
                  href={`#work-${node.id}`}
                  onMouseEnter={() => setCursorNode(node.id)}
                  onMouseLeave={() => setCursorNode(null)}
                  onFocus={() => setCursorNode(node.id)}
                  onBlur={() => setCursorNode(null)}
                  className={`block rounded-trace text-micro ${
                    cursorNode === node.id
                      ? "text-copper"
                      : "text-silk-dim hover:text-silk"
                  }`}
                >
                  {node.label}
                  {/*
                    Visible below md, where this list stands in for the diagram,
                    and screen-reader-only above md where the diagram shows it.
                    Either way the relationships never require a pointer.
                  */}
                  <span className="block text-silk-faint md:sr-only">
                    {links.length > 0
                      ? `shares stack with ${links.join(", ")}`
                      : "shares no stack with the others"}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
