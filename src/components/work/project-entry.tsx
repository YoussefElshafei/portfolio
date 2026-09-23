import Image from "next/image";
import type { Project, ProjectLink } from "@/data/projects";
import { PipelineDiagram } from "@/components/visuals/pipeline";
import { Fade } from "@/components/motion/reveal";

function ArrowOut() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <path d="M5 11L11 5M11 5H6M11 5v5" strokeLinecap="square" />
    </svg>
  );
}

function LinkButton({ link }: { link: ProjectLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={link.a11yLabel ?? link.label}
      className="inline-flex items-center gap-2 rounded-trace border border-hairline px-3 py-1.5 text-micro text-silk-dim hover:border-edge hover:text-copper"
    >
      {link.label}
      <ArrowOut />
    </a>
  );
}

/**
 * One project.
 *
 * Order is deliberate: the problem / constraint / trade-off framing comes
 * before the implementation bullets, so the entry reads as an argument rather
 * than a feature list (DESIGN_BRIEF.md §1d).
 *
 * The bullets sit behind a native <details>. That keeps six projects scannable
 * without hiding anything, and native disclosure is keyboard accessible and
 * works with JavaScript disabled — no state, no library.
 *
 * Not a card: a hairline-ruled row, no shadow, 4px radius cap (§2.5).
 */
export function ProjectEntry({ project }: { project: Project }) {
  const {
    id,
    index,
    name,
    tagline,
    status,
    summary,
    framing,
    details,
    stack,
    links,
    image,
    visual,
    team,
  } = project;

  return (
    <article
      id={`work-${id}`}
      className="scroll-mt-24 border-t border-hairline py-10"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {/* Index is a machine fact -> mono, and gets no entrance animation. */}
        <span className="font-mono text-micro text-silk-faint">{index}</span>
        <h3 className="text-h2">{name}</h3>
        {status && (
          <span className="inline-flex items-baseline gap-2 rounded-trace border border-signal/40 px-2 py-0.5 text-micro text-signal">
            {status.label}
            <span className="font-mono text-silk-faint">{status.detail}</span>
          </span>
        )}
      </div>

      <p className="mt-1 text-micro text-silk-faint">{tagline}</p>

      <Fade className="mt-5 max-w-prose text-silk-dim">
        <p>{summary}</p>
      </Fade>

      {/*
        Every project image sits in the same 3:2 frame, regardless of its own
        proportions — the three sources run from 1:1 to 2.34:1, and at their
        natural ratios the entries read as wildly uneven blocks.

        `object-contain`, not `cover`: a CAD drawing and a map screenshot are
        evidence, and cropping them to fit a shape throws away the part that
        makes them evidence. The letterboxing sits on `surface`, so it reads as
        a deliberate plate rather than a gap. Nothing is ever scaled up past
        its source, because contain only ever shrinks to fit this box.
      */}
      {image && (
        <div className="relative mt-8 aspect-[3/2] w-full max-w-figure overflow-hidden rounded-trace border border-hairline bg-surface">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            // The frame is at most 832px wide, and contain means a portrait or
            // square image occupies less than that. Asking for more would have
            // the browser fetch a candidate it cannot use.
            sizes="(min-width: 1024px) 832px, 100vw"
            className="object-contain"
          />
        </div>
      )}
      {visual === "pipeline" && <PipelineDiagram />}

      <dl className="mt-8 max-w-prose space-y-4">
        {(
          [
            ["Problem", framing.problem],
            ["Constraint", framing.constraint],
            ["Trade-off", framing.tradeoff],
          ] as const
        ).map(([label, text]) => (
          <div key={label} className="sm:flex sm:gap-6">
            {/* These are prose labels, not machine facts, so they stay in the
                sans face however much a mono label would look the part. */}
            <dt className="w-28 shrink-0 text-micro font-medium text-silk">
              {label}
            </dt>
            <dd className="mt-1 text-silk-dim sm:mt-0">{text}</dd>
          </div>
        ))}
      </dl>

      {details.length > 0 && (
        <details className="group mt-6 max-w-prose">
          <summary className="inline-flex cursor-pointer items-center gap-2 text-micro text-silk-dim hover:text-copper">
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 ease-trace group-open:rotate-90"
            >
              ›
            </span>
            Implementation detail
            <span className="font-mono text-silk-faint">
              {String(details.length).padStart(2, "0")}
            </span>
          </summary>
          <ul className="mt-4 space-y-2 border-l border-hairline pl-5">
            {details.map((d) => (
              <li key={d} className="text-silk-dim">
                {d}
              </li>
            ))}
          </ul>
        </details>
      )}

      {team && (
        <p className="mt-6 max-w-prose text-micro text-silk-faint">{team}</p>
      )}

      <ul className="mt-7 flex flex-wrap gap-x-2 gap-y-2">
        {stack.map((tech) => (
          <li
            key={tech}
            className="rounded-trace border border-hairline px-2 py-0.5 font-mono text-micro text-silk-faint"
          >
            {tech}
          </li>
        ))}
      </ul>

      {links.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {links.map((link) => (
            <LinkButton key={link.href} link={link} />
          ))}
        </div>
      )}
    </article>
  );
}
