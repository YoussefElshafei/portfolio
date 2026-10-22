import type { CSSProperties } from "react";
import { RESUME_PATH, SITE } from "@/config/site";

const PROMPT = "whoami --verbose";

/**
 * Hero.
 *
 * No entrance animation on the content — it is present at first paint
 * (DESIGN_BRIEF.md §2.4). The one moving part is the decorative prompt line
 * above the name, which types itself out once. No gradient on the name, no glow behind it, no 100vh with a scroll
 * chevron. The visual interest in this region comes from the trace bus running
 * in the gutter beside it, which is already doing a job.
 */
export function Hero() {
  return (
    <section id="top" className="max-w-column pt-20 pb-24 sm:pt-28">
      {/* Typed once on arrival (CSS only, see .type-line). The full text is in
          the markup from the start, so nothing depends on the animation. */}
      <p
        aria-hidden="true"
        className="mb-4 font-mono text-micro text-silk-faint"
      >
        <span className="text-copper">~$</span>{" "}
        <span
          className="type-line"
          style={{ "--chars": PROMPT.length } as CSSProperties}
        >
          {PROMPT}
        </span>
        <span className="type-caret ml-0.5" />
      </p>
      <h1 className="text-display">{SITE.name}</h1>
      <p className="mt-3 text-h3 text-silk-dim">{SITE.role}</p>
      <p className="mt-6 text-silk-dim">
        I&apos;m a Software Engineering and Business Management student who
        likes pairing technical problem-solving with strategic thinking.
        I&apos;m looking to connect with peers, mentors and industry
        professionals, and I&apos;m actively seeking internships where I can
        apply my skills, keep learning, and contribute to projects that matter.
      </p>
      {/* Availability is a status, so it takes the status colour (§3.2),
          as a small dot beside plain text rather than a coloured pill. */}
      <p className="mt-6 flex items-center gap-2 text-silk">
        <span aria-hidden="true" className="size-2 rounded-full bg-signal" />
        {SITE.availability}
      </p>
      <p className="mt-6 flex flex-wrap gap-3">
        <a
          href="#contact"
          data-magnetic
          className="inline-flex min-h-11 items-center rounded-trace border border-copper px-4 text-copper hover:bg-copper-wash focus-visible:bg-copper-wash"
        >
          Get in touch
        </a>
        <a
          href="#work"
          data-magnetic
          className="inline-flex min-h-11 items-center gap-2 rounded-trace border border-edge px-4 text-silk-dim hover:border-silk-dim hover:text-silk"
        >
          Try the project demos
          <span
            aria-hidden="true"
            className="font-mono text-micro text-silk-faint"
          >
            5
          </span>
        </a>
        {RESUME_PATH && (
          <a
            href={RESUME_PATH}
            className="inline-flex min-h-11 items-center gap-2 rounded-trace border border-edge px-4 text-silk-dim hover:border-silk-dim hover:text-silk"
          >
            Résumé
            <span
              aria-hidden="true"
              className="font-mono text-micro text-silk-faint"
            >
              PDF
            </span>
          </a>
        )}
      </p>
      <p className="mt-8 text-micro text-silk-faint">
        {SITE.location} · {SITE.school}
      </p>
    </section>
  );
}
