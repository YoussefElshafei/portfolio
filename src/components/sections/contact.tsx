import { Section } from "@/components/sections/section";
import { Fade } from "@/components/motion/reveal";
import { ContactLinks } from "@/components/contact-links";
import { CONTACT } from "@/config/site";

/**
 * Contact.
 *
 * A mailto link, not a form. A form needs a provider, an API key, spam
 * handling, a success state, an error state and a rate limit, and each of those
 * is a thing that can silently break — at which point it becomes the
 * "contact form that posts nowhere" from DESIGN_BRIEF.md §1c. A visible
 * address cannot break.
 */
export function Contact() {
  return (
    <Section id="contact" ref_="06" title="Contact" className="pb-24">
      <Fade className="max-w-prose text-silk-dim">
        <p>
          The quickest way to reach me is email. I read everything that arrives.
        </p>
      </Fade>

      <a
        href={`mailto:${CONTACT.email}`}
        className="mt-6 inline-block font-mono text-h3 text-copper underline decoration-hairline underline-offset-4 hover:decoration-copper"
      >
        {CONTACT.email}
      </a>

      <div className="mt-10">
        <ContactLinks />
      </div>
    </Section>
  );
}
