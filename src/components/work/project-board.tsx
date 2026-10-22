"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { PROJECTS } from "@/data/projects";

/**
 * The project bus: a small circuit board pinned to the bottom of the screen
 * while you read the projects. Each project is a chip on one copper trace;
 * the trace fills and a signal pad slides to the chip you are reading.
 * Hovering or focusing a chip opens a preview, and clicking it jumps there.
 *
 * It only shows inside the project entries, so it never competes with the
 * hero or the contact form, and it sits left of the "Ask about me" button.
 */

/** Short names so five chips fit on a phone. */
const SHORT: Record<string, string> = {
  tradewatch: "TradeWatch",
  "triage-flow": "Triage",
  bridgeaid: "BridgeAid",
  wirefish: "WireFish",
  catan: "Catan",
};

export function ProjectBoard() {
  const [active, setActive] = useState(-1);
  const [peek, setPeek] = useState<number | null>(null);

  useEffect(() => {
    const els = PROJECTS.map((p) => document.getElementById(`work-${p.id}`));
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = innerHeight * 0.45;
      const last = els[els.length - 1];
      const end = last ? last.getBoundingClientRect().bottom : 0;
      let i = -1;
      els.forEach((el, k) => {
        if (el && el.getBoundingClientRect().top <= line) i = k;
      });
      // Hide once the last entry has scrolled past the reading line.
      setActive(end < line ? -1 : i);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const shown = active >= 0;
  const fill = PROJECTS.length > 1 ? active / (PROJECTS.length - 1) : 1;
  const preview = peek !== null ? PROJECTS[peek] : null;

  return (
    <nav
      aria-label="Projects"
      inert={!shown}
      // On phones it stops short of the Ask button on the right.
      className={`fixed right-18 bottom-4 left-4 z-20 transition-[opacity,translate] duration-300 motion-reduce:transition-none sm:right-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 ${
        shown ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="relative">
        <AnimatePresence>
          {preview && (
            <motion.div
              key={preview.id}
              aria-hidden="true"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className="shadow-lg shadow-black/40 pointer-events-none absolute bottom-full left-0 mb-2 w-[min(22rem,calc(100vw-2rem))] rounded-window border border-edge bg-surface p-4"
            >
              <p className="font-mono text-micro text-copper">
                {preview.index} / {String(PROJECTS.length).padStart(2, "0")}
                {preview.status && ` · ${preview.status.label}`}
              </p>
              <p className="mt-1 font-medium text-silk">{preview.name}</p>
              <p className="mt-1 text-micro text-silk-dim">{preview.tagline}</p>
              <p className="mt-2 font-mono text-micro text-silk-faint">
                {preview.stack.slice(0, 4).join(" · ")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <ol
          className="shadow-lg shadow-black/30 relative flex items-center gap-1 rounded-window border border-edge bg-substrate/90 px-2 py-1.5 backdrop-blur sm:gap-2"
          onMouseLeave={() => setPeek(null)}
        >
          {/* The bus: an unlit trace with a copper fill up to the current chip. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-1/2 h-px bg-hairline"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-5 h-px origin-left bg-copper transition-transform duration-500 motion-reduce:transition-none"
            style={{
              width: "calc(100% - 2.5rem)",
              transform: `scaleX(${Math.max(0, fill)})`,
            }}
          />
          {PROJECTS.map((p, i) => {
            const on = i === active;
            const passed = i < active;
            return (
              <li key={p.id} className="relative">
                <a
                  href={`#work-${p.id}`}
                  aria-current={on ? "location" : undefined}
                  onMouseEnter={() => setPeek(i)}
                  onFocus={() => setPeek(i)}
                  onBlur={() => setPeek(null)}
                  className={`relative flex min-h-9 items-center gap-1.5 rounded-trace border px-2 font-mono text-micro transition-colors pointer-coarse:min-h-11 ${
                    on
                      ? "border-copper bg-surface text-copper"
                      : passed
                        ? "border-copper-spent bg-substrate text-silk-dim"
                        : "border-edge bg-substrate text-silk-faint hover:border-copper hover:text-copper"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="board-signal"
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-trace bg-copper-wash"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <span>{p.index}</span>
                  <span className={on ? "inline" : "hidden md:inline"}>
                    {SHORT[p.id] ?? p.name}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
