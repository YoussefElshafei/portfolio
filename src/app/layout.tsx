import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/components/nav/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TraceBus } from "@/components/nav/trace-bus";
import { CircuitBackdrop } from "@/components/visuals/circuit-backdrop";
import { INTRO_SCRIPT, Intro } from "@/components/intro";
import { NavStateProvider, NAV_END_ID } from "@/lib/nav-state";
import { SITE } from "@/config/site";
import { PROJECTS } from "@/data/projects";

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
  // Without metadataBase, Next emits relative og:image URLs and most scrapers
  // refuse them, so the card silently renders without an image.
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.role}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  keywords: [
    "software engineering",
    "McMaster University",
    "portfolio",
    ...PROJECTS.map((p) => p.name),
  ],
  openGraph: {
    title: `${SITE.name} — ${SITE.role}`,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: "profile",
    locale: "en_CA",
    // The image itself comes from src/app/opengraph-image.tsx.
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.role}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  // Matches the substrate token, so the browser chrome does not flash white
  // on a phone. The site is dark only.
  themeColor: "#0b0e11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The intro script in <head> may set data-intro before React sees the
      // document, so the server and client <html> attributes can differ.
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
    >
      <head>
        {/* Decides, before first paint, whether the first-visit intro plays.
            See components/intro.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        {/* Entrance animations start from hidden inline styles that only
            JavaScript clears. Without it, show everything in its final state
            rather than leave headings and prose invisible. [data-js-only]
            marks things that are blank without JS (the graph canvas), which
            are better absent than empty. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}[data-js-only]{display:none!important}`}</style>
        </noscript>
      </head>
      <body
        className="flex min-h-full flex-col"
        id="top"
        // Browser extensions (Grammarly, password managers) stamp their own
        // attributes onto <body> before React hydrates, which React reports
        // as a mismatch. This silences attribute mismatches on this one
        // element only; it does not reach its children, so a real mismatch
        // anywhere in the page is still reported.
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only rounded-trace border border-hairline bg-surface px-4 py-2 text-silk focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>

        <CircuitBackdrop />
        <Intro />

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
            {/* Marks the end of the document for the nav-state observer, so
                the last section can still be marked current once the page has
                scrolled as far as it goes. */}
            <div id={NAV_END_ID} aria-hidden="true" className="h-px" />
          </div>
        </NavStateProvider>
      </body>
    </html>
  );
}
