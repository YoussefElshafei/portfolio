import { ContactLinks } from "@/components/contact-links";
import { SITE } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-hairline">
      <div className="mx-auto flex max-w-wide flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {/* The name is prose; only the year is a machine fact (§2.6). */}
        <p className="text-micro text-silk-faint">
          {SITE.name}{" "}
          <span className="font-mono">{new Date().getFullYear()}</span>
        </p>
        <ContactLinks />
      </div>
    </footer>
  );
}
