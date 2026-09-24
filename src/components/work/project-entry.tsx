import Image from "next/image";
import type { Project, ProjectLink } from "@/data/projects";
import { PipelineDiagram } from "@/components/visuals/pipeline";
import { TerminalBlock } from "@/components/visuals/terminal";
import { BridgeAidDemo } from "@/components/visuals/bridgeaid-demo";
import { HexBoard } from "@/components/visuals/hex-board";
import { LiveSignal } from "@/components/visuals/live-signal";
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
 * A live demo is the strongest thing an entry can offer (a reviewer can use
 * the software, not just read about it), so it is the one filled control in
 * the section and sits right under the title rather than after the prose.
 *
 * Copper on substrate clears 7.24:1 dark and 5.91:1 light (globals.css), so
 * the inverted label is as legible as body text. Hover darkens by opacity
 * rather than a second accent hex, which would need its own contrast check.
 */
function DemoButton({ link }: { link: ProjectLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={link.a11yLabel ?? link.label}
      className="inline-flex items-center gap-2 rounded-trace border border-copper bg-copper px-4 py-2 text-micro font-semibold text-substrate hover:opacity-85"
    >
      {link.label}
      <ArrowOut />
    </a>
  );
}

/**
 * One project.
 *
 * Order is deliberate: the write-up, which says what the project does and why
 * it was built the way it was, comes before the implementation bullets, so the
 * entry reads as an explanation rather than a feature list (DESIGN_BRIEF.md
 * §1d).
 *
 * The bullets sit behind a native <details>. That keeps five projects scannable
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
    description,
    details,
    stack,
    links,
    image,
    visual,
    liveSignal,
    team,
  } = project;

  const demos = links.filter((l) => l.kind === "demo");
  const others = links.filter((l) => l.kind !== "demo");

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

      {demos.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {demos.map((link) => (
            <DemoButton key={link.href} link={link} />
          ))}
        </div>
      )}

      {/*
        An image sits in a 3:2 frame at the column width, like every other
        piece of media, so its edges line up with the text beneath it.
        `object-contain`, not `cover`: a screenshot is evidence, and cropping
        it to fit a shape throws away the part that makes it evidence.
      */}
      {image && (
        <div className="relative mt-8 aspect-[3/2] w-full max-w-column overflow-hidden rounded-trace border border-hairline bg-surface">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            // The column is 50rem (800px); never ask for more.
            sizes="(min-width: 900px) 800px, 100vw"
            className="object-contain"
          />
        </div>
      )}
      {visual === "pipeline" && <PipelineDiagram />}
      {visual === "terminal" && <TerminalBlock />}
      {visual === "bridgeaid-map" && <BridgeAidDemo />}
      {visual === "hex-board" && <HexBoard />}
      {liveSignal && <LiveSignal />}

      {/* The write-up follows all of the media, so each entry shows the work
          first and then explains it. */}
      <Fade className="mt-8 max-w-column space-y-4 text-silk-dim">
        {description.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </Fade>

      {details.length > 0 && (
        <details className="group mt-8 max-w-column">
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
        <p className="mt-6 max-w-column text-micro text-silk-faint">{team}</p>
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

      {others.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {others.map((link) => (
            <LinkButton key={link.href} link={link} />
          ))}
        </div>
      )}
    </article>
  );
}
