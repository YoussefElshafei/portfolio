"use client";

import { useId, useRef, useState } from "react";
import { SKILL_GROUPS, related, type Skill } from "@/data/skills";

/**
 * Skills as a second way into the project data.
 *
 * Each group is laid out like a part on a datasheet: a designator (U1, U2…)
 * with a pin-1 pad, and a trace running down past its parts. Each skill is a
 * small component with a lead on either side.
 *
 * Hovering or focusing a skill "probes" it: skills that share a project with
 * it stay lit, the rest dim, and the readout names the projects that use it,
 * linked to their entries. The mapping comes from the same stack data the
 * project graph uses (data/skills.ts); nothing is hand-maintained.
 *
 * The readout keeps the last probed skill after the pointer leaves, so its
 * project links can actually be reached and clicked. Dimming lasts only while
 * a skill is under the pointer or focus.
 */
export function SkillMatrix() {
  const [active, setActive] = useState<Skill | null>(null);
  const [probed, setProbed] = useState<Skill | null>(null);
  const readoutId = useId();

  // Touch has no hover, and iOS Safari does not focus a tapped button, so a
  // tap toggles the probe explicitly. Mouse and keyboard keep hover and focus.
  const tap = useRef<{ touch: boolean; wasActive: boolean }>({
    touch: false,
    wasActive: false,
  });

  const probe = (s: Skill) => {
    setActive(s);
    setProbed(s);
  };

  return (
    <div>
      {/*
        The probe readout. Announced politely, because it changes only when
        the visitor moves to a different skill, and it answers the question
        they just asked.
      */}
      <p
        id={readoutId}
        aria-live="polite"
        className="mb-10 min-h-[2.9rem] rounded-trace border border-hairline bg-surface px-3 py-2 text-micro text-silk-dim"
      >
        <span className="mr-2 font-mono text-silk-faint">PROBE</span>
        {probed ? (
          <>
            <span className="font-mono text-copper">{probed.label}</span>
            <span className="text-silk-faint"> · </span>
            {probed.projects.length > 0 ? (
              <>
                Used in:{" "}
                {probed.projects.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <a
                      href={`#work-${p.id}`}
                      className="text-silk underline decoration-hairline underline-offset-2 hover:text-copper hover:decoration-copper"
                    >
                      {p.name}
                    </a>
                  </span>
                ))}
              </>
            ) : (
              <>Not part of a project listed on this site.</>
            )}
          </>
        ) : (
          <>Hover or focus a skill to see which projects use it.</>
        )}
      </p>

      <div className="space-y-10">
        {SKILL_GROUPS.map((group) => (
          <section key={group.designator} aria-label={group.name}>
            {/* Designator row: pin-1 pad, part number, part name. The
                designator is a machine-style identifier, so mono (§2.6). */}
            <h3 className="flex items-center gap-2 font-mono text-micro tracking-wide text-silk-dim uppercase">
              <span aria-hidden="true" className="size-2 bg-copper-spent" />
              <span className="text-copper">{group.designator}</span>
              <span>{group.name}</span>
            </h3>

            {/* The group's trace runs down from the pad past its parts. */}
            <ul className="mt-3 ml-[3.5px] flex flex-wrap gap-x-4 gap-y-3 border-l border-copper-spent py-1 pl-5">
              {group.skills.map((skill) => {
                const isActive = active === skill;
                const dim =
                  active !== null && !isActive && !related(active, skill);
                const used = skill.projects.length > 0;
                return (
                  <li key={skill.label} className="relative">
                    {/* A quick popover over the probed part. Decorative: the
                        PROBE readout above says the same thing in full. */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="pop-in shadow-lg shadow-black/40 pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-trace border border-copper bg-surface px-2 py-1 font-mono text-micro whitespace-nowrap text-silk"
                      >
                        {used
                          ? `in ${skill.projects.length} project${skill.projects.length === 1 ? "" : "s"}`
                          : "no project"}
                      </span>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => probe(skill)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => probe(skill)}
                      onBlur={() => setActive(null)}
                      onPointerDown={(e) => {
                        tap.current = {
                          touch: e.pointerType !== "mouse",
                          wasActive: isActive,
                        };
                      }}
                      onClick={() => {
                        if (!tap.current.touch) return;
                        if (tap.current.wasActive) setActive(null);
                        else probe(skill);
                      }}
                      aria-describedby={readoutId}
                      data-state={isActive ? "on" : dim ? "dim" : "rest"}
                      className={`chip cursor-pointer rounded-trace border px-2 py-0.5 font-mono text-micro pointer-coarse:min-h-11 ${
                        isActive
                          ? "border-copper text-copper"
                          : used
                            ? "border-edge/60 text-silk-dim hover:text-silk"
                            : "border-hairline text-silk-faint hover:text-silk"
                      }`}
                    >
                      {skill.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
