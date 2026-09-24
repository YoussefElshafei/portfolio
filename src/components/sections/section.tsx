import type { ReactNode } from "react";
import { SectionHeading } from "@/components/motion/reveal";

/**
 * Section shell.
 *
 * The heading and its trace are one client component (see SectionHeading in
 * motion/reveal.tsx); the section body stays server-rendered and is passed
 * through as children.
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
      <SectionHeading index={ref_} title={title} />
      {children}
    </section>
  );
}
