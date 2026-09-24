"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

/**
 * Catan board, as line art: a centre hex and the ring of six around it.
 *
 * Purely decorative (aria-hidden). Drawn in the copper token, not a new
 * orange. Centre first, then the ring clockwise, like tiles being laid.
 *
 * Loops while in view (DESIGN_BRIEF.md §2.7). The "once per view" rule is for
 * content reveals; this is ornament, and the owner asked for it to repeat.
 * Every tile runs on the same cycle: all seven draw in over ~0.9s, the board
 * holds for 3s, and the draw-in replays. Off screen it sits fully drawn and
 * runs nothing. Reduced motion: fully drawn, never animated.
 *
 * Pointy-top hexes. For circumradius R, neighbours sit √3·R apart
 * horizontally, and ±√3/2·R, ±1.5·R on the diagonals.
 */

const R = 30;
/** Drawn slightly smaller than the grid so adjacent tiles show a seam. */
const R_DRAW = R - 2.5;
const S3 = Math.sqrt(3);

const CENTRES: readonly (readonly [number, number])[] = [
  [0, 0],
  // Ring, clockwise from the top right.
  [(S3 / 2) * R, -1.5 * R],
  [S3 * R, 0],
  [(S3 / 2) * R, 1.5 * R],
  [(-S3 / 2) * R, 1.5 * R],
  [-S3 * R, 0],
  [(-S3 / 2) * R, -1.5 * R],
];

function hexPath(cx: number, cy: number) {
  const pts = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90);
    return `${(cx + R_DRAW * Math.cos(a)).toFixed(2)} ${(cy + R_DRAW * Math.sin(a)).toFixed(2)}`;
  });
  return `M ${pts.join(" L ")} Z`;
}

const DRAW_S = 0.4;
const STAGGER_S = 0.08;
const HOLD_S = 3;
/** One full cycle: the last tile finishes drawing, then the hold. */
const CYCLE_S = DRAW_S + STAGGER_S * 6 + HOLD_S;

const HALF_W = S3 * R + (S3 / 2) * R;
const HALF_H = 1.5 * R + R;
const PAD = 4;

export function HexBoard() {
  const reduced = useReducedMotion();
  // On the figure, not the svg: the svg is remounted to restart the loop, and
  // an observer bound to it would be left watching a detached node.
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const loop = inView && reduced === false;

  return (
    // A column-width figure like every other piece of media, with the small
    // board centred inside it rather than hugging the left edge.
    <figure ref={ref} className="mt-8 w-full max-w-column" aria-hidden="true">
      <svg
        // Remounting on view entry restarts every tile in phase, from blank.
        key={loop ? "loop" : "still"}
        viewBox={`${-HALF_W - PAD} ${-HALF_H - PAD} ${2 * (HALF_W + PAD)} ${2 * (HALF_H + PAD)}`}
        className="mx-auto block w-full max-w-[14rem]"
        focusable="false"
      >
        {CENTRES.map(([cx, cy], i) => (
          <motion.path
            key={i}
            d={hexPath(cx, cy)}
            fill="none"
            stroke="var(--copper)"
            strokeWidth={1.25}
            strokeLinejoin="round"
            // The centre tile reads as the anchor, so it is drawn at full
            // strength and the ring slightly softer.
            strokeOpacity={i === 0 ? 1 : 0.7}
            initial={{ pathLength: loop ? 0 : 1 }}
            animate={loop ? { pathLength: [0, 1] } : { pathLength: 1 }}
            transition={
              loop
                ? {
                    duration: DRAW_S,
                    delay: i * STAGGER_S,
                    ease: [0.22, 1, 0.36, 1],
                    repeat: Infinity,
                    // Period = DRAW_S + repeatDelay = CYCLE_S for every tile,
                    // so the stagger is preserved on every repeat.
                    repeatDelay: CYCLE_S - DRAW_S,
                  }
                : { duration: 0 }
            }
          />
        ))}
      </svg>
    </figure>
  );
}
