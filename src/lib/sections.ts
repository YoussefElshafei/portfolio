/**
 * The section registry.
 *
 * Single source of truth for the header nav, the mobile sheet and the trace
 * bus. All three map over this array, so they cannot drift apart.
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
  { id: "about", label: "About", ref: "01" },
  // Projects sit ahead of Skills deliberately. A visitor should meet the work
  // before a list of technologies; a tag list on its own says very little, and
  // DESIGN_BRIEF.md §1d is explicit that depth of work is what reads as senior.
  { id: "work", label: "Projects", ref: "02" },
  { id: "skills", label: "Skills", ref: "03" },
  { id: "experience", label: "Experience", ref: "04" },
  { id: "involvement", label: "Involvement", ref: "05" },
  { id: "contact", label: "Contact", ref: "06" },
] as const;

export const SECTION_IDS = SECTIONS.map((s) => s.id);
