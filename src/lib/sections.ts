/**
 * The section registry.
 *
 * This is the single source of truth for the header nav, the mobile sheet and
 * the trace bus. All three read from here, so they cannot drift apart.
 *
 * SCAFFOLD: these are the design-system specimen sections. When real content
 * arrives, replace this array and every navigation surface follows. Nothing
 * else needs to change.
 */
export type Section = {
  /** DOM id of the <section>. Also the hash target. */
  id: string;
  /** Accessible name. Used verbatim in the real <nav> and the sheet. */
  label: string;
  /** Two-digit index rendered in mono beside the trace pad. Machine fact. */
  ref: string;
};

export const SECTIONS: readonly Section[] = [
  { id: "overview", label: "Overview", ref: "00" },
  { id: "graph", label: "Project graph", ref: "01" },
  { id: "type", label: "Typography", ref: "02" },
  { id: "color", label: "Color", ref: "03" },
] as const;

export const SECTION_IDS = SECTIONS.map((s) => s.id);
