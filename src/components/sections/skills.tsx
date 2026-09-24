import { Section } from "@/components/sections/section";
import { SkillMatrix } from "@/components/sections/skill-matrix";

/**
 * Skills.
 *
 * Grouped, unranked, and with no percentage bars: a self-assigned "React 90%"
 * is a meaningless number and DESIGN_BRIEF.md §1 lists it as a tell. The
 * interactive part (probing a skill to see which projects use it) lives in
 * the client component; this shell stays a Server Component.
 *
 * No entrance animation: these are machine facts and they snap in (§2.4).
 */
export function Skills() {
  return (
    <Section id="skills" ref_="03" title="Skills" className="pb-28">
      <SkillMatrix />
    </Section>
  );
}
