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
  "inline-flex size-9 items-center justify-center rounded-trace border border-hairline";

/**
 * The three contact links, used in the header, the contact section and the
 * footer. One component, so the copies cannot drift apart.
 *
 * A link with no URL renders inert rather than as `href="#"` and drops out of
 * the tab order, so nothing on the page offers something it cannot do.
 */
export function ContactLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex items-center gap-2 ${className}`}>
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
  );
}
