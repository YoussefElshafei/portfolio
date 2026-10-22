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
 * The resting orientation: tilted so there is depth at first sight and, picked
 * by search over tilts, so no two of the five nodes or labels overlap. It is
 * also the fixed view under reduced motion.
 */
export const R0: Mat3 = multiply(
  axisAngle([1, 0, 0], -0.6),
  axisAngle([0, 1, 0], -0.4),
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

/* ---------------------------------------------------------------------------
   Narrow screens

   Everything is drawn in viewBox units and scaled to the canvas, which is
   right for geometry but wrong for text and touch: on a ~340px phone the
   12.5-unit labels would render near 5px and the hit radius near 7px. So
   labels, node dots and the hit radius are floored in CSS pixels. At desktop
   widths the floor never binds and nothing changes.
   --------------------------------------------------------------------------- */

const LABEL_UNITS = 12.5;
const NOTE_UNITS = 10.5;
/** Smallest label size on screen, in CSS px. */
const MIN_LABEL_CSS_PX = 11;
/** Smallest hit radius on screen, in CSS px: roughly half a fingertip. */
const MIN_HIT_CSS_PX = 22;
const HIT_UNITS = 18;

/**
 * How much to enlarge labels and dots, in viewBox units, so they stay legible
 * at this canvas width. 1 at desktop widths.
 */
export function legibility(cssWidth: number) {
  const k = cssWidth / GRAPH_VIEWBOX.width;
  return k > 0 ? Math.max(1, MIN_LABEL_CSS_PX / (LABEL_UNITS * k)) : 1;
}

/** The node under a viewBox point, if any. Nearest wins; ties go to the front. */
export function hitTest(
  f: Frame,
  x: number,
  y: number,
  cssWidth: number,
): string | null {
  const k = cssWidth / GRAPH_VIEWBOX.width;
  const radius = Math.max(HIT_UNITS, k > 0 ? MIN_HIT_CSS_PX / k : 0);
  let best: string | null = null;
  let bestScore = Infinity;
  for (const [id, n] of f.nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d > radius) continue;
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
  silk: string;
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
    silk: v("--silk"),
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
/** One trip of an ambient signal along a trace. */
const SIGNAL_MS = 3200;
const PACKET_LEN = 0.07;
const REVEAL_MS = 400;
const REVEAL_STAGGER_MS = 30;
const PEOPLE_FADE_DELAY_MS = 350;
const PEOPLE_FADE_MS = 300;

/** The site's single easing curve, cubic-bezier(0.22, 1, 0.36, 1), approximated. */
const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/**
 * Is anything time-based still in flight? If not, the loop can skip frames.
 * Without reduced motion the answer is always yes: signals run along the
 * traces continuously (the round-2 motion amendment, DESIGN_BRIEF §2.9). The
 * component only runs the loop while the graph is on screen.
 */
export function isAnimating(t: Timing) {
  return !t.reduced;
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
  const s = legibility(cssWidth);
  const labelFont = `${LABEL_UNITS * s}px ${pal.font}`;
  const noteFont = `${NOTE_UNITS * s}px ${pal.font}`;
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
    const fade = depth * (active && !lit ? 0.3 : 1) * (people ? reveal : 1);
    ctx.lineCap = "round";

    if (!people) {
      // A copper trace with a soft bloom under it, so the shared-stack links
      // read as live wiring rather than a faint hairline.
      ctx.setLineDash([]);
      ctx.globalAlpha = fade * (lit ? 0.35 : 0.12);
      ctx.strokeStyle = pal.copper;
      ctx.lineWidth = lit ? 7 : 5;
      strokeSpan(ctx, a, b, c, 0, reveal);
      ctx.globalAlpha = fade * (lit ? 1 : 0.55);
      ctx.lineWidth = lit ? 2 : 1.4;
      strokeSpan(ctx, a, b, c, 0, reveal);
    } else {
      // Teammate links: a dashed line whose dashes march slowly, like data
      // moving between people rather than parts.
      ctx.globalAlpha = fade * (lit ? 1 : 0.8);
      ctx.strokeStyle = lit ? pal.copper : pal.silkFaint;
      ctx.lineWidth = lit ? 1.5 : 1.1;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = t.reduced ? 0 : -t.now / 90;
      strokeSpan(ctx, a, b, c, 0, 1);
      ctx.lineDashOffset = 0;
    }

    // Ambient signal: one small pulse per trace, staggered so they never
    // move in step. Off under reduced motion, and only once drawn in.
    if (!people && !t.reduced && reveal >= 1) {
      const u = (t.now / SIGNAL_MS + i * 0.37) % 1;
      const pt = along(a, b, c, u);
      // Fade in and out at the ends so a pulse never pops at a node.
      const edgeFade = Math.min(1, u * 6, (1 - u) * 6);
      drawGlow(ctx, pt.x, pt.y, 0.35, pal.copper, fade * edgeFade * 0.9);
      ctx.globalAlpha = fade * edgeFade;
      ctx.fillStyle = pal.copper;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, lit ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

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
  ctx.font = labelFont;
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
    const base = idleLit ? 1 : (0.4 + 0.6 * n.p.depth) * (dim ? 0.28 : 1);
    // Every node carries a faint halo of its own, brighter when lit, so the
    // five projects read as powered parts on the board.
    drawGlow(
      ctx,
      n.x,
      n.y,
      n.p.scale * s * (lit ? 1.1 : 0.8),
      pal.copper,
      base * (lit ? 0.9 : 0.35),
    );

    // A pad: dark body, copper ring, copper core.
    const r = 7 * n.p.scale * s;
    ctx.globalAlpha = base;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = pal.substrate;
    ctx.fill();
    ctx.lineWidth = lit ? 2 : 1.5;
    ctx.strokeStyle = pal.copper;
    ctx.globalAlpha = base * (lit ? 1 : 0.75);
    ctx.stroke();
    ctx.globalAlpha = base;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r * (lit ? 0.5 : 0.38), 0, Math.PI * 2);
    ctx.fillStyle = lit ? pal.copper : rgba(pal.copper, 0.85);
    ctx.fill();

    // The node under the pointer gets a slowly turning dashed ring.
    if (id === cursorNode) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(t.reduced ? 0 : t.now / 1400);
      ctx.setLineDash([2.5, 3.5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.copper;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = base;
    ctx.lineWidth = 1;

    // As the graph turns, labels pass over edges and each other. A halo in
    // the board colour, drawn under each label, keeps the nearer one readable
    // where they cross, the way a PCB silkscreen legend clears the copper.
    const node = NODES.find((m) => m.id === id)!;
    const label = node.label;
    // Labels hang off the right of the node. Enlarged on a phone, one near
    // the right edge would run out of the frame, so it swaps to the left.
    const gap = 15 * s;
    let width = ctx.measureText(label).width;
    if (node.note) {
      ctx.font = noteFont;
      width = Math.max(width, ctx.measureText(node.note).width);
      ctx.font = labelFont;
    }
    const flip = n.x + gap + width > GRAPH_VIEWBOX.width - 4;
    const lx = flip ? n.x - gap : n.x + gap;
    ctx.textAlign = flip ? "right" : "left";

    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, alpha + 0.4);
    ctx.lineWidth = 4 * s;
    ctx.lineJoin = "round";
    ctx.strokeStyle = pal.substrate;
    ctx.strokeText(label, lx, n.y + 4 * s);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.fillStyle = lit || idleLit ? pal.copper : pal.silk;
    ctx.fillText(label, lx, n.y + 4 * s);

    // A per-project annotation (e.g. a teammate on this project alone) sits
    // on a second, smaller line so it reads as a footnote to the name, with
    // the same halo so it stays legible as the graph turns.
    if (node.note) {
      ctx.font = noteFont;
      ctx.globalAlpha = Math.min(1, alpha + 0.4);
      ctx.lineWidth = 4 * s;
      ctx.strokeStyle = pal.substrate;
      ctx.strokeText(node.note, lx, n.y + 18 * s);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      ctx.fillStyle = lit || idleLit ? pal.copper : pal.silkFaint;
      ctx.fillText(node.note, lx, n.y + 18 * s);
      ctx.font = labelFont;
    }
    ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;
}
