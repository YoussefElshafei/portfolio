import { SITE } from "@/config/site";

/**
 * Hero.
 *
 * No entrance animation at all — it is present at first paint (DESIGN_BRIEF.md
 * §2.4). No gradient on the name, no glow behind it, no 100vh with a scroll
 * chevron. The visual interest in this region comes from the trace bus running
 * in the gutter beside it, which is already doing a job.
 */
export function Hero() {
  return (
    <section id="top" className="max-w-prose pt-20 pb-24 sm:pt-28">
      <h1 className="text-display">{SITE.name}</h1>
      <p className="mt-3 text-h3 text-silk-dim">{SITE.role}</p>
      <p className="mt-6 text-silk-dim">
        I study software engineering and business management at McMaster. I
        build systems that run, and think about the context around them rather
        than only the code.
      </p>
      <p className="mt-8 text-micro text-silk-faint">
        {SITE.location} · {SITE.school}
      </p>
    </section>
  );
}
