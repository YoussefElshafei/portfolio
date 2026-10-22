"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  GRAPH_VIEWBOX,
  NODE_BY_ID,
  NODES,
  PEOPLE_NEIGHBOURS,
  SHARED_PEOPLE,
  SHARED_TAGS,
  STACK_NEIGHBOURS,
  projectsWith,
  type EdgeKind,
} from "@/data/graph";
import {
  axisAngle,
  dragRotation,
  multiply,
  orthonormalise,
  type Mat3,
} from "@/lib/rotation";
import {
  R0,
  computeFrame,
  draw,
  hitTest,
  isAnimating,
  radPerPx,
  readPalette,
  type Highlight,
} from "@/components/graph/draw";

/* ---------------------------------------------------------------------------
   Motion — DESIGN_BRIEF.md §2.7

   Ambient rotation is slow, about 90 seconds a turn, about an axis that
   drifts. The drift uses two sines with incommensurate periods (~170s and
   ~270s), so the path never closes into a loop the eye learns, while each
   instant's motion stays perfectly smooth. The axis stays mostly vertical, so
   "up" stays roughly up and labels remain easy to read.
   --------------------------------------------------------------------------- */

const AMBIENT_RAD_PER_S = 0.07;
const RESUME_DELAY_MS = 1500;
const RESUME_RAMP_MS = 1200;
/** Drag distance beyond which a press is a rotate, not a click on a node. */
const CLICK_SLOP_PX = 5;

/** Idle cue: first glow after the draw-in, then a new node every 6s. */
const IDLE_FIRST_MS = 1500;
const IDLE_MOVE_MS = 6000;
/** How long after the last interaction before the idle cue returns. */
const IDLE_RESUME_MS = 2500;

function ambientAxis(tSec: number) {
  return [
    0.35 * Math.sin(tSec * 0.037),
    1,
    0.3 * Math.sin(tSec * 0.023 + 2),
  ] as const;
}

type Filter = { kind: EdgeKind; key: string };

/**
 * Project graph — DESIGN_BRIEF.md §2.2, as amended in §2.7
 *
 * Nodes are projects in a committed 3D layout. Solid straight edges join
 * projects that share part of a stack; dashed curved edges join projects that
 * share a named teammate. The object is rigid and identical on every visit;
 * it turns slowly on its own and can be dragged to turn by hand.
 *
 * 3D without a 3D library: a 3×3 rotation matrix and a perspective divide
 * (lib/rotation.ts) turn each node's model position into a 2D point, and a
 * canvas is redrawn from those points (./draw.ts, which also explains why
 * canvas rather than SVG).
 *
 * React owns interaction state (which node or filter is highlighted). The
 * animation loop owns the orientation and the drawing. They meet through refs,
 * so hovering re-renders the legend but never the loop, and the loop never
 * re-renders React.
 *
 * Accessibility follows the same rule as the trace bus. The canvas is
 * decorative and `aria-hidden`; the list beside it holds the real links, the
 * real tab stops and the same highlighting behaviour, and the project entries
 * below hold all the content. Dragging is never the only way to reach
 * anything.
 *
 * The diagram shows at every width. It used to be replaced by the list below
 * `md` (DESIGN_BRIEF.md §2.2), because drawn at phone width its labels shrank
 * to ~5px; draw.ts now floors label size and hit radius in CSS pixels, so it
 * stays legible and tappable there. The list keeps its relationship text
 * visible below `md`, where there is no hover to reveal it.
 */
export function ProjectGraph() {
  const [cursorNode, setCursorNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const reduced = useReducedMotion() ?? false;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Orientation survives effect restarts (e.g. a reduced-motion change). */
  const orientation = useRef<Mat3>(R0);
  const highlight = useRef<Highlight>({
    cursorNode: null,
    filter: null,
    idle: null,
  });
  const packetAt = useRef<number | null>(null);
  const dirty = useRef(true);
  /** The idle cue is held off until this time; pushed forward by interaction. */
  const idleResumeAt = useRef(0);

  // Mirror React's highlight state into the loop. A new hovered node starts a
  // new packet, exactly once per hover, as the SVG version did. Any real
  // interaction ends the idle cue at once; letting go schedules it to return.
  useEffect(() => {
    const interacting = cursorNode !== null || filter !== null;
    const now = performance.now();
    highlight.current = {
      cursorNode,
      filter: filter
        ? { ...filter, ids: new Set(projectsWith(filter.kind, filter.key)) }
        : null,
      idle: interacting ? null : highlight.current.idle,
    };
    if (interacting) idleResumeAt.current = Infinity;
    else if (idleResumeAt.current === Infinity) {
      idleResumeAt.current = now + IDLE_RESUME_MS;
    }
    packetAt.current = cursorNode ? now : null;
    dirty.current = true;
  }, [cursorNode, filter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let visible = false;
    let revealAt: number | null = null;
    let cssWidth = canvas.clientWidth;
    let dpr = window.devicePixelRatio || 1;
    let palette = readPalette();
    let frame = computeFrame(orientation.current);

    let dragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    /** Ambient motion is held off until this time after a drag. */
    let resumeAt = 0;
    /** The node the pointer is over, so React is only told when it changes. */
    let hoverId: string | null = null;

    const tick = (now: number) => {
      // Clamp so a long gap (a dropped frame, a background tab) is a small
      // step rather than a lurch.
      const dt = Math.min(now - last, 50) / 1000;
      last = now;

      if (!reduced && !dragging && now > resumeAt) {
        // Ease back in after a drag instead of snapping to full speed.
        const ramp = Math.min((now - resumeAt) / RESUME_RAMP_MS, 1);
        const step = axisAngle(
          ambientAxis(now / 1000),
          AMBIENT_RAD_PER_S * dt * ramp,
        );
        orientation.current = multiply(step, orientation.current);
        dirty.current = true;
      }

      // Idle attention cue. Starts once the edges have drawn in, moves every
      // IDLE_MOVE_MS to a different node chosen at random, and stops the
      // instant anyone hovers, focuses, filters or drags. Never under
      // reduced motion, where a static text hint does this job instead.
      const hl = highlight.current;
      if (dragging) {
        hl.idle = null;
        idleResumeAt.current = now + IDLE_RESUME_MS;
      } else if (
        !reduced &&
        hl.cursorNode === null &&
        hl.filter === null &&
        revealAt !== null &&
        now - revealAt > IDLE_FIRST_MS &&
        now >= idleResumeAt.current &&
        (hl.idle === null || now - hl.idle.at >= IDLE_MOVE_MS)
      ) {
        const current = hl.idle?.id ?? null;
        const others = NODES.filter((n) => n.id !== current);
        const next = others[Math.floor(Math.random() * others.length)].id;
        hl.idle = { id: next, prev: current, at: now };
        dirty.current = true;
      }

      const timing = {
        now,
        revealAt,
        packetAt: packetAt.current,
        reduced,
      };
      if (dirty.current || isAnimating(timing)) {
        // Floating-point drift would slowly shear the matrix; clean it up.
        if (++frames % 120 === 0) {
          orientation.current = orthonormalise(orientation.current);
        }
        frame = computeFrame(orientation.current);
        draw(ctx, cssWidth, dpr, frame, palette, highlight.current, timing);
        dirty.current = false;
      }
      raf = requestAnimationFrame(tick);
    };

    // Only animate while the graph is on screen and the tab is visible.
    // Offscreen, the loop does not exist at all.
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        // Any sliver on screen keeps the loop alive; the edge draw-in waits
        // until the graph is properly in view, and happens once (§2.4).
        visible = entry.isIntersecting;
        if (entry.intersectionRatio >= 0.3 && revealAt === null) {
          revealAt = performance.now();
        }
        if (visible) start();
        else stop();
      },
      { threshold: [0, 0.3] },
    );
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    // Match the backing store to the displayed size and pixel density, so
    // lines are crisp rather than a blurry upscale.
    const resize = () => {
      cssWidth = canvas.clientWidth;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(
        (cssWidth * GRAPH_VIEWBOX.height * dpr) / GRAPH_VIEWBOX.width,
      );
      dirty.current = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // Labels drawn before the webfont arrives would be in the fallback face.
    document.fonts?.ready.then(() => {
      palette = readPalette();
      dirty.current = true;
    });

    const toViewBox = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const s = GRAPH_VIEWBOX.width / r.width;
      return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
    };

    // Trackball drag. Pointer events cover mouse, pen and touch in one path.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      moved = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      start();
    };
    const onMove = (e: PointerEvent) => {
      if (dragging && e.pointerId === pointerId) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        moved += Math.hypot(dx, dy);
        orientation.current = multiply(
          dragRotation(dx, dy, radPerPx(cssWidth)),
          orientation.current,
        );
        dirty.current = true;
        return;
      }
      // Hover. Only touches React state when the hovered node changes.
      const { x, y } = toViewBox(e);
      const hit = hitTest(frame, x, y, cssWidth);
      canvas.style.cursor = hit ? "pointer" : "";
      if (hit !== hoverId) {
        hoverId = hit;
        setCursorNode(hit);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
      resumeAt = performance.now() + RESUME_DELAY_MS;
      canvas.style.cursor = "";
      // A press that barely moved is a click: follow the node's link, the
      // same destination the list beside the graph links to.
      if (moved <= CLICK_SLOP_PX) {
        const { x, y } = toViewBox(e);
        const hit = hitTest(frame, x, y, cssWidth);
        if (hit) window.location.hash = `work-${hit}`;
      }
    };
    const onLeave = () => {
      if (dragging) return;
      canvas.style.cursor = "";
      if (hoverId !== null) {
        hoverId = null;
        setCursorNode(null);
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    dirty.current = true;

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  // See skill-matrix.tsx: a tap toggles, because touch has no hover and iOS
  // Safari does not focus a tapped button.
  const tap = useRef({ touch: false, wasActive: false });

  const filterButton = (kind: EdgeKind, key: string) => {
    const active = filter?.kind === kind && filter.key === key;
    return (
      <li key={key}>
        <button
          type="button"
          onMouseEnter={() => setFilter({ kind, key })}
          onMouseLeave={() => setFilter(null)}
          onFocus={() => setFilter({ kind, key })}
          onBlur={() => setFilter(null)}
          onPointerDown={(e) => {
            tap.current = {
              touch: e.pointerType !== "mouse",
              wasActive: active,
            };
          }}
          onClick={() => {
            if (!tap.current.touch) return;
            setFilter(tap.current.wasActive ? null : { kind, key });
          }}
          aria-pressed={active}
          // A tag is a machine fact and goes in mono; a person's name is not
          // (§2.6). The dashed border ties the name filters to the dashed
          // edges they light.
          className={`cursor-pointer rounded-trace border px-2 py-1 text-micro pointer-coarse:min-h-11 ${
            kind === "stack" ? "font-mono" : "border-dashed"
          } ${
            active
              ? "border-copper text-copper"
              : "border-hairline text-silk-faint hover:text-silk"
          }`}
        >
          {key}
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
      {/* data-js-only: without JavaScript the canvas is blank, and an empty
          bordered box would offer something it cannot show. The <noscript>
          rule in the root layout removes it; the list beside still works. */}
      <div data-js-only className="min-w-0 flex-1">
        <canvas
          ref={canvasRef}
          // touch-none: on a touch screen a drag here turns the graph rather
          // than scrolling the page. The graph is a bounded box (~220px tall
          // on a phone), so the page still scrolls above and below it.
          className="block aspect-[820/520] w-full cursor-grab touch-none border border-hairline bg-substrate select-none"
          aria-hidden="true"
        />

        {/* Key. The two line styles make different claims, so say which is
            which rather than leave it to be guessed. */}
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-micro text-silk-faint">
          <li className="flex items-center gap-2">
            <svg viewBox="0 0 24 2" className="h-0.5 w-6" aria-hidden="true">
              <line x1="0" y1="1" x2="24" y2="1" stroke="var(--edge)" />
            </svg>
            Shares part of a stack
          </li>
          {/* Teammate edges are drawn only when projects name shared
              teammates. None do at present, so neither key nor filter shows. */}
          {SHARED_PEOPLE.length > 0 && (
            <li className="flex items-center gap-2">
              <svg viewBox="0 0 24 2" className="h-0.5 w-6" aria-hidden="true">
                <line
                  x1="0"
                  y1="1"
                  x2="24"
                  y2="1"
                  stroke="var(--edge)"
                  strokeDasharray="3 4"
                />
              </svg>
              Built with the same teammate
            </li>
          )}
          {/* The only affordance for the drag. Aria-hidden like the graph
              itself: it describes a pointer interaction on a decorative
              element, which is noise to a screen reader. */}
          <li aria-hidden="true" className="ml-auto">
            {/* Under reduced motion there is no moving glow to say "this is
                interactive", so the same hint is given in words. Static.
                Chosen in CSS, not from useReducedMotion: the server cannot
                know the setting, and a text swap on hydration is a mismatch. */}
            <span className="motion-safe:hidden">
              Hover a project to learn more · drag to turn
            </span>
            <span className="motion-reduce:hidden">Drag to turn</span>
          </li>
        </ul>
      </div>

      <div className="lg:w-60 lg:shrink-0">
        <h3 className="mb-3 text-micro font-medium text-silk-dim">
          Shared stack
        </h3>
        <ul className="mb-8 flex flex-wrap gap-2">
          {SHARED_TAGS.map((tag) => filterButton("stack", tag))}
        </ul>

        {SHARED_PEOPLE.length > 0 && (
          <>
            <h3 className="mb-3 text-micro font-medium text-silk-dim">
              Shared teammate
            </h3>
            <ul className="mb-8 flex flex-wrap gap-2">
              {SHARED_PEOPLE.map((person) => filterButton("people", person))}
            </ul>
          </>
        )}

        <h3 className="mb-3 text-micro font-medium text-silk-dim">Projects</h3>
        <ul className="flex flex-col gap-3 md:gap-1.5">
          {NODES.map((node) => {
            const names = (ids: ReadonlySet<string> | undefined) =>
              [...(ids ?? [])].map((id) => NODE_BY_ID.get(id)?.label ?? id);
            const stack = names(STACK_NEIGHBOURS.get(node.id));
            const people = names(PEOPLE_NEIGHBOURS.get(node.id));

            const relations: string[] = [];
            if (stack.length > 0)
              relations.push(`shares stack with ${stack.join(", ")}`);
            if (people.length > 0)
              relations.push(`shares a teammate with ${people.join(", ")}`);
            if (relations.length === 0)
              relations.push("no shared stack or teammate with the others");
            // The per-project annotation drawn on the canvas node, stated here
            // too so it never depends on seeing the diagram.
            if (node.note) relations.push(node.note);

            return (
              <li key={node.id}>
                <a
                  href={`#work-${node.id}`}
                  onMouseEnter={() => setCursorNode(node.id)}
                  onMouseLeave={() => setCursorNode(null)}
                  onFocus={() => setCursorNode(node.id)}
                  onBlur={() => setCursorNode(null)}
                  className={`block rounded-trace text-micro pointer-coarse:py-1 ${
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
                  {relations.map((r) => (
                    <span key={r} className="block text-silk-faint md:sr-only">
                      {r}
                    </span>
                  ))}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
