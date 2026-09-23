/**
 * Graph dataset — DESIGN_BRIEF.md §2.2
 *
 * Nodes are projects. Edges join projects that share part of a stack.
 *
 * Coordinates live on each project in `projects.ts`, authored by hand and
 * committed. There is no force simulation and no layout pass at runtime, so the
 * diagram is identical on every visit — a schematic rather than a screensaver.
 *
 * Edges are derived from the real stack lists rather than maintained by hand,
 * so they cannot fall out of step with the project content. The derivation runs
 * once at module scope and is deterministic: same input, same output, every time.
 */

import { PROJECTS, type Project } from "@/data/projects";

export type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  /** Every technology the two projects have in common. */
  via: readonly string[];
};

export const GRAPH_VIEWBOX = { width: 820, height: 420 } as const;

/**
 * "Python (visualizer)" and "Python" are the same technology for the purpose of
 * drawing an edge. Lowercase and drop any parenthetical qualifier.
 */
const normalise = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim();

export const NODES: readonly GraphNode[] = PROJECTS.map((p: Project) => ({
  id: p.id,
  label: p.name,
  x: p.node.x,
  y: p.node.y,
}));

/** normalised tag -> the projects using it, in declaration order. */
const BY_TAG: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const p of PROJECTS) {
    for (const tag of p.stack) {
      const key = normalise(tag);
      const list = map.get(key);
      if (list) list.push(p.id);
      else map.set(key, [p.id]);
    }
  }
  return map;
})();

/**
 * Only a technology that more than one project uses can produce an edge, so
 * those are also exactly the tags worth offering as a filter.
 */
export const SHARED_TAGS: readonly string[] = [...BY_TAG.entries()]
  .filter(([, ids]) => ids.length > 1)
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  .map(([tag]) => tag);

export const EDGES: readonly GraphEdge[] = (() => {
  const pairs = new Map<string, string[]>();
  for (const tag of SHARED_TAGS) {
    const ids = BY_TAG.get(tag) ?? [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        const existing = pairs.get(key);
        if (existing) existing.push(tag);
        else pairs.set(key, [tag]);
      }
    }
  }
  return [...pairs.entries()].map(([key, via]) => {
    const [from, to] = key.split("|");
    return { from, to, via };
  });
})();

/** Adjacency, built once rather than per render. */
export const NEIGHBOURS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const n of NODES) map.set(n.id, new Set());
  for (const e of EDGES) {
    map.get(e.from)?.add(e.to);
    map.get(e.to)?.add(e.from);
  }
  return map;
})();

/** Which projects carry a given normalised tag. Used by the legend filter. */
export function projectsWithTag(tag: string): readonly string[] {
  return BY_TAG.get(tag) ?? [];
}

export const NODE_BY_ID: ReadonlyMap<string, GraphNode> = new Map(
  NODES.map((n) => [n.id, n]),
);
