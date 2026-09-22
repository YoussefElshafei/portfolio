import { ProjectGraph } from "@/components/graph/project-graph";

/*
 * SCAFFOLD PAGE
 *
 * Not the real home page. This is a specimen: it renders the design system so
 * the tokens, the type scale, the trace bus and the graph can be inspected
 * while there is no content.
 *
 * Everything on it is true — measured contrast ratios, the actual type scale,
 * this repository's real module graph. There is no lorem ipsum and nothing
 * pretending to be portfolio content, per DESIGN_BRIEF.md §1.
 *
 * Delete this file at the content stage and update src/lib/sections.ts.
 */

const TYPE_STEPS = [
  { token: "text-display", size: "clamp(2.25→3.05rem)", sample: "Display" },
  { token: "text-h1", size: "1.9531rem", sample: "Heading one" },
  { token: "text-h2", size: "1.5625rem", sample: "Heading two" },
  { token: "text-h3", size: "1.25rem", sample: "Heading three" },
  { token: "text-body", size: "1rem", sample: "Body copy" },
  { token: "text-micro", size: "0.8rem", sample: "Micro label" },
];

const PALETTE = [
  { token: "substrate", dark: "#0B0E11", light: "#F6F4F1", ratio: null },
  { token: "surface", dark: "#12161A", light: "#FFFFFF", ratio: null },
  {
    token: "hairline",
    dark: "#1E252B",
    light: "#E2DDD7",
    ratio: "1.25 / 1.23",
  },
  { token: "edge", dark: "#5A646E", light: "#8F867B", ratio: "3.21 / 3.26" },
  { token: "silk", dark: "#E6EAEE", light: "#15181B", ratio: "16.01 / 16.23" },
  {
    token: "silk-dim",
    dark: "#9AA6B2",
    light: "#545C64",
    ratio: "7.81 / 6.19",
  },
  {
    token: "silk-faint",
    dark: "#818E9B",
    light: "#5F6874",
    ratio: "5.78 / 5.14",
  },
  { token: "copper", dark: "#F0803C", light: "#9A4512", ratio: "7.24 / 5.91" },
  { token: "signal", dark: "#4FB6A8", light: "#1F6F66", ratio: "7.92 / 5.43" },
];

function SectionLabel({ ref_, children }: { ref_: string; children: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-3">
      <span className="font-mono text-micro text-silk-faint">{ref_}</span>
      <h2 className="text-h2">{children}</h2>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* Deliberately unequal widths and padding between sections. Identical
          rhythm top to bottom is itself a tell (§2.5). */}
      <section id="overview" className="max-w-prose pt-20 pb-28">
        <p className="mb-4 font-mono text-micro text-silk-faint">
          scaffold / no content yet
        </p>
        <h1 className="mb-6 text-display">Design system</h1>
        <p className="text-silk-dim">
          The shell is built: theme tokens for both themes, the type scale, the
          trace bus in the left gutter, the graph, the header nav and the
          footer. Sections below show each part running so it can be checked
          before any content is written.
        </p>
      </section>

      <section id="graph" className="pb-32">
        <SectionLabel ref_="01">Project graph</SectionLabel>
        <p className="mb-10 max-w-prose text-silk-dim">
          Nodes are projects and edges join projects that share part of a stack.
          Until projects exist the dataset is this repository&rsquo;s own
          modules, where an edge means a shared layer. Coordinates are
          precomputed and committed, so the diagram is identical on every load.
          Hover a node or a layer; the list carries the same information for the
          keyboard.
        </p>
        <ProjectGraph />
      </section>

      <section id="type" className="pb-32">
        <SectionLabel ref_="02">Typography</SectionLabel>
        <p className="mb-10 max-w-prose text-silk-dim">
          IBM Plex Sans for everything read as language. IBM Plex Mono for
          machine facts only: sizes, ratios, identifiers, timestamps. The
          monospace column below is mono because those are measurements; the
          sample column is not.
        </p>
        <ul className="divide-y divide-hairline border-t border-b border-hairline">
          {TYPE_STEPS.map((step) => (
            <li
              key={step.token}
              className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-5"
            >
              <span className="w-28 shrink-0 font-mono text-micro text-silk-faint sm:w-40">
                {step.token}
              </span>
              <span className="w-36 shrink-0 font-mono text-micro text-silk-faint sm:w-44">
                {step.size}
              </span>
              <span className={`${step.token} text-silk`}>{step.sample}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="color" className="pb-24">
        <SectionLabel ref_="03">Color</SectionLabel>
        <p className="mb-10 max-w-prose text-silk-dim">
          Nine tokens, one accent, one status colour. The ratio column is
          measured against each theme&rsquo;s own background. Switch the theme
          in the header: the accent is a token pair, not one value reused, since
          the dark copper scores 2.43:1 on the light background.
        </p>
        <ul className="divide-y divide-hairline border-t border-b border-hairline">
          {PALETTE.map((row) => (
            <li
              key={row.token}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4"
            >
              <span
                aria-hidden="true"
                className="size-7 shrink-0 rounded-trace border border-edge"
                style={{ backgroundColor: `var(--${row.token})` }}
              />
              <span className="w-32 shrink-0 font-mono text-micro text-silk">
                {row.token}
              </span>
              {/* The three machine facts drop to their own line on a phone
                  rather than each wrapping separately. */}
              <span className="flex w-full gap-x-6 sm:w-auto">
                <span className="w-20 shrink-0 font-mono text-micro text-silk-faint sm:w-24">
                  {row.dark}
                </span>
                <span className="w-20 shrink-0 font-mono text-micro text-silk-faint sm:w-24">
                  {row.light}
                </span>
                <span className="font-mono text-micro text-silk-faint">
                  {row.ratio ? `${row.ratio}:1` : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
