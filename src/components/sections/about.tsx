import { Section } from "@/components/sections/section";
import { Fade } from "@/components/motion/reveal";
import { ABOUT, EDUCATION, RECOGNITION } from "@/data/profile";
import { SITE } from "@/config/site";

/**
 * About, as a single profile panel: identity across the top, then the bio and
 * the record side by side on wide screens (stacked below lg). The panel is the
 * same column as every other block on the page, so its edges line up with the
 * text around it.
 *
 * This is the one deliberate exception to "no cards" (DESIGN_BRIEF.md §2.5),
 * made on request. It is kept within the brief's other surface rules so it
 * still reads as part of the board rather than a dropped-in template: one
 * panel, never repeated or nested, hairline border, 4px radius, `surface`
 * fill for elevation, no shadow, no coloured edge.
 *
 * No photo slot. There is no photo yet, and a placeholder silhouette is
 * exactly the kind of fake content §1a rules out. When a real one exists it
 * goes at the left of the identity row.
 */
export function About() {
  return (
    <Section id="about" ref_="01" title="About" className="pb-28">
      <div className="max-w-column rounded-trace border border-hairline bg-surface">
        <div className="border-b border-hairline px-6 py-6 sm:px-8">
          <p className="text-h3">{SITE.name}</p>
          <p className="mt-1 text-silk-dim">{SITE.role}</p>
          <p className="mt-1 text-micro text-silk-faint">
            {EDUCATION.school}, {EDUCATION.location}
          </p>
        </div>

        <div className="grid lg:grid-cols-2">
          <Fade className="space-y-4 px-6 py-6 text-silk-dim sm:px-8">
            {ABOUT.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </Fade>

          <dl className="space-y-6 border-t border-hairline px-6 py-6 sm:px-8 lg:border-t-0 lg:border-l">
            <div>
              <dt className="text-micro font-medium text-silk-dim">
                Education
              </dt>
              <dd className="mt-2">
                <ul className="space-y-1">
                  {EDUCATION.degrees.map((d) => (
                    <li key={d} className="text-silk">
                      {d}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>

            <div>
              <dt className="text-micro font-medium text-silk-dim">GPA</dt>
              {/* The value is a machine fact -> mono (§2.6). */}
              <dd className="mt-2 font-mono text-silk">{EDUCATION.gpa}</dd>
            </div>

            <div>
              <dt className="text-micro font-medium text-silk-dim">
                Recognition
              </dt>
              <dd className="mt-2">
                <ul className="space-y-2">
                  {RECOGNITION.map((r) => (
                    <li key={r.name}>
                      <p className="text-silk">
                        {"href" in r ? (
                          <a
                            href={r.href}
                            className="underline decoration-hairline underline-offset-4 hover:text-copper hover:decoration-copper"
                          >
                            {r.name}
                          </a>
                        ) : (
                          r.name
                        )}
                      </p>
                      <p className="text-micro text-silk-faint">{r.detail}</p>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Section>
  );
}
