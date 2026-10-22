import type { ReactNode } from "react";

/**
 * A terminal window in the macOS idiom: rounded frame, three window dots top
 * left, a quiet centred title, and a monospace body. Nothing else: no glow,
 * no scanlines, no blinking chrome. DESIGN_BRIEF.md §2.8.
 *
 * The dots are decoration and do nothing, so they are aria-hidden and not
 * buttons. Their colours are the familiar red, yellow and green at reduced
 * saturation, so they read as "window" without competing with the copper
 * accent. They are the one place on the site those hues appear.
 *
 * The body is a slot. Callers decide what goes in it (a transcript, a chat
 * log) and own its semantics; this component is only the frame.
 */
export function TerminalWindow({
  title,
  meta,
  children,
  className = "",
  bodyClassName = "px-4 py-4",
}: {
  title: string;
  /** Optional right-aligned note in the title bar, e.g. "sample output". */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      data-glow={className.includes("glow") || undefined}
      className={`overflow-hidden rounded-window border border-hairline bg-surface ${className}`}
    >
      <div className="relative flex items-center border-b border-hairline px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-dot-close" />
          <span className="size-2.5 rounded-full bg-dot-min" />
          <span className="size-2.5 rounded-full bg-dot-max" />
        </span>
        {/* Centred like a real title bar when there is room; beside the dots
            when a meta note shares the bar, so the two never collide on a
            phone. */}
        <span
          className={`truncate font-mono text-micro text-silk-dim ${
            meta
              ? "ml-3"
              : "pointer-events-none absolute inset-x-16 text-center"
          }`}
        >
          {title}
        </span>
        {meta && (
          <span className="ml-auto shrink-0 pl-3 font-mono text-micro text-silk-faint">
            {meta}
          </span>
        )}
      </div>
      <div className={`font-mono ${bodyClassName}`}>{children}</div>
    </div>
  );
}
