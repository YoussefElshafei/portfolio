/**
 * Skills, cross-referenced against the projects.
 *
 * Nothing here is a hand-maintained mapping. A skill is "used in" a project
 * when any "/"-separated part of its name matches one of that project's stack
 * tags, compared with the same normaliser the project graph uses for its
 * edges. So "Linux/Ubuntu" matches WireFish's "Linux", "Python" matches
 * Catan's "Python (visualizer)", and a skill no project lists simply matches
 * nothing, rather than being attached to one by inference. "Continuous
 * Integration" is not tied to TradeWatch, for example, even though TradeWatch
 * runs CI: no stack tag says so, and guessing would make this a claim.
 *
 * U4 is derived, not curated: every stack tag some project uses that none of
 * the supplied skill groups already covers. It exists because the projects
 * name technologies (Kafka, PostgreSQL, Docker…) that the supplied list
 * doesn't, and a cross-reference that couldn't reach them would be missing
 * the most concrete part of the work.
 */

import { normalise } from "@/data/graph";
import { PROJECTS } from "@/data/projects";
import { SKILLS } from "@/data/profile";

export type SkillProject = { id: string; name: string };

export type Skill = {
  label: string;
  /** Projects whose stack includes this skill, in site order. */
  projects: readonly SkillProject[];
};

export type SkillGroup = {
  /** Datasheet-style part designator. */
  designator: string;
  name: string;
  skills: readonly Skill[];
};

const partsOf = (label: string) => label.split("/").map(normalise);

function projectsFor(label: string): SkillProject[] {
  const parts = partsOf(label);
  return PROJECTS.filter((p) =>
    p.stack.some((tag) => parts.includes(normalise(tag))),
  ).map((p) => ({ id: p.id, name: p.name }));
}

const SUPPLIED: SkillGroup[] = SKILLS.map((g, i) => ({
  designator: `U${i + 1}`,
  name: g.name,
  skills: g.items.map((label) => ({ label, projects: projectsFor(label) })),
}));

/** Stack tags no supplied skill covers, first spelling wins, in site order. */
const DERIVED: Skill[] = (() => {
  const covered = new Set(
    SKILLS.flatMap((g) => g.items.flatMap((label) => partsOf(label))),
  );
  const seen = new Map<string, string>();
  for (const p of PROJECTS) {
    for (const tag of p.stack) {
      const key = normalise(tag);
      // "Python (visualizer)" is written with its qualifier dropped.
      if (!covered.has(key) && !seen.has(key)) {
        seen.set(key, tag.replace(/\s*\(.*?\)\s*/g, "").trim());
      }
    }
  }
  return [...seen.values()].map((label) => ({
    label,
    projects: projectsFor(label),
  }));
})();

export const SKILL_GROUPS: readonly SkillGroup[] = [
  ...SUPPLIED,
  {
    designator: `U${SUPPLIED.length + 1}`,
    name: "Also in the projects",
    skills: DERIVED,
  },
];

/** Do two skills share at least one project? Drives the dim state. */
export function related(a: Skill, b: Skill) {
  const ids = new Set(a.projects.map((p) => p.id));
  return b.projects.some((p) => ids.has(p.id));
}
