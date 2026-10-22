"use client";

import { useEffect } from "react";

/**
 * The site's pointer and scroll effects, from one listener each.
 *
 * - `[data-glow]`: a copper light that follows the cursor around the panel's
 *   edge (CSS reads --gx/--gy, see `.glow` in globals.css).
 * - `[data-tilt]`: a slight 3D tilt toward the cursor, for small cards only.
 *   Never on a demo, where a moving target would get in the way of clicking.
 * - `[data-magnetic]`: the element leans a few pixels toward the cursor.
 * - The circuit backdrop: --lx/--ly, so the traces near the cursor light up.
 * - The page: --scroll (0–1) for the progress trace along the top.
 *
 * Only CSS variables are written, never React state, so none of this causes a
 * render. Pointer effects are off for touch and for reduced motion; the
 * progress trace still updates, since it is information, not decoration.
 */
export function PointerFx() {
  useEffect(() => {
    const root = document.documentElement;
    const fine = matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame = 0;
    let last: PointerEvent | null = null;
    let tilted: HTMLElement | null = null;
    let pulled: HTMLElement | null = null;

    const release = (el: HTMLElement | null, prop: string) => {
      if (el) el.style.removeProperty(prop);
    };

    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      // The backdrop drifts, so the light is placed in its own coordinates.
      const grid = document.querySelector<HTMLElement>(".circuit-grid");
      if (grid) {
        const g = grid.getBoundingClientRect();
        grid.style.setProperty("--lx", `${e.clientX - g.left}px`);
        grid.style.setProperty("--ly", `${e.clientY - g.top}px`);
      }
      const target = e.target instanceof Element ? e.target : null;

      const glow = target?.closest<HTMLElement>("[data-glow]");
      if (glow) {
        const r = glow.getBoundingClientRect();
        glow.style.setProperty("--gx", `${e.clientX - r.left}px`);
        glow.style.setProperty("--gy", `${e.clientY - r.top}px`);
      }

      const tilt = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tilt !== tilted) release(tilted, "transform");
      tilted = tilt;
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = `perspective(900px) rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 4).toFixed(2)}deg) translateY(-2px)`;
      }

      const mag = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (mag !== pulled) release(pulled, "translate");
      pulled = mag;
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        mag.style.translate = `${(dx * 0.15).toFixed(1)}px ${(dy * 0.25).toFixed(1)}px`;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!fine.matches || e.pointerType !== "mouse") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      release(tilted, "transform");
      release(pulled, "translate");
      tilted = pulled = null;
    };

    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const max = root.scrollHeight - innerHeight;
        root.style.setProperty(
          "--scroll",
          max > 0 ? String(scrollY / max) : "0",
        );
      });
    };

    addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-copper"
      style={{ transform: "scaleX(var(--scroll, 0))" }}
    />
  );
}
