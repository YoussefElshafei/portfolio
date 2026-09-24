/**
 * Graph dataset — DESIGN_BRIEF.md §2.2
 *
 * Nodes are projects. Edges have two independent, real sources:
 *
 *   stack   the two projects share part of a tech stack
 *   people  the two projects share a named teammate
 *
 * They are kept as separate edges rather than merged into one "related" line,
 * because they mean different things and the diagram should not imply
 * otherwise. A pair can have both, and then both are drawn.
 *
 * The people source exists because stack alone left WireFish (C, raw sockets)
 * with no edge at all. Inventing a shared-tech link would have been false; a
 * shared teammate is true, so that is what connects it.
 *
 * Coordinates live on each project in `projects.ts`, authored by hand and
 * committed, in 3D. There is no force simulation and no layout pass at
 * runtime: the graph is one rigid object, identical on every visit, and the
 * only thing that changes is the angle it is viewed from (see
 * components/graph/project-graph.tsx and lib/rotation.ts).
 *
 * Edges are derived from the real stack and collaborator lists rather than
 * maintained by hand, so they cannot fall out of step with the project content.
 * The derivation runs once at module scope and is deterministic.
 */

import { PROJECTS, type Project } from "@/data/projects";
import type { Vec3 } from "@/lib/rotation";

export type GraphNode = {
  id: string;
  label: string;
  /** Model-space position, centred on the graph's centroid. */
  p: Vec3;
  /** Annotation drawn under the label; see Project.graphNote. */
  note?: string;
};

export type EdgeKind = "stack" | "people";

export type GraphEdge = {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Every technology (stack) or teammate (people) the two have in common. */
  via: readonly string[];
  /**
   * People edges only: the control point of the curve, in model space. Stored
   * in 3D so the curve rotates rigidly with everything else instead of being
   * re-bent every frame.
   */
  bend?: Vec3;
};

export const GRAPH_VIEWBOX = { width: 820, height: 520 } as const;

/**
 * "Python (visualizer)" and "Python" are the same technology for the purpose of
 * drawing an edge. Lowercase and drop any parenthetical qualifier.
 */
export const normalise = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim();

/**
 * Rotation happens about the centroid, so the graph turns in place rather than
 * orbiting some arbitrary corner of the old 2D viewBox.
 */
const CENTROID: Vec3 = (() => {
  const n = PROJECTS.length;
  const sum = PROJECTS.reduce(
    (s, p) => [s[0] + p.node.x, s[1] + p.node.y, s[2] + p.node.z],
    [0, 0, 0],
  );
  return [sum[0] / n, sum[1] / n, sum[2] / n];
})();

export const NODES: readonly GraphNode[] = PROJECTS.map((p: Project) => ({
  id: p.id,
  label: p.name,
  note: p.graphNote,
  p: [p.node.x - CENTROID[0], p.node.y - CENTROID[1], p.node.z - CENTROID[2]],
}));

/**
 * Radius of the sphere every node fits inside. Any rotation keeps every node
 * inside it, so it fixes the on-screen scale once: the graph never grows or
 * shrinks as it turns, only its depth cues change.
 */
export const MODEL_RADIUS = Math.max(
  ...NODES.map((n) => Math.hypot(n.p[0], n.p[1], n.p[2])),
);

/** key -> the projects carrying it, in declaration order. */
function index(keysOf: (p: Project) => readonly string[]) {
  const map = new Map<string, string[]>();
  for (const p of PROJECTS) {
    for (const key of keysOf(p)) {
      const list = map.get(key);
      if (list) list.push(p.id);
      else map.set(key, [p.id]);
    }
  }
  return map as ReadonlyMap<string, readonly string[]>;
}

const BY_TAG = index((p) => p.stack.map(normalise));
const BY_PERSON = index((p) => p.collaborators ?? []);

/**
 * Only a key more than one project carries can produce an edge, so those are
 * also exactly the keys worth offering as a filter. Most-shared first.
 */
function shared(map: ReadonlyMap<string, readonly string[]>) {
  return [...map.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([key]) => key);
}

export const SHARED_TAGS: readonly string[] = shared(BY_TAG);
export const SHARED_PEOPLE: readonly string[] = shared(BY_PERSON);

function edges(
  kind: EdgeKind,
  map: ReadonlyMap<string, readonly string[]>,
  keys: readonly string[],
): GraphEdge[] {
  const pairs = new Map<string, string[]>();
  for (const key of keys) {
    const ids = map.get(key) ?? [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pair = `${ids[i]}|${ids[j]}`;
        const existing = pairs.get(pair);
        if (existing) existing.push(key);
        else pairs.set(pair, [key]);
      }
    }
  }
  return [...pairs.entries()].map(([pair, via]) => {
    const [from, to] = pair.split("|");
    return kind === "people"
      ? { from, to, kind, via, bend: bendPoint(from, to) }
      : { from, to, kind, via };
  });
}

/**
 * How far a teammate curve's control point sits off the straight line, in
 * model units. The curve's apex lands at half this distance.
 */
const BOW = 70;

/**
 * Teammate edges are curves, like a jumper wire on a board, so that where a
 * pair has both kinds of edge the two never sit on top of each other.
 *
 * The curve bows away from whichever other node sits closest to the straight
 * line, so it does not run through a node it has nothing to do with. Done in
 * 3D, once: the component beside a bystander's offset that is perpendicular
 * to the edge points toward it, and the bend goes the opposite way.
 */
function bendPoint(fromId: string, toId: string): Vec3 {
  const a = NODES.find((n) => n.id === fromId)!.p;
  const b = NODES.find((n) => n.id === toId)!.p;
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;

  let best: Vec3 | null = null;
  let bestDist = Infinity;
  for (const n of NODES) {
    if (n.id === fromId || n.id === toId) continue;
    const r: Vec3 = [n.p[0] - a[0], n.p[1] - a[1], n.p[2] - a[2]];
    // Projection onto the edge: is the node alongside the segment at all?
    const t = (r[0] * d[0] + r[1] * d[1] + r[2] * d[2]) / len2;
    if (t < 0 || t > 1) continue;
    const perp: Vec3 = [r[0] - t * d[0], r[1] - t * d[1], r[2] - t * d[2]];
    const dist = Math.hypot(...perp);
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = perp;
    }
  }

  // No bystander alongside: bow within the flat view, perpendicular to the
  // edge in the x/y plane.
  const away: Vec3 = best ? [-best[0], -best[1], -best[2]] : [-d[1], d[0], 0];
  const k = BOW / Math.hypot(...away);
  return [
    (a[0] + b[0]) / 2 + away[0] * k,
    (a[1] + b[1]) / 2 + away[1] * k,
    (a[2] + b[2]) / 2 + away[2] * k,
  ];
}

export const EDGES: readonly GraphEdge[] = [
  ...edges("stack", BY_TAG, SHARED_TAGS),
  ...edges("people", BY_PERSON, SHARED_PEOPLE),
];

/** Adjacency per edge kind, built once rather than per render. */
function adjacency(kind: EdgeKind | "any") {
  const map = new Map<string, Set<string>>();
  for (const n of NODES) map.set(n.id, new Set());
  for (const e of EDGES) {
    if (kind !== "any" && e.kind !== kind) continue;
    map.get(e.from)?.add(e.to);
    map.get(e.to)?.add(e.from);
  }
  return map as ReadonlyMap<string, ReadonlySet<string>>;
}

export const NEIGHBOURS = adjacency("any");
export const STACK_NEIGHBOURS = adjacency("stack");
export const PEOPLE_NEIGHBOURS = adjacency("people");

/** Which projects carry a given filter key. Used by the legend filters. */
export function projectsWith(kind: EdgeKind, key: string): readonly string[] {
  return (kind === "stack" ? BY_TAG : BY_PERSON).get(key) ?? [];
}

export const NODE_BY_ID: ReadonlyMap<string, GraphNode> = new Map(
  NODES.map((n) => [n.id, n]),
);
