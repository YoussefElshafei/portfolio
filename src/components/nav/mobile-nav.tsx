"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SECTIONS } from "@/lib/sections";
import { ContactLinks } from "@/components/contact-links";

/**
 * Sheet navigation.
 *
 * The trace bus does not exist below `lg`, so this is the whole navigation on a
 * phone. It is a real dialog: labelled, escapable, focus-trapped, and it
 * returns focus to the trigger on close.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reduced = useReducedMotion();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape to dismiss, and a minimal focus trap so tabbing cannot walk out of
  // the sheet into the page behind it.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // Scroll lock. Restore whatever was there rather than assuming "".
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  // Move focus into the sheet once it exists.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-trace border border-hairline text-silk-dim hover:border-edge hover:text-silk lg:hidden"
      >
        <Menu aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-substrate/85"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
              onClick={close}
            />

            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="absolute inset-y-0 right-0 flex w-[min(19rem,85vw)] flex-col border-l border-hairline bg-surface"
              initial={reduced ? { opacity: 0 } : { x: "100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "100%" }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <div className="flex h-16 items-center justify-between border-b border-hairline pr-4 pl-5">
                <h2
                  id={titleId}
                  className="text-micro font-medium text-silk-dim"
                >
                  Sections
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close navigation"
                  className="inline-flex size-11 cursor-pointer items-center justify-center rounded-trace border border-hairline text-silk-dim hover:border-edge hover:text-silk"
                >
                  <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                </button>
              </div>

              <nav
                aria-label="Sections"
                className="flex-1 overflow-y-auto py-2"
              >
                <ul>
                  {SECTIONS.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={close}
                        className="flex items-baseline gap-4 px-5 py-3 text-silk hover:bg-copper-wash hover:text-copper"
                      >
                        {/* index is a machine fact -> mono (§2.6) */}
                        <span
                          aria-hidden="true"
                          className="font-mono text-micro text-silk-faint"
                        >
                          {section.ref}
                        </span>
                        <span>{section.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* The header hides its contact links below `sm`, so on a phone
                  they live here and are never more than one tap away. */}
              <div className="border-t border-hairline px-5 py-4 sm:hidden">
                <ContactLinks />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
