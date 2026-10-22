import type { ReactNode } from "react";

/**
 * The shell every project demo sits in: a header strip naming what it is,
 * the demo, and a caption that says plainly what is real and what is not.
 *
 * `data-glow` opts the panel into the cursor-follow edge light (see
 * PointerGlow and `.glow` in globals.css).
 */
export function DemoFrame({
  label,
  meta,
  children,
  caption,
  className = "",
}: {
  label: string;
  meta?: ReactNode;
  children: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`mt-8 w-full ${className}`}>
      <div
        data-glow
        className="glow overflow-hidden rounded-trace border border-hairline bg-surface"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-4 py-2.5">
          <span className="text-micro font-medium text-silk-dim">{label}</span>
          {meta && (
            <span className="font-mono text-micro text-silk-faint">{meta}</span>
          )}
        </div>
        {children}
      </div>
      {caption && (
        <figcaption className="mt-3 text-micro text-silk-faint">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
