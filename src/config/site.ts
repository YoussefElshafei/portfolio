/**
 * Site configuration. The one file to edit for identity and contact.
 */
export const SITE = {
  name: "Youssef Elshafei",
  role: "Software Engineering & Business Management Student",
  location: "Hamilton, ON",
  school: "McMaster University",
  /** Shown in the hero. The owner's wording, 2026-10-21. */
  availability: "Seeking a co-op starting May 2027 or later",
  description:
    "Software engineering and business management student at McMaster University. Projects in market data infrastructure, disaster response, network diagnostics and embedded control.",
  /**
   * Absolute origin, needed so Open Graph and Twitter image URLs resolve.
   *
   * Set NEXT_PUBLIC_SITE_URL to the custom domain once it is pointed at Vercel.
   * Until then Vercel supplies the production hostname automatically, so
   * previews and the .vercel.app deployment still produce correct absolute
   * URLs, and local development falls back to localhost.
   */
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
} as const;

/**
 * Path to a résumé PDF inside `public/`, or "" if there isn't one.
 *
 * Drop the file at `public/youssef-elshafei-resume.pdf` and set this to
 * "/youssef-elshafei-resume.pdf" to make the download link appear. While it is
 * empty no link renders at all — a résumé button that 404s is on the
 * anti-pattern list in DESIGN_BRIEF.md §1c.
 */
// Empty on purpose: the owner removed the résumé download on 2026-10-21.
export const RESUME_PATH = "";

export const CONTACT = {
  github: "https://github.com/YoussefElshafei",
  linkedin: "https://www.linkedin.com/in/youssef-elshafei/",
  email: "elshafei.career@gmail.com",
} as const;

/**
 * Web3Forms access key for the "Say hello" form, or "" to hide the form.
 *
 * Public by design: the key can only send mail to the owner's own inbox,
 * which is all a contact form does. It lives in an environment variable
 * (NEXT_PUBLIC_WEB3FORMS_KEY, set in .env.local and in Vercel) so it is not
 * committed. NEXT_PUBLIC_ values are baked in at build time, so redeploy
 * after changing it.
 */
export const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
