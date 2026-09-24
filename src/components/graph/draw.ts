/**
 * Canvas renderer for the 3D project graph.
 *
 * Why canvas and not SVG. The first version moved SVG elements every frame.
 * Profiled under 4× CPU throttling it ran at ~30fps with long tasks, and CSS
 * containment made no difference: moving DOM nodes costs a style recalc, a
 * layout and a paint re-record every frame, however few of them there are.
 * A canvas frame is ~30 draw calls and none of that.
 *
 * What SVG provided for free and is rebuilt here: the packet (a short dash run
 * along an edge on hover), the one-time edge draw-in, and hit-testing, which
 * lives in the component.
 *
 * Everything is drawn in viewBox units (820 × 460); one transform maps them to
 * device pixels, so lines stay crisp on high-DPI screens.
 */

import {
  EDGES,
  GRAPH_VIEWBOX,
  MODEL_RADIUS,
  NEIGHBOURS,
  NODES,
  type EdgeKind,
} from "@/data/graph";
import {
  apply,
  axisAngle,
  multiply,
  project,
  type Mat3,
  type Projected,
} from "@/lib/rotation";

/* ---------------------------------------------------------------------------
   Camera
   --------------------------------------------------------------------------- */

/** Left of centre, because labels hang off the right of each node. */
const CX = 360;
const CY = GRAPH_VIEWBOX.height / 2;
/**
 * Screen radius, in viewBox units, of the sphere the nodes live on. Fitted
 * once from the model's bounding radius, so the graph never changes size as it
 * turns — only its depth cues do.
 *
 * With the camera four radii away, a point on that sphere projects at most
 * ~1.04 × SCREEN_R from the centre (the perspective gain peaks around a
 * quarter-radius toward the viewer). 240 × 1.04 ≈ 250 fits the 260 half-height
 * with room for a node and its label.
 */
const SCREEN_R = 240;
const UNIT = SCREEN_R / MODEL_RADIUS;
/** Camera distance. Four radii gives visible perspective without distortion. */
const DIST = 4 * MODEL_RADIUS;

/** Drag sensitivity: one sphere radius of drag is about one radian. */
export const radPerPx = (canvasCssWidth: number) =>
  GRAPH_VIEWBOX.width / (SCREEN_R * canvasCssWidth);

/**
 * The resting orientation: a small tilt so there is depth at first sight. It
 * is also the fixed view under reduced motion.
 */
export const R0: Mat3 = multiply(
  axisAngle([1, 0, 0], -0.22),
  axisAngle([0, 1, 0], 0.4),
);

export type Frame = {
  nodes: Map<string, { x: number; y: number; p: Projected }>;
  /** Projected control point of each people edge, by edge index. */
  bends: Map<number, { x: number; y: number }>;
};

export function computeFrame(R: Mat3): Frame {
  const nodes: Frame["nodes"] = new Map();
  for (const n of NODES) {
    const p = project(apply(R, n.p), DIST, MODEL_RADIUS, 0, 0);
    nodes.set(n.id, { x: CX + p.x * UNIT, y: CY + p.y * UNIT, p });
  }
  const bends: Frame["bends"] = new Map();
  EDGES.forEach((e, i) => {
    if (!e.bend) return;
    const p = project(apply(R, e.bend), DIST, MODEL_RADIUS, 0, 0);
    bends.set(i, { x: CX + p.x * UNIT, y: CY + p.y * UNIT });
  });
  return { nodes, bends };
}

/** The node under a viewBox point, if any. Nearest wins; ties go to the front. */
export function hitTest(f: Frame, x: number, y: number): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const [id, n] of f.nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d > 18) continue;
    const score = d - n.p.depth * 4;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/* ---------------------------------------------------------------------------
   Drawing
   --------------------------------------------------------------------------- */

export type Palette = {
  copper: string;
  hairline: string;
  edge: string;
  substrate: string;
  silkDim: string;
  silkFaint: string;
  font: string;
};

/** Read the palette tokens once. Canvas cannot resolve CSS variables itself. */
export function readPalette(): Palette {
  const root = getComputedStyle(document.documentElement);
  const v = (name: string) => root.getPropertyValue(name).trim();
  return {
    copper: v("--copper"),
    hairline: v("--hairline"),
    edge: v("--edge"),
    substrate: v("--substrate"),
    silkDim: v("--silk-dim"),
    silkFaint: v("--silk-faint"),
    // Resolved on <body>, where next/font's variable is in scope.
    font: getComputedStyle(document.body).fontFamily,
  };
}

export type Highlight = {
  cursorNode: string | null;
  filter: { kind: EdgeKind; key: string; ids: ReadonlySet<string> } | null;
  /**
   * The idle attention cue: one node glowing, as a hint that the graph
   * responds to the pointer. `prev` is the node it just moved away from, so
   * the glow crossfades instead of jumping. Null while anyone is interacting.
   */
  idle: { id: string; prev: string | null; at: number } | null;
};

const IDLE_FADE_MS = 700;

/** "#f0803c" → "rgba(240, 128, 60, a)". Canvas gradients need explicit alpha. */
function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * A soft copper halo around a node. Deliberately wide and faint rather than a
 * hard ring: it should read as "this is alive, try it", not as a selection.
 *
 * Rendered once into an offscreen sprite and stamped with drawImage. Building
 * a radial gradient and filling it every frame measurably raised frame times
 * under CPU throttling; a cached bitmap blit is close to free. Built once,
 * keyed by the copper value it was drawn with.
 */
const GLOW_R = 26;
const GLOW_SPRITE_PX = 128;
let glowSprite: { copper: string; canvas: HTMLCanvasElement } | null = null;

function glowFor(copper: string) {
  if (glowSprite?.copper === copper) return glowSprite.canvas;
  const c = document.createElement("canvas");
  c.width = c.height = GLOW_SPRITE_PX;
  const g = c.getContext("2d")!;
  const m = GLOW_SPRITE_PX / 2;
  const grad = g.createRadialGradient(m, m, 0, m, m, m);
  grad.addColorStop(0, rgba(copper, 0.55));
  grad.addColorStop(0.35, rgba(copper, 0.22));
  grad.addColorStop(1, rgba(copper, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SPRITE_PX, GLOW_SPRITE_PX);
  glowSprite = { copper, canvas: c };
  return c;
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  copper: string,
  strength: number,
) {
  if (strength <= 0) return;
  const r = GLOW_R * scale;
  ctx.globalAlpha = strength;
  ctx.drawImage(glowFor(copper), x - r, y - r, r * 2, r * 2);
}

export type Timing = {
  now: number;
  /** When the graph first came into view; null until then. */
  revealAt: number | null;
  /** When the current hover's packet started; null for no packet. */
  packetAt: number | null;
  reduced: boolean;
};

const PACKET_MS = 520;
const PACKET_LEN = 0.07;
const REVEAL_MS = 400;
const REVEAL_STAGGER_MS = 30;
const PEOPLE_FADE_DELAY_MS = 350;
const PEOPLE_FADE_MS = 300;

/** The site's single easing curve, cubic-bezier(0.22, 1, 0.36, 1), approximated. */
const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/** Is anything time-based still in flight? If not, the loop can skip frames. */
export function isAnimating(t: Timing) {
  if (t.reduced) return false;
  const revealing =
    t.revealAt === null ||
    t.now - t.revealAt <
      Math.max(
        REVEAL_MS + EDGES.length * REVEAL_STAGGER_MS,
        PEOPLE_FADE_DELAY_MS + PEOPLE_FADE_MS,
      );
  const packeting = t.packetAt !== null && t.now - t.packetAt < PACKET_MS;
  return revealing || packeting;
}

type Pt = { x: number; y: number };

/** A point on the edge at parameter s ∈ [0, 1]. */
function along(a: Pt, b: Pt, c: Pt | undefined, s: number): Pt {
  if (!c) return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
  const u = 1 - s;
  return {
    x: u * u * a.x + 2 * u * s * c.x + s * s * b.x,
    y: u * u * a.y + 2 * u * s * c.y + s * s * b.y,
  };
}

/** Stroke the part of an edge between s0 and s1. */
function strokeSpan(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  c: Pt | undefined,
  s0: number,
  s1: number,
) {
  ctx.beginPath();
  if (!c) {
    const p = along(a, b, c, s0);
    const q = along(a, b, c, s1);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  } else if (s0 === 0 && s1 === 1) {
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
  } else {
    // A sub-span of a quadratic, drawn as a short polyline. Only used for the
    // packet, which is 7% of the edge, so a few segments are plenty.
    const steps = 6;
    for (let k = 0; k <= steps; k++) {
      const p = along(a, b, c, s0 + ((s1 - s0) * k) / steps);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
}

export function draw(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  dpr: number,
  f: Frame,
  pal: Palette,
  hl: Highlight,
  t: Timing,
) {
  const k = (cssWidth / GRAPH_VIEWBOX.width) * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);

  const { cursorNode, filter } = hl;
  const neighbours = cursorNode ? NEIGHBOURS.get(cursorNode) : undefined;
  const active = cursorNode !== null || filter !== null;
  const since = (at: number | null) => (at === null ? 0 : t.now - at);

  // Edges first, so every node sits on top of every edge.
  EDGES.forEach((e, i) => {
    const a = f.nodes.get(e.from)!;
    const b = f.nodes.get(e.to)!;
    const c = f.bends.get(i);
    const people = e.kind === "people";

    const touched = cursorNode === e.from || cursorNode === e.to;
    const filterMatch =
      filter !== null && filter.kind === e.kind && e.via.includes(filter.key);
    const lit = touched || filterMatch;

    // One-time entrance: solid edges draw in, dashed ones fade (§2.4).
    let reveal = 1;
    if (!t.reduced) {
      const r = since(t.revealAt);
      reveal =
        t.revealAt === null
          ? 0
          : people
            ? clamp01((r - PEOPLE_FADE_DELAY_MS) / PEOPLE_FADE_MS)
            : ease(clamp01((r - i * REVEAL_STAGGER_MS) / REVEAL_MS));
    }
    if (reveal <= 0) return;

    const depth = 0.35 + 0.65 * ((a.p.depth + b.p.depth) / 2);
    ctx.globalAlpha =
      depth * (active && !lit ? 0.3 : 1) * (people ? reveal : 1);
    // At rest a dashed hairline all but vanishes, so teammate edges sit one
    // step up the neutral scale to read as clearly as the solid ones.
    ctx.strokeStyle = lit ? pal.copper : people ? pal.edge : pal.hairline;
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.setLineDash(people ? [3, 4] : []);
    strokeSpan(ctx, a, b, c, 0, people ? 1 : reveal);

    // Packet: hover only, once, never ambient (§2.3).
    if (touched && t.packetAt !== null && !t.reduced) {
      const p = since(t.packetAt) / PACKET_MS;
      if (p < 1) {
        const head = ease(p) * (1 + PACKET_LEN);
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = pal.copper;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        strokeSpan(ctx, a, b, c, clamp01(head - PACKET_LEN), clamp01(head));
      }
    }
  });

  // Nodes, farthest first (painter's algorithm), so nearer labels sit on top.
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.font = `12.5px ${pal.font}`;
  ctx.textBaseline = "alphabetic";
  const order = [...f.nodes.entries()].sort(
    (x, y) => x[1].p.depth - y[1].p.depth,
  );
  // Idle cue: fade the new node in and the previous one out.
  const idle = t.reduced ? null : hl.idle;
  const idleIn = idle ? ease(clamp01((t.now - idle.at) / IDLE_FADE_MS)) : 0;

  for (const [id, n] of order) {
    const lit = filter
      ? filter.ids.has(id)
      : cursorNode !== null && (id === cursorNode || !!neighbours?.has(id));
    const dim = filter ? !filter.ids.has(id) : cursorNode !== null && !lit;

    // Drawn under the node, per node, so a nearer node still paints over a
    // farther node's glow.
    if (idle) {
      const strength =
        id === idle.id ? idleIn : id === idle.prev ? 1 - idleIn : 0;
      drawGlow(ctx, n.x, n.y, n.p.scale, pal.copper, strength);
    }
    const idleLit = idle !== null && id === idle.id && idleIn > 0.5;

    // Depth cue floor is high enough that the farthest label stays legible.
    // The idle node is lifted to full strength so the cue reads even when
    // it happens to sit at the back.
    ctx.globalAlpha = idleLit ? 1 : (0.4 + 0.6 * n.p.depth) * (dim ? 0.28 : 1);
    ctx.beginPath();
    ctx.arc(n.x, n.y, 4.5 * n.p.scale, 0, Math.PI * 2);
    ctx.fillStyle = lit ? pal.copper : pal.substrate;
    ctx.fill();
    ctx.strokeStyle = lit ? pal.copper : pal.edge;
    ctx.stroke();

    // As the graph turns, labels pass over edges and each other. A halo in
    // the board colour, drawn under each label, keeps the nearer one readable
    // where they cross, the way a PCB silkscreen legend clears the copper.
    const node = NODES.find((m) => m.id === id)!;
    const label = node.label;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, alpha + 0.4);
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = pal.substrate;
    ctx.strokeText(label, n.x + 12, n.y + 4);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.fillStyle = lit || idleLit ? pal.copper : pal.silkDim;
    ctx.fillText(label, n.x + 12, n.y + 4);

    // A per-project annotation (e.g. a teammate on this project alone) sits
    // on a second, smaller line so it reads as a footnote to the name, with
    // the same halo so it stays legible as the graph turns.
    if (node.note) {
      ctx.font = `10.5px ${pal.font}`;
      ctx.globalAlpha = Math.min(1, alpha + 0.4);
      ctx.lineWidth = 4;
      ctx.strokeStyle = pal.substrate;
      ctx.strokeText(node.note, n.x + 12, n.y + 18);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      ctx.fillStyle = lit || idleLit ? pal.copper : pal.silkFaint;
      ctx.fillText(node.note, n.x + 12, n.y + 18);
      ctx.font = `12.5px ${pal.font}`;
    }
  }
  ctx.globalAlpha = 1;
}
