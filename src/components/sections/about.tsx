import { Section } from "@/components/sections/section";
import { Fade } from "@/components/motion/reveal";
import { ABOUT, EDUCATION } from "@/data/profile";

export function About() {
  return (
    <Section id="about" ref_="01" title="About" className="pb-28">
      <Fade className="max-w-prose space-y-4 text-silk-dim">
        {ABOUT.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </Fade>

      <div className="mt-12 border-t border-hairline pt-8">
        <h3 className="text-micro font-medium text-silk-dim">Education</h3>
        <div className="mt-4 sm:flex sm:items-baseline sm:gap-6">
          <p className="text-h3">{EDUCATION.school}</p>
          {/* A place is a plain fact but not a machine fact, so it stays sans. */}
          <p className="mt-1 text-micro text-silk-faint sm:mt-0">
            {EDUCATION.location}
          </p>
        </div>
        <ul className="mt-4 space-y-1.5">
          {EDUCATION.degrees.map((d) => (
            <li key={d} className="text-silk-dim">
              {d}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
