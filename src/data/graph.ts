/**
 * Graph dataset — DESIGN_BRIEF.md §2.2
 *
 * Coordinates are authored by hand in viewBox pixels and committed. There is no
 * force simulation and no layout pass at runtime, so the diagram is byte-identical
 * on every visit. That is what makes it read as a schematic rather than a toy.
 *
 * Edges are derived once from shared tags and written down here rather than
 * recomputed on every render, for the same reason.
 *
 * SCAFFOLD NOTE
 * -------------
 * Real projects do not exist yet, and DESIGN_BRIEF.md §1 forbids shipping
 * placeholder content. Rather than invent fake project names, the specimen
 * dataset below is *true*: it is this repository's own module graph, where a
 * tag is the layer a module belongs to. Same shape, same component, no fiction.
 *
 * At the content stage, replace NODES and EDGES with the real projects. Nothing
 * in project-graph.tsx needs to change.
 */

export type GraphNode = {
  id: string;
  label: string;
  /** Shared tags are what produce edges. For projects this is the stack. */
  tags: readonly string[];
  /** viewBox pixel coordinates. Precomputed, committed, never randomised. */
  x: number;
  y: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  /** The tag the two nodes have in common. Shown in the legend. */
  via: string;
};

export const GRAPH_VIEWBOX = { width: 820, height: 420 } as const;

export const NODES: readonly GraphNode[] = [
  { id: "tokens", label: "tokens", tags: ["theme"], x: 64, y: 210 },
  { id: "theme-script", label: "theme-script", tags: ["theme"], x: 196, y: 86 },
  { id: "nav-state", label: "nav-state", tags: ["nav"], x: 196, y: 320 },
  {
    id: "theme-toggle",
    label: "theme-toggle",
    tags: ["theme", "ui"],
    x: 352,
    y: 120,
  },
  { id: "trace-bus", label: "trace-bus", tags: ["nav", "svg"], x: 352, y: 262 },
  {
    id: "project-graph",
    label: "project-graph",
    tags: ["svg"],
    x: 352,
    y: 380,
  },
  {
    id: "site-header",
    label: "site-header",
    tags: ["nav", "ui"],
    x: 528,
    y: 162,
  },
  {
    id: "mobile-nav",
    label: "mobile-nav",
    tags: ["nav", "ui"],
    x: 528,
    y: 300,
  },
  { id: "site-footer", label: "site-footer", tags: ["ui"], x: 656, y: 228 },
];

export const EDGES: readonly GraphEdge[] = [
  { from: "tokens", to: "theme-script", via: "theme" },
  { from: "tokens", to: "theme-toggle", via: "theme" },
  { from: "theme-script", to: "theme-toggle", via: "theme" },
  { from: "nav-state", to: "trace-bus", via: "nav" },
  { from: "nav-state", to: "site-header", via: "nav" },
  { from: "nav-state", to: "mobile-nav", via: "nav" },
  { from: "trace-bus", to: "site-header", via: "nav" },
  { from: "trace-bus", to: "project-graph", via: "svg" },
  { from: "site-header", to: "mobile-nav", via: "nav" },
  { from: "theme-toggle", to: "site-header", via: "ui" },
  { from: "theme-toggle", to: "site-footer", via: "ui" },
  { from: "site-header", to: "site-footer", via: "ui" },
  { from: "mobile-nav", to: "site-footer", via: "ui" },
];

export const TAGS = ["theme", "nav", "ui", "svg"] as const;

/** Adjacency, built once at module scope rather than per render. */
export const NEIGHBOURS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const n of NODES) map.set(n.id, new Set());
  for (const e of EDGES) {
    map.get(e.from)?.add(e.to);
    map.get(e.to)?.add(e.from);
  }
  return map;
})();

export const NODE_BY_ID: ReadonlyMap<string, GraphNode> = new Map(
  NODES.map((n) => [n.id, n]),
);
