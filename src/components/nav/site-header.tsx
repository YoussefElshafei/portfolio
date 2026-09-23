"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobileNav } from "@/components/nav/mobile-nav";
import { useNavState } from "@/lib/nav-state";
import { SECTIONS } from "@/lib/sections";
import { SITE } from "@/config/site";

/**
 * Site header.
 *
 * This carries the real navigation: focusable links, a labelled <nav>, and
 * aria-current on the section in view. The trace bus mirrors it visually but
 * holds none of the semantics.
 *
 * The two are wired to the same state, so hovering or focusing a link here
 * lights the matching pad on the bus and fires its packet. They read as one
 * instrument rather than two copies of a menu.
 *
 * No backdrop-blur: a solid substrate bar, per the glassmorphism entry in
 * DESIGN_BRIEF.md §1b.
 */
export function SiteHeader() {
  const { activeId, setCursorId } = useNavState();

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-substrate">
      <div className="mx-auto flex h-16 max-w-wide items-center gap-6 px-5 sm:px-8">
        <a
          href="#top"
          className="shrink-0 font-semibold tracking-tight text-silk"
        >
          {SITE.name}
        </a>

        <nav aria-label="Sections" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {SECTIONS.map((section) => {
              const isActive = section.id === activeId;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? "true" : undefined}
                    onMouseEnter={() => setCursorId(section.id)}
                    onMouseLeave={() => setCursorId(null)}
                    onFocus={() => setCursorId(section.id)}
                    onBlur={() => setCursorId(null)}
                    className={`rounded-trace px-3 py-2 text-micro ${
                      isActive ? "text-copper" : "text-silk-dim hover:text-silk"
                    }`}
                  >
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
