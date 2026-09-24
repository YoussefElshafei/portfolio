"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * Entrance primitives — DESIGN_BRIEF.md §2.4
 *
 * The anti-pattern being avoided is one fade-up applied uniformly to every
 * element on the page. So there is deliberately no single `<Reveal>`: headings
 * get a trace that draws in beneath them, prose fades, and machine facts
 * (mono values, tags, indices) get no entrance at all.
 *
 * All of them fire once and never replay on scroll re-entry, and all collapse
 * to their finished state under `prefers-reduced-motion`.
 *
 * These are client components that take their children as a slot, so a Server
 * Component can wrap server-rendered markup in them without that markup
 * becoming client-side.
 *
 * NOTE — why headings are not clip-path wiped.
 * The brief called for a mask-wipe on section headings. Motion does not
 * animate `clipPath` here: it leaves the server-rendered initial value in
 * place, so every heading stayed permanently clipped to zero width. Beyond
 * being a bug, it is the bad kind of bug — a failed animation that hides real
 * content. The heading below animates only opacity and transform, which
 * motion handles reliably and the compositor handles cheaply, and the
 * <noscript> fallback in the root layout covers the case where JavaScript
 * never runs to clear the starting state.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A section heading, energised like a trace: a pad lights at the left, the
 * trace runs out from it beneath the heading, and the heading itself fades in
 * with a short slide in the same left-to-right direction the trace bus runs.
 * Once drawn, the trace cools to the "spent" copper the bus uses for segments
 * already travelled.
 *
 * Fires once, the first time the heading is properly in view, and never again
 * on scroll re-entry (§2.4, §1c). The trigger is the heading block with the
 * bottom 15% of the viewport excluded. The previous version fired the moment
 * a single pixel of a 1px rule crossed the bottom edge, so it had usually
 * finished before anyone was looking at it.
 *
 * The index number is a machine fact and snaps in with no entrance (§2.4).
 *
 * Under `prefers-reduced-motion` everything renders in its finished state.
 * Without JavaScript the <noscript> rule in the root layout un-hides anything
 * marked `data-reveal`, so no heading depends on an animation having run.
 */
export function SectionHeading({
  index,
  title,
}: {
  index: string;
  title: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const on = reduced || inView;

  // `initial={false}` renders straight into the animate state, which is how
  // reduced motion gets its finished frame with no tween at all.
  const initial = reduced ? false : undefined;
  const t = (s: object) => (reduced ? { duration: 0 } : s);

  return (
    <div ref={ref} className="mb-8">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-micro text-silk-faint">{index}</span>
        <motion.h2
          data-reveal
          className="text-h2"
          initial={initial ?? { opacity: 0, x: -8 }}
          animate={on ? { opacity: 1, x: 0 } : undefined}
          transition={t({ duration: 0.32, delay: 0.1, ease: EASE })}
        >
          {title}
        </motion.h2>
      </div>

      <motion.div
        aria-hidden="true"
        className="relative mt-4 h-px"
        initial={initial ?? { opacity: 1 }}
        animate={on ? { opacity: 0.3 } : undefined}
        // Cools only after the trace has finished running.
        transition={t({ duration: 0.4, delay: 0.7, ease: "linear" })}
      >
        <motion.span
          data-reveal
          className="absolute top-1/2 left-0 size-[5px] -translate-y-1/2 rounded-full bg-copper"
          initial={initial ?? { scale: 0 }}
          animate={on ? { scale: 1 } : undefined}
          transition={t({ duration: 0.15, ease: EASE })}
        />
        <motion.div
          data-reveal
          className="h-px origin-left bg-copper"
          initial={initial ?? { scaleX: 0 }}
          animate={on ? { scaleX: 1 } : undefined}
          transition={t({ duration: 0.4, delay: 0.1, ease: EASE })}
        />
      </motion.div>
    </div>
  );
}

/**
 * Body prose. Opacity only — no translate, because sliding paragraphs upward
 * is the single most templated motion on the web.
 */
export function Fade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      data-reveal
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={
        reduced ? { duration: 0 } : { duration: 0.18, delay, ease: "linear" }
      }
    >
      {children}
    </motion.div>
  );
}
