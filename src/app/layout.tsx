import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

import { ThemeScript } from "@/components/theme/theme-script";
import { SiteHeader } from "@/components/nav/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TraceBus } from "@/components/nav/trace-bus";
import { NavStateProvider } from "@/lib/nav-state";
import { SITE } from "@/config/site";

/* Two typefaces, exactly (DESIGN_BRIEF.md §3.1). Self-hosted by next/font, so
   there is no third-party request and no layout shift. Only the weights the
   system actually uses are loaded. */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: SITE.name,
  description: SITE.description,
};

export const viewport: Viewport = {
  // Matches the substrate token per theme, so the browser chrome does not
  // flash white on a phone.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0e11" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4f1" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The blocking script writes data-theme before React sees the document.
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col" id="top">
        <a
          href="#main"
          className="sr-only rounded-trace border border-hairline bg-surface px-4 py-2 text-silk focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>

        <NavStateProvider>
          <TraceBus />
          {/*
            The gutter is reserved on one wrapper around all three regions
            rather than on <main> alone, so the header, the content and the
            footer share a left edge. Reserving it on <main> only put the
            header out of alignment with the page by the width of the gutter.
          */}
          <div className="flex min-h-full flex-1 flex-col xl:pl-gutter">
            <SiteHeader />
            <main id="main" className="flex-1">
              <div className="mx-auto max-w-wide px-5 sm:px-8">{children}</div>
            </main>
            <SiteFooter />
          </div>
        </NavStateProvider>
      </body>
    </html>
  );
}
