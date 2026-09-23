import type { ReactNode } from "react";
import { TraceRule } from "@/components/motion/reveal";

/**
 * Section shell.
 *
 * The index and the heading are plain server-rendered markup with no entrance
 * of their own — the index because it is a machine fact that should snap in
 * (DESIGN_BRIEF.md §2.4), the heading because nothing that carries meaning
 * should depend on an animation having run. The motion lives in the rule that
 * draws in underneath.
 *
 * Vertical padding is passed per section rather than fixed here. Identical
 * rhythm from top to bottom is itself one of the tells (§2.5), so sections are
 * deliberately not all the same height.
 */
export function Section({
  id,
  ref_,
  title,
  children,
  className = "",
}: {
  id: string;
  ref_: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-micro text-silk-faint">{ref_}</span>
        <h2 className="text-h2">{title}</h2>
      </div>
      <TraceRule className="mt-4 mb-8" />
      {children}
    </section>
  );
}
