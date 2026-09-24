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
    <section id="top" className="max-w-column pt-20 pb-24 sm:pt-28">
      <h1 className="text-display">{SITE.name}</h1>
      <p className="mt-3 text-h3 text-silk-dim">{SITE.role}</p>
      <p className="mt-6 text-silk-dim">
        I&apos;m a Software Engineering and Business Management student who
        likes pairing technical problem-solving with strategic thinking. I&apos;m
        looking to connect with peers, mentors and industry professionals, and
        I&apos;m actively seeking internships where I can apply my skills, keep
        learning, and contribute to projects that matter.
      </p>
      <p className="mt-8 text-micro text-silk-faint">
        {SITE.location} · {SITE.school}
      </p>
    </section>
  );
}
