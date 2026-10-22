import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy, scoped to what the site actually loads.
 *
 * - Scripts and styles are first-party only. `'unsafe-inline'` is needed
 *   because the site is statically generated: Next.js inlines its hydration
 *   data, and the intro decision runs as an inline <script> before first
 *   paint. The alternative, per-request nonces, would force every page into
 *   dynamic rendering (see node_modules/next/dist/docs, "Content Security
 *   Policy"). Leaflet and Motion also set inline styles.
 * - `'unsafe-eval'` in development only: React uses eval for its dev-mode
 *   error stacks. Production needs neither.
 * - Third-party origins: the OpenStreetMap tile server for the BridgeAid
 *   demo map, and Web3Forms for the contact form. Fonts are self-hosted by
 *   next/font.
 * - `ws:` in development only, for the dev server's hot reload.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  // Web3Forms receives the contact form (DESIGN_BRIEF.md §2.8). fetch() is
  // governed by connect-src; form-action stays 'self' because the form never
  // navigates anywhere.
  `connect-src 'self' https://api.web3forms.com${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Every browser feature the site does not use, switched off. Nothing here
 * asks for any of them; this stops an injected script from doing so either.
 */
const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "bluetooth=()",
  "hid=()",
  "midi=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  "display-capture=()",
  "browsing-topics=()",
].join(", ");

const nextConfig: NextConfig = {
  // Don't advertise the framework and version to anyone probing for it.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Not "no-referrer": OpenStreetMap's tile usage policy requires a
          // valid Referer, and this still sends only the origin cross-site.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "Permissions-Policy", value: permissionsPolicy },
          // Legacy twin of frame-ancestors, for browsers that predate CSP 2.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
