"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useRef } from "react";

/**
 * Theme toggle.
 *
 * Deliberately stateless. The current theme lives in one place — the data-theme
 * attribute the blocking script already set — and CSS picks the glyph from it
 * (see globals.css, THEME-DEPENDENT ICON SWAP). So the right icon is in the
 * first paint, there is nothing to hydrate and nothing to mismatch.
 *
 * The switch itself is smoothed by adding [data-theme-transition] for the
 * length of the transition and then removing it, so colour transitions exist
 * only during a deliberate change.
 */
export function ThemeToggle() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!reduced) {
      root.setAttribute("data-theme-transition", "");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        root.removeAttribute("data-theme-transition");
      }, 320);
    }

    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage. The theme still switches for this
      // page view; it just will not persist. Not worth surfacing.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between dark and light theme"
      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-trace border border-hairline text-silk-dim hover:border-edge hover:text-silk"
    >
      <Moon
        data-theme-icon="dark"
        aria-hidden="true"
        className="size-4"
        strokeWidth={1.75}
      />
      <Sun
        data-theme-icon="light"
        aria-hidden="true"
        className="size-4"
        strokeWidth={1.75}
      />
    </button>
  );
}
