import { Section } from "@/components/sections/section";
import { CERTIFICATIONS, INVOLVEMENT } from "@/data/profile";

export function Involvement() {
  return (
    <Section id="involvement" ref_="05" title="Involvement" className="pb-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h3 className="mb-5 text-micro font-medium text-silk-dim">
            Certifications
          </h3>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {CERTIFICATIONS.map((cert) => (
              <li key={cert.name} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-silk">{cert.name}</p>
                  {/* Issue date is a machine fact -> mono (§2.6). */}
                  <span className="font-mono text-micro text-silk-faint">
                    {cert.date}
                  </span>
                </div>
                <p className="mt-1 text-micro text-silk-faint">{cert.issuer}</p>
                {cert.note && (
                  <p className="mt-2 text-micro text-silk-dim">{cert.note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-5 text-micro font-medium text-silk-dim">
            Professional development
          </h3>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {INVOLVEMENT.map((item) => (
              <li key={item.name} className="py-4">
                <p className="text-silk">{item.name}</p>
                <p className="mt-2 text-micro text-silk-dim">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
