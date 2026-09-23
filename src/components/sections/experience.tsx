import { Section } from "@/components/sections/section";
import { EXPERIENCE } from "@/data/profile";

export function Experience() {
  return (
    <Section id="experience" ref_="04" title="Experience" className="pb-28">
      {EXPERIENCE.map((role) => (
        <div key={role.role} className="border-t border-hairline pt-8">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-h3">{role.role}</h3>
            {/* A date range is a machine fact -> mono (§2.6). */}
            <span className="font-mono text-micro text-silk-faint">
              {role.period}
            </span>
          </div>
          <p className="mt-1 text-micro text-silk-faint">{role.kind}</p>
          <ul className="mt-5 max-w-prose space-y-2 border-l border-hairline pl-5">
            {role.points.map((p) => (
              <li key={p} className="text-silk-dim">
                {p}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
