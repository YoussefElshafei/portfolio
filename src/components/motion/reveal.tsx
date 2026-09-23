"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Entrance primitives — DESIGN_BRIEF.md §2.4
 *
 * The anti-pattern being avoided is one fade-up applied uniformly to every
 * element on the page. So there is deliberately no single `<Reveal>`: headings
 * get a trace rule that draws in beneath them, prose fades, and machine facts
 * (mono values, tags, indices) get no entrance at all.
 *
 * Both fire once and never replay on scroll re-entry, and both collapse to
 * their finished state under `prefers-reduced-motion`.
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
 * content. The rule below animates a transform instead, which motion handles
 * reliably and the compositor handles cheaply, and the heading itself is never
 * hidden at any point. Same left-to-right gesture along the trace direction,
 * no way for it to swallow the page.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The rule that draws in beneath a section heading, left to right — the
 * direction the trace bus runs, so the section reads as being energised from
 * the gutter inward.
 */
export function TraceRule({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={`h-px origin-left bg-copper-spent ${className}`}
      initial={reduced ? { scaleX: 1 } : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      // `amount: "some"` (threshold 0) rather than a fraction: a 1px-tall
      // element and a fractional intersection threshold round against each
      // other, and the rule intermittently never fires.
      viewport={{ once: true, amount: "some" }}
      transition={reduced ? { duration: 0 } : { duration: 0.24, ease: EASE }}
    />
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
