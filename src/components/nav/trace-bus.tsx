"use client";

import { useNavState } from "@/lib/nav-state";
import { SECTIONS } from "@/lib/sections";

/* ---------------------------------------------------------------------------
   Geometry — DESIGN_BRIEF.md §2.1

   Authored once, in pixels, and committed. Nothing here is computed from the
   viewport or randomised, so the bus renders identically on every visit. The
   SVG is drawn at its natural size and centred vertically, which avoids any
   viewBox stretching.

   Routing uses 90° and 45° elbows only, in the idiom of PCB trace routing.
   --------------------------------------------------------------------------- */

const BUS_X = 26; // vertical bus
const ROW_GAP = 46; // distance between section anchors
const LEAD = 44; // bus overshoot above the first and below the last branch
const RISE = 8; // height of the 45° elbow
const PAD = 7; // pad edge length
const PAD_X = 74; // pad left edge
const SVG_W = 230; // wide enough for the hover label; container is narrower

const firstY = LEAD;
const lastY = LEAD + (SECTIONS.length - 1) * ROW_GAP;
const SVG_H = lastY + LEAD;

type Branch = {
  id: string;
  label: string;
  ref: string;
  /** y where the branch leaves the bus */
  busY: number;
  /** y of the pad centre, one 45° rise above the bus tap */
  padY: number;
  /** the routed path from bus to pad */
  d: string;
  /** 0–1 position of this tap along the bus, for the copper fill */
  progress: number;
};

const BRANCHES: readonly Branch[] = SECTIONS.map((section, i) => {
  const busY = firstY + i * ROW_GAP;
  const padY = busY - RISE;
  return {
    id: section.id,
    label: section.label,
    ref: section.ref,
    busY,
    padY,
    // out from the bus, 45° rise, then a straight run into the pad
    d: `M ${BUS_X} ${busY} H ${BUS_X + 12} L ${BUS_X + 12 + RISE} ${padY} H ${PAD_X}`,
    progress: (busY - (firstY - LEAD)) / SVG_H,
  };
});

export function TraceBus() {
  const { activeId, cursorId, setCursorId } = useNavState();

  const active = BRANCHES.find((b) => b.id === activeId) ?? null;
  // Before any section is observed the bus reads empty rather than full.
  const fill = active ? active.progress : 0;

  return (
    /*
     * aria-hidden by design.
     *
     * This is the visual centrepiece but it is a duplicate of the real <nav>
     * in the header, which carries the semantics, the tab stops and the ARIA.
     * Exposing both would give screen-reader and keyboard users two identical
     * navigations and double the tab stops for no benefit. Pointer users get
     * the bus; everyone gets the header nav. See DESIGN_BRIEF.md §2.1.
     */
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-1/2 left-0 z-20 hidden -translate-y-1/2 xl:block"
      style={{ width: SVG_W }}
    >
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        fill="none"
        focusable="false"
      >
        {/* unlit bus */}
        <line
          x1={BUS_X}
          y1={firstY - LEAD}
          x2={BUS_X}
          y2={lastY + LEAD}
          stroke="var(--hairline)"
          strokeWidth={1}
        />

        {/* copper fill, swept to the active tap */}
        <line
          className="trace-progress"
          x1={BUS_X}
          y1={firstY - LEAD}
          x2={BUS_X}
          y2={lastY + LEAD}
          stroke="var(--copper-spent)"
          strokeWidth={1}
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - fill * 100}
        />

        {BRANCHES.map((branch) => {
          const isActive = branch.id === activeId;
          const isCursor = branch.id === cursorId;
          const lit = isActive || isCursor;

          return (
            <g key={branch.id}>
              {/* branch trace */}
              <path
                d={branch.d}
                stroke={lit ? "var(--copper)" : "var(--hairline)"}
                strokeWidth={1}
                strokeLinejoin="miter"
              />

              {/* packet — hover/focus only, once, never ambient (§2.3) */}
              <path
                className="packet pointer-events-none"
                data-packet={isCursor ? "on" : "off"}
                d={branch.d}
                pathLength={100}
                stroke="var(--copper)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {/* pad */}
              <rect
                x={PAD_X}
                y={branch.padY - PAD / 2}
                width={PAD}
                height={PAD}
                fill={isActive ? "var(--copper)" : "var(--substrate)"}
                stroke={lit ? "var(--copper)" : "var(--edge)"}
                strokeWidth={1}
              />

              {/* machine fact -> mono (§2.6) */}
              <text
                x={PAD_X + PAD + 9}
                y={branch.padY + 3}
                fontFamily="var(--font-mono)"
                fontSize={9}
                fill={lit ? "var(--copper)" : "var(--silk-faint)"}
              >
                {branch.ref}
              </text>

              {/* prose -> sans, and only while the pad is under the cursor */}
              <text
                x={PAD_X + PAD + 30}
                y={branch.padY + 3}
                fontFamily="var(--font-sans)"
                fontSize={11.5}
                fill="var(--silk)"
                opacity={isCursor ? 1 : 0}
              >
                {branch.label}
              </text>

              {/* hit target: generous, invisible, pointer-only */}
              <a
                href={`#${branch.id}`}
                tabIndex={-1}
                className="pointer-events-auto"
                onMouseEnter={() => setCursorId(branch.id)}
                onMouseLeave={() => setCursorId(null)}
              >
                <rect
                  x={BUS_X - 8}
                  y={branch.padY - ROW_GAP / 2}
                  width={PAD_X + PAD + 24 - BUS_X + 8}
                  height={ROW_GAP}
                  fill="transparent"
                />
              </a>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
