/**
 * Site configuration.
 *
 * The one file to edit at the content stage.
 *
 * The contact values are intentionally EMPTY rather than filled with a
 * plausible-looking guess. An empty value renders the footer icon in a visibly
 * inactive state instead of a link that goes nowhere, which keeps the build
 * honest: DESIGN_BRIEF.md §1 forbids a resume button that 404s or a contact
 * affordance that silently does nothing, and a `href="#"` is the same sin.
 */
export const SITE = {
  /** Replace with the real name. Used in the header and in metadata. */
  name: "Portfolio",
  /** One line, no buzzwords. See DESIGN_BRIEF.md §1 item 9. */
  description: "Design system scaffold. Content pending.",
  /** Canonical origin, for metadata and the OG image. */
  url: "https://example.com",
} as const;

export const CONTACT = {
  github: "",
  linkedin: "",
  email: "",
} as const;
