import type { ComponentType, SVGProps } from "react";
import {
  EnvelopeMark,
  GitHubMark,
  LinkedInMark,
} from "@/components/icons/brand";
import { CONTACT } from "@/config/site";

type Link = {
  key: string;
  label: string;
  href: string;
  external: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const LINKS: Link[] = [
  {
    key: "github",
    label: "GitHub",
    href: CONTACT.github,
    external: true,
    Icon: GitHubMark,
  },
  {
    key: "email",
    label: "Email",
    href: CONTACT.email ? `mailto:${CONTACT.email}` : "",
    external: false,
    Icon: EnvelopeMark,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: CONTACT.linkedin,
    external: true,
    Icon: LinkedInMark,
  },
];

const BOX =
  "border-hairline rounded-trace inline-flex size-9 items-center justify-center border";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-hairline">
      <div className="mx-auto flex max-w-wide flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {/* A year is a machine fact, so it is set in mono (§2.6). */}
        <p className="font-mono text-micro text-silk-faint">
          © {new Date().getFullYear()}
        </p>

        <ul className="flex items-center gap-2">
          {LINKS.map(({ key, label, href, external, Icon }) => (
            <li key={key}>
              {href ? (
                <a
                  href={href}
                  aria-label={label}
                  {...(external
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                  className={`${BOX} text-silk-dim hover:border-edge hover:text-copper`}
                >
                  <Icon className="size-4" />
                </a>
              ) : (
                /*
                 * No URL yet. Rendered inert rather than as a dead link, and
                 * removed from the tab order, so nothing on the page promises
                 * something it cannot do.
                 */
                <span
                  role="img"
                  aria-label={`${label} — link not configured`}
                  title="Pending"
                  className={`${BOX} border-dashed text-silk-faint/40`}
                >
                  <Icon className="size-4" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
