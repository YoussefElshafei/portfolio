import type { CSSProperties } from "react";
import { Stagger } from "@/components/motion/reveal";
import { Section } from "@/components/sections/section";
import {
  CERTIFICATIONS,
  INVOLVEMENT,
  type InvolvementEntry,
} from "@/data/profile";

/**
 * Involvement, as a vertical timeline.
 *
 * A copper trace runs down the column with a diamond marker per entry. An
 * entry with a confirmed date shows it to the left of its marker; entries
 * without one carry no date slot at all.
 *
 * That creates a layout problem a straight line cannot solve: either every
 * entry reserves a date column (and the dateless ones show an empty gap) or
 * the line moves. So the line moves, the way a PCB trace does: after the
 * dated entries it takes a short jog with 45° chamfers back to the left edge,
 * and the dateless entries continue flush left. The trace stays continuous
 * and nothing looks missing. Dated entries are sorted first so there is only
 * ever one jog, in one direction.
 *
 * Below `sm` there is no room for a date column: the date sits above the
 * title and the line is straight.
 *
 * Everything is visible at once. No hover or disclosure hides any of it.
 */

/*
  Geometry, sm and up. Tailwind only generates classes it can find as literal
  strings, so these values are written out in the class names below rather
  than interpolated: the dated trace sits at 7rem (112px), its date is a
  6.25rem right-aligned column ending 12px before the marker, and content
  starts 24px right of whichever trace it hangs from (8.5rem or 1.5rem).
*/
/** Vertical centre of an entry's first line, where its marker sits. */
const MARK_Y = "0.8rem";
/** Height of the jog between the dated and dateless runs. */
const JOG_H = 16;

function Marker({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-copper ${
        filled ? "bg-copper" : "bg-substrate"
      }`}
      style={{ top: MARK_Y }}
    />
  );
}

function Entry({
  entry,
  first,
  last,
  jogBelow,
}: {
  entry: InvolvementEntry;
  first: boolean;
  last: boolean;
  jogBelow: boolean;
}) {
  const dated = entry.period !== undefined;

  return (
    <li className={`relative pb-8 pl-6 ${dated ? "sm:pl-[8.5rem]" : ""}`}>
      {/* This entry's segment of the trace. It starts at the marker on the
          first entry, ends at the marker on the last, and on sm+ stops short
          of the jog when one follows. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 w-px bg-copper-spent ${
          dated ? "sm:left-[7rem]" : ""
        }`}
        style={{
          top: first ? MARK_Y : 0,
          bottom: last ? `calc(100% - ${MARK_Y})` : jogBelow ? `${JOG_H}px` : 0,
        }}
      />
      {jogBelow && (
        <>
          {/* Phones: no date column, so the line simply continues. */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-4 w-px bg-copper-spent sm:hidden"
          />
          {/* sm+: the jog. Down, 45° left, across, 45° left, down. */}
          <svg
            aria-hidden="true"
            className="absolute bottom-0 left-0 hidden overflow-visible sm:block"
            width="112"
            height={JOG_H}
            viewBox={`0 0 112 ${JOG_H}`}
          >
            <path
              d={`M 112 0 V 3 L 107 8 H 5 L 0 13 V ${JOG_H}`}
              fill="none"
              stroke="var(--copper-spent)"
              strokeWidth={1}
              // Match the 1px CSS lines exactly at both ends.
              transform="translate(0.5 0)"
            />
          </svg>
        </>
      )}

      <span
        className={`absolute top-0 left-0 ${dated ? "sm:left-[7rem]" : ""}`}
      >
        <Marker filled={dated} />
      </span>

      {/* The date, left of the marker on sm+. A date is a machine fact, so
          mono (§2.6). */}
      {dated && (
        <span
          className="absolute left-0 hidden w-[6.25rem] text-right font-mono text-micro text-silk-faint sm:block"
          style={{ top: "0.15rem" }}
        >
          {entry.period}
        </span>
      )}

      {dated && (
        <p className="mb-1 font-mono text-micro text-silk-faint sm:hidden">
          {entry.period}
        </p>
      )}
      {/* The entry is a quiet card: invisible at rest, it lifts and lights
          under the pointer. Margins cancel its padding so the text stays
          aligned with the trace marker. */}
      <div
        data-glow
        data-tilt
        className="glow lift -mx-3 -mt-2 rounded-trace border border-transparent px-3 py-2 hover:border-hairline hover:bg-surface"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-silk">{entry.title}</h3>
          {/* A category tag is a status string, so mono (§2.6). */}
          <span className="rounded-trace border border-copper/40 px-1.5 font-mono text-micro text-copper">
            {entry.kind}
          </span>
        </div>
        <p className="mt-1 text-micro text-silk-faint">{entry.role}</p>
        <p className="mt-2 text-silk-dim">{entry.description}</p>
      </div>
    </li>
  );
}

export function Involvement() {
  // Dated entries first, so the trace only ever needs one jog.
  const entries = [...INVOLVEMENT].sort(
    (a, b) => Number(b.period !== undefined) - Number(a.period !== undefined),
  );

  return (
    <Section id="involvement" ref_="04" title="Involvement" className="pb-28">
      <ol>
        {entries.map((entry, i) => (
          <Entry
            key={entry.title}
            entry={entry}
            first={i === 0}
            last={i === entries.length - 1}
            jogBelow={
              entry.period !== undefined &&
              entries[i + 1] !== undefined &&
              entries[i + 1].period === undefined
            }
          />
        ))}
      </ol>

      <div className="mt-14">
        <h3 className="mb-5 text-micro font-medium text-silk-dim">
          Certifications
        </h3>
        <Stagger as="ul" className="grid gap-4 md:grid-cols-2">
          {CERTIFICATIONS.map((cert, i) => (
            <li
              key={cert.name}
              data-glow
              data-tilt
              style={{ "--i": i } as CSSProperties}
              className="glow lift rounded-trace border border-hairline bg-surface p-4 hover:border-edge"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-silk">{cert.name}</p>
                {/* Issue date is a machine fact -> mono (§2.6). */}
                <span className="font-mono text-micro text-silk-faint">
                  {cert.date}
                </span>
              </div>
              <p className="mt-1 text-micro text-silk-faint">{cert.issuer}</p>
              {cert.note && (
                <p className="mt-2 text-micro text-silk-dim">{cert.note}</p>
              )}
            </li>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
