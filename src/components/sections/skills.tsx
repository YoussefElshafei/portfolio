import { Section } from "@/components/sections/section";
import { SKILLS } from "@/data/profile";

/**
 * Skills.
 *
 * Grouped, unranked, and with no percentage bars — a self-assigned "React 90%"
 * is a meaningless number and DESIGN_BRIEF.md §1 lists it as a tell. Each item
 * is a technology identifier, which is a machine fact, so the tags are mono
 * while the group names are prose and stay sans (§2.6).
 *
 * No entrance animation: these are machine facts and they snap in (§2.4).
 */
export function Skills() {
  return (
    <Section id="skills" ref_="03" title="Skills" className="pb-28">
      <div className="space-y-10">
        {SKILLS.map((group) => (
          <div key={group.name}>
            <h3 className="mb-4 text-micro font-medium text-silk-dim">
              {group.name}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="rounded-trace border border-hairline px-2.5 py-1 font-mono text-micro text-silk-faint"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
