import { Section } from "@/components/sections/section";
import { Fade } from "@/components/motion/reveal";
import { ProjectGraph } from "@/components/graph/project-graph";
import { ProjectEntry } from "@/components/work/project-entry";
import { PROJECTS } from "@/data/projects";

/**
 * Projects.
 *
 * The graph is the index: it shows the shape of the work — what shares a stack
 * with what — in a way a vertical list of cards cannot. The entries below are
 * the detail, and the graph's nodes link straight to them.
 */
export function Work() {
  return (
    <Section id="work" ref_="02" title="Projects" className="pb-28">
      <Fade className="mb-10 max-w-prose text-silk-dim">
        <p>
          Six projects. Each one leads with the problem it had to solve and the
          constraint that made it awkward, because that is the part worth
          reading. Nodes in the diagram link to the entry below.
        </p>
      </Fade>

      <ProjectGraph />

      <div className="mt-16">
        {PROJECTS.map((project) => (
          <ProjectEntry key={project.id} project={project} />
        ))}
      </div>
    </Section>
  );
}
