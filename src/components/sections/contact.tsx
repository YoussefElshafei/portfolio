import { Section } from "@/components/sections/section";
import { Fade } from "@/components/motion/reveal";
import { ContactForm } from "@/components/contact/contact-form";
import { CopyEmail } from "@/components/contact/copy-email";
import { GitHubMark, LinkedInMark } from "@/components/icons/brand";
import { CONTACT, RESUME_PATH } from "@/config/site";

/**
 * Contact.
 *
 * The visible address and a mailto link come first and always work. The form
 * below them is a convenience, not the only route: it posts to Web3Forms, and
 * if that fails it hands the visitor a prefilled mailto link (see
 * contact-form.tsx and DESIGN_BRIEF.md §2.8).
 */

const ACTION =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-trace border border-edge px-4 text-silk-dim hover:border-silk-dim hover:text-silk";

export function Contact() {
  return (
    <Section id="contact" ref_="05" title="Contact" className="pb-24">
      <div>
        <Fade className="text-silk-dim">
          <p>
            Recruiting for a co-op, or want to talk about one of the projects?
            Email is quickest, and I read everything that arrives.
          </p>
        </Fade>

        <a
          href={`mailto:${CONTACT.email}`}
          className="mt-6 inline-block font-mono text-h3 break-all text-copper underline decoration-hairline underline-offset-4 hover:decoration-copper pointer-coarse:py-2"
        >
          {CONTACT.email}
        </a>

        <ul className="mt-6 flex flex-wrap gap-3">
          <li>
            <CopyEmail className={ACTION} />
          </li>
          <li>
            <a href={`mailto:${CONTACT.email}`} className={ACTION}>
              Open in mail app
            </a>
          </li>
          <li>
            <a
              href={CONTACT.linkedin}
              target="_blank"
              rel="noreferrer noopener"
              className={ACTION}
            >
              <LinkedInMark className="size-4" aria-hidden="true" />
              LinkedIn
            </a>
          </li>
          <li>
            <a
              href={CONTACT.github}
              target="_blank"
              rel="noreferrer noopener"
              className={ACTION}
            >
              <GitHubMark className="size-4" aria-hidden="true" />
              GitHub
            </a>
          </li>
          {RESUME_PATH && (
            <li>
              <a href={RESUME_PATH} download className={ACTION}>
                Résumé
                <span
                  aria-hidden="true"
                  className="font-mono text-micro text-silk-faint"
                >
                  PDF
                </span>
              </a>
            </li>
          )}
        </ul>

        <div className="mt-12 border-t border-hairline pt-10">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
