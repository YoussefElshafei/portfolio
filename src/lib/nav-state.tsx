"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SECTIONS } from "@/lib/sections";

/**
 * Shared state for the navigation system.
 *
 * The header nav and the trace bus are one system, not two implementations of
 * the same thing (DESIGN_BRIEF.md §2.1). Focusing a link in the real <nav>
 * lights the corresponding pad on the bus and fires its packet; hovering a pad
 * does the same. That shared state lives here.
 */
type NavState = {
  /** Section currently in the viewport's middle band. Drives the bus fill. */
  activeId: string | null;
  /** Section being hovered or focused anywhere in the nav system. */
  cursorId: string | null;
  setCursorId: (id: string | null) => void;
};

const NavContext = createContext<NavState | null>(null);

export function NavStateProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  // IntersectionObserver rather than a scroll handler: the callback fires only
  // when a section crosses the band, not on every scroll frame. Keeps the bus
  // free under CPU throttling (§2 perf cap).
  const ratios = useRef(new Map<string, number>());

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.current.set(entry.target.id, entry.intersectionRatio);
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const s of SECTIONS) {
          const r = ratios.current.get(s.id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = s.id;
          }
        }
        // Keep the last active section rather than flicking to null in the gap
        // between two sections.
        if (best) setActiveId(best);
      },
      {
        // Weight the middle band of the viewport.
        rootMargin: "-20% 0px -35% 0px",
        threshold: [0, 0.2, 0.5, 0.8, 1],
      },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const value = useMemo(
    () => ({ activeId, cursorId, setCursorId }),
    [activeId, cursorId],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavState(): NavState {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNavState must be used inside NavStateProvider");
  return ctx;
}
