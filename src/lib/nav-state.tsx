"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

/** Sentinel at the very end of the document. See `atEnd` below. */
export const NAV_END_ID = "nav-end";

export function NavStateProvider({ children }: { children: ReactNode }) {
  const [observedId, setObservedId] = useState<string | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [cursorId, setCursorId] = useState<string | null>(null);

  /*
   * The final section can never win the band test: once the page has scrolled
   * as far as it goes, Contact sits below the detection band and the section
   * above it keeps the highlight. Clicking "Contact" in the nav then failed to
   * mark Contact as current.
   *
   * Rather than add a scroll listener, a 1px sentinel at the end of the
   * document is observed by a second IntersectionObserver. If it is on screen,
   * the reader is at the bottom and the last section is the current one.
   */
  useEffect(() => {
    const sentinel = document.getElementById(NAV_END_ID);
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setAtEnd(entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const lastId = SECTIONS[SECTIONS.length - 1]?.id ?? null;
  const activeId = atEnd ? lastId : observedId;

  /*
   * Which section is "current" is decided by a reading line near the top of the
   * viewport: the current section is the last one whose top edge has crossed
   * it. Before the first section reaches the line — while the hero is on
   * screen — nothing is current, which is correct.
   *
   * The obvious alternative, picking the section with the largest
   * `intersectionRatio`, is wrong here and was the original implementation.
   * Ratio is measured against the element's own height, so Projects — seven
   * thousand pixels tall — scores near zero however much of the screen it
   * fills, and a short section above it keeps the highlight while the reader
   * is plainly inside Projects.
   *
   * An IntersectionObserver still drives this rather than a scroll listener:
   * the callback fires only when a section edge crosses the viewport, not on
   * every scroll frame, so nothing runs during the scroll itself. Reading six
   * rects inside that callback is negligible and happens a handful of times
   * per page, not sixty times a second.
   */
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;

    const pick = () => {
      const line = window.innerHeight * 0.3;
      let best: string | null = null;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) best = s.id;
      }
      setObservedId(best);
    };

    const observer = new IntersectionObserver(pick, {
      threshold: [0, 1],
    });

    els.forEach((el) => observer.observe(el));
    pick();
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
